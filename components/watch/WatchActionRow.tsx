"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Bookmark, BookmarkCheck, Download } from "lucide-react";
import { isInWatchlist, toggleWatchlist } from "@/lib/watchlist";

interface WatchActionRowProps {
  anilistId: number;
  idMal?: number;
  title: string;
  coverImage?: string;
  downloadUrl?: string;
}

export default function WatchActionRow({
  anilistId,
  idMal,
  title,
  coverImage,
  downloadUrl,
}: WatchActionRowProps) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    setInList(isInWatchlist("anime", anilistId));
  }, [anilistId]);

  const handleToggle = () => {
    toggleWatchlist({
      kind: "anime",
      id: anilistId,
      title,
      cover: coverImage || "",
      href: `/anime/${anilistId}`,
    });
    setInList((prev) => !prev);
  };

  return (
    <div className="watch-action-row">
      {idMal && (
        <a
          href={`https://myanimelist.net/anime/${idMal}`}
          target="_blank"
          rel="noopener noreferrer"
          className="watch-action-btn"
        >
          <ExternalLink size={16} />
          <span>MyAnimeList</span>
        </a>
      )}
      <button onClick={handleToggle} className="watch-action-btn">
        {inList ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        <span>{inList ? "In My List" : "Add to List"}</span>
      </button>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="watch-action-btn"
        >
          <Download size={16} />
          <span>Download</span>
        </a>
      )}
    </div>
  );
}
