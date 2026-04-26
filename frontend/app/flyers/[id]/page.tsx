import { SERVICE_TYPE_COLORS, SERVICE_TYPE_LABELS, type ServiceType } from "@/lib/service-resources";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type FlyerResource = {
  id: string;
  serviceType: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  hours: string;
  website: string;
  distance: number;
};

type TranslatedLabels = {
  category?: string;
  freeLowCost?: string;
  closestToYou?: string;
  scanForMore?: string;
  scanForMoreBlurb?: string;
  postedAt?: string;
  milesShort?: string;
};

type Flyer = {
  id: string;
  dropName: string;
  dropLat: number;
  dropLng: number;
  regionName: string | null;
  dominantCategory: string;
  dominantCategoryLabel: string;
  headline: string;
  blurb: string;
  resources: FlyerResource[];
  qrSlug: string | null;
  qrTargetUrl: string | null;
  secondaryLanguage: string | null;
  secondaryLanguageName: string | null;
  headlineTranslated: string | null;
  blurbTranslated: string | null;
  translatedLabels: TranslatedLabels | null;
  createdAt: string;
};

async function fetchFlyer(id: string): Promise<Flyer | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/flyers/${id}`, { cache: "no-store" });
    const payload = await res.json();
    if (!payload.success) return null;
    return payload.data;
  } catch {
    return null;
  }
}

function categoryAccent(cat: string): string {
  return SERVICE_TYPE_COLORS[cat as ServiceType] || "#D44A12";
}

function categoryLabel(cat: string, fallback: string): string {
  return SERVICE_TYPE_LABELS[cat as ServiceType] || fallback || cat;
}

export default async function FlyerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const flyer = await fetchFlyer(id);

  if (!flyer) {
    return (
      <main style={errorPageStyle}>
        <div style={errorCardStyle}>
          <div style={errorBadgeStyle}>404</div>
          <h1 style={errorHeadingStyle}>Flyer not found</h1>
          <p style={errorBodyStyle}>
            This flyer may have been deleted or the link is incorrect.
          </p>
        </div>
      </main>
    );
  }

  const accent = categoryAccent(flyer.dominantCategory);
  // Use the flyer-specific scan redirect: tracks who pasted the flyer (via flyer→userId)
  // and redirects the scanner directly to Google Maps with resource locations.
  const qrTarget = `${API_BASE_URL}/f/${flyer.id}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrTarget)}`;

  const labels = flyer.translatedLabels || null;
  const lang = flyer.secondaryLanguage || undefined;

  return (
    <main style={pageStyle}>
      <div style={{ ...flyerStyle, borderColor: accent }}>
        <header
          style={{
            background: accent,
            color: "#FFFFFF",
            padding: "20px 28px",
            borderRadius: "4px 4px 0 0",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.18em",
              fontWeight: 700,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {flyer.dominantCategoryLabel} · Free & low-cost
            {labels?.category && labels?.freeLowCost ? (
              <>
                {" / "}
                <span lang={lang}>
                  {labels.category} · {labels.freeLowCost}
                </span>
              </>
            ) : null}
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontFamily: "Fraunces, Georgia, serif",
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1.15,
            }}
          >
            {flyer.headline}
          </h1>
          {flyer.headlineTranslated ? (
            <h2
              lang={flyer.secondaryLanguage || undefined}
              style={{
                margin: "8px 0 0",
                fontFamily: "Fraunces, Georgia, serif",
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1.2,
                opacity: 0.92,
                fontStyle: "italic",
              }}
            >
              {flyer.headlineTranslated}
            </h2>
          ) : null}
        </header>

        <section style={{ padding: "20px 28px 8px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.45,
              color: "#1A1917",
            }}
          >
            {flyer.blurb}
          </p>
          {flyer.blurbTranslated ? (
            <p
              lang={flyer.secondaryLanguage || undefined}
              style={{
                margin: "10px 0 0",
                fontSize: 15,
                lineHeight: 1.45,
                color: "#3A3833",
                paddingTop: 10,
                borderTop: `1px dashed ${accent}55`,
              }}
            >
              {flyer.blurbTranslated}
            </p>
          ) : null}
          {flyer.secondaryLanguageName ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 10.5,
                color: "#8A8780",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              English / {flyer.secondaryLanguageName}
            </p>
          ) : null}
        </section>

        <section style={{ padding: "8px 28px 16px" }}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              letterSpacing: "0.16em",
              fontWeight: 700,
              color: "#8A8780",
              textTransform: "uppercase",
            }}
          >
            Closest to you
            {labels?.closestToYou ? (
              <>
                {" / "}
                <span lang={lang}>{labels.closestToYou}</span>
              </>
            ) : null}
          </p>

          {flyer.resources.map((resource, index) => (
            <article
              key={resource.id || `${resource.name}-${index}`}
              style={{
                display: "flex",
                gap: 14,
                padding: "12px 0",
                borderTop: index === 0 ? "none" : "1px solid rgba(11,11,10,0.10)",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: accent,
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "Fraunces, Georgia, serif",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {resource.name}
                </p>
                {resource.address && (
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#1A1917" }}>
                    {resource.address}
                  </p>
                )}
                {(resource.phone || resource.hours) && (
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 12,
                      color: "#6b5a22",
                    }}
                  >
                    {resource.phone}
                    {resource.phone && resource.hours ? " · " : ""}
                    {resource.hours}
                  </p>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#8A8780",
                  whiteSpace: "nowrap",
                  alignSelf: "flex-start",
                }}
              >
                {resource.distance.toFixed(1)} {labels?.milesShort && labels.milesShort !== "mi" ? `mi / ${labels.milesShort}` : "mi"}
              </div>
            </article>
          ))}
        </section>

        <footer
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 28px 24px",
            borderTop: `2px solid ${accent}`,
            background: "#FAFAF7",
            borderRadius: "0 0 4px 4px",
          }}
        >
          <img
            src={qrImageUrl}
            alt="Scan for full list of nearby resources"
            width={120}
            height={120}
            style={{ borderRadius: 4, background: "#FFFFFF", padding: 4 }}
          />
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.16em",
                fontWeight: 700,
                color: accent,
                textTransform: "uppercase",
              }}
            >
              Scan for more
              {labels?.scanForMore ? (
                <>
                  {" / "}
                  <span lang={lang}>{labels.scanForMore}</span>
                </>
              ) : null}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontFamily: "Fraunces, Georgia, serif",
                fontSize: 17,
                fontWeight: 600,
                lineHeight: 1.25,
              }}
            >
              See every nearby resource — food, shelter, healthcare and more.
            </p>
            {labels?.scanForMoreBlurb ? (
              <p
                lang={lang}
                style={{
                  margin: "4px 0 0",
                  fontFamily: "Fraunces, Georgia, serif",
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  fontStyle: "italic",
                  color: "#3A3833",
                }}
              >
                {labels.scanForMoreBlurb}
              </p>
            ) : null}
            <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "#8A8780" }}>
              Volun-Tiers · Posted at {flyer.dropName}
              {flyer.regionName ? ` · ${flyer.regionName}` : ""}
              {labels?.postedAt && labels.postedAt.toLowerCase() !== "posted at" ? (
                <>
                  {" · "}
                  <span lang={lang}>{labels.postedAt} {flyer.dropName}</span>
                </>
              ) : null}
            </p>
          </div>
        </footer>
      </div>

      <div className="no-print" style={actionBarStyle}>
        <p style={{ margin: 0, fontSize: 13, color: "#8A8780" }}>
          Press ⌘P (or Ctrl+P) to print. The buttons here won't print.
        </p>
        <a
          href={`/flyers/${flyer.id}`}
          target="_blank"
          rel="noreferrer"
          style={pillButtonStyle}
        >
          Open in new tab
        </a>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { background: #FFFFFF !important; }
              .no-print { display: none !important; }
              @page { margin: 0.5in; }
            }
          `,
        }}
      />
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: "32px 16px",
  background: "#F0EBE0",
  minHeight: "100vh",
  fontFamily: "DM Sans, system-ui, sans-serif",
  color: "#1A1917",
};

