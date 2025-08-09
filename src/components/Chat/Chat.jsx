import { useEffect, useState, useRef } from "react";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import styles from "./Chat.module.scss";

export default function Chat({ user, roomId }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !roomId) return;

    setMessage(""); // clear input early to prevent double send

    // Add message to this room with server-side timestamp
    await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
      text: message,
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      timestamp: serverTimestamp(),
    });
  };

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
                      <img src={msg.photoURL} alt={msg.displayName} />
                    </>
                  ) : (
                    <>
                      <img src={msg.photoURL} alt={msg.displayName} />
                      <span className={styles.username}>{msg.displayName}</span>
                    </>
                  )}
                </div>
              )}
              <div>
                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className={styles.chat_input}>
        <input
          value={message}
          name="message-input"
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Type your message..."
          placeholder="Type your message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
