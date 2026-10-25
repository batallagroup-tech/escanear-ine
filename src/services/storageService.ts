import type { SavedDocument } from '../types';

const DB_NAME = 'EscanearINEDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads all saved documents from IndexedDB, falling back to localStorage
 */
export async function loadSavedDocuments(): Promise<SavedDocument[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result as SavedDocument[];
        if (results && results.length > 0) {
          // Sort by creation date descending
          resolve(results.sort((a, b) => b.createdAt - a.createdAt));
        } else {
          // Fallback to check if legacy localStorage has data
          try {
            const legacy = localStorage.getItem('escanear_ine_docs_v1');
            const parsed = legacy ? JSON.parse(legacy) : [];
            // Migrate legacy to IndexedDB
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsed.forEach((doc) => saveDocumentToDB(doc).catch(() => {}));
            }
            resolve(parsed);
          } catch {
            resolve([]);
          }
        }
      };

      req.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IndexedDB error, using fallback:', err);
    try {
      const stored = localStorage.getItem('escanear_ine_docs_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Saves or updates a document in persistent IndexedDB storage
 */
export async function saveDocumentToDB(doc: SavedDocument): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(doc);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not save to IndexedDB, fallback to localStorage', err);
    try {
      const legacy = localStorage.getItem('escanear_ine_docs_v1');
      const list = legacy ? JSON.parse(legacy) : [];
      const updated = [doc, ...list.filter((d: SavedDocument) => d.id !== doc.id)];
      localStorage.setItem('escanear_ine_docs_v1', JSON.stringify(updated.slice(0, 5)));
    } catch (e) {
      console.warn('Storage failed:', e);
    }
  }
}

/**
 * Deletes a document from persistent storage
 */
export async function deleteDocumentFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Delete error from IndexedDB:', err);
    try {
      const legacy = localStorage.getItem('escanear_ine_docs_v1');
      if (legacy) {
        const list = JSON.parse(legacy);
        const updated = list.filter((d: SavedDocument) => d.id !== id);
        localStorage.setItem('escanear_ine_docs_v1', JSON.stringify(updated));
      }
    } catch {}
  }
}