const flyerStyle: React.CSSProperties = {
  maxWidth: 580,
  margin: "0 auto",
  background: "#FFFFFF",
  borderRadius: 4,
  border: "1px solid",
  overflow: "hidden",
  boxShadow: "0 24px 60px rgba(11,11,10,0.12)",
};

const actionBarStyle: React.CSSProperties = {
  maxWidth: 580,
  margin: "16px auto 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.7)",
  borderRadius: 4,
  border: "1px solid rgba(11,11,10,0.12)",
};

const pillButtonStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#D44A12",
  border: "1px solid rgba(212, 74, 18, 0.4)",
  padding: "6px 12px",
  borderRadius: 999,
  textDecoration: "none",
};

const errorPageStyle: React.CSSProperties = {
  padding: 48,
  textAlign: "center",
  fontFamily: "DM Sans, system-ui, sans-serif",
};

const errorCardStyle: React.CSSProperties = {
  display: "inline-block",
  maxWidth: 400,
  padding: "40px 32px",
  background: "#FFFFFF",
  border: "1px solid #E5E1DA",
  borderRadius: 4,
  textAlign: "center",
};

const errorBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#D44A12",
  color: "#FFFFFF",
  fontFamily: "DM Sans, system-ui, sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  padding: "3px 10px",
  marginBottom: 16,
};

const errorHeadingStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontFamily: "'Fraunces', serif",
  fontSize: 26,
  fontWeight: 400,
  color: "#0f172a",
};

const errorBodyStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "DM Sans, system-ui, sans-serif",
  fontSize: 14,
  color: "#64748b",
};
