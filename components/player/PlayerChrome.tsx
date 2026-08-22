"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { Play, Pause, Volume2, VolumeX, Settings, Maximize, Minimize, Rewind, FastForward, Camera, PictureInPicture2, MonitorPlay, Captions, Gauge } from "lucide-react";

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
  subtitleLine?: string;
  description?: string;
  nextEpisode?: NextEpisodeInfo;
  settingsGroups?: SettingsGroup[];
  loadingLabel?: string;
  error?: string | null;
  onRetry?: { label: string; onClick: () => void };
  isTheater?: boolean;
  onTheaterToggle?: () => void;
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
  subtitleLine,
  description,
  nextEpisode,
  settingsGroups = [],
  loadingLabel,
  error,
  onRetry,
  isTheater = false,
  onTheaterToggle,
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
  const [showSpeed, setShowSpeed] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volumeBoost, setVolumeBoost] = useState(1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const subtitlesRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);

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
    if (!showSettings && !showSubtitles && !showSpeed) return;
    function onDocClick(e: MouseEvent) {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
      if (showSubtitles && subtitlesRef.current && !subtitlesRef.current.contains(e.target as Node)) setShowSubtitles(false);
      if (showSpeed && speedRef.current && !speedRef.current.contains(e.target as Node)) setShowSpeed(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showSettings, showSubtitles, showSpeed]);

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
  const qualityGroups = visibleGroups.filter((g) => g.label !== "Subtitles");
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const subtitleActive = subtitleGroup?.options.some((o) => o.active && o.id !== "-1") ?? false;

  const controlsVisible = showControls || !playing || showSettings || showSubtitles || showSpeed;

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

      <div className="player-overlay-layer" style={{ zIndex: 20 }}>
        <div
          className={`player-idle-overlay${playing ? " is-hidden" : ""}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "20px clamp(16px, 3vw, 32px)",
            background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 65%)",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
            Now Watching
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: subtitleLine ? 2 : 6 }}>{title}</h2>
          {subtitleLine && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>{subtitleLine}</p>
          )}
          {description && (
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.7)",
                maxWidth: 480,
                marginBottom: nextEpisode ? 12 : 0,
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
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Next Episode</p>
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
              padding: "24px 16px 12px",
              background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
            }}
          >
            <div className="player-progress-track" onClick={handleSeek}>
              <div className="player-progress-fill" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <button className="player-control-btn" onClick={() => skipTime(-10)} aria-label="Rewind 10s">
                <Rewind size={16} />
              </button>
              <button className="player-control-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button className="player-control-btn" onClick={() => skipTime(10)} aria-label="Forward 10s">
                <FastForward size={16} />
              </button>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", minWidth: 90 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <div style={{ flex: 1 }} />
              <button className="player-control-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: 70, accentColor: "#fff" }}
              />
              {subtitleGroup && (
                <div ref={subtitlesRef} style={{ position: "relative" }}>
                  <button
                    className={`player-control-btn${subtitleActive ? " is-active" : ""}`}
                    onClick={() => { setShowSubtitles((s) => !s); setShowSettings(false); setShowSpeed(false); }}
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
                </div>
              )}
              <div ref={speedRef} style={{ position: "relative" }}>
                <button
                  className={`player-control-btn${playbackRate !== 1 ? " is-active" : ""}`}
                  onClick={() => { setShowSpeed((s) => !s); setShowSettings(false); setShowSubtitles(false); }}
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
              {qualityGroups.length > 0 && (
                <div ref={settingsRef} style={{ position: "relative" }}>
                  <button className="player-control-btn" onClick={() => { setShowSettings((s) => !s); setShowSubtitles(false); setShowSpeed(false); }} aria-label="Quality">
                    <Settings size={18} />
                  </button>
                  {showSettings && (
                    <div className="player-settings-panel">
                      {qualityGroups.map((group) => (
                        <div key={group.label}>
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
              <button className="player-control-btn" onClick={screenshot} aria-label="Screenshot">
                <Camera size={16} />
              </button>
              {pipSupported && (
                <button className="player-control-btn" onClick={togglePiP} aria-label="Picture in Picture">
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
            <div ref={subtitlesRef} style={{ position: "relative" }}>
              <button className={`player-control-btn${subtitleActive ? " is-active" : ""}`} style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => { setShowSubtitles((s) => !s); setShowSettings(false); setShowSpeed(false); }} aria-label="Subtitles">
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
          {qualityGroups.length > 0 && (
            <div ref={settingsRef} style={{ position: "relative" }}>
              <button className="player-control-btn" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => { setShowSettings((s) => !s); setShowSubtitles(false); setShowSpeed(false); }} aria-label="Quality">
                <Settings size={18} />
              </button>
              {showSettings && (
                <div className="player-settings-panel">
                  {qualityGroups.map((group) => (
                    <div key={group.label}>
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
