import jsPDF from 'jspdf';
import type { PageItem } from '../types';
import { PAPER_SPECS } from '../types';
import type { SheetRenderOptions } from './sheetRenderer';
import { calculateCardPlacement } from './sheetRenderer';
import { loadImage } from './imageProcessing';

export interface MultiPagePdfOptions extends SheetRenderOptions {
  pages?: PageItem[];
  documentTitle?: string;
  signatureImage?: string;
  signatureScale?: number;
  signaturePosition?: 'bottom-center' | 'bottom-left' | 'bottom-right';
  signatureLabel?: string;
  compressForWeb?: boolean;
}

/**
 * Compresses an image Data URL to lower resolution JPEG for web government portals (< 1 MB)
 */
async function compressImageForWeb(dataUrl: string, quality = 0.68): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  // Scale down to max 1200px width/height for tiny file size
  const maxDim = 1200;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Generates an official vector-accurate PDF with physical millimeter scaling and multi-page support
 */
export async function generateDocumentPdf(options: MultiPagePdfOptions): Promise<Blob> {
  const {
    paperSize,
    docType = 'ine',
    orientation,
    layout,
    scalePercent,
    frontImage,
    backImage,
    watermarkText,
    pages,
    signatureImage,
    compressForWeb = false,
  } = options;

  const spec = PAPER_SPECS[paperSize];
  let paperWidthMm = spec.widthMm;
  let paperHeightMm = spec.heightMm;

  if (orientation === 'landscape' && paperSize !== 'individual') {
    const temp = paperWidthMm;
    paperWidthMm = paperHeightMm;
    paperHeightMm = temp;
  }

  let formatParam: [number, number] | string = [paperWidthMm, paperHeightMm];
  if (paperSize === 'carta') formatParam = 'letter';
  else if (paperSize === 'oficio') formatParam = 'legal';
  else if (paperSize === 'a4') formatParam = 'a4';

  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: formatParam,
    compress: true,
  });

  const renderSinglePage = async (
    pageFront?: string,
    pageBack?: string,
    pageDocType = docType,
    pageLayout = layout,
    isFirstPage = true,
    pageSig?: string
  ) => {
    if (!isFirstPage) {
      doc.addPage(formatParam, orientation);
    }

    let fImg = pageFront;
    let bImg = pageBack;
    if (compressForWeb) {
      if (fImg) fImg = await compressImageForWeb(fImg);
      if (bImg) bImg = await compressImageForWeb(bImg);
    }

    if (paperSize === 'individual') {
      const img = fImg || bImg;
      if (img) {
        doc.addImage(img, 'JPEG', 0, 0, paperWidthMm, paperHeightMm, undefined, 'FAST');
      }
      return;
    }

    const imgFront = fImg ? await loadImage(fImg) : null;
    const imgBack = bImg ? await loadImage(bImg) : null;

    const frontRatio = imgFront
      ? (imgFront.naturalWidth || imgFront.width) / (imgFront.naturalHeight || imgFront.height)
      : undefined;
    const backRatio = imgBack
      ? (imgBack.naturalWidth || imgBack.width) / (imgBack.naturalHeight || imgBack.height)
      : undefined;

    const placement = calculateCardPlacement(
      paperWidthMm,
      paperHeightMm,
      pageLayout,
      scalePercent,
      Boolean(bImg),
      pageDocType,
      frontRatio,
      backRatio
    );

    const imgFormat = compressForWeb ? 'JPEG' : 'PNG';

    if (placement.front && fImg) {
      doc.addImage(
        fImg,
        imgFormat,
        placement.front.x,
        placement.front.y,
        placement.front.w,
        placement.front.h,
        undefined,
        'FAST'
      );
    }

    if (placement.back && bImg) {
      doc.addImage(
        bImg,
        imgFormat,
        placement.back.x,
        placement.back.y,
        placement.back.w,
        placement.back.h,
        undefined,
        'FAST'
      );
    }

    // Render digital signature if present
    if (pageSig) {
      const sigImg = await loadImage(pageSig);
      const scale = (options.signatureScale || 100) / 100;
      const sigW = 48 * scale; // mm
      const sigH = (sigW * (sigImg.height || 100)) / (sigImg.width || 200);

      let sigX = (paperWidthMm - sigW) / 2;
      if (options.signaturePosition === 'bottom-left') {
        sigX = 24;
      } else if (options.signaturePosition === 'bottom-right') {
        sigX = paperWidthMm - sigW - 24;
      }

      const hasLabel =
        typeof options.signatureLabel === 'string'
          ? options.signatureLabel.trim().length > 0
          : true;
      const labelText =
        typeof options.signatureLabel === 'string'
          ? options.signatureLabel.trim()
          : 'Firma del Titular';

      const sigY = paperHeightMm - sigH - (hasLabel ? 18 : 12);
      doc.addImage(pageSig, 'PNG', sigX, sigY, sigW, sigH, undefined, 'FAST');

      if (hasLabel) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const labelX = sigX + sigW / 2;
        doc.text(labelText, labelX, paperHeightMm - 14, { align: 'center' });
      }
    }

    // Draw watermark if configured
    if (watermarkText && watermarkText.trim().length > 0) {
      doc.setFontSize(28);
      doc.setTextColor(190, 195, 205);
      doc.text(watermarkText.toUpperCase(), paperWidthMm / 2, paperHeightMm / 2, {
        align: 'center',
        angle: 32,
      });
    }
  };

  // Render primary page with signature
  await renderSinglePage(frontImage, backImage, docType, layout, true, signatureImage);

  // Render additional pages if multi-page document
  if (pages && pages.length > 0) {
    for (const page of pages) {
      await renderSinglePage(
        page.frontImage,
        page.backImage,
        page.docType || docType,
        page.layout || (page.backImage ? 'vertical-stacked' : 'single-front'),
        false
      );
    }
  }

  return doc.output('blob');
}
