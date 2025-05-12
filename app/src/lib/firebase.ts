// Import the functions you need from the SDKs you need
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Using dynamic imports to avoid SSR issues
let firebase;
let app;
let auth;
let db;
let GoogleProvider;
let user = writable(null);

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

// Track initialization status
let isInitialized = false;
let isInitializing = false;
let initPromise = null;

// Initialize Firebase only in the browser using dynamic imports
const initializeFirebase = async () => {
  // If already initialized, return immediately
  if (isInitialized) {
    return { success: true };
  }
  
  // If initialization is in progress, wait for it to complete
  if (isInitializing && initPromise) {
    return initPromise;
  }
  
  // Start initialization
  isInitializing = true;
  
  if (browser) {
    try {
      console.log("Starting Firebase initialization...");
      
      // Dynamically import Firebase modules
      const firebaseApp = await import('firebase/app');
      const firebaseAuth = await import('firebase/auth');
      const firebaseFirestore = await import('firebase/firestore');
      
      // Initialize Firebase
      app = firebaseApp.initializeApp(firebaseConfig);
      auth = firebaseAuth.getAuth(app);
      db = firebaseFirestore.getFirestore(app);
      GoogleProvider = firebaseAuth.GoogleAuthProvider;
      
      // Subscribe to auth state changes
      auth.onAuthStateChanged((newUser) => {
        user.set(newUser);
      });
      
      console.log("Firebase initialized successfully");
      isInitialized = true;
      isInitializing = false;
      return { success: true };
    } catch (error) {
      console.error("Firebase initialization error:", error);
      isInitializing = false;
      return { success: false, error };
    }
  }
  
  isInitializing = false;
  return { success: false, error: "Not in browser environment" };
};

// Initialize Firebase when in browser and store the promise
if (browser) {
  initPromise = initializeFirebase();
}

// Sign in with Google
export const signInWithGoogle = async () => {
  // Make sure Firebase is initialized
  if (!auth) {
    const initResult = await initializeFirebase();
    if (!initResult.success) {
      return { success: false, error: "Auth not initialized" };
    }
  }
  
  try {
    const firebaseAuth = await import('firebase/auth');
    const provider = new firebaseAuth.GoogleAuthProvider();
    await firebaseAuth.signInWithPopup(auth, provider);
    return { success: true };
  } catch (error) {
    console.error("Error signing in with Google", error);
    return { success: false, error };
  }
};

// Sign out
export const signOutUser = async () => {
  // Make sure Firebase is initialized
  if (!auth) {
    const initResult = await initializeFirebase();
    if (!initResult.success) {
      return { success: false, error: "Auth not initialized" };
    }
  }
  
  try {
    const firebaseAuth = await import('firebase/auth');
    await firebaseAuth.signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error signing out", error);
    return { success: false, error };
  }
};

export { auth, db, user, initializeFirebase };