import type { CardCorners, DocumentFilter, DocumentType, Point } from '../types';
import { DOCUMENT_SPECS, ID1_STANDARDS } from '../types';

/**
 * Loads an image from a Data URL into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Rotates an image by 90 degrees clockwise
 */
export async function rotateImage90(imageSrc: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalHeight || img.height;
  canvas.height = img.naturalWidth || img.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((90 * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Applies redaction / black censorship rectangles to hide sensitive details
 */
export async function applyCensorship(
  imageSrc: string,
  rects: { x: number; y: number; width: number; height: number }[]
): Promise<string> {
  if (rects.length === 0) return imageSrc;
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;

  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000000';
  for (const r of rects) {
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }
  return canvas.toDataURL('image/png');
}

/**
 * Calculates 4 initial default corners inside an image based on DocumentType
 */
export function getDefaultCorners(
  width: number,
  height: number,
  docType: DocumentType = 'ine'
): CardCorners {
  const spec = DOCUMENT_SPECS[docType];

  if (docType === 'documento' || spec.aspectRatio === 0) {
    const marginX = Math.round(width * 0.08);
    const marginY = Math.round(height * 0.08);
    return {
      topLeft: { x: marginX, y: marginY },
      topRight: { x: width - marginX, y: marginY },
      bottomRight: { x: width - marginX, y: height - marginY },
      bottomLeft: { x: marginX, y: height - marginY },
    };
  }

  const ratio = spec.aspectRatio;
  const marginX = width * 0.08;
  const targetW = width - marginX * 2;
  const targetH = targetW / ratio;

  let finalW = targetW;
  let finalH = targetH;
  if (finalH > height * 0.82) {
    finalH = height * 0.82;
    finalW = finalH * ratio;
  }

  const startX = (width - finalW) / 2;
  const startY = (height - finalH) / 2;

  return {
    topLeft: { x: startX, y: startY },
    topRight: { x: startX + finalW, y: startY },
    bottomRight: { x: startX + finalW, y: startY + finalH },
    bottomLeft: { x: startX, y: startY + finalH },
  };
}

/**
 * Robust Theil-Sen + RANSAC / Trimmed Least Squares line fitter.
 * Fits dep = slope * indep + intercept from noisy edge candidates.
 */
function fitRobustLine(
  points: { indep: number; dep: number; weight: number }[]
): { slope: number; intercept: number; inlierRatio: number } | null {
  const n = points.length;
  if (n < 4) return null;

  // Compute pairwise slopes (Theil-Sen estimator) for pairs sufficiently far apart
  const slopes: number[] = [];
  const step = Math.max(1, Math.floor(n / 24));
  for (let i = 0; i < n; i += step) {
    for (let j = i + 2; j < n; j += step) {
      const dIndep = points[j].indep - points[i].indep;
      if (Math.abs(dIndep) > 6) {
        const s = (points[j].dep - points[i].dep) / dIndep;
        // Document edges in handheld scanning rarely tilt more than ~52 degrees (slope ~1.3)
        if (Math.abs(s) <= 1.35) {
          slopes.push(s);
        }
      }
    }
  }

  let medianSlope = 0;
  if (slopes.length > 0) {
    slopes.sort((a, b) => a - b);
    medianSlope = slopes[Math.floor(slopes.length / 2)];
  }

  // Compute intercepts for each point using medianSlope
  const intercepts = points.map((p) => p.dep - medianSlope * p.indep);
  intercepts.sort((a, b) => a - b);
  const medianIntercept = intercepts[Math.floor(intercepts.length / 2)];

  // Filter inliers within 3.8px of initial robust line
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumW = 0;
  let inliers = 0;

  for (const p of points) {
    const predicted = medianSlope * p.indep + medianIntercept;
    const residual = Math.abs(p.dep - predicted);
    if (residual <= 4.2) {
      const w = p.weight;
      sumX += w * p.indep;
      sumY += w * p.dep;
      sumXY += w * p.indep * p.dep;
      sumXX += w * p.indep * p.indep;
      sumW += w;
      inliers++;
    }
  }

  if (inliers < 4 || sumW === 0) {
    return {
      slope: medianSlope,
      intercept: medianIntercept,
      inlierRatio: inliers / n,
    };
  }

  const denom = sumW * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-5) {
    return {
      slope: medianSlope,
      intercept: medianIntercept,
      inlierRatio: inliers / n,
    };
  }

  const refinedSlope = Math.max(-1.35, Math.min(1.35, (sumW * sumXY - sumX * sumY) / denom));
  const refinedIntercept = (sumY - refinedSlope * sumX) / sumW;

  return {
    slope: refinedSlope,
    intercept: refinedIntercept,
    inlierRatio: inliers / n,
  };
}

/**
 * Intersects a horizontal-ish line (y = mH * x + bH) with a vertical-ish line (x = mV * y + bV)
 */
function intersectHV(
  lineH: { slope: number; intercept: number },
  lineV: { slope: number; intercept: number }
): Point {
  // y = mH * x + bH  and  x = mV * y + bV
  // => y = mH * (mV * y + bV) + bH => y * (1 - mH * mV) = mH * bV + bH
  const denom = 1 - lineH.slope * lineV.slope;
  if (Math.abs(denom) < 1e-5) {
    const y = lineH.intercept;
    const x = lineV.intercept;
    return { x, y };
  }
  const y = (lineH.slope * lineV.intercept + lineH.intercept) / denom;
  const x = lineV.slope * y + lineV.intercept;
  return { x, y };
}

/**
 * Detects an isolated ID card (INE) or Passport resting on a larger surface (e.g. white sheet of paper or desk).
 * Looks for high-texture rectangular clusters that match standard ID-1 (1.585) or ID-3 (1.42) card geometry.
 */
function detectCardIsland(
  smL: Float32Array,
  smR: Float32Array,
  smG: Float32Array,
  smB: Float32Array,
  W: number,
  H: number,
  bgL: number,
  bgR: number,
  bgG: number,
  bgB: number,
  docType: DocumentType,
  fallback: CardCorners
): { detected: boolean; confidence: number; corners: CardCorners } {
  const cardMask = new Uint8Array(W * H);
  const rowHits = new Int32Array(H);

  for (let y = 3; y < H - 3; y++) {
    const row = y * W;
    let rHits = 0;
    for (let x = 3; x < W - 3; x++) {
      const idx = row + x;
      const dL = Math.abs(smL[idx] - bgL);
      const dColor = Math.hypot(smR[idx] - bgR, smG[idx] - bgG, smB[idx] - bgB);
      const gx = Math.abs(smL[idx + 1] - smL[idx - 1]);
      const gy = Math.abs(smL[idx + W] - smL[idx - W]);
      if (dL > 14 || dColor > 16 || gx > 10 || gy > 10) {
        cardMask[idx] = 1;
        rHits++;
      }
    }
    rowHits[y] = rHits;
  }

  // Find contiguous row span with card content
  const minRowHits = Math.floor(W * 0.12);
  let bestSegment: { y1: number; y2: number; score: number } | null = null;
  let curStart = -1;

  for (let y = 4; y < H - 4; y++) {
    if (rowHits[y] >= minRowHits) {
      if (curStart === -1) curStart = y;
    } else {
      if (curStart !== -1) {
        const span = y - curStart;
        if (span >= Math.floor(H * 0.08) && span <= Math.floor(H * 0.75)) {
          let sumHits = 0;
          for (let k = curStart; k < y; k++) sumHits += rowHits[k];
          if (!bestSegment || sumHits > bestSegment.score) {
            bestSegment = { y1: curStart, y2: y, score: sumHits };
          }
        }
        curStart = -1;
      }
    }
  }

  if (curStart !== -1) {
    const span = H - 4 - curStart;
    if (span >= Math.floor(H * 0.08) && span <= Math.floor(H * 0.75)) {
      let sumHits = 0;
      for (let k = curStart; k < H - 4; k++) sumHits += rowHits[k];
      if (!bestSegment || sumHits > bestSegment.score) {
        bestSegment = { y1: curStart, y2: H - 4, score: sumHits };
      }
    }
  }

  if (!bestSegment) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  const { y1: startY, y2: endY } = bestSegment;
  const spanH = endY - startY;

  // In the row band [startY..endY], find column bounds
  const colHits = new Int32Array(W);
  for (let y = startY; y <= endY; y++) {
    const row = y * W;
    for (let x = 3; x < W - 3; x++) {
      if (cardMask[row + x]) colHits[x]++;
    }
  }

  const minColHits = Math.floor(spanH * 0.15);
  let minX = -1;
  let maxX = -1;
  for (let x = 4; x < W - 4; x++) {
    if (colHits[x] >= minColHits) {
      if (minX === -1) minX = x;
      maxX = x;
    }
  }

  if (minX === -1 || maxX - minX < Math.floor(W * 0.15)) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  const spanW = maxX - minX;
  const aspect = spanW / spanH;

  // Expected aspect ratio: INE card 1.585, Passport 1.42
  const targetRatio = docType === 'ine' ? 1.585 : 1.42;
  let finalMinX = minX;
  let finalMaxX = maxX;
  let finalMinY = startY;
  let finalMaxY = endY;

  if (Math.abs(aspect - targetRatio) > 0.35 && docType !== 'documento') {
    // Re-center with standard document ratio
    const cx = (minX + maxX) / 2;
    const cy = (startY + endY) / 2;
    const finalW = spanW;
    const finalH = finalW / targetRatio;
    finalMinX = Math.max(4, Math.round(cx - finalW / 2));
    finalMaxX = Math.min(W - 5, Math.round(cx + finalW / 2));
    finalMinY = Math.max(4, Math.round(cy - finalH / 2));
    finalMaxY = Math.min(H - 5, Math.round(cy + finalH / 2));
  }

  const padX = Math.max(1, Math.round((finalMaxX - finalMinX) * 0.015));
  const padY = Math.max(1, Math.round((finalMaxY - finalMinY) * 0.015));

  const cTL = { x: Math.max(3, finalMinX - padX), y: Math.max(3, finalMinY - padY) };
  const cTR = { x: Math.min(W - 4, finalMaxX + padX), y: Math.max(3, finalMinY - padY) };
  const cBR = { x: Math.min(W - 4, finalMaxX + padX), y: Math.min(H - 4, finalMaxY + padY) };
  const cBL = { x: Math.max(3, finalMinX - padX), y: Math.min(H - 4, finalMaxY + padY) };

  return {
    detected: true,
    confidence: 86,
    corners: {
      topLeft: cTL,
      topRight: cTR,
      bottomRight: cBR,
      bottomLeft: cBL,
    },
  };
}

/**
 * Genius Scan-style 4-corner quadrilateral detector from raw RGBA pixel buffer.
 * Works both on live camera frames (e.g. 180x240) and static images.
 * Detects tilted documents, receipts, credentials (INE), and sheets against wood, fabric, or dark/light desks.
 */
export function detectDocumentQuadFromPixels(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  docType: DocumentType = 'ine'
): { detected: boolean; confidence: number; corners: CardCorners } {
  const fallback = getDefaultCorners(W, H, docType);
  const N = W * H;
  if (N < 1000) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  // 1. Extract RGB and Luminance channels, then apply a fast 3x3 box blur to suppress wood grain & noise
  const rawR = new Float32Array(N);
  const rawG = new Float32Array(N);
  const rawB = new Float32Array(N);
  const rawL = new Float32Array(N);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    rawR[j] = r;
    rawG[j] = g;
    rawB[j] = b;
    rawL[j] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const smR = new Float32Array(N);
  const smG = new Float32Array(N);
  const smB = new Float32Array(N);
  const smL = new Float32Array(N);

  // Separable 5-tap horizontal + vertical smoothing inside [2..W-3, 2..H-3]
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const idx = row + x;
      if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) {
        smR[idx] = rawR[idx];
        smG[idx] = rawG[idx];
        smB[idx] = rawB[idx];
        smL[idx] = rawL[idx];
      } else {
        const i0 = idx - W - 1;
        const i1 = idx - W;
        const i2 = idx - W + 1;
        const i3 = idx - 1;
        const i4 = idx;
        const i5 = idx + 1;
        const i6 = idx + W - 1;
        const i7 = idx + W;
        const i8 = idx + W + 1;
        smR[idx] = (rawR[i0] + rawR[i1] + rawR[i2] + rawR[i3] + rawR[i4] + rawR[i5] + rawR[i6] + rawR[i7] + rawR[i8]) / 9;
        smG[idx] = (rawG[i0] + rawG[i1] + rawG[i2] + rawG[i3] + rawG[i4] + rawG[i5] + rawG[i6] + rawG[i7] + rawG[i8]) / 9;
        smB[idx] = (rawB[i0] + rawB[i1] + rawB[i2] + rawB[i3] + rawB[i4] + rawB[i5] + rawB[i6] + rawB[i7] + rawB[i8]) / 9;
        smL[idx] = (rawL[i0] + rawL[i1] + rawL[i2] + rawL[i3] + rawL[i4] + rawL[i5] + rawL[i6] + rawL[i7] + rawL[i8]) / 9;
      }
    }
  }

  // 2. Estimate background color model from the outer perimeter strips
  const borderSamplesR: number[] = [];
  const borderSamplesG: number[] = [];
  const borderSamplesB: number[] = [];
  const borderSamplesL: number[] = [];

  const strip = Math.max(3, Math.floor(Math.min(W, H) * 0.045));
  for (let x = 2; x < W - 2; x += 3) {
    const topIdx = strip * W + x;
    const botIdx = (H - 1 - strip) * W + x;
    borderSamplesR.push(smR[topIdx], smR[botIdx]);
    borderSamplesG.push(smG[topIdx], smG[botIdx]);
    borderSamplesB.push(smB[topIdx], smB[botIdx]);
    borderSamplesL.push(smL[topIdx], smL[botIdx]);
  }
  for (let y = strip; y < H - strip; y += 3) {
    const leftIdx = y * W + strip;
    const rightIdx = y * W + (W - 1 - strip);
    borderSamplesR.push(smR[leftIdx], smR[rightIdx]);
    borderSamplesG.push(smG[leftIdx], smG[rightIdx]);
    borderSamplesB.push(smB[leftIdx], smB[rightIdx]);
    borderSamplesL.push(smL[leftIdx], smL[rightIdx]);
  }

  const trimmedMedian = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const q1 = Math.floor(sorted.length * 0.25);
    const q3 = Math.floor(sorted.length * 0.75);
    let sum = 0;
    let count = 0;
    for (let i = q1; i <= q3; i++) {
      sum += sorted[i];
      count++;
    }
    return count > 0 ? sum / count : sorted[Math.floor(sorted.length / 2)];
  };

  const bgR = trimmedMedian(borderSamplesR);
  const bgG = trimmedMedian(borderSamplesG);
  const bgB = trimmedMedian(borderSamplesB);
  const bgL = trimmedMedian(borderSamplesL);

  // 3. Model the document surface from the central core [0.32..0.68] x [0.33..0.60]
  const coreX1 = Math.floor(W * 0.32);
  const coreX2 = Math.floor(W * 0.68);
  const coreY1 = Math.floor(H * 0.33);
  const coreY2 = Math.floor(H * 0.60);

  const coreLums: number[] = [];
  for (let y = coreY1; y <= coreY2; y += 2) {
    const row = y * W;
    for (let x = coreX1; x <= coreX2; x += 2) {
      coreLums.push(smL[row + x]);
    }
  }
  coreLums.sort((a, b) => a - b);
  const p60 = coreLums[Math.floor(coreLums.length * 0.60)] || 120;
  const p88 = coreLums[Math.floor(coreLums.length * 0.88)] || 200;

  let sumDocL = 0;
  let sumDocR = 0;
  let sumDocG = 0;
  let sumDocB = 0;
  let docSamples = 0;

  for (let y = coreY1; y <= coreY2; y += 2) {
    const row = y * W;
    for (let x = coreX1; x <= coreX2; x += 2) {
      const idx = row + x;
      const l = smL[idx];
      if (l >= p60 && l <= p88) {
        sumDocL += l;
        sumDocR += smR[idx];
        sumDocG += smG[idx];
        sumDocB += smB[idx];
        docSamples++;
      }
    }
  }

  if (docSamples < 10) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  const docL = sumDocL / docSamples;
  const docR = sumDocR / docSamples;
  const docG = sumDocG / docSamples;
  const docB = sumDocB / docSamples;
  const docRG = docR - docG;
  const docBG = docB - docG;

  // Verify the central document actually contrasts with the outer frame border
  const coreVsBorderColor = Math.hypot(docR - bgR, docG - bgG, docB - bgB);
  const coreVsBorderLum = docL - bgL;
  if (docL < 80 || (coreVsBorderLum < 18 && coreVsBorderColor < 26)) {
    // If the center lacks contrast with the perimeter (e.g. card sitting on a white sheet or large desk),
    // detect the card island feature:
    const island = detectCardIsland(smL, smR, smG, smB, W, H, bgL, bgR, bgG, bgB, docType, fallback);
    if (island.detected) return island;
    return { detected: false, confidence: 0, corners: fallback };
  }

  // 4. Compute Document Surface Affinity Map `surf` in [0..255]
  // High (~docL) on paper/card substrate; drops sharply on dark desks, wood grain, colored surfaces, or LED glare
  const surf = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const dLumBelow = Math.max(0, docL - smL[i]);
    const dLumAbove = Math.max(0, smL[i] - (docL + 42));
    const dChroma =
      Math.abs(smR[i] - smG[i] - docRG) + Math.abs(smB[i] - smG[i] - docBG);
    surf[i] = Math.max(0, docL - dLumBelow - dLumAbove * 1.1 - dChroma * 0.52);
  }

  const minXScan = Math.max(6, Math.floor(W * 0.035));
  const maxXScan = Math.min(W - 7, Math.floor(W * 0.965));
  const minYScan = Math.max(6, Math.floor(H * 0.04));
  const maxYScan = Math.min(H - 7, Math.floor(H * 0.94));

  const insideMin = docL * 0.71;
  const outsideMax = docL * 0.64;
  const minDrop = Math.max(18, docL * 0.14);

  // Inside-Out Peak-Gradient Ray Casters (start inside the document and walk outward until hitting the true outer edge)
  const castUp = (x: number, startY: number): { pos: number; weight: number } | null => {
    let darkRun = 0;
    let bestY = -1;
    let bestDrop = 0;
    for (let y = startY; y >= minYScan; y--) {
      if (surf[y * W + x] < outsideMax) darkRun++;
      else darkRun = 0;

      let inMax = 0;
      for (let k = 1; k <= 5; k++) {
        const v = surf[Math.min(H - 1, y + k) * W + x];
        if (v > inMax) inMax = v;
      }
      let outSum = 0;
      for (let k = 1; k <= 5; k++) {
        outSum += surf[Math.max(0, y - k) * W + x];
      }
      const outMean = outSum / 5;
      const drop =
        surf[Math.min(H - 1, y + 2) * W + x] - surf[Math.max(0, y - 2) * W + x];

      if (inMax >= insideMin && outMean <= outsideMax && drop >= minDrop && drop > bestDrop) {
        bestDrop = drop;
        bestY = y;
      }
      if (darkRun >= 6 && bestY !== -1) break;
    }
    return bestY !== -1 ? { pos: bestY, weight: bestDrop } : null;
  };

  const castDown = (x: number, startY: number): { pos: number; weight: number } | null => {
    let darkRun = 0;
    let bestY = -1;
    let bestDrop = 0;
    for (let y = startY; y <= maxYScan; y++) {
      if (surf[y * W + x] < outsideMax) darkRun++;
      else darkRun = 0;

      let inMax = 0;
      for (let k = 1; k <= 5; k++) {
        const v = surf[Math.max(0, y - k) * W + x];
        if (v > inMax) inMax = v;
      }
      let outSum = 0;
      for (let k = 1; k <= 5; k++) {
        outSum += surf[Math.min(H - 1, y + k) * W + x];
      }
      const outMean = outSum / 5;
      const drop =
        surf[Math.max(0, y - 2) * W + x] - surf[Math.min(H - 1, y + 2) * W + x];

      if (inMax >= insideMin && outMean <= outsideMax && drop >= minDrop && drop > bestDrop) {
        bestDrop = drop;
        bestY = y;
      }
      if (darkRun >= 6 && bestY !== -1) break;
    }
    return bestY !== -1 ? { pos: bestY, weight: bestDrop } : null;
  };

  const castLeft = (y: number, startX: number): { pos: number; weight: number } | null => {
    const row = y * W;
    let darkRun = 0;
    let bestX = -1;
    let bestDrop = 0;
    for (let x = startX; x >= minXScan; x--) {
      if (surf[row + x] < outsideMax) darkRun++;
      else darkRun = 0;

      let inMax = 0;
      for (let k = 1; k <= 5; k++) {
        const v = surf[row + Math.min(W - 1, x + k)];
        if (v > inMax) inMax = v;
      }
      let outSum = 0;
      for (let k = 1; k <= 5; k++) {
        outSum += surf[row + Math.max(0, x - k)];
      }
      const outMean = outSum / 5;
      const drop =
        surf[row + Math.min(W - 1, x + 2)] - surf[row + Math.max(0, x - 2)];

      if (inMax >= insideMin && outMean <= outsideMax && drop >= minDrop && drop > bestDrop) {
        bestDrop = drop;
        bestX = x;
      }
      if (darkRun >= 6 && bestX !== -1) break;
    }
    return bestX !== -1 ? { pos: bestX, weight: bestDrop } : null;
  };

  const castRight = (y: number, startX: number): { pos: number; weight: number } | null => {
    const row = y * W;
    let darkRun = 0;
    let bestX = -1;
    let bestDrop = 0;
    for (let x = startX; x <= maxXScan; x++) {
      if (surf[row + x] < outsideMax) darkRun++;
      else darkRun = 0;

      let inMax = 0;
      for (let k = 1; k <= 5; k++) {
        const v = surf[row + Math.max(0, x - k)];
        if (v > inMax) inMax = v;
      }
      let outSum = 0;
      for (let k = 1; k <= 5; k++) {
        outSum += surf[row + Math.min(W - 1, x + k)];
      }
      const outMean = outSum / 5;
      const drop =
        surf[row + Math.max(0, x - 2)] - surf[row + Math.min(W - 1, x + 2)];

      if (inMax >= insideMin && outMean <= outsideMax && drop >= minDrop && drop > bestDrop) {
        bestDrop = drop;
        bestX = x;
      }
      if (darkRun >= 6 && bestX !== -1) break;
    }
    return bestX !== -1 ? { pos: bestX, weight: bestDrop } : null;
  };

  // 5. Pass 1: Coarse Span Discovery from Center
  const seedX = Math.floor(W * 0.5);
  const seedY = Math.floor(H * 0.46);

  const coarseTops: number[] = [];
  const coarseBots: number[] = [];
  for (let x = Math.floor(W * 0.34); x <= Math.floor(W * 0.66); x += 5) {
    const t = castUp(x, seedY);
    if (t) coarseTops.push(t.pos);
    const b = castDown(x, seedY);
    if (b) coarseBots.push(b.pos);
  }

  const coarseLefts: number[] = [];
  const coarseRights: number[] = [];
  for (let y = Math.floor(H * 0.35); y <= Math.floor(H * 0.58); y += 5) {
    const l = castLeft(y, seedX);
    if (l) coarseLefts.push(l.pos);
    const r = castRight(y, seedX);
    if (r) coarseRights.push(r.pos);
  }

  if (
    coarseTops.length < 3 ||
    coarseBots.length < 3 ||
    coarseLefts.length < 3 ||
    coarseRights.length < 3
  ) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  const medianNum = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const spanTop = medianNum(coarseTops);
  const spanBottom = medianNum(coarseBots);
  const spanLeft = medianNum(coarseLefts);
  const spanRight = medianNum(coarseRights);

  const spanW = spanRight - spanLeft;
  const spanH = spanBottom - spanTop;
  if (spanW < W * 0.22 || spanH < H * 0.14) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  // 6. Pass 2: Dense Precision Edge Sampling restricted strictly within the document's active span
  const midX = Math.floor((spanLeft + spanRight) / 2);
  const midY = Math.floor((spanTop + spanBottom) / 2);

  const xStart = Math.max(minXScan + 2, Math.floor(spanLeft + spanW * 0.15));
  const xEnd = Math.min(maxXScan - 2, Math.floor(spanRight - spanW * 0.15));
  const yStart = Math.max(minYScan + 2, Math.floor(spanTop + spanH * 0.15));
  const yEnd = Math.min(maxYScan - 2, Math.floor(spanBottom - spanH * 0.15));

  const topPoints: { indep: number; dep: number; weight: number }[] = [];
  const bottomPoints: { indep: number; dep: number; weight: number }[] = [];
  const leftPoints: { indep: number; dep: number; weight: number }[] = [];
  const rightPoints: { indep: number; dep: number; weight: number }[] = [];

  for (let x = xStart; x <= xEnd; x += 2) {
    const t = castUp(x, midY);
    if (t) topPoints.push({ indep: x, dep: t.pos, weight: t.weight });
    const b = castDown(x, midY);
    if (b) bottomPoints.push({ indep: x, dep: b.pos, weight: b.weight });
  }

  for (let y = yStart; y <= yEnd; y += 2) {
    const l = castLeft(y, midX);
    if (l) leftPoints.push({ indep: y, dep: l.pos, weight: l.weight });
    const r = castRight(y, midX);
    if (r) rightPoints.push({ indep: y, dep: r.pos, weight: r.weight });
  }

  // 7. Fit robust straight lines to each of the 4 sides
  const topLine = fitRobustLine(topPoints);
  const bottomLine = fitRobustLine(bottomPoints);
  const leftLine = fitRobustLine(leftPoints);
  const rightLine = fitRobustLine(rightPoints);

  if (!topLine || !bottomLine || !leftLine || !rightLine) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  // 8. Compute exact 4-corner intersections of the tilted lines
  const rawTL = intersectHV(topLine, leftLine);
  const rawTR = intersectHV(topLine, rightLine);
  const rawBR = intersectHV(bottomLine, rightLine);
  const rawBL = intersectHV(bottomLine, leftLine);

  const clampPt = (p: Point): Point => ({
    x: Math.max(2, Math.min(W - 3, p.x)),
    y: Math.max(2, Math.min(H - 3, p.y)),
  });

  const tl = clampPt(rawTL);
  const tr = clampPt(rawTR);
  const br = clampPt(rawBR);
  const bl = clampPt(rawBL);

  // 9. Validate geometry: side lengths, opposite side symmetry, corner angles, and convexity
  const topLen = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const botLen = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftLen = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightLen = Math.hypot(br.x - tr.x, br.y - tr.y);

  const minSide = Math.min(W, H) * 0.18;
  if (topLen < minSide || botLen < minSide || leftLen < minSide || rightLen < minSide) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  // Opposite sides of a real rectangular sheet/card in handheld perspective should be within 1.55x of each other
  if (
    Math.max(topLen, botLen) / Math.max(1, Math.min(topLen, botLen)) > 1.55 ||
    Math.max(leftLen, rightLen) / Math.max(1, Math.min(leftLen, rightLen)) > 1.55
  ) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  // Interior corner angle check: all 4 corners must be reasonably close to 90 degrees (|cos| < 0.36)
  const absCosAngle = (a: Point, b: Point, c: Point) => {
    const ux = a.x - b.x;
    const uy = a.y - b.y;
    const vx = c.x - b.x;
    const vy = c.y - b.y;
    const mag = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    return mag > 1e-4 ? Math.abs(ux * vx + uy * vy) / mag : 1;
  };

  if (
    absCosAngle(bl, tl, tr) > 0.36 ||
    absCosAngle(tl, tr, br) > 0.36 ||
    absCosAngle(tr, br, bl) > 0.36 ||
    absCosAngle(br, bl, tl) > 0.36
  ) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  // Convexity check via cross products of consecutive edges (TL -> TR -> BR -> BL)
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

  if (
    cross(tl, tr, br) <= 0 ||
    cross(tr, br, bl) <= 0 ||
    cross(br, bl, tl) <= 0 ||
    cross(bl, tl, tr) <= 0
  ) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  // Polygon area via Shoelace formula
  const quadArea =
    0.5 *
    Math.abs(
      tl.x * tr.y -
        tr.x * tl.y +
        tr.x * br.y -
        br.x * tr.y +
        br.x * bl.y -
        bl.x * br.y +
        bl.x * tl.y -
        tl.x * bl.y
    );

  if (quadArea < N * 0.08 || quadArea > N * 0.92) {
    return { detected: false, confidence: 0, corners: fallback };
  }

  const avgInlierRatio =
    (topLine.inlierRatio + bottomLine.inlierRatio + leftLine.inlierRatio + rightLine.inlierRatio) / 4;
  const pointSupport = Math.min(
    1,
    (topPoints.length + bottomPoints.length + leftPoints.length + rightPoints.length) /
      Math.max(24, (spanW + spanH) * 0.55)
  );
  const confidence = Math.min(100, Math.round((avgInlierRatio * 0.65 + pointSupport * 0.35) * 100));

  if (confidence < 52) {
    const island = detectCardIsland(smL, smR, smG, smB, W, H, bgL, bgR, bgG, bgB, docType, fallback);
    if (island.detected) return island;
    return { detected: false, confidence, corners: fallback };
  }

  return {
    detected: true,
    confidence,
    corners: {
      topLeft: tl,
      topRight: tr,
      bottomRight: br,
      bottomLeft: bl,
    },
  };
}

