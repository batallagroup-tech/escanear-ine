import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  Image as ImageIcon,
  Check,
  HelpCircle,
  ArrowLeft,
  CreditCard,
  BookOpen,
  FileSpreadsheet,
} from 'lucide-react';
import type { CardCorners, DocumentType } from '../types';
import { DOCUMENT_SPECS } from '../types';
import { detectDocumentQuadFromPixels } from '../services/imageProcessing';

interface SmartScannerProps {
  currentSide: 'front' | 'back';
  isTwoSided: boolean;
  docType: DocumentType;
  frontThumbnail?: string;
  onCapture: (
    imageDataUrl: string,
    detectedCorners?: CardCorners,
    autoCropImmediate?: boolean
  ) => void;
  onChangeDocType: (docType: DocumentType) => void;
  onOpenHelp: () => void;
  onToggleTwoSided: () => void;
  onBack: () => void;
}

/**
 * Draws the exact visible `object-cover` (+ zoom) region of a <video> onto a target canvas
 * so normalized [0..1] coordinates match 1:1 between live SVG overlay, CV detector, and final capture.
 */
function drawVideoVisibleRegion(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  containerW: number,
  containerH: number,
  targetW: number,
  targetH: number,
  zoomLevel: 1 | 2
) {
  const vW = video.videoWidth || 1280;
  const vH = video.videoHeight || 720;
  const containerAspect = containerW / Math.max(1, containerH);
  const videoAspect = vW / Math.max(1, vH);

  let sx = 0;
  let sy = 0;
  let sWidth = vW;
  let sHeight = vH;

  if (videoAspect > containerAspect) {
    // Video is wider than screen -> horizontally cropped by object-cover
    sWidth = vH * containerAspect;
    sx = (vW - sWidth) / 2;
  } else {
    // Video is taller than screen -> vertically cropped by object-cover
    sHeight = vW / containerAspect;
    sy = (vH - sHeight) / 2;
  }

  if (zoomLevel === 2) {
    sx += sWidth * 0.25;
    sy += sHeight * 0.25;
    sWidth *= 0.5;
    sHeight *= 0.5;
  }

  ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);
}

