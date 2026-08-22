"use client";

import type { ProviderInfo } from "@/lib/use-miruro";

interface ServerSelectorProps {
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedCategory: "sub" | "dub";
  onProviderChange: (provider: string) => void;
  onCategoryChange: (category: "sub" | "dub") => void;
}

export default function ServerSelector({
  providers,
  selectedProvider,
  selectedCategory,
  onProviderChange,
  onCategoryChange,
}: ServerSelectorProps) {
  if (!providers || providers.length <= 1) return null;

  const hasSub = providers.some((p) => p.hasSub);
  const hasDub = providers.some((p) => p.hasDub);
  const showCategoryTabs = hasSub && hasDub;

  const availableProviders = providers.filter(
    (p) => selectedCategory === "dub" ? p.hasDub : p.hasSub,
  );

  return (
    <div className="server-selector">
      {showCategoryTabs && (
        <div className="server-category-tabs">
          <button
            className={`server-tab${selectedCategory === "sub" ? " is-active" : ""}`}
            onClick={() => onCategoryChange("sub")}
          >
            SUB
          </button>
          <button
            className={`server-tab${selectedCategory === "dub" ? " is-active" : ""}`}
            onClick={() => onCategoryChange("dub")}
          >
            DUB
          </button>
        </div>
      )}
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
    </div>
  );
}
