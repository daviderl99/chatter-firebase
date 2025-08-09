import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp,
  limit,
  where,
  getDocs,
  updateDoc,
  doc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../firebase";
import styles from "./RoomList.module.scss";
import Modal from "../Modal/Modal";

export default function RoomList({ user, onJoinRoom, selectedRoom }) {
  const [rooms, setRooms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' | 'join'
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    // Get rooms where current user is in the members array
    const roomsQuery = query(
      collection(db, "chatRooms"),
      where("members", "array-contains", user.uid)
    );
    let messageUnsubs = [];
    // Realtime listener for the above rooms query
    // onSnapshot keeps the UI in sync with any room changes without manual refresh
    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const roomDocs = snapshot.docs;
      let roomsArr = roomDocs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          password: data.password || null,
          members: data.members || [],
          latestMessage: null,
          latestTimestamp: null,
        };
      });

      // Remove previous listeners
      messageUnsubs.forEach((unsub) => unsub());
      messageUnsubs = [];

      // Listen for each room's latest message to update preview & sort list
      roomsArr.forEach((room, idx) => {
        const msgQuery = query(
          collection(db, `chatRooms/${room.id}/messages`),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        // Realtime listener for the latest message in this room
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
  }, [user?.uid]);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) return;

    // Create new room with creator as sole member and server timestamp
    await addDoc(collection(db, "chatRooms"), {
      name: name.trim(),
      password: password.trim(),
      createdBy: user.uid,
      members: [user.uid],
      createdAt: serverTimestamp(),
    });

    setName("");
    setPassword("");
    setModalOpen(false);
    setModalMode("create");
    setError("");
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !password.trim()) return;

    // Find room by exact name
    const q = query(
      collection(db, "chatRooms"),
      where("name", "==", name.trim())
    );

    // getDocs() performs a one-time fetch of the query result (no realtime updates needed here).
    const qSnap = await getDocs(q);
    if (qSnap.empty) {
      setError("Room not found");
      return;
    }

    // If multiple rooms with same name exist, use the first
    const roomDoc = qSnap.docs[0];
    const data = roomDoc.data();
    if ((data.password || "") !== password.trim()) {
      setError("Incorrect password");
      return;
    }

    // Add current user to the room's members; arrayUnion avoids duplicates
    await updateDoc(doc(db, "chatRooms", roomDoc.id), {
      members: arrayUnion(user.uid),
    });

    // Clear and close
    const joinedRoom = {
      id: roomDoc.id,
      name: data.name,
      password: data.password || null,
    };
    setName("");
    setPassword("");
    setModalOpen(false);
    setModalMode("create");
    setError("");

    // Optionally auto-open joined room
    onJoinRoom?.(joinedRoom);
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

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError(""); }}>
        <div className={styles.modalTabs}>
          <button
            className={modalMode === "create" ? styles.activeTab : ""}
            onClick={() => { setModalMode("create"); setError(""); }}
          >
            Create
          </button>
          <button
            className={modalMode === "join" ? styles.activeTab : ""}
            onClick={() => { setModalMode("join"); setError(""); }}
          >
            Join
          </button>
        </div>
        {modalMode === "create" ? (
          <>
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
                placeholder="Room password"
                type="password"
                required
              />
              <button type="submit">Create</button>
            </form>
          </>
        ) : (
          <>
            <h3>Join a Room</h3>
            <form onSubmit={joinRoom}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Room name"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Room password"
                type="password"
                required
              />
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit">Join</button>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
