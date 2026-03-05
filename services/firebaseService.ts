
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

// The app expects these to be defined in your environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "PLACEHOLDER",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "antirisk-vault.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "antirisk-vault",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "antirisk-vault.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "0000000000",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:0000000000:web:0000000000"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Syncs the entire local vault state to Firestore
 */
export const syncVaultToCloud = async (userId: string, data: any) => {
  if (!userId) throw new Error("User ID required for sync");
  
  try {
    const userRef = doc(db, "ceo_vaults", userId);
    await setDoc(userRef, {
      ...data,
      lastUpdated: serverTimestamp(),
      platform: "web-mobile-v1"
    }, { merge: true });
    return true;
  } catch (error) {
    console.error("Firestore Sync Error:", error);
    throw error;
  }
};

/**
 * Retrieves the stored vault from Firestore
 */
export const fetchVaultFromCloud = async (userId: string) => {
  if (!userId) throw new Error("User ID required for fetch");
  
  try {
    const userRef = doc(db, "ceo_vaults", userId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Firestore Fetch Error:", error);
    throw error;
  }
};
