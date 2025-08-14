import styles from "./TypingIndicator.module.scss";

/**
 * Component that displays when another user is typing
 *
 * @param {Object} props - Component props
 * @param {string} props.profileImage - URL of the user's profile image
 * @param {boolean} props.isTyping - Whether the user is currently typing
 * @param {string} props.username - Name of the user who is typing
 * @returns {JSX.Element|null} - The typing indicator or null if not typing
 */
const TypingIndicator = ({ profileImage, isTyping, username }) => {
  if (!isTyping) return null;

  return (
    <div className={styles.typingIndicator}>
      <div className={styles.avatar}>
        <img src={profileImage} alt={`${username || "User"} avatar`} />
      </div>
      <div className={styles.dots}>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
      </div>
    </div>
  );
};

export default TypingIndicator;
