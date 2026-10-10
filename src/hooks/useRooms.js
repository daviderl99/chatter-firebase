import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useToast } from "./useToast";
import { getErrorMessage } from "../utils/errors";

// How many recent messages per room are inspected to compute the unread badge
const ACTIVITY_WINDOW = 10;
export const MAX_UNREAD_DISPLAY = 9;

const toMillis = (ts) => ts?.toMillis?.() ?? 0;

const localKey = (uid) => `chatter:roomReads:${uid}`;

function loadLocalReads(uid) {
  try {
    return JSON.parse(localStorage.getItem(localKey(uid)) || "{}");
  } catch {
    return {};
  }
}

function saveLocalReads(uid, reads) {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(reads));
  } catch {
    // Storage may be unavailable (private mode / quota); the Firestore marker still applies
  }
}

/**
 * Rooms the user belongs to, each with its latest message and unread count.
 *
 * "Read" markers live in users/{uid}/roomReads (synced across devices) and are
 * mirrored locally, so a badge clears immediately and survives a failed sync.
 * Markers hold message timestamps, so they are never compared with the local clock.
 */
export function useRooms(uid) {
  const toast = useToast();
  const [roomDocs, setRoomDocs] = useState([]);
  const [activity, setActivity] = useState({});
  const [remoteReads, setRemoteReads] = useState({});
  const [localReads, setLocalReads] = useState(() => loadLocalReads(uid));

  useEffect(() => {
    if (!uid) return;
    const roomsQuery = query(
      collection(db, "chatRooms"),
      where("members", "array-contains", uid)
    );
    return onSnapshot(
      roomsQuery,
      (snap) => {
        setRoomDocs(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name,
              photoURL: data.photoURL ?? "",
              members: data.members ?? [],
              createdBy: data.createdBy ?? null,
            };
          })
        );
      },
      (err) => toast.error(getErrorMessage(err, "Couldn't load your rooms."))
    );
  }, [uid, toast]);

  const roomKey = roomDocs
    .map((r) => r.id)
    .sort()
    .join("|");

  useEffect(() => {
    if (!roomKey) return;
    const unsubs = roomKey.split("|").map((id) =>
      onSnapshot(
        query(
          collection(db, `chatRooms/${id}/messages`),
          orderBy("timestamp", "desc"),
          limit(ACTIVITY_WINDOW)
        ),
        (snap) => {
          const messages = snap.docs.map((d) =>
            d.data({ serverTimestamps: "estimate" })
          );
          const latest = messages[0];
          setActivity((prev) => ({
            ...prev,
            [id]: {
              latestText: latest?.text || "",
              latestHasImage: Boolean(latest?.messageImageUrl || latest?.imageUrl),
              latestTimestamp: toMillis(latest?.timestamp),
              incoming: messages
                .filter((m) => m.uid !== uid)
                .map((m) => toMillis(m.timestamp)),
            },
          }));
        },
        (err) =>
          toast.error(getErrorMessage(err, "Couldn't load recent messages."))
      )
    );
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [roomKey, uid, toast]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      collection(db, "users", uid, "roomReads"),
      (snap) => {
        const next = {};
        snap.forEach((d) => {
          next[d.id] = toMillis(
            d.data({ serverTimestamps: "estimate" }).lastReadAt
          );
        });
        setRemoteReads(next);
      },
      // Non-critical: unread state still works locally, so don't interrupt the user
      (err) => console.warn("Couldn't read unread markers:", err)
    );
  }, [uid]);

  const reads = useMemo(() => {
    const merged = { ...remoteReads };
    Object.entries(localReads).forEach(([roomId, ms]) => {
      merged[roomId] = Math.max(merged[roomId] ?? 0, ms);
    });
    return merged;
  }, [remoteReads, localReads]);

  /** Marks everything up to `upTo` (a message timestamp in ms) as read. */
  const markRead = useCallback(
    (roomId, upTo) => {
      setLocalReads((prev) => {
        if ((prev[roomId] ?? 0) >= upTo) return prev;
        const next = { ...prev, [roomId]: upTo };
        saveLocalReads(uid, next);
        return next;
      });
      setDoc(doc(db, "users", uid, "roomReads", roomId), {
        lastReadAt: serverTimestamp(),
      }).catch((err) => console.warn("Couldn't sync unread marker:", err));
    },
    [uid]
  );

  const rooms = useMemo(
    () =>
      roomDocs
        .map((room) => {
          const a = activity[room.id];
          const lastRead = reads[room.id] ?? 0;
          return {
            ...room,
            latestMessage: a?.latestText ?? "",
            latestMessageImage: a?.latestHasImage ?? false,
            latestTimestamp: a?.latestTimestamp ?? 0,
            unread: a ? a.incoming.filter((ms) => ms > lastRead).length : 0,
          };
        })
        .sort((x, y) => y.latestTimestamp - x.latestTimestamp),
    [roomDocs, activity, reads]
  );

  return { rooms, reads, markRead };
}
