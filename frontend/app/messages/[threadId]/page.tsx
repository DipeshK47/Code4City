import MessagesPageClient from "@/components/chat/MessagesPageClient";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  return <MessagesPageClient threadId={Number(threadId)} />;
}
