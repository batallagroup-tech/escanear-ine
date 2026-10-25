import React, { useState, useRef } from 'react';
import {
  Menu,
  Plus,
  Camera,
  Image as ImageIcon,
  FileText,
  Trash2,
  Calendar,
  ChevronRight,
  Printer,
  ArrowLeft,
  CreditCard,
  BookOpen,
  FileSpreadsheet,
  Search,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { SavedDocument, PaperSize, DocumentType } from '../types';
import { PAPER_SPECS, DOCUMENT_SPECS } from '../types';

interface HomeScreenProps {
  documents: SavedDocument[];
  onOpenSettings: () => void;
  onStartCamera: (paper: PaperSize, docType: DocumentType) => void;
  onSelectGallery: (file: File, paper: PaperSize, docType: DocumentType) => void;
  onSelectDocument: (doc: SavedDocument) => void;
  onDeleteDocument: (id: string) => void;
  onRenameDocument?: (id: string, newTitle: string) => void;
  isDarkMode?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  documents,
  onOpenSettings,
  onStartCamera,
  onSelectGallery,
  onSelectDocument,
  onDeleteDocument,
  onRenameDocument,
  isDarkMode = false,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalStep, setModalStep] = useState<'format' | 'capture'>('format');
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('ine');
  const [selectedFormat, setSelectedFormat] = useState<PaperSize>('carta');
  const [searchTerm, setSearchTerm] = useState('');
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [newTitleInput, setNewTitleInput] = useState('');

  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleOpenAddModal = () => {
    setModalStep('format');
    setShowAddModal(true);
  };

  const handleFormatSelected = (format: PaperSize) => {
    setSelectedFormat(format);
    setModalStep('capture');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setShowAddModal(false);
      onSelectGallery(file, selectedFormat, selectedDocType);
    }
  };

  const handleStartRename = (e: React.MouseEvent, doc: SavedDocument) => {
    e.stopPropagation();
    setRenamingDocId(doc.id);
    setNewTitleInput(doc.title);
  };

  const handleSaveRename = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (newTitleInput.trim().length > 0 && onRenameDocument) {
      onRenameDocument(docId, newTitleInput.trim());
    }
    setRenamingDocId(null);
  };

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className={`flex-1 w-full h-full flex flex-col overflow-hidden relative transition-colors ${
        isDarkMode ? 'bg-[#121212] text-stone-100' : 'bg-[#F7F5F0] text-stone-900'
      }`}
    >
      {/* Hidden file input for gallery upload */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top App Bar in Navy Blue with safe-area spacing */}
      <header
        className="w-full bg-[#0F2C59] text-white px-4 pb-3.5 flex items-center justify-between z-20 shadow-md"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white transition-all"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">
              Escanear INE
            </h1>
            <span className="text-xs text-stone-200 font-medium block">
              Credenciales y Documentos
            </span>
          </div>
        </div>
      </header>

      {/* Search Bar if documents exist */}
      {documents.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="relative max-w-xl mx-auto w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border shadow-sm focus:outline-none focus:border-[#0F2C59] ${
                isDarkMode
                  ? 'bg-[#1e1e21] border-stone-800 text-stone-100 placeholder:text-stone-500'
                  : 'bg-white border-stone-200 text-stone-900 placeholder:text-stone-400'
              }`}
            />
          </div>
        </div>
      )}

      {/* Main Content Area: Document List or Empty State */}
      <main className="flex-1 overflow-y-auto p-4 pb-52">
        <div className="max-w-xl mx-auto w-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2
              className={`text-xs font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-stone-400' : 'text-stone-600'
              }`}
            >
              Mis Documentos Guardados
            </h2>
            <span className="text-xs text-stone-500 font-semibold">
              {filteredDocs.length} {filteredDocs.length === 1 ? 'archivo' : 'archivos'}
            </span>
          </div>

          {filteredDocs.length === 0 ? (
            /* Empty State */
            <div
              className={`flex flex-col items-center justify-center text-center py-12 px-6 rounded-2xl border shadow-sm mt-2 ${
                isDarkMode
                  ? 'bg-[#1e1e22] border-stone-800 text-stone-100'
                  : 'bg-white border-stone-200 text-stone-900'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                  isDarkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-[#0F2C59]/10 text-[#0F2C59]'
                }`}
              >
                <FileText size={34} strokeWidth={1.8} />
              </div>
              <h3
                className={`text-base font-bold mb-1.5 ${
                  isDarkMode ? 'text-stone-100' : 'text-stone-900'
                }`}
              >
                {searchTerm ? 'No se encontraron documentos' : 'No tienes documentos guardados'}
              </h3>
              <p
                className={`text-xs max-w-xs leading-relaxed mb-6 ${
                  isDarkMode ? 'text-stone-400' : 'text-stone-600'
                }`}
              >
                {searchTerm
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Escanea tu credencial INE, pasaporte, CURP, acta de nacimiento o comprobantes listos para imprimir en hoja Carta u Oficio.'}
              </p>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#0F2C59] hover:bg-[#163d7a] text-white font-bold text-xs uppercase tracking-wide shadow-md active:scale-95 transition-all border border-blue-400/20"
              >
                <Plus size={18} />
                Nuevo Escaneo
              </button>
            </div>
          ) : (
            /* Documents Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className={`border rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer shadow-sm ${
                    isDarkMode
                      ? 'bg-[#1e1e21] hover:bg-[#25252a] border-stone-800'
                      : 'bg-white hover:bg-stone-50 border-stone-200'
                  }`}
                >
                  {/* Thumbnails */}
                  <div
                    className={`relative w-full h-32 rounded-xl border overflow-hidden flex items-center justify-center gap-2 p-2 mb-3 ${
                      isDarkMode ? 'bg-[#151518] border-stone-800' : 'bg-stone-100 border-stone-200'
                    }`}
                  >
                    <img
                      src={doc.frontImage}
                      alt="Frente"
                      className="h-full max-w-[48%] object-contain rounded shadow-sm bg-white"
                    />
                    {doc.backImage ? (
                      <img
                        src={doc.backImage}
                        alt="Reverso"
                        className="h-full max-w-[48%] object-contain rounded shadow-sm bg-white"
                      />
                    ) : (
                      <div className="h-full max-w-[48%] px-3 border border-dashed border-stone-400/40 rounded flex items-center justify-center text-[11px] text-stone-400 font-medium">
                        1 Página
                      </div>
                    )}
                  </div>

                  {/* Title & Metadata with inline Rename */}
                  <div className="mb-2">
                    {renamingDocId === doc.id ? (
                      <div
                        className="flex items-center gap-1.5 mb-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={newTitleInput}
                          onChange={(e) => setNewTitleInput(e.target.value)}
                          className={`flex-1 px-2 py-1 text-xs border border-[#0F2C59] rounded-lg focus:outline-none ${
                            isDarkMode ? 'bg-[#2a2a2f] text-white' : 'bg-stone-50 text-stone-900'
                          }`}
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleSaveRename(e, doc.id)}
                          className="p-1 rounded bg-[#0F2C59] text-white hover:bg-[#0A1F3D]"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingDocId(null);
                          }}
                          className="p-1 rounded bg-stone-300 text-stone-700 hover:bg-stone-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-sm font-bold truncate ${
                            isDarkMode ? 'text-stone-100' : 'text-stone-900'
                          }`}
                        >
                          {doc.title}
                        </h4>
                        <button
                          onClick={(e) => handleStartRename(e, doc)}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                          title="Renombrar documento"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-stone-400" />
                        {new Date(doc.createdAt).toLocaleDateString('es-MX')}
                      </span>
                      <span
                        className={`flex items-center gap-1 uppercase font-bold ${
                          isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'
                        }`}
                      >
                        <Printer size={12} />
                        {doc.paperSize}
                      </span>
                      {doc.pages && doc.pages.length > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isDarkMode ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {1 + doc.pages.length} Págs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div
                    className={`pt-2 border-t flex items-center justify-between text-xs ${
                      isDarkMode ? 'border-stone-800' : 'border-stone-100'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold flex items-center gap-1 ${
                        isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'
                      }`}
                    >
                      Ver e Imprimir <ChevronRight size={14} />
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDocument(doc.id);
                      }}
                      className={`p-1.5 rounded-lg text-stone-400 hover:text-red-500 transition-colors ${
                        isDarkMode ? 'hover:bg-red-950/40' : 'hover:bg-red-50'
                      }`}
                      title="Eliminar documento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button (+) in Navy Blue lifted well above the banner */}
      <div
        className="fixed right-5 z-30"
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 84px)' }}
      >
        <button
          onClick={handleOpenAddModal}
          className="w-14 h-14 rounded-2xl bg-[#0F2C59] hover:bg-[#163d7a] text-white flex items-center justify-center shadow-lg active:scale-95 transition-all border border-blue-400/25"
          aria-label="Nuevo Escaneo"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>

      {/* Add New Scan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setShowAddModal(false)}
          />

          <div
            className={`relative w-full sm:max-w-md border-t sm:border rounded-t-3xl sm:rounded-3xl p-5 z-10 shadow-2xl max-h-[90vh] overflow-y-auto ${
              isDarkMode
                ? 'bg-[#1a1a1e] border-stone-800 text-stone-100'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
            style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 20px) + 78px)' }}
          >
            <div
              className={`w-12 h-1.5 rounded-full mx-auto mb-4 sm:hidden ${
                isDarkMode ? 'bg-stone-700' : 'bg-stone-300'
              }`}
            />

            {modalStep === 'format' ? (
              /* Step 1: Select Document Type & Paper Format */
              <div>
                <div className="mb-4">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                      isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'
                    }`}
                  >
                    1. ¿Qué vas a escanear?
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          id: 'ine',
                          label: 'INE / ID',
                          sub: 'Credencial',
                          icon: CreditCard,
                        },
                        {
                          id: 'pasaporte',
                          label: 'Pasaporte',
                          sub: 'Libreta',
                          icon: BookOpen,
                        },
                        {
                          id: 'documento',
                          label: 'Documento',
                          sub: 'CURP / Acta',
                          icon: FileSpreadsheet,
                        },
                      ] as const
                    ).map((dtype) => {
                      const IconComp = dtype.icon;
                      const isSelected = selectedDocType === dtype.id;
                      return (
                        <button
                          key={dtype.id}
                          onClick={() => setSelectedDocType(dtype.id)}
                          className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-[#0F2C59] border-blue-400 text-white shadow-sm'
                              : isDarkMode
                              ? 'bg-[#25252b] border-stone-700 text-stone-200 hover:bg-[#2e2e36]'
                              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <IconComp size={20} />
                          <span className="text-xs font-bold leading-tight">{dtype.label}</span>
                          <span
                            className={`text-[10px] leading-tight ${
                              isSelected
                                ? 'text-stone-200'
                                : isDarkMode
                                ? 'text-stone-400'
                                : 'text-stone-500'
                            }`}
                          >
                            {dtype.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                      isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'
                    }`}
                  >
                    2. ¿En qué formato de hoja lo quieres?
                  </span>
                  <div className="space-y-2">
                    {(
                      [
                        {
                          id: 'carta',
                          title: 'Hoja Tamaño Carta',
                          desc: '21.6 × 27.9 cm • Estándar en papelerías de México',
                          badge: 'Más usado',
                        },
                        {
                          id: 'oficio',
                          title: 'Hoja Tamaño Oficio',
                          desc: '21.6 × 34.0 cm • Actas, contratos y trámites legales',
                          badge: '',
                        },
                        {
                          id: 'a4',
                          title: 'Hoja Tamaño A4',
                          desc: '21.0 × 29.7 cm • Formato internacional',
                          badge: '',
                        },
                        {
                          id: 'individual',
                          title: 'Solo el Recorte (Sin Hoja)',
                          desc: 'Imagen recortada lista para enviar por WhatsApp',
                          badge: '',
                        },
                      ] as const
                    ).map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => handleFormatSelected(fmt.id)}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all active:scale-[0.99] ${
                          isDarkMode
                            ? 'bg-[#25252b] hover:bg-[#2e2e36] border-stone-700'
                            : 'bg-stone-50 hover:bg-stone-100 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isDarkMode
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-[#0F2C59]/10 text-[#0F2C59]'
                            }`}
                          >
                            <Printer size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-bold ${
                                  isDarkMode ? 'text-stone-100' : 'text-stone-900'
                                }`}
                              >
                                {fmt.title}
                              </span>
                              {fmt.badge && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    isDarkMode
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-[#0F2C59]/15 text-[#0F2C59]'
                                  }`}
                                >
                                  {fmt.badge}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs leading-tight block ${
                                isDarkMode ? 'text-stone-400' : 'text-stone-500'
                              }`}
                            >
                              {fmt.desc}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-stone-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowAddModal(false)}
                  className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                    isDarkMode
                      ? 'bg-[#25252b] hover:bg-[#2e2e36] text-stone-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              /* Step 2: Choose Camera or Gallery */
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <button
                    onClick={() => setModalStep('format')}
                    className={`p-2 rounded-xl transition-colors ${
                      isDarkMode
                        ? 'bg-[#25252b] hover:bg-[#2e2e36] text-stone-200'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                    title="Regresar"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider block ${
                        isDarkMode ? 'text-blue-400' : 'text-[#0F2C59]'
                      }`}
                    >
                      {DOCUMENT_SPECS[selectedDocType].shortName} • {PAPER_SPECS[selectedFormat].name}
                    </span>
                    <h3
                      className={`text-base font-bold ${
                        isDarkMode ? 'text-stone-100' : 'text-stone-900'
                      }`}
                    >
                      ¿Cómo deseas capturar el documento?
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Option 1: Live Camera */}
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      onStartCamera(selectedFormat, selectedDocType);
                    }}
                    className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[#0F2C59] hover:bg-[#163d7a] text-white text-center transition-all active:scale-95 shadow-md border border-blue-400/25"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-2.5">
                      <Camera size={26} />
                    </div>
                    <span className="text-sm font-bold mb-0.5">Tomar Foto</span>
                    <span className="text-[11px] text-stone-200">Usar la cámara</span>
                  </button>

                  {/* Option 2: Gallery Picker */}
                  <button
                    onClick={() => {
                      galleryInputRef.current?.click();
                    }}
                    className={`flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all active:scale-95 ${
                      isDarkMode
                        ? 'bg-[#25252b] hover:bg-[#2e2e36] border-stone-700 text-stone-100'
                        : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-900'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 ${
                        isDarkMode
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-[#0F2C59]/10 text-[#0F2C59]'
                      }`}
                    >
                      <ImageIcon size={26} />
                    </div>
                    <span className="text-sm font-bold mb-0.5">Elegir Galería</span>
                    <span
                      className={`text-[11px] ${
                        isDarkMode ? 'text-stone-400' : 'text-stone-600'
                      }`}
                    >
                      Subir del teléfono
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => setModalStep('format')}
                  className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                    isDarkMode
                      ? 'bg-[#25252b] hover:bg-[#2e2e36] text-stone-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  ← Cambiar Tipo o Formato
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeScreen;
