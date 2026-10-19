// The RealAminos vial photo (cut out, transparent background) used throughout
// the /shop bridge page, with an example lot number printed on the label.
// The label carries only the brand wordmark and a lot number — never a
// compound name or dose. The lot text is HTML laid over the photo (sized from
// the --vh custom property each placement sets in bridge.css), so every vial
// can show a different lot without a separate image.
export default function BridgeVial({ className, lot }: { className?: string; lot: string }) {
  return (
    <span className={`br-vial ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="br-vial-img"
        src="/realaminos-vial.png"
        alt={`RealAminos research vial, example lot ${lot}`}
        width={392}
        height={887}
        loading="eager"
        decoding="async"
      />
      <span className="br-lot-tag" aria-hidden="true">
        LOT {lot}
      </span>
    </span>
  );
}
