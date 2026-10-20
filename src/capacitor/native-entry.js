/* Capacitor shell — bundled to native.bundle.js for Android WebView */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#1e9e3e' });
    await StatusBar.setStyle({ style: Style.Light });
  } catch (_) {
    /* status bar plugin optional at runtime */
  }

  App.addListener('backButton', () => {
    if (typeof window.TenDrinks_handleAndroidBack === 'function') {
      window.TenDrinks_handleAndroidBack();
    }
  });

  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    if (typeof window.healStuckBodyScroll === 'function') {
      window.healStuckBodyScroll();
    }
    const d = typeof Tracker !== 'undefined' && Tracker.data
      ? Tracker.data
      : (typeof DataManager !== 'undefined' ? DataManager.load() : null);
    if (typeof refreshEntitlementIfChanged === 'function') refreshEntitlementIfChanged(d);
    else if (d && typeof UI !== 'undefined' && UI.renderAll) UI.renderAll(d);
  });
}

initNativeShell();
