// ============================================================
// UI HELPERS - Complete with All Exports
// ============================================================

import { getAll, getByIndex, add, update, remove, getById, exportAllData, getSpeciesTotals } from './db.js';
import { getSpecies, getSpeciesList, getSpeciesName, getSpeciesIcon, getSpeciesColor } from './species.js';
import { escapeHtml, formatCurrency, formatNumber, validateNumber } from './utils.js';
import { renderPrep } from './prep.js';

// ============================================================
// DECISION ENGINE IMPORTS
// ============================================================

import {
  generateDecisionMatrix,
  calculateCostBenefit,
  calculateReorderPoint,
  calculatePondHealthScore,
  calculateHistoricalAverages
} from './decide.js';

import {
  getPondStatus as getPondStatusOODA,
  generateMultiSpeciesRecommendations,
  getPolycultureRecommendation
} from './ooda.js';

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

export function showTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
}

export function showMessage(target, message, type = 'success') {
  const el = document.getElementById(target);
  if (!el) return;
  el.textContent = message;
  el.className = `message show ${type}`;
  setTimeout(() => {
    el.className = 'message';
  }, 5000);
}

// ---- Render Pond List ----
export async function renderPondList() {
  const container = document.getElementById('pond-list');
  if (!container) return;
  const ponds = await getAll('ponds');
  if (ponds.length === 0) {
    container.innerHTML = `<p style="color:var(--text-light);text-align:center;padding:40px 0;">No ponds yet. Click "Add Pond" to get started.</p>`;
    return;
  }
  let html = '';
  for (const pond of ponds) {
    const logs = await getByIndex('dailyLogs', 'pondId', pond.id);
    const harvests = await getByIndex('harvests', 'pondId', pond.id);
    const name = escapeHtml(pond.name || 'Unnamed Pond');
    const area = formatNumber(pond.area, 2);
    const speciesList = pond.species ? pond.species.map(s => getSpeciesName(s.speciesId)).join(', ') : 'No species';
    const hasHarvest = harvests && harvests.length > 0;
    
    let totalStocked = 0;
    if (pond.species) {
      for (const sp of pond.species) {
        totalStocked += sp.fingerlings || 0;
      }
    }
    
    html += `
      <div class="pond-card" data-pond-id="${escapeHtml(pond.id)}">
        <div class="name">${name}</div>
        <div class="species">${speciesList} • ${area}ha</div>
        <span class="status green">${hasHarvest ? 'Harvested' : 'Active'}</span>
        ${hasHarvest ? `<span class="harvested-badge">Harvested</span>` : ''}
        <div class="metric">📅 ${pond.stockingDate || 'Not stocked yet'}</div>
        <div class="metric">🐟 Stocked: ${totalStocked}</div>
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button onclick="event.stopPropagation();window.editPond('${escapeHtml(pond.id)}')" class="small-btn edit">Edit</button>
          <button onclick="event.stopPropagation();window.deletePond('${escapeHtml(pond.id)}')" class="small-btn delete">Delete</button>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
  container.querySelectorAll('.pond-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = card.dataset.pondId;
      showPondDetail(id);
    });
  });
}

export async function showPondDetail(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return;
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  const container = document.getElementById('pond-detail');
  container.style.display = 'block';
  
  let speciesHtml = '';
  if (pond.species && pond.species.length > 0) {
    speciesHtml = `
      <div style="margin-top:12px;">
        <strong>Species in this pond:</strong>
        <ul style="padding-left:18px;margin-top:4px;">
          ${pond.species.map(sp => {
            const s = getSpecies(sp.speciesId);
            return `<li>${s ? s.icon : '🐟'} ${getSpeciesName(sp.speciesId)} - ${sp.fingerlings || 0} fingerlings, stocked ${sp.stockingDate || 'N/A'}</li>`;
          }).join('')}
        </ul>
      </div>
    `;
  }
  
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <h3>${escapeHtml(pond.name)}</h3>
      <div style="display:flex;gap:6px;">
        <button onclick="document.getElementById('pond-detail').style.display='none'" class="secondary-btn">Close</button>
        <button onclick="window.editPond('${escapeHtml(pond.id)}')" class="small-btn edit">Edit</button>
        <button onclick="window.deletePond('${escapeHtml(pond.id)}')" class="small-btn delete">Delete</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:12px;">
      <div><strong>Location:</strong> ${escapeHtml(pond.location || 'N/A')}</div>
      <div><strong>Area:</strong> ${formatNumber(pond.area, 2)}ha</div>
      <div><strong>Harvested:</strong> ${pond.harvested ? '✅ Yes' : 'No'}</div>
    </div>
    ${speciesHtml}
    <div style="margin-top:12px;font-size:0.8rem;color:var(--text-muted);">
      ${logs.length} log entries • ${harvests.length} harvests
    </div>
  `;
}

// ---- Show Add Pond Modal ----
export function showAddPondModal() {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';
  
  const speciesOptions = getSpeciesList().map(s => 
    `<option value="${s.id}">${s.icon} ${s.name}</option>`
  ).join('');
  
  body.innerHTML = `
    <h2>Add New Pond</h2>
    <form id="add-pond-form">
      <div class="form-group"><label>Pond Name *</label><input type="text" id="pond-name" required placeholder="e.g., West Pond"></div>
      <div class="form-row">
        <div class="form-group"><label>Area (hectares) *</label><input type="number" id="pond-area" step="0.01" required placeholder="0.5"></div>
        <div class="form-group"><label>Location</label><input type="text" id="pond-location" placeholder="Region/Province"></div>
      </div>
      
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <h4>Species in this pond</h4>
        <div id="species-list-container">
          <div class="species-entry" data-index="0" style="background:var(--bg);padding:8px;border-radius:8px;margin-bottom:8px;">
            <div class="form-row">
              <div class="form-group">
                <label>Species *</label>
                <select class="species-select" data-index="0" required>
                  <option value="">Select species</option>
                  ${speciesOptions}
                </select>
              </div>
              <div class="form-group">
                <label>Fingerlings *</label>
                <input type="number" class="species-fingerlings" data-index="0" required placeholder="e.g., 5000">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Stocking Date</label>
                <input type="date" class="species-stocking-date" data-index="0">
              </div>
              <div class="form-group">
                <label>Stocking Weight (g)</label>
                <input type="number" class="species-stocking-weight" data-index="0" step="0.1" placeholder="e.g., 5">
              </div>
            </div>
            <button type="button" class="remove-species-entry small-btn delete" data-index="0">Remove</button>
          </div>
        </div>
        <button type="button" id="add-species-entry-btn" class="secondary-btn" style="margin-top:8px;width:100%;">+ Add Another Species</button>
      </div>
      
      <button type="submit" class="primary-btn" style="width:100%;margin-top:16px;">Add Pond</button>
    </form>
  `;
  
  let speciesIndex = 1;
  document.getElementById('add-species-entry-btn').addEventListener('click', () => {
    const container = document.getElementById('species-list-container');
    const entry = document.createElement('div');
    entry.className = 'species-entry';
    entry.dataset.index = speciesIndex;
    entry.style.cssText = 'background:var(--bg);padding:8px;border-radius:8px;margin-bottom:8px;';
    entry.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Species *</label>
          <select class="species-select" data-index="${speciesIndex}" required>
            <option value="">Select species</option>
            ${speciesOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Fingerlings *</label>
          <input type="number" class="species-fingerlings" data-index="${speciesIndex}" required placeholder="e.g., 5000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stocking Date</label>
          <input type="date" class="species-stocking-date" data-index="${speciesIndex}">
        </div>
        <div class="form-group">
          <label>Stocking Weight (g)</label>
          <input type="number" class="species-stocking-weight" data-index="${speciesIndex}" step="0.1" placeholder="e.g., 5">
        </div>
      </div>
      <button type="button" class="remove-species-entry small-btn delete" data-index="${speciesIndex}">Remove</button>
    `;
    container.appendChild(entry);
    speciesIndex++;
    updateSpeciesRemoveButtons();
  });
  
  function updateSpeciesRemoveButtons() {
    document.querySelectorAll('.remove-species-entry').forEach(btn => {
      btn.addEventListener('click', function() {
        const entries = document.querySelectorAll('.species-entry');
        if (entries.length > 1) {
          this.closest('.species-entry').remove();
        } else {
          alert('At least one species is required.');
        }
      });
    });
  }
  updateSpeciesRemoveButtons();
  
  document.getElementById('add-pond-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('pond-name').value.trim();
    const area = validateNumber(document.getElementById('pond-area').value, 0);
    const location = document.getElementById('pond-location').value.trim() || '';
    
    if (!name || !area) {
      alert('Please fill in all required fields.');
      return;
    }
    
    const speciesEntries = document.querySelectorAll('.species-entry');
    const species = [];
    let hasSpecies = false;
    
    for (const entry of speciesEntries) {
      const speciesId = entry.querySelector('.species-select').value;
      const fingerlings = validateNumber(entry.querySelector('.species-fingerlings').value, 0);
      if (speciesId && fingerlings > 0) {
        hasSpecies = true;
        species.push({
          speciesId: speciesId,
          stockingDate: entry.querySelector('.species-stocking-date').value || new Date().toISOString().split('T')[0],
          fingerlings: fingerlings,
          stockingWeight: validateNumber(entry.querySelector('.species-stocking-weight').value, 0)
        });
      }
    }
    
    if (!hasSpecies) {
      alert('Please add at least one species with fingerlings.');
      return;
    }
    
    const pond = {
      name: name,
      area: area,
      location: location,
      species: species,
      harvested: false,
      createdAt: new Date().toISOString()
    };
    
    await add('ponds', pond);
    modal.style.display = 'none';
    await renderPondList();
    updateSelectors();
    showMessage('log-message', 'Pond added successfully!', 'success');
  });
}

// ---- Edit Pond ----
export async function editPond(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';
  
  const speciesOptions = getSpeciesList().map(s => 
    `<option value="${s.id}">${s.icon} ${s.name}</option>`
  ).join('');
  
  let speciesHtml = '';
  if (pond.species && pond.species.length > 0) {
    speciesHtml = pond.species.map((sp, idx) => `
      <div class="species-entry" data-index="${idx}" style="background:var(--bg);padding:8px;border-radius:8px;margin-bottom:8px;">
        <div class="form-row">
          <div class="form-group">
            <label>Species *</label>
            <select class="species-select" data-index="${idx}" required>
              <option value="">Select species</option>
              ${speciesOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Fingerlings *</label>
            <input type="number" class="species-fingerlings" data-index="${idx}" value="${sp.fingerlings || 0}" required placeholder="e.g., 5000">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Stocking Date</label>
            <input type="date" class="species-stocking-date" data-index="${idx}" value="${sp.stockingDate || ''}">
          </div>
          <div class="form-group">
            <label>Stocking Weight (g)</label>
            <input type="number" class="species-stocking-weight" data-index="${idx}" step="0.1" value="${sp.stockingWeight || 0}" placeholder="e.g., 5">
          </div>
        </div>
        <button type="button" class="remove-species-entry small-btn delete" data-index="${idx}">Remove</button>
      </div>
    `).join('');
  } else {
    speciesHtml = `<p style="color:var(--text-muted);">No species added yet.</p>`;
  }
  
  body.innerHTML = `
    <h2>Edit Pond</h2>
    <form id="edit-pond-form">
      <input type="hidden" id="edit-pond-id" value="${pond.id}">
      <div class="form-group"><label>Pond Name *</label><input type="text" id="edit-pond-name" value="${escapeHtml(pond.name)}" required></div>
      <div class="form-row">
        <div class="form-group"><label>Area (hectares) *</label><input type="number" id="edit-pond-area" step="0.01" value="${pond.area}" required></div>
        <div class="form-group"><label>Location</label><input type="text" id="edit-pond-location" value="${escapeHtml(pond.location || '')}"></div>
      </div>
      
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <h4>Species in this pond</h4>
        <div id="species-list-container">
          ${speciesHtml}
        </div>
        <button type="button" id="add-species-entry-btn" class="secondary-btn" style="margin-top:8px;width:100%;">+ Add Another Species</button>
      </div>
      
      <button type="submit" class="primary-btn" style="width:100%;margin-top:16px;">Update Pond</button>
    </form>
  `;
  
  let speciesIndex = pond.species ? pond.species.length : 0;
  document.getElementById('add-species-entry-btn').addEventListener('click', () => {
    const container = document.getElementById('species-list-container');
    const entry = document.createElement('div');
    entry.className = 'species-entry';
    entry.dataset.index = speciesIndex;
    entry.style.cssText = 'background:var(--bg);padding:8px;border-radius:8px;margin-bottom:8px;';
    entry.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Species *</label>
          <select class="species-select" data-index="${speciesIndex}" required>
            <option value="">Select species</option>
            ${speciesOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Fingerlings *</label>
          <input type="number" class="species-fingerlings" data-index="${speciesIndex}" required placeholder="e.g., 5000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stocking Date</label>
          <input type="date" class="species-stocking-date" data-index="${speciesIndex}">
        </div>
        <div class="form-group">
          <label>Stocking Weight (g)</label>
          <input type="number" class="species-stocking-weight" data-index="${speciesIndex}" step="0.1" placeholder="e.g., 5">
        </div>
      </div>
      <button type="button" class="remove-species-entry small-btn delete" data-index="${speciesIndex}">Remove</button>
    `;
    container.appendChild(entry);
    speciesIndex++;
    updateSpeciesRemoveButtonsEdit();
  });
  
  function updateSpeciesRemoveButtonsEdit() {
    document.querySelectorAll('#species-list-container .remove-species-entry').forEach(btn => {
      btn.addEventListener('click', function() {
        const entries = document.querySelectorAll('#species-list-container .species-entry');
        if (entries.length > 1) {
          this.closest('.species-entry').remove();
        } else {
          alert('At least one species is required.');
        }
      });
    });
  }
  updateSpeciesRemoveButtonsEdit();
  
  document.getElementById('edit-pond-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('edit-pond-name').value.trim();
    const area = validateNumber(document.getElementById('edit-pond-area').value, 0);
    const location = document.getElementById('edit-pond-location').value.trim() || '';
    
    if (!name || !area) {
      alert('Please fill in all required fields.');
      return;
    }
    
    const speciesEntries = document.querySelectorAll('#species-list-container .species-entry');
    const species = [];
    let hasSpecies = false;
    
    for (const entry of speciesEntries) {
      const speciesId = entry.querySelector('.species-select').value;
      const fingerlings = validateNumber(entry.querySelector('.species-fingerlings').value, 0);
      if (speciesId && fingerlings > 0) {
        hasSpecies = true;
        species.push({
          speciesId: speciesId,
          stockingDate: entry.querySelector('.species-stocking-date').value || new Date().toISOString().split('T')[0],
          fingerlings: fingerlings,
          stockingWeight: validateNumber(entry.querySelector('.species-stocking-weight').value, 0)
        });
      }
    }
    
    if (!hasSpecies) {
      alert('Please add at least one species with fingerlings.');
      return;
    }
    
    const updatedPond = {
      ...pond,
      name: name,
      area: area,
      location: location,
      species: species
    };
    
    await update('ponds', updatedPond);
    modal.style.display = 'none';
    await renderPondList();
    updateSelectors();
    showMessage('log-message', 'Pond updated!', 'success');
  });
}

// ---- Update Selectors ----
export async function updateSelectors() {
  const ponds = await getAll('ponds');
  const selectors = ['log-pond', 'harvest-pond', 'analysis-pond', 'decide-pond', 'prep-pond'];
  for (const id of selectors) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Select a pond</option>';
    for (const p of ponds) {
      sel.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    }
    if (currentVal && ponds.some(p => p.id === currentVal)) {
      sel.value = currentVal;
    }
  }
  const logPond = document.getElementById('log-pond');
  const logNameDisplay = document.getElementById('log-pond-name');
  if (logPond && logNameDisplay) {
    const selected = ponds.find(p => p.id === logPond.value);
    logNameDisplay.textContent = selected ? escapeHtml(selected.name) : 'Select a pond first';
  }
  const harvestPond = document.getElementById('harvest-pond');
  const harvestNameDisplay = document.getElementById('harvest-pond-name');
  if (harvestPond && harvestNameDisplay) {
    const selected = ponds.find(p => p.id === harvestPond.value);
    harvestNameDisplay.textContent = selected ? escapeHtml(selected.name) : 'Select a pond first';
  }
}

// ---- Render Harvest List ----
export async function renderHarvestList(pondId) {
  const container = document.getElementById('harvest-list');
  if (!container) return;
  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);">Select a pond to see harvest records.</p>';
    return;
  }
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  if (harvests.length === 0) {
    container.innerHTML = '<p style="color:var(--text-light);">No harvest records yet.</p>';
    return;
  }
  const sorted = [...harvests].sort((a, b) => new Date(b.date) - new Date(a.date));
  container.innerHTML = sorted.map(h => `
    <div class="harvest-item" data-harvest-id="${h.id}">
      <div class="info">
        ${new Date(h.date).toLocaleDateString()} • 
        <strong>${formatNumber(h.weight, 1)}kg</strong> @ 
        ₱${formatNumber(h.price, 2)}/kg = 
        <strong>₱${formatNumber(h.revenue, 0)}</strong>
        ${h.speciesId ? ` • ${getSpeciesName(h.speciesId)}` : ''}
        ${h.buyer ? ` • ${escapeHtml(h.buyer)}` : ''}
        ${h.notes ? ` • ${escapeHtml(h.notes)}` : ''}
      </div>
      <div class="actions">
        <button onclick="window.editHarvest('${h.id}')" class="small-btn edit">Edit</button>
        <button onclick="window.deleteHarvest('${escapeHtml(h.id)}')" class="small-btn delete">Delete</button>
      </div>
    </div>
  `).join('');
}

