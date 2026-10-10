import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  serverTimestamp,
  where,
  getDocs,
  updateDoc,
  deleteField,
  doc,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { updateProfile } from "firebase/auth";
import styles from "./RoomList.module.scss";
import Modal from "../Modal/Modal";
import Avatar from "../Avatar/Avatar";
import SettingsIcon from "../icons/SettingsIcon";
import Settings from "../Settings/Settings";
import ErrorMessage from "../shared/ErrorMessage";
import { useRooms, MAX_UNREAD_DISPLAY } from "../../hooks/useRooms";
import { useToast } from "../../hooks/useToast";
import { getErrorMessage } from "../../utils/errors";
import {
  createPasswordFields,
  isLegacyRoom,
  verifyRoomPassword,
} from "../../utils/roomPassword";

export default function RoomList({
  user,
  onJoinRoom,
  selectedRoom,
  onLogout,
  isOpen,
  setIsOpen,
}) {
  const toast = useToast();
  const { rooms, reads, markRead } = useRooms(user?.uid);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' | 'join'
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isActive = () =>
    document.visibilityState === "visible" && document.hasFocus();
  const [tabVisible, setTabVisible] = useState(isActive);

  useEffect(() => {
    const update = () => setTabVisible(isActive());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);

  // Mark the open room as read whenever something newer arrives while it's visible
  const selectedId = selectedRoom?.id;
  const selectedLatest = rooms.find((r) => r.id === selectedId)?.latestTimestamp;
  const selectedRead = reads[selectedId] ?? 0;
  useEffect(() => {
    if (!selectedId || !tabVisible || !selectedLatest) return;
    if (selectedLatest > selectedRead) markRead(selectedId, selectedLatest);
  }, [selectedId, selectedLatest, selectedRead, tabVisible, markRead]);

  const handleUpdateProfile = (profileData) =>
    updateProfile(auth.currentUser, profileData);

  const resetModal = () => {
    setName("");
    setPassword("");
    setModalOpen(false);
    setModalMode("create");
    setError("");
  };

  const switchMode = (mode) => {
    setModalMode(mode);
    setError("");
  };

  const createRoom = async (e) => {
    e.preventDefault();
    setError("");
    const roomName = name.trim();
    const roomPassword = password.trim();
    if (!roomName || !roomPassword) return;

    setBusy(true);
    try {
      const existing = await getDocs(
        query(collection(db, "chatRooms"), where("name", "==", roomName))
      );
      if (!existing.empty) {
        setError(
          "A room with this name already exists. Please choose another name."
        );
        return;
      }

      await addDoc(collection(db, "chatRooms"), {
        name: roomName,
        ...(await createPasswordFields(roomPassword)),
        createdBy: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });

      resetModal();
      toast.success(`Created "${roomName}".`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create the room."));
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    setError("");
    const roomName = name.trim();
    const roomPassword = password.trim();
    if (!roomName || !roomPassword) return;

    setBusy(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, "chatRooms"), where("name", "==", roomName))
      );
      if (snapshot.empty) {
        setError("Room not found");
        return;
      }

      let match = null;
      for (const roomDoc of snapshot.docs) {
        if (await verifyRoomPassword(roomDoc.data(), roomPassword)) {
          match = roomDoc;
          break;
        }
      }
      if (!match) {
        setError("Incorrect password");
        return;
      }

      const roomRef = doc(db, "chatRooms", match.id);
      // arrayUnion avoids duplicates if the user is already a member
      await updateDoc(roomRef, { members: arrayUnion(user.uid) });

      // Upgrade rooms that still store the password in plaintext
      if (isLegacyRoom(match.data())) {
        updateDoc(roomRef, {
          ...(await createPasswordFields(roomPassword)),
          password: deleteField(),
        }).catch(() => {});
      }

      const joined = { id: match.id, name: match.data().name };
      resetModal();
      onJoinRoom?.(joined);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't join the room."));
    } finally {
      setBusy(false);
    }
  };

  const formFields = (
    <>
      <input
        className={styles.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Room name"
        required
      />
      <input
        className={styles.input}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Room password"
        type="password"
        required
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </>
  );

  return (
    <>
      {/* Sidebar toggle, always visible and stuck to the sidebar edge */}
      <button
        className={`${styles.sidebarToggle} ${
          isOpen ? styles.sidebarOpen : styles.sidebarClosed
        }`}
        onClick={() => setIsOpen?.(!isOpen)}
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        title={isOpen ? "Close" : "Open"}
      >
        {isOpen ? "‹" : "›"}
      </button>
      <div className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.profile}>
          <div className={styles.userRow}>
            <Avatar
              src={user.photoURL}
              name={user.displayName}
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
        <button
          className={styles.addRoomBtn}
          onClick={() => setModalOpen(true)}
          title="Create or join a room"
        >
          <span className={styles.addRoomIcon}>+</span>
          <span className={styles.addRoomText}>New Room</span>
        </button>
        <ul className={styles.roomList}>
          {rooms.map((room) => {
            const isActive = selectedRoom?.id === room.id;
            const unread = isActive && tabVisible ? 0 : room.unread;
            return (
              <li
                key={room.id}
                className={isActive ? styles.active : ""}
                onClick={() => onJoinRoom(room)}
              >
                <Avatar
                  src={room.photoURL}
                  name={room.name}
                  className={styles.avatar}
                />
                <div className={styles.roomInfo}>
                  <div
                    className={`${styles.name} ${unread ? styles.unreadName : ""}`}
                  >
                    {room.name}
                  </div>
                  <div className={styles.latest}>
                    {room.latestMessageImage && !room.latestMessage ? (
                      <em>Image</em>
                    ) : (
                      room.latestMessage || "No messages yet"
                    )}
                  </div>
                </div>
                {unread > 0 && (
                  <span
                    className={styles.badge}
                    aria-label={`${unread} unread messages`}
                  >
                    {unread > MAX_UNREAD_DISPLAY
                      ? `${MAX_UNREAD_DISPLAY}+`
                      : unread}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setError("");
        }}
      >
        <div className={styles.roomModal}>
          <div className={styles.tabs}>
            <button
              className={modalMode === "create" ? styles.activeTab : ""}
              onClick={() => switchMode("create")}
              type="button"
            >
              Create
            </button>
            <button
              className={modalMode === "join" ? styles.activeTab : ""}
              onClick={() => switchMode("join")}
              type="button"
            >
              Join
            </button>
          </div>
          <h3 className={styles.title}>
            {modalMode === "create" ? "Create a Room" : "Join a Room"}
          </h3>
          <form
            className={styles.form}
            onSubmit={modalMode === "create" ? createRoom : joinRoom}
          >
            {formFields}
            <button className={styles.button} type="submit" disabled={busy}>
              {busy ? "Please wait..." : modalMode === "create" ? "Create" : "Join"}
            </button>
          </form>
        </div>
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
