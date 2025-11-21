"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getFriendStatus, sendFriendRequest, acceptFriend, cancelFriendRequest, removeFriend } from "../repos/friendRepo";
import { translateError } from "../errors";

export type FriendState = "none" | "sent" | "received" | "accepted";

interface Options {
  viewerUid?: string | null;
  profileUid?: string;
}

export function useFriendship({ viewerUid, profileUid }: Options) {
  const [state, setState] = useState<FriendState>("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!viewerUid || !profileUid || viewerUid === profileUid) {
        setState("none");
        return;
      }
      setLoading(true);
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
        send: async () => {},
        cancel: async () => {},
        accept: async () => {},
        remove: async () => {},
      };
    }
    return {
      send: async () => {
        setLoading(true);
        setError(null);
        try {
          await sendFriendRequest(viewerUid, profileUid);
          setState("sent");
        } catch (e) {
          setError(translateError(e));
        } finally {
          setLoading(false);
        }
      },
      cancel: async () => {
        setLoading(true);
        setError(null);
        try {
          await cancelFriendRequest(viewerUid, profileUid);
          setState("none");
        } catch (e) {
          setError(translateError(e));
        } finally {
          setLoading(false);
        }
      },
      accept: async () => {
        setLoading(true);
        setError(null);
        try {
          await acceptFriend(profileUid, viewerUid);
          setState("accepted");
        } catch (e) {
          setError(translateError(e));
        } finally {
          setLoading(false);
        }
      },
      remove: async () => {
        setLoading(true);
        setError(null);
        try {
          await removeFriend(viewerUid, profileUid);
          setState("none");
        } catch (e) {
          setError(translateError(e));
        } finally {
          setLoading(false);
        }
      },
    };
  }, [viewerUid, profileUid]);

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
