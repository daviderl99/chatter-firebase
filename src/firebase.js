import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDzh5kW3O-5CoummtTkHIGbB66e_R7yFEs",
  authDomain: "chatter-1c8c6.firebaseapp.com",
  projectId: "chatter-1c8c6",
  storageBucket: "chatter-1c8c6.firebasestorage.app",
  messagingSenderId: "559340361952",
  appId: "1:559340361952:web:9f52288509de5989859885",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
