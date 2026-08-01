// ============================================================
// DATABASE LAYER - IndexedDB v5 (Multi-Species)
// ============================================================

import { generateId } from './utils.js';
import { getSpecies, getSpeciesName } from './species.js';

const DB_NAME = 'FishpondOODA';
const DB_VERSION = 6;

let db = null;

// ---- Open/Initialize DB ----
export function openDB() {
  return new Promise((resolve, reject) => {
    if (db && db.name === DB_NAME) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // --- Ponds Store (Multi-Species Ready) ---
      if (!db.objectStoreNames.contains('ponds')) {
        const store = db.createObjectStore('ponds', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('harvested', 'harvested', { unique: false });
      }

      // --- Daily Logs Store (Multi-Species Ready) ---
      if (!db.objectStoreNames.contains('dailyLogs')) {
        const store = db.createObjectStore('dailyLogs', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('pondId_date', ['pondId', 'date'], { unique: false });
        store.createIndex('doc', 'doc', { unique: false });
      }

      // --- Harvests Store (Multi-Species Ready) ---
      if (!db.objectStoreNames.contains('harvests')) {
        const store = db.createObjectStore('harvests', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId', { unique: false });
        store.createIndex('speciesId', 'speciesId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('pondId_speciesId', ['pondId', 'speciesId'], { unique: false });
      }

      // --- Tide Logs Store ---
      if (!db.objectStoreNames.contains('tideLogs')) {
        const store = db.createObjectStore('tideLogs', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      // --- Prep Logs Store ---
      if (!db.objectStoreNames.contains('prepLogs')) {
        const store = db.createObjectStore('prepLogs', { keyPath: 'id' });
        store.createIndex('pondId', 'pondId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('task', 'task', { unique: false });
        store.createIndex('pondId_task', ['pondId', 'task'], { unique: false });
      }

      // --- Audit Trail Store ---
      if (!db.objectStoreNames.contains('auditTrail')) {
        const store = db.createObjectStore('auditTrail', { keyPath: 'id' });
        store.createIndex('store', 'store', { unique: false });
        store.createIndex('recordId', 'recordId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
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

// ---- Generic CRUD Operations ----
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

// ---- Get Species Log from Entry ----
export function getSpeciesLogFromEntry(log, speciesId) {
  if (!log || !log.speciesLogs) return null;
  return log.speciesLogs.find(s => s.speciesId === speciesId) || null;
}

// ---- Get Species Totals ----
export async function getSpeciesTotals(pondId, speciesId) {
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  const speciesHarvests = harvests.filter(h => h.speciesId === speciesId);

  let totalFeed = 0;
  let totalFeedCost = 0;
  let totalMortality = 0;
  let latestWeight = 0;
  let logCount = 0;
  let doc = 0;

  for (const log of logs) {
    const sp = getSpeciesLogFromEntry(log, speciesId);
    if (sp) {
      totalFeed += sp.feedAmount || 0;
      totalFeedCost += sp.feedCost || 0;
      totalMortality += sp.mortality || 0;
      if (sp.weight) latestWeight = sp.weight;
      if (sp.doc) doc = sp.doc;
      logCount++;
    }
  }

  let totalRevenue = 0;
  let totalHarvestWeight = 0;
  for (const harvest of speciesHarvests) {
    totalRevenue += harvest.revenue || 0;
    totalHarvestWeight += harvest.weight || 0;
  }

  // Get pond data for stocking info
  const pond = await getById('ponds', pondId);
  let originalStocked = 0;
  let stockingWeight = 0;
  let stockingDate = null;
  if (pond && pond.species) {
    const sp = pond.species.find(s => s.speciesId === speciesId);
    if (sp) {
      originalStocked = sp.fingerlings || 0;
      stockingWeight = sp.stockingWeight || 0;
      stockingDate = sp.stockingDate || null;
    }
  }

  const currentAlive = Math.max(0, originalStocked - totalMortality);
  const survival = originalStocked > 0 ? Math.round((currentAlive / originalStocked) * 100) : null;

  // Calculate FCR
  const totalWeightGainKg = currentAlive > 0 && latestWeight > stockingWeight ?
    (currentAlive * (latestWeight - stockingWeight)) / 1000 : 0;
  const fcr = totalWeightGainKg > 0 ? Math.round((totalFeed / totalWeightGainKg) * 100) / 100 : null;

  return {
    speciesId,
    speciesName: getSpeciesName(speciesId),
    originalStocked,
    currentAlive,
    totalFeed,
    totalFeedCost,
    totalMortality,
    totalRevenue,
    totalHarvestWeight,
    latestWeight,
    stockingWeight,
    survival,
    fcr,
    logCount,
    doc,
    stockingDate
  };
}

// ---- Get Pond Species List ----
export async function getPondSpecies(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond || !pond.species) return [];
  return pond.species.map(s => s.speciesId);
}

// ---- Get Pond Species Data ----
export async function getPondSpeciesData(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond || !pond.species) return [];
  const results = [];
  for (const sp of pond.species) {
    const totals = await getSpeciesTotals(pondId, sp.speciesId);
    results.push({
      ...sp,
      ...totals
    });
  }
  return results;
}

// ---- Sample Data (Multi-Species) ----
export async function loadSampleData() {
  const ponds = await getAll('ponds');
  if (ponds.length > 0) {
    console.log('⚠️ Sample data already exists. Skipping load.');
    return;
  }

  console.log('📚 Loading multi-species sample data...');

  const samplePond = {
    id: 'sample-1',
    name: 'Sample West Pond',
    location: 'Iloilo, Western Visayas',
    area: 0.5,
    species: [
      {
        speciesId: 'bangus',
        stockingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fingerlings: 3000,
        stockingWeight: 5
      },
      {
        speciesId: 'tilapiaSaltTolerant',
        stockingDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fingerlings: 2000,
        stockingWeight: 3
      },
      {
        speciesId: 'shrimp',
        stockingDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fingerlings: 5000,
        stockingWeight: 0.5
      }
    ],
    harvested: false,
    createdAt: new Date().toISOString()
  };
  await add('ponds', samplePond);

  // Sample Prep Logs
  const prepTasks = [
    { pondId: samplePond.id, task: 'Drying', status: 'Completed', startDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], endDate: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: 'Good sunny weather, pond dried completely.', createdAt: new Date().toISOString() },
    { pondId: samplePond.id, task: 'Liming', status: 'Completed', date: new Date(Date.now() - 67 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], amount: 1000, unit: 'kg/ha', soilPhBefore: 5.8, soilPhAfter: 6.8, notes: 'Applied agricultural lime.', createdAt: new Date().toISOString() },
    { pondId: samplePond.id, task: 'Tilling', status: 'Completed', date: new Date(Date.now() - 66 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], depth: 15, unit: 'cm', notes: 'Tilled to 15cm depth.', createdAt: new Date().toISOString() },
    { pondId: samplePond.id, task: 'Water Filling', status: 'Completed', startDate: new Date(Date.now() - 64 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], endDate: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], source: 'River', waterDepth: 1.2, unit: 'm', notes: 'Filled pond with river water.', createdAt: new Date().toISOString() },
    { pondId: samplePond.id, task: 'Fertilization', status: 'Completed', date: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], fertilizerType: 'Urea + Triple 16', amount: 40, unit: 'kg/ha', notes: 'Applied base fertilizer for plankton bloom.', createdAt: new Date().toISOString() },
    { pondId: samplePond.id, task: 'Plankton Bloom', status: 'Completed', date: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], color: 'Green', density: 'Moderate', notes: 'Plankton bloom established, good color.', createdAt: new Date().toISOString() },
    { pondId: samplePond.id, task: 'Stocking', status: 'Completed', date: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], fingerlings: 7000, notes: 'Stocked 3,000 Bangus, 2,000 Tilapia, 5,000 Shrimp.', createdAt: new Date().toISOString() }
  ];

  for (const prep of prepTasks) {
    await add('prepLogs', prep);
  }

  // Sample Daily Logs (60 days with multi-species)
  for (let i = 0; i < 60; i++) {
    const date = new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000);
    const day = i + 1;
    const temp = 27 + Math.random() * 3;
    const ph = 7.5 + Math.random() * 1;
    const salinity = 22 + Math.random() * 8;
    const doVal = 4.5 + Math.random() * 2;
    const ammonia = 0.2 + Math.random() * 0.4;
    const nitrate = 0.5 + Math.random() * 10;
    const nitrite = 0.02 + Math.random() * 0.08;

    const speciesLogs = [];
    // Bangus
    speciesLogs.push({
      speciesId: 'bangus',
      doc: day,
      weight: 5 + (day / 60) * 350 + Math.random() * 10,
      mortality: Math.floor(Math.random() * 2),
      feedType: day < 30 ? 'Starter' : 'Grower',
      feedAmount: 1.5 + (day / 60) * 3 + Math.random() * 0.5,
      feedCost: Math.round((1.5 + (day / 60) * 3) * 45),
      notes: ''
    });
    // Tilapia
    speciesLogs.push({
      speciesId: 'tilapiaSaltTolerant',
      doc: day - 10,
      weight: 3 + (day / 60) * 250 + Math.random() * 8,
      mortality: Math.floor(Math.random() * 1),
      feedType: day < 30 ? 'Starter' : 'Grower',
      feedAmount: 1 + (day / 60) * 2 + Math.random() * 0.3,
      feedCost: Math.round((1 + (day / 60) * 2) * 40),
      notes: ''
    });
    // Shrimp
    speciesLogs.push({
      speciesId: 'shrimp',
      doc: day - 20,
      weight: 0.5 + (day / 60) * 35 + Math.random() * 2,
      mortality: Math.floor(Math.random() * 3),
      feedType: 'Grower',
      feedAmount: 0.5 + (day / 60) * 1 + Math.random() * 0.2,
      feedCost: Math.round((0.5 + (day / 60) * 1) * 60),
      notes: ''
    });

    await add('dailyLogs', {
      pondId: samplePond.id,
      date: date.toISOString().split('T')[0],
      measurementTime: '08:00',
      temp: Math.round(temp * 10) / 10,
      ph: Math.round(ph * 10) / 10,
      salinity: Math.round(salinity * 10) / 10,
      do: Math.round(doVal * 10) / 10,
      ammonia: Math.round(ammonia * 100) / 100,
      nitrate: Math.round(nitrate * 100) / 100,
      nitrite: Math.round(nitrite * 100) / 100,
      weather: ['Sunny', 'Rainy', 'Cloudy'][Math.floor(Math.random() * 3)],
      speciesLogs: speciesLogs,
      notes: day % 15 === 0 ? 'All species looking healthy' : '',
      createdAt: new Date().toISOString()
    });
  }

  // Sample harvests
  await add('harvests', {
    pondId: samplePond.id,
    speciesId: 'bangus',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    weight: 850,
    price: 140,
    revenue: 119000,
    buyer: 'Trader A',
    notes: 'Good quality bangus',
    createdAt: new Date().toISOString()
  });

  await add('harvests', {
    pondId: samplePond.id,
    speciesId: 'tilapiaSaltTolerant',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    weight: 450,
    price: 120,
    revenue: 54000,
    buyer: 'Trader B',
    notes: 'Good size tilapia',
    createdAt: new Date().toISOString()
  });

  console.log('✅ Multi-species sample data loaded!');
}
