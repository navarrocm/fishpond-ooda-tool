// ============================================================
// DATABASE LAYER - IndexedDB v7 (Sampling Events)
// ============================================================

import { generateId } from './utils.js';

const DB_NAME = 'FishpondOODA';
const DB_VERSION = 7;

let db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    if (db && db.name === DB_NAME) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // --- Ponds Store ---
      if (!db.objectStoreNames.contains('ponds')) {
        const store = db.createObjectStore('ponds', { keyPath: 'id' });
        store.createIndex('name', 'name');
        store.createIndex('operationType', 'operationType');
        store.createIndex('harvested', 'harvested');
      }

      // --- Daily Logs Store ---
      if (!db.objectStoreNames.contains('dailyLogs')) {
        const store = db.createObjectStore('dailyLogs', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('date', 'date');
        store.createIndex('pondId_date', ['pondId', 'date']);
        store.createIndex('doc', 'doc');
      }

      // --- Sampling Events Store (NEW) ---
      if (!db.objectStoreNames.contains('samplingEvents')) {
        const store = db.createObjectStore('samplingEvents', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('speciesId', 'speciesId');
        store.createIndex('date', 'date');
        store.createIndex('doc', 'doc');
        store.createIndex('pondId_speciesId', ['pondId', 'speciesId']);
      }

      // --- Harvests Store ---
      if (!db.objectStoreNames.contains('harvests')) {
        const store = db.createObjectStore('harvests', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('speciesId', 'speciesId');
        store.createIndex('date', 'date');
        store.createIndex('pondId_speciesId', ['pondId', 'speciesId']);
      }

      // --- Tide Logs Store ---
      if (!db.objectStoreNames.contains('tideLogs')) {
        const store = db.createObjectStore('tideLogs', { keyPath: 'id' });
        store.createIndex('date', 'date');
      }

      // --- Prep Logs Store ---
      if (!db.objectStoreNames.contains('prepLogs')) {
        const store = db.createObjectStore('prepLogs', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('date', 'date');
        store.createIndex('task', 'task');
        store.createIndex('pondId_task', ['pondId', 'task']);
      }

      // --- Audit Trail Store ---
      if (!db.objectStoreNames.contains('auditTrail')) {
        const store = db.createObjectStore('auditTrail', { keyPath: 'id' });
        store.createIndex('store', 'store');
        store.createIndex('recordId', 'recordId');
        store.createIndex('timestamp', 'timestamp');
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB error: ${event.target.error}`));
    };
  });
}

// ---- Generic CRUD ----
export async function add(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!data.id) data.id = generateId();
    if (!data.createdAt) data.createdAt = new Date().toISOString();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function update(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

export async function remove(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ---- Export All Data ----
export async function exportAllData() {
  const ponds = await getAll('ponds');
  const logs = await getAll('dailyLogs');
  const sampling = await getAll('samplingEvents');
  const harvests = await getAll('harvests');
  const tides = await getAll('tideLogs');
  const prepLogs = await getAll('prepLogs');
  return {
    version: '6.0',
    exportDate: new Date().toISOString(),
    ponds,
    logs,
    sampling,
    harvests,
    tides,
    prepLogs
  };
}

// ---- Import All Data ----
export async function importAllData(data) {
  await clearStore('ponds');
  await clearStore('dailyLogs');
  await clearStore('samplingEvents');
  await clearStore('harvests');
  await clearStore('tideLogs');
  await clearStore('prepLogs');
  for (const pond of data.ponds || []) await add('ponds', pond);
  for (const log of data.logs || []) await add('dailyLogs', log);
  for (const sample of data.sampling || []) await add('samplingEvents', sample);
  for (const harvest of data.harvests || []) await add('harvests', harvest);
  for (const tide of data.tides || []) await add('tideLogs', tide);
  for (const prep of data.prepLogs || []) await add('prepLogs', prep);
}

// ---- Get Latest Sampling Event ----
export async function getLatestSampling(pondId, speciesId) {
  const all = await getByIndex('samplingEvents', 'pondId_speciesId', [pondId, speciesId]);
  if (all.length === 0) return null;
  return all.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

// ---- Get All Sampling Events for Pond ----
export async function getSamplingHistory(pondId, speciesId) {
  const all = await getByIndex('samplingEvents', 'pondId_speciesId', [pondId, speciesId]);
  return all.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ---- Calculate Biomass from Latest Sampling ----
export async function getCurrentBiomass(pondId, speciesId) {
  const latest = await getLatestSampling(pondId, speciesId);
  if (!latest) return null;
  return {
    biomass: latest.biomass || 0,
    avgWeight: latest.avgWeight || 0,
    estimatedSurvival: latest.estimatedSurvival || 0,
    sampleDate: latest.date,
    doc: latest.doc
  };
}

console.log('✅ db.js loaded with sampling support');