/**
 * Automatically detects the 4 corners of a document (card, passport, receipt, or sheet of paper)
 * against its background using our Genius Scan 4-line RANSAC quadrilateral detector.
 */
export async function autoDetectDocumentCorners(
  imageSrc: string,
  docType: DocumentType = 'ine'
): Promise<CardCorners> {
  const img = await loadImage(imageSrc);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  const procW = 280;
  const procH = Math.max(120, Math.round(procW * (origH / origW)));

  const canvas = document.createElement('canvas');
  canvas.width = procW;
  canvas.height = procH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return getDefaultCorners(origW, origH, docType);

  ctx.drawImage(img, 0, 0, procW, procH);
  const imgData = ctx.getImageData(0, 0, procW, procH);

  const result = detectDocumentQuadFromPixels(imgData.data, procW, procH, docType);
  if (result.detected) {
    const scaleX = origW / procW;
    const scaleY = origH / procH;
    return {
      topLeft: {
        x: Math.round(result.corners.topLeft.x * scaleX),
        y: Math.round(result.corners.topLeft.y * scaleY),
      },
      topRight: {
        x: Math.round(result.corners.topRight.x * scaleX),
        y: Math.round(result.corners.topRight.y * scaleY),
      },
      bottomRight: {
        x: Math.round(result.corners.bottomRight.x * scaleX),
        y: Math.round(result.corners.bottomRight.y * scaleY),
      },
      bottomLeft: {
        x: Math.round(result.corners.bottomLeft.x * scaleX),
        y: Math.round(result.corners.bottomLeft.y * scaleY),
      },
    };
  }

  return getDefaultCorners(origW, origH, docType);
}

