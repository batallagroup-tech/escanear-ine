import type { DocumentType, PageOrientation, PaperSize, SheetLayout } from '../types';
import { DOCUMENT_SPECS, PAPER_SPECS } from '../types';
import { loadImage } from './imageProcessing';

export interface SheetRenderOptions {
  paperSize: PaperSize;
  docType?: DocumentType;
  orientation: PageOrientation;
  layout: SheetLayout;
  scalePercent: number; // 100 = 1:1 exact real physical size
  frontImage?: string;
  backImage?: string;
  dpi?: number;
  watermarkText?: string;
  signatureImage?: string;
  signatureScale?: number; // 50 to 150, default 100
  signaturePosition?: 'bottom-center' | 'bottom-left' | 'bottom-right';
  signatureLabel?: string; // default 'Firma del Titular', '' to omit
}

/**
 * Calculates millimeter coordinates for front and back documents on paper
 */
export function calculateCardPlacement(
  paperWidthMm: number,
  paperHeightMm: number,
  layout: SheetLayout,
  scalePercent: number,
  hasBackImage: boolean,
  docType: DocumentType = 'ine',
  frontAspectRatio?: number,
  backAspectRatio?: number
): {
  front: { x: number; y: number; w: number; h: number } | null;
  back: { x: number; y: number; w: number; h: number } | null;
} {
  const scale = scalePercent / 100;
  const docSpec = DOCUMENT_SPECS[docType];

  if (docType === 'documento') {
    // Full document / free ratio (CURP, Acta, Comprobante)
    const maxW = (paperWidthMm - 24) * scale;
    const maxH = (hasBackImage && layout !== 'single-front' ? (paperHeightMm - 36) / 2 : paperHeightMm - 28) * scale;

    const fitBox = (ratio: number, boxW: number, boxH: number) => {
      let w = boxW;
      let h = w / ratio;
      if (h > boxH) {
        h = boxH;
        w = h * ratio;
      }
      return { w, h };
    };

    const fRatio = frontAspectRatio || 0.77;
    const bRatio = backAspectRatio || fRatio;

    if (layout === 'single-front' || !hasBackImage) {
      const { w, h } = fitBox(fRatio, maxW, maxH);
      return {
        front: {
          x: (paperWidthMm - w) / 2,
          y: (paperHeightMm - h) / 2,
          w,
          h,
        },
        back: null,
      };
    }

    const fBox = fitBox(fRatio, maxW, maxH);
    const bBox = fitBox(bRatio, maxW, maxH);
    const gap = 10;
    const totalH = fBox.h + bBox.h + gap;
    const startY = Math.max(12, (paperHeightMm - totalH) / 2);

    return {
      front: { x: (paperWidthMm - fBox.w) / 2, y: startY, w: fBox.w, h: fBox.h },
      back: { x: (paperWidthMm - bBox.w) / 2, y: startY + fBox.h + gap, w: bBox.w, h: bBox.h },
    };
  }

  const cardW = docSpec.widthMm * scale;
  const cardH = docSpec.heightMm * scale;

  if (layout === 'single-front' || !hasBackImage) {
    return {
      front: {
        x: (paperWidthMm - cardW) / 2,
        y: paperHeightMm * 0.25,
        w: cardW,
        h: cardH,
      },
      back: null,
    };
  }

  if (layout === 'single-back') {
    return {
      front: null,
      back: {
        x: (paperWidthMm - cardW) / 2,
        y: paperHeightMm * 0.25,
        w: cardW,
        h: cardH,
      },
    };
  }

  if (layout === 'horizontal-side') {
    const gap = 12;
    const totalW = cardW * 2 + gap;
    const startX = (paperWidthMm - totalW) / 2;
    const topY = paperHeightMm * 0.25;

    return {
      front: { x: startX, y: topY, w: cardW, h: cardH },
      back: { x: startX + cardW + gap, y: topY, w: cardW, h: cardH },
    };
  }

  if (layout === 'top-aligned') {
    const gap = 12;
    const centerX = (paperWidthMm - cardW) / 2;
    const startY = 22;

    return {
      front: { x: centerX, y: startY, w: cardW, h: cardH },
      back: { x: centerX, y: startY + cardH + gap, w: cardW, h: cardH },
    };
  }

  // 'vertical-stacked'
  const centerX = (paperWidthMm - cardW) / 2;
  const frontY = paperHeightMm * 0.18;
  const backY = paperHeightMm * 0.54;

  return {
    front: { x: centerX, y: frontY, w: cardW, h: cardH },
    back: { x: centerX, y: backY, w: cardW, h: cardH },
  };
}

/**
 * Renders the full sheet at target DPI (e.g. 300 DPI for official printing)
 */