// ---- Render Analysis (OODA Integration) ----
export async function renderAnalysis(pondId) {
  const container = document.getElementById('analysis-content');
  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to analyze.</p>';
    return;
  }

  try {
    const status = await getPondStatusOODA(pondId);
    if (!status) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found or no data.</p>';
      return;
    }

    const recs = await generateMultiSpeciesRecommendations(pondId);
    if (!recs) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Could not generate recommendations.</p>';
      return;
    }

    let html = `
      <h3 style="margin-bottom:12px;">${escapeHtml(status.name)}</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">
        ${status.area}ha • ${status.species.length} species • ${status.latestWaterQuality ? `Last reading: ${status.latestWaterQuality.date}` : 'No water quality data'}
      </p>
    `;

    if (status.latestWaterQuality) {
      const wq = status.latestWaterQuality;
      html += `
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);margin-bottom:16px;">
          <strong>🌊 Latest Water Quality</strong>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;margin-top:6px;font-size:0.85rem;">
            <div>Temp: ${wq.temp}°C</div>
            <div>pH: ${wq.ph}</div>
            <div>Salinity: ${wq.salinity}ppt</div>
            <div>DO: ${wq.do}ppm</div>
            <div>Ammonia: ${wq.ammonia}ppm</div>
            ${wq.nitrate !== null ? `<div>Nitrate: ${wq.nitrate}ppm</div>` : ''}
            ${wq.nitrite !== null ? `<div>Nitrite: ${wq.nitrite}ppm</div>` : ''}
          </div>
        </div>
      `;
    }

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:16px;">`;
    for (const sp of status.species) {
      const color = sp.speciesColor || '#666';
      html += `
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);border-left:4px solid ${color};">
          <div style="font-weight:600;">${sp.speciesIcon || '🐟'} ${sp.speciesName}</div>
          <div style="font-size:0.85rem;color:var(--text-light);">
            Stocked: ${sp.originalStocked || 0}<br>
            ${sp.survival !== null ? `Survival: ${sp.survival}%` : 'No data'}<br>
            ${sp.fcr !== null ? `FCR: ${sp.fcr}` : 'No data'}<br>
            ${sp.totalRevenue > 0 ? `Revenue: ${formatCurrency(sp.totalRevenue)}` : 'No harvest'}
          </div>
          <div style="font-size:0.75rem;color:${sp.statusColor === 'red' ? '#e74c3c' : sp.statusColor === 'yellow' ? '#f39c12' : '#2ecc71'};margin-top:4px;">
            ${sp.statusText}
          </div>
        </div>
      `;
    }
    html += `</div>`;

    html += `
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #3498db;">
        <h4 style="margin-bottom:8px;">📋 Recommendations</h4>
        ${recs.dataWarning ? `<div style="font-size:0.85rem;color:#f39c12;margin-bottom:8px;">⚠️ ${recs.dataWarning}</div>` : ''}
        ${recs.decision.length > 0 ? `
          <div style="font-weight:600;font-size:0.95rem;">${recs.decision.join(' • ')}</div>
        ` : ''}
        ${recs.action.length > 0 ? `
          <ul style="margin-top:6px;padding-left:18px;font-size:0.9rem;">
            ${recs.action.map(a => `<li>${a}</li>`).join('')}
          </ul>
        ` : ''}
        ${recs.observations.length > 0 ? `
          <div style="margin-top:8px;font-size:0.85rem;color:var(--text-muted);">
            ${recs.observations.join(' • ')}
          </div>
        ` : ''}
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">
          Confidence: ${recs.confidence}
        </div>
      </div>
    `;

    if (status.species && status.species.length > 1) {
      const speciesIds = status.species.map(s => s.speciesId);
      const compatibility = getPolycultureRecommendation(speciesIds);
      const color = compatibility.recommendation.includes('✅') ? '#2ecc71' : 
                    compatibility.recommendation.includes('⚠️') ? '#f39c12' : '#e74c3c';
      html += `
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);border-left:4px solid ${color};">
          <h4 style="margin-bottom:4px;">🔄 Polyculture Status</h4>
          <div style="font-size:0.95rem;">${compatibility.recommendation}</div>
          ${compatibility.details ? `<div style="font-size:0.85rem;color:var(--text-muted);">${compatibility.details}</div>` : ''}
          ${compatibility.warnings && compatibility.warnings.length > 0 ? `
            <div style="font-size:0.85rem;color:#e74c3c;margin-top:4px;">${compatibility.warnings.join(' • ')}</div>
          ` : ''}
        </div>
      `;
    }

    html += `
      <div style="margin-top:12px;font-size:0.8rem;color:var(--text-muted);">
        ${status.dataCompleteness ? `${status.dataCompleteness.speciesCount} species • ${status.dataCompleteness.harvestedCount} harvested` : ''}
        ${status.netProfit !== undefined ? ` • Net: ${formatCurrency(status.netProfit)}` : ''}
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    console.error('Analysis error:', error);
    container.innerHTML = `<p style="color:var(--text-light);text-align:center;padding:40px 0;">Error loading analysis: ${error.message}</p>`;
  }
}

// ---- Render Decide (Full Decision Support with User-Configurable CBA) ----
export async function renderDecide(pondId) {
  const container = document.getElementById('decide-content');
  if (!container) return;

  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to get decision support.</p>';
    return;
  }

  try {
    const pond = await getById('ponds', pondId);
    if (!pond) {
      container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found.</p>';
      return;
    }

    const logs = await getByIndex('dailyLogs', 'pondId', pondId);
    const harvests = await getByIndex('harvests', 'pondId', pondId);
    const status = await getPondStatusOODA(pondId);

    let html = `
      <h3 style="margin-bottom:12px;">🧠 Decision Support - ${escapeHtml(pond.name)}</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">
        Data-driven decision tools for better farm management.
      </p>
    `;

    // ---- 1. Historical Averages ----
    const avgData = calculateHistoricalAverages(pond, logs, harvests);
    if (avgData && logs.length > 0) {
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #3498db;">
          <h4 style="margin-bottom:8px;">📊 Historical Averages</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">
            <div><small>Cycles</small><br><strong>${avgData.cycles || 0}</strong></div>
            ${avgData.avgFCR !== null ? `<div><small>Avg FCR</small><br><strong>${avgData.avgFCR}</strong></div>` : ''}
            ${avgData.avgSurvival !== null ? `<div><small>Avg Survival</small><br><strong>${avgData.avgSurvival}%</strong></div>` : ''}
            <div><small>Avg Feed Cost</small><br><strong>${formatCurrency(avgData.avgFeedCostPerCycle)}</strong></div>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">
            Based on ${avgData.cycles || 0} cycles and ${logs.length} log entries
          </div>
        </div>
      `;
    }

    // ---- 2. Pond Health Score ----
    const weights = { temp: 0.20, ph: 0.20, salinity: 0.10, do: 0.25, ammonia: 0.15, fcr: 0.10 };
    const health = calculatePondHealthScore(logs, weights);
    if (health) {
      const color = health.score >= 80 ? '#2ecc71' : health.score >= 65 ? '#f39c12' : '#e74c3c';
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid ${color};">
          <h4 style="margin-bottom:8px;">🏥 Pond Health Score</h4>
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="font-size:2.5rem;font-weight:700;color:${color};">${health.score}</div>
            <div>
              <div style="font-weight:600;">${health.rating}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);">${health.dataCompleteness}% data available</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:4px;margin-top:8px;">
            ${Object.entries(health.breakdown).map(([key, val]) => 
              `<div style="background:var(--bg);padding:4px 8px;border-radius:4px;text-align:center;font-size:0.7rem;">
                <div>${key}</div>
                <strong>${val}%</strong>
              </div>`
            ).join('')}
          </div>
          ${health.missingMetrics && health.missingMetrics.length > 0 ? `
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">
              Missing: ${health.missingMetrics.join(', ')}
            </div>
          ` : ''}
        </div>
      `;
    }

    // ---- 3. Reorder Point ----
    if (logs.length > 0) {
      let totalDailyFeed = 0;
      let logCount = 0;
      for (const log of logs) {
        if (log.speciesLogs) {
          for (const sp of log.speciesLogs) {
            totalDailyFeed += sp.feedAmount || 0;
          }
          logCount++;
        }
      }
      const dailyFeed = logCount > 0 ? totalDailyFeed / logCount : 0;
      
      if (dailyFeed > 0) {
        const reorder = calculateReorderPoint(dailyFeed, 5, 5);
        html += `
          <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #e67e22;">
            <h4 style="margin-bottom:8px;">📦 Feed Reorder Point</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">
              <div><small>Daily Feed</small><br><strong>${formatNumber(reorder.dailyConsumption, 1)} kg</strong></div>
              <div><small>Reorder Point</small><br><strong>${formatNumber(reorder.reorderPoint, 1)} kg</strong></div>
              <div><small>Safety Stock</small><br><strong>${formatNumber(reorder.safetyStock, 1)} kg</strong></div>
              <div><small>Lead Time</small><br><strong>${reorder.leadTimeDays} days</strong></div>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">
              Order more feed when inventory drops below ${formatNumber(reorder.reorderPoint, 1)} kg
            </div>
          </div>
        `;
      }
    }

    // ---- 4. Decision Matrix ----
    const currentWeight = status ? status.species.reduce((sum, s) => sum + (s.totalHarvestWeight || 0), 0) : 1000;
    const currentPrice = 140;
    
    const scenarios = [
      { label: 'Harvest Now', weight: currentWeight || 1000, price: currentPrice },
      { label: 'Wait 1 Week', weight: (currentWeight || 1000) * 1.05, price: currentPrice * 1.02 },
      { label: 'Wait 2 Weeks', weight: (currentWeight || 1000) * 1.10, price: currentPrice * 1.05 },
      { label: 'Wait 3 Weeks', weight: (currentWeight || 1000) * 1.15, price: currentPrice * 1.08 }
    ];

    const decisionMatrix = await generateDecisionMatrix(pond, logs, harvests, scenarios);
    
    if (decisionMatrix && decisionMatrix.matrix && decisionMatrix.matrix.length > 0) {
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #9b59b6;">
          <h4 style="margin-bottom:12px;">🎯 Decision Matrix</h4>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">Compare harvest timing options based on your risk preference:</p>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:12px;">
            <div style="background:var(--bg);padding:12px;border-radius:8px;border-left:4px solid #2ecc71;">
              <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Maximax (Risk-Taker)</div>
              <div style="font-weight:700;">${decisionMatrix.maximax ? decisionMatrix.maximax.label : 'N/A'}</div>
              <div style="font-size:0.9rem;">Profit: ${decisionMatrix.maximax ? formatCurrency(decisionMatrix.maximax.profit) : '—'}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;border-left:4px solid #f39c12;">
              <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Maximin (Risk-Averse)</div>
              <div style="font-weight:700;">${decisionMatrix.maximin ? decisionMatrix.maximin.label : 'N/A'}</div>
              <div style="font-size:0.9rem;">Worst-case: ${decisionMatrix.maximin ? formatCurrency(decisionMatrix.maximin.worstProfit) : '—'}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;border-left:4px solid #3498db;">
              <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Minimax (Minimize Regret)</div>
              <div style="font-weight:700;">${decisionMatrix.minimax ? decisionMatrix.minimax.label : 'N/A'}</div>
              <div style="font-size:0.9rem;">Regret: ${decisionMatrix.minimax ? formatCurrency(decisionMatrix.minimax.regret) : '—'}</div>
            </div>
          </div>
          
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
              <thead>
                <tr style="background:var(--primary);color:#fff;">
                  <th style="padding:6px 10px;text-align:left;">Option</th>
                  <th style="padding:6px 10px;text-align:right;">Harvest (kg)</th>
                  <th style="padding:6px 10px;text-align:right;">Price (₱/kg)</th>
                  <th style="padding:6px 10px;text-align:right;">Revenue</th>
                  <th style="padding:6px 10px;text-align:right;">Profit</th>
                  <th style="padding:6px 10px;text-align:right;">Regret</th>
                </tr>
              </thead>
              <tbody>
                ${decisionMatrix.matrix.map(m => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:6px 10px;">${m.label}</td>
                    <td style="padding:6px 10px;text-align:right;">${formatNumber(m.weight, 1)}</td>
                    <td style="padding:6px 10px;text-align:right;">₱${formatNumber(m.price, 2)}</td>
                    <td style="padding:6px 10px;text-align:right;">${formatCurrency(m.revenue)}</td>
                    <td style="padding:6px 10px;text-align:right;font-weight:600;">${formatCurrency(m.profit)}</td>
                    <td style="padding:6px 10px;text-align:right;">${formatCurrency(m.regret || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">
            💡 <strong>Recommendation:</strong> ${decisionMatrix.maximin ? decisionMatrix.maximin.label : 'N/A'} is safest (Maximin). ${decisionMatrix.maximax ? decisionMatrix.maximax.label : 'N/A'} gives highest potential profit (Maximax).
          </div>
        </div>
      `;
    }

    // ---- 5. USER-CONFIGURABLE COST-BENEFIT ANALYSIS ----
    // Calculate current profit to suggest a default benefit
    const currentProfit = status ? status.totalRevenue - status.totalCost : 0;
    const suggestedBenefit = currentProfit > 0 ? Math.round(currentProfit * 0.15) : 0;

    html += `
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #2ecc71;">
        <h4 style="margin-bottom:12px;">💰 Cost-Benefit Analysis</h4>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">
          Evaluate an investment decision. Enter the costs and expected benefits below.
        </p>
        
        <form id="cba-form">
          <div class="form-row">
            <div class="form-group">
              <label>Investment Cost (₱) *</label>
              <input type="number" id="cba-investment" step="1" value="15000" required placeholder="e.g., 15000">
              <span class="hint">Total cost of the investment (equipment, installation).</span>
            </div>
            <div class="form-group">
              <label>Expected Benefit per Cycle (₱) *</label>
              <input type="number" id="cba-benefit" step="1" value="${suggestedBenefit || 12000}" required placeholder="e.g., 12000">
              <span class="hint">Estimated additional profit per harvest cycle.</span>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Expected Lifespan (cycles)</label>
              <input type="number" id="cba-lifespan" step="1" value="3" min="1" max="20">
              <span class="hint">How many cycles the investment will last.</span>
            </div>
            <div class="form-group">
              <label>Discount Rate (%)</label>
              <input type="number" id="cba-discount" step="0.5" value="10" min="0" max="50">
              <span class="hint">Opportunity cost of capital (default: 10%).</span>
            </div>
          </div>
          <button type="submit" class="primary-btn" style="margin-top:4px;width:100%;">Calculate Analysis</button>
        </form>
        
        <div id="cba-results" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">
            <div><small>Investment</small><br><strong id="cba-result-investment">—</strong></div>
            <div><small>Annual Benefit</small><br><strong id="cba-result-benefit">—</strong></div>
            <div><small>NPV</small><br><strong id="cba-result-npv" style="color:#2ecc71;">—</strong></div>
            <div><small>Payback</small><br><strong id="cba-result-payback">—</strong></div>
            <div><small>ROI</small><br><strong id="cba-result-roi">—</strong></div>
            <div><small>Benefit-Cost Ratio</small><br><strong id="cba-result-bcr">—</strong></div>
          </div>
          <div style="font-size:0.85rem;font-weight:600;margin-top:8px;" id="cba-result-decision">
            Enter values above and click "Calculate Analysis".
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // ---- Attach CBA form handler ----
    document.getElementById('cba-form')?.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const investment = validateNumber(document.getElementById('cba-investment').value);
      const benefit = validateNumber(document.getElementById('cba-benefit').value);
      const lifespan = validateNumber(document.getElementById('cba-lifespan').value, 3);
      const discount = validateNumber(document.getElementById('cba-discount').value, 10) / 100;
      
      if (!investment || investment <= 0) {
        showMessage('log-message', 'Please enter a valid investment cost.', 'error');
        return;
      }
      if (!benefit || benefit <= 0) {
        showMessage('log-message', 'Please enter a valid expected benefit.', 'error');
        return;
      }
      
      const result = calculateCostBenefit(investment, benefit, lifespan, discount);
      
      const resultsDiv = document.getElementById('cba-results');
      resultsDiv.style.display = 'block';
      
      document.getElementById('cba-result-investment').textContent = formatCurrency(result.investmentCost);
      document.getElementById('cba-result-benefit').textContent = formatCurrency(result.annualBenefit);
      
      const npvEl = document.getElementById('cba-result-npv');
      npvEl.textContent = formatCurrency(result.npv);
      npvEl.style.color = result.npv > 0 ? '#2ecc71' : '#e74c3c';
      
      document.getElementById('cba-result-payback').textContent = `${result.paybackPeriod} cycles`;
      
      const roiEl = document.getElementById('cba-result-roi');
      roiEl.textContent = `${result.roi}%`;
      roiEl.style.color = result.roi > 100 ? '#2ecc71' : result.roi > 50 ? '#f39c12' : '#e74c3c';
      
      document.getElementById('cba-result-bcr').textContent = result.benefitCostRatio.toFixed(2);
      
      const decisionEl = document.getElementById('cba-result-decision');
      if (result.recommended) {
        decisionEl.innerHTML = '✅ <strong>Recommended</strong> — Positive net value. The investment pays for itself in ' + result.paybackPeriod + ' cycles and generates ₱' + formatNumber(result.npv, 0) + ' in net value.';
        decisionEl.style.color = '#2ecc71';
      } else {
        decisionEl.innerHTML = '❌ <strong>Not Recommended</strong> — Negative net value. The investment does not pay for itself within its expected lifespan.';
        decisionEl.style.color = '#e74c3c';
      }
      
      showMessage('log-message', 'Cost-benefit analysis complete!', 'success');
    });

  } catch (error) {
    console.error('Decide error:', error);
    container.innerHTML = `<p style="color:var(--text-light);text-align:center;padding:40px 0;">Error loading decision support: ${error.message}</p>`;
  }
}

// ---- Render Help ----
export function renderHelp() {
  const container = document.getElementById('help-content');
  if (!container) return;
  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <h2 style="margin-bottom:16px;">Help & FAQ</h2>
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #3498db;">
        <h3 style="margin-bottom:8px;color:#3498db;">Getting Started</h3>
        <p><strong>Q: How do I start using the app?</strong></p>
        <p>A: First, add a pond using the Dashboard. Select species and stocking details.</p>
        <p style="margin-top:8px;"><strong>Q: Can I have multiple species in one pond?</strong></p>
        <p>A: Yes! When adding a pond, you can add multiple species for polyculture.</p>
        <p style="margin-top:8px;"><strong>Q: What's the sample data?</strong></p>
        <p>A: Go to Settings → Load Sample Data. Creates a demo pond with multiple species.</p>
      </div>
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #2ecc71;">
        <h3 style="margin-bottom:8px;color:#2ecc71;">Species & Polyculture</h3>
        <p><strong>Q: What species are supported?</strong></p>
        <p>A: Bangus, Saline-Tolerant Tilapia, SPIN YY Tilapia, Shrimp, Mud Crab, and Oyster.</p>
        <p style="margin-top:8px;"><strong>Q: Can I track different species separately?</strong></p>
        <p>A: Yes. Each log entry has species-specific sections for weight, mortality, and feed.</p>
      </div>
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #f39c12;">
        <h3 style="margin-bottom:8px;color:#f39c12;">Data Safety</h3>
        <p><strong>Q: How do I back up my data?</strong></p>
        <p>A: Go to Settings → Export Data. Save the JSON file to your computer.</p>
        <p style="margin-top:8px;"><strong>Q: What happens if I clear my browser cache?</strong></p>
        <p>A: Your data will be lost. Always export regularly!</p>
      </div>
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #9b59b6;">
        <h3 style="margin-bottom:8px;color:#9b59b6;">Cost-Benefit Analysis</h3>
        <p><strong>Q: How does the Cost-Benefit Analysis work?</strong></p>
        <p>A: Enter the investment cost, expected benefit per cycle, lifespan, and discount rate. The app calculates NPV, payback period, ROI, and benefit-cost ratio.</p>
        <p style="margin-top:8px;"><strong>Q: What is NPV?</strong></p>
        <p>A: Net Present Value — the total value of the investment in today's pesos. Positive NPV means the investment is worthwhile.</p>
        <p style="margin-top:8px;"><strong>Q: What discount rate should I use?</strong></p>
        <p>A: Use 10% as a default. This represents the opportunity cost of your capital (what you could earn elsewhere).</p>
      </div>
    </div>
  `;
}

// ---- Export CSV ----
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    showMessage('log-message', 'No data to export.', 'error');
    return;
  }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showMessage('log-message', 'CSV exported!', 'success');
}

// ---- Print Report ----
export function printReport() {
  window.print();
}

// ---- Delete Functions ----
export async function deleteLog(logId) {
  if (!confirm('Delete this log entry?')) return;
  await remove('dailyLogs', logId);
  await renderPondList();
  showMessage('log-message', 'Log deleted.', 'info');
}

// ---- Expose to window ----
window.editPond = editPond;
window.deleteLog = deleteLog;
window.printReport = printReport;
window.showMessage = showMessage;
window.deleteHarvest = window.deleteHarvest;
window.editHarvest = window.editHarvest;

console.log('✅ ui.js loaded with all exports and decision support');
