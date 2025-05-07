// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { writable } from 'svelte/store';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Replace with your Firebase API key
  authDomain: "gaslands-garage.firebaseapp.com", // Replace with your Firebase domain
  projectId: "gaslands-garage",
  storageBucket: "gaslands-garage.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Create a user store
export const user = writable<User | null>(null);

// Subscribe to auth state changes
auth.onAuthStateChanged((newUser) => {
  user.set(newUser);
});

// Sign in with Google
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    return { success: true };
  } catch (error) {
    console.error("Error signing in with Google", error);
    return { success: false, error };
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error signing out", error);
    return { success: false, error };
  }
};