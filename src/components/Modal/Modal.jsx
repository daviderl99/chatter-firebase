import React from "react";
import styles from "./Modal.module.scss";

export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
