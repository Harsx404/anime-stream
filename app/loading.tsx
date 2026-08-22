export default function Loading() {
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
      <div className="skeleton" style={{ width: "100%", height: 420, marginBottom: 40 }} />
      <div className="skeleton" style={{ width: 200, height: 20, marginBottom: 16 }} />
      <div style={{ display: "flex", gap: 12, overflow: "hidden" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ flexShrink: 0 }}>
            <div className="skeleton" style={{ width: 160, height: 240 }} />
            <div className="skeleton" style={{ width: 130, height: 14, marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
