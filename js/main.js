// ============================================================
// MAIN APP - Entry Point v5.0 (Multi-Species)
// ============================================================

import {
  openDB, add, getAll, getByIndex, update, remove, clearStore,
  exportAllData, importAllData, getSpeciesTotals, getSpeciesLogFromEntry,
  getById  // <-- ADDED THIS
} from './db.js';
import {
  getPondStatus, generateMultiSpeciesRecommendations,
  getPolycultureRecommendation, getPhase
} from './ooda.js';
import {
  getSpecies, getSpeciesList, getSpeciesName, getSpeciesIcon,
  getSpeciesColor, isSalinityCompatible, getPolycultureCompatibility
} from './species.js';
import {
  showTab, showMessage, renderPondList, showPondDetail,
  showAddPondModal, updateSelectors, renderAnalysis, renderHarvestList,
  renderDecide, renderHelp, exportToCSV, printReport
} from './ui.js';
import { renderPrep } from './prep.js';
import { escapeHtml, formatNumber, formatCurrency, validateNumber, validateInt } from './utils.js';

// ---- INIT ----
async function init() {
  await openDB();

  // --- REGISTER SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/fishpond-ooda-tool/sw.js', {
        scope: '/fishpond-ooda-tool/'
      });
      console.log('✅ Service Worker registered successfully:', registration.scope);
    } catch (error) {
      console.warn('⚠️ Service Worker registration failed:', error);
    }
  } else {
    console.log('ℹ️ Service Worker not supported in this browser');
  }

  // --- DATA PERSISTENCE ---
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent => {
      console.log('Persistent storage granted?', persistent);
    });
  }

  // --- WEEKLY EXPORT REMINDER ---
  const lastExport = localStorage.getItem('lastExportDate');
  const now = new Date();
  if (lastExport) {
    const daysSince = (now - new Date(lastExport)) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) {
      setTimeout(() => {
        showMessage('log-message',
          'It\'s been a week since your last data export. Back up your data in Settings!',
          'info'
        );
      }, 1000);
    }
  }

  // --- SET DEFAULT DATES ---
  const dateInput = document.getElementById('log-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  const harvestDate = document.getElementById('harvest-date');
  if (harvestDate) harvestDate.value = new Date().toISOString().split('T')[0];
  const tideDate = document.getElementById('tide-date');
  if (tideDate) tideDate.value = new Date().toISOString().split('T')[0];

  // --- RENDER INITIAL DATA ---
  await renderPondList();
  await updateSelectors();

  // --- SETUP EVENT LISTENERS ---
  setupEventListeners();

  // --- ONLINE STATUS ---
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  console.log('Fishpond OODA Tool v5.0 (Multi-Species) initialized!');
}

// ---- ONLINE STATUS ----
function updateOnlineStatus() {
  const el = document.getElementById('online-status');
  if (el) {
    const online = navigator.onLine;
    el.textContent = online ? 'Online' : 'Offline';
    el.className = online ? 'online' : 'offline';
  }
}

// ---- DELETE FUNCTIONS ----
window.deletePond = async function(pondId) {
  if (!confirm('Delete this pond and all its data? This cannot be undone.')) return;
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  const prepLogs = await getByIndex('prepLogs', 'pondId', pondId);
  for (const log of logs) await remove('dailyLogs', log.id);
  for (const harvest of harvests) await remove('harvests', harvest.id);
  for (const prep of prepLogs) await remove('prepLogs', prep.id);
  await remove('ponds', pondId);
  document.getElementById('pond-detail').style.display = 'none';
  await renderPondList();
  updateSelectors();
  showMessage('log-message', 'Pond deleted.', 'info');
};

window.deleteHarvest = async function(harvestId) {
  if (!confirm('Delete this harvest record?')) return;
  await remove('harvests', harvestId);
  const harvestPond = document.getElementById('harvest-pond');
  if (harvestPond) await renderHarvestList(harvestPond.value);
  await renderPondList();
  showMessage('harvest-message', 'Harvest record deleted.', 'info');
};

