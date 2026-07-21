// ============================================================
// DATABASE LAYER - IndexedDB
// ============================================================

import { generateId } from './utils.js';

const DB_NAME = 'FishpondOODA';
const DB_VERSION = 3;

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

      // Store: auditTrail (for rollback)
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
  return { version: '3.0', exportDate: new Date().toISOString(), ponds, logs, harvests, tides };
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

// ---- SAMPLE DATA ----
export async function loadSampleData() {
  const ponds = await getAll('ponds');
  if (ponds.length > 0) return; // Only load if empty

  console.log('📚 Loading sample data...');

  const samplePond = {
    id: 'sample-1',
    name: 'Sample West Pond',
    species: 'Bangus',
    area: 0.5,
    location: 'Iloilo, Western Visayas',
    fingerlings: 5000,
    stockingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    stockingWeight: 5,
    harvested: false,
    createdAt: new Date().toISOString()
  };
  await add('ponds', samplePond);

  // Add 60 days of sample logs
  for (let i = 0; i < 60; i++) {
    const date = new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000);
    const day = i + 1;
    const temp = 27 + Math.random() * 3;
    const ph = 7.5 + Math.random() * 1;
    const salinity = 22 + Math.random() * 8;
    const doVal = 4.5 + Math.random() * 2;
    const ammonia = 0.2 + Math.random() * 0.4;
    const feedAmount = 3 + (day / 60) * 5 + Math.random() * 1;
    const mortality = Math.floor(Math.random() * 3);
    const weight = 5 + (day / 60) * 350 + Math.random() * 10;

    await add('dailyLogs', {
      pondId: samplePond.id,
      date: date.toISOString().split('T')[0],
      temp: Math.round(temp * 10) / 10,
      ph: Math.round(ph * 10) / 10,
      salinity: Math.round(salinity * 10) / 10,
      do: Math.round(doVal * 10) / 10,
      ammonia: Math.round(ammonia * 100) / 100,
      feedType: day < 30 ? 'Starter' : day < 60 ? 'Grower' : 'Finisher',
      feedAmount: Math.round(feedAmount * 10) / 10,
      feedCost: Math.round((feedAmount * 45 + Math.random() * 20) * 10) / 10,
      mortality: mortality,
      cause: mortality > 2 ? 'Unknown' : '',
      weather: ['Sunny', 'Rainy', 'Cloudy'][Math.floor(Math.random() * 3)],
      weight: Math.round(weight * 10) / 10,
      notes: day % 15 === 0 ? 'Sample fish looked healthy' : '',
      createdAt: new Date().toISOString()
    });
  }

  // Add sample harvest
  await add('harvests', {
    pondId: samplePond.id,
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    weight: 1050,
    price: 142,
    revenue: 149100,
    buyer: 'Sample Trader A',
    notes: 'Good quality, no issues',
    createdAt: new Date().toISOString()
  });

  // Mark pond as harvested (for sample)
  samplePond.harvested = true;
  await update('ponds', samplePond);

  console.log('✅ Sample data loaded!');
}
