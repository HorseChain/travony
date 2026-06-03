import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { useAuth } from "@/hooks/useAuth";
import {
  ensureNotificationsSetup,
  presentLocalNotification,
} from "@/lib/notifications";

interface PendingRide {
  id: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  estimatedFare?: string;
}

/**
 * App-wide driver alerting. Mounted once inside the driver navigator so a driver
 * is notified about new ride requests no matter which tab/screen they are on
 * (not only the Home screen). When online, it polls pending rides and fires an
 * in-app notification + sound + haptics for each newly-seen request.
 *
 * Renders nothing — it only runs side effects.
 */
export function useDriverRideNotifications() {
  const { user } = useAuth();

  const { data: driverData } = useQuery<{ is_online?: boolean }>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });
  const isOnline = driverData?.is_online === true;

  const { data: pendingRides, dataUpdatedAt } = useQuery<PendingRide[]>({
    queryKey: ["/api/drivers/pending-rides"],
    enabled: isOnline,
    refetchInterval: isOnline ? 5000 : false,
  });

  const seenIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const wasOnline = useRef(false);
  const onlineSince = useRef(0);

  useEffect(() => {
    ensureNotificationsSetup();
  }, []);

  // Reset alert state on every online/offline transition. Record when we went
  // online so we can ignore stale cached pending-rides from a previous session.
  useEffect(() => {
    if (isOnline !== wasOnline.current) {
      primed.current = false;
      seenIds.current.clear();
      if (isOnline) onlineSince.current = Date.now();
      wasOnline.current = isOnline;
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || !pendingRides) return;
    // Ignore data fetched before we came online (React Query may hand back a
    // stale cache instantly, which would alert for rides that are long gone).
    if (dataUpdatedAt < onlineSince.current) return;

    const notify = (ride: PendingRide) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      }
      const route = `${ride.pickupAddress || "Pickup"} → ${
        ride.dropoffAddress || "Drop-off"
      }`;
      const fare = ride.estimatedFare ? ` · AED ${ride.estimatedFare}` : "";
      presentLocalNotification("New ride request", `${route}${fare}`, {
        type: "ride_request",
        rideId: ride.id,
      });
    };

    // First load after going online: don't notify for the whole backlog one by
    // one. Mark everything as seen, but give a single alert if requests already
    // exist so the driver knows to look.
    if (!primed.current) {
      primed.current = true;
      pendingRides.forEach((r) => seenIds.current.add(r.id));
      if (pendingRides.length > 0) notify(pendingRides[0]);
      return;
    }

    const fresh = pendingRides.filter((r) => !seenIds.current.has(r.id));
    fresh.forEach((r) => seenIds.current.add(r.id));
    fresh.forEach(notify);
  }, [pendingRides, dataUpdatedAt, isOnline]);
}
