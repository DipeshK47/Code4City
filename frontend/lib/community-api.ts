import { apiFetch } from "./api-client";
import type { CommunityComment, CommunityPost } from "./social-types";

type ListResponse<T> = {
  success: boolean;
  count: number;
  data: T[];
};

type ItemResponse<T> = {
  success: boolean;
  data: T;
};

export async function getCommunityPosts(token?: string | null) {
  return apiFetch<ListResponse<CommunityPost>>("/api/community/posts", { token });
}

export async function createCommunityPost(
  token: string,
  input: { title: string; body: string; meetupId?: number | null },
) {
  return apiFetch<ItemResponse<CommunityPost>>("/api/community/posts", {
    token,
    method: "POST",
    body: input,
  });
}

export async function updateCommunityPost(
  token: string,
  postId: number,
  input: { title: string; body: string },
) {
  return apiFetch<ItemResponse<CommunityPost>>(`/api/community/posts/${postId}`, {
    token,
    method: "PATCH",
    body: input,
  });
}

export async function deleteCommunityPost(token: string, postId: number) {
  return apiFetch<{ success: boolean }>(`/api/community/posts/${postId}`, {
    token,
    method: "DELETE",
  });
}

export async function likeCommunityPost(token: string, postId: number) {
  return apiFetch<ItemResponse<CommunityPost>>(`/api/community/posts/${postId}/like`, {
    token,
    method: "POST",
  });
}

export async function unlikeCommunityPost(token: string, postId: number) {
  return apiFetch<ItemResponse<CommunityPost>>(`/api/community/posts/${postId}/like`, {
    token,
    method: "DELETE",
  });
}

export async function getPostComments(postId: number, token?: string | null) {
  return apiFetch<ListResponse<CommunityComment>>(
    `/api/community/posts/${postId}/comments`,
    { token },
  );
}

export async function createPostComment(
  token: string,
  postId: number,
  body: string,
) {
  return apiFetch<ListResponse<CommunityComment>>(
    `/api/community/posts/${postId}/comments`,
    {
      token,
      method: "POST",
      body: { body },
    },
  );
}

export async function createCommentReply(
  token: string,
  commentId: number,
  body: string,
) {
  return apiFetch<ListResponse<CommunityComment>>(
    `/api/community/comments/${commentId}/replies`,
    {
      token,
      method: "POST",
      body: { body },
    },
  );
}

export async function deletePostComment(token: string, commentId: number) {
  return apiFetch<ListResponse<CommunityComment>>(
    `/api/community/comments/${commentId}`,
    {
      token,
      method: "DELETE",
    },
  );
}
