"use client";

import { useState } from "react";

export default function TrailerModal({ videoKey }: { videoKey: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 24px",
          borderRadius: 0,
          background: "transparent",
          border: "1px solid #fff",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          cursor: "pointer",
        }}
      >
        ▶ Watch the Trailer
      </button>

      {open && (
        <div className="trailer-modal-backdrop" onClick={() => setOpen(false)}>
          <div
            style={{ width: "100%", maxWidth: 960, position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close trailer"
              style={{
                position: "absolute",
                top: -40,
                right: 0,
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 28,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
            <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 0, overflow: "hidden" }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
                title="Trailer"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