/**
 * Computes a 3x3 projective transformation matrix (Homography)
 * mapping source polygon to destination rectangle.
 */
function getProjectiveTransform(src: Point[], dst: Point[]): number[] {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) {
        maxRow = k;
      }
    }
    const tmpA = a[i];
    a[i] = a[maxRow];
    a[maxRow] = tmpA;
    const tmpB = b[i];
    b[i] = b[maxRow];
    b[maxRow] = tmpB;

    for (let k = i + 1; k < n; k++) {
      const c = -a[k][i] / a[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          a[k][j] = 0;
        } else {
          a[k][j] += c * a[i][j];
        }
      }
      b[k] += c * b[i];
    }
  }

  const h = new Array(9).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += a[i][j] * h[j];
    }
    h[i] = (b[i] - sum) / a[i][i];
  }
  h[8] = 1;
  return h;
}

/**
 * Performs 4-point perspective warp on an image, flattening the document
 * according to its DocumentType (INE 1:1, Passport, or Free Document).
 */
export async function warpPerspective(
  imageSrc: string,
  corners: CardCorners,
  docType: DocumentType = 'ine'
): Promise<string> {
  const img = await loadImage(imageSrc);
  const spec = DOCUMENT_SPECS[docType];

  let targetWidth = 1280;
  let targetHeight = 807;

  if (docType === 'documento' || spec.aspectRatio === 0) {
    const topW = Math.hypot(
      corners.topRight.x - corners.topLeft.x,
      corners.topRight.y - corners.topLeft.y
    );
    const botW = Math.hypot(
      corners.bottomRight.x - corners.bottomLeft.x,
      corners.bottomRight.y - corners.bottomLeft.y
    );
    const leftH = Math.hypot(
      corners.bottomLeft.x - corners.topLeft.x,
      corners.bottomLeft.y - corners.topLeft.y
    );
    const rightH = Math.hypot(
      corners.bottomRight.x - corners.topRight.x,
      corners.bottomRight.y - corners.topRight.y
    );

    const avgW = Math.max(10, (topW + botW) / 2);
    const avgH = Math.max(10, (leftH + rightH) / 2);
    const naturalRatio = avgW / avgH;

    if (naturalRatio >= 1) {
      targetWidth = 1500;
      targetHeight = Math.round(1500 / naturalRatio);
    } else {
      targetHeight = 1600;
      targetWidth = Math.round(1600 * naturalRatio);
    }
  } else {
    targetWidth = 1280;
    targetHeight = Math.round(targetWidth / spec.aspectRatio);
  }

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth || img.width;
  srcCanvas.height = img.naturalHeight || img.height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('Canvas context not available');
  srcCtx.drawImage(img, 0, 0);

  const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const srcPixels = srcImageData.data;
  const sW = srcCanvas.width;
  const sH = srcCanvas.height;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetWidth;
  dstCanvas.height = targetHeight;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) throw new Error('Target canvas context not available');

  const dstImageData = dstCtx.createImageData(targetWidth, targetHeight);
  const dstPixels = dstImageData.data;

  const dstPoints: Point[] = [
    { x: 0, y: 0 },
    { x: targetWidth, y: 0 },
    { x: targetWidth, y: targetHeight },
    { x: 0, y: targetHeight },
  ];

  const srcPoints: Point[] = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];

  const hInv = getProjectiveTransform(dstPoints, srcPoints);

  const h0 = hInv[0], h1 = hInv[1], h2 = hInv[2];
  const h3 = hInv[3], h4 = hInv[4], h5 = hInv[5];
  const h6 = hInv[6], h7 = hInv[7], h8 = hInv[8];

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const w = h6 * x + h7 * y + h8;
      const srcX = (h0 * x + h1 * y + h2) / w;
      const srcY = (h3 * x + h4 * y + h5) / w;

      if (srcX >= 0 && srcX < sW - 1 && srcY >= 0 && srcY < sH - 1) {
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const dx = srcX - x0;
        const dy = srcY - y0;
        const w00 = (1 - dx) * (1 - dy);
        const w10 = dx * (1 - dy);
        const w01 = (1 - dx) * dy;
        const w11 = dx * dy;

        const idx00 = (y0 * sW + x0) * 4;
        const idx10 = (y0 * sW + x1) * 4;
        const idx01 = (y1 * sW + x0) * 4;
        const idx11 = (y1 * sW + x1) * 4;

        const dstIdx = (y * targetWidth + x) * 4;

        dstPixels[dstIdx] = Math.round(
          srcPixels[idx00] * w00 + srcPixels[idx10] * w10 + srcPixels[idx01] * w01 + srcPixels[idx11] * w11
        );
        dstPixels[dstIdx + 1] = Math.round(
          srcPixels[idx00 + 1] * w00 + srcPixels[idx10 + 1] * w10 + srcPixels[idx01 + 1] * w01 + srcPixels[idx11 + 1] * w11
        );
        dstPixels[dstIdx + 2] = Math.round(
          srcPixels[idx00 + 2] * w00 + srcPixels[idx10 + 2] * w10 + srcPixels[idx01 + 2] * w01 + srcPixels[idx11 + 2] * w11
        );
        dstPixels[dstIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(dstImageData, 0, 0);

  if (!spec.roundedCorners) {
    return dstCanvas.toDataURL('image/png');
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const fCtx = finalCanvas.getContext('2d');
  if (!fCtx) return dstCanvas.toDataURL('image/png');

  const cornerRadius = Math.round((ID1_STANDARDS.cornerRadiusMm / ID1_STANDARDS.widthMm) * targetWidth);

  fCtx.save();
  fCtx.beginPath();
  fCtx.roundRect(0, 0, targetWidth, targetHeight, cornerRadius);
  fCtx.clip();
  fCtx.drawImage(dstCanvas, 0, 0);

  fCtx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  fCtx.lineWidth = 1.5;
  fCtx.stroke();
  fCtx.restore();

  return finalCanvas.toDataURL('image/png');
}

/**
 * Applies Genius Scan-grade document filters, local illumination normalization,
 * shadow brightening, brightness & contrast.
 */
export async function applyDocumentFilters(
  imageSrc: string,
  filter: DocumentFilter,
  shadowLift: number = 30,
  brightness: number = 0,
  contrast: number = 0
): Promise<string> {
  const img = await loadImage(imageSrc);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;
  const len = data.length;

  // Build a coarse 32x32 local background illumination grid so uneven phone shadows or brown/kraft paper normalize cleanly
  const gridW = 32;
  const gridH = 32;
  const bgGrid = new Float32Array(gridW * gridH);
  const cellW = W / gridW;
  const cellH = H / gridH;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      let maxLum = 120;
      const startY = Math.floor(gy * cellH);
      const endY = Math.min(H, Math.floor((gy + 1) * cellH));
      const startX = Math.floor(gx * cellW);
      const endX = Math.min(W, Math.floor((gx + 1) * cellW));
      const stepY = Math.max(1, Math.floor((endY - startY) / 5));
      const stepX = Math.max(1, Math.floor((endX - startX) / 5));
      for (let y = startY; y < endY; y += stepY) {
        for (let x = startX; x < endX; x += stepX) {
          const idx = (y * W + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum > maxLum) maxLum = lum;
        }
      }
      bgGrid[gy * gridW + gx] = maxLum;
    }
  }

  // Smooth the 32x32 background illumination grid
  const smoothGrid = new Float32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = gy + dy;
          const nx = gx + dx;
          if (ny >= 0 && ny < gridH && nx >= 0 && nx < gridW) {
            sum += bgGrid[ny * gridW + nx];
            count++;
          }
        }
      }
      smoothGrid[gy * gridW + gx] = sum / count;
    }
  }

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const shadowLiftFactor = shadowLift / 100;

  for (let i = 0, pIdx = 0; i < len; i += 4, pIdx++) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const px = pIdx % W;
    const py = (pIdx - px) / W;
    const gx = Math.min(gridW - 1, Math.floor((px / W) * gridW));
    const gy = Math.min(gridH - 1, Math.floor((py / H) * gridH));
    const localBg = Math.max(115, smoothGrid[gy * gridW + gx]);

    if (shadowLiftFactor > 0) {
      // Normalize local shadow against local paper illumination
      const normScale = 1 + shadowLiftFactor * ((250 / localBg) - 1) * 0.85;
      r = Math.min(255, r * normScale);
      g = Math.min(255, g * normScale);
      b = Math.min(255, b * normScale);
    }

    if (brightness !== 0) {
      r = Math.min(255, Math.max(0, r + brightness * 2));
      g = Math.min(255, Math.max(0, g + brightness * 2));
      b = Math.min(255, Math.max(0, b + brightness * 2));
    }
    if (contrast !== 0) {
      r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128));
    }

    if (filter === 'hd-color') {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > localBg * 0.84) {
        const whiten = Math.min(1, (lum - localBg * 0.84) / (255 - localBg * 0.84 + 1));
        r = Math.min(255, r + (255 - r) * whiten * 0.75);
        g = Math.min(255, g + (255 - g) * whiten * 0.75);
        b = Math.min(255, b + (255 - b) * whiten * 0.75);
      }
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    } else if (filter === 'laser-gray') {
      let gray = (0.299 * r + 0.587 * g + 0.114 * b) * (245 / localBg);
      if (gray > 195) {
        gray = 195 + (gray - 195) * 1.8;
      }
      gray = Math.min(255, Math.max(0, gray));
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    } else if (filter === 'photocopy-bw') {
      // Adaptive local threshold like Genius Scan B&W receipt mode
      const rawLum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const adaptiveThresh = localBg * (0.76 - brightness * 0.002);
      const val = rawLum < adaptiveThresh ? Math.max(8, (rawLum / adaptiveThresh) * 55) : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    } else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}
