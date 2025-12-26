"use client";
import { useEffect, useMemo, useState } from "react";
import { isWatched, addWatch, removeWatch } from "../repos/watchRepo";
import { translateError } from "../errors";
import { useAsyncOperation } from "./useAsyncOperation";

interface Options {
  viewerUid?: string | null;
  profileUid?: string;
}

export function useWatch({ viewerUid, profileUid }: Options) {
  const [watching, setWatching] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ウォッチ追加・削除操作用
  const addOp = useAsyncOperation(addWatch);
  const removeOp = useAsyncOperation(removeWatch);

  const loading = loadingInitial || addOp.loading || removeOp.loading;

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!viewerUid || !profileUid || viewerUid === profileUid) {
        setWatching(false);
        return;
      }
      setLoadingInitial(true);
      setError(null);
      try {
        const flag = await isWatched(viewerUid, profileUid);
        if (!ignore) setWatching(flag);
      } catch (e) {
        if (!ignore) setError(translateError(e));
      } finally {
        if (!ignore) setLoadingInitial(false);
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
        setError(null);
        try {
          if (watching) {
            await removeOp.execute(viewerUid, profileUid);
            setWatching(false);
          } else {
            await addOp.execute(viewerUid, profileUid);
            setWatching(true);
          }
        } catch (e) {
          setError(translateError(e));
        }
      },
    };
  }, [viewerUid, profileUid, watching, addOp, removeOp]);

  return {
    watching,
    loading,
    error,
    toggle: actions.toggle,
  };
}
