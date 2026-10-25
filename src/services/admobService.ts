import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import type { BannerAdOptions, AdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export const ADMOB_CONFIG = {
  // Official Production AdMob IDs
  appId: 'ca-app-pub-3849768825456219~7871693028',
  bannerId: 'ca-app-pub-3849768825456219/7974886379',
  interstitialId: 'ca-app-pub-3849768825456219/3017861135',
  
  // Google Official Testing AdMob IDs (fallback during development)
  testBannerId: 'ca-app-pub-3940256099942544/6300978111',
  testInterstitialId: 'ca-app-pub-3940256099942544/1033173712',
};

let isInitialized = false;
let isInterstitialPrepared = false;

export async function initAdMob(): Promise<void> {
  if (isInitialized) return;
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await AdMob.initialize({
      initializeForTesting: false,
    });
    isInitialized = true;
    prepareInterstitial().catch(() => {});
  } catch (err) {
    console.warn('[AdMob] Initialization warning:', err);
  }
}

export async function showBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await initAdMob();

  try {
    const options: BannerAdOptions = {
      adId: ADMOB_CONFIG.bannerId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    };
    await AdMob.showBanner(options);
  } catch (err) {
    console.warn('[AdMob] showBanner warning:', err);
  }
}

export async function hideBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.hideBanner();
  } catch {
    // Ignore
  }
}

export async function prepareInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await initAdMob();

  try {
    const options: AdOptions = {
      adId: ADMOB_CONFIG.interstitialId,
      isTesting: false,
    };
    await AdMob.prepareInterstitial(options);
    isInterstitialPrepared = true;
  } catch (err) {
    console.warn('[AdMob] prepareInterstitial warning:', err);
  }
}

export async function showInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (!isInterstitialPrepared) {
      await prepareInterstitial();
    }
    await AdMob.showInterstitial();
    isInterstitialPrepared = false;
    setTimeout(() => prepareInterstitial().catch(() => {}), 1000);
  } catch (err) {
    console.warn('[AdMob] showInterstitial warning (non-blocking):', err);
    isInterstitialPrepared = false;
  }
}
