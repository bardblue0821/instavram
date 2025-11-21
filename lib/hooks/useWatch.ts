"use client";
import { useEffect, useMemo, useState } from "react";
import { isWatched, addWatch, removeWatch } from "../repos/watchRepo";
import { translateError } from "../errors";

interface Options {
  viewerUid?: string | null;
  profileUid?: string;
}

export function useWatch({ viewerUid, profileUid }: Options) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!viewerUid || !profileUid || viewerUid === profileUid) {
        setWatching(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const flag = await isWatched(viewerUid, profileUid);
        if (!ignore) setWatching(flag);
      } catch (e) {
        if (!ignore) setError(translateError(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [viewerUid, profileUid]);

  const actions = useMemo(() => {
    if (!viewerUid || !profileUid || viewerUid === profileUid) {
      return {
        toggle: async () => {},
      };
    }
    return {
      toggle: async () => {
        setLoading(true);
        setError(null);
        try {
          if (watching) {
            await removeWatch(viewerUid, profileUid);
            setWatching(false);
          } else {
            await addWatch(viewerUid, profileUid);
            setWatching(true);
          }
        } catch (e) {
          setError(translateError(e));
        } finally {
          setLoading(false);
        }
      },
    };
  }, [viewerUid, profileUid, watching]);

  return {
    watching,
    loading,
    error,
    toggle: actions.toggle,
  };
}
