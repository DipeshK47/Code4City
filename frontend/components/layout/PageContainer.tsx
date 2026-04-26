export default function PageContainer({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "32px 36px",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
