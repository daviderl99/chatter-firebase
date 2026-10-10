const DEFAULT_ITERATIONS = 150_000;
const MAX_ITERATIONS = 1_000_000;
const encoder = new TextEncoder();

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(password, saltBase64, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(saltBase64),
      // A room document is untrusted input, so cap the work factor
      iterations: Math.min(iterations, MAX_ITERATIONS),
    },
    key,
    256
  );
  return toBase64(new Uint8Array(bits));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns the Firestore fields that store a salted PBKDF2 hash of the password. */
export async function createPasswordFields(password) {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  return {
    passwordHash: await derive(password, salt, DEFAULT_ITERATIONS),
    passwordSalt: salt,
    passwordIterations: DEFAULT_ITERATIONS,
  };
}

/** True for rooms created before hashing was introduced (plaintext `password` field). */
export const isLegacyRoom = (room) => !room.passwordHash && Boolean(room.password);

export async function verifyRoomPassword(room, password) {
  if (room.passwordHash && room.passwordSalt) {
    const hash = await derive(
      password,
      room.passwordSalt,
      room.passwordIterations || DEFAULT_ITERATIONS
    );
    return timingSafeEqual(hash, room.passwordHash);
  }
  return isLegacyRoom(room) && timingSafeEqual(room.password, password);
}
