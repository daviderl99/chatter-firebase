import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import LoadingSpinner from "./components/LoadingSpinner/LoadingSpinner";
import AuthForm from "./components/AuthForm/AuthForm";
import RoomList from "./components/Rooms/RoomList";
import Chat from "./components/Chat/Chat";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const closeRoom = useCallback(() => setRoom(null), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <AuthForm onAuth={setUser} />;
  }

  return (
    <>
      <div className={`app-split ${isSidebarOpen ? "with-sidebar" : "full"}`}>
        <RoomList
          user={user}
          selectedRoom={room}
          onJoinRoom={setRoom}
          onLogout={() => {
            setRoom(null);
            signOut(auth);
          }}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        {room ? (
          <Chat
            key={room.id}
            user={user}
            roomId={room.id}
            onRoomClosed={closeRoom}
          />
        ) : (
          <div className="chat-placeholder">Select a room</div>
        )}
      </div>
    </>
  );
}

export default App;
