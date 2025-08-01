import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import AuthForm from "./components/AuthForm/AuthForm";
import Sidebar from "./components/Sidebar/Sidebar";
import Chat from "./components/Chat/Chat";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  if (!user) {
    return (
      <div className="app-container">
        <AuthForm onAuth={setUser} />
      </div>
    );
  }

  return (
    <>
      <Sidebar user={user} onLogout={() => signOut(auth)} />
      <div className="app-container dimmed">
        <Chat user={user} />
      </div>
    </>
  );
}

export default App;
