/** Decorative podium medals — original SVG artwork for leaderboard ranks 1–3. */

type MedalProps = {
  className?: string;
  title?: string;
};

function MedalBase({
  className,
  title,
  metal,
  metalDark,
  metalLight,
  ribbonLeft,
  ribbonRight,
  numeral,
}: MedalProps & {
  metal: string;
  metalDark: string;
  metalLight: string;
  ribbonLeft: string;
  ribbonRight: string;
  numeral: string;
}) {
  const id = `medal-${numeral}`;
  return (
    <svg
      className={className}
      viewBox="0 0 48 56"
      width={40}
      height={46}
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={`${id}-face`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={metalLight} />
          <stop offset="45%" stopColor={metal} />
          <stop offset="100%" stopColor={metalDark} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={metalLight} />
          <stop offset="100%" stopColor={metalDark} />
        </linearGradient>
      </defs>
      {/* Ribbons */}
      <path d="M18 2 L12 22 L20 18 L22 2 Z" fill={ribbonLeft} />
      <path d="M30 2 L36 22 L28 18 L26 2 Z" fill={ribbonRight} />
      <path d="M22 2 L20 18 L28 18 L26 2 Z" fill={ribbonLeft} opacity="0.85" />
      {/* Medal disc */}
      <circle cx="24" cy="34" r="16" fill={`url(#${id}-rim)`} />
      <circle cx="24" cy="34" r="13.5" fill={`url(#${id}-face)`} />
      <circle
        cx="24"
        cy="34"
        r="11"
        fill="none"
        stroke={metalLight}
        strokeOpacity="0.55"
        strokeWidth="1.25"
      />
      <text
        x="24"
        y="35"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Plus Jakarta Sans', 'Segoe UI', sans-serif"
        fontSize="14"
        fontWeight="700"
        fill={metalDark}
      >
        {numeral}
      </text>
    </svg>
  );
}

export function GoldMedal({ className, title = '1st place' }: MedalProps) {
  return (
    <MedalBase
      className={className}
      title={title}
      numeral="1"
      metal="#F5C542"
      metalDark="#B45309"
      metalLight="#FDE68A"
      ribbonLeft="#DC2626"
      ribbonRight="#B91C1C"
    />
  );
}

export function SilverMedal({ className, title = '2nd place' }: MedalProps) {
  return (
    <MedalBase
      className={className}
      title={title}
      numeral="2"
      metal="#C0CBD8"
      metalDark="#475569"
      metalLight="#F1F5F9"
      ribbonLeft="#64748B"
      ribbonRight="#475569"
    />
  );
}

export function BronzeMedal({ className, title = '3rd place' }: MedalProps) {
  return (
    <MedalBase
      className={className}
      title={title}
      numeral="3"
      metal="#D97706"
      metalDark="#7C2D12"
      metalLight="#FDBA74"
      ribbonLeft="#9A3412"
      ribbonRight="#7C2D12"
    />
  );
}
