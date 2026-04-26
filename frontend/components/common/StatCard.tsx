interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  iconBg?: string;
  change?: string;
}

export default function StatCard({ label, value, icon, iconBg, change }: StatCardProps) {
  return (
    <div style={{
      background: "#F8F6F0",
      border: "1px solid rgba(11, 11, 10, 0.16)",
      borderRadius: 2,
      boxShadow: "none",
      padding: "20px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase" }}>{label}</span>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 0, background: iconBg ?? "#EBE7DE", border: "1px solid rgba(11, 11, 10, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, color: "#D44A12", flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 46, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.04em", lineHeight: 0.9, marginBottom: 8 }}>
        {value}
      </div>
      {change && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A8780", letterSpacing: "0.08em" }}>{change}</p>}
    </div>
  );
}
