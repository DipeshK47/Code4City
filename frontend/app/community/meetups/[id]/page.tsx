import MeetupDetailClient from "@/components/community/MeetupDetailClient";

export default async function MeetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MeetupDetailClient meetupId={Number(id)} />;
}