export const SmartScanner: React.FC<SmartScannerProps> = ({
  currentSide,
  isTwoSided,
  docType,
  frontThumbnail,
  onCapture,
  onChangeDocType,
  onOpenHelp,
  onToggleTwoSided,
  onBack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalized [0..1] live smoothed corners for Genius Scan orange polygon overlay
  const smoothedQuadRef = useRef<CardCorners | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<1 | 2>(1);
  const [autoShootEnabled, setAutoShootEnabled] = useState(true);
  const [isCardDetected, setIsCardDetected] = useState(false);
  const [liveQuad, setLiveQuad] = useState<CardCorners | null>(null);
  const [stabilityScore, setStabilityScore] = useState(0);
  const [detectionStatus, setDetectionStatus] = useState<string>('Buscando bordes del documento...');
  const [isCapturing, setIsCapturing] = useState(false);

  // Play camera shutter sound
  const playShutterSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);

      if (navigator.vibrate) {
        navigator.vibrate(45);
      }
    } catch {
      // Ignore audio errors
    }
  };

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      setHasTorch(Boolean(capabilities.torch));

      setHasPermission(true);
    } catch (err) {
      console.warn('Camera access error:', err);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchEnabled }],
      });
      setTorchEnabled(!torchEnabled);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  const triggerCapture = (isAutoTriggered: boolean = false) => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);
    playShutterSound();

    const video = videoRef.current;
    const containerW = containerRef.current?.clientWidth || window.innerWidth || 360;
    const containerH = containerRef.current?.clientHeight || window.innerHeight || 640;

    // High-res output matching exact visible screen aspect ratio
    const outW = 1200;
    const outH = Math.round(outW * (containerH / Math.max(1, containerW)));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawVideoVisibleRegion(ctx, video, containerW, containerH, outW, outH, zoomLevel);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Map live normalized [0..1] quad corners directly to high-res output pixels
    let scaledCorners: CardCorners | undefined;
    if (smoothedQuadRef.current) {
      const q = smoothedQuadRef.current;
      scaledCorners = {
        topLeft: { x: Math.round(q.topLeft.x * outW), y: Math.round(q.topLeft.y * outH) },
        topRight: { x: Math.round(q.topRight.x * outW), y: Math.round(q.topRight.y * outH) },
        bottomRight: { x: Math.round(q.bottomRight.x * outW), y: Math.round(q.bottomRight.y * outH) },
        bottomLeft: { x: Math.round(q.bottomLeft.x * outW), y: Math.round(q.bottomLeft.y * outH) },
      };
    }

    // Like Genius Scan: if Disparo Auto is ON and we have a locked polygon, auto-crop immediately!
    const shouldAutoCropImmediate = Boolean(
      (isAutoTriggered || autoShootEnabled) && scaledCorners
    );

    setTimeout(() => {
      setIsCapturing(false);
      onCapture(dataUrl, scaledCorners, shouldAutoCropImmediate);
    }, 150);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        onCapture(event.target.result, undefined, autoShootEnabled);
      }
    };
    reader.readAsDataURL(file);
  };

  // Genius Scan Real-Time 4-Corner Polygon Detection & Stability Loop
  useEffect(() => {
    if (!hasPermission) {
      setIsCardDetected(false);
      setLiveQuad(null);
      setStabilityScore(0);
      return;
    }

    let stableFrames = 0;
    let missedFrames = 0;
    // Deliberate, careful auto-capture: 22 steady frames at 90ms (~2.0 seconds of calm alignment)
    const REQUIRED_STABLE_FRAMES = 22;

    const analysisCanvas = document.createElement('canvas');
    const W = 180;
    const H = 240;
    analysisCanvas.width = W;
    analysisCanvas.height = H;
    const ctx = analysisCanvas.getContext('2d', { willReadFrequently: true });

    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2 || isCapturing || !ctx) return;

      const video = videoRef.current;
      const containerW = containerRef.current?.clientWidth || 360;
      const containerH = containerRef.current?.clientHeight || 640;

      drawVideoVisibleRegion(ctx, video, containerW, containerH, W, H, zoomLevel);
      const imgData = ctx.getImageData(0, 0, W, H);

      const detection = detectDocumentQuadFromPixels(imgData.data, W, H, docType);

      const labelDoc =
        docType === 'ine'
          ? 'tu INE / Credencial'
          : docType === 'pasaporte'
          ? 'tu Pasaporte'
          : 'el documento o recibo';

      if (!detection.detected) {
        missedFrames++;
        if (missedFrames >= 3) {
          smoothedQuadRef.current = null;
          setLiveQuad(null);
          setIsCardDetected(false);
          stableFrames = 0;
          setStabilityScore(0);
          setDetectionStatus(`Coloca ${labelDoc} sobre una superficie contrastante`);
        }
        return;
      }

      missedFrames = 0;
      setIsCardDetected(true);

      // Normalize detected corners to [0..1]
      const normQuad: CardCorners = {
        topLeft: { x: detection.corners.topLeft.x / W, y: detection.corners.topLeft.y / H },
        topRight: { x: detection.corners.topRight.x / W, y: detection.corners.topRight.y / H },
        bottomRight: { x: detection.corners.bottomRight.x / W, y: detection.corners.bottomRight.y / H },
        bottomLeft: { x: detection.corners.bottomLeft.x / W, y: detection.corners.bottomLeft.y / H },
      };

      // Measure corner movement vs previous smoothed quad for stability & smooth lerp
      let cornerDelta = 0;
      if (smoothedQuadRef.current) {
        const prev = smoothedQuadRef.current;
        cornerDelta =
          (Math.hypot(normQuad.topLeft.x - prev.topLeft.x, normQuad.topLeft.y - prev.topLeft.y) +
            Math.hypot(normQuad.topRight.x - prev.topRight.x, normQuad.topRight.y - prev.topRight.y) +
            Math.hypot(normQuad.bottomRight.x - prev.bottomRight.x, normQuad.bottomRight.y - prev.bottomRight.y) +
            Math.hypot(normQuad.bottomLeft.x - prev.bottomLeft.x, normQuad.bottomLeft.y - prev.bottomLeft.y)) /
          4;

        const alpha = 0.38;
        const lerpPt = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
          x: a.x + (b.x - a.x) * alpha,
          y: a.y + (b.y - a.y) * alpha,
        });

        smoothedQuadRef.current = {
          topLeft: lerpPt(prev.topLeft, normQuad.topLeft),
          topRight: lerpPt(prev.topRight, normQuad.topRight),
          bottomRight: lerpPt(prev.bottomRight, normQuad.bottomRight),
          bottomLeft: lerpPt(prev.bottomLeft, normQuad.bottomLeft),
        };
      } else {
        smoothedQuadRef.current = normQuad;
        cornerDelta = 0.05;
      }

      setLiveQuad({ ...smoothedQuadRef.current });

      if (!autoShootEnabled) {
        setDetectionStatus('Bordes detectados • Presiona el botón para capturar');
        setStabilityScore(100);
        return;
      }

      // Check that all 4 corners are well inside the camera viewport (not cut off at the edges)
      const q = smoothedQuadRef.current;
      const allInsideMargin = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft].every(
        (pt) => pt.x >= 0.035 && pt.x <= 0.965 && pt.y >= 0.045 && pt.y <= 0.935
      );

      if (cornerDelta < 0.012 && detection.confidence >= 62 && allInsideMargin) {
        stableFrames++;
        const progress = Math.min(100, Math.round((stableFrames / REQUIRED_STABLE_FRAMES) * 100));
        if (progress < 40) {
          setDetectionStatus('Documento detectado • Alinea bien las 4 esquinas');
        } else if (progress < 85) {
          setDetectionStatus('Bien alineado • Mantén firme el celular...');
        } else {
          setDetectionStatus('Capturando con precisión...');
        }
      } else {
        // Decay quickly if the user is still moving or adjusting alignment
        stableFrames = Math.max(0, stableFrames - 3);
        setDetectionStatus(
          !allInsideMargin
            ? 'Centra un poco más el documento en la pantalla'
            : 'Ajustando bordes • Mantén estable para capturar'
        );
      }

      const score = Math.min(100, Math.round((stableFrames / REQUIRED_STABLE_FRAMES) * 100));
      setStabilityScore(score);

      if (stableFrames >= REQUIRED_STABLE_FRAMES) {
        stableFrames = 0;
        setDetectionStatus('¡Escaneo exacto!');
        triggerCapture(true);
      }
    }, 90);

    return () => {
      clearInterval(interval);
    };
  }, [autoShootEnabled, hasPermission, isCapturing, docType, zoomLevel]);

  // SVG circular progress ring geometry around shutter button
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (stabilityScore / 100) * ringCircumference;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex flex-col overflow-hidden select-none"
    >
      {/* Friendly Permission Denied View */}
      {hasPermission === false && (
        <div className="absolute inset-0 z-50 bg-[#0F2C59] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold mb-2">Permiso de Cámara Necesario</h3>
          <p className="text-sm text-stone-200 max-w-xs mb-6">
            Para escanear tu INE o documento necesitamos acceso a tu cámara. Tus fotos se procesan únicamente dentro de tu dispositivo.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={startCamera}
              className="w-full py-3 px-5 rounded-xl bg-white text-[#0F2C59] font-bold text-sm shadow active:scale-95 transition"
            >
              Reintentar / Otorgar Permiso
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-5 rounded-xl bg-white/15 text-white font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Elegir Foto de Galería</span>
            </button>
            <button
              onClick={onBack}
              className="w-full py-2 text-stone-300 text-xs font-semibold"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      )}

      {/* Video Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          transform: zoomLevel === 2 ? 'scale(2)' : 'scale(1)',
          transformOrigin: 'center center',
          transition: 'transform 0.25s ease-out',
        }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* GENIUS SCAN REAL-TIME DYNAMIC BLUE QUADRILATERAL OVERLAY */}
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      >
        {isCardDetected && liveQuad && (
          <>
            <polygon
              points={`${liveQuad.topLeft.x * 1000},${liveQuad.topLeft.y * 1000} ${
                liveQuad.topRight.x * 1000
              },${liveQuad.topRight.y * 1000} ${liveQuad.bottomRight.x * 1000},${
                liveQuad.bottomRight.y * 1000
              } ${liveQuad.bottomLeft.x * 1000},${liveQuad.bottomLeft.y * 1000}`}
              fill={
                stabilityScore >= 80
                  ? 'rgba(15, 44, 89, 0.38)'
                  : 'rgba(15, 44, 89, 0.22)'
              }
              stroke="#2563EB"
              strokeWidth="6"
              strokeLinejoin="round"
              style={{ transition: 'all 75ms linear' }}
            />
            {[
              liveQuad.topLeft,
              liveQuad.topRight,
              liveQuad.bottomRight,
              liveQuad.bottomLeft,
            ].map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x * 1000}
                cy={pt.y * 1000}
                r="10"
                fill="#FFFFFF"
                stroke="#2563EB"
                strokeWidth="5"
                style={{ transition: 'all 75ms linear' }}
              />
            ))}
          </>
        )}
      </svg>

      {/* Shutter Flash Animation */}
      {isCapturing && (
        <div className="absolute inset-0 bg-white z-40 opacity-80 pointer-events-none" />
      )}

      {/* Top Header Overlay with safe-area status bar spacing */}
      <div
        className="relative z-20 flex flex-col gap-2.5 px-4 pb-3 bg-gradient-to-b from-black/85 via-black/45 to-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-black/60 text-white hover:bg-black/80 border border-white/20 active:scale-95 transition flex items-center justify-center"
            aria-label="Regresar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Current Side Badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-black/65 border border-white/20">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isCardDetected ? 'bg-blue-400 animate-pulse' : 'bg-stone-400'
              }`}
            />
            <span className="text-xs font-bold text-white uppercase tracking-wide">
              {isTwoSided
                ? currentSide === 'front'
                  ? '1. Frente'
                  : '2. Reverso'
                : DOCUMENT_SPECS[docType].shortName}
            </span>
          </div>

          {/* Right tools (Torch & Help) */}
          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition ${
                  torchEnabled
                    ? 'bg-amber-500 text-black border-amber-400'
                    : 'bg-black/60 text-white border-white/20'
                }`}
                aria-label="Linterna"
              >
                {torchEnabled ? (
                  <Flashlight className="w-5 h-5" />
                ) : (
                  <FlashlightOff className="w-5 h-5" />
                )}
              </button>
            )}

            <button
              onClick={onOpenHelp}
              className="w-10 h-10 rounded-xl bg-black/60 text-white border border-white/20 flex items-center justify-center"
              aria-label="Ayuda"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Type Switcher in Navy Blue */}
        <div className="flex items-center justify-center gap-1.5 bg-black/65 p-1 rounded-xl border border-white/15 max-w-xs mx-auto w-full">
          {(
            [
              { id: 'ine', label: 'INE / ID', icon: CreditCard },
              { id: 'pasaporte', label: 'Pasaporte', icon: BookOpen },
              { id: 'documento', label: 'Hoja / Libre', icon: FileSpreadsheet },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = docType === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeDocType(item.id)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                  active
                    ? 'bg-[#0F2C59] text-white shadow-sm'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Minimal Floating Status Pill & Framing Guides */}
      <div className="flex-1 relative flex flex-col items-center justify-between p-5 z-10 pointer-events-none">
        {/* Subtle Frame Guide when no document is locked yet */}
        {!isCardDetected && (
          <div className="w-full flex-1 flex items-center justify-center">
            {docType === 'ine' || docType === 'pasaporte' ? (
              <div
                className="relative w-full max-w-sm rounded-2xl border-2 border-white/50 border-dashed transition-all duration-200"
                style={{
                  aspectRatio: `${DOCUMENT_SPECS[docType].aspectRatio}`,
                }}
              >
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full border border-white/10">
                    Alinea {docType === 'ine' ? 'tu INE' : 'el pasaporte'} en el recuadro
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-xs aspect-[3/4] rounded-2xl border-2 border-white/40 border-dashed flex items-center justify-center p-4">
                <span className="text-[11px] font-semibold text-white/90 bg-black/60 px-3 py-1 rounded-full border border-white/10 text-center">
                  Coloca la hoja completa dentro de la cámara
                </span>
              </div>
            )}
          </div>
        )}

        {/* Floating Status Pill */}
        <div
          className={`mt-auto flex items-center justify-center px-5 py-2.5 rounded-full shadow-lg border backdrop-blur-md transition-all text-center ${
            isCardDetected
              ? 'bg-[#0F2C59]/95 border-blue-400 text-white'
              : 'bg-black/70 border-white/20 text-white'
          }`}
        >
          <span className="text-xs font-bold tracking-wide">{detectionStatus}</span>
        </div>
      </div>

      {/* Bottom Controls Panel (Lifted above AdMob Banner) */}
      <div
        className="relative z-20 px-6 pt-3 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-3"
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 74px)' }}
      >
        {/* Mode toggles */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setZoomLevel(zoomLevel === 1 ? 2 : 1)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition ${
              zoomLevel === 2
                ? 'bg-amber-400 text-stone-900 border-amber-300'
                : 'bg-black/60 border-white/25 text-white'
            }`}
            title="Cambiar zoom para evitar sombras"
          >
            {zoomLevel}x
          </button>

          <button
            onClick={() => setAutoShootEnabled(!autoShootEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              autoShootEnabled
                ? 'bg-[#0F2C59] text-white border-blue-400 shadow-sm'
                : 'bg-black/60 border-white/25 text-stone-300'
            }`}
          >
            <span>Auto-Captura: {autoShootEnabled ? 'ON' : 'MANUAL'}</span>
          </button>

          <button
            onClick={onToggleTwoSided}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
              isTwoSided
                ? 'bg-[#0F2C59] border-[#1d437d] text-white'
                : 'bg-black/60 border-white/25 text-stone-300'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isTwoSided ? '2 Caras' : '1 Cara'}</span>
          </button>
        </div>

        {/* Shutter Bar with Genius Scan Circular Progress Ring */}
        <div className="flex items-center justify-around w-full max-w-sm mx-auto">
          {/* Gallery Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-white hover:bg-white/25 transition active:scale-95"
            aria-label="Abrir galería"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Genius Scan Shutter Button with Animated Progress Ring */}
          <button
            onClick={() => triggerCapture(false)}
            disabled={isCapturing}
            className="relative w-22 h-22 flex items-center justify-center active:scale-90 transition"
            style={{ width: '88px', height: '88px' }}
            aria-label="Tomar foto"
          >
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 88 88">
              <circle
                cx="44"
                cy="44"
                r={ringRadius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="5"
              />
              {isCardDetected && (
                <circle
                  cx="44"
                  cy="44"
                  r={ringRadius}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 85ms linear' }}
                />
              )}
            </svg>
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-colors ${
                isCardDetected ? 'bg-[#0F2C59] text-white border-2 border-blue-400' : 'bg-white text-[#0F2C59]'
              }`}
            >
              <Camera className="w-7 h-7" />
            </div>
          </button>

          {/* Front thumbnail preview if on back side */}
          {currentSide === 'back' && frontThumbnail ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-md">
              <img src={frontThumbnail} alt="Frente" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12" />
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartScanner;
