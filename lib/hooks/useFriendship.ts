"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getFriendStatus, sendFriendRequest, acceptFriend, cancelFriendRequest, removeFriend } from "../repos/friendRepo";
import { translateError } from "../errors";
import { useAsyncOperation } from "./useAsyncOperation";

export type FriendState = "none" | "sent" | "received" | "accepted";

interface Options {
  viewerUid?: string | null;
  profileUid?: string;
}

export function useFriendship({ viewerUid, profileUid }: Options) {
  const [state, setState] = useState<FriendState>("none");
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 各操作用のuseAsyncOperationフック
  const sendOp = useAsyncOperation(sendFriendRequest);
  const cancelOp = useAsyncOperation(cancelFriendRequest);
  const acceptOp = useAsyncOperation(acceptFriend);
  const removeOp = useAsyncOperation(removeFriend);

  // いずれかの操作が実行中かどうか
  const loading = loadingInitial || sendOp.loading || cancelOp.loading || acceptOp.loading || removeOp.loading;

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!viewerUid || !profileUid || viewerUid === profileUid) {
        setState("none");
        return;
      }
      setLoadingInitial(true);
      setError(null);
      try {
        const [forward, backward] = await Promise.all([
          getFriendStatus(viewerUid, profileUid),
          getFriendStatus(profileUid, viewerUid),
        ]);
        if (ignore) return;
        if (forward === "accepted" || backward === "accepted") setState("accepted");
        else if (forward === "pending") setState("sent");
        else if (backward === "pending") setState("received");
        else setState("none");
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
        send: async () => {},
        cancel: async () => {},
        accept: async () => {},
        remove: async () => {},
      };
    }
    return {
      send: async () => {
        setError(null);
        try {
          await sendOp.execute(viewerUid, profileUid);
          setState("sent");
        } catch (e) {
          setError(translateError(e));
        }
      },
      cancel: async () => {
        setError(null);
        try {
          await cancelOp.execute(viewerUid, profileUid);
          setState("none");
        } catch (e) {
          setError(translateError(e));
        }
      },
      accept: async () => {
        setError(null);
        try {
          await acceptOp.execute(profileUid, viewerUid);
          setState("accepted");
        } catch (e) {
          setError(translateError(e));
        }
      },
      remove: async () => {
        setError(null);
        try {
          await removeOp.execute(viewerUid, profileUid);
          setState("none");
        } catch (e) {
          setError(translateError(e));
        }
      },
    };
  }, [viewerUid, profileUid, sendOp, cancelOp, acceptOp, removeOp]);

  return {
    state,
    loading,
    error,
    send: actions.send,
    cancel: actions.cancel,
    accept: actions.accept,
    remove: actions.remove,
  };
}
