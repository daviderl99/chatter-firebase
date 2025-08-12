import { useEffect, useState, useRef } from "react";
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
import { auth, db } from "../../firebase";
import { updateProfile } from "firebase/auth";
import styles from "./RoomList.module.scss";
import Modal from "../Modal/Modal";
import modalStyles from "../Modal/Modal.module.scss";
import SettingsIcon from "../icons/SettingsIcon";
import Settings from "../Settings/Settings";
import ErrorMessage from "../shared/ErrorMessage";

export default function RoomList({
  user,
  onJoinRoom,
  selectedRoom,
  onLogout,
  isOpen,
  setIsOpen,
}) {
  const [rooms, setRooms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' | 'join'
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const roomsRef = useRef([]);

  const handleUpdateProfile = async (profileData) => {
    try {
      await updateProfile(auth.currentUser, profileData);
      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    const roomsQuery = query(
      collection(db, "chatRooms"),
      where("members", "array-contains", user.uid)
    );
    let messageUnsubs = [];

    const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
      const roomDocs = snapshot.docs;
      // Build new roomsArr, but preserve latestMessage/timestamp if possible
      let roomsArr = roomDocs.map((doc) => {
        const data = doc.data();
        // Try to keep previous latestMessage/timestamp if room already exists
        const prev = roomsRef.current.find((r) => r.id === doc.id);
        return {
          id: doc.id,
          name: data.name,
          password: data.password || null,
          members: data.members || [],
          latestMessage: prev?.latestMessage ?? null,
          latestTimestamp: prev?.latestTimestamp ?? null,
        };
      });

      // Remove previous listeners
      messageUnsubs.forEach((unsub) => unsub());
      messageUnsubs = [];

      // Listen for each room's latest message
      roomsArr.forEach((room) => {
        const msgQuery = query(
          collection(db, `chatRooms/${room.id}/messages`),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const unsubMsg = onSnapshot(msgQuery, (msgSnap) => {
          const msgDoc = msgSnap.docs[0];
          // Update only the relevant room in state
          setRooms((prevRooms) => {
            const updated = prevRooms.map((r) =>
              r.id === room.id
                ? {
                    ...r,
                    latestMessage: msgDoc?.data()?.text || "",
                    latestTimestamp:
                      msgDoc?.data()?.timestamp?.toMillis?.() || 0,
                  }
                : r
            );
            roomsRef.current = updated;
            // Sort by latestTimestamp desc
            return [...updated].sort(
              (a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0)
            );
          });
        });
        messageUnsubs.push(unsubMsg);
      });

      // Initial set (preserve previous latestMessage/timestamp)
      setRooms((prevRooms) => {
        // Try to keep previous latestMessage/timestamp if possible
        const merged = roomsArr.map((room) => {
          const prev = prevRooms.find((r) => r.id === room.id);
          return {
            ...room,
            latestMessage: prev?.latestMessage ?? room.latestMessage,
            latestTimestamp: prev?.latestTimestamp ?? room.latestTimestamp,
          };
        });
        roomsRef.current = merged;
        return [...merged].sort(
          (a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0)
        );
      });
    });

    return () => {
      unsubRooms();
      messageUnsubs.forEach((unsub) => unsub());
    };
  }, [user?.uid, onLogout]);

  const createRoom = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !password.trim()) return;

    // Check if a room with this name already exists
    const q = query(
      collection(db, "chatRooms"),
      where("name", "==", name.trim())
    );
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      setError(
        "A room with this name already exists. Please choose another name."
      );
      return;
    }

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
    <>
      {/* Sidebar toggle, always visible and stuck to the sidebar edge */}
      <button
        className={`${styles.sidebarToggle} ${
          isOpen ? styles.sidebarOpen : styles.sidebarClosed
        }`}
        onClick={() => setIsOpen?.(!isOpen)}
        aria-label={isOpen ? "Close rooms sidebar" : "Open rooms sidebar"}
        title={isOpen ? "Close" : "Open"}
      >
        {isOpen ? "‹" : "›"}
      </button>

      <div className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.profile}>
          <div className={styles.userRow}>
            <img
              src={user.photoURL}
              alt={user.displayName}
              className={styles.avatarLarge}
            />

            <div className={styles.userInfo}>
              <div className={styles.usernameRow}>
                <span className={styles.displayName}>{user.displayName}</span>
              </div>
              <button className={styles.logout_btn} onClick={onLogout}>
                Sign Out
              </button>
            </div>
            <div className={styles.roomActions}>
              <button
                className={styles.settingsButton}
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Settings"
              >
                <SettingsIcon />
              </button>
            </div>
          </div>
        </div>
        <ul className={styles.roomList}>
          <button
            className={styles.addRoomBtn}
            onClick={() => setModalOpen(true)}
            title="Create or join a room"
          >
            <span className={styles.addRoomIcon}>+</span>
            <span className={styles.addRoomText}>Create or Join a Room</span>
          </button>
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
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setError("");
        }}
      >
        <div className={modalStyles.modalTabs}>
          <button
            className={modalMode === "create" ? modalStyles.activeTab : ""}
            onClick={() => {
              setModalMode("create");
              setError("");
            }}
          >
            Create
          </button>
          <button
            className={modalMode === "join" ? modalStyles.activeTab : ""}
            onClick={() => {
              setModalMode("join");
              setError("");
            }}
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
              {error && <ErrorMessage>{error}</ErrorMessage>}
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
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <button type="submit">Join</button>
            </form>
          </>
        )}
      </Modal>

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onUpdateProfile={handleUpdateProfile}
      />
    </>
  );
}
