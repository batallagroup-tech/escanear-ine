import React, { useState } from 'react';
import {
  X,
  FileText,
  Shield,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Star,
  Lock,
  Moon,
  Sun,
  Fingerprint,
} from 'lucide-react';
import {
  isSecurityLockEnabled,
  setSecurityLockEnabled,
  authenticateDeviceUser,
} from '../services/securityService';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTutorial: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (dark: boolean) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  onOpenTutorial,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [isLockedOn, setIsLockedOn] = useState(() => isSecurityLockEnabled());
  const [isTestingAuth, setIsTestingAuth] = useState(false);

  if (!isOpen) return null;

  const handleToggleLock = async () => {
    if (!isLockedOn) {
      // Prompt user to verify biometric or PIN before activating
      setIsTestingAuth(true);
      const success = await authenticateDeviceUser('Confirma tu huella o PIN para activar el bloqueo');
      setIsTestingAuth(false);
      if (success) {
        setSecurityLockEnabled(true);
        setIsLockedOn(true);
      }
    } else {
      // Disabling lock
      setSecurityLockEnabled(false);
      setIsLockedOn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div
        className={`relative w-full max-w-xs border-r flex flex-col h-full z-10 shadow-2xl transition-colors ${
          isDarkMode
            ? 'bg-[#18181b] border-stone-800 text-stone-100'
            : 'bg-[#F7F5F0] border-stone-200 text-stone-900'
        }`}
      >
        {/* Header in Navy Blue with safe-area padding */}
        <div
          className="px-5 pb-4 bg-[#0F2C59] text-white flex items-center justify-between shadow-sm"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm">
              <img src="/icon_512.png" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Escanear INE</h2>
              <span className="text-xs text-stone-200 font-medium">
                Ajustes y Ayuda
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section: Apariencia (Modo Oscuro) */}
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
              <Sun size={14} className={isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'} />
              Apariencia
            </h3>
            <div
              className={`p-3 rounded-xl border flex items-center justify-between shadow-sm ${
                isDarkMode ? 'bg-[#242427] border-stone-800' : 'bg-white border-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isDarkMode ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-amber-500" />}
                <div>
                  <span className="text-xs font-bold block">
                    Modo Oscuro
                  </span>
                  <span className={`text-[10px] ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                    {isDarkMode ? 'Tema nocturno activo' : 'Tema claro estándar'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onToggleDarkMode?.(!isDarkMode)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                  isDarkMode ? 'bg-[#2563EB]' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section: Seguridad (Bloqueo con Huella/PIN) */}
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
              <Lock size={14} className={isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'} />
              Seguridad y Privacidad
            </h3>
            <div
              className={`p-3 rounded-xl border flex items-center justify-between shadow-sm mb-2 ${
                isDarkMode ? 'bg-[#242427] border-stone-800' : 'bg-white border-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Fingerprint size={20} className={isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'} />
                <div>
                  <span className="text-xs font-bold block">
                    Bloqueo con Huella / PIN
                  </span>
                  <span className={`text-[10px] ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                    {isLockedOn ? 'Pedir al abrir la app' : 'Desactivado'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleToggleLock}
                disabled={isTestingAuth}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                  isLockedOn ? 'bg-emerald-600' : isDarkMode ? 'bg-stone-700' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    isLockedOn ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section: Ayuda y Legal */}
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
              <HelpCircle size={14} className={isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'} />
              Ayuda y Legal
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenTutorial();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold shadow-sm transition-colors ${
                  isDarkMode
                    ? 'bg-[#242427] border-stone-800 text-stone-100 hover:bg-stone-800'
                    : 'bg-white border-stone-200 text-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className={isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'} />
                  <span>Cómo usar la aplicación</span>
                </div>
                <ChevronRight size={16} className="text-stone-400" />
              </button>

              <a
                href="https://batallagroup-tech.github.io/escanear-ine-privacidad.html"
                target="_blank"
                rel="noreferrer"
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold shadow-sm transition-colors ${
                  isDarkMode
                    ? 'bg-[#242427] border-stone-800 text-stone-100 hover:bg-stone-800'
                    : 'bg-white border-stone-200 text-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Shield size={18} className={isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'} />
                  <span>Aviso de Privacidad</span>
                </div>
                <ExternalLink size={15} className="text-stone-400" />
              </a>

              <a
                href="https://play.google.com/store/apps/details?id=com.batallagroup.escanearine"
                target="_blank"
                rel="noreferrer"
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold shadow-sm transition-colors ${
                  isDarkMode
                    ? 'bg-[#242427] border-stone-800 text-stone-100 hover:bg-stone-800'
                    : 'bg-white border-stone-200 text-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Star size={18} className="text-amber-500 fill-amber-500" />
                  <span>Calificar en Google Play</span>
                </div>
                <ExternalLink size={15} className="text-stone-400" />
              </a>
            </div>
          </div>

          {/* Practical info box */}
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-1.5 shadow-sm ${
              isDarkMode ? 'bg-[#242427] border-stone-800 text-stone-300' : 'bg-white border-stone-200 text-stone-700'
            }`}
          >
            <div className={`flex items-center gap-2 font-bold text-sm ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`}>
              <CheckCircle2 size={16} />
              <span>Todo para tus trámites</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Escanea credenciales, pasaportes o actas en tamaño Carta u Oficio al 100% o ampliadas al 200%.
            </p>
            <p className={`text-[10px] pt-1 border-t ${isDarkMode ? 'text-stone-400 border-stone-800' : 'text-stone-500 border-stone-200/50'}`}>
              100% privado: tus documentos se guardan únicamente en la memoria de tu teléfono.
            </p>
          </div>
        </div>

        {/* Footer (Lifted cleanly above the AdMob banner) */}
        <div
          className={`p-4 border-t flex flex-col items-center text-center gap-0.5 ${
            isDarkMode ? 'bg-[#18181b] border-stone-800' : 'bg-white border-stone-200'
          }`}
          style={{
            paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 18px) + 80px)',
          }}
        >
          <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
            Desarrollado por
          </span>
          <span className={`text-xs font-extrabold tracking-widest uppercase ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`}>
            Batalla Group
          </span>
          <span className="text-[11px] text-stone-400 mt-0.5">Versión 1.0.9</span>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
