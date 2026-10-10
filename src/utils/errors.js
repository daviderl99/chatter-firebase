const MESSAGES = {
  "permission-denied": "You don't have permission to do that.",
  unavailable: "Can't reach the server. Check your connection and try again.",
  "deadline-exceeded": "The request timed out. Please try again.",
  "not-found": "That item no longer exists.",
  "resource-exhausted": "Usage limit reached. Please try again later.",
  unauthenticated: "Please sign in again.",
  "storage/unauthorized": "You don't have permission to upload this file.",
  "storage/canceled": "The upload was cancelled.",
  "storage/quota-exceeded": "Storage quota exceeded.",
  "storage/retry-limit-exceeded": "Upload failed. Check your connection and try again.",
};

export function getErrorMessage(
  error,
  fallback = "Something went wrong. Please try again."
) {
  return MESSAGES[error?.code] ?? fallback;
}
