// localStorage-based watchlist ("My List")

import type { MediaKind } from "@/lib/history";

export interface WatchlistItem {
  kind: MediaKind;
  id: number;
  title: string;
  cover: string;
  href: string;
  addedAt: number;
}

const STORAGE_KEY = "watchlist";
export const WATCHLIST_EVENT = "watchlist-change";

function readWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWatchlist(items: WatchlistItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  } catch {}
}

export function getWatchlist(): WatchlistItem[] {
  return readWatchlist().sort((a, b) => b.addedAt - a.addedAt);
}

export function isInWatchlist(kind: MediaKind, id: number): boolean {
  return readWatchlist().some((item) => item.kind === kind && item.id === id);
}

export function toggleWatchlist(item: Omit<WatchlistItem, "addedAt">): boolean {
  const items = readWatchlist();
  const idx = items.findIndex((i) => i.kind === item.kind && i.id === item.id);
  if (idx >= 0) {
    items.splice(idx, 1);
    writeWatchlist(items);
    return false;
  }
  items.push({ ...item, addedAt: Date.now() });
  writeWatchlist(items);
  return true;
}

export function getWatchlistCount(): number {
  return readWatchlist().length;
}
