import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import LoadingSpinner from "./components/LoadingSpinner/LoadingSpinner";
import AuthForm from "./components/AuthForm/AuthForm";
import Sidebar from "./components/Sidebar/Sidebar";
import RoomList from "./components/Rooms/RoomList";
import Chat from "./components/Chat/Chat";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
      <Sidebar user={user} onLogout={() => signOut(auth)} />
      <div className="app-split">
        <RoomList user={user} selectedRoom={room} onJoinRoom={setRoom} />
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
