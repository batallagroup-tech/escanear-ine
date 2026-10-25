import React, { useRef, useEffect, useState } from 'react';
import type {
  PaperSize,
  PageOrientation,
  SheetLayout,
  DocumentType,
  PageItem,
  SignaturePosition,
} from '../types';
import { PAPER_SPECS } from '../types';
import { renderFullSheetCanvas } from '../services/sheetRenderer';
import { SignatureModal } from './SignatureModal';
import {
  Layers,
  FileText,
  Share2,
  Printer,
  RotateCw,
  Camera,
  CheckCircle2,
  ArrowLeft,
  Shield,
  Plus,
  PenTool,
  Trash2,
} from 'lucide-react';

interface SheetPreviewProps {
  frontImage?: string;
  backImage?: string;
  pages?: PageItem[];
  initialPaperSize?: PaperSize;
  docType?: DocumentType;
  onChangePaperSize?: (p: PaperSize) => void;
  onOpenExport: (
    watermarkText?: string,
    signatureImage?: string,
    signatureScale?: number,
    signaturePosition?: SignaturePosition,
    signatureLabel?: string
  ) => void;
  onAddAnotherPage?: () => void;
  onDeletePage?: (pageIndex: number) => void;
  onRetake: () => void;
  onGoHome?: () => void;
  isDarkMode?: boolean;
}

