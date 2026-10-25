import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { CardCorners, DocumentType, Point } from '../types';
import { Check, RotateCcw, RotateCw, ZoomIn, Wand2, Sliders } from 'lucide-react';
import { getDefaultCorners, autoDetectDocumentCorners, rotateImage90 } from '../services/imageProcessing';

interface CornerEditorProps {
  imageSrc: string;
  sideTitle: string;
  docType?: DocumentType;
  initialCorners?: CardCorners;
  onConfirm: (corners: CardCorners, finalImageSrc?: string) => void;
  onRetake: () => void;
  isDarkMode?: boolean;
}

type CornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export const CornerEditor: React.FC<CornerEditorProps> = ({
  imageSrc,
  sideTitle,
  docType = 'ine',
  initialCorners,
  onConfirm,
  onRetake,
  isDarkMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const [corners, setCorners] = useState<CardCorners | null>(null);
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null);
  const [touchPos, setTouchPos] = useState<Point | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Reticle offset distance in pixels (floats cleanly above finger so finger never blocks the corner)
  const RETICLE_OFFSET_Y = 65;

  const computeTargetFromTouch = (fingerPt: Point): Point => {
    // If the finger is near the top edge, offset the reticle downwards so it remains in view
    const offsetY = fingerPt.y < 110 ? RETICLE_OFFSET_Y : -RETICLE_OFFSET_Y;
    return {
      x: fingerPt.x,
      y: Math.max(10, fingerPt.y + offsetY),
    };
  };

  const handleImageLoad = async () => {
    if (!imgRef.current) return;
    const w = imgRef.current.naturalWidth;
    const h = imgRef.current.naturalHeight;
    setImgDimensions({ width: w, height: h });

    if (initialCorners && currentImageSrc === imageSrc) {
      setCorners(initialCorners);
    } else {
      try {
        setIsAutoDetecting(true);
        const auto = await autoDetectDocumentCorners(currentImageSrc, docType);
        setCorners(auto);
      } catch {
        setCorners(getDefaultCorners(w, h, docType));
      } finally {
        setIsAutoDetecting(false);
      }
    }
  };

  const handleRotate = async () => {
    try {
      const rotated = await rotateImage90(currentImageSrc);
      setCurrentImageSrc(rotated);
      setCorners(null);
    } catch (e) {
      console.warn('Rotation error:', e);
    }
  };

  const handleRunAutoDetect = async () => {
    setIsAutoDetecting(true);
    try {
      const auto = await autoDetectDocumentCorners(currentImageSrc, docType);
      setCorners(auto);
    } catch {
      if (imgDimensions.width > 0) {
        setCorners(getDefaultCorners(imgDimensions.width, imgDimensions.height, docType));
      }
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const updateLayout = useCallback(() => {
    if (!containerRef.current || imgDimensions.width === 0) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    const scaleX = (cw * 0.92) / imgDimensions.width;
    const scaleY = (ch * 0.78) / imgDimensions.height;
    const s = Math.min(scaleX, scaleY);
    setScale(s);

    const renderedW = imgDimensions.width * s;
    const renderedH = imgDimensions.height * s;
    setOffset({
      x: (cw - renderedW) / 2,
      y: (ch - renderedH) / 2,
    });
  }, [imgDimensions]);

  useEffect(() => {
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [updateLayout]);

  const imageToScreen = (p: Point): Point => ({
    x: p.x * scale + offset.x,
    y: p.y * scale + offset.y,
  });

  const screenToImage = (p: Point): Point => ({
    x: Math.max(0, Math.min(imgDimensions.width, (p.x - offset.x) / scale)),
    y: Math.max(0, Math.min(imgDimensions.height, (p.y - offset.y) / scale)),
  });

  const updateLoupe = (imgPoint: Point) => {
    if (!loupeCanvasRef.current || !imgRef.current) return;
    const canvas = loupeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const zoom = 2.4;
    const size = canvas.width;
    const radius = size / 2;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.clip();

    const sw = size / zoom;
    const sh = size / zoom;
    const sx = imgPoint.x - sw / 2;
    const sy = imgPoint.y - sh / 2;

    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, size, size);

    // Crosshairs: white outline for high contrast against dark & light backgrounds
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(radius - 16, radius);
    ctx.lineTo(radius + 16, radius);
    ctx.moveTo(radius, radius - 16);
    ctx.lineTo(radius, radius + 16);
    ctx.stroke();

    // Crosshairs in navy blue
    ctx.strokeStyle = '#0F2C59';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radius - 16, radius);
    ctx.lineTo(radius + 16, radius);
    ctx.moveTo(radius, radius - 16);
    ctx.lineTo(radius, radius + 16);
    ctx.stroke();

    // Center precision dot in electric blue
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(radius, radius, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Outer border of the loupe reticle
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 3.5, 0, Math.PI * 2);
    ctx.stroke();
  };

  const onPointerDown = (corner: CornerKey, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveCorner(corner);

    if (!containerRef.current || !corners) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fingerPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setTouchPos(fingerPt);

    const targetScreen = computeTargetFromTouch(fingerPt);
    const targetImg = screenToImage(targetScreen);

    setCorners({
      ...corners,
      [corner]: targetImg,
    });

    updateLoupe(targetImg);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeCorner || !containerRef.current || !corners) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const fingerPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setTouchPos(fingerPt);

    const targetScreen = computeTargetFromTouch(fingerPt);
    const targetImg = screenToImage(targetScreen);

    setCorners({
      ...corners,
      [activeCorner]: targetImg,
    });

    updateLoupe(targetImg);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (activeCorner) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveCorner(null);
      setTouchPos(null);
    }
  };

  if (!corners) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-[#121214]' : 'bg-[#F7F5F0]'}`}>
        <img
          ref={imgRef}
          src={currentImageSrc}
          alt="Source"
          onLoad={handleImageLoad}
          className="hidden"
        />
        <div className={`text-sm font-medium ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>Detectando bordes...</div>
      </div>
    );
  }

  const pTL = imageToScreen(corners.topLeft);
  const pTR = imageToScreen(corners.topRight);
  const pBR = imageToScreen(corners.bottomRight);
  const pBL = imageToScreen(corners.bottomLeft);

  const activeScreenPt = activeCorner ? imageToScreen(corners[activeCorner]) : null;

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative w-full h-full bg-stone-900 flex flex-col justify-between overflow-hidden touch-none select-none"
    >
      {/* Top Header in Navy Blue with safe-area padding */}
      <div
        className="relative z-30 px-4 pb-3 bg-[#0F2C59] text-white flex flex-col gap-2 shadow-md"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={onRetake}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition active:scale-95"
          >
            Repetir Foto
          </button>

          <div className="text-center">
            <h3 className="text-sm font-bold text-white">
              Recorte de Esquinas ({sideTitle})
            </h3>
            <p className="text-[11px] text-stone-200">Ajusta los 4 puntos al documento</p>
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
              onClick={() => setCorners(getDefaultCorners(imgDimensions.width, imgDimensions.height, docType))}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition active:scale-95"
              title="Restablecer esquinas"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Auto-Detect vs Manual Adjustment Bar */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleRunAutoDetect}
            disabled={isAutoDetecting}
            className="flex-1 py-1.5 px-3 rounded-lg bg-white text-[#0F2C59] text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{isAutoDetecting ? 'Detectando...' : 'Detectar Automático'}</span>
          </button>

          <div className="px-3 py-1 rounded-lg bg-white/15 text-[11px] font-semibold text-stone-200 flex items-center gap-1">
            <Sliders className="w-3 h-3" />
            <span>O arrastra manualmente</span>
          </div>
        </div>
      </div>

      {/* Main Image View & Interactive Polygon */}
      <div className="relative flex-1 flex items-center justify-center">
        <img
          ref={imgRef}
          src={currentImageSrc}
          alt="Documento"
          onLoad={handleImageLoad}
          style={{
            position: 'absolute',
            left: `${offset.x}px`,
            top: `${offset.y}px`,
            width: `${imgDimensions.width * scale}px`,
            height: `${imgDimensions.height * scale}px`,
          }}
          className="pointer-events-none select-none rounded shadow-xl"
        />

        {/* SVG Polygon Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <polygon
            points={`${pTL.x},${pTL.y} ${pTR.x},${pTR.y} ${pBR.x},${pBR.y} ${pBL.x},${pBL.y}`}
            fill="rgba(15, 44, 89, 0.25)"
            stroke="#2563EB"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </svg>

        {/* Dynamic Connector Line between finger handle and target crosshair while dragging */}
        {activeCorner && touchPos && activeScreenPt && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            <line
              x1={touchPos.x}
              y1={touchPos.y}
              x2={activeScreenPt.x}
              y2={activeScreenPt.y}
              stroke="#2563EB"
              strokeWidth="2.5"
              strokeDasharray="4 4"
            />
          </svg>
        )}

        {/* Static Corner Handles (rendered for all corners not currently being dragged) */}
        {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as CornerKey[]).map((key) => {
          if (activeCorner === key) return null;
          const pt = imageToScreen(corners[key]);

          return (
            <div
              key={key}
              onPointerDown={(e) => onPointerDown(key, e)}
              style={{
                position: 'absolute',
                left: `${pt.x}px`,
                top: `${pt.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className="z-25 w-14 h-14 flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              <div className="w-8 h-8 rounded-full border-2 border-[#2563EB] bg-white flex items-center justify-center shadow-lg transition-transform active:scale-110">
                <div className="w-3 h-3 rounded-full bg-[#0F2C59]" />
              </div>
            </div>
          );
        })}

        {/* Active Finger Touch Handle (the "bolita negra con blanco" directly under the user's finger) */}
        {activeCorner && touchPos && (
          <div
            style={{
              position: 'absolute',
              left: `${touchPos.x}px`,
              top: `${touchPos.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className="z-30 pointer-events-none flex items-center justify-center"
          >
            <div className="w-9 h-9 rounded-full border-2 border-white bg-[#0F2C59] flex items-center justify-center shadow-2xl scale-110">
              <div className="w-3.5 h-3.5 rounded-full bg-white" />
            </div>
          </div>
        )}

        {/* Active Target Reticle (the crosshair centered directly on the exact corner of the document) */}
        {activeCorner && activeScreenPt && (
          <div
            style={{
              position: 'absolute',
              left: `${activeScreenPt.x}px`,
              top: `${activeScreenPt.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className="z-40 pointer-events-none drop-shadow-2xl"
          >
            <canvas
              ref={loupeCanvasRef}
              width={100}
              height={100}
              className="rounded-full shadow-2xl border-2 border-white"
            />
          </div>
        )}
      </div>

      {/* Bottom Confirmation Bar */}
      <div
        className={`relative z-30 px-5 pt-3.5 border-t flex items-center justify-between gap-4 transition-colors ${
          isDarkMode
            ? 'bg-[#18181b] border-stone-800 text-stone-300'
            : 'bg-white border-stone-200 text-stone-600'
        }`}
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 74px)' }}
      >
        <div className={`flex items-center gap-2 text-xs font-medium ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>
          <ZoomIn className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`} />
          <span>Arrastra la bolita • La cruz apunta la esquina</span>
        </div>

        <button
          onClick={() => onConfirm(corners, currentImageSrc)}
          className="px-5 py-3.5 rounded-xl bg-[#0F2C59] hover:bg-[#0A1F3D] text-white text-sm font-bold flex items-center gap-2 shadow-md active:scale-95 transition"
        >
          <Check className="w-4 h-4" />
          <span>Recortar y Continuar</span>
        </button>
      </div>
    </div>
  );
};

export default CornerEditor;
