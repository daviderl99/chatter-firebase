import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  FieldPath,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "../../firebase";
import { useToast } from "../../hooks/useToast";
import { useUserProfiles } from "../../hooks/useUserProfiles";
import { getErrorMessage } from "../../utils/errors";
import { compressImage } from "../../utils/compressImage";
import { deleteRoomCascade } from "../../utils/roomActions";
import Avatar from "../Avatar/Avatar";
import styles from "./Chat.module.scss";
import ChatInput from "../ChatInput/ChatInput";
import TypingIndicator from "../TypingIndicator/TypingIndicator";
import Message from "../Message/Message";
import Lightbox from "../Lightbox/Lightbox";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import RoomSettings from "../RoomSettings/RoomSettings";
import SettingsIcon from "../icons/SettingsIcon";

const PAGE_SIZE = 30;
const GROUP_GAP_MS = 60_000;
const NEAR_BOTTOM_PX = 120;
const LOAD_MORE_THRESHOLD_PX = 120;

const toMillis = (ts) => ts?.toMillis?.() ?? Date.now();

export default function Chat({ user, roomId, onRoomClosed }) {
  const toast = useToast();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [limitCount, setLimitCount] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUids, setTypingUids] = useState([]);
  const [expandedMsgId, setExpandedMsgId] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);
  const firstMessageIdRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  // Set while leaving/deleting so the resulting permission errors aren't shown
  const closingRef = useRef(false);
  const onRoomClosedRef = useRef(onRoomClosed);

  useEffect(() => {
    onRoomClosedRef.current = onRoomClosed;
  });

  const closeRoom = useCallback(() => {
    closingRef.current = true;
    onRoomClosedRef.current?.();
  }, []);

  const reportError = useCallback(
    (err, fallback) => {
      if (closingRef.current) return;
      toast.error(getErrorMessage(err, fallback));
    },
    [toast]
  );

  // Room document: name, members and owner
  useEffect(() => {
    return onSnapshot(
      doc(db, "chatRooms", roomId),
      (snap) => {
        if (closingRef.current) return;
        const data = snap.data();
        const isMember = data?.members?.includes(user.uid);
        if (!snap.exists() || !isMember) {
          if (snap.metadata.fromCache) return;
          toast.info(
            snap.exists()
              ? "You were removed from this room."
              : "This room was deleted."
          );
          closeRoom();
          return;
        }
        setRoom({
          id: snap.id,
          name: data.name,
          photoURL: data.photoURL ?? "",
          members: data.members,
          createdBy: data.createdBy ?? null,
        });
      },
      (err) => reportError(err, "Couldn't load the room.")
    );
  }, [roomId, user.uid, toast, closeRoom, reportError]);

  // Latest `limitCount` messages; the limit grows as the user scrolls up
  useEffect(() => {
    const q = query(
      collection(db, `chatRooms/${roomId}/messages`),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    return onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs
            .map((d) => ({
              id: d.id,
              ...d.data({ serverTimestamps: "estimate" }),
            }))
            .reverse()
        );
        setLoaded(true);
        if (!snap.metadata.fromCache) {
          setHasMore(snap.size >= limitCount);
          setLoadingMore(false);
        }
      },
      (err) => reportError(err, "Couldn't load messages.")
    );
  }, [roomId, limitCount, reportError]);

  // Typing status of other members
  useEffect(() => {
    return onSnapshot(
      collection(db, `chatRooms/${roomId}/typing`),
      (snap) => {
        setTypingUids(
          snap.docs
            .filter((d) => d.id !== user.uid && d.data().isTyping)
            .map((d) => d.id)
        );
      },
      (err) => reportError(err, "Couldn't load typing status.")
    );
  }, [roomId, user.uid, reportError]);

  const profiles = useUserProfiles([
    ...messages.map((m) => m.uid),
    ...messages.flatMap((m) => Object.values(m.reactions ?? {}).flat()),
    ...(room?.members ?? []),
    ...typingUids,
  ]);

  const loadMore = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    scrollAnchorRef.current = el.scrollHeight;
    setLoadingMore(true);
    setLimitCount((count) => count + PAGE_SIZE);
  }, [loadingMore, hasMore]);

  // Keep the viewport stable when older messages are prepended, and follow new ones
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const firstId = messages[0]?.id ?? null;
    if (scrollAnchorRef.current !== null) {
      const prepended = firstId !== firstMessageIdRef.current;
      if (prepended) {
        el.scrollTop += el.scrollHeight - scrollAnchorRef.current;
      }
      if (prepended || !loadingMore) scrollAnchorRef.current = null;
    }
    firstMessageIdRef.current = firstId;

    const last = messages[messages.length - 1];
    if (last && last.id !== lastMessageIdRef.current) {
      const initial = lastMessageIdRef.current === null;
      if (initial || stickToBottomRef.current || last.uid === user.uid) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: initial ? "auto" : "smooth",
        });
      }
    }
    lastMessageIdRef.current = last?.id ?? null;
  }, [messages, loadingMore, user.uid]);

  // If the loaded messages don't fill the viewport there is nothing to scroll, so load more
  useEffect(() => {
    const el = scrollRef.current;
    if (el && hasMore && !loadingMore && messages.length > 0) {
      if (el.scrollHeight <= el.clientHeight + 1) loadMore();
    }
  }, [messages, hasMore, loadingMore, loadMore]);

  const handleScroll = () => {
    const el = scrollRef.current;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (el.scrollTop < LOAD_MORE_THRESHOLD_PX) loadMore();
  };

  const handleImageLoad = () => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  };

  const messageRef = (id) => doc(db, `chatRooms/${roomId}/messages`, id);

  const handleReact = async (msg, emoji) => {
    const active = msg.reactions?.[emoji]?.includes(user.uid);
    try {
      await updateDoc(
        messageRef(msg.id),
        new FieldPath("reactions", emoji),
        active ? arrayRemove(user.uid) : arrayUnion(user.uid)
      );
    } catch (err) {
      reportError(err, "Couldn't update your reaction.");
    }
  };

  const handleSaveEdit = async (msg, text) => {
    const trimmed = text.trim();
    if (trimmed === (msg.text || "")) {
      setEditingMsgId(null);
      return;
    }
    if (!trimmed && !(msg.messageImageUrl || msg.imageUrl)) {
      toast.error("A message can't be empty. Delete it instead.");
      return;
    }
    try {
      await updateDoc(messageRef(msg.id), {
        text: trimmed,
        editedAt: serverTimestamp(),
      });
      setEditingMsgId(null);
    } catch (err) {
      reportError(err, "Couldn't save your edit.");
    }
  };

  const handleConfirmDelete = async () => {
    const msg = pendingDelete;
    if (!msg) return;
    setDeleting(true);
    try {
      await deleteDoc(messageRef(msg.id));
      const imageUrl = msg.messageImageUrl || msg.imageUrl;
      if (imageUrl) deleteObject(storageRef(storage, imageUrl)).catch(() => {});
      setPendingDelete(null);
    } catch (err) {
      reportError(err, "Couldn't delete the message.");
    } finally {
      setDeleting(false);
    }
  };

  const handleLeaveRoom = async () => {
    closingRef.current = true;
    try {
      // Best effort: clear our typing flag while we can still write to the room
      await deleteDoc(doc(db, `chatRooms/${roomId}/typing`, user.uid)).catch(
        () => {}
      );
      await updateDoc(doc(db, "chatRooms", roomId), {
        members: arrayRemove(user.uid),
      });
      toast.success(`You left ${room?.name ?? "the room"}.`);
      closeRoom();
      return true;
    } catch (err) {
      closingRef.current = false;
      toast.error(getErrorMessage(err, "Couldn't leave the room."));
      return false;
    }
  };

  const handleDeleteRoom = async () => {
    closingRef.current = true;
    try {
      await deleteRoomCascade(roomId, room?.photoURL);
      toast.success("Room deleted.");
      closeRoom();
      return true;
    } catch (err) {
      closingRef.current = false;
      toast.error(getErrorMessage(err, "Couldn't delete the room."));
      return false;
    }
  };

  const handleRemoveMember = async (uid) => {
    try {
      await updateDoc(doc(db, "chatRooms", roomId), {
        members: arrayRemove(uid),
      });
      deleteDoc(doc(db, `chatRooms/${roomId}/typing`, uid)).catch(() => {});
      toast.success("Member removed.");
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't remove that member."));
      return false;
    }
  };

  // changes: { name?: string, imageFile?: File, removeImage?: boolean }
  const handleSaveRoom = async ({ name, imageFile, removeImage }) => {
    try {
      const updates = {};
      if (name && name !== room.name) {
        const existing = await getDocs(
          query(collection(db, "chatRooms"), where("name", "==", name))
        );
        if (existing.docs.some((d) => d.id !== roomId)) {
          toast.error("A room with that name already exists.");
          return false;
        }
        updates.name = name;
      }

      const oldPhoto = room.photoURL;
      if (imageFile) {
        const compressed = await compressImage(imageFile, {
          maxWidth: 400,
          maxHeight: 400,
        });
        const fileRef = storageRef(
          storage,
          `roomImages/${roomId}/${Date.now()}`
        );
        await uploadBytes(fileRef, compressed);
        updates.photoURL = await getDownloadURL(fileRef);
      } else if (removeImage && oldPhoto) {
        updates.photoURL = "";
      }

      if (Object.keys(updates).length === 0) return true;
      await updateDoc(doc(db, "chatRooms", roomId), updates);
      if ("photoURL" in updates && oldPhoto) {
        deleteObject(storageRef(storage, oldPhoto)).catch(() => {});
      }
      toast.success("Room updated.");
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the room."));
      return false;
    }
  };

  const memberCount = room?.members?.length ?? 0;

  return (
    <div className={styles.chat_container}>
      <header className={styles.header}>
        <Avatar
          className={styles.roomAvatar}
          src={room?.photoURL}
          name={room?.name}
        />
        <div className={styles.headerInfo}>
          <h2 className={styles.roomName}>{room?.name ?? "Loading..."}</h2>
          {room && (
            <span className={styles.memberCount}>
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.headerButton}
          onClick={() => setSettingsOpen(true)}
          aria-label="Room settings"
          title="Room settings"
          disabled={!room}
        >
          <SettingsIcon />
        </button>
      </header>

      <div className={styles.messages} ref={scrollRef} onScroll={handleScroll}>
        {loadingMore && (
          <div className={styles.status}>Loading older messages...</div>
        )}
        {loaded && !hasMore && messages.length > 0 && (
          <div className={styles.status}>Beginning of the conversation</div>
        )}
        {loaded && messages.length === 0 && (
          <div className={styles.empty}>No messages yet. Say hello!</div>
        )}

        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showMeta =
            !prev ||
            msg.uid !== prev.uid ||
            toMillis(msg.timestamp) - toMillis(prev.timestamp) > GROUP_GAP_MS;
          const isOwn = msg.uid === user.uid;

          return (
            <Message
              key={msg.id}
              msg={msg}
              isOwn={isOwn}
              showMeta={showMeta}
              sender={profiles[msg.uid] ?? {}}
              profiles={profiles}
              currentUid={user.uid}
              canDelete={isOwn}
              expanded={expandedMsgId === msg.id}
              editing={editingMsgId === msg.id}
              onToggleExpanded={() =>
                setExpandedMsgId((id) => (id === msg.id ? null : msg.id))
              }
              onStartEdit={() => setEditingMsgId(msg.id)}
              onCancelEdit={() => setEditingMsgId(null)}
              onSaveEdit={handleSaveEdit}
              onRequestDelete={setPendingDelete}
              onReact={handleReact}
              onOpenImage={setLightboxSrc}
              onImageLoad={handleImageLoad}
            />
          );
        })}

        {typingUids.map((uid) => (
          <TypingIndicator
            key={uid}
            profileImage={profiles[uid]?.photoURL}
            isTyping
            username={profiles[uid]?.displayName || "User"}
          />
        ))}
      </div>

      <ChatInput user={user} roomId={roomId} />

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this message?"
        message="This can't be undone."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      <RoomSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        room={room}
        profiles={profiles}
        currentUid={user.uid}
        onLeave={handleLeaveRoom}
        onDelete={handleDeleteRoom}
        onRemoveMember={handleRemoveMember}
        onSave={handleSaveRoom}
      />
    </div>
  );
}
