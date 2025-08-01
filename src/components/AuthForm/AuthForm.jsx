import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../firebase";
import styles from "./AuthForm.module.scss";

export default function AuthForm({ onAuth }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

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

        await updateProfile(user, {
          displayName: username,
          photoURL: `https://api.dicebear.com/7.x/icons/svg?seed=${encodeURIComponent(
            username
          )}`,
        });

        // Immediately update parent with fresh user
        onAuth({ ...auth.currentUser });
      } else {
        const { user } = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        onAuth(user);
      }
    } catch (err) {
      setError(err.message);
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

      {error && <p className={styles.error}>{error}</p>}

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
