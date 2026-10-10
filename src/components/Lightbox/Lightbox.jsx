import { useEffect } from "react";
import { CloseIcon, ExternalLinkIcon } from "../icons/Icons";
import styles from "./Lightbox.module.scss";

export default function Lightbox({ src, onClose }) {
  useEffect(() => {
    if (!src) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
    >
      <div className={styles.toolbar} onClick={(e) => e.stopPropagation()}>
        <a
          className={styles.toolButton}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open original in a new tab"
          title="Open original"
        >
          <ExternalLinkIcon />
        </a>
        <button
          type="button"
          className={styles.toolButton}
          onClick={onClose}
          aria-label="Close image viewer"
          title="Close"
          autoFocus
        >
          <CloseIcon />
        </button>
      </div>
      <img
        className={styles.image}
        src={src}
        alt="Full-size attachment"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