// ---- EVENT LISTENERS ----
function setupEventListeners() {
  // --- TAB NAVIGATION ---
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tab = btn.dataset.tab;
      showTab(tab);
      if (tab === 'dashboard') await renderPondList();
      if (tab === 'analysis') {
        const pondId = document.getElementById('analysis-pond')?.value;
        await renderAnalysis(pondId);
      }
      if (tab === 'decide') {
        await updateSelectors();
        const pondId = document.getElementById('decide-pond')?.value;
        await renderDecide(pondId);
      }
      if (tab === 'prep') {
        await updateSelectors();
        const pondId = document.getElementById('prep-pond')?.value;
        await renderPrep(pondId);
      }
      if (tab === 'log') {
        await updateSelectors();
        const pondId = document.getElementById('log-pond')?.value;
        if (pondId) {
          await populateSpeciesLogs(pondId);
        } else {
          document.getElementById('species-log-entries').innerHTML = '';
          document.getElementById('add-species-log-btn').style.display = 'none';
        }
      }
      if (tab === 'harvest') {
        await updateSelectors();
        const pondId = document.getElementById('harvest-pond')?.value;
        await populateHarvestSpecies(pondId);
        await renderHarvestList(pondId);
      }
      if (tab === 'help') renderHelp();
    });
  });

  // --- ADD POND ---
  document.getElementById('add-pond-btn')?.addEventListener('click', showAddPondModal);

  // --- MODAL ---
  document.querySelector('.modal-close')?.addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
  });
  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('modal').style.display = 'none';
  });

  // --- ADD SPECIES LOG ---
  document.getElementById('add-species-log-btn')?.addEventListener('click', () => {
    const container = document.getElementById('species-log-entries');
    const index = container.children.length;
    container.insertAdjacentHTML('beforeend', createSpeciesLogEntry('', index));
    updateSpeciesLogColors();
  });

  // --- REMOVE SPECIES LOG (delegated) ---
  document.getElementById('species-log-entries')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-species-log')) {
      const index = e.target.dataset.index;
      const entry = document.querySelector(`.species-log-entry[data-index="${index}"]`);
      if (entry && document.querySelectorAll('.species-log-entry').length > 1) {
        entry.remove();
        updateSpeciesLogIndices();
      } else {
        showMessage('log-message', 'At least one species is required.', 'error');
      }
    }
  });

  // --- LOG FORM ---
  document.getElementById('log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pondId = document.getElementById('log-pond').value;
    if (!pondId) { showMessage('log-message', 'Please select a pond first.', 'error'); return; }

    const temp = validateNumber(document.getElementById('log-temp').value);
    const ph = validateNumber(document.getElementById('log-ph').value);
    const salinity = validateNumber(document.getElementById('log-salinity').value);
    const doVal = validateNumber(document.getElementById('log-do').value);
    const ammonia = validateNumber(document.getElementById('log-ammonia').value);
    const nitrate = validateNumber(document.getElementById('log-nitrate').value);
    const nitrite = validateNumber(document.getElementById('log-nitrite').value);

    if (temp === null || ph === null || salinity === null || doVal === null || ammonia === null) {
      showMessage('log-message', 'Please fill in all water quality fields with valid numbers.', 'error');
      return;
    }

    const speciesEntries = document.querySelectorAll('.species-log-entry');
    const speciesLogs = [];
    let hasSpecies = false;

    for (const entry of speciesEntries) {
      const speciesId = entry.querySelector('.species-select').value;
      if (!speciesId) continue;
      hasSpecies = true;
      speciesLogs.push({
        speciesId: speciesId,
        doc: validateInt(entry.querySelector('.species-doc').value),
        weight: validateNumber(entry.querySelector('.species-weight').value, 0),
        mortality: validateInt(entry.querySelector('.species-mortality').value, 0),
        feedType: entry.querySelector('.species-feed-type').value,
        feedAmount: validateNumber(entry.querySelector('.species-feed-amount').value, 0),
        feedCost: validateNumber(entry.querySelector('.species-feed-cost').value, 0),
        notes: entry.querySelector('.species-notes').value.trim() || ''
      });
    }

    if (!hasSpecies) {
      showMessage('log-message', 'Please add at least one species log.', 'error');
      return;
    }

    const log = {
      pondId: pondId,
      date: document.getElementById('log-date').value,
      measurementTime: document.getElementById('log-time').value || '08:00',
      temp: temp,
      ph: ph,
      salinity: salinity,
      do: doVal,
      ammonia: ammonia,
      nitrate: nitrate || null,
      nitrite: nitrite || null,
      weather: document.getElementById('log-weather').value,
      speciesLogs: speciesLogs,
      notes: document.getElementById('log-notes').value.trim() || '',
      createdAt: new Date().toISOString()
    };

    await add('dailyLogs', log);
    showMessage('log-message', 'Log saved successfully!', 'success');
    document.getElementById('log-form').reset();
    document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('log-time').value = '08:00';
    document.getElementById('species-log-entries').innerHTML = '';
    await updateSelectors();
    await renderPondList();
  });

  // --- HARVEST FORM ---
  document.getElementById('harvest-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pondId = document.getElementById('harvest-pond').value;
    const speciesId = document.getElementById('harvest-species').value;
    if (!pondId || !speciesId) {
      showMessage('harvest-message', 'Please select both pond and species.', 'error');
      return;
    }

    const weight = validateNumber(document.getElementById('harvest-weight').value);
    const price = validateNumber(document.getElementById('harvest-price').value);
    let revenue = validateNumber(document.getElementById('harvest-revenue').value);

    if (weight === null || price === null || weight <= 0 || price <= 0) {
      showMessage('harvest-message', 'Please enter valid weight and price.', 'error');
      return;
    }

    if (revenue === null || revenue <= 0) {
      revenue = Math.round(weight * price);
      document.getElementById('harvest-revenue').value = revenue;
    }

    const harvest = {
      pondId: pondId,
      speciesId: speciesId,
      date: document.getElementById('harvest-date').value,
      weight: weight,
      price: price,
      revenue: revenue,
      buyer: document.getElementById('harvest-buyer').value.trim() || '',
      notes: document.getElementById('harvest-notes').value.trim() || '',
      createdAt: new Date().toISOString()
    };

    await add('harvests', harvest);
    showMessage('harvest-message', 'Harvest record saved!', 'success');
    document.getElementById('harvest-form').reset();
    document.getElementById('harvest-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('harvest-revenue').value = '';
    await renderHarvestList(pondId);
    await renderPondList();
    await updateSelectors();
  });

  // --- HARVEST AUTO-CALC ---
  document.getElementById('harvest-weight')?.addEventListener('input', calcRevenue);
  document.getElementById('harvest-price')?.addEventListener('input', calcRevenue);
  function calcRevenue() {
    const weight = validateNumber(document.getElementById('harvest-weight').value);
    const price = validateNumber(document.getElementById('harvest-price').value);
    if (weight !== null && price !== null && weight > 0 && price > 0) {
      document.getElementById('harvest-revenue').value = Math.round(weight * price);
    }
  }

  // --- HARVEST POND SELECTOR ---
  document.getElementById('harvest-pond')?.addEventListener('change', async (e) => {
    await populateHarvestSpecies(e.target.value);
    await renderHarvestList(e.target.value);
  });

  // --- LOG POND SELECTOR ---
  document.getElementById('log-pond')?.addEventListener('change', async (e) => {
    const pondId = e.target.value;
    if (pondId) {
      await populateSpeciesLogs(pondId);
      document.getElementById('add-species-log-btn').style.display = 'block';
    } else {
      document.getElementById('species-log-entries').innerHTML = '';
      document.getElementById('add-species-log-btn').style.display = 'none';
    }
  });

  // --- TIDE FORM ---
  document.getElementById('tide-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tide = {
      date: document.getElementById('tide-date').value,
      highLevel: validateNumber(document.getElementById('tide-high').value, 0),
      highTime: document.getElementById('tide-high-time').value || '',
      lowLevel: validateNumber(document.getElementById('tide-low').value, 0),
      lowTime: document.getElementById('tide-low-time').value || '',
      createdAt: new Date().toISOString()
    };
    await add('tideLogs', tide);
    showMessage('tide-message', 'Tide data saved!', 'success');
  });

  // --- ANALYSIS POND SELECTOR ---
  document.getElementById('analysis-pond')?.addEventListener('change', async (e) => {
    const pondId = e.target.value;
    await renderAnalysis(pondId);
  });

  // --- DECIDE POND SELECTOR ---
  document.getElementById('decide-pond')?.addEventListener('change', async (e) => {
    const pondId = e.target.value;
    await renderDecide(pondId);
  });

  // --- PREP POND SELECTOR ---
  document.getElementById('prep-pond')?.addEventListener('change', async (e) => {
    await renderPrep(e.target.value);
  });

  // --- LOAD SAMPLE DATA ---
  document.getElementById('load-sample-data')?.addEventListener('click', async () => {
    if (confirm('Load sample data? This will add a demo pond with multiple species.')) {
      await loadSampleData();
      await renderPondList();
      await updateSelectors();
      showMessage('log-message', 'Sample data loaded! Check the Dashboard.', 'success');
    }
  });

  // --- EXPORT CSV ---
  document.getElementById('export-csv')?.addEventListener('click', async () => {
    const logs = await getAll('dailyLogs');
    if (logs.length === 0) {
      showMessage('log-message', 'No data to export.', 'error');
      return;
    }
    exportToCSV(logs, 'fishpond-logs');
  });

  // --- PRINT REPORT ---
  document.getElementById('print-report')?.addEventListener('click', printReport);

  // --- EXPORT DATA ---
  document.getElementById('export-data')?.addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fishpond-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem('lastExportDate', new Date().toISOString());
    showMessage('log-message', 'Data exported!', 'success');
  });

  // --- IMPORT DATA ---
  document.getElementById('import-data')?.addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      await renderPondList();
      await updateSelectors();
      showMessage('log-message', 'Data imported successfully!', 'success');
    } catch (err) {
      showMessage('log-message', 'Invalid file format.', 'error');
    }
    e.target.value = '';
  });

  // --- CLEAR DATA ---
  document.getElementById('clear-data')?.addEventListener('click', async () => {
    if (confirm('Delete ALL data? This cannot be undone.')) {
      await clearStore('ponds');
      await clearStore('dailyLogs');
      await clearStore('harvests');
      await clearStore('tideLogs');
      await clearStore('prepLogs');
      await renderPondList();
      await updateSelectors();
      showMessage('log-message', 'All data cleared.', 'info');
    }
  });
}

