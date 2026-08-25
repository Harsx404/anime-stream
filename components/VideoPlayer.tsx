"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Level } from "hls.js";
import { getWatchProgress, updatePlaybackPosition } from "@/lib/history";
import { useMiruroSources } from "@/lib/use-miruro";
import PlayerChrome, { type SettingsGroup } from "@/components/player/PlayerChrome";
import { type SubtitleConfig, loadSubtitleConfig, saveSubtitleConfig, applySubtitleConfig } from "@/lib/subtitle-config";

interface Props {
  episodeId: string;
  episode: number;
  anilistId: number;
  totalEpisodes: number;
  title?: string;
  episodeLabel?: string;
  description?: string;
  posterUrl?: string;
  nextEpisodeTitle?: string;
  nextEpisodeThumbnail?: string;
  provider?: string;
  category?: "sub" | "dub";
  isTheater?: boolean;
  onTheaterToggle?: () => void;
}

type HlsQualityOption = {
  level: number;
  label: string;
  height: number;
  bitrate: number;
};

function getHlsQualityOptions(levels: Level[]): HlsQualityOption[] {
  return levels
    .map((level, index) => {
      const height = Number(level.height) || 0;
      const bitrate = Number(level.averageBitrate || level.bitrate || 0);
      const label = height
        ? `${height}p`
        : bitrate
          ? `${Math.round(bitrate / 1000)} kbps`
          : `Level ${index + 1}`;
      return { level: index, label, height, bitrate };
    })
    .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate || a.level - b.level);
}

