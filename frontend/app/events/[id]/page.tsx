import EventDetailClient from "@/components/events/EventDetailClient";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EventDetailClient eventId={id} />;
}
