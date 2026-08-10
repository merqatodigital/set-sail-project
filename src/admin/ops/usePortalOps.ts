import { useCallback, useEffect, useRef, useState } from "react";
import {
  listPortalTourRequests,
  listPortalRentalRequests,
  listPortalBookingRequests,
  listPortalFoodOrders,
  listPortalGuestMessages,
  listPortalFolioLines,
} from "@/lib/portalAdminRepo";
import type {
  PortalBookingRequestRow,
  PortalTourRequestRow,
  PortalRentalRequestRow,
  PortalFoodOrderRow,
  PortalGuestMessageRow,
  PortalFolioLineRow,
} from "@/lib/portalRepo";

export interface PortalOps {
  tours: PortalTourRequestRow[];
  rentals: PortalRentalRequestRow[];
  bookings: PortalBookingRequestRow[];
  food: PortalFoodOrderRow[];
  messages: PortalGuestMessageRow[];
  folio: PortalFolioLineRow[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: Omit<PortalOps, "loading" | "refresh"> = {
  tours: [],
  rentals: [],
  bookings: [],
  food: [],
  messages: [],
  folio: [],
};

/**
 * Loads the guest operational tables (the same rows the Guest Portal creates
 * and TALA reads). Admin pages call `refresh()` after any write. Until David
 * applies supabase/migrations/20260810_guest_portal_persistence.sql the lists
 * resolve to [] because the tables/policies don't exist yet — the UI degrades
 * gracefully instead of crashing.
 */
export function usePortalOps() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [tours, rentals, bookings, food, messages, folio] = await Promise.all([
      listPortalTourRequests(),
      listPortalRentalRequests(),
      listPortalBookingRequests(),
      listPortalFoodOrders(),
      listPortalGuestMessages(),
      listPortalFolioLines(),
    ]);
    if (mounted.current) {
      setData({ tours, rentals, bookings, food, messages, folio });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { ...data, loading, refresh };
}
