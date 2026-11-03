export function LoginArt() {
  return (
    <>
      <div className="dec dCombo" aria-hidden>
        <svg viewBox="0 0 400 330">
          <defs>
            <linearGradient id="kA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9A7DF0" />
              <stop offset="1" stopColor="#4A2AA8" />
            </linearGradient>
            <linearGradient id="kB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6B4DE0" />
              <stop offset="1" stopColor="#2A1180" />
            </linearGradient>
            <linearGradient id="kC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C4B2F8" />
              <stop offset="1" stopColor="#6B4DE0" />
            </linearGradient>
          </defs>
          <ellipse cx="170" cy="322" rx="160" ry="9" fill="#2A1180" opacity="0.25" />
          <g>
            <rect x="14" y="268" width="312" height="50" rx="8" fill="url(#kB)" />
            <rect x="120" y="280" width="100" height="26" rx="3" fill="#EDE6FF" opacity="0.6" />
          </g>
          <g>
            <rect x="34" y="224" width="274" height="46" rx="8" fill="url(#kA)" />
            <rect x="127" y="235" width="88" height="24" rx="3" fill="#EDE6FF" opacity="0.6" />
          </g>
          <g transform="rotate(-3 169 204)">
            <rect x="24" y="182" width="290" height="44" rx="8" fill="url(#kC)" />
            <rect x="122" y="193" width="93" height="23" rx="3" fill="#EDE6FF" opacity="0.6" />
          </g>
          <path
            d="M52 62C20 56 10 100 56 128M148 62C180 56 190 100 144 128"
            transform="translate(70 8)"
            fill="none"
            stroke="#8E6FEA"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M46 30H154C154 30 158 96 134 126C122 142 112 148 106 156H94C88 148 78 142 66 126C42 96 46 30 46 30Z"
            transform="translate(70 8)"
            fill="#7C5CE6"
          />
          <rect x="140" y="190" width="60" height="16" rx="3" fill="#2E1488" />
        </svg>
      </div>
      <div className="dec dMedal" aria-hidden>
        <svg viewBox="0 0 140 230">
          <defs>
            <linearGradient id="mr" x1="0" x2="1">
              <stop offset="0" stopColor="#3A1AA6" />
              <stop offset="1" stopColor="#8E6FEA" />
            </linearGradient>
            <radialGradient id="mm" cx="0.35" cy="0.3" r="0.9">
              <stop offset="0" stopColor="#EDE6FF" />
              <stop offset="0.5" stopColor="#9A7DF0" />
              <stop offset="1" stopColor="#3A1AA6" />
            </radialGradient>
          </defs>
          <path d="M34 4H64L88 86H60ZM106 4H76L52 86H80Z" fill="url(#mr)" />
          <circle cx="70" cy="144" r="54" fill="url(#mm)" />
          <circle
            cx="70"
            cy="144"
            r="40"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.6"
            strokeWidth="2"
          />
          <path
            d="M70 120L77 137L95 139L82 151L86 169L70 160L54 169L58 151L45 139L63 137Z"
            fill="#fff"
            fillOpacity="0.9"
          />
        </svg>
      </div>
      <div className="dec dS1" aria-hidden>
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M20 4L24.8 15.2L36 20L24.8 24.8L20 36L15.2 24.8L4 20L15.2 15.2Z"
            stroke="#5B2BC9"
            strokeOpacity="0.13"
            strokeWidth="2"
            fill="#9A6BF0"
            fillOpacity="0.1"
          />
        </svg>
      </div>
      <div className="dec dS2" aria-hidden>
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M20 4L24.8 15.2L36 20L24.8 24.8L20 36L15.2 24.8L4 20L15.2 15.2Z"
            stroke="#5B2BC9"
            strokeOpacity="0.13"
            strokeWidth="2"
            fill="#9A6BF0"
            fillOpacity="0.1"
          />
        </svg>
      </div>
    </>
  );
}
