import { useCallback, useEffect, useRef, useState } from "react";
import { loadOperationsSnapshot, EMPTY_OPERATIONS_SNAPSHOT, type OperationsSnapshot } from "@/lib/opsRepo";

/**
 * Operations data now lives in its own admin-only tables (see the
 * operations_tables migration) instead of the public-readable cms_data
 * blob, so it's no longer part of the reactive CmsContext. Each admin ops
 * page loads it here and calls `refresh()` after any write — every write
 * itself goes straight to Supabase via src/lib/opsRepo.ts, not through this
 * hook.
 */
export function useOperations() {
  const [data, setData] = useState<OperationsSnapshot>(EMPTY_OPERATIONS_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const snapshot = await loadOperationsSnapshot();
    if (mounted.current) {
      setData(snapshot);
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

  return { data, loading, refresh };
}
