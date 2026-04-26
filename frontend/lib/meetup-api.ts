import { apiFetch } from "./api-client";
import type { MeetupMessage, MeetupSummary } from "./social-types";

type ListResponse<T> = {
  success: boolean;
  count: number;
  data: T[];
};

type ItemResponse<T> = {
  success: boolean;
  data: T;
};

export type CreateMeetupInput = {
  title: string;
  description: string;
  locationLabel: string;
  lat: number;
  lng: number;
  startTime: string;
  endTime?: string;
  maxAttendees?: number | null;
  autoCreatePost?: boolean;
  postTitle?: string;
  postBody?: string;
};

export async function getMeetups(token?: string | null, includePast = false) {
  return apiFetch<ListResponse<MeetupSummary>>(
    `/api/meetups?includePast=${includePast ? "true" : "false"}`,
    { token },
  );
}

export async function getMeetupById(meetupId: number, token?: string | null) {
  return apiFetch<ItemResponse<MeetupSummary>>(`/api/meetups/${meetupId}`, { token });
}

export async function createMeetup(token: string, input: CreateMeetupInput) {
  return apiFetch<ItemResponse<MeetupSummary>>("/api/meetups", {
    token,
    method: "POST",
    body: input,
  });
}

export async function updateMeetup(
  token: string,
  meetupId: number,
  input: Partial<CreateMeetupInput> & { status?: string },
) {
  return apiFetch<ItemResponse<MeetupSummary>>(`/api/meetups/${meetupId}`, {
    token,
    method: "PATCH",
    body: input,
  });
}

export async function cancelMeetup(token: string, meetupId: number) {
  return apiFetch<{ success: boolean }>(`/api/meetups/${meetupId}`, {
    token,
    method: "DELETE",
  });
}

export async function joinMeetup(token: string, meetupId: number) {
  return apiFetch<ItemResponse<MeetupSummary>>(`/api/meetups/${meetupId}/join`, {
    token,
    method: "POST",
  });
}

export async function leaveMeetup(token: string, meetupId: number) {
  return apiFetch<ItemResponse<MeetupSummary>>(`/api/meetups/${meetupId}/leave`, {
    token,
    method: "POST",
  });
}

export async function getMeetupMessages(token: string, meetupId: number) {
  return apiFetch<ListResponse<MeetupMessage>>(`/api/meetups/${meetupId}/messages`, {
    token,
  });
}

export async function sendMeetupMessage(
  token: string,
  meetupId: number,
  messageText: string,
) {
  return apiFetch<ItemResponse<MeetupMessage>>(`/api/meetups/${meetupId}/messages`, {
    token,
    method: "POST",
    body: { messageText },
  });
}
