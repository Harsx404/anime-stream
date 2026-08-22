"use client";

import { anton } from "@/lib/fonts";

export default function Error({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "120px 16px",
        textAlign: "center",
      }}
    >
      <p className={anton.className} style={{ fontSize: 72, color: "var(--accent)", lineHeight: 1 }}>
        ERROR
      </p>
      <p style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 12, marginBottom: 24 }}>
        Something went wrong. Please try again.
      </p>
      <button
        onClick={reset}
        style={{
          display: "inline-block",
          padding: "10px 24px",
          background: "var(--accent)",
          border: "none",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          cursor: "pointer",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
