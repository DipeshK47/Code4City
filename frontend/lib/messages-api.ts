import { apiFetch } from "./api-client";
import type { DMMessage, DMThread } from "./social-types";

type ListResponse<T> = {
  success: boolean;
  count: number;
  data: T[];
};

type ItemResponse<T> = {
  success: boolean;
  data: T;
};

export type SearchUser = {
  id: number;
  username: string;
  fullName: string | null;
};

export async function searchUsers(token: string, q: string) {
  return apiFetch<ListResponse<SearchUser>>(
    `/api/messages/users/search?q=${encodeURIComponent(q)}`,
    { token },
  );
}

export async function getThreads(token: string) {
  return apiFetch<ListResponse<DMThread>>("/api/messages/threads", { token });
}

export async function createOrGetThread(token: string, otherUserId: number) {
  return apiFetch<ItemResponse<DMThread>>("/api/messages/threads", {
    token,
    method: "POST",
    body: { otherUserId },
  });
}

export async function getThread(token: string, threadId: number) {
  return apiFetch<ItemResponse<DMThread>>(`/api/messages/threads/${threadId}`, {
    token,
  });
}

export async function getThreadMessages(token: string, threadId: number) {
  return apiFetch<ListResponse<DMMessage>>(
    `/api/messages/threads/${threadId}/messages`,
    { token },
  );
}

export async function sendThreadMessage(
  token: string,
  threadId: number,
  messageText: string,
) {
  return apiFetch<ItemResponse<DMMessage>>(
    `/api/messages/threads/${threadId}/messages`,
    {
      token,
      method: "POST",
      body: { messageText },
    },
  );
}
