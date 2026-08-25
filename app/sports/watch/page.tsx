"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MatchStream } from "@/lib/sports";

interface StreamsResponse {
  streams: MatchStream[];
  error?: string;
}

export default function SportsWatchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const title = params.get("title") || "Live Match";
  const source = params.get("source") || "";
  const id = params.get("id") || "";
  const poster = params.get("poster") || "";

  const [streams, setStreams] = useState<MatchStream[]>([]);
  const [activeStream, setActiveStream] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!source || !id) {
      setError("Missing stream source or ID");
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/sports/streams?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || "Failed to load streams");
        }
        const data: StreamsResponse = await res.json();
        if (cancelled) return;
        if (!data.streams || data.streams.length === 0) {
          setError("No streams available for this match");
          setLoading(false);
          return;
        }
        setStreams(data.streams);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load streams");
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [source, id]);

  const current = streams[activeStream];

  return (
    <div>
      {/* Hero background */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 400,
          background: "linear-gradient(180deg, rgba(15,15,18,1) 0%, rgba(20,20,24,0.9) 40%, rgba(30,30,36,0) 100%)",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px clamp(12px, 3vw, 16px)" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => router.push("/sports")}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60 transition-colors duration-200 hover:text-white"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Sports
          </button>
        </div>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{title}</h1>
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

        {/* Player */}
        <div
          style={{
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#000",
            aspectRatio: "16 / 9",
            position: "relative",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", gap: 12 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{error}</p>
              <button
                onClick={() => router.push("/sports")}
                style={{
                  padding: "8px 20px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Browse other matches
              </button>
            </div>
          ) : current ? (
            <iframe
              key={`${current.id}-${current.streamNo}`}
              src={`/embed${new URL(current.embedUrl).pathname.replace(/^\/embed/, "")}`}
              frameBorder={0}
              scrolling="no"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            />
          ) : null}
        </div>

        {/* Stream selector */}
        {!loading && !error && streams.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 3, height: 16, background: "var(--accent)", borderRadius: 2 }} />
              <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                Streams ({streams.length})
              </h3>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {streams.map((s, i) => (
                <button
                  key={`${s.id}-${s.streamNo}`}
                  onClick={() => setActiveStream(i)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 4,
                    padding: "10px 16px",
                    background: activeStream === i ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                    border: activeStream === i ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: activeStream === i ? "#ef4444" : "#fff" }}>
                    {s.language}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                    {s.hd ? "HD" : "SD"} · {s.viewers || 0} viewers
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
