export default function Logo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer decorative ring with tick marks */}
      <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="0.6" opacity="0.25" />

      {/* Tick marks at compass points */}
      <line x1="20" y1="1" x2="20" y2="4.5"  stroke="currentColor" strokeWidth="0.8" opacity="0.35" strokeLinecap="round"/>
      <line x1="20" y1="35.5" x2="20" y2="39" stroke="currentColor" strokeWidth="0.8" opacity="0.35" strokeLinecap="round"/>
      <line x1="1" y1="20" x2="4.5" y2="20"  stroke="currentColor" strokeWidth="0.8" opacity="0.35" strokeLinecap="round"/>
      <line x1="35.5" y1="20" x2="39" y2="20" stroke="currentColor" strokeWidth="0.8" opacity="0.35" strokeLinecap="round"/>

      {/* Diagonal ticks */}
      <line x1="7.2" y1="7.2"   x2="9.5"  y2="9.5"  stroke="currentColor" strokeWidth="0.6" opacity="0.2" strokeLinecap="round"/>
      <line x1="30.5" y1="30.5" x2="32.8" y2="32.8" stroke="currentColor" strokeWidth="0.6" opacity="0.2" strokeLinecap="round"/>
      <line x1="32.8" y1="7.2"  x2="30.5" y2="9.5"  stroke="currentColor" strokeWidth="0.6" opacity="0.2" strokeLinecap="round"/>
      <line x1="9.5" y1="30.5"  x2="7.2"  y2="32.8" stroke="currentColor" strokeWidth="0.6" opacity="0.2" strokeLinecap="round"/>

      {/* Diamond envelope body */}
      <path
        d="M20 6 L34 20 L20 34 L6 20 Z"
        stroke="currentColor"
        strokeWidth="1.15"
        fill="none"
        opacity="0.7"
      />

      {/* Envelope flap fold line */}
      <path
        d="M6 20 L20 13.5 L34 20"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.4"
      />

      {/* Lock body */}
      <rect
        x="15.2" y="21.5"
        width="9.6" height="7.5"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />

      {/* Lock shackle */}
      <path
        d="M17.2 21.5 L17.2 19.5 Q17.2 16.8 20 16.8 Q22.8 16.8 22.8 19.5 L22.8 21.5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
      />

      {/* Lock keyhole */}
      <circle cx="20" cy="25" r="1.2" fill="currentColor" opacity="0.75" />
      <line x1="20" y1="26.2" x2="20" y2="28" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.75"/>
    </svg>
  );
}
