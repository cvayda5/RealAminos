"use client";

import { useState } from "react";

// Slide 1 is always the product visual — the real vial photo when the
// product has one (image_url), falling back to the old generic CSS vial
// mark for a product staff hasn't uploaded a photo for yet (e.g. BAC
// Water). Slide 2 — the Certificate of Analysis for the current lot — only
// appears when the product actually has one (BAC Water, or a
// not-yet-tested product, won't).
export default function ProductVisualCarousel({
  imageUrl,
  productName,
  coaPreviewUrl,
  coaUrl,
  lotNumber,
}: {
  imageUrl: string | null;
  productName: string;
  coaPreviewUrl: string | null;
  coaUrl: string | null;
  lotNumber: string | null;
}) {
  const hasCoa = Boolean(coaPreviewUrl && coaUrl);
  const slideCount = hasCoa ? 2 : 1;
  const [index, setIndex] = useState(0);

  function go(delta: number) {
    setIndex((i) => (i + delta + slideCount) % slideCount);
  }

  return (
    <div className="pd-visual">
      <div className="pd-slide-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        <div className="pd-slide">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={productName} className="product-photo" />
          ) : (
            <>
              <div className="cap-lg" />
              <div className="vial-lg" />
            </>
          )}
        </div>

        {hasCoa && (
          <div className="pd-slide">
            <span className="pd-slide-label">
              Certificate of Analysis{lotNumber ? ` · ${lotNumber}` : ""}
            </span>
            <a href={coaUrl!} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coaPreviewUrl!}
                alt={`Certificate of Analysis${lotNumber ? ` for lot ${lotNumber}` : ""}`}
              />
            </a>
          </div>
        )}
      </div>

      {hasCoa && (
        <>
          <button
            type="button"
            className="pd-slide-arrow prev"
            onClick={() => go(-1)}
            aria-label="Previous slide"
          >
            ‹
          </button>
          <button
            type="button"
            className="pd-slide-arrow next"
            onClick={() => go(1)}
            aria-label="Next slide"
          >
            ›
          </button>
          <div className="pd-slide-dots">
            {Array.from({ length: slideCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={`pd-slide-dot${i === index ? " active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
