/** Krajina pro úvod: hřeben Krušných hor, hrad, rozhledna a červená turistická stezka. */
export function Landscape({ className }: { className?: string }) {
  const spruce = (x: number, y: number, h: number) => `M${x} ${y}l${h * 0.32} ${h}h${-h * 0.64}z`;
  const forest = [
    [140, 128, 16], [152, 132, 13], [163, 135, 15], [176, 140, 12], [186, 138, 16],
    [214, 130, 14], [226, 126, 17], [240, 122, 13], [252, 119, 15], [338, 116, 14],
    [350, 120, 17], [362, 124, 13], [20, 150, 15], [32, 146, 12], [44, 141, 16],
    [-150, 140, 15], [-138, 142, 12], [-126, 145, 16], [-320, 136, 14], [-306, 134, 11],
    [520, 128, 14], [532, 126, 17], [544, 129, 12], [680, 138, 15], [694, 140, 12],
  ];
  return (
    <svg viewBox="-400 0 1200 240" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <circle cx="262" cy="50" r="18" fill="var(--trail-yellow)" opacity="0.9" />
      {/* scéna je 0–400, strany jen prodlužují kopce pro široké displeje */}
      <path d="M-400 104C-340 92-280 88-220 96S-100 84-40 100-10 110 0 112V240H-400Z" fill="var(--hill-far)" stroke="var(--hill-far)" strokeWidth="4" />
      <path d="M400 86C460 80 520 96 580 92S700 78 760 90 790 96 800 94V240H400Z" fill="var(--hill-far)" stroke="var(--hill-far)" strokeWidth="4" />
      <path d="M0 112C40 98 72 92 112 98S182 80 222 86 302 72 342 82 390 90 400 86V240H0Z" fill="var(--hill-far)" />
      <path d="M-400 150C-330 130-260 124-200 134S-80 150-30 152-8 157 0 158V240H-400Z" fill="var(--hill-mid)" stroke="var(--hill-mid)" strokeWidth="4" />
      <path d="M400 136C450 146 520 126 580 122S700 132 760 140 790 144 800 142V240H400Z" fill="var(--hill-mid)" stroke="var(--hill-mid)" strokeWidth="4" />
      <path d="M0 158C30 138 62 120 96 118 126 116 150 134 180 146 220 136 262 114 300 112 340 110 370 126 400 136V240H0Z" fill="var(--hill-mid)" />
      {forest.map(([x, y, h], i) => <path key={i} d={spruce(x, y - h, h)} fill="var(--tree)" />)}

      {/* hrad na kopci, Loket by se nezlobil */}
      <g fill="var(--tree)">
        <path d="M80 120V94h4v-5h4v5h4v-5h4v5h4v26z" />
        <path d="M100 120V102h3v-4h3v4h3v-4h3v4h2v18z" />
        <rect x="86" y="104" width="4" height="7" rx="2" fill="var(--hill-mid)" />
      </g>

      {/* rozhledna */}
      <g stroke="var(--tree)" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M292 112l6-34M308 112l-6-34M294 100h12M296 89h8" />
        <path d="M293 78h14l-2-7h-10z" fill="var(--tree)" />
        <path d="M300 71v-7" />
      </g>
      <path d="M300 64l7 2.5-7 2.5z" fill="var(--trail-red)" />

      <path d="M-400 190C-300 178-200 186-100 192S-20 197 0 196V240H-400Z" fill="var(--hill-near)" stroke="var(--hill-near)" strokeWidth="4" />
      <path d="M400 180C480 172 560 184 640 186S760 180 800 182V240H400Z" fill="var(--hill-near)" stroke="var(--hill-near)" strokeWidth="4" />
      <path d="M0 196C60 182 122 174 200 177S338 188 400 180V240H0Z" fill="var(--hill-near)" />

      {/* stezka od diváka k hradu */}
      <path d="M214 240C204 216 168 206 156 190S122 150 98 124" fill="none" stroke="var(--trail-red)"
        strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.5 7" />
    </svg>
  );
}
