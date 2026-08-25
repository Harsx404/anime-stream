import { getChannelById } from "@/lib/iptv";
import { notFound } from "next/navigation";
import LivePlayer from "@/components/LivePlayer";

interface Props {
  params: Promise<{ channelId: string }>;
}

export default async function LiveChannelPage({ params }: Props) {
  const { channelId } = await params;
  const channel = await getChannelById(channelId);

  if (!channel || !channel.streams.length) {
    notFound();
  }

  const streams = channel.streams.map((s) => ({
    url: s.url,
    quality: s.quality,
    label: s.label || s.quality || undefined,
  }));

  const currentGuide = channel.guides?.[0];

  return (
    <div>
      {/* Hero Scrim Background */}
      <div 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 400,
          background: "linear-gradient(180deg, rgba(15,15,18,1) 0%, rgba(20,20,24,0.9) 40%, rgba(30,30,36,0) 100%)",
          zIndex: -1,
          pointerEvents: "none"
        }}
      />
      
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px clamp(12px, 3vw, 16px)" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 24 }}>
          <a
            href="/live"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60 no-underline transition-colors duration-200 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Live TV
          </a>
        </div>

        {/* Channel header */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          {channel.logo && (
            <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={channel.logo}
                alt={channel.name}
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "contain",
                }}
              />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{channel.name}</h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: 100,
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#ef4444",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 2s infinite" }} />
                LIVE
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{channel.country}</span>
              {channel.categories.length > 0 && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />}
              {channel.categories.map((cat) => (
                <span
                  key={cat}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 100,
                    color: "rgba(255,255,255,0.7)",
                    textTransform: "capitalize",
                  }}
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Player Container */}
        <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", background: "#000" }}>
          <LivePlayer
            channelName={channel.name}
            channelLogo={channel.logo}
            streams={streams}
            country={channel.country}
            categories={channel.categories}
          />
        </div>

        {/* Info Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginTop: 32 }}>
          {/* Now playing / guide info */}
          {currentGuide && (
            <div
              style={{
                padding: 24,
                background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                backdropFilter: "blur(12px)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 3, height: 16, background: "var(--accent)", borderRadius: 2 }} />
                <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  Now Playing
                </h3>
              </div>
              {currentGuide.title && (
                <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#fff", lineHeight: 1.3 }}>{currentGuide.title}</p>
              )}
              {currentGuide.description && (
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{currentGuide.description}</p>
              )}
            </div>
          )}

          {/* Stream sources */}
          {streams.length > 1 && (
            <div
              style={{
                padding: 24,
                background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                backdropFilter: "blur(12px)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 3, height: 16, background: "var(--accent-blue, #3b82f6)", borderRadius: 2 }} />
                <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  Available Streams
                </h3>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {streams.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "6px 14px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {s.label || s.quality || `Stream ${i + 1}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
