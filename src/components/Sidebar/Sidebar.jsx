import { useState } from "react";
import styles from "./Sidebar.module.scss";

export default function Sidebar({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className={styles.toggle_btn} onClick={() => setIsOpen(!isOpen)}>
        ☰
      </button>

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.sidebar_content}>
          <div className={styles.profile}>
            <img src={user.photoURL} alt="Profile" />
            <h3>{user.displayName}</h3>
          </div>

          <button className={styles.logout_btn} onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
