interface Props {
  backHref: string;
  backLabel: string;
  current: string;
}

export default function WatchBreadcrumb({ backHref, backLabel, current }: Props) {
  return (
    <div
      className="hero-content-anim"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        color: "var(--text-muted)",
        marginBottom: 16,
      }}
    >
      <a href={backHref} className="watch-breadcrumb-link" style={{ color: "#fff", fontWeight: 600 }}>
        {backLabel}
      </a>
      <span>/</span>
      <span>{current}</span>
    </div>
  );
}
