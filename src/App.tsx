import React, { useState, useEffect } from 'react';
import type { CardCorners, SavedDocument, PaperSize, DocumentType, PageItem, SignaturePosition } from './types';
import { DOCUMENT_SPECS } from './types';
import { OnboardingModal } from './components/OnboardingModal';
import { SmartScanner } from './components/SmartScanner';
import { CornerEditor } from './components/CornerEditor';
import { FilterStudio } from './components/FilterStudio';
import { SheetPreview } from './components/SheetPreview';
import { ExportModal } from './components/ExportModal';
import { AdBanner } from './components/AdBanner';
import { SplashScreen } from './components/SplashScreen';
import { HomeScreen } from './components/HomeScreen';
import { SettingsDrawer } from './components/SettingsDrawer';
import { LockScreen } from './components/LockScreen';
import { warpPerspective, autoDetectDocumentCorners } from './services/imageProcessing';
import { initAdMob } from './services/admobService';
import { isSecurityLockEnabled } from './services/securityService';
import {
  loadSavedDocuments,
  saveDocumentToDB,
  deleteDocumentFromDB,
} from './services/storageService';

type AppStep = 'home' | 'scanner' | 'corner-edit' | 'filter-edit' | 'sheet-preview';

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Security Lock & Dark Mode
  const [isAppLocked, setIsAppLocked] = useState(() => isSecurityLockEnabled());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('escanear_ine_dark_mode') === 'true';
  });

  const [step, setStep] = useState<AppStep>('home');
  const [docType, setDocType] = useState<DocumentType>('ine');
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const [isTwoSided, setIsTwoSided] = useState(true);

  // Persistent documents storage via IndexedDB
  const [documents, setDocuments] = useState<SavedDocument[]>([]);

  const [defaultPaper, setDefaultPaper] = useState<PaperSize>(() => {
    return (localStorage.getItem('escanear_ine_default_paper') as PaperSize) || 'carta';
  });

  // Current capture buffers
  const [capturedFrontRaw, setCapturedFrontRaw] = useState<string | null>(null);
  const [capturedBackRaw, setCapturedBackRaw] = useState<string | null>(null);
  const [frontCorners, setFrontCorners] = useState<CardCorners | null>(null);
  const [backCorners, setBackCorners] = useState<CardCorners | null>(null);

  const [warpedFront, setWarpedFront] = useState<string | null>(null);
  const [warpedBack, setWarpedBack] = useState<string | null>(null);

  const [finalFront, setFinalFront] = useState<string | null>(null);
  const [finalBack, setFinalBack] = useState<string | null>(null);

  // Multi-page document storage
  const [additionalPages, setAdditionalPages] = useState<PageItem[]>([]);
  const [activeWatermark, setActiveWatermark] = useState<string>('');

  // Signature export config
  const [activeSigConfig, setActiveSigConfig] = useState<{
    image?: string;
    scale?: number;
    position?: SignaturePosition;
    label?: string;
  }>({});

  // Active document tracking for exact renamed file sharing
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentDocTitle, setCurrentDocTitle] = useState<string | null>(null);

  const [editingSide, setEditingSide] = useState<'front' | 'back'>('front');
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    initAdMob().catch(() => {});
    loadSavedDocuments().then((docs) => setDocuments(docs));
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem('escanear_ine_onboarding_v1', 'true');
    setShowOnboarding(false);
  };

  const handleChangeDocTypeInCamera = (newType: DocumentType) => {
    setDocType(newType);
    setIsTwoSided(DOCUMENT_SPECS[newType].defaultTwoSided);
  };

  const handleStartCamera = (paper: PaperSize, selectedDocType: DocumentType) => {
    setDefaultPaper(paper);
    setDocType(selectedDocType);
    setIsTwoSided(DOCUMENT_SPECS[selectedDocType].defaultTwoSided);
    handleStartFresh();
    setStep('scanner');
  };

  const handleSelectGallery = (file: File, paper: PaperSize, selectedDocType: DocumentType) => {
    setDefaultPaper(paper);
    setDocType(selectedDocType);
    setIsTwoSided(DOCUMENT_SPECS[selectedDocType].defaultTwoSided);
    handleStartFresh();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl === 'string') {
        setCapturedFrontRaw(dataUrl);
        setEditingSide('front');
        try {
          const detected = await autoDetectDocumentCorners(dataUrl, selectedDocType);
          setFrontCorners(detected);
          const straightened = await warpPerspective(dataUrl, detected, selectedDocType);
          setWarpedFront(straightened);
          setStep('filter-edit');
        } catch {
          setStep('corner-edit');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = async (
    imageDataUrl: string,
    detectedCorners?: CardCorners,
    autoCropImmediate?: boolean
  ) => {
    const side = currentSide;
    setEditingSide(side);

    if (side === 'front') {
      setCapturedFrontRaw(imageDataUrl);
      if (detectedCorners) setFrontCorners(detectedCorners);
    } else {
      setCapturedBackRaw(imageDataUrl);
      if (detectedCorners) setBackCorners(detectedCorners);
    }

    if (autoCropImmediate) {
      try {
        const resolvedCorners =
          detectedCorners || (await autoDetectDocumentCorners(imageDataUrl, docType));
        if (side === 'front') {
          setFrontCorners(resolvedCorners);
        } else {
          setBackCorners(resolvedCorners);
        }
        const straightened = await warpPerspective(imageDataUrl, resolvedCorners, docType);
        if (side === 'front') {
          setWarpedFront(straightened);
        } else {
          setWarpedBack(straightened);
        }
        setStep('filter-edit');
        return;
      } catch (err) {
        console.warn('Auto-crop warp fallback to manual corner editor:', err);
      }
    }

    setStep('corner-edit');
  };

  const handleCornersConfirmed = async (corners: CardCorners, finalImageSrc?: string) => {
    const rawImg = finalImageSrc || (editingSide === 'front' ? capturedFrontRaw : capturedBackRaw);
    if (!rawImg) return;

    if (editingSide === 'front') {
      setFrontCorners(corners);
      if (finalImageSrc) setCapturedFrontRaw(finalImageSrc);
    } else {
      setBackCorners(corners);
      if (finalImageSrc) setCapturedBackRaw(finalImageSrc);
    }

    try {
      const straightened = await warpPerspective(rawImg, corners, docType);
      if (editingSide === 'front') {
        setWarpedFront(straightened);
      } else {
        setWarpedBack(straightened);
      }
      setStep('filter-edit');
    } catch (err) {
      console.warn('Warp failed:', err);
    }
  };

  const handleFilterConfirmed = (processedImage: string) => {
    if (editingSide === 'front') {
      setFinalFront(processedImage);

      if (isTwoSided) {
        setCurrentSide('back');
        setStep('scanner');
      } else {
        saveNewDocument(processedImage, undefined, additionalPages);
        setStep('sheet-preview');
      }
    } else {
      setFinalBack(processedImage);
      if (finalFront) {
        saveNewDocument(finalFront, processedImage, additionalPages);
      }
      setStep('sheet-preview');
    }
  };

  // Add another page to the current document
  const handleAddAnotherPage = () => {
    if (finalFront) {
      setAdditionalPages((prev) => [
        ...prev,
        {
          frontImage: finalFront,
          backImage: finalBack || undefined,
          docType,
          paperSize: defaultPaper,
        },
      ]);
    }
    // Prepare for next page scan
    setCapturedFrontRaw(null);
    setCapturedBackRaw(null);
    setFrontCorners(null);
    setBackCorners(null);
    setWarpedFront(null);
    setWarpedBack(null);
    setFinalFront(null);
    setFinalBack(null);
    setCurrentSide('front');
    setStep('scanner');
  };

  const handleDeletePage = (index: number) => {
    if (index === 0) {
      if (additionalPages.length > 0) {
        const nextFirst = additionalPages[0];
        setFinalFront(nextFirst.frontImage);
        setFinalBack(nextFirst.backImage || null);
        const remaining = additionalPages.slice(1);
        setAdditionalPages(remaining);

        if (currentDocId) {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === currentDocId
                ? {
                    ...d,
                    frontImage: nextFirst.frontImage,
                    backImage: nextFirst.backImage,
                    pages: remaining.length > 0 ? remaining : undefined,
                  }
                : d
            )
          );
        }
      }
    } else {
      const remaining = additionalPages.filter((_, i) => i !== index - 1);
      setAdditionalPages(remaining);
      if (currentDocId) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === currentDocId
              ? {
                  ...d,
                  pages: remaining.length > 0 ? remaining : undefined,
                }
              : d
          )
        );
      }
    }
  };

  const handleToggleDarkMode = (dark: boolean) => {
    setIsDarkMode(dark);
    localStorage.setItem('escanear_ine_dark_mode', String(dark));
  };

  const saveNewDocument = (front: string, back?: string, pages: PageItem[] = []) => {
    const now = new Date();
    const titleDate = now.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const prefix =
      docType === 'ine' ? 'INE' : docType === 'pasaporte' ? 'Pasaporte' : 'Documento';

    const newDoc: SavedDocument = {
      id: `doc_${Date.now()}`,
      title: `${prefix} • ${titleDate}`,
      createdAt: Date.now(),
      frontImage: front,
      backImage: back,
      paperSize: defaultPaper,
      docType,
      layout: back ? 'vertical-stacked' : 'single-front',
      pages: pages.length > 0 ? pages : undefined,
    };

    saveDocumentToDB(newDoc).catch(() => {});

    setCurrentDocId(newDoc.id);
    setCurrentDocTitle(newDoc.title);

    setDocuments((prev) => {
      const updated = [newDoc, ...prev];
      return updated;
    });
  };

  const handleDeleteDocument = (id: string) => {
    deleteDocumentFromDB(id).catch(() => {});
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (currentDocId === id) {
      setCurrentDocId(null);
      setCurrentDocTitle(null);
    }
  };

  const handleRenameDocument = (id: string, newTitle: string) => {
    setDocuments((prev) => {
      const updated = prev.map((doc) => {
        if (doc.id === id) {
          const mod = { ...doc, title: newTitle };
          saveDocumentToDB(mod).catch(() => {});
          return mod;
        }
        return doc;
      });
      return updated;
    });

    if (currentDocId === id) {
      setCurrentDocTitle(newTitle);
    }
  };

  const handleSelectDocument = (doc: SavedDocument) => {
    setCurrentDocId(doc.id);
    setCurrentDocTitle(doc.title);
    setFinalFront(doc.frontImage);
    setFinalBack(doc.backImage || null);
    setDefaultPaper(doc.paperSize || 'carta');
    setDocType(doc.docType || 'ine');
    setAdditionalPages(doc.pages || []);
    setActiveWatermark(doc.watermarkText || '');
    setStep('sheet-preview');
  };

  const handleRetakeCurrent = () => {
    setStep('scanner');
  };

  const handleStartFresh = () => {
    setCurrentDocId(null);
    setCurrentDocTitle(null);
    setCapturedFrontRaw(null);
    setCapturedBackRaw(null);
    setFrontCorners(null);
    setBackCorners(null);
    setWarpedFront(null);
    setWarpedBack(null);
    setFinalFront(null);
    setFinalBack(null);
    setAdditionalPages([]);
    setActiveWatermark('');
    setCurrentSide('front');
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col overflow-hidden font-sans ${
        isDarkMode ? 'bg-[#121212] text-stone-100' : 'bg-[#F7F5F0] text-stone-900'
      }`}
    >
      {/* Branded Splash Screen */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* Biometric / Face ID / PIN Lock Screen */}
      {!showSplash && isAppLocked && (
        <LockScreen onUnlock={() => setIsAppLocked(false)} isDarkMode={isDarkMode} />
      )}

      {/* Onboarding & Guide Modal */}
      <OnboardingModal
        isOpen={!showSplash && !isAppLocked && showOnboarding}
        onClose={handleCloseOnboarding}
        isDarkMode={isDarkMode}
      />

      {/* Settings Navigation Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenTutorial={() => setShowOnboarding(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
        {step === 'home' && (
          <HomeScreen
            documents={documents}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onStartCamera={handleStartCamera}
            onSelectGallery={handleSelectGallery}
            onSelectDocument={handleSelectDocument}
            onDeleteDocument={handleDeleteDocument}
            onRenameDocument={handleRenameDocument}
            isDarkMode={isDarkMode}
          />
        )}

        {step === 'scanner' && (
          <SmartScanner
            currentSide={currentSide}
            isTwoSided={isTwoSided}
            docType={docType}
            frontThumbnail={finalFront || warpedFront || undefined}
            onCapture={handleCapture}
            onChangeDocType={handleChangeDocTypeInCamera}
            onOpenHelp={() => setShowOnboarding(true)}
            onToggleTwoSided={() => setIsTwoSided(!isTwoSided)}
            onBack={() => setStep('home')}
          />
        )}

        {step === 'corner-edit' && (
          <CornerEditor
            imageSrc={(editingSide === 'front' ? capturedFrontRaw : capturedBackRaw) || ''}
            sideTitle={isTwoSided ? (editingSide === 'front' ? 'Frente' : 'Reverso') : 'Documento'}
            docType={docType}
            initialCorners={(editingSide === 'front' ? frontCorners : backCorners) || undefined}
            onConfirm={handleCornersConfirmed}
            onRetake={handleRetakeCurrent}
            isDarkMode={isDarkMode}
          />
        )}

        {step === 'filter-edit' && (
          <FilterStudio
            sideTitle={isTwoSided ? (editingSide === 'front' ? 'Frente' : 'Reverso') : 'Documento'}
            warpedImage={(editingSide === 'front' ? warpedFront : warpedBack) || ''}
            onApply={handleFilterConfirmed}
            onBack={() => setStep('corner-edit')}
            isDarkMode={isDarkMode}
          />
        )}

        {step === 'sheet-preview' && (
          <SheetPreview
            frontImage={finalFront || undefined}
            backImage={finalBack || undefined}
            pages={additionalPages}
            initialPaperSize={defaultPaper}
            docType={docType}
            onChangePaperSize={(p) => setDefaultPaper(p)}
            onOpenExport={(watermark, sigImg, sigScale, sigPos, sigLabel) => {
              setActiveWatermark(watermark || '');
              setActiveSigConfig({
                image: sigImg,
                scale: sigScale,
                position: sigPos,
                label: sigLabel,
              });
              setIsExportOpen(true);
            }}
            onAddAnotherPage={handleAddAnotherPage}
            onDeletePage={handleDeletePage}
            onRetake={() => {
              handleStartFresh();
              setStep('scanner');
            }}
            onGoHome={() => setStep('home')}
            isDarkMode={isDarkMode}
          />
        )}
      </div>

      <AdBanner />

      {finalFront && (
        <ExportModal
          isOpen={isExportOpen}
          options={{
            paperSize: defaultPaper,
            docType,
            orientation: 'portrait',
            layout: finalBack ? 'vertical-stacked' : 'single-front',
            scalePercent: 100,
            frontImage: finalFront,
            backImage: finalBack || undefined,
            watermarkText: activeWatermark,
            signatureImage: activeSigConfig.image,
            signatureScale: activeSigConfig.scale,
            signaturePosition: activeSigConfig.position,
            signatureLabel: activeSigConfig.label,
            pages: additionalPages,
            documentTitle:
              currentDocTitle ||
              (docType === 'ine'
                ? 'INE_Escaneada'
                : docType === 'pasaporte'
                ? 'Pasaporte_Escaneado'
                : 'Documento_Escaneado'),
          }}
          onClose={() => setIsExportOpen(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default App;
