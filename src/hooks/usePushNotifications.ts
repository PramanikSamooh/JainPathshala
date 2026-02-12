"use client";

import { useEffect, useState, useCallback } from "react";

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | "default";
}

/**
 * Hook for managing push notification subscription.
 * Registers the service worker and subscribes to push.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    permission: "default",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setState((s) => ({
      ...s,
      isSupported: supported,
      permission: Notification.permission,
    }));

    if (!supported) return;

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setState((s) => ({ ...s, isSubscribed: !!sub }));
      })
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  const subscribe = useCallback(async () => {
    if (!state.isSupported) return null;

    const permission = await Notification.requestPermission();
    setState((s) => ({ ...s, permission }));

    if (permission !== "granted") return null;

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidKey) {
      console.error("VAPID public key not configured");
      return null;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    // Send subscription to server
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    setState((s) => ({ ...s, isSubscribed: true }));
    return subscription;
  }, [state.isSupported]);

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    }
    setState((s) => ({ ...s, isSubscribed: false }));
  }, []);

  return { ...state, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}
