import styles from "./ErrorMessage.module.scss";

export default function ErrorMessage({ children }) {
  return <div className={styles.error}>{children}</div>;
}
