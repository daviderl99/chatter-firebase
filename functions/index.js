import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const DEFAULT_ITERATIONS = 150_000;
const MAX_ITERATIONS = 1_000_000;

function buffersEqual(a, b) {
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyPassword(room, password) {
  if (room.passwordHash && room.passwordSalt) {
    const salt = Buffer.from(room.passwordSalt, "base64");
    const expectedHash = Buffer.from(room.passwordHash, "base64");
    const iterations = room.passwordIterations || DEFAULT_ITERATIONS;
    if (
      salt.length !== 16 ||
      expectedHash.length !== 32 ||
      !Number.isInteger(iterations) ||
      iterations < 1 ||
      iterations > MAX_ITERATIONS
    ) {
      return false;
    }

    const actualHash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
    return buffersEqual(actualHash, expectedHash);
  }

  return (
    !room.passwordHash &&
    typeof room.password === "string" &&
    buffersEqual(Buffer.from(room.password), Buffer.from(password))
  );
}

export const joinRoom = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to join a room.");
  }

  const roomName = request.data?.roomName;
  const password = request.data?.password;
  if (
    typeof roomName !== "string" ||
    !roomName.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Room name and password are required."
    );
  }

  const rooms = await db
    .collection("chatRooms")
    .where("name", "==", roomName.trim())
    .get();

  for (const roomSnapshot of rooms.docs) {
    if (!verifyPassword(roomSnapshot.data(), password)) continue;

    return db.runTransaction(async (transaction) => {
      const currentRoom = await transaction.get(roomSnapshot.ref);
      if (!currentRoom.exists) {
        throw new HttpsError("not-found", "Room not found.");
      }
      if (!verifyPassword(currentRoom.data(), password)) {
        throw new HttpsError("permission-denied", "Incorrect room password.");
      }

      transaction.update(roomSnapshot.ref, {
        members: FieldValue.arrayUnion(request.auth.uid),
      });
      return {
        id: currentRoom.id,
        name: currentRoom.get("name"),
        legacyRoom:
          !currentRoom.get("passwordHash") && Boolean(currentRoom.get("password")),
      };
    });
  }

  if (rooms.empty) {
    throw new HttpsError("not-found", "Room not found.");
  }
  throw new HttpsError("permission-denied", "Incorrect room password.");
});
