import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useToast } from "./useToast";
import { getErrorMessage } from "../utils/errors";

/**
 * Keeps exactly one live Firestore listener per requested user ID.
 * Listeners are added/removed as the ID set changes and all are released on unmount.
 */
export function useUserProfiles(uids) {
  const toast = useToast();
  const [profiles, setProfiles] = useState({});
  const unsubsRef = useRef(new Map());
  const errorShownRef = useRef(false);

  const key = [...new Set(uids)].filter(Boolean).sort().join("|");

  useEffect(() => {
    const unsubs = unsubsRef.current;
    const wanted = new Set(key ? key.split("|") : []);

    unsubs.forEach((unsubscribe, uid) => {
      if (!wanted.has(uid)) {
        unsubscribe();
        unsubs.delete(uid);
      }
    });

    wanted.forEach((uid) => {
      if (unsubs.has(uid)) return;
      const unsubscribe = onSnapshot(
        doc(db, "users", uid),
        (snap) => {
          setProfiles((prev) => ({ ...prev, [uid]: snap.data() ?? {} }));
        },
        (err) => {
          if (errorShownRef.current) return;
          errorShownRef.current = true;
          toast.error(getErrorMessage(err, "Couldn't load some user profiles."));
        }
      );
      unsubs.set(uid, unsubscribe);
    });
  }, [key, toast]);

  useEffect(() => {
    const unsubs = unsubsRef.current;
    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      unsubs.clear();
    };
  }, []);

  return profiles;
}
