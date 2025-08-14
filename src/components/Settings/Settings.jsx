import { useState, useRef, useEffect } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { compressImage } from "../../utils/compressImage";
import styles from "./Settings.module.scss";
import Modal from "../Modal/Modal";

const storage = getStorage();
const db = getFirestore();

const Settings = ({ isOpen, onClose, user, onUpdateProfile }) => {
  const [username, setUsername] = useState(user.displayName || "");
  const [imageSrc, setImageSrc] = useState(user.photoURL || "");
  const [isLoading, setIsLoading] = useState(false);

  const fileToUploadRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reset fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername(user.displayName || "");
      setImageSrc(user.photoURL || "");
      fileToUploadRef.current = null;
    }
  }, [isOpen, user]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      fileToUploadRef.current = compressed;
      setImageSrc(URL.createObjectURL(compressed));
    } catch (err) {
      console.error("Image compression failed:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let photoURL = imageSrc;

      if (fileToUploadRef.current) {
        const storageRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(storageRef, fileToUploadRef.current);
        photoURL = await getDownloadURL(storageRef);
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: username,
          photoURL,
        },
        { merge: true }
      );

      onUpdateProfile({
        ...user,
        displayName: username,
        photoURL,
      });

      onClose();
    } catch (err) {
      console.error("Failed to save profile settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className={styles.settings}>
        <div className={styles.header}>
          <h2>Profile Settings</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.settingsForm}>
          <div className={styles.formGroup}>
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="profilePicture">Profile Picture</label>
            <div className={styles.uploadContainer}>
              <input
                type="file"
                id="profilePicture"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
              <button
                type="button"
                className={styles.uploadButton}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Image
              </button>
              {imageSrc && (
                <div className={styles.previewContainer}>
                  <img
                    src={imageSrc}
                    alt="Profile preview"
                    className={styles.profilePreview}
                  />
                </div>
              )}
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default Settings;
