/**
 * API Client – ZÁPAD GO (Django backend, PROJECT_SPEC 9)
 * Automaticky posílá CSRF token a JWT httpOnly cookies.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchCsrfToken(): Promise<string> {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  if (match) return match[1];

  try {
    await fetch(`${API_BASE}/api/auth/status/`, { credentials: "include" });
    const matchAfter = document.cookie.match(/csrftoken=([^;]+)/);
    return matchAfter ? matchAfter[1] : '';
  } catch {
    return '';
  }
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const isModifying = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    options.method?.toUpperCase() ?? '',
  );

  // FormData (fotka) si Content-Type s boundary nastaví prohlížeč sám
  const headers: HeadersInit = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  // Přidat CSRF token pro modifying requesty
  if (isModifying && typeof document !== 'undefined') {
    const csrfToken = await fetchCsrfToken();
    if (csrfToken) {
      (headers as Record<string, string>)['X-CSRFToken'] = csrfToken;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // JWT access_token cookie
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    const d = (errorData ?? {}) as Record<string, unknown>;
    const fieldError = Object.values(d).find(Array.isArray) as string[] | undefined; // DRF validace polí
    const message = String(d.detail || d.error || d.message || fieldError?.[0] || `HTTP Error ${response.status}`);
    throw new ApiError(message, response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ── Auth Types ────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  date_joined: string;
  profile: {
    nickname: string;
    level: number;
    xp: number;
    school: string;
    age_group: 'under18' | 'adult';
    photo_public: boolean;
    wins: number;
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  age_group: 'under18' | 'adult';
  consent_confirmed: boolean;
  school?: string;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
  message?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: User | null;
}

export const authApi = {
  register: (data: RegisterData) =>
    apiFetch<AuthResponse>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (credentials: LoginCredentials) =>
    apiFetch<AuthResponse>('/api/auth/token/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    apiFetch<{ message: string }>('/api/auth/logout/', {
      method: 'POST',
    }),

  refreshToken: () =>
    apiFetch<{ access: string; refresh: string }>('/api/auth/token/refresh/', {
      method: 'POST',
    }),

  getMe: () => apiFetch<User>('/api/auth/me/'),

  updateMe: (data: Partial<User>) =>
    apiFetch<User>('/api/auth/me/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  checkStatus: () => apiFetch<AuthStatus>('/api/auth/status/'),

  deleteMe: () => apiFetch<void>('/api/auth/me/', { method: 'DELETE' }),

  changePassword: (data: {
    old_password: string;
    new_password: string;
    new_password2: string;
  }) =>
    apiFetch<{ message: string }>('/api/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/api/auth/forgot-password/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (data: {
    uid: string;
    token: string;
    new_password: string;
    new_password2: string;
  }) =>
    apiFetch<{ message: string }>('/api/auth/reset-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Hra ──────────────────────────────────────────────────────────────────────

export type Category = 'castle' | 'lookout' | 'spring' | 'culture' | 'nature' | 'heritage' | 'food' | 'info';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PetType = 'fortress' | 'view' | 'nature' | 'spring' | 'culture' | 'taste';

export interface PlaceFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: number; name: string; category: Category; subtype: string; rarity: Rarity; okres: string; is_hazardous: boolean };
}

/** Fotka místa z Wikimedia Commons, stažená na backend (manage.py fetch_place_photos). */
export interface PlacePhoto {
  url: string; // relativní /media/places/<id>.jpg
  author: string;
  license: string;
  source: string;
}

/** Absolutní URL pro soubory z backendu (/media/...). */
export const mediaUrl = (path: string) => (path.startsWith('http') ? path : `${API_BASE}${path}`);

export interface PlaceDetail {
  id: number;
  name: string;
  category: Category;
  subtype: string;
  lat: number;
  lon: number;
  description: string;
  url: string;
  obec: string;
  okres: string;
  rarity: Rarity;
  is_hazardous: boolean;
  nearest_stop_name: string;
  nearest_stop_m: number | null;
  license: string;
  source_url: string;
  extra: {
    products?: { name: string; category: string; year: string }[];
    photo?: PlacePhoto;
    wiki?: { title: string; extract: string; url: string };
  };
  stamped: boolean;
  stamp_count: number;
  my_pet: { id: number; name: string; type: PetType; seed: number; stage: number; rarity: Rarity; level: number } | null | false;
}

export interface Pet {
  id: number;
  name: string;
  species: string;
  type: PetType;
  rarity: Rarity;
  hp: number;
  atk: number;
  defense: number;
  spd: number;
  mag: number;
  stamina: number;
  stats: PetStats; // staty v boji (level + evoluce)
  level: number;
  xp: number;
  xp_level: number;
  xp_next: number | null;
  stage: number;
  stage_label: string;
  can_evolve: boolean;
  evolve_level: number | null;
  injured_until: string | null;
  moves: MoveInfo[];
  seed: number;
  lore: string;
  verified: boolean;
  is_demo: boolean;
  place: { id: number; name: string; category: Category };
  created_at: string;
}

export interface PetStats { hp: number; atk: number; defense: number; spd: number; mag: number; stamina: number }

