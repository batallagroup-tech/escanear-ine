import React, { useState } from 'react';
import { Camera, Sliders, Printer, CheckCircle, ArrowRight, X } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

const STEPS = [
  {
    icon: Camera,
    title: 'Escanea INE, Pasaporte o Documentos',
    description:
      'Puedes escanear tu credencial por ambos lados, tu pasaporte o documentos completos como CURP, acta de nacimiento y comprobantes.',
  },
  {
    icon: Sliders,
    title: 'Recorte Inteligente y Quita-Sombras',
    description:
      'Recorta las 4 esquinas de forma automática o manual con la lupa alejada de tu dedo, y aclara las sombras para una impresión nítida.',
  },
  {
    icon: Printer,
    title: 'Formatos Carta y Oficio',
    description:
      'Elige Hoja Carta, Hoja Oficio o solo el recorte. Tus credenciales quedan acomodadas al tamaño real listas para cualquier trámite.',
  },
  {
    icon: CheckCircle,
    title: 'Guarda en PDF, Word o Imagen',
    description:
      'Comparte tu documento por WhatsApp o correo electrónico en formato PDF, Word (.docx) o imagen listo para papelería.',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  isDarkMode = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className={`relative w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center border ${
          isDarkMode
            ? 'bg-[#18181b] border-stone-800 text-stone-100'
            : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-xl transition ${
            isDarkMode
              ? 'text-stone-400 hover:text-stone-100 bg-stone-800'
              : 'text-stone-500 hover:text-stone-800 bg-stone-100'
          }`}
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className={`mb-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
            isDarkMode ? 'bg-stone-800 text-blue-400' : 'bg-stone-100 text-[#0F2C59]'
          }`}
        >
          <span>Paso {currentStep + 1} de {STEPS.length}</span>
        </div>

        <div
          className={`w-16 h-16 rounded-2xl p-4 flex items-center justify-center mb-4 ${
            isDarkMode ? 'bg-[#0F2C59]/40 text-blue-400' : 'bg-[#0F2C59]/10 text-[#0F2C59]'
          }`}
        >
          <StepIcon className="w-9 h-9" />
        </div>

        <h3 className={`text-lg font-extrabold mb-2 ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
          {step.title}
        </h3>
        <p className={`text-xs leading-relaxed mb-6 px-1 min-h-[64px] ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>
          {step.description}
        </p>

        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? isDarkMode
                    ? 'w-6 bg-blue-500'
                    : 'w-6 bg-[#0F2C59]'
                  : isDarkMode
                  ? 'w-2 bg-stone-700'
                  : 'w-2 bg-stone-300'
              }`}
            />
          ))}
        </div>

        <div className="w-full flex items-center gap-3">
          {currentStep < STEPS.length - 1 ? (
            <>
              <button
                onClick={onClose}
                className={`flex-1 py-3 text-xs font-bold transition ${
                  isDarkMode ? 'text-stone-400 hover:text-stone-200' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Cerrar
              </button>
              <button
                onClick={handleNext}
                className="flex-2 py-3 px-5 rounded-xl bg-[#0F2C59] hover:bg-[#0A1F3D] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0F2C59] hover:bg-[#0A1F3D] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition active:scale-95"
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
