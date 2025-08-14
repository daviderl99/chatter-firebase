import { useEffect, useState, useRef } from "react";
import { db } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import styles from "./Chat.module.scss";
import ChatInput from "../ChatInput/ChatInput";
import TypingIndicator from "../TypingIndicator/TypingIndicator";

export default function Chat({ user, roomId }) {
  const [messages, setMessages] = useState([]);
  const [usersData, setUsersData] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const [expandedMsgId, setExpandedMsgId] = useState(null);

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const ms = ts?.toMillis ? ts.toMillis() : ts;
    if (!ms) return "";
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Listen for room messages
  useEffect(() => {
    if (!roomId) return;

    const q = query(
      collection(db, `chatRooms/${roomId}/messages`),
      orderBy("timestamp")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // Collect all unique UIDs from messages
      const uids = [...new Set(msgs.map((m) => m.uid))];

      // Subscribe to each user's profile in Firestore
      uids.forEach((uid) => {
        if (!usersData[uid]) {
          onSnapshot(doc(db, "users", uid), (snap) => {
            if (snap.exists()) {
              setUsersData((prev) => ({
                ...prev,
                [uid]: snap.data(),
              }));
            }
          });
        }
      });
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Listen for typing status in the room
  useEffect(() => {
    if (!roomId) return;
    // Listen to all typing status docs in the room except current user
    const typingRef = collection(db, `chatRooms/${roomId}/typing`);
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const typing = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (doc.id !== user.uid && data.isTyping) {
          typing.push({ uid: doc.id });
        }
      });
      setTypingUsers(typing);
    });
    return () => unsubscribe();
  }, [roomId, user.uid]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={styles.chat_container}>
      <div className={styles.messages}>
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const ONE_MINUTE = 60000;
          const getMillis = (ts) => (ts?.toMillis ? ts.toMillis() : ts);

          const showMeta =
            !prev ||
            msg.uid !== prev.uid ||
            getMillis(msg.timestamp) - getMillis(prev.timestamp) > ONE_MINUTE;

          const sender = usersData[msg.uid] || {};

          return (
            <div
              key={msg.id}
              className={`${styles.message} ${
                msg.uid === user.uid ? styles.own : ""
              }`}
            >
              {showMeta && (
                <div className={styles.meta}>
                  {msg.uid === user.uid ? (
                    <>
                      <span className={styles.username}>
                        {sender.displayName || "Unknown"}
                      </span>
                      <img
                        className={styles.avatar}
                        src={sender.photoURL || ""}
                        alt={sender.displayName || "User"}
                      />
                    </>
                  ) : (
                    <>
                      <img
                        className={styles.avatar}
                        src={sender.photoURL || ""}
                        alt={sender.displayName || "User"}
                      />
                      <span className={styles.username}>
                        {sender.displayName || "Unknown"}
                      </span>
                    </>
                  )}
                </div>
              )}
              {expandedMsgId === msg.id && (
                <div className={styles.timestamp}>
                  {formatTimestamp(msg.timestamp)}
                </div>
              )}
              <div>
                {msg.imageUrl && (
                  <img
                    className={styles.image}
                    src={msg.imageUrl}
                    alt="sent"
                    onClick={() =>
                      setExpandedMsgId((prevId) =>
                        prevId === msg.id ? null : msg.id
                      )
                    }
                  />
                )}
                {msg.text && (
                  <p
                    onClick={() =>
                      setExpandedMsgId((prevId) =>
                        prevId === msg.id ? null : msg.id
                      )
                    }
                  >
                    {msg.text}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        {/* Typing indicators for other users */}
        {typingUsers.map((typingUser) => {
          const sender = usersData[typingUser.uid] || {};
          return (
            <TypingIndicator
              key={typingUser.uid}
              profileImage={sender.photoURL || ""}
              isTyping={true}
              username={sender.displayName || "User"}
            />
          );
        })}
      </div>
      <ChatInput user={user} roomId={roomId} />
    </div>
  );
}
