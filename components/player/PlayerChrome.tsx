"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { Play, Pause, Volume2, VolumeX, Settings, Maximize, Minimize, Rewind, FastForward, Camera, PictureInPicture2, MonitorPlay, Captions, Gauge, SlidersHorizontal } from "lucide-react";
import {
  type SubtitleConfig,
  SUBTITLE_COLOR_PRESETS,
  SUBTITLE_FONT_SIZES,
  SUBTITLE_BG_OPACITIES,
  SUBTITLE_OUTLINE_WIDTHS,
} from "@/lib/subtitle-config";

export interface SettingsGroup {
  label: string;
  options: { id: string; label: string; active: boolean }[];
  onSelect: (id: string) => void;
}

export interface NextEpisodeInfo {
  href: string;
  meta: string;
  thumbnail?: string;
}

interface PlayerChromeProps {
  containerRef: RefObject<HTMLDivElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  videoControlsEnabled?: boolean;
  title: string;
  titleLogo?: string;
  subtitleLine?: string;
  description?: string;
  nextEpisode?: NextEpisodeInfo;
  settingsGroups?: SettingsGroup[];
  loadingLabel?: string;
  error?: string | null;
  onRetry?: { label: string; onClick: () => void };
  isTheater?: boolean;
  onTheaterToggle?: () => void;
  subtitleConfig?: SubtitleConfig;
  onSubtitleConfigChange?: (config: SubtitleConfig) => void;
  anilistId?: number;
  episodeNumber?: number;
  tmdbId?: number;
  seasonNumber?: number;
  mediaType?: "anime" | "tv" | "movie";
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function PlayerChrome({
  containerRef,
  videoRef,
  videoControlsEnabled = true,
  title,
  titleLogo,
  subtitleLine,
  description,
  nextEpisode,
  settingsGroups = [],
  loadingLabel,
  error,
  onRetry,
  isTheater = false,
  onTheaterToggle,
  subtitleConfig,
  onSubtitleConfigChange,
  anilistId,
  episodeNumber,
  tmdbId,
  seasonNumber,
  mediaType,
}: PlayerChromeProps) {
  const [playing, setPlaying] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(1);
  const [showNextEpisodePopup, setShowNextEpisodePopup] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [outroStart, setOutroStart] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const subtitlesRef = useRef<HTMLDivElement>(null);
  const subtitleSettingsRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const qualityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoControlsEnabled) return;
    const v = videoRef?.current;
    if (!v) return;

