import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  AlignmentType,
  convertMillimetersToTwip,
} from 'docx';
import { PAPER_SPECS } from '../types';
import type { SheetRenderOptions } from './sheetRenderer';
import { calculateCardPlacement } from './sheetRenderer';
import { loadImage } from './imageProcessing';

function dataUrlToArrayBuffer(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an official Microsoft Word (.docx) document with physical millimeter scaling
 */
export async function generateDocumentDocx(options: SheetRenderOptions): Promise<Blob> {
  const {
    paperSize,
    docType = 'ine',
    orientation,
    layout,
    scalePercent,
    frontImage,
    backImage,
  } = options;

  const imgFront = frontImage ? await loadImage(frontImage) : null;
  const imgBack = backImage ? await loadImage(backImage) : null;

  const spec = PAPER_SPECS[paperSize];
  let paperWidthMm = spec.widthMm;
  let paperHeightMm = spec.heightMm;

  if (orientation === 'landscape' && paperSize !== 'individual') {
    const temp = paperWidthMm;
    paperWidthMm = paperHeightMm;
    paperHeightMm = temp;
  }

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

  const fW = placement.front ? placement.front.w : 85.6;
  const fH = placement.front ? placement.front.h : 53.98;
  const bW = placement.back ? placement.back.w : fW;
  const bH = placement.back ? placement.back.h : fH;

  const mmToDocxPx = (mm: number) => Math.round(mm * 3.779528);

  const paragraphs: Paragraph[] = [];

  const topMarginTwips = convertMillimetersToTwip(16);
  const sideMarginTwips = convertMillimetersToTwip(16);

  if (layout === 'horizontal-side' && frontImage && backImage) {
    const frontBytes = dataUrlToArrayBuffer(frontImage);
    const backBytes = dataUrlToArrayBuffer(backImage);

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: convertMillimetersToTwip(20), after: convertMillimetersToTwip(20) },
        children: [
          new ImageRun({
            data: frontBytes,
            transformation: {
              width: mmToDocxPx(fW),
              height: mmToDocxPx(fH),
            },
          }),
          new ImageRun({
            data: backBytes,
            transformation: {
              width: mmToDocxPx(bW),
              height: mmToDocxPx(bH),
            },
          }),
        ],
      })
    );
  } else {
    if (frontImage) {
      const frontBytes = dataUrlToArrayBuffer(frontImage);
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: convertMillimetersToTwip(14), after: convertMillimetersToTwip(14) },
          children: [
            new ImageRun({
              data: frontBytes,
              transformation: {
                width: mmToDocxPx(fW),
                height: mmToDocxPx(fH),
              },
            }),
          ],
        })
      );
    }

    if (backImage && layout !== 'single-front') {
      const backBytes = dataUrlToArrayBuffer(backImage);
      const spacingBefore = layout === 'top-aligned' ? 8 : 30;
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: convertMillimetersToTwip(spacingBefore), after: convertMillimetersToTwip(14) },
          children: [
            new ImageRun({
              data: backBytes,
              transformation: {
                width: mmToDocxPx(bW),
                height: mmToDocxPx(bH),
              },
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(paperWidthMm),
              height: convertMillimetersToTwip(paperHeightMm),
              orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
            },
            margin: {
              top: topMarginTwips,
              bottom: topMarginTwips,
              left: sideMarginTwips,
              right: sideMarginTwips,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