export default function VideoPlayer({
  episodeId,
  episode,
  anilistId,
  totalEpisodes,
  title,
  episodeLabel,
  description,
  posterUrl,
  nextEpisodeTitle,
  nextEpisodeThumbnail,
  provider,
  category,
  isTheater = false,
  onTheaterToggle,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const playbackUrlRef = useRef("");

  const [initialTime] = useState(() => {
    if (typeof window === "undefined") return 0;
    const progress = getWatchProgress(anilistId, episode);
    return progress?.currentTime ?? 0;
  });
  const savedTimeRef = useRef<number>(initialTime);
  const lastSaveRef = useRef<number>(0);

  const { sources, loading: sourcesLoading, error: sourcesError } =
    useMiruroSources(episodeId, anilistId, provider, category);

  const [activeQuality, setActiveQuality] = useState(0);
  const [activeSub, setActiveSub] = useState(0);
  const [hlsQualityOptions, setHlsQualityOptions] = useState<HlsQualityOption[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => loadSubtitleConfig());

  useEffect(() => { setLoading(sourcesLoading); }, [sourcesLoading]);
  useEffect(() => { setError(sourcesError); }, [sourcesError]);

  useEffect(() => {
    if (containerRef.current) applySubtitleConfig(containerRef.current, subtitleConfig);
  }, [subtitleConfig]);

  const handleSubtitleConfigChange = useCallback((config: SubtitleConfig) => {
    setSubtitleConfig(config);
    saveSubtitleConfig(config);
    if (containerRef.current) applySubtitleConfig(containerRef.current, config);
  }, []);

  useEffect(() => {
    if (!sources) return;
    const defaultIdx = sources.sources.findIndex((s) => s.default);
    const firstHlsIdx = sources.sources.findIndex((s) => s.isM3U8);
    setActiveQuality(defaultIdx >= 0 ? defaultIdx : firstHlsIdx >= 0 ? firstHlsIdx : 0);
  }, [sources]);

  const activeSourceUrl = sources?.sources?.[activeQuality]?.url ?? "";
  const activeReferer = sources?.sources?.[activeQuality]?.referer ?? "";

  const playbackUrl = useMemo(() => {
    if (!activeSourceUrl) return "";
    const params = new URLSearchParams({ url: activeSourceUrl });
    if (activeReferer) params.set("referer", activeReferer);
    return `/api/hls?${params.toString()}`;
  }, [activeSourceUrl, activeReferer]);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.currentTime <= 0) return;
    savedTimeRef.current = video.currentTime;
    const now = Date.now();
    if (now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      updatePlaybackPosition(anilistId, episode, video.currentTime, video.duration || 0);
    }
  }, [anilistId, episode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", onTimeUpdate);
    const saveOnLeave = () => {
      if (video.currentTime > 0)
        updatePlaybackPosition(anilistId, episode, video.currentTime, video.duration || 0);
    };
    window.addEventListener("beforeunload", saveOnLeave);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      window.removeEventListener("beforeunload", saveOnLeave);
      saveOnLeave();
    };
  }, [anilistId, episode, onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;
    if (playbackUrlRef.current === playbackUrl && hlsRef.current) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setHlsQualityOptions([]);
    setSelectedHlsLevel(-1);

    const playAt = savedTimeRef.current || video.currentTime;
    playbackUrlRef.current = playbackUrl;
    let aborted = false;
    let startedPlayback = false;

    const startPlayback = () => {
      if (startedPlayback || aborted || playbackUrlRef.current !== playbackUrl) return;
      if (playAt <= 0 && !video.buffered.length) return;
      startedPlayback = true;
      setLoading(false);
      if (playAt > 0) video.currentTime = playAt;
      else if (video.buffered.length && video.buffered.start(0) > 0)
        video.currentTime = video.buffered.start(0);
      video.play().catch(() => null);
    };

    const handleWaiting = () => { if (startedPlayback) setLoading(true); };
    const handlePlaying = () => setLoading(false);

    video.addEventListener("progress", startPlayback);
    video.addEventListener("canplay", startPlayback);
    video.addEventListener("loadeddata", startPlayback);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);

    import("hls.js").then(({ default: Hls }) => {
      if (aborted || playbackUrlRef.current !== playbackUrl) return;
      if (Hls.isSupported()) {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        const hls = new Hls({
          enableWorker: false, preferManagedMediaSource: false,
          lowLatencyMode: false, backBufferLength: 30, maxBufferLength: 45,
        });
        hlsRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (aborted || playbackUrlRef.current !== playbackUrl) return;
          setHlsQualityOptions(getHlsQualityOptions(hls.levels));
          setSelectedHlsLevel(-1);
          if (playAt > 0) video.currentTime = playAt;
        });
        hls.on(Hls.Events.FRAG_BUFFERED, startPlayback);
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else { setError(`Stream error: ${data.details}`); setLoading(false); }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playbackUrl;
        video.onloadeddata = startPlayback;
      } else {
        setError("HLS playback is not supported in this browser.");
        setLoading(false);
      }
    });

    return () => {
      aborted = true;
      if (playbackUrlRef.current === playbackUrl) {
        hlsRef.current?.destroy();
        hlsRef.current = null;
        playbackUrlRef.current = "";
        video.onloadedmetadata = null;
        video.onloadeddata = null;
      }
      setHlsQualityOptions([]);
      setSelectedHlsLevel(-1);
      video.removeEventListener("progress", startPlayback);
      video.removeEventListener("canplay", startPlayback);
      video.removeEventListener("loadeddata", startPlayback);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
    };
  }, [playbackUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const timer = setTimeout(() => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode =
          sources?.subs?.length && i === activeSub ? "showing" : "disabled";
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [sources, activeSub]);

  function selectHlsQuality(level: number) {
    setSelectedHlsLevel(level);
    setError("");
    if (hlsRef.current) hlsRef.current.currentLevel = level;
  }

  function selectSubtitle(idx: number) {
    setActiveSub(idx);
    const video = videoRef.current;
    if (video) {
      for (let i = 0; i < video.textTracks.length; i++)
        video.textTracks[i].mode = i === idx ? "showing" : "disabled";
    }
  }

  const settingsGroups: SettingsGroup[] = [];
  if (hlsQualityOptions.length > 1) {
    settingsGroups.push({
      label: "Quality",
      options: [
        { id: "-1", label: "Auto", active: selectedHlsLevel === -1 },
        ...hlsQualityOptions.map((o) => ({ id: String(o.level), label: o.label, active: selectedHlsLevel === o.level })),
      ],
      onSelect: (id) => selectHlsQuality(Number(id)),
    });
  }
  if (sources?.subs && sources.subs.length > 0) {
    settingsGroups.push({
      label: "Subtitles",
      options: [
        { id: "-1", label: "Off", active: activeSub === -1 },
        ...sources.subs.map((s, i) => ({ id: String(i), label: s.lang, active: activeSub === i })),
      ],
      onSelect: (id) => selectSubtitle(Number(id)),
    });
  }

  const nextEpisode = episode < totalEpisodes
    ? {
        href: `/watch/${anilistId}/${episode + 1}`,
        meta: `Episode ${episode + 1}${nextEpisodeTitle ? ` | ${nextEpisodeTitle}` : ""}`,
        thumbnail: nextEpisodeThumbnail,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div ref={containerRef} className="player-container">
        <video ref={videoRef} className="w-full h-full" crossOrigin="anonymous" playsInline poster={posterUrl}>
          {sources?.subs?.map((sub, i) => (
            <track key={i} kind="subtitles" label={sub.lang}
              src={`/api/sub-proxy?url=${encodeURIComponent(sub.url)}`}
              default={i === activeSub} />
          ))}
        </video>
        <PlayerChrome
          containerRef={containerRef}
          videoRef={videoRef}
          title={title || `Episode ${episode}`}
          subtitleLine={episodeLabel || `Episode ${episode}`}
          description={description}
          nextEpisode={nextEpisode}
          settingsGroups={settingsGroups}
          loadingLabel={loading ? "Loading episode..." : undefined}
          error={error || undefined}
          isTheater={isTheater}
          onTheaterToggle={onTheaterToggle}
          subtitleConfig={subtitleConfig}
          onSubtitleConfigChange={handleSubtitleConfigChange}
          anilistId={anilistId}
          episodeNumber={episode}
        />
      </div>

      <div className="flex gap-3 mt-4">
        {episode > 1 && (
          <a href={`/watch/${anilistId}/${episode - 1}`}
            className="px-5 py-2.5 text-sm font-bold"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            ← Ep {episode - 1}
          </a>
        )}
        {episode < totalEpisodes && (
          <a href={`/watch/${anilistId}/${episode + 1}`}
            className="px-5 py-2.5 text-sm font-bold"
            style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Ep {episode + 1} →
          </a>
        )}
      </div>
    </div>
  );
}
