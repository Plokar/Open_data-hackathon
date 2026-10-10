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

let refreshing: Promise<boolean> | null = null;

/** Obnoví access token přes refresh cookie. Souběžné požadavky sdílí jeden refresh, rotace by druhý zneplatnila. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/api/auth/token/refresh/`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok, () => false)
    .finally(() => { refreshing = null; });
  return refreshing;
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

  const send = () => fetch(url, { ...options, headers, credentials: 'include' }); // JWT access_token cookie
  let response = await send();
  // Prošlý access token: jednou obnovit a zopakovat. U /api/auth/ ne, tam 401 znamená špatné heslo.
  if (response.status === 401 && !endpoint.startsWith('/api/auth/') && (await refreshSession())) response = await send();

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
    account_claimed: boolean; // false = účet jen se jménem (vygenerovaný e-mail a heslo)
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
  can_refresh?: boolean; // má refresh cookie (httpOnly, JS ji nevidí)
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

  /** Smí ostatní přihlášení hráči vidět fotky z mých razítek? (výchozí: ne) */
  setPhotoPublic: (photo_public: boolean) =>
    apiFetch<User>('/api/auth/me/', { method: 'PUT', body: JSON.stringify({ photo_public }) }),

  updateMe: (data: Partial<User>) =>
    apiFetch<User>('/api/auth/me/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  checkStatus: () => apiFetch<AuthStatus>('/api/auth/status/'),

  deleteMe: () => apiFetch<void>('/api/auth/me/', { method: 'DELETE' }),
  /** Pojistit účet ze jména vlastním e-mailem a heslem (u pojištěného účtu s aktuálním heslem). */
  setCredentials: (data: { email: string; password?: string; password2?: string; current_password?: string }) =>
    apiFetch<User>('/api/auth/credentials/', { method: 'POST', body: JSON.stringify(data) }),

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
    swim?: { spec: string; amenities: string }; // koupací místa: druh a vybavení (kvalita vody je na webu KHS, viz `url`)
  };
  stamped: boolean;
  stamp_count: number;
  forgotten: boolean; // málo navštěvované místo: ×1,5 XP
  food_kinds?: { name: string; tasted: boolean }[]; // jen u výrobců Dobrot
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
  type2: PetType | '';   // kříženec dvou typů
  bonus_move: string;    // vyšlechtěné kouzlo
  favorite: boolean;
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
  bred?: boolean; // vyšlechtěné kouzlo
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
  forgotten: boolean;
  trail_done: { id: string; stop: string } | null;
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
  favoritePet: (id: number, favorite: boolean) =>
    apiFetch<Pet>(`/api/pets/${id}/`, { method: 'PATCH', body: JSON.stringify({ favorite }) }),
  mergeOdds: (a: number, b: number) => apiFetch<MergeOdds>(`/api/pets/merge/preview/?a=${a}&b=${b}`, { cache: 'no-store' }),
  merge: (a: number, b: number) => apiFetch<MergeResult>('/api/pets/merge/', { method: 'POST', body: JSON.stringify({ a, b }) }),
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
export type BattleMode = 'ranked' | 'friendly' | 'practice' | 'ffa' | 'team' | 'boss';

/** Bojovník ve slotu a–d. Výdrž (sp) jen u tebe a spojenců. */
export interface BattleFighter {
  slot: string;
  team: string;
  me: boolean;
  ally: boolean;
  owner: string | null; // přezdívka hráče, null = strážce / boss
  boss?: boolean;
  hp: number;
  max_hp: number;
  sp?: number;
  max_sp?: number;
  guard: boolean;
  type: PetType;
  type2?: PetType | '';
  name: string;
  seed: number;
  stage: number;
  rarity: Rarity;
  level: number;
}

export interface BattleState {
  type: 'state';
  battle_id: string;
  mode: BattleMode;
  size: number;
  status: 'waiting' | 'active' | 'finished' | 'abandoned';
  turn: number | null;
  deadline: string | null;
  me: string | null;
  fighters: BattleFighter[];
  moves: MoveInfo[] | null;
  waiting_for_you: boolean;
  waiting_for: string[];
  is_bot: boolean;
  boss: { place: number; place_name: string; week: string } | null;
}

export interface TurnEvent {
  actor: string;   // slot
  target?: string; // slot zasaženého
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
  winners: string[];
  xp: number;
  rating_delta: number;
  level_up: number | null;
  injured_until: string | null;
  can_evolve: boolean;
  reward: { pet: Pet | null; badges: { code: string; name: string; icon: string }[] } | null;
}

