import { anton } from "@/lib/fonts";

export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "120px 16px",
        textAlign: "center",
      }}
    >
      <p className={anton.className} style={{ fontSize: 96, color: "var(--accent)", lineHeight: 1 }}>
        404
      </p>
      <p style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 12, marginBottom: 24 }}>
        This page doesn&apos;t exist, or the title isn&apos;t available.
      </p>
      <a
        href="/"
        style={{
          display: "inline-block",
          padding: "10px 24px",
          background: "rgba(0,0,0,0.75)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Back to Home
      </a>
    </div>
  );
}
