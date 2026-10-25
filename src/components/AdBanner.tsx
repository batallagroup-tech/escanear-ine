import React, { useEffect } from 'react';
import { showBanner, hideBanner } from '../services/admobService';
import { Capacitor } from '@capacitor/core';

export const AdBanner: React.FC = () => {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      showBanner().catch(() => {});
    }
    return () => {
      if (Capacitor.isNativePlatform()) {
        hideBanner().catch(() => {});
      }
    };
  }, []);

  if (Capacitor.isNativePlatform()) {
    // Native AdMob overlays at the bottom automatically
    return null;
  }

  // Web/Development placeholder
  return (
    <div className="w-full py-1.5 bg-slate-950/80 border-t border-slate-800 text-center text-[10px] text-slate-500 font-mono tracking-wider">
      [ESPACIO PUBLICITARIO ADMOB • BANNER ADAPTATIVO]
    </div>
  );
};
