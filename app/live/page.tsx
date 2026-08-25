import { getCategories, getCountries, filterChannels, type IPTVChannel, type CountryOption } from "@/lib/iptv";
import ChannelGrid from "@/components/live/ChannelGrid";

const PAGE_SIZE = 48;

interface Props {
  searchParams: Promise<{ category?: string; country?: string }>;
}

export default async function LiveTVPage({ searchParams }: Props) {
  const params = await searchParams;
  const category = params.category || "all";
  const country = params.country || "all";

  let initialChannels: IPTVChannel[] = [];
  let categories: { id: string; name: string; count?: number }[] = [];
  let countries: CountryOption[] = [];
  let totalChannels = 0;

  try {
    const [cats, countryList, chans] = await Promise.all([
      getCategories().catch(() => []),
      getCountries().catch(() => []),
      filterChannels({ category, country }).catch(() => []),
    ]);
    categories = cats.map((c) => ({ id: c.id, name: c.name, count: c.count }));
    countries = countryList;
    totalChannels = chans.length;
    initialChannels = chans.slice(0, PAGE_SIZE);
  } catch (e) {
    // Will show error in client
  }

  return (
    <div>
      <div
        style={{
          position: "relative",
          padding: "clamp(32px, 6vw, 60px) clamp(12px, 3vw, 16px) clamp(24px, 4vw, 40px)",
          background: "linear-gradient(90deg, rgba(15,15,18,1) 0%, rgba(20,20,24,0.9) 40%, rgba(30,30,36,0.4) 100%)",
          borderBottom: "1px solid var(--border)",
          marginBottom: 32,
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "50%",
            background: "radial-gradient(ellipse at center, rgba(225,29,60,0.15) 0%, rgba(0,0,0,0) 70%)",
            pointerEvents: "none"
          }}
        />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <h1 style={{ fontSize: "clamp(28px, 6vw, 42px)", fontWeight: 800, margin: 0, color: "#fff", letterSpacing: -1 }}>Live TV</h1>
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
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s infinite" }} />
              {totalChannels} Live
            </span>
          </div>
          <p style={{ fontSize: "clamp(14px, 2.5vw, 16px)", color: "rgba(255,255,255,0.7)", maxWidth: 600, lineHeight: 1.5 }}>
            Access free IPTV streams from around the world. DNS-over-HTTPS bypass is enabled for smooth viewing of ISP-blocked channels.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 clamp(12px, 3vw, 16px) clamp(24px, 4vw, 40px)" }}>
        <ChannelGrid
          initialChannels={initialChannels}
          initialTotal={totalChannels}
          categories={categories}
          countries={countries}
          initialCategory={category}
          initialCountry={country}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}
