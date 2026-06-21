'use client';

import { notificationsApi } from './api';

/** base64url VAPID kulcs → Uint8Array (a PushManager.subscribe ezt várja). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Igaz, ha a böngésző támogatja a push értesítéseket. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** A jelenlegi engedély állapota ('default' | 'granted' | 'denied'). */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // A next-pwa regisztrálja a /sw.js-t; megvárjuk, hogy kész legyen.
  return navigator.serviceWorker.ready;
}

/** Igaz, ha már van aktív push feliratkozás. */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  return sub !== null;
}

/**
 * Engedély kérése + feliratkozás + a feliratkozás elküldése a backendnek.
 * Visszaadja, hogy sikerült-e.
 */
export async function enablePush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const { publicKey, enabled } = await notificationsApi.getVapidKey();
  if (!enabled || !publicKey) return false;

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = sub.toJSON();
  await notificationsApi.subscribe({
    endpoint: sub.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    userAgent: navigator.userAgent,
  });
  return true;
}

/** Leiratkozás a böngészőben és a backenden is. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await notificationsApi.unsubscribe(endpoint);
}
