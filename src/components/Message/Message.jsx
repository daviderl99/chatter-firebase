import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "../Avatar/Avatar";
import { EditIcon, MoreIcon, SmileIcon, TrashIcon } from "../icons/Icons";
import styles from "./Message.module.scss";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
// 6 buttons x 34px + 5 gaps x 2px + 2 x 4px padding + 2px border
const PICKER_WIDTH = 224;
const PICKER_HEIGHT = 44;

const formatTimestamp = (ts) => {
  const ms = ts?.toMillis?.();
  if (!ms) return "";
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

function EditBox({ initialText, onSave, onCancel }) {
  const [draft, setDraft] = useState(initialText);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <div className={styles.editBox}>
      <textarea
        className={styles.editInput}
        value={draft}
        rows={Math.min(6, draft.split("\n").length)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
        aria-label="Edit message"
        autoFocus
        onFocus={(e) => e.target.setSelectionRange(draft.length, draft.length)}
      />
      <div className={styles.editFooter}>
        <span className={styles.editHint}>Esc to cancel · Enter to save</span>
        <button
          type="button"
          className={styles.editCancel}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.editSave}
          onClick={save}
          disabled={saving}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function Message({
  msg,
  isOwn,
  showMeta,
  sender,
  profiles,
  currentUid,
  canDelete,
  expanded,
  editing,
  onToggleExpanded,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
  onReact,
  onOpenImage,
  onImageLoad,
}) {
  const [pickerPos, setPickerPos] = useState(null);
  const actionsRef = useRef(null);
  const pickerButtonRef = useRef(null);
  const pickerRef = useRef(null);
  const imageUrl = msg.messageImageUrl || msg.imageUrl;
  const senderName = sender.displayName || "Unknown";

  // The picker is portaled and positioned in viewport coordinates so it is never
  // clipped by the scrolling message list, whatever the message's height.
  const togglePicker = () => {
    if (pickerPos) {
      setPickerPos(null);
      return;
    }
    const rect = pickerButtonRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, isOwn ? rect.right - PICKER_WIDTH : rect.left),
      window.innerWidth - PICKER_WIDTH - 8
    );
    const fitsAbove = rect.top > PICKER_HEIGHT + 12;
    setPickerPos({
      left,
      top: fitsAbove ? rect.top - PICKER_HEIGHT - 6 : rect.bottom + 6,
    });
  };

  useEffect(() => {
    if (!pickerPos) return;
    const close = () => setPickerPos(null);
    const onPointerDown = (e) => {
      const inside =
        actionsRef.current?.contains(e.target) ||
        pickerRef.current?.contains(e.target);
      if (!inside) close();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pickerPos]);

  const reactions = Object.entries(msg.reactions ?? {}).filter(
    ([, uids]) => uids?.length
  );

  const handlePick = (emoji) => {
    setPickerPos(null);
    onReact(msg, emoji);
  };

  const meta = (
    <div className={styles.meta}>
      {isOwn && <span className={styles.username}>{senderName}</span>}
      <Avatar
        className={styles.avatar}
        src={sender.photoURL}
        name={senderName}
      />
      {!isOwn && <span className={styles.username}>{senderName}</span>}
    </div>
  );

  return (
    <div className={`${styles.message} ${isOwn ? styles.own : ""}`}>
      {showMeta && meta}
      {expanded && (
        <div className={styles.timestamp}>{formatTimestamp(msg.timestamp)}</div>
      )}

      <div className={styles.row}>
        <div className={styles.content}>
          {imageUrl && (
            <img
              className={styles.image}
              src={imageUrl}
              alt="Attachment"
              onClick={() => onOpenImage(imageUrl)}
              onLoad={onImageLoad}
            />
          )}
          {editing ? (
            <EditBox
              initialText={msg.text || ""}
              onSave={(text) => onSaveEdit(msg, text)}
              onCancel={onCancelEdit}
            />
          ) : (
            msg.text && (
              <p className={styles.bubble} onClick={onToggleExpanded}>
                {msg.text}
              </p>
            )
          )}
          {msg.editedAt && !editing && (
            <span className={styles.edited}>Edited</span>
          )}
        </div>

        {!editing && (
          <div
            ref={actionsRef}
            className={`${styles.actions} ${
              expanded || pickerPos ? styles.actionsOpen : ""
            }`}
          >
            <button
              ref={pickerButtonRef}
              type="button"
              className={styles.actionButton}
              onClick={togglePicker}
              aria-label="Add reaction"
              title="Add reaction"
              aria-expanded={Boolean(pickerPos)}
            >
              <SmileIcon />
            </button>
            {isOwn && msg.text && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={onStartEdit}
                aria-label="Edit message"
                title="Edit"
              >
                <EditIcon />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.danger}`}
                onClick={() => onRequestDelete(msg)}
                aria-label="Delete message"
                title="Delete"
              >
                <TrashIcon />
              </button>
            )}
            <button
              type="button"
              className={`${styles.actionButton} ${styles.touchOnly}`}
              onClick={onToggleExpanded}
              aria-label="Message options"
            >
              <MoreIcon />
            </button>

            {pickerPos &&
              createPortal(
                <div
                  ref={pickerRef}
                  className={styles.picker}
                  style={{ top: pickerPos.top, left: pickerPos.left }}
                  role="menu"
                >
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="menuitem"
                      className={styles.pickerEmoji}
                      onClick={() => handlePick(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>
        )}
      </div>

      {reactions.length > 0 && (
        <div className={styles.reactions}>
          {reactions.map(([emoji, uids]) => {
            const mine = uids.includes(currentUid);
            const names = uids
              .map((uid) => profiles[uid]?.displayName || "Someone")
              .join(", ");
            return (
              <button
                key={emoji}
                type="button"
                className={`${styles.reaction} ${mine ? styles.mine : ""}`}
                onClick={() => onReact(msg, emoji)}
                title={names}
                aria-pressed={mine}
              >
                <span>{emoji}</span>
                <span className={styles.count}>{uids.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