export async function renderFullSheetCanvas(options: SheetRenderOptions): Promise<HTMLCanvasElement> {
  const {
    paperSize,
    docType = 'ine',
    orientation,
    layout,
    scalePercent,
    frontImage,
    backImage,
    dpi = 300,
  } = options;

  const imgFront = frontImage ? await loadImage(frontImage) : null;
  const imgBack = backImage ? await loadImage(backImage) : null;

  if (paperSize === 'individual') {
    const imgToDraw = imgFront || imgBack;
    const canvas = document.createElement('canvas');
    if (imgToDraw) {
      canvas.width = imgToDraw.naturalWidth || imgToDraw.width || 1280;
      canvas.height = imgToDraw.naturalHeight || imgToDraw.height || 807;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(imgToDraw, 0, 0, canvas.width, canvas.height);
    } else {
      canvas.width = 1011;
      canvas.height = 638;
    }
    return canvas;
  }

  const spec = PAPER_SPECS[paperSize];
  let paperWidthMm = spec.widthMm;
  let paperHeightMm = spec.heightMm;

  if (orientation === 'landscape') {
    const temp = paperWidthMm;
    paperWidthMm = paperHeightMm;
    paperHeightMm = temp;
  }

  const mmToPx = (mm: number) => Math.round((mm / 25.4) * dpi);

  const canvasWidth = mmToPx(paperWidthMm);
  const canvasHeight = mmToPx(paperHeightMm);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const frontRatio = imgFront ? (imgFront.naturalWidth || imgFront.width) / (imgFront.naturalHeight || imgFront.height) : undefined;
  const backRatio = imgBack ? (imgBack.naturalWidth || imgBack.width) / (imgBack.naturalHeight || imgBack.height) : undefined;

  const placement = calculateCardPlacement(
    paperWidthMm,
    paperHeightMm,
    layout,
    scalePercent,
    Boolean(backImage),
    docType,
    frontRatio,
    backRatio
  );

  if (placement.front && imgFront) {
    const fx = mmToPx(placement.front.x);
    const fy = mmToPx(placement.front.y);
    const fw = mmToPx(placement.front.w);
    const fh = mmToPx(placement.front.h);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = mmToPx(1.0);
    ctx.shadowOffsetY = mmToPx(0.5);
    ctx.drawImage(imgFront, fx, fy, fw, fh);
    ctx.restore();
  }

  if (placement.back && imgBack) {
    const bx = mmToPx(placement.back.x);
    const by = mmToPx(placement.back.y);
    const bw = mmToPx(placement.back.w);
    const bh = mmToPx(placement.back.h);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = mmToPx(1.0);
    ctx.shadowOffsetY = mmToPx(0.5);
    ctx.drawImage(imgBack, bx, by, bw, bh);
    ctx.restore();
  }

  // Render digital signature if present
  if (options.signatureImage) {
    const imgSig = await loadImage(options.signatureImage);
    const scale = (options.signatureScale || 100) / 100;
    const baseW = mmToPx(48);
    const sigW = Math.round(baseW * scale);
    const sigH = Math.round((sigW * (imgSig.naturalHeight || 100)) / (imgSig.naturalWidth || 200));

    let sigX = Math.round((canvasWidth - sigW) / 2);
    if (options.signaturePosition === 'bottom-left') {
      sigX = mmToPx(24);
    } else if (options.signaturePosition === 'bottom-right') {
      sigX = canvasWidth - sigW - mmToPx(24);
    }

    const hasLabel =
      typeof options.signatureLabel === 'string'
        ? options.signatureLabel.trim().length > 0
        : true;
    const labelText =
      typeof options.signatureLabel === 'string'
        ? options.signatureLabel.trim()
        : 'Firma del Titular';

    const sigY = canvasHeight - sigH - (hasLabel ? mmToPx(18) : mmToPx(12));

    ctx.save();
    ctx.drawImage(imgSig, sigX, sigY, sigW, sigH);

    if (hasLabel) {
      ctx.font = `${mmToPx(3.2)}px sans-serif`;
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      const labelX = sigX + Math.round(sigW / 2);
      ctx.fillText(labelText, labelX, canvasHeight - mmToPx(13));
    }
    ctx.restore();
  }

  // Draw security watermark if specified
  if (options.watermarkText && options.watermarkText.trim().length > 0) {
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate((-28 * Math.PI) / 180);
    ctx.font = `bold ${mmToPx(9.5)}px sans-serif`;
    ctx.fillStyle = 'rgba(15, 44, 89, 0.18)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.watermarkText.toUpperCase(), 0, -mmToPx(35));
    ctx.fillText(options.watermarkText.toUpperCase(), 0, 0);
    ctx.fillText(options.watermarkText.toUpperCase(), 0, mmToPx(35));
    ctx.restore();
  }

  return canvas;
}
