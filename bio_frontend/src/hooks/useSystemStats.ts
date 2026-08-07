"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SystemStats, api } from "@/lib/api";

const POLL_INTERVAL_MS = 30000;

export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const isMounted = useRef(true);

  const fetchStats = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const response = await api.systemStats();
      if (isMounted.current && response.success && response.data) {
        setStats(response.data);
        setError(null);
        // Trigger subtle flash dot for 2 seconds
        setRefreshed(true);
        setTimeout(() => {
          if (isMounted.current) setRefreshed(false);
        }, 2000);
      }
    } catch (err) {
      if (isMounted.current) {
        const msg = err instanceof Error ? err.message : "Failed to load system stats";
        setError(msg);
      }
    } finally {
      if (isMounted.current && !isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchStats();

    const interval = setInterval(() => {
      fetchStats(true);
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      fetchStats(true);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refreshed,
    refetch: fetchStats,
  };
}
