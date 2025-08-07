import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";
import styles from "./RoomList.module.scss";
import Modal from "../Modal/Modal";

export default function RoomList({ user, onJoinRoom, selectedRoom }) {
  const [rooms, setRooms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const roomsQuery = query(collection(db, "chatRooms"));
    let messageUnsubs = [];
    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const roomDocs = snapshot.docs;
      let roomsArr = roomDocs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          password: data.password || null,
          latestMessage: null,
          latestTimestamp: null,
        };
      });
      // Remove previous listeners
      messageUnsubs.forEach((unsub) => unsub());
      messageUnsubs = [];
      // Attach a listener to each room's latest message
      roomsArr.forEach((room, idx) => {
        const msgQuery = query(
          collection(db, `chatRooms/${room.id}/messages`),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const unsubMsg = onSnapshot(msgQuery, (msgSnap) => {
          const msgDoc = msgSnap.docs[0];
          roomsArr[idx] = {
            ...roomsArr[idx],
            latestMessage: msgDoc?.data()?.text || "",
            latestTimestamp: msgDoc?.data()?.timestamp?.toMillis?.() || 0,
          };
          // Sort by latestTimestamp desc
          setRooms([...roomsArr].sort((a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0)));
        });
        messageUnsubs.push(unsubMsg);
      });
      // Initial sort (all timestamps might be null)
      setRooms([...roomsArr].sort((a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0)));
    });
    return () => {
      unsubRooms();
      messageUnsubs.forEach((unsub) => unsub());
    };
  }, []);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    await addDoc(collection(db, "chatRooms"), {
      name: name.trim(),
      password: password || null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });

    setName("");
    setPassword("");
    setModalOpen(false);
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <h2>Chats</h2>
        <button onClick={() => setModalOpen(true)} className={styles.addRoomBtn}>
          +
        </button>
      </div>
      <ul className={styles.roomList}>
        {rooms.map((room) => (
          <li
            key={room.id}
            className={selectedRoom?.id === room.id ? styles.active : ""}
            onClick={() => onJoinRoom(room)}
          >
            <div className={styles.avatar}>💬</div>
            <div className={styles.roomInfo}>
              <div className={styles.name}>{room.name}</div>
              <div className={styles.latest}>
                {room.latestMessage || "No messages yet"}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3>Create a Room</h3>
        <form onSubmit={createRoom}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Optional password"
            type="password"
          />
          <button type="submit">Create</button>
        </form>
      </Modal>
    </div>
  );
}
