"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker.
 *
 * Production only: in development Next serves uncached, non-hashed assets and
 * relies on HMR, which a caching worker interferes with.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Offline support is an enhancement — the app still works without it.
        console.error("Service worker registration failed:", err);
      });
    };

    // Wait for load so precaching competes less with the first render.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