export interface BattleDetail extends Omit<BattleState, 'type'> {
  log: TurnResult[];
  joinable: boolean;
  is_host: boolean;
  free_teams: string[];
  challenger: string;
  invited: string | null;
  is_participant: boolean;
  result?: BattleEnd;
}

export interface BossInfo {
  place: { id: number; name: string; lat: number; lon: number; category: Category };
  boss: { name: string; species: string; title: string; type: PetType; seed: number; rarity: Rarity; stage: number };
  fought: boolean;   // tento týden už s ním bojoval (jednou za týden)
  defeated: boolean; // a porazil ho
  until: string;     // neděle, pak se bosové přesunou
}

export interface MergeOdds { success: number; hybrid: boolean; ability: number; rarity_up: number; mutation: number; loss: number }
export interface MergeResult {
  success: boolean;
  lost?: boolean; // nepovedlo se a oba rodiče zmizeli
  parents: number[];
  pet?: Pet;
  new_ability?: string;
  new_species?: boolean;
  rarity_up?: boolean;
  mutation?: string | null;
}

export const battleApi = {
  create: (mode: 'practice' | 'friendly' | 'ranked' | 'ffa' | 'team', pet_id: number, invite?: string) =>
    apiFetch<{ battle_id: string; status: string; mode: string }>('/api/battles/', {
      method: 'POST',
      body: JSON.stringify({ mode, pet_id, invite }),
    }),
  challenges: () => apiFetch<Challenge[]>('/api/battles/challenges/', { cache: 'no-store' }),
  join: (id: string, pet_id: number, team?: string, position?: Record<string, number | boolean>) =>
    apiFetch<{ battle_id: string; status: string }>(`/api/battles/${id}/join/`, {
      method: 'POST',
      body: JSON.stringify({ pet_id, team, ...position }),
    }),
  start: (id: string) => apiFetch<{ battle_id: string; status: string }>(`/api/battles/${id}/start/`, { method: 'POST' }),
  bosses: () => apiFetch<BossInfo[]>('/api/battles/bosses/', { cache: 'no-store' }),
  challengeBoss: (placeId: number, data: Record<string, string | number | boolean>) =>
    apiFetch<{ battle_id: string }>(`/api/battles/bosses/${placeId}/`, { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => apiFetch<BattleDetail>(`/api/battles/${id}/`, { cache: 'no-store' }),
};

Object.assign(ERROR_TEXT, {
  NO_PET: 'Vyber svého PETa.',
  PET_NOT_VERIFIED: 'Do hodnoceného souboje smí jen ověření PETi (ne demo).',
  NOT_WAITING: 'Souboj už začal nebo skončil.',
  BOSS_FOUGHT: 'S tímhle bosem jsi tento týden už bojoval. Příští týden se objeví jinde.',
  NOT_HOST: 'Souboj spouští ten, kdo bosse vyzval.',
  SELF: 'Nemůžeš bojovat sám se sebou.',
});

// ── Agregace pro kraj (PROJECT_SPEC 6.4) ──────────────────────────────────────

export interface PlaceStatRow { id: number; name: string; category: Category; okres: string; stamps: number }

export interface PlaceStats {
  total_stamps: number;
  forgotten_stamps: number;
  total_players: number;
  top: PlaceStatRow[];
  least: PlaceStatRow[];
  visited: { id: number; lat: number; lon: number; category: Category; name: string; stamps: number }[];
  by_okres: { okres: string; stamps: number; places: number }[];
  by_category: { category: Category; stamps: number; places: number }[];
}

export const statsApi = {
  places: () => apiFetch<PlaceStats>('/api/stats/places/'),
  csvUrl: `${API_BASE}/api/stats/places.csv`, // otevřená data zpět (CC0)
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
  weather?: 'rain' | 'clear' | null;
}

/** Výprava bez auta: místa u jedné autobusové zastávky. */
export interface Trail {
  id: string;
  stop: string;
  okres: string;
  progress: number;
  target: number;
  done: boolean;
  places: { id: number; name: string; category: Category; stamped: boolean }[];
}

/** Druh oceněných Dobrot kraje a zda ho hráč už ochutnal (navštívil výrobce). */
export interface FoodKind { name: string; producers: number; tasted: boolean }

export interface Team {
  name: string;
  join_code: string;
  owner: string;
  members: { nickname: string; level: number; week: number }[];
  challenge: { progress: number; target: number }; // týdenní výzva: 3 razítka na člena
}

export const teamApi = {
  quests: () => apiFetch<Quest[]>('/api/quests/'),
  trails: () => apiFetch<Trail[]>('/api/trails/', { cache: 'no-store' }),
  foodPass: () => apiFetch<FoodKind[]>('/api/food-pass/', { cache: 'no-store' }),
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
