import React, { useState, useEffect, useRef } from 'react';
import type { DocumentFilter } from '../types';
import { applyDocumentFilters, rotateImage90, applyCensorship } from '../services/imageProcessing';
import { Sun, Contrast, UserCheck, Check, ShieldAlert, RotateCw, Undo2, Crop } from 'lucide-react';

interface FilterStudioProps {
  sideTitle: string;
  warpedImage: string;
  onApply: (processedImage: string) => void;
  onBack: () => void;
  isDarkMode?: boolean;
}

interface CensorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FilterStudio: React.FC<FilterStudioProps> = ({
  sideTitle,
  warpedImage,
  onApply,
  onBack,
  isDarkMode = false,
}) => {
  const [currentBaseImage, setCurrentBaseImage] = useState<string>(warpedImage);
  const [filter, setFilter] = useState<DocumentFilter>('hd-color');
  const [shadowLift, setShadowLift] = useState(30);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(5);
  const [previewImage, setPreviewImage] = useState<string>(warpedImage);
  const [isProcessing, setIsProcessing] = useState(false);

  // Censorship / privacy blackout mode
  const [isCensorMode, setIsCensorMode] = useState(false);
  const [censorRects, setCensorRects] = useState<CensorRect[]>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await applyDocumentFilters(
          currentBaseImage,
          filter,
          shadowLift,
          brightness,
          contrast
        );
        if (!isCancelled) {
          setPreviewImage(result);
          setIsProcessing(false);
        }
      } catch (err) {
        console.warn('Filter processing error:', err);
        setIsProcessing(false);
      }
    }, 70);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [currentBaseImage, filter, shadowLift, brightness, contrast]);

  const handleRotate = async () => {
    try {
      const rotated = await rotateImage90(currentBaseImage);
      setCurrentBaseImage(rotated);
      setCensorRects([]);
    } catch (e) {
      console.warn('Rotation error:', e);
    }
  };

  const handleApplyWithCensorship = async () => {
    if (censorRects.length > 0 && imgElementRef.current) {
      const img = imgElementRef.current;
      const naturalW = img.naturalWidth || 1280;
      const naturalH = img.naturalHeight || 807;
      const renderW = img.clientWidth;
      const renderH = img.clientHeight;

      const scaleX = naturalW / renderW;
      const scaleY = naturalH / renderH;

      const scaledRects = censorRects.map((r) => ({
        x: Math.round(r.x * scaleX),
        y: Math.round(r.y * scaleY),
        width: Math.round(r.width * scaleX),
        height: Math.round(r.height * scaleY),
      }));

      const finalWithCensorship = await applyCensorship(previewImage, scaledRects);
      onApply(finalWithCensorship);
    } else {
      onApply(previewImage);
    }
  };

  // Censorship touch/mouse drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isCensorMode || !imgElementRef.current) return;
    const rect = imgElementRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setDragStart({ x, y });
    setCurrentDrag({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isCensorMode || !dragStart || !imgElementRef.current) return;
    const rect = imgElementRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setCurrentDrag({ x, y });
  };

  const handlePointerUp = () => {
    if (!isCensorMode || !dragStart || !currentDrag) return;
    const x1 = Math.min(dragStart.x, currentDrag.x);
    const y1 = Math.min(dragStart.y, currentDrag.y);
    const w = Math.abs(currentDrag.x - dragStart.x);
    const h = Math.abs(currentDrag.y - dragStart.y);

    // If dragged or tapped (minimum box size)
    const finalW = Math.max(w, 40);
    const finalH = Math.max(h, 18);

    setCensorRects((prev) => [
      ...prev,
      {
        x: Math.round(x1),
        y: Math.round(y1),
        width: Math.round(finalW),
        height: Math.round(finalH),
      },
    ]);

    setDragStart(null);
    setCurrentDrag(null);
  };

  const filterOptions: { id: DocumentFilter; label: string; desc: string }[] = [
    { id: 'hd-color', label: 'Color Nítido', desc: 'Recomendado' },
    { id: 'photocopy-bw', label: 'Blanco y Negro', desc: 'Fotocopia' },
    { id: 'laser-gray', label: 'Tonos Grises', desc: 'Impresora' },
    { id: 'original', label: 'Original', desc: 'Sin filtro' },
  ];

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-[#121214] text-stone-100' : 'bg-[#F7F5F0] text-stone-900'
      }`}
    >
      {/* Top Header in Navy Blue with safe-area padding */}
      <div
        className="px-4 pb-3.5 bg-[#0F2C59] text-white flex items-center justify-between shadow-md"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)' }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition flex items-center gap-1"
          title="Ajustar esquinas manualmente"
        >
          <Crop className="w-3.5 h-3.5" />
          <span>Recortar</span>
        </button>

        <div className="text-center">
          <h3 className="text-sm font-bold text-white">
            Mejorar y Ajustar ({sideTitle})
          </h3>
          <p className="text-[11px] text-stone-200">Aclara sombras y oculta datos si deseas</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRotate}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition active:scale-95"
            title="Girar 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleApplyWithCensorship}
            className="px-4 py-1.5 rounded-xl bg-white text-[#0F2C59] text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Listo</span>
          </button>
        </div>
      </div>

      {/* Center Document Preview with Censorship Overlay */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div
          ref={imageContainerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative max-w-sm max-h-[50vh] w-full flex items-center justify-center ${
            isCensorMode ? 'cursor-crosshair touch-none' : ''
          }`}
        >
          <img
            ref={imgElementRef}
            src={previewImage}
            alt="Vista previa"
            className="max-w-full max-h-[48vh] w-auto h-auto object-contain rounded-xl shadow-lg border border-stone-200 bg-white pointer-events-none select-none"
          />

          {/* Render existing censorship rectangles */}
          {censorRects.map((r, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${r.x}px`,
                top: `${r.y}px`,
                width: `${r.width}px`,
                height: `${r.height}px`,
              }}
              className="bg-black rounded-sm border border-stone-500 shadow-sm pointer-events-none"
            />
          ))}

          {/* Active drag preview rectangle */}
          {isCensorMode && dragStart && currentDrag && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(dragStart.x, currentDrag.x)}px`,
                top: `${Math.min(dragStart.y, currentDrag.y)}px`,
                width: `${Math.abs(currentDrag.x - dragStart.x)}px`,
                height: `${Math.abs(currentDrag.y - dragStart.y)}px`,
              }}
              className="bg-black/85 border-2 border-red-500 rounded-sm pointer-events-none"
            />
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-white/30 flex items-center justify-center rounded-xl pointer-events-none">
              <div className="w-6 h-6 border-2 border-[#0F2C59] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Censorship Mode Prompt if active */}
      {isCensorMode && (
        <div className="bg-[#0F2C59] text-white py-2 px-4 flex items-center justify-between text-xs font-semibold shadow-md">
          <span>Toca o arrastra sobre el dato que quieras tachar (firma, clave, dirección)</span>
          {censorRects.length > 0 && (
            <button
              onClick={() => setCensorRects((prev) => prev.slice(0, -1))}
              className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 flex items-center gap-1 text-[11px]"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Deshacer ({censorRects.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Bottom Adjustment Controls */}
      <div
        className={`px-5 pt-3 border-t flex flex-col gap-2.5 shadow-lg transition-colors ${
          isDarkMode ? 'bg-[#18181b] border-stone-800' : 'bg-white border-stone-200'
        }`}
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 74px)' }}
      >
        {/* Toggle Censorship Tool & Recrop */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
              isDarkMode
                ? 'bg-[#0F2C59]/30 border-blue-900/60 text-blue-300 hover:bg-[#0F2C59]/50'
                : 'bg-blue-50 border-blue-200 text-[#0F2C59] hover:bg-blue-100'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Esquinas</span>
          </button>

          <button
            onClick={() => setIsCensorMode(!isCensorMode)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
              isCensorMode
                ? 'bg-black text-white border-black'
                : isDarkMode
                ? 'bg-[#242429] border-stone-700 text-stone-200 hover:bg-stone-800'
                : 'bg-stone-100 border-stone-300 text-stone-800 hover:bg-stone-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>{isCensorMode ? 'Terminar de Censurar' : 'Censurar Datos Sensibles'}</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="grid grid-cols-4 gap-2">
          {filterOptions.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`py-2 px-1.5 rounded-xl text-center border transition flex flex-col items-center justify-center ${
                  isActive
                    ? 'bg-[#0F2C59] border-[#2563EB] text-white shadow-sm'
                    : isDarkMode
                    ? 'bg-[#242429] border-stone-800 text-stone-300 hover:bg-stone-800'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span className="text-xs font-bold leading-tight">{f.label}</span>
                <span
                  className={`text-[10px] leading-tight mt-0.5 ${
                    isActive ? 'text-stone-200' : isDarkMode ? 'text-stone-400' : 'text-stone-500'
                  }`}
                >
                  {f.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sliders Container */}
        <div
          className={`flex flex-col gap-2.5 p-3 rounded-2xl border ${
            isDarkMode ? 'bg-[#242429] border-stone-800' : 'bg-stone-50 border-stone-200'
          }`}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                <UserCheck className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`} />
                Quitar sombras del rostro y texto:
              </span>
              <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`}>{shadowLift}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={shadowLift}
              onChange={(e) => setShadowLift(Number(e.target.value))}
              className={`w-full accent-[#2563EB] h-2 rounded-lg cursor-pointer ${
                isDarkMode ? 'bg-stone-700' : 'bg-stone-200'
              }`}
            />
          </div>

          <div className={`grid grid-cols-2 gap-4 pt-1.5 border-t ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
            <div className="flex flex-col gap-1">
              <div className={`flex items-center justify-between text-xs font-semibold ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                <span className="flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  Brillo:
                </span>
                <span>{brightness}</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className={`w-full accent-[#2563EB] h-1.5 rounded-lg cursor-pointer ${
                  isDarkMode ? 'bg-stone-700' : 'bg-stone-200'
                }`}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className={`flex items-center justify-between text-xs font-semibold ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                <span className="flex items-center gap-1">
                  <Contrast className={`w-3.5 h-3.5 ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`} />
                  Contraste:
                </span>
                <span>{contrast}</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className={`w-full accent-[#2563EB] h-1.5 rounded-lg cursor-pointer ${
                  isDarkMode ? 'bg-stone-700' : 'bg-stone-200'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterStudio;
