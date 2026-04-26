import PageContainer from "@/components/layout/PageContainer";
import OutreachMapDashboard from "@/components/map/OutreachMapDashboard";

export default function MapPage() {
  return (
    <PageContainer style={{ padding: 0, height: "100%" }}>
      <OutreachMapDashboard />
    </PageContainer>
  );
}
