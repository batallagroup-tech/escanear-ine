import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  durationMs = 2400,
}) => {
  const [isFading, setIsFading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, durationMs - 350);

    const finishTimer = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[#F7F5F0] text-stone-900 select-none transition-opacity duration-300 ease-out px-6 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 60px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 44px)',
      }}
    >
      {/* Top institutional bar accent in Navy Blue */}
      <div className="w-16 h-1.5 rounded-full bg-[#0F2C59]" />

      {/* Center content: Logo & Title */}
      <div className="flex flex-col items-center text-center">
        <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-lg border border-stone-200 bg-white flex items-center justify-center p-3 mb-6">
          <img
            src="/icon_512.png"
            alt="Escanear INE"
            className="w-full h-full object-contain rounded-2xl"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 mb-1.5">
          Escanear INE
        </h1>
        <p className="text-stone-600 text-sm font-medium mb-8">
          Credenciales, Pasaportes y Documentos
        </p>

        {/* Sober loading bar in Navy Blue */}
        <div className="w-36 h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#0F2C59] rounded-full animate-[progress_2s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Footer: Desarrollado por Batalla Group */}
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-stone-500 text-[11px] font-semibold uppercase tracking-wider">
          Desarrollado por
        </span>
        <span className="text-[#0F2C59] font-extrabold text-sm tracking-widest uppercase">
          Batalla Group
        </span>
      </div>
    </div>
  );
};

export default SplashScreen;
