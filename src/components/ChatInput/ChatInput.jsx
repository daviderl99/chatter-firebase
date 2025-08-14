import { useRef, useState } from "react";
import { db, storage } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import styles from "./ChatInput.module.scss";
import ImageIcon from "../icons/ImageIcon";
import LoaderCircleIcon from "../icons/LoaderCircleIcon";
import SendIcon from "../icons/SendIcon";
import { doc, setDoc } from "firebase/firestore";

export default function ChatInput({ user, roomId }) {
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef();

  const handleImagePickClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large (max 5MB).");
      return;
    }
    setImageFile(file);
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const clearSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
    setFileName("");
  };

  const handleInput = (e) => {
    const text = e.currentTarget.textContent;
    setMessage(text);
    if (text === "" && messageInputRef.current) {
      // Remove any lingering <br> or whitespace nodes
      messageInputRef.current.innerHTML = "";
    }

    // Typing indicator logic
    setTypingStatus(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, 1500); // 1.5s after last keystroke, mark as not typing
  };

  const setTypingStatus = (isTyping) => {
    if (!roomId || !user?.uid) return;
    setDoc(
      doc(db, `chatRooms/${roomId}/typing`, user.uid),
      { isTyping },
      { merge: true }
    );
  };

  // Mark as not typing when input loses focus
  const handleMessageBlur = () => {
    setTypingStatus(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const hasText = !!message.trim();
    const hasImage = !!imageFile;
    if ((!hasText && !hasImage) || !roomId) return;

    setMessage("");
    if (messageInputRef.current) {
      messageInputRef.current.textContent = "";
    }

    let messageImageUrl = null;
    try {
      if (hasImage) {
        setUploading(true);
        const path = `chatRooms/${roomId}/images/${user.uid}-${Date.now()}-${
          imageFile.name
        }`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, imageFile);
        messageImageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: hasText ? message.trim() : "",
        messageImageUrl: messageImageUrl || null,
        uid: user.uid,
        displayName: user.displayName,
        userAvatarUrl: user.photoURL,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setUploading(false);
      clearSelectedImage();
    }
  };

  return (
    <div className={styles.chat_input_container}>
      {imagePreview && (
        <div className={styles.preview}>
          <img src={imagePreview} alt="preview" />
          <div className={styles.file_info}>
            <span className={styles.file_name}>{fileName}</span>
          </div>
          <button
            type="button"
            onClick={clearSelectedImage}
            className={styles.remove_button}
            aria-label="Remove selected image"
          >
            ×
          </button>
        </div>
      )}
      <form onSubmit={handleSend} className={styles.chat_input}>
        <div
          ref={messageInputRef}
          contentEditable
          suppressContentEditableWarning
          className={styles.message_input}
          aria-label="Type your message..."
          placeholder="Type your message..."
          onInput={handleInput}
          onBlur={handleMessageBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: "none" }}
        />

        <button
          type="button"
          onClick={handleImagePickClick}
          aria-label="Attach image"
          className={styles.icon_button}
        >
          <ImageIcon />
        </button>

        <button
          type="submit"
          disabled={uploading}
          className={styles.icon_button}
        >
          {uploading ? (
            <LoaderCircleIcon className={styles.spin} />
          ) : (
            <SendIcon />
          )}
        </button>
      </form>
    </div>
  );
}