// ---- Species Log Helper Functions ----
function createSpeciesLogEntry(speciesId = '', index = 0) {
  const speciesList = getSpeciesList();
  const options = speciesList.map(s =>
    `<option value="${s.id}" ${s.id === speciesId ? 'selected' : ''}>${s.icon} ${s.name}</option>`
  ).join('');

  return `
    <div class="species-log-entry" data-index="${index}" style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:12px;border-left:4px solid ${speciesId ? getSpeciesColor(speciesId) : '#666'};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="font-size:0.9rem;">Species #${index + 1}</strong>
        <button type="button" class="remove-species-log small-btn delete" data-index="${index}">Remove</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Species *</label>
          <select class="species-select" data-index="${index}" required>
            <option value="">Select species</option>
            ${options}
          </select>
        </div>
        <div class="form-group">
          <label>Day of Culture (DOC)</label>
          <input type="number" class="species-doc" data-index="${index}" min="0" step="1" placeholder="e.g., 45">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Sample Weight (g)</label>
          <input type="number" class="species-weight" data-index="${index}" step="0.1" placeholder="e.g., 150">
        </div>
        <div class="form-group">
          <label>Mortality</label>
          <input type="number" class="species-mortality" data-index="${index}" value="0" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Feed Type</label>
          <select class="species-feed-type" data-index="${index}">
            <option value="Starter">Starter</option>
            <option value="Grower" selected>Grower</option>
            <option value="Finisher">Finisher</option>
          </select>
        </div>
        <div class="form-group">
          <label>Feed Amount (kg)</label>
          <input type="number" class="species-feed-amount" data-index="${index}" step="0.1" value="0">
        </div>
        <div class="form-group">
          <label>Feed Cost (₱)</label>
          <input type="number" class="species-feed-cost" data-index="${index}" step="1" value="0">
        </div>
      </div>
      <div class="form-group">
        <label>Species Notes</label>
        <input type="text" class="species-notes" data-index="${index}" placeholder="Observations for this species...">
      </div>
    </div>
  `;
}

