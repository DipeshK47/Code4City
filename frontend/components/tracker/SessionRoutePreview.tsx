"use client";

import { useMemo } from "react";
import TrackerMap from "@/components/tracker/TrackerMap";
import { normalizeVolunteerSession } from "@/lib/tracker-route";
import type { VolunteerSession } from "@/types/tracker";

export default function SessionRoutePreview({
  session,
  height = 280,
}: {
  session: VolunteerSession;
  height?: number | string;
}) {
  const normalizedSession = useMemo(
    () => normalizeVolunteerSession(session),
    [session],
  );

  return (
    <TrackerMap
      routePoints={normalizedSession.routePoints}
      currentPoint={null}
      stops={normalizedSession.stops}
      height={height}
    />
  );
}
