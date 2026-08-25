"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Trash2,
  RotateCcw,
  HardDrive,
  Clock,
  Heart,
  Database,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { getWatchlistCount, WATCHLIST_EVENT } from "@/lib/watchlist";
import { getAllHistory } from "@/lib/history";

type Toast = { msg: string; type: "success" | "error" } | null;

export default function SettingsPage() {
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [storageEstimate, setStorageEstimate] = useState<{ used: number; quota: number } | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const refreshCounts = useCallback(() => {
    setWatchlistCount(getWatchlistCount());
    setHistoryCount(getAllHistory().length);
  }, []);

  useEffect(() => {
    refreshCounts();
    window.addEventListener(WATCHLIST_EVENT, refreshCounts);
    return () => window.removeEventListener(WATCHLIST_EVENT, refreshCounts);
  }, [refreshCounts]);

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageEstimate({ used: est.usage || 0, quota: est.quota || 0 });
      });
    }
  }, []);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function clearBrowserCache() {
    if ("caches" in window) {
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          showToast("Browser cache cleared");
        });
      });
    } else {
      showToast("Cache API not supported", "error");
    }
  }

  function clearWatchHistory() {
    localStorage.removeItem("watch-history");
    refreshCounts();
    showToast("Watch history cleared");
  }

  function clearWatchlist() {
    localStorage.removeItem("watchlist");
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
    refreshCounts();
    showToast("Watchlist cleared");
  }

  function clearAllData() {
    localStorage.clear();
    if ("caches" in window) {
      caches.keys().then((names) =>
        Promise.all(names.map((name) => caches.delete(name))),
      );
    }
    refreshCounts();
    showToast("All local data cleared");
  }

  function reloadPage() {
    window.location.reload();
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px clamp(12px, 3vw, 16px) 64px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.5 }}>Settings</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
          Manage cache, data, and preferences for KINOVA.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            background: toast.type === "success" ? "var(--success)" : "#ef4444",
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 100,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Storage Overview */}
      <SettingsSection icon={<HardDrive size={18} />} title="Storage Overview">
        <SettingsRow label="Watch History" value={`${historyCount} items`} />
        <SettingsRow label="Watchlist" value={`${watchlistCount} items`} />
        {storageEstimate && (
          <SettingsRow
            label="Storage Used"
            value={`${formatBytes(storageEstimate.used)} / ${formatBytes(storageEstimate.quota)}`}
          />
        )}
      </SettingsSection>

      {/* Cache & Data */}
      <SettingsSection icon={<Database size={18} />} title="Cache & Data">
        <SettingsAction
          icon={<Trash2 size={16} />}
          label="Clear Browser Cache"
          description="Clears cached HLS segments and static assets. Streams may take slightly longer to load next time."
          onClick={clearBrowserCache}
          confirmKey="clear-cache"
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
        />
        <SettingsAction
          icon={<Clock size={16} />}
          label="Clear Watch History"
          description="Removes all watch progress data. You will lose your continue-watching positions."
          onClick={clearWatchHistory}
          confirmKey="clear-history"
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          danger
        />
        <SettingsAction
          icon={<Heart size={16} />}
          label="Clear Watchlist"
          description="Removes all saved titles from your My List."
          onClick={clearWatchlist}
          confirmKey="clear-watchlist"
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          danger
        />
        <SettingsAction
          icon={<Trash2 size={16} />}
          label="Clear All Local Data"
          description="Removes everything: watch history, watchlist, cached assets, and preferences. This cannot be undone."
          onClick={clearAllData}
          confirmKey="clear-all"
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          danger
        />
      </SettingsSection>

      {/* Playback */}
      <SettingsSection icon={<Zap size={18} />} title="Playback">
        <SettingsAction
          icon={<RotateCcw size={16} />}
          label="Reload Player"
          description="Force a full page reload to reset the video player and HLS buffer."
          onClick={reloadPage}
          confirmKey="reload"
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
        />
      </SettingsSection>

      {/* About */}
      <SettingsSection icon={<Info size={18} />} title="About">
        <SettingsRow label="Version" value="1.0.0" />
        <SettingsRow label="Platform" value="KINOVA Streaming" />
        <SettingsRow label="Content" value="Anime, Movies & TV Shows" />
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "16px 20px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <a
            href="/home"
            className="settings-link"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              padding: "8px 14px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              transition: "color 0.2s ease, border-color 0.2s ease",
            }}
          >
            <Globe size={14} /> Home
          </a>
          <a
            href="/my-list"
            className="settings-link"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              padding: "8px 14px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              transition: "color 0.2s ease, border-color 0.2s ease",
            }}
          >
            <Heart size={14} /> My List
          </a>
        </div>
      </SettingsSection>
    </div>
  );
}

/* --- Reusable Components --- */

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: 24,
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--card)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <span style={{ color: "var(--accent)", display: "flex" }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--text)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{value}</span>
    </div>
  );
}

function SettingsAction({
  icon,
  label,
  description,
  onClick,
  confirmKey,
  confirmAction,
  setConfirmAction,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  confirmKey: string;
  confirmAction: string | null;
  setConfirmAction: (v: string | null) => void;
  danger?: boolean;
}) {
  const isConfirming = confirmAction === confirmKey;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span style={{ color: danger ? "#ef4444" : "var(--text-muted)", display: "flex" }}>
            {icon}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{label}</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4, paddingLeft: 24 }}>
          {description}
        </p>
      </div>
      {isConfirming ? (
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => {
              onClick();
              setConfirmAction(null);
            }}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              borderRadius: 6,
              background: danger ? "#ef4444" : "var(--accent)",
              color: "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirmAction(null)}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmAction(confirmKey)}
          style={{
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 600,
            border: danger ? "1px solid #ef444440" : "1px solid var(--border)",
            borderRadius: 6,
            background: "transparent",
            color: danger ? "#ef4444" : "var(--text-muted)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s ease",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
