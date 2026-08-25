"use client";

import type { ProviderInfo, SourceBackend } from "@/lib/use-anime";
import { ALL_BACKENDS, BACKEND_LABELS } from "@/lib/use-anime";

interface ServerSelectorProps {
  providers: ProviderInfo[];
  selectedBackend: SourceBackend;
  selectedProvider: string;
  selectedCategory: "sub" | "dub";
  onBackendChange: (backend: SourceBackend) => void;
  onProviderChange: (provider: string) => void;
  onCategoryChange: (category: "sub" | "dub") => void;
}

export default function ServerSelector({
  providers,
  selectedBackend,
  selectedProvider,
  selectedCategory,
  onBackendChange,
  onProviderChange,
  onCategoryChange,
}: ServerSelectorProps) {
  const hasSub = providers.some((p) => p.hasSub);
  const hasDub = providers.some((p) => p.hasDub);

  const availableProviders = providers.filter(
    (p) => selectedCategory === "dub" ? p.hasDub : p.hasSub,
  );

  return (
    <div className="server-selector">
      {/* Source backend switcher */}
      <div className="server-backend-tabs">
        {ALL_BACKENDS.map((b) => (
          <button
            key={b}
            className={`server-tab${selectedBackend === b ? " is-active" : ""}`}
            onClick={() => onBackendChange(b)}
          >
            {BACKEND_LABELS[b]}
          </button>
        ))}
      </div>

      {(hasSub || hasDub) && (
        <div className="server-category-tabs">
          {hasSub && (
            <button
              className={`server-tab${selectedCategory === "sub" ? " is-active" : ""}`}
              onClick={() => onCategoryChange("sub")}
            >
              SUB
            </button>
          )}
          {hasDub && (
            <button
              className={`server-tab${selectedCategory === "dub" ? " is-active" : ""}`}
              onClick={() => onCategoryChange("dub")}
            >
              DUB
            </button>
          )}
        </div>
      )}
      {availableProviders.length > 0 && (
        <div className="server-pills">
          {availableProviders.map((p) => (
            <button
              key={p.name}
              className={`server-pill${selectedProvider === p.name ? " is-active" : ""}`}
              onClick={() => onProviderChange(p.name)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
