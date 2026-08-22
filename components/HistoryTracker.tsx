"use client";

import { useEffect } from "react";
import { setWatchMeta } from "@/lib/history";

interface Props {
  anilistId: number;
  episode: number;
  title: string;
  cover: string;
}

export default function HistoryTracker({ anilistId, episode, title, cover }: Props) {
  useEffect(() => {
    setWatchMeta(anilistId, episode, title, cover);
  }, [anilistId, episode, title, cover]);
  return null;
}
