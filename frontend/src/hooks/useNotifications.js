import { useEffect } from 'react';
import { api } from '../api/client';

const VAPID_KEY_URL = '/api/notifications/vapid-key';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Push notifications not supported');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    const { publicKey } = await api.auth.me()
      .then(() => fetch('/api/notifications/vapid-key').then(r => r.json()))
      .catch(() => ({ publicKey: null }));

    if (!publicKey) {
      console.warn('VAPID key not available');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send subscription to server
    const sub = subscription.toJSON();
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ayni_session')}`,
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.keys,
      }),
    });

    return true;
  } catch (err) {
    console.error('Failed to subscribe to push:', err);
    return false;
  }
}

export function useNotifications() {
  useEffect(() => {
    // Auto-request notifications after a short delay (UX: don't ask immediately on load)
    const session = localStorage.getItem('ayni_session');
    if (!session) return;

    const hasAsked = localStorage.getItem('ayni_notif_asked');
    if (hasAsked) return;

    const timer = setTimeout(async () => {
      if (Notification.permission === 'default') {
        // Don't auto-prompt; let user trigger it manually or via a prompt
        localStorage.setItem('ayni_notif_asked', 'true');
      } else if (Notification.permission === 'granted') {
        await requestNotificationPermission();
        localStorage.setItem('ayni_notif_asked', 'true');
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);
}
