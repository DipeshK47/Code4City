export type AdminSummary = {
  totalVolunteers: number;
  activeAccounts: number;
  activeLast30Days: number;
  totalFlyers: number;
  totalHours: number;
  totalScans: number;
  totalSessions: number;
  totalDistanceMiles: number;
  averageSessionMiles: number;
  averageSessionMinutes: number;
  pendingRouteItems: number;
  qrCodesIssued: number;
  avgScansPerCode: number;
  totalHotspots: number;
  coveredHotspots: number;
  uncoveredHotspots: number;
  hotspotCoverageRate: number;
  mappedRegions: number;
  communityPosts: number;
  postComments: number;
  meetups: number;
  activeMeetups: number;
  meetupMembers: number;
  meetupMessages: number;
};

export type AdminVolunteer = {
  id: number;
  displayName: string;
  username: string;
  email: string;
  flyers: number;
  hours: number;
  scans: number;
  sessions: number;
  distanceMiles: number;
  stopsLogged: number;
};

export type AdminRecentSession = {
  id: number;
  volunteerName: string;
  username: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceMiles: number;
  routePoints: number;
  stops: number;
  status: string;
};

export type AdminDailyProgress = {
  day: string;
  flyers: number;
  hours: number;
  sessions: number;
  distanceMiles: number;
  signups: number;
};

export type AdminNeedRegion = {
  regionCode: string;
  regionName: string;
  boroughName: string | null;
  foodInsecurePercentage: number;
  foodNeedScore: number;
  totalHotspots: number;
  coveredHotspots: number;
  uncoveredHotspots: number;
  coverageRate: number;
};

export type AdminHotspotCategory = {
  category: string;
  totalSpots: number;
  coveredSpots: number;
  uncoveredSpots: number;
};

export type AdminOverview = {
  generatedAt: string;
  summary: AdminSummary;
  topVolunteers: AdminVolunteer[];
  recentSessions: AdminRecentSession[];
  dailyProgress: AdminDailyProgress[];
  needRegions: AdminNeedRegion[];
  hotspotCategories: AdminHotspotCategory[];
};
