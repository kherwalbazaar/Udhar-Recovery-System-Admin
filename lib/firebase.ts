import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAMmU5PDKf92V9x0NxtO_gfieoRpa4jTz4",
  authDomain: "aia-store-40131.firebaseapp.com",
  databaseURL: "https://aia-store-40131-default-rtdb.firebaseio.com",
  projectId: "aia-store-40131",
  storageBucket: "aia-store-40131.firebasestorage.app",
  messagingSenderId: "290331662057",
  appId: "1:290331662057:web:ab9fa50602d3d800f04278",
  measurementId: "G-MRDYXJD31W",
};

export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db: Database = getDatabase(app);

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  return getAnalytics(app);
}