    // Set up Web Audio API for volume boost
    if (!audioCtxRef.current && v) {
      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaElementSource(v);
        const gain = ctx.createGain();
        gain.gain.value = 1;
        src.connect(gain);
        gain.connect(ctx.destination);
        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
        sourceNodeRef.current = src;
      } catch {
        // AudioContext may fail if already created for this element
      }
    }

    const onPlay = () => {
      setPlaying(true);
      if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onLoadedMeta = () => setDuration(v.duration || 0);
    const onVolumeChange = () => { setVolume(v.volume); setMuted(v.muted); };
    const onRateChange = () => setPlaybackRate(v.playbackRate);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("loadedmetadata", onLoadedMeta);
    v.addEventListener("volumechange", onVolumeChange);
    v.addEventListener("ratechange", onRateChange);
    setPlaying(!v.paused);
    setDuration(v.duration || 0);
    setVolume(v.volume);
    setMuted(v.muted);
    setPlaybackRate(v.playbackRate);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("loadedmetadata", onLoadedMeta);
      v.removeEventListener("volumechange", onVolumeChange);
      v.removeEventListener("ratechange", onRateChange);
    };
  }, [videoRef, videoControlsEnabled]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [containerRef]);

  // Auto-fetch outro start time from AniSkip (anime) or TMDB runtime (TV)
  useEffect(() => {
    if (!nextEpisode) return;
    // Movies don't have next episodes, so this won't trigger for movies
    let cancelled = false;

    // Build cache key and API params based on media type
    let cacheKey = "";
    let apiUrl = "";

    if (anilistId && episodeNumber) {
      cacheKey = `outro:anilist:${anilistId}:${episodeNumber}`;
      apiUrl = `/api/skip-times?anilistId=${anilistId}&episode=${episodeNumber}`;
    } else if (tmdbId && seasonNumber && episodeNumber && mediaType === "tv") {
      cacheKey = `outro:tmdb:${tmdbId}:${seasonNumber}:${episodeNumber}`;
      apiUrl = `/api/skip-times?tmdbId=${tmdbId}&season=${seasonNumber}&episode=${episodeNumber}&mediaType=tv`;
    } else {
      setOutroStart(null);
      return;
    }

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const val = Number(cached);
        if (val > 0) { setOutroStart(val); return; }
      }
    } catch {}
    setOutroStart(null);
    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.outroStart && data.outroStart > 0) {
          setOutroStart(data.outroStart);
          try { localStorage.setItem(cacheKey, String(data.outroStart)); } catch {}
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [anilistId, episodeNumber, tmdbId, seasonNumber, mediaType, nextEpisode]);

  // Next episode popup: show at outro start or 30s before end, hide on play/seek back
  useEffect(() => {
    if (!videoControlsEnabled || !nextEpisode) return;
    const v = videoRef?.current;
    if (!v) return;
    const triggerTime = outroStart !== null ? outroStart : (v.duration > 60 ? v.duration - 30 : v.duration - 5);
    const onTimeUpdate = () => {
      if (v.currentTime >= triggerTime && v.currentTime < v.duration) {
        setShowNextEpisodePopup(true);
      } else if (v.currentTime < triggerTime - 2) {
        setShowNextEpisodePopup(false);
      }
    };
    const onEnded = () => {
      setShowNextEpisodePopup(true);
      setCountdown(10);
    };
    const onPlay = () => { /* keep popup visible if near end */ };
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoRef, videoControlsEnabled, nextEpisode, outroStart, duration]);

  // Start countdown only when video has ended
  useEffect(() => {
    if (!showNextEpisodePopup || !nextEpisode) return;
    const v = videoRef?.current;
    if (!v || !v.ended) return;
    if (countdown <= 0) {
      window.location.href = nextEpisode.href;
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showNextEpisodePopup, countdown, nextEpisode, videoRef]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!videoControlsEnabled) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      switch (e.key) {
        case "ArrowLeft":
        case "j":
        case "J":
          e.preventDefault();
          skipTime(-10);
          break;
        case "ArrowRight":
        case "l":
        case "L":
          e.preventDefault();
          skipTime(10);
          break;
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "t":
        case "T":
          if (onTheaterToggle) {
            e.preventDefault();
            onTheaterToggle();
          }
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [videoControlsEnabled, onTheaterToggle]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (!videoControlsEnabled) return;
    resetHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [videoControlsEnabled, resetHideTimer]);

  useEffect(() => {
    if (!videoControlsEnabled) return;
    const el = containerRef.current;
    if (!el) return;
    const handleActivity = () => resetHideTimer();
    el.addEventListener("mousemove", handleActivity);
    el.addEventListener("touchstart", handleActivity);
    return () => {
      el.removeEventListener("mousemove", handleActivity);
      el.removeEventListener("touchstart", handleActivity);
    };
  }, [containerRef, videoControlsEnabled, resetHideTimer]);

  useEffect(() => {
    if (!showSettings && !showSubtitles && !showSubtitleSettings && !showSpeed && !showQuality) return;
    function onDocClick(e: MouseEvent) {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
      if (showSubtitles && subtitlesRef.current && !subtitlesRef.current.contains(e.target as Node)) setShowSubtitles(false);
      if (showSubtitleSettings && subtitleSettingsRef.current && !subtitleSettingsRef.current.contains(e.target as Node)) setShowSubtitleSettings(false);
      if (showSpeed && speedRef.current && !speedRef.current.contains(e.target as Node)) setShowSpeed(false);
      if (showQuality && qualityRef.current && !qualityRef.current.contains(e.target as Node)) setShowQuality(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showSettings, showSubtitles, showSubtitleSettings, showSpeed, showQuality]);

  function togglePlay() {
    const v = videoRef?.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef?.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
  }

  function toggleMute() {
    const v = videoRef?.current;
    if (!v) return;
    v.muted = !v.muted;
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef?.current;
    if (!v) return;
    const val = Number(e.target.value);
    v.volume = val;
    v.muted = val === 0;
  }

  function changeVolumeBoost(boost: number) {
    setVolumeBoost(boost);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = boost;
    }
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }

  function skipTime(delta: number) {
    const v = videoRef?.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }

  function screenshot() {
    const v = videoRef?.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kinova-screenshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function togglePiP() {
    const v = videoRef?.current;
    if (!v) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture?.().catch(() => {});
  }

  function changePlaybackRate(rate: number) {
    const v = videoRef?.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
  }

  useEffect(() => {
    setPipSupported(typeof document !== "undefined" && "pictureInPictureEnabled" in document);
  }, []);

  const boostOptions = [1, 1.5, 2, 3];
  const allGroups = [...settingsGroups, {
    label: "Volume Boost",
    options: boostOptions.map((b) => ({
      id: String(b),
      label: `${b}x${volumeBoost === b ? " ✓" : ""}`,
      active: volumeBoost === b,
    })),
    onSelect: (id: string) => changeVolumeBoost(Number(id)),
  }];
  const visibleGroups = allGroups.filter((g) => g.options.length > 0);
  const subtitleGroup = visibleGroups.find((g) => g.label === "Subtitles");
  const sourceGroup = visibleGroups.find((g) => g.label === "Source");
  const hlsQualityGroup = visibleGroups.find((g) => g.label === "Quality");
  const settingsOnlyGroups = visibleGroups.filter((g) => g.label !== "Subtitles" && g.label !== "Source" && g.label !== "Quality");
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const subtitleActive = subtitleGroup?.options.some((o) => o.active && o.id !== "-1") ?? false;

  // Compute current quality label for the Quality button
  const currentQualityLabel = (() => {
    if (hlsQualityGroup) {
      const active = hlsQualityGroup.options.find((o) => o.active);
      if (active) return active.label;
    }
    if (sourceGroup) {
      const active = sourceGroup.options.find((o) => o.active);
      if (active) return active.label;
    }
    return null;
  })();

  const hasQualityPanel = !!(sourceGroup || hlsQualityGroup);

  const controlsVisible = showControls || !playing || showSettings || showSubtitles || showSubtitleSettings || showSpeed || showQuality;

  return (
    <>
      {(loadingLabel || error) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: error ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.55)",
            zIndex: 30,
            pointerEvents: error ? "auto" : "none",
          }}
        >
          {error ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 16 }}>
              <p style={{ color: "#f87171", fontSize: 14, textAlign: "center", maxWidth: 320 }}>{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry.onClick}
                  style={{
                    padding: "8px 18px",
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    cursor: "pointer",
                  }}
                >
                  {onRetry.label}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              {loadingLabel && <p style={{ color: "#fff", fontSize: 13 }}>{loadingLabel}</p>}
            </div>
          )}
        </div>
      )}

      {showNextEpisodePopup && nextEpisode && (
        <div
          className="next-episode-popup"
          style={{
            position: "absolute",
            bottom: 80,
            right: 16,
            zIndex: 40,
            width: "min(320px, calc(100vw - 32px))",
            background: "rgba(10,10,10,0.95)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            overflow: "hidden",
            animation: "fadeIn 0.3s ease, slideUp 0.3s ease",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {nextEpisode.thumbnail && (
            <div style={{ position: "relative", width: "100%", height: 130 }}>
              <Image src={nextEpisode.thumbnail} alt="" fill sizes="320px" className="object-cover" />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(10,10,10,0.95) 100%)" }} />
            </div>
          )}
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent)" }}>
                Next Episode
              </p>
              {videoRef?.current?.ended && (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                  in {countdown}s
                </p>
              )}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>
              {nextEpisode.meta}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { window.location.href = nextEpisode.href; }}
                style={{
                  padding: "8px 18px",
                  background: "var(--accent)",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  borderRadius: 3,
                }}
              >
                Play
              </button>
              <button
                onClick={() => setShowNextEpisodePopup(false)}
                style={{
                  padding: "8px 18px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  borderRadius: 3,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="player-overlay-layer" style={{ zIndex: 20 }}>
        <div
          className={`player-idle-overlay${playing ? " is-hidden" : ""}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "clamp(24px, 5vw, 44px) clamp(12px, 3vw, 32px) 24px",
            background: "linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)",
          }}
        >
          <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
            Now Watching
          </p>
          {titleLogo ? (
            <div style={{ position: "relative", width: "min(300px, 60vw)", height: "clamp(72px, 15vw, 108px)", marginBottom: subtitleLine ? 6 : 14, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))" }}>
              <Image src={titleLogo} alt={title} fill sizes="360px" className="object-contain" style={{ objectPosition: "left center" }} />
            </div>
          ) : (
            <h2 style={{ fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 800, color: "#fff", letterSpacing: -0.3, textShadow: "0 2px 12px rgba(0,0,0,0.5)", marginBottom: subtitleLine ? 4 : 10 }}>{title}</h2>
          )}
          {subtitleLine && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 10 }}>{subtitleLine}</p>
          )}
          {description && (
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.7)",
                maxWidth: 520,
                marginBottom: nextEpisode ? 16 : 0,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </p>
          )}
          {nextEpisode && (
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Next Episode</p>
              <a href={nextEpisode.href} className="player-next-episode-card">
                {nextEpisode.thumbnail && (
                  <div className="player-next-episode-thumb">
                    <Image src={nextEpisode.thumbnail} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>{nextEpisode.meta}</p>
                  <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                    <Play size={11} fill="currentColor" /> Watch Now
                  </p>
                </div>
              </a>
            </div>
          )}
        </div>

        {videoControlsEnabled && (
          <div
            className={`player-controls-bar${controlsVisible ? "" : " is-hidden"}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "24px clamp(8px, 3vw, 16px) 12px",
              background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
            }}
          >
            <div className="player-progress-track" onClick={handleSeek}>
              <div className="player-progress-fill" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "nowrap" }}>
              <button className="player-control-btn" onClick={() => skipTime(-10)} aria-label="Rewind 10s" style={{ minWidth: 36, minHeight: 36 }}>
                <Rewind size={16} />
              </button>
              <button className="player-control-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} style={{ minWidth: 36, minHeight: 36 }}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button className="player-control-btn" onClick={() => skipTime(10)} aria-label="Forward 10s" style={{ minWidth: 36, minHeight: 36 }}>
                <FastForward size={16} />
              </button>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", minWidth: 90, flexShrink: 0 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <div style={{ flex: 1 }} />
              <button className="player-control-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                className="player-volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: 70, accentColor: "#fff" }}
              />
              {hasQualityPanel && (
                <div ref={qualityRef} style={{ position: "relative" }}>
                  <button 
                    className={`player-quality-btn player-control-btn${currentQualityLabel ? " is-active" : ""}`} 
                    onClick={() => { setShowQuality((s) => !s); setShowSettings(false); setShowSubtitles(false); setShowSpeed(false); }} 
                    aria-label="Quality"
                    style={{ gap: 4 }}
                  >
                    <Settings size={16} /> {/* Or a dedicated icon if preferred */}
                    {currentQualityLabel && <span style={{ fontSize: 12, fontWeight: 700 }}>{currentQualityLabel}</span>}
                  </button>
                  {showQuality && (
                    <div className="player-settings-panel">
                      {sourceGroup && (
                        <div className={hlsQualityGroup ? "player-settings-divider" : ""}>
                          <p className="player-settings-group-label">Source</p>
                          {sourceGroup.options.map((opt) => (
                            <button
                              key={opt.id}
                              className={`player-settings-option${opt.active ? " is-active" : ""}`}
                              onClick={() => { sourceGroup.onSelect(opt.id); setShowQuality(false); }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {hlsQualityGroup && (
                        <div className={sourceGroup ? "player-settings-divider" : ""}>
                          <p className="player-settings-group-label">Stream Quality</p>
                          {hlsQualityGroup.options.map((opt) => (
                            <button
                              key={opt.id}
                              className={`player-settings-option${opt.active ? " is-active" : ""}`}
                              onClick={() => { hlsQualityGroup.onSelect(opt.id); setShowQuality(false); }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {subtitleGroup && (
                <div ref={subtitlesRef} style={{ position: "relative", display: "flex", gap: 2 }}>
                  <button
                    className={`player-control-btn${subtitleActive ? " is-active" : ""}`}
                    onClick={() => { setShowSubtitles((s) => !s); setShowSettings(false); setShowSpeed(false); setShowQuality(false); setShowSubtitleSettings(false); }}
                    aria-label="Subtitles"
                  >
                    <Captions size={18} />
                  </button>
                  {showSubtitles && (
                    <div className="player-settings-panel">
                      <p className="player-settings-group-label">Subtitles</p>
                      {subtitleGroup.options.map((opt) => (
                        <button
                          key={opt.id}
                          className={`player-settings-option${opt.active ? " is-active" : ""}`}
                          onClick={() => { subtitleGroup.onSelect(opt.id); setShowSubtitles(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {onSubtitleConfigChange && subtitleConfig && (
                    <div ref={subtitleSettingsRef} style={{ position: "relative" }}>
                      <button
                        className="player-control-btn"
                        onClick={() => { setShowSubtitleSettings((s) => !s); setShowSubtitles(false); setShowSettings(false); setShowSpeed(false); setShowQuality(false); }}
                        aria-label="Subtitle settings"
                      >
                        <SlidersHorizontal size={16} />
                      </button>
                      {showSubtitleSettings && (
                        <div className="player-settings-panel player-subtitle-settings">
                          <p className="player-settings-group-label">Subtitle Style</p>
                          <div className="player-subtitle-settings-row">
                            <p className="player-subtitle-settings-label">Font Size</p>
                            <div className="player-subtitle-chips">
                              {SUBTITLE_FONT_SIZES.map((opt) => (
                                <button
                                  key={opt.value}
                                  className={`player-subtitle-chip${subtitleConfig.fontSize === opt.value ? " is-active" : ""}`}
                                  onClick={() => onSubtitleConfigChange({ ...subtitleConfig, fontSize: opt.value })}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="player-subtitle-settings-row">
                            <p className="player-subtitle-settings-label">Color</p>
                            <div className="player-subtitle-chips">
                              {SUBTITLE_COLOR_PRESETS.map((opt) => (
                                <button
                                  key={opt.value}
                                  className={`player-subtitle-color-swatch${subtitleConfig.color === opt.value ? " is-active" : ""}`}
                                  style={{ background: opt.value }}
                                  onClick={() => onSubtitleConfigChange({ ...subtitleConfig, color: opt.value })}
                                  aria-label={opt.label}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="player-subtitle-settings-row">
                            <p className="player-subtitle-settings-label">Background</p>
                            <div className="player-subtitle-chips">
                              {SUBTITLE_BG_OPACITIES.map((opt) => (
                                <button
                                  key={opt.value}
                                  className={`player-subtitle-chip${subtitleConfig.backgroundOpacity === opt.value ? " is-active" : ""}`}
                                  onClick={() => onSubtitleConfigChange({ ...subtitleConfig, backgroundOpacity: opt.value })}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="player-subtitle-settings-row">
                            <p className="player-subtitle-settings-label">Outline</p>
                            <div className="player-subtitle-chips">
                              {SUBTITLE_OUTLINE_WIDTHS.map((opt) => (
                                <button
                                  key={opt.value}
                                  className={`player-subtitle-chip${subtitleConfig.outlineWidth === opt.value ? " is-active" : ""}`}
                                  onClick={() => onSubtitleConfigChange({ ...subtitleConfig, outlineWidth: opt.value })}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="player-subtitle-settings-row">
                            <p className="player-subtitle-settings-label">Position</p>
                            <div className="player-subtitle-chips">
                              <button
                                className={`player-subtitle-chip${subtitleConfig.position === "bottom" ? " is-active" : ""}`}
                                onClick={() => onSubtitleConfigChange({ ...subtitleConfig, position: "bottom" })}
                              >
                                Bottom
                              </button>
                              <button
                                className={`player-subtitle-chip${subtitleConfig.position === "top" ? " is-active" : ""}`}
                                onClick={() => onSubtitleConfigChange({ ...subtitleConfig, position: "top" })}
                              >
                                Top
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div ref={speedRef} style={{ position: "relative" }}>
                <button
                  className={`player-control-btn${playbackRate !== 1 ? " is-active" : ""}`}
                  onClick={() => { setShowSpeed((s) => !s); setShowSettings(false); setShowSubtitles(false); setShowQuality(false); }}
                  aria-label="Playback speed"
                  style={{ gap: 3 }}
                >
                  <Gauge size={16} />
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{playbackRate === 1 ? "1x" : `${playbackRate}x`}</span>
                </button>
                {showSpeed && (
                  <div className="player-settings-panel">
                    <p className="player-settings-group-label">Speed</p>
                    {speedOptions.map((rate) => (
                      <button
                        key={rate}
                        className={`player-settings-option${playbackRate === rate ? " is-active" : ""}`}
                        onClick={() => { changePlaybackRate(rate); setShowSpeed(false); }}
                      >
                        {rate === 1 ? "Normal" : `${rate}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {settingsOnlyGroups.length > 0 && (
                <div ref={settingsRef} style={{ position: "relative" }}>
                  <button className="player-control-btn" onClick={() => { setShowSettings((s) => !s); setShowSubtitles(false); setShowSpeed(false); setShowQuality(false); }} aria-label="Settings">
                    <Settings size={18} />
                  </button>
                  {showSettings && (
                    <div className="player-settings-panel">
                      {settingsOnlyGroups.map((group, i) => (
                        <div key={group.label} className={i > 0 ? "player-settings-divider" : ""}>
                          <p className="player-settings-group-label">{group.label}</p>
                          {group.options.map((opt) => (
                            <button
                              key={opt.id}
                              className={`player-settings-option${opt.active ? " is-active" : ""}`}
                              onClick={() => { group.onSelect(opt.id); setShowSettings(false); }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button className="player-control-btn player-btn-screenshot" onClick={screenshot} aria-label="Screenshot">
                <Camera size={16} />
              </button>
              {pipSupported && (
                <button className="player-control-btn player-btn-pip" onClick={togglePiP} aria-label="Picture in Picture">
                  <PictureInPicture2 size={16} />
                </button>
              )}
              {onTheaterToggle && (
                <button className="player-control-btn" onClick={onTheaterToggle} aria-label="Theater mode" style={{ color: isTheater ? "var(--accent)" : undefined }}>
                  <MonitorPlay size={16} />
                </button>
              )}
              <button className="player-control-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {!videoControlsEnabled && (
        <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 8, zIndex: 20 }}>
          {subtitleGroup && (
            <div ref={subtitlesRef} style={{ position: "relative", display: "flex", gap: 2 }}>
              <button className={`player-control-btn${subtitleActive ? " is-active" : ""}`} style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => { setShowSubtitles((s) => !s); setShowSettings(false); setShowSpeed(false); setShowSubtitleSettings(false); }} aria-label="Subtitles">
                <Captions size={18} />
              </button>
              {showSubtitles && (
                <div className="player-settings-panel">
                  <p className="player-settings-group-label">Subtitles</p>
                  {subtitleGroup.options.map((opt) => (
                    <button key={opt.id} className={`player-settings-option${opt.active ? " is-active" : ""}`} onClick={() => { subtitleGroup.onSelect(opt.id); setShowSubtitles(false); }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {onSubtitleConfigChange && subtitleConfig && (
                <div ref={subtitleSettingsRef} style={{ position: "relative" }}>
                  <button
                    className="player-control-btn"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                    onClick={() => { setShowSubtitleSettings((s) => !s); setShowSubtitles(false); setShowSettings(false); setShowSpeed(false); }}
                    aria-label="Subtitle settings"
                  >
                    <SlidersHorizontal size={16} />
                  </button>
                  {showSubtitleSettings && (
                    <div className="player-settings-panel player-subtitle-settings">
                      <p className="player-settings-group-label">Subtitle Style</p>
                      <div className="player-subtitle-settings-row">
                        <p className="player-subtitle-settings-label">Font Size</p>
                        <div className="player-subtitle-chips">
                          {SUBTITLE_FONT_SIZES.map((opt) => (
                            <button key={opt.value} className={`player-subtitle-chip${subtitleConfig.fontSize === opt.value ? " is-active" : ""}`} onClick={() => onSubtitleConfigChange({ ...subtitleConfig, fontSize: opt.value })}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="player-subtitle-settings-row">
                        <p className="player-subtitle-settings-label">Color</p>
                        <div className="player-subtitle-chips">
                          {SUBTITLE_COLOR_PRESETS.map((opt) => (
                            <button key={opt.value} className={`player-subtitle-color-swatch${subtitleConfig.color === opt.value ? " is-active" : ""}`} style={{ background: opt.value }} onClick={() => onSubtitleConfigChange({ ...subtitleConfig, color: opt.value })} aria-label={opt.label} />
                          ))}
                        </div>
                      </div>
                      <div className="player-subtitle-settings-row">
                        <p className="player-subtitle-settings-label">Background</p>
                        <div className="player-subtitle-chips">
                          {SUBTITLE_BG_OPACITIES.map((opt) => (
                            <button key={opt.value} className={`player-subtitle-chip${subtitleConfig.backgroundOpacity === opt.value ? " is-active" : ""}`} onClick={() => onSubtitleConfigChange({ ...subtitleConfig, backgroundOpacity: opt.value })}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="player-subtitle-settings-row">
                        <p className="player-subtitle-settings-label">Outline</p>
                        <div className="player-subtitle-chips">
                          {SUBTITLE_OUTLINE_WIDTHS.map((opt) => (
                            <button key={opt.value} className={`player-subtitle-chip${subtitleConfig.outlineWidth === opt.value ? " is-active" : ""}`} onClick={() => onSubtitleConfigChange({ ...subtitleConfig, outlineWidth: opt.value })}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="player-subtitle-settings-row">
                        <p className="player-subtitle-settings-label">Position</p>
                        <div className="player-subtitle-chips">
                          <button className={`player-subtitle-chip${subtitleConfig.position === "bottom" ? " is-active" : ""}`} onClick={() => onSubtitleConfigChange({ ...subtitleConfig, position: "bottom" })}>Bottom</button>
                          <button className={`player-subtitle-chip${subtitleConfig.position === "top" ? " is-active" : ""}`} onClick={() => onSubtitleConfigChange({ ...subtitleConfig, position: "top" })}>Top</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div ref={speedRef} style={{ position: "relative" }}>
            <button className={`player-control-btn${playbackRate !== 1 ? " is-active" : ""}`} style={{ background: "rgba(0,0,0,0.55)", gap: 3 }} onClick={() => { setShowSpeed((s) => !s); setShowSettings(false); setShowSubtitles(false); }} aria-label="Playback speed">
              <Gauge size={16} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>{playbackRate === 1 ? "1x" : `${playbackRate}x`}</span>
            </button>
            {showSpeed && (
              <div className="player-settings-panel">
                <p className="player-settings-group-label">Speed</p>
                {speedOptions.map((rate) => (
                  <button key={rate} className={`player-settings-option${playbackRate === rate ? " is-active" : ""}`} onClick={() => { changePlaybackRate(rate); setShowSpeed(false); }}>
                    {rate === 1 ? "Normal" : `${rate}x`}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hasQualityPanel && (
            <div ref={qualityRef} style={{ position: "relative" }}>
              <button 
                className={`player-quality-btn player-control-btn${currentQualityLabel ? " is-active" : ""}`} 
                style={{ background: "rgba(0,0,0,0.55)", gap: 4 }} 
                onClick={() => { setShowQuality((s) => !s); setShowSettings(false); setShowSubtitles(false); setShowSpeed(false); }} 
                aria-label="Quality"
              >
                <Settings size={16} />
                {currentQualityLabel && <span style={{ fontSize: 12, fontWeight: 700 }}>{currentQualityLabel}</span>}
              </button>
              {showQuality && (
                <div className="player-settings-panel">
                  {sourceGroup && (
                    <div className={hlsQualityGroup ? "player-settings-divider" : ""}>
                      <p className="player-settings-group-label">Source</p>
                      {sourceGroup.options.map((opt) => (
                        <button
                          key={opt.id}
                          className={`player-settings-option${opt.active ? " is-active" : ""}`}
                          onClick={() => { sourceGroup.onSelect(opt.id); setShowQuality(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {hlsQualityGroup && (
                    <div className={sourceGroup ? "player-settings-divider" : ""}>
                      <p className="player-settings-group-label">Stream Quality</p>
                      {hlsQualityGroup.options.map((opt) => (
                        <button
                          key={opt.id}
                          className={`player-settings-option${opt.active ? " is-active" : ""}`}
                          onClick={() => { hlsQualityGroup.onSelect(opt.id); setShowQuality(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {settingsOnlyGroups.length > 0 && (
            <div ref={settingsRef} style={{ position: "relative" }}>
              <button className="player-control-btn" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => { setShowSettings((s) => !s); setShowSubtitles(false); setShowSpeed(false); setShowQuality(false); }} aria-label="Settings">
                <Settings size={18} />
              </button>
              {showSettings && (
                <div className="player-settings-panel">
                  {settingsOnlyGroups.map((group, i) => (
                    <div key={group.label} className={i > 0 ? "player-settings-divider" : ""}>
                      <p className="player-settings-group-label">{group.label}</p>
                      {group.options.map((opt) => (
                        <button key={opt.id} className={`player-settings-option${opt.active ? " is-active" : ""}`} onClick={() => { group.onSelect(opt.id); setShowSettings(false); }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="player-control-btn" style={{ background: "rgba(0,0,0,0.55)" }} onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      )}
    </>
  );
}
