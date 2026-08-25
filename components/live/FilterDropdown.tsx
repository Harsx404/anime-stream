"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

interface FilterDropdownProps {
  label: string;
  allLabel: string;
  value: string;
  options: FilterOption[];
  onChange: (id: string) => void;
}

export default function FilterDropdown({ label, allLabel, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchable = options.length > 8;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.id === value);
  const activeLabel = value === "all" || !selected ? allLabel : selected.name;

  return (
    <div className="live-filter-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`live-filter-trigger${value !== "all" ? " is-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="live-filter-trigger-label">{label}:</span>
        <span className="live-filter-trigger-value">{activeLabel}</span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
      </button>

      {open && (
        <div className="live-filter-panel">
          {searchable && (
            <div className="live-filter-panel-search">
              <Search size={13} />
              <input
                autoFocus
                type="text"
                placeholder={`Find ${label.toLowerCase()}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          <div className="live-filter-panel-list">
            <button
              type="button"
              className={`live-filter-option${value === "all" ? " is-active" : ""}`}
              onClick={() => { onChange("all"); setOpen(false); }}
            >
              <span>{allLabel}</span>
            </button>
            {filtered.length === 0 ? (
              <div className="live-filter-empty">No matches</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`live-filter-option${value === opt.id ? " is-active" : ""}`}
                  onClick={() => { onChange(opt.id); setOpen(false); }}
                >
                  <span>{opt.name}</span>
                  {typeof opt.count === "number" && <span className="live-filter-option-count">{opt.count}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
