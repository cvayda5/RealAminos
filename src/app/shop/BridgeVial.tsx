// The RealAminos vial photo (cut out, transparent background) used throughout
// the /shop and /lab/bridge bridge pages. The label carries only the brand
// wordmark — never a compound name, dose or lot number.
export default function BridgeVial({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src="/realaminos-vial.png"
      alt="RealAminos research vial"
      width={392}
      height={887}
      loading="eager"
      decoding="async"
    />
  );
}
