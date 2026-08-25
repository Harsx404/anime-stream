import Image from "next/image";

export interface RailItem {
  href: string;
  image?: string;
  label: string;
  sublabel?: string;
}

export default function DetailRail({ title, items }: { title: string; items: RailItem[] }) {
  if (items.length === 0) return null;

  return (
    <div style={{ width: "100%", maxWidth: 220 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          color: "rgba(255,255,255,0.6)",
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        // {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item, i) => (
          <a
            key={i}
            href={item.href}
            className="rail-item rail-item-anim"
            style={{ animationDelay: `${300 + i * 90}ms` }}
          >
            <div
              className="rail-thumb"
              style={{
                position: "relative",
                width: "100%",
                height: 90,
                borderRadius: 0,
                background: "var(--card)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {item.image && (
                <Image src={item.image} alt={item.label} fill sizes="220px" className="object-cover" />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)",
                }}
              />
              <div
                className="play-icon"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "#000",
                }}
              >
                ▶
              </div>
              <p
                style={{
                  position: "absolute",
                  left: 10,
                  bottom: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                }}
              >
                {item.label}
              </p>
            </div>
            {item.sublabel && (
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.sublabel}
              </p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
