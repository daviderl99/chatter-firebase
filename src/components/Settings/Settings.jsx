import { useState, useRef } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import styles from "./Settings.module.scss";
import Modal from "../Modal/Modal";

const Settings = ({ isOpen, onClose, user, onUpdateProfile }) => {
  const [username, setUsername] = useState(user?.displayName || "");
  const [profilePicture, setProfilePicture] = useState(user?.photoURL || "");
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(user?.photoURL || "");
  const fileInputRef = useRef(null);

  const storage = getStorage();
  const db = getFirestore();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    setPreviewUrl(fileUrl);
    setProfilePicture(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    try {
      let photoURL = user.photoURL;

      if (profilePicture instanceof File) {
        const storageRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(storageRef, profilePicture);
        photoURL = await getDownloadURL(storageRef);
      }

      // Update Firebase Auth profile
      await onUpdateProfile({
        displayName: username.trim(),
        photoURL: photoURL,
      });

      // ALSO update Firestore user document so chat UI always shows latest data
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: username.trim(),
          photoURL: photoURL,
          uid: user.uid,
        },
        { merge: true }
      );

      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
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
              {previewUrl && (
                <div className={styles.previewContainer}>
                  <img
                    src={previewUrl}
                    alt="Profile preview"
                    className={styles.profilePreview}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
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
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default Settings;
