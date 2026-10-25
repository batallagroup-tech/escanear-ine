import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onSave: (signatureDataUrl: string) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onSave,
  onClose,
  isDarkMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState<'#0F2C59' | '#1C1917'>('#0F2C59'); // Default blue ink

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI canvas
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = penColor;
  }, [isOpen, penColor]);

  if (!isOpen) return null;

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 select-none">
      <div
        className={`relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col border ${
          isDarkMode
            ? 'border-stone-800 bg-[#18181b] text-stone-100'
            : 'border-stone-200 bg-white text-stone-900'
        }`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDarkMode ? 'border-stone-800' : 'border-stone-200'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-base">
            <PenTool size={18} className={isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'} />
            <h3>Firmar Documento con el dedo</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl ${
              isDarkMode
                ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Ink Color Selector */}
        <div className="flex items-center justify-between my-3 px-1">
          <span className={`text-xs font-semibold ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>
            Color de tinta:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPenColor('#0F2C59')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                penColor === '#0F2C59'
                  ? 'bg-[#0F2C59] text-white border-[#2563EB]'
                  : isDarkMode
                  ? 'bg-[#242429] text-stone-300 border-stone-700'
                  : 'bg-white text-stone-700 border-stone-200'
              }`}
            >
              Tinta Azul (Oficial)
            </button>
            <button
              onClick={() => setPenColor('#1C1917')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                penColor === '#1C1917'
                  ? 'bg-black text-white border-stone-600'
                  : isDarkMode
                  ? 'bg-[#242429] text-stone-300 border-stone-700'
                  : 'bg-white text-stone-700 border-stone-200'
              }`}
            >
              Tinta Negra
            </button>
          </div>
        </div>

        {/* Signature Drawing Canvas (kept white so blue/black ink is clearly visible as on paper) */}
        <div className="relative w-full h-44 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 overflow-hidden touch-none flex flex-col justify-end p-2 mb-3">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 w-full h-full cursor-crosshair"
          />
          <div className="pointer-events-none w-full border-b border-stone-300 pb-1 text-center">
            <span className="text-[11px] text-stone-400">Firma aquí sobre la línea</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              isDarkMode
                ? 'bg-[#242429] hover:bg-stone-800 text-stone-200 border border-stone-700'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <RotateCcw size={15} />
            <span>Borrar</span>
          </button>

          <button
            onClick={handleConfirm}
            disabled={!hasDrawn}
            className="flex-1 py-3 px-4 rounded-xl bg-[#0F2C59] hover:bg-[#0A1F3D] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
          >
            <Check size={16} />
            <span>Estampar Firma en la Hoja</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
