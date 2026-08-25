import { getSports, getAllMatches, groupMatchesByStatus, type GroupedMatches, type SportCategory } from "@/lib/sports";
import SportsClient from "@/components/sports/SportsClient";

interface Props {
  searchParams: Promise<{ sport?: string }>;
}

export default async function SportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const sport = params.sport || "all";

  let initialMatches: GroupedMatches = { live: [], today: [], upcoming: [] };
  let sports: SportCategory[] = [];

  try {
    const [sportsList, allMatches] = await Promise.all([
      getSports().catch(() => [] as SportCategory[]),
      (sport === "all" ? getAllMatches() : getAllMatches()).catch(() => []),
    ]);
    sports = sportsList;
    initialMatches = groupMatchesByStatus(allMatches);
  } catch {
    // Will show empty state in client
  }

  const liveCount = initialMatches.live.length;
  const totalCount =
    initialMatches.live.length +
    initialMatches.today.length +
    initialMatches.upcoming.length;

  return (
    <div>
      {/* Hero header */}
      <div
        style={{
          position: "relative",
          padding: "clamp(32px, 6vw, 60px) clamp(12px, 3vw, 16px) clamp(24px, 4vw, 40px)",
          background:
            "linear-gradient(90deg, rgba(15,15,18,1) 0%, rgba(20,20,24,0.9) 40%, rgba(30,30,36,0.4) 100%)",
          borderBottom: "1px solid var(--border)",
          marginBottom: 32,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(225,29,60,0.15) 0%, rgba(0,0,0,0) 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <h1 style={{ fontSize: "clamp(28px, 6vw, 42px)", fontWeight: 800, margin: 0, color: "#fff", letterSpacing: -1 }}>
              Sports
            </h1>
            {liveCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  background: "rgba(225,29,60,0.15)",
                  border: "1px solid rgba(225,29,60,0.4)",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    animation: "pulse 2s infinite",
                  }}
                />
                {liveCount} Live
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: "clamp(14px, 2.5vw, 16px)",
              color: "rgba(255,255,255,0.7)",
              maxWidth: 600,
              lineHeight: 1.5,
            }}
          >
            Live and upcoming sports matches from around the world. Football, basketball, MMA, tennis and more.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 clamp(12px, 3vw, 16px) clamp(32px, 6vw, 60px)" }}>
        <SportsClient
          initialMatches={initialMatches}
          sports={sports}
          initialSport={sport}
        />
      </div>
    </div>
  );
}
