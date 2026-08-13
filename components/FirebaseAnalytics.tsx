"use client";

import { useEffect } from "react";
import { getFirebaseAnalytics } from "@/lib/firebase";

export default function FirebaseAnalytics() {
  useEffect(() => {
    getFirebaseAnalytics().catch((error) =>
      console.error("Firebase Analytics init failed:", error)
    );
  }, []);

  return null;
}