export interface MoveInfo {
  id: string;
  name: string;
  kind: 'phys' | 'magic' | 'guard';
  power: number;
  acc: number;
  cost: number;
  fx: string;
  heal?: number;
  drain?: number;
  type?: PetType;
}

export interface CheckIn {
  id: number;
  created_at: string;
  distance_m: number;
  trust: number;
  verified: boolean;
  is_demo: boolean;
  exif_status: string;
  place: { id: number; name: string; category: Category; okres: string; rarity: Rarity };
}

export interface BadgeInfo {
  code: string;
  name: string;
  description: string;
  icon: string;
  progress: number;
  target: number | null;
  awarded: boolean;
}

export interface CheckInResult {
  checkin: CheckIn;
  pet: Pet;
  xp_gain: number;
  level_up: boolean;
  level: number;
  new_badges: { code: string; name: string; icon: string }[];
}

export interface LeaderRow {
  name: string;
  level?: number;
  stamps: number;
  wins: number;
  players?: number;
}

/** Malá ukázka tvora (nejlepší tvor hráče, výzva). */
export interface PetPreview { name: string; type: PetType; seed: number; stage: number; rarity: Rarity; level: number }

export interface Person { id: number; nickname: string; level: number; rating: number; top_pet: PetPreview | null }
export interface FriendsData { friends: Person[]; incoming: Person[]; outgoing: Person[] }
export type FriendState = 'none' | 'outgoing' | 'incoming' | 'friends';

export interface Challenge { battle_id: string; from: string; created_at: string; pet: PetPreview | null }

export interface PublicProfile {
  friendship: { id: number | null; state: FriendState } | null; // null = můj profil nebo nepřihlášený
  friends_count: number;
  rating: number;
  top_pet: PetPreview | null;
  nickname: string;
  level: number;
  xp: number;
  school: string;
  wins: number;
  stamps: number;
  team: string | null;
  badges: { code: string; name: string; icon: string; awarded_at: string }[];
  pets: Pet[];
}

