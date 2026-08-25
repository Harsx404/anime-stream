"use client";

export interface SubtitleConfig {
  fontSize: number;
  color: string;
  background: string;
  backgroundOpacity: number;
  outline: string;
  outlineWidth: number;
  position: "bottom" | "top";
}

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  fontSize: 20,
  color: "#ffffff",
  background: "#000000",
  backgroundOpacity: 0.5,
  outline: "#000000",
  outlineWidth: 1,
  position: "bottom",
};

const STORAGE_KEY = "subtitle-config";

export function loadSubtitleConfig(): SubtitleConfig {
  if (typeof window === "undefined") return DEFAULT_SUBTITLE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SUBTITLE_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SUBTITLE_CONFIG, ...parsed };
  } catch {
    return DEFAULT_SUBTITLE_CONFIG;
  }
}

export function saveSubtitleConfig(config: SubtitleConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function applySubtitleConfig(container: HTMLElement, config: SubtitleConfig) {
  container.style.setProperty("--cue-font-size", `${config.fontSize}px`);
  container.style.setProperty("--cue-color", config.color);
  container.style.setProperty("--cue-bg", config.background);
  container.style.setProperty("--cue-bg-opacity", String(config.backgroundOpacity));
  container.style.setProperty("--cue-outline", config.outline);
  container.style.setProperty("--cue-outline-width", `${config.outlineWidth}px`);
  container.style.setProperty("--cue-position", config.position === "top" ? "5%" : "85%");
}

export const SUBTITLE_COLOR_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Yellow", value: "#ffeb3b" },
  { label: "Cyan", value: "#00e5ff" },
  { label: "Pink", value: "#ff80ab" },
];

export const SUBTITLE_FONT_SIZES = [
  { label: "Small", value: 14 },
  { label: "Medium", value: 20 },
  { label: "Large", value: 28 },
  { label: "X-Large", value: 36 },
];

export const SUBTITLE_BG_OPACITIES = [
  { label: "None", value: 0 },
  { label: "Low", value: 0.25 },
  { label: "Medium", value: 0.5 },
  { label: "High", value: 0.75 },
];

export const SUBTITLE_OUTLINE_WIDTHS = [
  { label: "None", value: 0 },
  { label: "Thin", value: 1 },
  { label: "Medium", value: 2 },
  { label: "Thick", value: 3 },
];
