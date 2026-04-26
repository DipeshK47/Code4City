interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  noPadding?: boolean;
  dark?: boolean;
  style?: React.CSSProperties;
}

export default function SectionCard({
  title,
  subtitle,
  children,
  action,
  noPadding = false,
  dark = false,
  style = {},
}: SectionCardProps) {
  const base: React.CSSProperties = dark
    ? {
        background: "linear-gradient(135deg, #1a1200 0%, #2c1e00 100%)",
        border: "1px solid rgba(245,200,66,0.15)",
        borderRadius: 16,
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      }
    : {
        background: "#ffffff",
        border: "1px solid rgba(190,155,70,0.18)",
        borderRadius: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      };

  return (
    <div style={{ ...base, padding: noPadding ? 0 : "22px 24px", ...style }}>
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 16,
            ...(noPadding ? { padding: "22px 24px 0" } : {}),
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: dark ? "#f5c842" : "#1a1600",
                  letterSpacing: "-0.3px",
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: 12, color: dark ? "rgba(245,200,66,0.45)" : "#9a8a60", marginTop: 3 }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}