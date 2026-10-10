import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "../firebase";

const BATCH_SIZE = 400;

async function deleteCollection(path, onDoc) {
  for (;;) {
    const snapshot = await getDocs(query(collection(db, path), limit(BATCH_SIZE)));
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      onDoc?.(d.data());
      batch.delete(d.ref);
    });
    await batch.commit();
  }
}

/** Deletes a room together with its messages, typing docs and uploaded images. */
export async function deleteRoomCascade(roomId, photoURL) {
  if (photoURL) deleteObject(ref(storage, photoURL)).catch(() => {});
  await deleteCollection(`chatRooms/${roomId}/messages`, (message) => {
    const imageUrl = message.messageImageUrl || message.imageUrl;
    if (imageUrl) deleteObject(ref(storage, imageUrl)).catch(() => {});
  });
  await deleteCollection(`chatRooms/${roomId}/typing`);
  await deleteDoc(doc(db, "chatRooms", roomId));
}
