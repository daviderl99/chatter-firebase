import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "../../hooks/useToast";
import styles from "./Toast.module.scss";

const DURATION_MS = { error: 6000, success: 3500, info: 4000 };
const MAX_VISIBLE = 4;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message) => {
      if (!message) return;
      const id = ++nextId.current;
      setToasts((current) => {
        // Avoid stacking identical messages (e.g. several listeners failing at once)
        if (current.some((t) => t.type === type && t.message === message)) {
          return current;
        }
        return [...current, { id, type, message }].slice(-MAX_VISIBLE);
      });
      setTimeout(() => dismiss(id), DURATION_MS[type]);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      error: (message) => show("error", message),
      success: (message) => show("success", message),
      info: (message) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.container}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]}`}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
