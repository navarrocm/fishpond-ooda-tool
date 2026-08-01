// ============================================================
// DATABASE LAYER - IndexedDB v5 (Multi-Species)
// ============================================================

import { generateId } from './utils.js';
import { SPECIES } from './species.js';

const DB_NAME = 'FishpondOODA';
const DB_VERSION = 6;

let db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // --- Ponds (updated for multi-species) ---
      if (!db.objectStoreNames.contains('ponds')) {
        const store = db.createObjectStore('ponds', { keyPath: 'id' });
        store.createIndex('name', 'name');
        store.createIndex('harvested', 'harvested');
      } else {
        // For existing DB, we'd need to migrate - but we're doing clean install
      }

      // --- Daily Logs (updated with speciesLogs) ---
      if (!db.objectStoreNames.contains('dailyLogs')) {
        const store = db.createObjectStore('dailyLogs', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('date', 'date');
        store.createIndex('pondId_date', ['pondId', 'date']);
      }

      // --- Harvests (updated with speciesId) ---
      if (!db.objectStoreNames.contains('harvests')) {
        const store = db.createObjectStore('harvests', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('speciesId', 'speciesId');
        store.createIndex('date', 'date');
        store.createIndex('pondId_speciesId', ['pondId', 'speciesId']);
      }

      // --- Tide Logs ---
      if (!db.objectStoreNames.contains('tideLogs')) {
        const store = db.createObjectStore('tideLogs', { keyPath: 'id' });
        store.createIndex('date', 'date');
      }

      // --- Prep Logs ---
      if (!db.objectStoreNames.contains('prepLogs')) {
        const store = db.createObjectStore('prepLogs', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId');
        store.createIndex('task', 'task');
        store.createIndex('pondId_task', ['pondId', 'task']);
      }

      // --- Audit Trail ---
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
  const prepLogs = await getAll('prepLogs');
  return {
    version: '5.0',
    exportDate: new Date().toISOString(),
    ponds,
    logs,
    harvests,
    tides,
    prepLogs
  };
}

// ---- Import All Data ----
export async function importAllData(data) {
  await clearStore('ponds');
  await clearStore('dailyLogs');
  await clearStore('harvests');
  await clearStore('tideLogs');
  await clearStore('prepLogs');
  for (const pond of data.ponds || []) await add('ponds', pond);
  for (const log of data.logs || []) await add('dailyLogs', log);
  for (const harvest of data.harvests || []) await add('harvests', harvest);
  for (const tide of data.tides || []) await add('tideLogs', tide);
  for (const prep of data.prepLogs || []) await add('prepLogs', prep);
}

// ---- Get Species Data from a Log ----
export function getSpeciesLogFromEntry(log, speciesId) {
  if (!log || !log.speciesLogs) return null;
  return log.speciesLogs.find(s => s.speciesId === speciesId) || null;
}

// ---- Calculate Species Totals ----
export async function getSpeciesTotals(pondId, speciesId) {
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);

  let totalFeed = 0;
  let totalFeedCost = 0;
  let totalMortality = 0;
  let totalWeightGain = 0;
  let totalRevenue = 0;
  let latestWeight = 0;
  let logCount = 0;

  for (const log of logs) {
    const sp = getSpeciesLogFromEntry(log, speciesId);
    if (sp) {
      totalFeed += sp.feedAmount || 0;
      totalFeedCost += sp.feedCost || 0;
      totalMortality += sp.mortality || 0;
      if (sp.weight) latestWeight = sp.weight;
      logCount++;
    }
  }

  for (const harvest of harvests) {
    if (harvest.speciesId === speciesId) {
      totalRevenue += harvest.revenue || 0;
    }
  }

  // Get pond data for stocking info
  const pond = await getById('ponds', pondId);
  let originalStocked = 0;
  let stockingWeight = 0;
  if (pond && pond.species) {
    const sp = pond.species.find(s => s.speciesId === speciesId);
    if (sp) {
      originalStocked = sp.fingerlings || 0;
      stockingWeight = sp.stockingWeight || 0;
    }
  }

  const currentAlive = Math.max(0, originalStocked - totalMortality);
  const survival = originalStocked > 0 ? Math.round((currentAlive / originalStocked) * 100) : null;

  // Calculate FCR
  const totalWeightGainKg = currentAlive > 0 && latestWeight > 0 ?
    (currentAlive * (latestWeight - stockingWeight)) / 1000 : 0;
  const fcr = totalWeightGainKg > 0 ? Math.round((totalFeed / totalWeightGainKg) * 100) / 100 : null;

  return {
    speciesId,
    originalStocked,
    currentAlive,
    totalFeed,
    totalFeedCost,
    totalMortality,
    totalRevenue,
    latestWeight,
    survival,
    fcr,
    logCount,
    stockingWeight
  };
}
