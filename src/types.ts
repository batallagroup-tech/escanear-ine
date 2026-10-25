export type PaperSize = 'carta' | 'oficio' | 'a4' | 'individual';

export type DocumentType = 'ine' | 'pasaporte' | 'documento';

export type PageOrientation = 'portrait' | 'landscape';

export type SheetLayout =
  | 'vertical-stacked'   // Frente arriba, Reverso abajo (Centrado)
  | 'horizontal-side'    // Frente izquierda, Reverso derecha
  | 'top-aligned'        // Ambos en la mitad superior de la hoja
  | 'single-front'       // Solo frente centrado
  | 'single-back';       // Solo reverso centrado

export type DocumentFilter =
  | 'hd-color'     // Color nítido / Alta definición
  | 'original'     // Sin filtro
  | 'laser-gray'   // Grises láser de oficina
  | 'photocopy-bw';// Fotocopia B/N alto contraste

export interface Point {
  x: number;
  y: number;
}

export interface CardCorners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface ScannedCardSide {
  rawImage: string;
  corners: CardCorners;
  warpedImage?: string;
  processedImage?: string;
  aspectRatio: number;
}

export interface PaperDimensions {
  name: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SPECS: Record<PaperSize, PaperDimensions> = {
  carta: { name: 'Hoja Carta', widthMm: 215.9, heightMm: 279.4 },
  oficio: { name: 'Hoja Oficio', widthMm: 215.9, heightMm: 340.4 },
  a4: { name: 'Hoja A4', widthMm: 210.0, heightMm: 297.0 },
  individual: { name: 'Recorte Individual', widthMm: 85.6, heightMm: 53.98 },
};

export interface DocumentTypeSpec {
  id: DocumentType;
  name: string;
  shortName: string;
  description: string;
  widthMm: number;
  heightMm: number;
  aspectRatio: number; // 0 means free/natural aspect ratio from corners
  defaultTwoSided: boolean;
  roundedCorners: boolean;
}

export const DOCUMENT_SPECS: Record<DocumentType, DocumentTypeSpec> = {
  ine: {
    id: 'ine',
    name: 'Credencial INE / Identificación',
    shortName: 'INE / ID',
    description: 'Tamaño oficial de tarjeta (8.56 × 5.4 cm), frente y reverso',
    widthMm: 85.60,
    heightMm: 53.98,
    aspectRatio: 85.60 / 53.98,
    defaultTwoSided: true,
    roundedCorners: true,
  },
  pasaporte: {
    id: 'pasaporte',
    name: 'Pasaporte',
    shortName: 'Pasaporte',
    description: 'Formato libreta de pasaporte (12.5 × 8.8 cm)',
    widthMm: 125.0,
    heightMm: 88.0,
    aspectRatio: 125.0 / 88.0,
    defaultTwoSided: false,
    roundedCorners: false,
  },
  documento: {
    id: 'documento',
    name: 'Documento / Hoja Libre',
    shortName: 'Hoja / Libre',
    description: 'CURP, acta de nacimiento, comprobantes o recibos de cualquier tamaño',
    widthMm: 190.0,
    heightMm: 250.0,
    aspectRatio: 0, // Free aspect ratio based on selected corners
    defaultTwoSided: false,
    roundedCorners: false,
  },
};

// Official ISO/IEC 7810 ID-1 standard dimensions (Mexican INE, Licencia, Tarjeta Bancaria)
export const ID1_STANDARDS = {
  widthMm: 85.60,
  heightMm: 53.98,
  cornerRadiusMm: 3.18,
  aspectRatio: 85.60 / 53.98,
};

export interface PageItem {
  frontImage: string;
  backImage?: string;
  docType?: DocumentType;
  layout?: SheetLayout;
  paperSize?: PaperSize;
}

export type SignaturePosition = 'bottom-center' | 'bottom-left' | 'bottom-right';

export interface SignatureConfig {
  image?: string;
  scalePercent?: number; // 50% to 150%, default 100%
  position?: SignaturePosition; // default 'bottom-center'
  label?: string; // default 'Firma del Titular', '' to remove label
}

export interface SavedDocument {
  id: string;
  title: string;
  createdAt: number;
  frontImage: string;
  backImage?: string;
  paperSize: PaperSize;
  docType?: DocumentType;
  layout: SheetLayout;
  pages?: PageItem[];
  watermarkText?: string;
  signatureConfig?: SignatureConfig;
}
