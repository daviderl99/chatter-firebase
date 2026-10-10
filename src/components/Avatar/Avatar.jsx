import styles from "./Avatar.module.scss";

/** Profile picture with an initial-letter fallback (avoids an <img> with an empty src). */
export default function Avatar({ src, name, className = "" }) {
  if (src) {
    return (
      <img
        className={className}
        src={src}
        alt={name ? `${name} avatar` : "User avatar"}
      />
    );
  }
  const initial = name?.trim()?.[0]?.toUpperCase() || "?";
  return (
    <div className={`${className} ${styles.fallback}`} aria-hidden="true">
      {initial}
    </div>
  );
}