export const SheetPreview: React.FC<SheetPreviewProps> = ({
  frontImage,
  backImage,
  pages = [],
  initialPaperSize = 'carta',
  docType = 'ine',
  onChangePaperSize,
  onOpenExport,
  onAddAnotherPage,
  onDeletePage,
  onRetake,
  onGoHome,
  isDarkMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active page viewing index (0 = primary page, 1+ = additional pages)
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [paperSize, setPaperSize] = useState<PaperSize>(initialPaperSize);
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [layout, setLayout] = useState<SheetLayout>(
    backImage ? 'vertical-stacked' : 'single-front'
  );
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [watermarkText, setWatermarkText] = useState<string>('');

  // Signature customization
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureScale, setSignatureScale] = useState<number>(100);
  const [signaturePosition, setSignaturePosition] = useState<SignaturePosition>('bottom-center');
  const [signatureLabel, setSignatureLabel] = useState<string>('Firma del Titular');
  const [showSignatureLabel, setShowSignatureLabel] = useState<boolean>(true);

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'paper' | 'watermark' | 'signature'>('layout');

  const handleSelectPaper = (p: PaperSize) => {
    setPaperSize(p);
    onChangePaperSize?.(p);
  };

  // Determine what to display on the preview canvas based on activePageIndex
  const displayedFront =
    activePageIndex === 0 ? frontImage : pages[activePageIndex - 1]?.frontImage || frontImage;
  const displayedBack =
    activePageIndex === 0 ? backImage : pages[activePageIndex - 1]?.backImage;
  const displayedDocType =
    activePageIndex === 0 ? docType : pages[activePageIndex - 1]?.docType || docType;
  const displayedLayout =
    activePageIndex === 0
      ? layout
      : pages[activePageIndex - 1]?.layout || (displayedBack ? 'vertical-stacked' : 'single-front');

  useEffect(() => {
    let isCancelled = false;
    setIsRendering(true);

    const render = async () => {
      try {
        const fullCanvas = await renderFullSheetCanvas({
          paperSize,
          docType: displayedDocType,
          orientation,
          layout: displayedLayout,
          scalePercent,
          frontImage: displayedFront,
          backImage: displayedBack,
          watermarkText,
          signatureImage: activePageIndex === 0 ? signatureImage || undefined : undefined,
          signatureScale,
          signaturePosition,
          signatureLabel: showSignatureLabel ? signatureLabel : '',
          dpi: 140,
        });

        if (!isCancelled && canvasRef.current) {
          const target = canvasRef.current;
          target.width = fullCanvas.width;
          target.height = fullCanvas.height;
          const ctx = target.getContext('2d');
          ctx?.drawImage(fullCanvas, 0, 0);
          setIsRendering(false);
        }
      } catch (err) {
        console.warn('Sheet render error:', err);
        setIsRendering(false);
      }
    };

    render();
    return () => {
      isCancelled = true;
    };
  }, [
    paperSize,
    displayedDocType,
    orientation,
    displayedLayout,
    scalePercent,
    displayedFront,
    displayedBack,
    watermarkText,
    signatureImage,
    signatureScale,
    signaturePosition,
    signatureLabel,
    showSignatureLabel,
    activePageIndex,
  ]);

  const handlePrint = () => {
    window.print();
  };

  const layoutOptions: { id: SheetLayout; label: string; desc: string }[] = [
    { id: 'vertical-stacked', label: 'Arriba y Abajo', desc: 'Estándar para trámites' },
    { id: 'horizontal-side', label: 'Lado a Lado', desc: 'Ambos arriba' },
    { id: 'top-aligned', label: 'Mitad Superior', desc: 'Ahorra espacio' },
    { id: 'single-front', label: 'Solo 1 Cara', desc: 'Frente o documento único' },
  ];

  const paperOptions: { id: PaperSize; label: string; dimensions: string }[] = [
    { id: 'carta', label: 'Hoja Carta', dimensions: '21.6 × 27.9 cm' },
    { id: 'oficio', label: 'Hoja Oficio', dimensions: '21.6 × 34.0 cm' },
    { id: 'a4', label: 'Hoja A4', dimensions: '21.0 × 29.7 cm' },
    { id: 'individual', label: 'Solo Recorte', dimensions: 'Sin hoja blanca' },
  ];

  const watermarkPresets = [
    '',
    'Solo para trámite',
    'Copia simple',
    'Exclusivo banco',
    'Sin validez oficial',
  ];

  const totalPages = 1 + pages.length;

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-[#121214] text-stone-100' : 'bg-[#F7F5F0] text-stone-900'
      }`}
    >
      {/* Top Header in Navy Blue with safe-area padding */}
      <div
        className="px-4 pb-3.5 bg-[#0F2C59] text-white flex items-center justify-between z-20 shadow-md"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)' }}
      >
        <div className="flex items-center gap-2">
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition active:scale-95"
              title="Volver a Inicio"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onRetake}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Repetir</span>
          </button>
        </div>

        <div className="text-center">
          <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
            <span>Vista de Hoja</span>
            {totalPages > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                Pág {activePageIndex + 1} de {totalPages}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-stone-200">
            {PAPER_SPECS[paperSize].name} • {scalePercent}%
          </p>
        </div>

        <button
          onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
          className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition active:scale-95"
          title="Girar hoja"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Multi-page Carousel Indicator if more than 1 page */}
      {totalPages > 1 && (
        <div
          className={`px-3 py-2 flex items-center justify-between gap-2 border-b ${
            isDarkMode ? 'bg-[#18181b] border-stone-800' : 'bg-[#0F2C59]/10 border-stone-200'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className={`text-xs font-bold mr-1 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`}>
              Hojas:
            </span>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setActivePageIndex(i)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                  activePageIndex === i
                    ? 'bg-[#0F2C59] text-white shadow-sm'
                    : isDarkMode
                    ? 'bg-[#242429] text-stone-300 border border-stone-700'
                    : 'bg-white text-stone-700 border border-stone-300'
                }`}
              >
                Hoja {i + 1}
              </button>
            ))}
          </div>

          {onDeletePage && (
            <button
              onClick={() => {
                if (window.confirm(`¿Deseas eliminar la Hoja ${activePageIndex + 1}?`)) {
                  onDeletePage(activePageIndex);
                  setActivePageIndex(Math.max(0, activePageIndex - 1));
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0 active:scale-95 ${
                isDarkMode
                  ? 'bg-red-950/60 hover:bg-red-900/70 text-red-300 border border-red-900/60'
                  : 'bg-red-100 hover:bg-red-200 text-red-700'
              }`}
              title="Borrar esta hoja del documento"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar Hoja {activePageIndex + 1}</span>
            </button>
          )}
        </div>
      )}

      {/* Main Sheet Workspace */}
      <div
        className={`flex-1 flex items-center justify-center p-3 relative overflow-hidden ${
          isDarkMode ? 'bg-[#121214]' : 'bg-stone-200/70'
        }`}
      >
        <div className="relative max-h-full max-w-full flex items-center justify-center">
          <div
            className={`relative p-1 rounded shadow-xl border ${
              isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-300 border-stone-300'
            }`}
          >
            <canvas
              ref={canvasRef}
              className="max-h-[46vh] max-w-[84vw] w-auto h-auto object-contain bg-white block"
            />

            {isRendering && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                <div className="w-7 h-7 border-2 border-[#0F2C59] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Configuration & Export Panel (Lifted well above the AdMob banner) */}
      <div
        className={`z-20 border-t flex flex-col shadow-lg transition-colors ${
          isDarkMode ? 'bg-[#18181b] border-stone-800' : 'bg-white border-stone-200'
        }`}
        style={{
          paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 82px)',
        }}
      >
        {/* Navigation Tabs */}
        <div
          className={`flex items-center justify-around border-b px-2 pt-2 ${
            isDarkMode ? 'border-stone-800' : 'border-stone-200'
          }`}
        >
          <button
            onClick={() => setActiveTab('layout')}
            className={`pb-2 px-2 text-xs font-bold flex items-center gap-1 border-b-2 transition ${
              activeTab === 'layout'
                ? isDarkMode
                  ? 'border-blue-400 text-blue-400'
                  : 'border-[#0F2C59] text-[#0F2C59]'
                : isDarkMode
                ? 'border-transparent text-stone-400 hover:text-stone-200'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Acomodo</span>
          </button>

          <button
            onClick={() => setActiveTab('paper')}
            className={`pb-2 px-2 text-xs font-bold flex items-center gap-1 border-b-2 transition ${
              activeTab === 'paper'
                ? isDarkMode
                  ? 'border-blue-400 text-blue-400'
                  : 'border-[#0F2C59] text-[#0F2C59]'
                : isDarkMode
                ? 'border-transparent text-stone-400 hover:text-stone-200'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Formato</span>
          </button>

          <button
            onClick={() => setActiveTab('watermark')}
            className={`pb-2 px-2 text-xs font-bold flex items-center gap-1 border-b-2 transition ${
              activeTab === 'watermark'
                ? isDarkMode
                  ? 'border-blue-400 text-blue-400'
                  : 'border-[#0F2C59] text-[#0F2C59]'
                : isDarkMode
                ? 'border-transparent text-stone-400 hover:text-stone-200'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Marca {watermarkText ? '✓' : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('signature')}
            className={`pb-2 px-2 text-xs font-bold flex items-center gap-1 border-b-2 transition ${
              activeTab === 'signature'
                ? isDarkMode
                  ? 'border-blue-400 text-blue-400'
                  : 'border-[#0F2C59] text-[#0F2C59]'
                : isDarkMode
                ? 'border-transparent text-stone-400 hover:text-stone-200'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Firma {signatureImage ? '✓' : ''}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3">
          {activeTab === 'layout' && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {layoutOptions.map((opt) => {
                  const isActive = layout === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setLayout(opt.id)}
                      className={`p-2 rounded-xl border text-left transition flex items-center justify-between ${
                        isActive
                          ? isDarkMode
                            ? 'bg-[#0F2C59]/40 border-[#2563EB] text-stone-100'
                            : 'bg-[#0F2C59]/10 border-[#0F2C59] text-stone-900'
                          : isDarkMode
                          ? 'bg-[#242429] border-stone-800 text-stone-300 hover:bg-stone-800'
                          : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className={`text-[10px] ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                          {opt.desc}
                        </div>
                      </div>
                      {isActive && (
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Scale Percent Control: 100% Real vs 200% Ampliada */}
              <div
                className={`pt-2 border-t flex items-center justify-between p-2.5 rounded-xl ${
                  isDarkMode
                    ? 'border-stone-800 bg-[#242429]'
                    : 'border-stone-200 bg-stone-50'
                }`}
              >
                <div>
                  <span className={`text-xs font-bold block ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
                    Escala de Impresión
                  </span>
                  <span className={`text-[10px] ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                    {scalePercent === 100
                      ? '100% Tamaño real oficial (8.56 × 5.4 cm)'
                      : '200% Ampliada (para escuelas y Bienestar)'}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 p-0.5 rounded-lg border ${
                    isDarkMode ? 'bg-[#18181b] border-stone-700' : 'bg-white border-stone-300'
                  }`}
                >
                  <button
                    onClick={() => setScalePercent(100)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      scalePercent === 100
                        ? 'bg-[#0F2C59] text-white shadow-sm'
                        : isDarkMode
                        ? 'text-stone-300 hover:bg-stone-800'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    100%
                  </button>
                  <button
                    onClick={() => setScalePercent(200)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      scalePercent === 200
                        ? 'bg-[#0F2C59] text-white shadow-sm'
                        : isDarkMode
                        ? 'text-stone-300 hover:bg-stone-800'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    200%
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'paper' && (
            <div className="grid grid-cols-2 gap-2">
              {paperOptions.map((opt) => {
                const isActive = paperSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectPaper(opt.id)}
                    className={`p-2 rounded-xl border text-left transition flex items-center justify-between ${
                      isActive
                        ? isDarkMode
                          ? 'bg-[#0F2C59]/40 border-[#2563EB] text-stone-100'
                          : 'bg-[#0F2C59]/10 border-[#0F2C59] text-stone-900'
                        : isDarkMode
                        ? 'bg-[#242429] border-stone-800 text-stone-300 hover:bg-stone-800'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className={`text-[10px] ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                        {opt.dimensions}
                      </div>
                    </div>
                    {isActive && (
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'watermark' && (
            <div
              className={`flex flex-col gap-2 p-2.5 rounded-xl border ${
                isDarkMode ? 'bg-[#242429] border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}
            >
              <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                Leyenda de seguridad contra mal uso:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {watermarkPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setWatermarkText(preset)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-semibold border transition ${
                      watermarkText === preset
                        ? 'bg-[#0F2C59] text-white border-[#2563EB]'
                        : isDarkMode
                        ? 'bg-[#18181b] text-stone-300 border-stone-700'
                        : 'bg-white text-stone-700 border-stone-200'
                    }`}
                  >
                    {preset === '' ? 'Sin marca' : preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="O escribe marca personalizada..."
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                className={`mt-0.5 px-3 py-1.5 text-xs rounded-lg border focus:outline-none ${
                  isDarkMode
                    ? 'border-stone-700 bg-[#18181b] text-stone-100 focus:border-blue-500'
                    : 'border-stone-300 bg-white text-stone-900 focus:border-[#0F2C59]'
                }`}
              />
            </div>
          )}

          {activeTab === 'signature' && (
            <div
              className={`flex flex-col gap-2.5 p-2.5 rounded-xl border ${
                isDarkMode ? 'bg-[#242429] border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}
            >
              {!signatureImage ? (
                <div className="flex flex-col items-center justify-center py-3 text-center">
                  <p className={`text-xs mb-2.5 ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>
                    Estampa tu firma digital trazada con el dedo en este documento.
                  </p>
                  <button
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="py-2 px-4 rounded-xl bg-[#0F2C59] text-white text-xs font-bold flex items-center gap-2 shadow-sm active:scale-95 transition"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Trazar Firma con el Dedo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Size and Position controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span
                        className={`text-[11px] font-bold block mb-1 ${
                          isDarkMode ? 'text-stone-300' : 'text-stone-700'
                        }`}
                      >
                        Tamaño:
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { scale: 70, label: 'Chica' },
                          { scale: 100, label: 'Normal' },
                          { scale: 135, label: 'Grande' },
                        ].map((s) => (
                          <button
                            key={s.scale}
                            onClick={() => setSignatureScale(s.scale)}
                            className={`py-1 rounded-lg text-[11px] font-bold transition border ${
                              signatureScale === s.scale
                                ? 'bg-[#0F2C59] text-white border-[#2563EB]'
                                : isDarkMode
                                ? 'bg-[#18181b] text-stone-300 border-stone-700'
                                : 'bg-white text-stone-700 border-stone-300'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span
                        className={`text-[11px] font-bold block mb-1 ${
                          isDarkMode ? 'text-stone-300' : 'text-stone-700'
                        }`}
                      >
                        Posición:
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { id: 'bottom-left', label: 'Izq' },
                          { id: 'bottom-center', label: 'Centro' },
                          { id: 'bottom-right', label: 'Der' },
                        ].map((pos) => (
                          <button
                            key={pos.id}
                            onClick={() => setSignaturePosition(pos.id as any)}
                            className={`py-1 rounded-lg text-[11px] font-bold transition border ${
                              signaturePosition === pos.id
                                ? 'bg-[#0F2C59] text-white border-[#2563EB]'
                                : isDarkMode
                                ? 'bg-[#18181b] text-stone-300 border-stone-700'
                                : 'bg-white text-stone-700 border-stone-300'
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Label editing or removing */}
                  <div className={`pt-1.5 border-t ${isDarkMode ? 'border-stone-700' : 'border-stone-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                        Texto al pie de la firma:
                      </span>
                      <button
                        onClick={() => {
                          const next = !showSignatureLabel;
                          setShowSignatureLabel(next);
                          if (!next) setSignatureLabel('');
                          else setSignatureLabel('Firma del Titular');
                        }}
                        className={`text-[10px] font-bold underline ${
                          isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'
                        }`}
                      >
                        {showSignatureLabel ? 'Quitar texto' : 'Poner "Firma del Titular"'}
                      </button>
                    </div>
                    {showSignatureLabel && (
                      <input
                        type="text"
                        value={signatureLabel}
                        placeholder="Ej. Firma del Titular, Firma del Interesado..."
                        onChange={(e) => setSignatureLabel(e.target.value)}
                        className={`w-full px-2.5 py-1 text-xs rounded-lg border focus:outline-none ${
                          isDarkMode
                            ? 'border-stone-700 bg-[#18181b] text-stone-100 focus:border-blue-500'
                            : 'border-stone-300 bg-white text-stone-900 focus:border-[#0F2C59]'
                        }`}
                      />
                    )}
                  </div>

                  {/* Action buttons */}
                  <div
                    className={`flex items-center justify-between pt-1 border-t ${
                      isDarkMode ? 'border-stone-700' : 'border-stone-200'
                    }`}
                  >
                    <button
                      onClick={() => setIsSignatureModalOpen(true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        isDarkMode
                          ? 'bg-[#18181b] hover:bg-stone-800 text-stone-200 border border-stone-700'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                      }`}
                    >
                      Volver a Trazar
                    </button>
                    <button
                      onClick={() => setSignatureImage(null)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        isDarkMode
                          ? 'bg-red-950/60 hover:bg-red-900/70 text-red-300 border border-red-900/60'
                          : 'bg-red-50 hover:bg-red-100 text-red-700'
                      }`}
                    >
                      Quitar Firma
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons: Add another page, Sign, Print & Export */}
        <div className="px-4 pb-1 pt-0 flex items-center gap-2">
          {onAddAnotherPage && (
            <button
              onClick={onAddAnotherPage}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
                isDarkMode
                  ? 'bg-[#242429] hover:bg-stone-800 border-stone-700 text-stone-200'
                  : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
              }`}
              title="Agregar otra hoja a este archivo"
            >
              <Plus className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`} />
              <span>+ Hoja</span>
            </button>
          )}

          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
              signatureImage
                ? isDarkMode
                  ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-400 text-emerald-800'
                : isDarkMode
                ? 'bg-[#242429] hover:bg-stone-800 border-stone-700 text-stone-200'
                : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
            }`}
            title="Firmar documento con el dedo"
          >
            <PenTool className={`w-3.5 h-3.5 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`} />
            <span>{signatureImage ? 'Firmado ✓' : 'Firmar'}</span>
          </button>

          <button
            onClick={handlePrint}
            className={`p-2.5 rounded-xl border transition active:scale-95 ${
              isDarkMode
                ? 'bg-[#242429] hover:bg-stone-800 border-stone-700 text-stone-200'
                : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
            }`}
            title="Imprimir"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              onOpenExport(
                watermarkText,
                signatureImage || undefined,
                signatureScale,
                signaturePosition,
                showSignatureLabel ? signatureLabel : ''
              )
            }
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#0F2C59] hover:bg-[#0A1F3D] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
          >
            <Share2 className="w-4 h-4" />
            <span>Guardar / Compartir</span>
          </button>
        </div>
      </div>

      {/* Signature Canvas Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onSave={(sigData) => setSignatureImage(sigData)}
        onClose={() => setIsSignatureModalOpen(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default SheetPreview;
