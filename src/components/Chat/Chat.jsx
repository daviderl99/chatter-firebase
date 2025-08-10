import { useEffect, useState, useRef } from "react";
import { db } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import styles from "./Chat.module.scss";
import ChatInput from "../ChatInput/ChatInput";

export default function Chat({ user, roomId }) {
  const [messages, setMessages] = useState([]);
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

  useEffect(() => {
    if (!roomId) return;

    // Get current room messages and order by timestamp ascending
    const q = query(
      collection(db, `chatRooms/${roomId}/messages`),
      orderBy("timestamp")
    );

    // Listen for live message updates; returns unsubscribe function
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    // Keep the scroll pinned to the latest message whenever the list updates
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  return (
    <div className={styles.chat_container}>
      <div className={styles.messages}>
        {messages.map((msg, i) => {
          const prev = messages[i - 1];

          // Check if sender changed or time diff > 1 min (60000ms)
          const showMeta =
            !prev ||
            msg.uid !== prev.uid ||
            (msg.timestamp?.toMillis
              ? msg.timestamp.toMillis()
              : msg.timestamp) -
              (prev.timestamp?.toMillis
                ? prev.timestamp.toMillis()
                : prev.timestamp) >
              60000;

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
                      <span className={styles.username}>{msg.displayName}</span>
                      <img className={styles.avatar} src={msg.photoURL} alt={msg.displayName} />
                    </>
                  ) : (
                    <>
                      <img className={styles.avatar} src={msg.photoURL} alt={msg.displayName} />
                      <span className={styles.username}>{msg.displayName}</span>
                    </>
                  )}
                </div>
              )}
              {expandedMsgId === msg.id && (
                <div className={styles.timestamp}>{formatTimestamp(msg.timestamp)}</div>
              )}
              <div>
                {msg.imageUrl && (
                  <img
                    className={styles.image}
                    src={msg.imageUrl}
                    alt="sent"
                    onClick={() =>
                      setExpandedMsgId((prevId) => (prevId === msg.id ? null : msg.id))
                    }
                  />
                )}
                {msg.text && (
                  <p
                    onClick={() =>
                      setExpandedMsgId((prevId) => (prevId === msg.id ? null : msg.id))
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
      </div>
      <ChatInput user={user} roomId={roomId} />
    </div>
  );
}
