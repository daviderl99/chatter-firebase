import { useState, useEffect } from "react";
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
20
  return (
    <>
      <div className={`app-split ${isSidebarOpen ? "with-sidebar" : "full"}`}>
        <RoomList
          user={user}
          selectedRoom={room}
          onJoinRoom={setRoom}
          onLogout={() => signOut(auth)}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        {room ? (
          <Chat user={user} roomId={room.id} />
        ) : (
          <div className="chat-placeholder">Select a room</div>
        )}
      </div>
    </>
  );
}

export default App;
