import React, { useState } from 'react';
import {
  FileText,
  FileCode2,
  Image as ImageIcon,
  Share2,
  X,
  CheckCircle,
  Loader2,
  Send,
} from 'lucide-react';
import type { MultiPagePdfOptions } from '../services/pdfGenerator';
import { renderFullSheetCanvas } from '../services/sheetRenderer';
import { generateDocumentPdf } from '../services/pdfGenerator';
import { generateDocumentDocx } from '../services/wordGenerator';
import { showInterstitial } from '../services/admobService';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

interface ExportModalProps {
  isOpen: boolean;
  options: MultiPagePdfOptions;
  onClose: () => void;
  isDarkMode?: boolean;
}

type ExportType = 'pdf' | 'docx' | 'image';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  options,
  onClose,
  isDarkMode = false,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportType>('pdf');
  const [compressForWeb, setCompressForWeb] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async (isWhatsAppOnly = false) => {
    setIsExporting(true);

    try {
      await showInterstitial();

      const rawTitle =
        options.documentTitle ||
        (options.docType === 'ine'
          ? 'INE'
          : options.docType === 'pasaporte'
          ? 'Pasaporte'
          : 'Documento');

      // Sanitize title for valid file system and sharing naming
      const safeTitle = rawTitle
        .replace(/[/\\?%*:|"<>•]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim();

      const fileNameBase = safeTitle || `Documento_${new Date().toISOString().slice(0, 10)}`;

      if (selectedFormat === 'pdf') {
        const pdfBlob = await generateDocumentPdf({
          ...options,
          compressForWeb,
        });
        await shareOrDownloadBlob(pdfBlob, `${fileNameBase}.pdf`, 'application/pdf', isWhatsAppOnly);
      } else if (selectedFormat === 'docx') {
        const docxBlob = await generateDocumentDocx(options);
        await shareOrDownloadBlob(
          docxBlob,
          `${fileNameBase}.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          isWhatsAppOnly
        );
      } else if (selectedFormat === 'image') {
        const canvas = await renderFullSheetCanvas({ ...options, dpi: 300 });
        const imgBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
        await shareOrDownloadBlob(imgBlob, `${fileNameBase}.png`, 'image/png', isWhatsAppOnly);
      }
    } catch (err) {
      console.warn('Export / share error:', err);
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const shareOrDownloadBlob = async (
    blob: Blob,
    filename: string,
    _mimeType: string,
    isWhatsApp: boolean
  ) => {
    if (Capacitor.isNativePlatform()) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });
      const base64Data = await base64Promise;

      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      const displayDocName = options.documentTitle || 'Documento';

      await Share.share({
        title: displayDocName,
        text: isWhatsApp
          ? `Te envío ${displayDocName} escaneado listo para imprimir.`
          : 'Documento oficial escaneado',
        url: saved.uri,
        dialogTitle: isWhatsApp ? 'Enviar por WhatsApp' : 'Compartir documento',
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 select-none">
      <div
        className={`relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col border ${
          isDarkMode
            ? 'border-stone-800 bg-[#18181b] text-stone-100'
            : 'border-stone-200 bg-white text-stone-900'
        }`}
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 24px) + 78px)' }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDarkMode ? 'border-stone-800' : 'border-stone-200'
          }`}
        >
          <div>
            <h3 className={`text-base font-bold ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
              Guardar o Compartir
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
              {options.pages && options.pages.length > 0
                ? `${1 + options.pages.length} páginas listas para exportar`
                : 'Elige el formato de tu archivo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl ${
              isDarkMode
                ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Options Selection */}
        <div className="flex flex-col gap-2.5 my-4">
          <button
            onClick={() => setSelectedFormat('pdf')}
            className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
              selectedFormat === 'pdf'
                ? isDarkMode
                  ? 'bg-[#0F2C59]/40 border-[#2563EB]'
                  : 'bg-[#0F2C59]/10 border-[#0F2C59]'
                : isDarkMode
                ? 'bg-[#242429] border-stone-800 hover:bg-stone-800'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div
                  className={`text-sm font-bold flex items-center gap-2 ${
                    isDarkMode ? 'text-stone-100' : 'text-stone-900'
                  }`}
                >
                  <span>Archivo PDF</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0F2C59] text-white">
                    Recomendado
                  </span>
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                  Listo para imprimir en cualquier papelería
                </div>
              </div>
            </div>
            {selectedFormat === 'pdf' && (
              <CheckCircle className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`} />
            )}
          </button>

          {/* PDF compression option for government portals */}
          {selectedFormat === 'pdf' && (
            <label
              className={`flex items-center justify-between p-2.5 px-3 rounded-xl border cursor-pointer ${
                isDarkMode
                  ? 'bg-amber-950/30 border-amber-800/60'
                  : 'bg-amber-50/70 border-amber-200/80'
              }`}
            >
              <div className="flex flex-col pr-2">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
                  Comprimir a menos de 1 MB
                </span>
                <span className={`text-[10px] ${isDarkMode ? 'text-stone-400' : 'text-stone-600'}`}>
                  Para portales de gobierno (SAT, Infonavit, IMSS, becas)
                </span>
              </div>
              <input
                type="checkbox"
                checked={compressForWeb}
                onChange={(e) => setCompressForWeb(e.target.checked)}
                className="w-4 h-4 rounded text-[#0F2C59] accent-[#2563EB] cursor-pointer"
              />
            </label>
          )}

          <button
            onClick={() => setSelectedFormat('docx')}
            className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
              selectedFormat === 'docx'
                ? isDarkMode
                  ? 'bg-[#0F2C59]/40 border-[#2563EB]'
                  : 'bg-[#0F2C59]/10 border-[#0F2C59]'
                : isDarkMode
                ? 'bg-[#242429] border-stone-800 hover:bg-stone-800'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <FileCode2 className="w-5 h-5" />
              </div>
              <div>
                <div className={`text-sm font-bold ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
                  Archivo Word (.docx)
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                  Editable para computadora o celular
                </div>
              </div>
            </div>
            {selectedFormat === 'docx' && (
              <CheckCircle className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`} />
            )}
          </button>

          <button
            onClick={() => setSelectedFormat('image')}
            className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
              selectedFormat === 'image'
                ? isDarkMode
                  ? 'bg-[#0F2C59]/40 border-[#2563EB]'
                  : 'bg-[#0F2C59]/10 border-[#0F2C59]'
                : isDarkMode
                ? 'bg-[#242429] border-stone-800 hover:bg-stone-800'
                : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDarkMode ? 'bg-stone-800 text-stone-200' : 'bg-stone-200 text-stone-700'
                }`}
              >
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <div className={`text-sm font-bold ${isDarkMode ? 'text-stone-100' : 'text-stone-900'}`}>
                  Imagen (PNG)
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                  Para fotos y envíos rápidos
                </div>
              </div>
            </div>
            {selectedFormat === 'image' && (
              <CheckCircle className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'}`} />
            )}
          </button>
        </div>

        {/* Action Buttons: WhatsApp direct + General Share */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => handleExport(true)}
            disabled={isExporting}
            className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            <span>Enviar por WhatsApp</span>
          </button>

          <button
            onClick={() => handleExport(false)}
            disabled={isExporting}
            className="w-full py-3.5 px-6 rounded-xl bg-[#0F2C59] hover:bg-[#0A1F3D] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition disabled:opacity-60"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Preparando archivo...</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                <span>Guardar o Compartir {selectedFormat.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
