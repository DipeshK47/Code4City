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
      background: "#ffffff",
      border: "1px solid rgba(190,155,70,0.18)",
      borderRadius: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      padding: "20px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: "#8a7a50", fontWeight: 500 }}>{label}</span>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 10, background: iconBg ?? "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 30, fontWeight: 700, color: "#1a1600", letterSpacing: "-1px", lineHeight: 1, marginBottom: 5 }}>
        {value}
      </div>
      {change && <p style={{ fontSize: 11.5, color: "#9a8a60" }}>{change}</p>}
    </div>
  );
}