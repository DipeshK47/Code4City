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
        background: "#0B0B0A",
        border: "1px solid rgba(212, 74, 18, 0.18)",
        borderRadius: 2,
        boxShadow: "none",
      }
    : {
        background: "#F8F6F0",
        border: "1px solid rgba(11, 11, 10, 0.16)",
        borderRadius: 2,
        boxShadow: "none",
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
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 30,
                  fontWeight: 400,
                  color: dark ? "#D44A12" : "#0B0B0A",
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: dark ? "rgba(248, 246, 240,0.58)" : "#8A8780", marginTop: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>
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
