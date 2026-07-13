// ============================================================
// DATABASE LAYER - IndexedDB
// ============================================================

import { generateId } from './utils.js';

const DB_NAME = 'FishpondOODA';
const DB_VERSION = 2;

let db = null;

// ---- Open/Initialize DB ----
export function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store: ponds
      if (!db.objectStoreNames.contains('ponds')) {
        const store = db.createObjectStore('ponds', { keyPath: 'id' });
        store.createIndex('name', 'name');
        store.createIndex('species', 'species');
        store.createIndex('harvested', 'harvested');
      }

      // Store: dailyLogs
      if (!db.objectStoreNames.contains('dailyLogs')) {
        const store = db.createObjectStore('dailyLogs', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('date', 'date');
        store.createIndex('pondId_date', ['pondId', 'date']);
      }

      // Store: harvests
      if (!db.objectStoreNames.contains('harvests')) {
        const store = db.createObjectStore('harvests', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('date', 'date');
        store.createIndex('pondId_date', ['pondId', 'date']);
      }

      // Store: tideLogs
      if (!db.objectStoreNames.contains('tideLogs')) {
        const store = db.createObjectStore('tideLogs', { keyPath: 'id' });
        store.createIndex('date', 'date');
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
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
  const harvests = await getAll('harvests');
  const tides = await getAll('tideLogs');
  return { version: '2.0', exportDate: new Date().toISOString(), ponds, logs, harvests, tides };
}

// ---- Import All Data ----
export async function importAllData(data) {
  await clearStore('ponds');
  await clearStore('dailyLogs');
  await clearStore('harvests');
  await clearStore('tideLogs');
  for (const pond of data.ponds || []) await add('ponds', pond);
  for (const log of data.logs || []) await add('dailyLogs', log);
  for (const harvest of data.harvests || []) await add('harvests', harvest);
  for (const tide of data.tides || []) await add('tideLogs', tide);
}