async function populateSpeciesLogs(pondId) {
  const pond = await getById('ponds', pondId);
  const container = document.getElementById('species-log-entries');
  container.innerHTML = '';

  if (pond && pond.species && pond.species.length > 0) {
    let index = 0;
    for (const sp of pond.species) {
      container.insertAdjacentHTML('beforeend', createSpeciesLogEntry(sp.speciesId, index));
      index++;
    }
    document.getElementById('add-species-log-btn').style.display = 'block';
  } else {
    container.insertAdjacentHTML('beforeend', createSpeciesLogEntry('', 0));
    document.getElementById('add-species-log-btn').style.display = 'block';
  }
  updateSpeciesLogColors();
}

async function populateHarvestSpecies(pondId) {
  const select = document.getElementById('harvest-species');
  select.innerHTML = '<option value="">Select species</option>';
  if (!pondId) return;

  const pond = await getById('ponds', pondId);
  if (pond && pond.species) {
    for (const sp of pond.species) {
      const species = getSpecies(sp.speciesId);
      if (species) {
        select.innerHTML += `<option value="${species.id}">${species.icon} ${species.name}</option>`;
      }
    }
  }
}

function updateSpeciesLogColors() {
  document.querySelectorAll('.species-log-entry').forEach(entry => {
    const select = entry.querySelector('.species-select');
    const speciesId = select.value;
    const color = speciesId ? getSpeciesColor(speciesId) : '#666';
    entry.style.borderLeftColor = color;
  });
}

function updateSpeciesLogIndices() {
  document.querySelectorAll('.species-log-entry').forEach((entry, index) => {
    entry.dataset.index = index;
    entry.querySelector('.species-select').dataset.index = index;
    entry.querySelector('.species-doc').dataset.index = index;
    entry.querySelector('.species-weight').dataset.index = index;
    entry.querySelector('.species-mortality').dataset.index = index;
    entry.querySelector('.species-feed-type').dataset.index = index;
    entry.querySelector('.species-feed-amount').dataset.index = index;
    entry.querySelector('.species-feed-cost').dataset.index = index;
    entry.querySelector('.species-notes').dataset.index = index;
    const removeBtn = entry.querySelector('.remove-species-log');
    if (removeBtn) removeBtn.dataset.index = index;
    entry.querySelector('strong').textContent = `Species #${index + 1}`;
  });
}

// ---- Sample Data ----
async function loadSampleData() {
  const ponds = await getAll('ponds');
  if (ponds.length > 0) return;

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

  // Sample logs with multiple species
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

// ---- START ----
document.addEventListener('DOMContentLoaded', init);
