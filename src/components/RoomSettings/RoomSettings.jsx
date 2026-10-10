import { useEffect, useRef, useState } from "react";
import Modal from "../Modal/Modal";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import Avatar from "../Avatar/Avatar";
import { CloseIcon, LogOutIcon, TrashIcon } from "../icons/Icons";
import styles from "./RoomSettings.module.scss";

const MAX_NAME_LENGTH = 40;

function useObjectUrl(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

export default function RoomSettings({
  open,
  onClose,
  room,
  profiles,
  currentUid,
  onLeave,
  onDelete,
  onRemoveMember,
  onSave,
}) {
  const [confirm, setConfirm] = useState(null); // "leave" | "delete" | null
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const roomName = room?.name;
  useEffect(() => {
    if (!open) return;
    setName(roomName ?? "");
    setImageFile(null);
    setRemoveImage(false);
  }, [open, roomName]);

  const previewUrl = useObjectUrl(imageFile);

  if (!room) return null;

  const isOwner = room.createdBy === currentUid;
  const nameOf = (uid) => profiles[uid]?.displayName || "Unknown";
  const members = [...(room.members ?? [])].sort((a, b) => {
    if (a === room.createdBy) return -1;
    if (b === room.createdBy) return 1;
    return nameOf(a).localeCompare(nameOf(b));
  });

  const trimmedName = name.trim();
  const dirty =
    Boolean(imageFile) ||
    removeImage ||
    (trimmedName !== "" && trimmedName !== room.name);
  const shownPhoto = removeImage ? "" : previewUrl || room.photoURL;

  const runAction = async (action) => {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) {
      setConfirm(null);
      onClose();
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    const ok = await onSave({ name: trimmedName, imageFile, removeImage });
    setSaving(false);
    if (ok) {
      setImageFile(null);
      setRemoveImage(false);
    }
  };

  const handleRemoveMember = async () => {
    setBusy(true);
    const ok = await onRemoveMember(memberToRemove);
    setBusy(false);
    if (ok) setMemberToRemove(null);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={confirm || memberToRemove ? undefined : onClose}
      >
        <div className={styles.settings}>
          <div className={styles.header}>
            <div>
              <h2>Room settings</h2>
              <p className={styles.roomName}>{room.name}</p>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          {isOwner && (
            <form className={styles.editForm} onSubmit={handleSave}>
              <div className={styles.imageRow}>
                <Avatar
                  className={styles.roomImage}
                  src={shownPhoto}
                  name={trimmedName || room.name}
                />
                <div className={styles.imageActions}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setRemoveImage(false);
                      }
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {shownPhoto ? "Change image" : "Add image"}
                  </button>
                  {shownPhoto && (
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => {
                        setImageFile(null);
                        setRemoveImage(true);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <label className={styles.field}>
                <span className={styles.sectionTitle}>Room name</span>
                <input
                  type="text"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!dirty || saving}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          )}

          <section>
            <h3 className={styles.sectionTitle}>
              Members <span className={styles.count}>{members.length}</span>
            </h3>
            <ul className={styles.members}>
              {members.map((uid) => (
                <li key={uid} className={styles.member}>
                  <Avatar
                    className={styles.avatar}
                    src={profiles[uid]?.photoURL}
                    name={nameOf(uid)}
                  />
                  <span className={styles.memberName}>{nameOf(uid)}</span>
                  {uid === currentUid && <span className={styles.tag}>You</span>}
                  {uid === room.createdBy && (
                    <span className={`${styles.tag} ${styles.owner}`}>Owner</span>
                  )}
                  {isOwner && uid !== currentUid && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => setMemberToRemove(uid)}
                      aria-label={`Remove ${nameOf(uid)}`}
                      title="Remove from room"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.danger}>
            {isOwner ? (
              <>
                <p className={styles.hint}>
                  You created this room, so you can&apos;t leave it. Deleting it
                  removes all messages and images for everyone.
                </p>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => setConfirm("delete")}
                >
                  <TrashIcon /> Delete room
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => setConfirm("leave")}
              >
                <LogOutIcon /> Leave room
              </button>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title="Remove this member?"
        message={`${nameOf(memberToRemove)} will be removed from "${room.name}". They can rejoin with the room password.`}
        confirmLabel="Remove"
        danger
        busy={busy}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
      />
      <ConfirmDialog
        open={confirm === "leave"}
        title="Leave this room?"
        message={`You'll need the room name and password to join "${room.name}" again.`}
        confirmLabel="Leave"
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runAction(onLeave)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete this room?"
        message={`"${room.name}" and all of its messages and images will be permanently deleted for everyone.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runAction(onDelete)}
      />
    </>
  );
}
