"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Level } from "hls.js";
import PlayerChrome, { type SettingsGroup } from "@/components/player/PlayerChrome";
import { type SubtitleConfig, loadSubtitleConfig, saveSubtitleConfig, applySubtitleConfig } from "@/lib/subtitle-config";

export interface LiveStream {
  url: string;
  quality: string | null;
  label?: string;
}

export interface LivePlayerProps {
  channelName: string;
  channelLogo?: string;
  streams: LiveStream[];
  country?: string;
  categories?: string[];
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

export default function LivePlayer({
  channelName,
  channelLogo,
  streams,
  country,
  categories,
}: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const playbackUrlRef = useRef("");

  const [activeStreamIdx, setActiveStreamIdx] = useState(0);
  const [hlsQualityOptions, setHlsQualityOptions] = useState<HlsQualityOption[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => loadSubtitleConfig());

  useEffect(() => {
    if (containerRef.current) applySubtitleConfig(containerRef.current, subtitleConfig);
  }, [subtitleConfig]);

  const handleSubtitleConfigChange = useCallback((config: SubtitleConfig) => {
    setSubtitleConfig(config);
    saveSubtitleConfig(config);
    if (containerRef.current) applySubtitleConfig(containerRef.current, config);
  }, []);

  const activeStream = streams[activeStreamIdx];

  const playbackUrl = useMemo(() => {
    if (!activeStream?.url) return "";
    const params = new URLSearchParams({ url: activeStream.url });
    return `/api/hls?${params.toString()}`;
  }, [activeStream?.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;
    if (playbackUrlRef.current === playbackUrl && hlsRef.current) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setHlsQualityOptions([]);
    setSelectedHlsLevel(-1);
    setLoading(true);
    setError("");
    playbackUrlRef.current = playbackUrl;

    let aborted = false;
    let startedPlayback = false;

    const startPlayback = () => {
      if (startedPlayback || aborted || playbackUrlRef.current !== playbackUrl) return;
      if (!video.buffered.length) return;
      startedPlayback = true;
      setLoading(false);
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
          enableWorker: false,
          preferManagedMediaSource: false,
          lowLatencyMode: true,
          backBufferLength: 15,
          maxBufferLength: 30,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
        });
        hlsRef.current = hls;
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (aborted || playbackUrlRef.current !== playbackUrl) return;
          setHlsQualityOptions(getHlsQualityOptions(hls.levels));
          setSelectedHlsLevel(-1);
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

  function selectHlsQuality(level: number) {
    setSelectedHlsLevel(level);
    setError("");
    if (hlsRef.current) hlsRef.current.currentLevel = level;
  }

  function selectStream(idx: number) {
    setActiveStreamIdx(idx);
  }

  const settingsGroups: SettingsGroup[] = [];

  // Stream source selection (multiple streams)
  if (streams.length > 1) {
    settingsGroups.push({
      label: "Source",
      options: streams.map((s, i) => ({
        id: String(i),
        label: s.label || s.quality || `Source ${i + 1}`,
        active: activeStreamIdx === i,
      })),
      onSelect: (id) => selectStream(Number(id)),
    });
  }

  // HLS quality levels
  if (hlsQualityOptions.length > 1) {
    settingsGroups.push({
      label: "Quality",
      options: [
        { id: "-1", label: "Auto", active: selectedHlsLevel === -1 },
        ...hlsQualityOptions.map((o) => ({
          id: String(o.level),
          label: o.label,
          active: selectedHlsLevel === o.level,
        })),
      ],
      onSelect: (id) => selectHlsQuality(Number(id)),
    });
  }

  const subtitleLine = [country, ...(categories || [])].filter(Boolean).join(" • ");

  return (
    <div className="flex flex-col gap-4">
      <div ref={containerRef} className="player-container">
        <video
          ref={videoRef}
          className="w-full h-full"
          crossOrigin="anonymous"
          playsInline
          poster={channelLogo}
        />
        <PlayerChrome
          containerRef={containerRef}
          videoRef={videoRef}
          title={channelName}
          subtitleLine={subtitleLine || "LIVE"}
          settingsGroups={settingsGroups}
          loadingLabel={loading ? "Loading live stream..." : undefined}
          error={error || undefined}
          onRetry={
            error
              ? {
                  label: "Retry",
                  onClick: () => {
                    setError("");
                    setLoading(true);
                    if (hlsRef.current) {
                      hlsRef.current.destroy();
                      hlsRef.current = null;
                    }
                    playbackUrlRef.current = "";
                    // Force re-trigger by toggling stream
                    const cur = activeStreamIdx;
                    setActiveStreamIdx(-1);
                    setTimeout(() => setActiveStreamIdx(cur), 50);
                  },
                }
              : undefined
          }
          subtitleConfig={subtitleConfig}
          onSubtitleConfigChange={handleSubtitleConfigChange}
        />
      </div>
    </div>
  );
}
