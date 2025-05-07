// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAW7eGDsJwWtaj3I1lrcuzvFx8vkX5EaKI",
  authDomain: "gaslandsgarage-74ce6.firebaseapp.com",
  projectId: "gaslandsgarage-74ce6",
  storageBucket: "gaslandsgarage-74ce6.appspot.com",
  messagingSenderId: "636098164916",
  appId: "1:636098164916:web:b3586c38da2ebaf9c13fe1",
  measurementId: "G-EKPMXMY097"
};

// Only initialize Firebase in the browser environment
let app;
let auth;
let db;
let user = writable<User | null>(null);

if (browser) {
  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Subscribe to auth state changes
    auth.onAuthStateChanged((newUser) => {
      user.set(newUser);
    });
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

// Sign in with Google
export const signInWithGoogle = async () => {
  if (!auth) return { success: false, error: "Auth not initialized" };
  
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
  if (!auth) return { success: false, error: "Auth not initialized" };
  
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error signing out", error);
    return { success: false, error };
  }
};

export { auth, db, user };