export const gameApi = {
  places: () => apiFetch<{ type: 'FeatureCollection'; features: PlaceFeature[] }>('/api/places/geojson/'),
  // no-store: po razítku se musí hned ukázat nový stav (žádná HTTP cache prohlížeče)
  place: (id: string | number) => apiFetch<PlaceDetail>(`/api/places/${id}/`, { cache: 'no-store' }),
  checkIn: (form: FormData) => apiFetch<CheckInResult>('/api/checkins/', { method: 'POST', body: form }),
  myCheckins: () => apiFetch<CheckIn[]>('/api/checkins/me/', { cache: 'no-store' }),
  myPets: () => apiFetch<Pet[]>('/api/pets/me/'),
  evolvePet: (id: number) => apiFetch<Pet>(`/api/pets/${id}/evolve/`, { method: 'POST' }),
  renamePet: (id: number, name: string) =>
    apiFetch<Pet>(`/api/pets/${id}/`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  badges: () => apiFetch<BadgeInfo[]>('/api/badges/'),
  leaderboard: (scope: 'global' | 'school' | 'team', metric: 'stamps' | 'wins') =>
    apiFetch<LeaderRow[]>(`/api/leaderboard/?scope=${scope}&metric=${metric}`),
  user: (nickname: string) => apiFetch<PublicProfile>(`/api/users/${encodeURIComponent(nickname)}/`, { cache: 'no-store' }),
};

export const friendsApi = {
  list: () => apiFetch<FriendsData>('/api/friends/', { cache: 'no-store' }),
  add: (nickname: string) => apiFetch<FriendsData>('/api/friends/', { method: 'POST', body: JSON.stringify({ nickname }) }),
  accept: (id: number) => apiFetch<FriendsData>(`/api/friends/${id}/accept/`, { method: 'POST' }),
  remove: (id: number) => apiFetch<FriendsData>(`/api/friends/${id}/`, { method: 'DELETE' }),
};

const ERROR_TEXT: Record<string, string> = {
  TOO_FAR: 'Jsi moc daleko. Přijď blíž než 300 m k místu.',
  LOW_ACCURACY: 'GPS je zatím nepřesná. Chvilku počkej venku a zkus to znovu.',
  TOO_FAST: 'Od posledního razítka ses přesunul nereálně rychle.',
  CLOCK_SKEW: 'Čas v telefonu nesedí. Zapni automatický čas.',
  ALREADY_STAMPED: 'Tohle místo už v Pasu máš.',
  COOLDOWN: 'Moc rychle za sebou. Další razítko za chvíli.',
  DUPLICATE_PHOTO: 'Tahle fotka už byla použitá. Vyfoť místo znovu.',
  BAD_PHOTO: 'Soubor není platná fotka.',
  PHOTO_TOO_LARGE: 'Fotka je moc velká (max. 8 MB).',
  PHOTO_REQUIRED: 'K razítku je potřeba fotka místa.',
  DEMO_FORBIDDEN: 'Demo razítko je povolené jen pro organizátory.',
};

/** Srozumitelná česká hláška z chyby API (error_code → text). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const code = (e.data as { error_code?: string } | undefined)?.error_code;
    if (code === 'TOO_FAR') {
      const d = (e.data as { distance_m?: number }).distance_m;
      return d ? `Jsi ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : d + ' m'} daleko. Přijď blíž než 300 m.` : ERROR_TEXT.TOO_FAR;
    }
    if (code && ERROR_TEXT[code]) return ERROR_TEXT[code];
    if (e.status === 401) return 'Nejdřív se přihlas.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Něco se pokazilo.';
}

// ── Souboje (PROJECT_SPEC 9, 10) ─────────────────────────────────────────────

export type Move = string;

export interface BattleFighter {
  hp: number;
  max_hp: number;
  sp: number;
  max_sp: number;
  guard: boolean;
  type: PetType;
  name: string;
  seed: number;
  stage: number;
  rarity: Rarity;
  level: number;
  moves?: MoveInfo[]; // jen u tebe
}

export interface BattleState {
  type: 'state';
  battle_id: string;
  mode: 'ranked' | 'friendly' | 'practice';
  status: 'waiting' | 'active' | 'finished' | 'abandoned';
  turn: number | null;
  you: BattleFighter | null;
  opp: BattleFighter | null;
  deadline: string | null;
  waiting_for_you: boolean;
  is_bot: boolean;
}

export interface TurnEvent {
  actor: 'you' | 'opp';
  move: Move;
  name: string;
  kind: MoveInfo['kind'];
  fx: string;
  cost: number;
  hit?: boolean;
  crit?: boolean;
  damage?: number;
  effectiveness?: number;
  heal?: number;
}

export interface TurnResult {
  type: 'turn_result';
  turn: number;
  events: TurnEvent[];
}

export interface BattleEnd {
  type: 'battle_end';
  winner: 'you' | 'opp' | 'draw';
  xp: number;
  rating_delta: number;
  level_up: number | null;
  injured_until: string | null;
  can_evolve: boolean;
}

export interface BattleDetail extends Omit<BattleState, 'type'> {
  log: TurnResult[];
  joinable: boolean;
  challenger: string;
  invited: string | null;
  is_participant: boolean;
  result?: BattleEnd;
}

export const battleApi = {
  create: (mode: 'practice' | 'friendly' | 'ranked', pet_id: number, invite?: string) =>
    apiFetch<{ battle_id: string; status: string; mode: string }>('/api/battles/', {
      method: 'POST',
      body: JSON.stringify({ mode, pet_id, invite }),
    }),
  challenges: () => apiFetch<Challenge[]>('/api/battles/challenges/', { cache: 'no-store' }),
  join: (id: string, pet_id: number) =>
    apiFetch<{ battle_id: string; status: string }>(`/api/battles/${id}/join/`, {
      method: 'POST',
      body: JSON.stringify({ pet_id }),
    }),
  get: (id: string) => apiFetch<BattleDetail>(`/api/battles/${id}/`, { cache: 'no-store' }),
};

Object.assign(ERROR_TEXT, {
  NO_PET: 'Vyber svého PETa.',
  PET_NOT_VERIFIED: 'Do hodnoceného souboje smí jen ověření PETi (ne demo).',
  NOT_WAITING: 'Souboj už začal nebo skončil.',
  SELF: 'Nemůžeš bojovat sám se sebou.',
});

// ── Agregace pro kraj (PROJECT_SPEC 6.4) ──────────────────────────────────────

export interface PlaceStatRow { id: number; name: string; category: Category; okres: string; stamps: number }

export interface PlaceStats {
  total_stamps: number;
  total_players: number;
  top: PlaceStatRow[];
  least: PlaceStatRow[];
  visited: { id: number; lat: number; lon: number; category: Category; name: string; stamps: number }[];
  by_okres: { okres: string; stamps: number; places: number }[];
  by_category: { category: Category; stamps: number; places: number }[];
}

export const statsApi = {
  places: () => apiFetch<PlaceStats>('/api/stats/places/'),
};

// ── Questy a týmy (PROJECT_SPEC 7.5, 7.6) ────────────────────────────────────

export interface Quest {
  code: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  target: number;
  done: boolean;
  place_id?: number | null;
}

export interface Team {
  name: string;
  join_code: string;
  owner: string;
  members: { nickname: string; level: number }[];
}

export const teamApi = {
  quests: () => apiFetch<Quest[]>('/api/quests/'),
  mine: () => apiFetch<{ team: Team | null }>('/api/teams/'),
  create: (name: string) => apiFetch<{ team: Team }>('/api/teams/', { method: 'POST', body: JSON.stringify({ name }) }),
  join: (join_code: string) => apiFetch<{ team: Team }>('/api/teams/join/', { method: 'POST', body: JSON.stringify({ join_code }) }),
  leave: () => apiFetch<{ team: null }>('/api/teams/leave/', { method: 'POST' }),
};

Object.assign(ERROR_TEXT, {
  BAD_CODE: 'Tým s tímto kódem neexistuje.',
  NAME_TAKEN: 'Tým s tímto názvem už existuje.',
});

export { apiFetch, ApiError };
