"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Level } from "hls.js";
import { getProgressFor, updateProgressFor } from "@/lib/history";
import PlayerChrome, { type SettingsGroup } from "@/components/player/PlayerChrome";
import { type SubtitleConfig, loadSubtitleConfig, saveSubtitleConfig, applySubtitleConfig } from "@/lib/subtitle-config";
import { tmdbImage } from "@/lib/tmdb-client";

interface SeasonEpisodeSummary {
  episode_number: number;
  name?: string;
  still_path?: string;
}

interface Props {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year?: number;
  imdbId?: string;
  poster?: string;
  titleLogo?: string;
  description?: string;
  season?: number;
  episode?: number;
  totalEpisodes?: number;
  totalSeasons?: number;
  seasonEpisodes?: SeasonEpisodeSummary[];
}

interface VideasySource {
  quality: string;
  url: string;
  type: string;
}

interface VideasySubtitle {
  url: string;
  language: string;
  label?: string;
}

interface VideasyData {
  sources: VideasySource[];
  subtitles: VideasySubtitle[];
  provider?: string;
  thumbnail?: string;
  referer?: string;
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

export default function CineplayWatchClient({
  tmdbId,
  mediaType,
  title,
  year,
  imdbId,
  poster,
  titleLogo,
  description,
  season,
  episode,
  totalEpisodes,
  totalSeasons,
  seasonEpisodes,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const playbackUrlRef = useRef("");

  const [result, setResult] = useState<VideasyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeQuality, setActiveQuality] = useState(0);
  const [activeSub, setActiveSub] = useState(-1);
  const [hlsQualityOptions, setHlsQualityOptions] = useState<HlsQualityOption[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState(-1);
  const [isTheater, setIsTheater] = useState(false);
  const [audioTracks, setAudioTracks] = useState<{ id: number; label: string }[]>([]);
  const [activeAudio, setActiveAudio] = useState(0);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => loadSubtitleConfig());
  const [osSubtitles, setOsSubtitles] = useState<VideasySubtitle[]>([]);
  const [osSearching, setOsSearching] = useState(false);
  const [osSearched, setOsSearched] = useState(false);

  const searchOpenSubtitles = useCallback(async () => {
    if (osSearching || osSearched) return;
    setOsSearching(true);
    try {
      const params = new URLSearchParams({ tmdbId: String(tmdbId), mediaType });
      if (mediaType === "tv") {
        params.set("season", String(season || 1));
        params.set("episode", String(episode || 1));
      }
      if (imdbId) params.set("imdbId", imdbId);
      const resp = await fetch(`/api/opensubtitles?${params.toString()}`);
      const data = await resp.json();
      if (data.success && data.subtitles?.length > 0) {
        setOsSubtitles(data.subtitles.map((s: { url: string; language: string; label: string }) => ({ url: s.url, language: s.language, label: s.label })));
      }
    } catch {
      // silent fail
    } finally {
      setOsSearching(false);
      setOsSearched(true);
    }
  }, [tmdbId, mediaType, season, episode, imdbId, osSearching, osSearched]);

  // Auto-search OpenSubtitles when provider returns no subtitles
  useEffect(() => {
    if (result && (!result.subtitles || result.subtitles.length === 0) && !osSearched && !osSearching) {
      void searchOpenSubtitles();
    }
  }, [result, osSearched, osSearching, searchOpenSubtitles]);

  const progressKey = mediaType === "tv" ? { season, episode } : {};
  const savedProgress = typeof window !== "undefined"
    ? getProgressFor(mediaType, tmdbId, mediaType === "tv" ? episode : undefined, mediaType === "tv" ? season : undefined)
    : null;
  const savedTimeRef = useRef<number>(savedProgress?.currentTime ?? 0);
  const lastSaveRef = useRef<number>(0);

  const subtitleLine = mediaType === "tv"
    ? `S${season || 1} E${episode || 1}`
    : `${year || ""}`;

  const [activeProvider, setActiveProvider] = useState<string>("VIDEASY");

  const fetchFromProvider = useCallback(
    async (provider: string): Promise<boolean> => {
      const baseParams: Record<string, string> = {
        tmdbId: String(tmdbId),
        mediaType,
      };
      if (mediaType === "tv") {
        baseParams.season = String(season || 1);
        baseParams.episode = String(episode || 1);
      }
      const qs = new URLSearchParams(baseParams).toString();

      let endpoint = "";
      switch (provider) {
        case "VIDEASY":
          endpoint = `/api/videasy?${qs}&title=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}${imdbId ? `&imdbId=${imdbId}` : ""}`;
          break;
        case "VidLink":
          endpoint = `/api/vidlink?${qs}`;
          break;
        case "VixSrc":
          endpoint = `/api/vixsrc?${qs}`;
          break;
        case "ZxcStreams":
          endpoint = `/api/zxcstreams?${qs}${title ? `&title=${encodeURIComponent(title)}` : ""}${year ? `&year=${year}` : ""}${imdbId ? `&imdbId=${imdbId}` : ""}`;
          break;
        case "HDGharTV":
          endpoint = `/api/hdghartv?${qs}${title ? `&title=${encodeURIComponent(title)}` : ""}${year ? `&year=${year}` : ""}`;
          break;
        case "4KHDHub":
          endpoint = `/api/4khdhub?${qs}${title ? `&title=${encodeURIComponent(title)}` : ""}${year ? `&year=${year}` : ""}`;
          break;
        default:
          return false;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider === "VIDEASY" ? 10000 : provider === "4KHDHub" ? 90000 : 20000);
      try {
        const resp = await fetch(endpoint, { signal: controller.signal });
        const data = await resp.json();
        if (data.success && data.data && data.data.sources?.length > 0) {
          setActiveProvider(provider);
          setResult(data.data);
          setActiveQuality(0);
          setHlsQualityOptions([]);
          setSelectedHlsLevel(-1);

          // Fallback: fetch subtitles if provider returned none
          if (!data.data.subtitles || data.data.subtitles.length === 0) {
            try {
              const subParams = new URLSearchParams({ tmdbId: String(tmdbId), mediaType, provider });
              if (mediaType === "tv") {
                subParams.set("season", String(season || 1));
                subParams.set("episode", String(episode || 1));
              }
              if (imdbId) subParams.set("imdbId", imdbId);
              const subResp = await fetch(`/api/subtitles?${subParams.toString()}`, { signal: controller.signal });
              const subData = await subResp.json();
              if (subData.success && subData.subtitles?.length > 0) {
                setResult((prev) => prev ? { ...prev, subtitles: subData.subtitles } : prev);
              }
            } catch {
              // fallback subtitles failed silently
            }
          }

          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    },
    [tmdbId, mediaType, title, year, imdbId, season, episode],
  );

  const fetchSources = useCallback(
    async (preferred?: string) => {
      setLoading(true);
      setError("");
      setResult(null);
      setHlsQualityOptions([]);
      setSelectedHlsLevel(-1);
      setOsSubtitles([]);
      setOsSearched(false);

      const allProviders = ["VIDEASY", "VidLink", "VixSrc", "ZxcStreams", "HDGharTV", "4KHDHub"];
      const chain =
        preferred && preferred !== "auto"
          ? [preferred, ...allProviders.filter((p) => p !== preferred)]
          : allProviders;

      let lastTried = "";
      for (const provider of chain) {
        lastTried = provider;
        const ok = await fetchFromProvider(provider);
        if (ok) {
          setLoading(false);
          return;
        }
      }

      setError(preferred && preferred !== "auto"
        ? `No stream found from ${preferred}, tried all other providers too`
        : "No stream found from any provider");
      setLoading(false);
    },
    [fetchFromProvider],
  );

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    if (containerRef.current) applySubtitleConfig(containerRef.current, subtitleConfig);
  }, [subtitleConfig]);

  const handleSubtitleConfigChange = useCallback((config: SubtitleConfig) => {
    setSubtitleConfig(config);
    saveSubtitleConfig(config);
    if (containerRef.current) applySubtitleConfig(containerRef.current, config);
  }, []);

  const activeSource = result?.sources?.[activeQuality];
  const activeSourceUrl = activeSource?.url ?? "";
  const isHls = activeSource?.type === "hls" || activeSourceUrl.includes(".m3u8");
  const isMp4 = activeSource?.type === "mp4" || activeSource?.type === "mkv" || activeSourceUrl.includes(".mp4") || activeSourceUrl.includes(".mkv") || activeSourceUrl.includes("cloudflarestorage");
  const streamReferer = result?.referer ?? "";

  const playbackUrl = useMemo(() => {
    if (!activeSourceUrl) return "";
    if (isMp4) return `/api/mp4?url=${encodeURIComponent(activeSourceUrl)}`;
    const params = new URLSearchParams({ url: activeSourceUrl });
    if (streamReferer) params.set("referer", streamReferer);
    return `/api/hls?${params.toString()}`;
  }, [activeSourceUrl, isMp4, streamReferer]);

  const onTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.currentTime <= 0) return;
    savedTimeRef.current = video.currentTime;
    const now = Date.now();
    if (now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      updateProgressFor({
        kind: mediaType,
        id: tmdbId,
        episode: mediaType === "tv" ? episode : undefined,
        season: mediaType === "tv" ? season : undefined,
        currentTime: video.currentTime,
        duration: video.duration || 0,
        title,
        cover: poster || "",
        href: mediaType === "tv"
          ? `/watch/tv/${tmdbId}/${season || 1}/${episode || 1}`
          : `/watch/movie/${tmdbId}`,
      });
    }
  }, [mediaType, tmdbId, episode, season, title, poster]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", onTimeUpdate);
    const saveOnLeave = () => {
      if (video.currentTime > 0)
        updateProgressFor({
          kind: mediaType,
          id: tmdbId,
          episode: mediaType === "tv" ? episode : undefined,
          season: mediaType === "tv" ? season : undefined,
          currentTime: video.currentTime,
          duration: video.duration || 0,
          title,
          cover: poster || "",
          href: mediaType === "tv"
            ? `/watch/tv/${tmdbId}/${season || 1}/${episode || 1}`
            : `/watch/movie/${tmdbId}`,
        });
    };
    window.addEventListener("beforeunload", saveOnLeave);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      window.removeEventListener("beforeunload", saveOnLeave);
      saveOnLeave();
    };
  }, [mediaType, tmdbId, episode, season, title, poster, onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;
    if (playbackUrlRef.current === playbackUrl && hlsRef.current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setHlsQualityOptions([]);
    setSelectedHlsLevel(-1);

    const playAt = savedTimeRef.current || video.currentTime;
    playbackUrlRef.current = playbackUrl;
    let aborted = false;
    let startedPlayback = false;

    const startPlayback = () => {
      if (startedPlayback || aborted || playbackUrlRef.current !== playbackUrl) return;
      startedPlayback = true;
      setLoading(false);
      if (playAt > 0) {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          video.play().catch(() => null);
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = playAt;
      } else {
        video.play().catch(() => null);
      }
    };

    const handleWaiting = () => { if (startedPlayback) setLoading(true); };
    const handlePlaying = () => setLoading(false);

    video.addEventListener("progress", startPlayback);
    video.addEventListener("canplay", startPlayback);
    video.addEventListener("loadeddata", startPlayback);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);

    if (isMp4) {
      video.src = playbackUrl;
      video.onloadeddata = startPlayback;
      video.oncanplay = startPlayback;
      video.load();
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (aborted || playbackUrlRef.current !== playbackUrl) return;
        if (Hls.isSupported()) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          const hls = new Hls({
            enableWorker: false,
            preferManagedMediaSource: false,
            lowLatencyMode: false,
            backBufferLength: 30,
            maxBufferLength: 45,
          });
          hlsRef.current = hls;
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (aborted || playbackUrlRef.current !== playbackUrl) return;
            setHlsQualityOptions(getHlsQualityOptions(hls.levels));
            setSelectedHlsLevel(-1);
            startPlayback();
          });
          const updateAudioTracks = () => {
            if (aborted || playbackUrlRef.current !== playbackUrl) return;
            const tracks = hls.audioTracks.map((t, i) => ({
              id: i,
              label: t.name || t.lang || `Track ${i + 1}`,
            }));
            setAudioTracks(tracks);
            // Auto-select English if available (VixSrc defaults to Italian)
            if (tracks.length > 1) {
              const engIdx = hls.audioTracks.findIndex(
                (t) => t.lang?.startsWith("eng") || t.name?.toLowerCase().includes("english"),
              );
              if (engIdx >= 0 && hls.audioTrack !== engIdx) {
                hls.audioTrack = engIdx;
                setActiveAudio(engIdx);
              }
            }
          };
          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateAudioTracks);
          hls.on(Hls.Events.AUDIO_TRACK_LOADED, updateAudioTracks);
          // Also check after a short delay in case events already fired
          setTimeout(updateAudioTracks, 2000);
          hls.on(Hls.Events.FRAG_BUFFERED, startPlayback);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
              else {
                setError(`Stream error: ${data.details}`);
                setLoading(false);
              }
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
    }

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
      setAudioTracks([]);
      setActiveAudio(0);
      video.removeEventListener("progress", startPlayback);
      video.removeEventListener("canplay", startPlayback);
      video.removeEventListener("loadeddata", startPlayback);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
    };
  }, [playbackUrl, isMp4]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const applySubtitles = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode =
          allSubtitles.length > 0 && i === activeSub ? "showing" : "disabled";
      }
    };
    
    // Apply immediately and also after a delay (tracks may still be loading)
    applySubtitles();
    const timer = setTimeout(applySubtitles, 800);
    const timer2 = setTimeout(applySubtitles, 2000);
    
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, [result, activeSub]);

  function selectHlsQuality(level: number) {
    setSelectedHlsLevel(level);
    setError("");
    if (hlsRef.current) hlsRef.current.currentLevel = level;
  }

  function selectAudio(idx: number) {
    setActiveAudio(idx);
    if (hlsRef.current) hlsRef.current.audioTrack = idx;
  }

  function selectSubtitle(idx: number) {
    setActiveSub(idx);
    const video = videoRef.current;
    if (video) {
      for (let i = 0; i < video.textTracks.length; i++)
        video.textTracks[i].mode = i === idx ? "showing" : "disabled";
    }
  }

  function selectQuality(idx: number) {
    setActiveQuality(idx);
    setLoading(true);
  }

  const settingsGroups: SettingsGroup[] = [];

  if (result && result.sources.length > 1) {
    settingsGroups.push({
      label: "Source",
      options: result.sources.map((s, i) => ({
        id: String(i),
        label: s.quality,
        active: activeQuality === i,
      })),
      onSelect: (id) => selectQuality(Number(id)),
    });
  }

  settingsGroups.push({
    label: "Provider",
    options: [
      { id: "VIDEASY", label: `VIDEASY${activeProvider === "VIDEASY" ? " ✓" : ""}`, active: activeProvider === "VIDEASY" },
      { id: "VidLink", label: `VidLink${activeProvider === "VidLink" ? " ✓" : ""}`, active: activeProvider === "VidLink" },
      { id: "VixSrc", label: `VixSrc${activeProvider === "VixSrc" ? " ✓" : ""}`, active: activeProvider === "VixSrc" },
      { id: "ZxcStreams", label: `ZxcStreams${activeProvider === "ZxcStreams" ? " ✓" : ""}`, active: activeProvider === "ZxcStreams" },
      { id: "HDGharTV", label: `HDGharTV${activeProvider === "HDGharTV" ? " ✓" : ""}`, active: activeProvider === "HDGharTV" },
      { id: "4KHDHub", label: `4KHDHub${activeProvider === "4KHDHub" ? " ✓" : ""}`, active: activeProvider === "4KHDHub" },
    ],
    onSelect: (id) => { void fetchSources(id); },
  });

  if (audioTracks.length > 1) {
    settingsGroups.push({
      label: "Audio",
      options: audioTracks.map((t) => ({
        id: String(t.id),
        label: `${t.label}${activeAudio === t.id ? " ✓" : ""}`,
        active: activeAudio === t.id,
      })),
      onSelect: (id) => selectAudio(Number(id)),
    });
  }

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

  const allSubtitles: VideasySubtitle[] = [
    ...(result?.subtitles || []),
    ...osSubtitles,
  ];

  if (allSubtitles.length > 0) {
    settingsGroups.push({
      label: "Subtitles",
      options: [
        { id: "-1", label: "Off", active: activeSub === -1 },
        ...allSubtitles.map((s, i) => ({
          id: String(i),
          label: i >= (result?.subtitles?.length || 0) ? `${s.label || s.language} (OS)` : (s.label || s.language),
          active: activeSub === i,
        })),
      ],
      onSelect: (id) => selectSubtitle(Number(id)),
    });
  }

  settingsGroups.push({
    label: osSearching ? "Searching OpenSubtitles..." : osSearched ? (osSubtitles.length > 0 ? `OpenSubtitles (${osSubtitles.length} found)` : "OpenSubtitles (none found)") : "OpenSubtitles Search",
    options: [{ id: "os-search", label: osSearching ? "Searching..." : "Search for this title", active: osSearching }],
    onSelect: () => { void searchOpenSubtitles(); },
  });

  const nextEpisodeData = seasonEpisodes?.find((e) => e.episode_number === (episode || 0) + 1);
  const nextEpisode =
    mediaType === "tv" && episode && totalEpisodes && episode < totalEpisodes
      ? {
          href: `/watch/tv/${tmdbId}/${season || 1}/${episode + 1}`,
          meta: nextEpisodeData?.name ? `${episode + 1}. ${nextEpisodeData.name}` : `Episode ${episode + 1}`,
          thumbnail: nextEpisodeData?.still_path ? tmdbImage(nextEpisodeData.still_path, "w300") : undefined,
        }
      : undefined;

  const prevEpisode =
    mediaType === "tv" && episode && episode > 1
      ? `/watch/tv/${tmdbId}/${season || 1}/${episode - 1}`
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div ref={containerRef} className="player-container">
        <video
          ref={videoRef}
          className="w-full h-full"
          crossOrigin="anonymous"
          playsInline
          poster={poster}
        >
          {allSubtitles.map((sub, i) => (
            <track
              key={i}
              kind="subtitles"
              label={i >= (result?.subtitles?.length || 0) ? `${sub.label || sub.language} (OS)` : (sub.label || sub.language)}
              srcLang={sub.language}
              src={`/api/sub-proxy?url=${encodeURIComponent(sub.url)}`}
              default={i === activeSub}
            />
          ))}
        </video>
        <PlayerChrome
          containerRef={containerRef}
          videoRef={videoRef}
          title={title}
          titleLogo={titleLogo}
          subtitleLine={subtitleLine}
          description={description}
          nextEpisode={nextEpisode}
          settingsGroups={settingsGroups}
          loadingLabel={loading ? "Loading stream..." : undefined}
          error={error || undefined}
          onRetry={error ? { label: "Retry", onClick: fetchSources } : undefined}
          isTheater={isTheater}
          onTheaterToggle={() => setIsTheater((v) => !v)}
          subtitleConfig={subtitleConfig}
          onSubtitleConfigChange={handleSubtitleConfigChange}
          tmdbId={tmdbId}
          seasonNumber={season}
          episodeNumber={episode}
          mediaType={mediaType}
        />
      </div>

      {mediaType === "tv" && (prevEpisode || nextEpisode) && (
        <div className="flex gap-3 mt-4" style={{ flexWrap: "wrap" }}>
          {prevEpisode && (
            <a
              href={prevEpisode}
              className="px-5 py-2.5 text-sm font-bold"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              ← Ep {episode! - 1}
            </a>
          )}
          {nextEpisode && (
            <a
              href={nextEpisode.href}
              className="px-5 py-2.5 text-sm font-bold"
              style={{
                background: "rgba(0,0,0,0.75)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Ep {episode! + 1} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
