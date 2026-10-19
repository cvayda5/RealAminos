// Decorative research vial drawn as inline SVG for the /shop bridge page.
// Deliberately generic: the label carries only the brand wordmark, "Research
// Compound / RUO" and an example lot number — never a compound name or dose.
export default function BridgeVial({
  uid,
  lot = "RA-0001",
  className,
}: {
  uid: string;
  lot?: string;
  className?: string;
}) {
  const g = (n: string) => `${uid}-${n}`;
  return (
    <svg
      className={className}
      viewBox="0 0 120 224"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Research vial"
    >
      <defs>
        <linearGradient id={g("cap")} x1="0" x2="1">
          <stop offset="0" stopColor="#c2540c" />
          <stop offset=".3" stopColor="#fb923c" />
          <stop offset=".55" stopColor="#f97316" />
          <stop offset="1" stopColor="#b44a08" />
        </linearGradient>
        <linearGradient id={g("crimp")} x1="0" x2="1">
          <stop offset="0" stopColor="#8b929b" />
          <stop offset=".25" stopColor="#f3f4f6" />
          <stop offset=".5" stopColor="#b8bec6" />
          <stop offset=".8" stopColor="#eef0f3" />
          <stop offset="1" stopColor="#7d848d" />
        </linearGradient>
        <linearGradient id={g("glass")} x1="0" x2="1">
          <stop offset="0" stopColor="#d5dae1" />
          <stop offset=".18" stopColor="#ffffff" />
          <stop offset=".75" stopColor="#f3f5f8" />
          <stop offset="1" stopColor="#c9cfd8" />
        </linearGradient>
        <linearGradient id={g("band")} x1="0" x2="1">
          <stop offset="0" stopColor="#c2540c" />
          <stop offset=".5" stopColor="#f97316" />
          <stop offset="1" stopColor="#c2540c" />
        </linearGradient>
      </defs>

      {/* glass body + neck */}
      <rect x="34" y="50" width="52" height="22" fill={`url(#${g("glass")})`} stroke="#cfd4da" />
      <rect x="12" y="66" width="96" height="152" rx="20" fill={`url(#${g("glass")})`} stroke="#cfd4da" />

      {/* cap + crimp */}
      <rect x="30" y="3" width="60" height="30" rx="7" fill={`url(#${g("cap")})`} />
      <rect x="36" y="6" width="10" height="24" rx="5" fill="#fff" opacity=".28" />
      <rect x="25" y="31" width="70" height="22" rx="4" fill={`url(#${g("crimp")})`} />
      <rect x="25" y="46" width="70" height="2" fill="#6b727b" opacity=".35" />

      {/* glass highlight */}
      <rect x="19" y="70" width="6" height="140" rx="3" fill="#fff" opacity=".55" />

      {/* label */}
      <rect x="14" y="98" width="92" height="104" fill="#fff" />
      <text x="60" y="118" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="13" fontWeight="800" fill="#111827">
        real<tspan fill="#f97316">aminos</tspan>
      </text>
      <text x="60" y="136" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="6.4" fontWeight="700" letterSpacing=".4" fill="#111827">
        RESEARCH COMPOUND
      </text>
      <rect x="40" y="142" width="40" height="17" rx="2" fill="#f97316" />
      <text x="60" y="154.5" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="11" fontWeight="800" fill="#fff">
        RUO
      </text>
      <line x1="22" y1="168" x2="98" y2="168" stroke="#e5e7eb" />
      <text x="60" y="178" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="5" fontWeight="700" fill="#374151">
        PURITY TESTED
      </text>
      <text x="60" y="185" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="4.4" fill="#6b7280">
        FOR RESEARCH PURPOSES ONLY
      </text>
      <rect x="14" y="190" width="92" height="12" fill={`url(#${g("band")})`} />
      <text x="60" y="198.6" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="5.4" fontWeight="700" letterSpacing=".5" fill="#fff">
        LOT {lot}
      </text>
    </svg>
  );
}
