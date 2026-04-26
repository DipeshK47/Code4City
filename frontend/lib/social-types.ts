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

export type CoordinatorAssignmentStop = {
  id: string;
  name: string;
  category: string;
  address?: string | null;
  lat: number;
  lng: number;
  regionCode?: string | null;
  regionName?: string | null;
  regionNeedScore?: number | null;
  covered?: boolean;
  lastProofAt?: string | null;
  direction?: string;
  distanceMiles?: number;
};

export type CoordinatorAssignment = {
  userId: string;
  username: string;
  direction: string;
  focusCategory: string;
  roleTitle: string;
  task: string;
  assignedStops?: CoordinatorAssignmentStop[];
};

export type MeetupMessage = {
  id: number;
  meetupId: number;
  userId: number | null;
  messageText: string;
  createdAt: string;
  updatedAt: string;
  sender: UserSummary | null;
  isCoordinator?: boolean;
  assignments?: CoordinatorAssignment[] | null;
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
