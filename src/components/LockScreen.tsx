import React, { useEffect, useState } from 'react';
import { ShieldCheck, Fingerprint, Lock, RefreshCw } from 'lucide-react';
import { authenticateDeviceUser } from '../services/securityService';

interface LockScreenProps {
  onUnlock: () => void;
  isDarkMode?: boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, isDarkMode = false }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState(false);

  const attemptUnlock = async () => {
    setIsAuthenticating(true);
    setAuthError(false);
    const success = await authenticateDeviceUser('Desbloquea para ver tus documentos protegidos');
    setIsAuthenticating(false);
    if (success) {
      onUnlock();
    } else {
      setAuthError(true);
    }
  };

  useEffect(() => {
    // Automatically trigger biometric/PIN prompt on appear
    const timer = setTimeout(() => {
      attemptUnlock();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 select-none ${
        isDarkMode ? 'bg-[#121212] text-stone-100' : 'bg-[#F7F5F0] text-stone-900'
      }`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 36px)',
      }}
    >
      {/* Top Header */}
      <div className="flex flex-col items-center gap-2 pt-6">
        <div className="w-16 h-16 rounded-2xl bg-[#0F2C59] flex items-center justify-center text-white shadow-lg">
          <ShieldCheck size={36} />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">Escanear INE</h1>
        <span className="text-xs text-stone-500 font-medium">Documentos Protegidos</span>
      </div>

      {/* Center Biometric Visual */}
      <div className="flex flex-col items-center text-center max-w-xs">
        <div
          onClick={attemptUnlock}
          className="w-24 h-24 rounded-full bg-[#0F2C59]/10 border-2 border-[#0F2C59]/30 flex items-center justify-center text-[#0F2C59] cursor-pointer active:scale-95 transition shadow-sm mb-4"
        >
          <Fingerprint size={52} className="animate-pulse" />
        </div>
        <h2 className="text-base font-bold mb-1.5">Bloqueo de Seguridad Activo</h2>
        <p className="text-xs text-stone-500 leading-relaxed mb-4">
          Toca el botón o el sensor para desbloquear con tu huella dactilar, Face ID o PIN de tu teléfono.
        </p>

        {authError && (
          <div className="px-3.5 py-2 rounded-xl bg-red-100 text-red-800 text-xs font-semibold mb-2">
            No se pudo verificar la identidad. Intenta de nuevo.
          </div>
        )}
      </div>

      {/* Bottom Unlock Button */}
      <div className="w-full max-w-xs flex flex-col gap-2">
        <button
          onClick={attemptUnlock}
          disabled={isAuthenticating}
          className="w-full py-4 px-6 rounded-2xl bg-[#0F2C59] hover:bg-[#0A1F3D] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition disabled:opacity-60"
        >
          {isAuthenticating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verificando...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Desbloquear con Huella o PIN</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LockScreen;
