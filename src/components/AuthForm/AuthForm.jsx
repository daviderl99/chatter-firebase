import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import styles from "./AuthForm.module.scss";
import ErrorMessage from "../shared/ErrorMessage";

// Map Firebase error codes to messages
function getAuthErrorMessage(error) {
  if (!error?.code && typeof error === "string") return error;
  if (!error?.code) return "An unknown error occurred.";
  switch (error.code) {
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/password-does-not-meet-requirements":
      return "Password must contain at least 6 characters, a capital letter, and one number.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    default:
      return error.message || "An unknown error occurred.";
  }
}

export default function AuthForm({ onAuth }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const saveUserProfile = async (user) => {
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid),
      {
        displayName: user.displayName || "Unknown",
        photoURL: user.photoURL || "",
      },
      { merge: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (isRegistering) {
        const { user } = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const generatedPhoto = `https://api.dicebear.com/7.x/icons/svg?seed=${encodeURIComponent(
          username
        )}`;

        await updateProfile(user, {
          displayName: username,
          photoURL: generatedPhoto,
        });

        await saveUserProfile(auth.currentUser); // sync Firestore

        onAuth({ ...auth.currentUser });
      } else {
        const { user } = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        await saveUserProfile(user); // ensure Firestore has latest

        onAuth(user);
      }
    } catch (err) {
      setError(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.auth_form}>
      <h2>{isRegistering ? "Create an Account" : "Login"}</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {isRegistering && (
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      )}

      {error && <ErrorMessage>{getAuthErrorMessage(error)}</ErrorMessage>}

      <button type="submit">{isRegistering ? "Sign Up" : "Log In"}</button>

      <p>
        {isRegistering ? "Already have an account?" : "New here?"}{" "}
        <button type="button" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? "Log In" : "Sign Up"}
        </button>
      </p>
    </form>
  );
}
