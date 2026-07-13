// ============================================================
// MAIN APP - Entry Point
// ============================================================

import { openDB, add, getAll, getByIndex, update, remove, clearStore, exportAllData, importAllData } from './db.js';
import { getPondStatus, generateRecommendations, getPhase } from './ooda.js';
import { 
  showTab, showMessage, renderPondList, showPondDetail, 
  showAddPondModal, updateSelectors, renderAnalysis, renderHarvestList
} from './ui.js';
import { validateNumber, validateInt, escapeHtml } from './utils.js';

// ---- Initialize App ----
async function init() {
  await openDB();
  
  // Set default dates
  const dateInput = document.getElementById('log-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  const harvestDate = document.getElementById('harvest-date');
  if (harvestDate) harvestDate.value = new Date().toISOString().split('T')[0];
  const tideDate = document.getElementById('tide-date');
  if (tideDate) tideDate.value = new Date().toISOString().split('T')[0];

  // Render initial data
  await renderPondList();
  await updateSelectors();

  // Setup event listeners
  setupEventListeners();

  // Check online status
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  console.log('🐟 Fishpond OODA Tool v2.0 initialized!');
}

// ---- Update Online Status ----
function updateOnlineStatus() {
  const el = document.getElementById('online-status');
  if (el) {
    const online = navigator.onLine;
    el.textContent = online ? '● Online' : '● Offline';
    el.className = online ? 'online' : 'offline';
  }
}

// ---- Delete Functions (Exposed to Window) ----
window.deletePond = async function(pondId) {
  if (!confirm('Delete this pond and all its data? This cannot be undone.')) return;
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  for (const log of logs) await remove('dailyLogs', log.id);
  for (const harvest of harvests) await remove('harvests', harvest.id);
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
  if (harvestPond) {
    await renderHarvestList(harvestPond.value);
  }
  await renderPondList();
  showMessage('harvest-message', 'Harvest record deleted.', 'info');
};

// ---- Setup Event Listeners ----
function setupEventListeners() {
  // ---- Tab Navigation ----
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tab = btn.dataset.tab;
      showTab(tab);
      if (tab === 'dashboard') await renderPondList();
      if (tab === 'analysis') {
        const pondId = document.getElementById('analysis-pond')?.value;
        await renderAnalysis(pondId);
      }
      if (tab === 'log') await updateSelectors();
      if (tab === 'harvest') {
        await updateSelectors();
        const pondId = document.getElementById('harvest-pond')?.value;
        await renderHarvestList(pondId);
      }
    });
  });

  // ---- Add Pond ----
  document.getElementById('add-pond-btn')?.addEventListener('click', showAddPondModal);

  // ---- Close Modal ----
  document.querySelector('.modal-close')?.addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
  });
  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('modal').style.display = 'none';
    }
  });

  // ---- Log Form ----
  document.getElementById('log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pondId = document.getElementById('log-pond').value;
    if (!pondId) {
      showMessage('log-message', 'Please select a pond first.', 'error');
      return;
    }

    // Validate numeric fields
    const temp = validateNumber(document.getElementById('log-temp').value);
    const ph = validateNumber(document.getElementById('log-ph').value);
    const salinity = validateNumber(document.getElementById('log-salinity').value);
    const doVal = validateNumber(document.getElementById('log-do').value);
    const ammonia = validateNumber(document.getElementById('log-ammonia').value);
    const feedAmount = validateNumber(document.getElementById('log-feed-amount').value, 0);
    const feedCost = validateNumber(document.getElementById('log-feed-cost').value, 0);
    const mortality = validateInt(document.getElementById('log-mortality').value, 0);
    const weight = validateNumber(document.getElementById('log-weight').value);

    if (temp === null || ph === null || salinity === null || doVal === null || ammonia === null) {
      showMessage('log-message', 'Please fill in all water quality fields with valid numbers.', 'error');
      return;
    }

    const log = {
      pondId: pondId,
      date: document.getElementById('log-date').value,
      temp: temp,
      ph: ph,
      salinity: salinity,
      do: doVal,
      ammonia: ammonia,
      feedType: document.getElementById('log-feed-type').value,
      feedAmount: feedAmount,
      feedCost: feedCost,
      mortality: mortality,
      cause: document.getElementById('log-cause').value.trim() || '',
      weather: document.getElementById('log-weather').value,
      weight: weight || 0,
      notes: document.getElementById('log-notes').value.trim() || '',
      createdAt: new Date().toISOString()
    };

    await add('dailyLogs', log);
    showMessage('log-message', '✅ Log saved successfully!', 'success');
    document.getElementById('log-form').reset();
    document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
    await updateSelectors();
    await renderPondList();
  });

  // ---- Harvest Form ----
  document.getElementById('harvest-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pondId = document.getElementById('harvest-pond').value;
    if (!pondId) {
      showMessage('harvest-message', 'Please select a pond first.', 'error');
      return;
    }

    const weight = validateNumber(document.getElementById('harvest-weight').value);
    const price = validateNumber(document.getElementById('harvest-price').value);
    let revenue = validateNumber(document.getElementById('harvest-revenue').value);

    if (weight === null || price === null || weight <= 0 || price <= 0) {
      showMessage('harvest-message', 'Please enter valid weight and price.', 'error');
      return;
    }

    // Auto-calculate revenue if not entered or invalid
    if (revenue === null || revenue <= 0) {
      revenue = Math.round(weight * price);
      document.getElementById('harvest-revenue').value = revenue;
    }

    const harvest = {
      pondId: pondId,
      date: document.getElementById('harvest-date').value,
      weight: weight,
      price: price,
      revenue: revenue,
      buyer: document.getElementById('harvest-buyer').value.trim() || '',
      notes: document.getElementById('harvest-notes').value.trim() || '',
      createdAt: new Date().toISOString()
    };

    await add('harvests', harvest);
    
    // Mark pond as harvested
    const pond = (await getAll('ponds')).find(p => p.id === pondId);
    if (pond) {
      pond.harvested = true;
      await update('ponds', pond);
    }

    showMessage('harvest-message', '✅ Harvest record saved!', 'success');
    document.getElementById('harvest-form').reset();
    document.getElementById('harvest-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('harvest-revenue').value = '';
    await renderHarvestList(pondId);
    await renderPondList();
    await updateSelectors();
  });

  // ---- Auto-calculate harvest revenue ----
  document.getElementById('harvest-weight')?.addEventListener('input', calcRevenue);
  document.getElementById('harvest-price')?.addEventListener('input', calcRevenue);
  function calcRevenue() {
    const weight = validateNumber(document.getElementById('harvest-weight').value);
    const price = validateNumber(document.getElementById('harvest-price').value);
    if (weight !== null && price !== null && weight > 0 && price > 0) {
      document.getElementById('harvest-revenue').value = Math.round(weight * price);
    }
  }

  // ---- Harvest Pond Selector ----
  document.getElementById('harvest-pond')?.addEventListener('change', async (e) => {
    await renderHarvestList(e.target.value);
  });

  // ---- Tide Form ----
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
    showMessage('tide-message', '✅ Tide data saved!', 'success');
  });

  // ---- Analysis Pond Selector ----
  document.getElementById('analysis-pond')?.addEventListener('change', (e) => {
    renderAnalysis(e.target.value);
  });

  // ---- Theme Toggle ----
  document.getElementById('theme-light')?.addEventListener('click', () => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  });
  document.getElementById('theme-dark')?.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  });

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // ---- Export Data ----
  document.getElementById('export-data')?.addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fishpond-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('log-message', '✅ Data exported!', 'success');
  });

  // ---- Import Data ----
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
      showMessage('log-message', '✅ Data imported successfully!', 'success');
    } catch (err) {
      showMessage('log-message', '❌ Invalid file format.', 'error');
    }
    e.target.value = '';
  });

  // ---- Clear Data ----
  document.getElementById('clear-data')?.addEventListener('click', async () => {
    if (confirm('⚠️ Delete ALL data? This cannot be undone.')) {
      await clearStore('ponds');
      await clearStore('dailyLogs');
      await clearStore('harvests');
      await clearStore('tideLogs');
      await renderPondList();
      await updateSelectors();
      showMessage('log-message', '🗑️ All data cleared.', 'info');
    }
  });
}

// ---- Start App ----
document.addEventListener('DOMContentLoaded', init);