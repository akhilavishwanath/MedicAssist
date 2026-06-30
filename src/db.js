const DB_NAME = "MedicAssistDB";
const STORE_NAME = "records";
const DB_VERSION = 1;

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function saveRecord(bundle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        
        // Generate stable ID if missing
        const recordId = bundle.id || `rec-${Date.now()}`;
        bundle.id = recordId;

        const record = {
            id: recordId,
            timestamp: bundle.timestamp || new Date().toISOString(),
            bundle: bundle
        };
        
        const request = store.put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function listRecords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const records = request.result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            resolve(records);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getRecord(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result?.bundle || null);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function deleteRecord(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}
