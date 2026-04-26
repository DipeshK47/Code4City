export type UserSummary = {
  id: number;
  username: string;
  fullName?: string | null;
  profilePhotoUrl?: string | null;
};

export type MeetupSummary = {
  id: number;
  createdBy: number;
  title: string;
  description: string;
  locationLabel: string;
  lat: number;
  lng: number;
  startTime: string;
  endTime?: string | null;
  status: string;
  linkedPostId?: number | null;
  maxAttendees?: number | null;
  createdAt: string;
  updatedAt: string;
  joinedCount: number;
  viewerJoined: boolean;
  creator: UserSummary;
  linkedPost?: {
    id: number;
    title: string;
    body: string;
  } | null;
  members?: Array<
    UserSummary & {
      role: string;
      joinedAt: string;
    }
  >;
};

export type CommunityPost = {
  id: number;
  userId: number;
  title: string;
  body: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  viewerHasLiked: boolean;
  author: UserSummary;
  meetup?: MeetupSummary | null;
};

export type CommunityComment = {
  id: number;
  postId: number;
  userId: number;
  parentCommentId?: number | null;
  body?: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  author: UserSummary;
  replies: CommunityComment[];
};

export type MeetupMessage = {
  id: number;
  meetupId: number;
  userId: number;
  messageText: string;
  createdAt: string;
  updatedAt: string;
  sender: UserSummary;
};

export type DMThread = {
  id: number;
  createdAt: string;
  updatedAt: string;
  otherUser: UserSummary;
  lastMessageText?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
};

export type DMMessage = {
  id: number;
  threadId: number;
  senderUserId: number;
  messageText: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  sender: UserSummary;
};
