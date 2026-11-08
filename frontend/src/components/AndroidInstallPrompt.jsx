import { useState, useEffect } from 'react';

const APK_URL = 'https://github.com/faesteban/ayni/releases/download/latest/Ayni.apk';

export function AndroidInstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if device is Android
    const isAndroid = /android/i.test(navigator.userAgent || '');
    if (!isAndroid) return;

    // Check if app is already running in standalone/native mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://') ||
      Boolean(window.Capacitor?.isNativePlatform?.());

    if (isStandalone) return;

    // Check dismissal in localStorage (dismiss for 5 days)
    const dismissedUntil = localStorage.getItem('ayni_android_prompt_dismissed');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // Listen for Chrome PWA install event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Show banner anyway for Android browsers even if beforeinstallprompt is delayed
    const timer = setTimeout(() => {
      setShow(true);
    }, 1200);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback: download APK directly
      window.open(APK_URL, '_blank');
    }
  };

  const handleDownloadApk = () => {
    window.open(APK_URL, '_blank');
  };

  const handleDismiss = () => {
    setShow(false);
    // Dismiss for 5 days
    localStorage.setItem('ayni_android_prompt_dismissed', String(Date.now() + 5 * 24 * 60 * 60 * 1000));
  };

  if (!show) return null;

  return (
    <aside className="android-install-banner" aria-label="Instalar aplicación en Android">
      <div className="android-install-header">
        <div className="android-install-icon">
          <img src="/pwa-192x192.png" alt="Ayni" width="40" height="40" onError={(e) => { e.currentTarget.src = '/favicon.svg'; }} />
        </div>
        <div className="android-install-info">
          <div className="android-install-title">Instala Ayni en Android</div>
          <div className="android-install-subtitle">
            Acceso rápido, sin barras y con notificaciones.
          </div>
        </div>
        <button
          className="android-install-close"
          onClick={handleDismiss}
          title="Cerrar aviso"
          aria-label="Cerrar aviso"
        >
          ✕
        </button>
      </div>

      <div className="android-install-actions">
        <button
          className="btn btn-primary btn-sm android-install-btn"
          onClick={handleInstall}
        >
          📲 {deferredPrompt ? 'Instalar App' : 'Descargar App'}
        </button>
        <button
          className="btn btn-ghost btn-sm android-install-btn"
          onClick={handleDownloadApk}
          title="Descargar archivo APK directamente"
        >
          📥 Descargar APK
        </button>
      </div>
    </aside>
  );
}
