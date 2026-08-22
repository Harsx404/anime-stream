// localStorage-based watch history (anime, movie, tv)

export type MediaKind = "anime" | "movie" | "tv";

export interface WatchProgress {
  kind: MediaKind;
  id: number; // anilistId for anime, tmdbId for movie/tv
  episode?: number;
  season?: number;
  currentTime: number;
  duration: number;
  title: string;
  cover: string;
  href: string;
  updatedAt: number;
}

interface LegacyWatchProgress {
  anilistId: number;
  episode: number;
  currentTime: number;
  duration: number;
  title: string;
  cover: string;
  updatedAt: number;
}

const STORAGE_KEY = "watch-history";

function isLegacyEntry(entry: unknown): entry is LegacyWatchProgress {
  return (
    !!entry &&
    typeof entry === "object" &&
    typeof (entry as LegacyWatchProgress).anilistId === "number" &&
    !("kind" in entry)
  );
}

function readHistory(): WatchProgress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry): WatchProgress =>
      isLegacyEntry(entry)
        ? {
            kind: "anime",
            id: entry.anilistId,
            episode: entry.episode,
            currentTime: entry.currentTime,
            duration: entry.duration,
            title: entry.title,
            cover: entry.cover,
            href: `/watch/${entry.anilistId}/${entry.episode}`,
            updatedAt: entry.updatedAt,
          }
        : entry,
    );
  } catch {
    return [];
  }
}

function writeHistory(history: WatchProgress[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

function findEntry(
  history: WatchProgress[],
  kind: MediaKind,
  id: number,
  episode?: number,
  season?: number,
): number {
  return history.findIndex(
    (h) => h.kind === kind && h.id === id && h.episode === episode && h.season === season,
  );
}

// --- Generic API (anime, movie, tv) ---

export interface ProgressUpdate {
  kind: MediaKind;
  id: number;
  episode?: number;
  season?: number;
  currentTime: number;
  duration: number;
  title?: string;
  cover?: string;
  href: string;
}

export function updateProgressFor(update: ProgressUpdate): void {
  if (typeof window === "undefined") return;
  const history = readHistory();
  const idx = findEntry(history, update.kind, update.id, update.episode, update.season);

  if (idx >= 0) {
    history[idx].currentTime = update.currentTime;
    history[idx].duration = update.duration;
    history[idx].href = update.href;
    history[idx].updatedAt = Date.now();
    if (update.title) history[idx].title = update.title;
    if (update.cover) history[idx].cover = update.cover;
  } else {
    history.push({
      kind: update.kind,
      id: update.id,
      episode: update.episode,
      season: update.season,
      currentTime: update.currentTime,
      duration: update.duration,
      title: update.title || "",
      cover: update.cover || "",
      href: update.href,
      updatedAt: Date.now(),
    });
  }

  history.sort((a, b) => b.updatedAt - a.updatedAt);
  writeHistory(history.slice(0, 50));
}

export function getProgressFor(
  kind: MediaKind,
  id: number,
  episode?: number,
  season?: number,
): WatchProgress | null {
  const history = readHistory();
  const idx = findEntry(history, kind, id, episode, season);
  return idx >= 0 ? history[idx] : null;
}

export function getContinueWatching(limit = 12): WatchProgress[] {
  const history = readHistory();
  return history
    .filter((h) => h.currentTime > 5 && (h.duration === 0 || h.currentTime / h.duration < 0.95))
    .slice(0, limit);
}

export function getAllHistory(limit = 50): WatchProgress[] {
  return readHistory().slice(0, limit);
}

// --- Anime-specific API (existing callers: VideoPlayer.tsx, HistoryTracker.tsx) ---

export function getWatchProgress(anilistId: number, episode: number): WatchProgress | null {
  return getProgressFor("anime", anilistId, episode);
}

export function updatePlaybackPosition(
  anilistId: number,
  episode: number,
  currentTime: number,
  duration: number,
): void {
  updateProgressFor({
    kind: "anime",
    id: anilistId,
    episode,
    currentTime,
    duration,
    href: `/watch/${anilistId}/${episode}`,
  });
}

export function setWatchMeta(
  anilistId: number,
  episode: number,
  title: string,
  cover: string,
): void {
  if (typeof window === "undefined") return;
  const history = readHistory();
  const idx = findEntry(history, "anime", anilistId, episode);
  if (idx >= 0) {
    history[idx].title = title;
    history[idx].cover = cover;
    writeHistory(history);
  }
}
