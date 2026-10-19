// Line icons shared by the /shop and /lab/bridge bridge pages.
export default function Icon({ name }: { name: "doc" | "list" | "shield" | "flask" | "target" | "tag" | "box" }) {
  const common = {
    width: 40,
    height: 40,
    viewBox: "0 0 40 40",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "doc":
      return (
        <svg {...common}>
          <path d="M10 5h14l7 7v23H10z" />
          <path d="M24 5v7h7" />
          <path d="M15 21h10M15 26h6" />
          <circle cx="27" cy="29" r="6" fill="#fff" />
          <path d="m24.2 29 2 2 3.4-3.6" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <rect x="7" y="5" width="26" height="30" rx="3" />
          <path d="M13 13h2M13 20h2M13 27h2M19 13h8M19 20h8M19 27h8" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M20 4 7 9v10c0 8 5.5 14 13 17 7.5-3 13-9 13-17V9z" />
          <path d="m14 20 4.5 4.5L27 16" />
        </svg>
      );
    case "flask":
      return (
        <svg {...common}>
          <path d="M15 5h10M17 5v10L8 31a3 3 0 0 0 2.6 4.5h18.8A3 3 0 0 0 32 31L23 15V5" />
          <path d="M12.5 26h15" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="12" />
          <circle cx="20" cy="20" r="3.5" />
          <path d="M20 3v8M20 29v8M3 20h8M29 20h8" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <rect x="9" y="5" width="22" height="30" rx="2" />
          <path d="M15 12v16M20 12v16M25 12v16" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="m20 4 14 7v18l-14 7-14-7V11z" />
          <path d="m6 11 14 7 14-7M20 18v18" />
        </svg>
      );
  }
}
