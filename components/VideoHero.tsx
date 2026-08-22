"use client";

import { useState, useEffect, useRef } from "react";

export default function VideoHero() {
  const [muted, setMuted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: 600,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        loop
        playsInline
        onCanPlay={() => setLoaded(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      <div className="hero-scrim" />
      <div className="hero-scrim-side" />

      <div
        className="hero-content-anim"
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 clamp(16px, 5vw, 80px)",
          maxWidth: 900,
        }}
      >
        <span
          className="status-chip status-chip-accent"
          style={{ alignSelf: "flex-start", marginBottom: 20 }}
        >
          ● Now Streaming
        </span>

        <h1
          style={{
            fontSize: "clamp(48px, 9vw, 120px)",
            fontWeight: 400,
            lineHeight: 0.95,
            letterSpacing: "-2px",
            color: "#fff",
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "#fff" }}>KINO</span>
          <span style={{ color: "var(--accent)" }}>VA</span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 22px)",
            fontWeight: 500,
            letterSpacing: "-0.5px",
            color: "rgba(255,255,255,0.85)",
            marginBottom: 28,
            maxWidth: 560,
            lineHeight: 1.4,
          }}
        >
          Stream anime, movies, and TV shows in one place.
          <br />
          <span style={{ color: "var(--text-muted)", fontSize: "0.85em" }}>
            4K quality. Zero ads. Unlimited access.
          </span>
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <a href="/home" className="btn-square-accent">
            ▶ Start Watching
          </a>
          <a href="/anime" className="btn-ghost">
            Explore Anime
          </a>
          <button
            onClick={toggleMute}
            className="btn-ghost"
            style={{ padding: "12px 16px" }}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 40,
            color: "var(--text-muted)",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          <span>
            <span style={{ color: "var(--success)" }}>●</span> 12,000+ titles
          </span>
          <span>
            <span style={{ color: "var(--accent-blue)" }}>●</span> 4K / 1080p
          </span>
          <span>
            <span style={{ color: "var(--success)" }}>●</span> Daily updates
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: "linear-gradient(to bottom, transparent, #000)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
    </section>
  );
}
