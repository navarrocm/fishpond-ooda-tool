// ============================================================
// UI HELPERS - Complete with All Exports
// ============================================================

import { getAll, getByIndex, add, update, remove, getById, exportAllData } from './db.js';
import { getSpeciesTotals, getSpeciesLogFromEntry } from './db.js';
import { getSpecies, getSpeciesList, getSpeciesName, getSpeciesIcon, getSpeciesColor } from './species.js';
import { escapeHtml, formatCurrency, formatNumber, validateNumber } from './utils.js';

// ============================================================
// EXPORT ALL FUNCTIONS (DECLARED AT TOP FOR CLARITY)
// ============================================================

// ---- Tab Navigation ----
export function showTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
}

// ---- Messages ----
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

// ---- Show Pond Detail ----
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
  
  // Reuse add species logic
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

// ---- Render Analysis ----
export async function renderAnalysis(pondId) {
  const container = document.getElementById('analysis-content');
  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to analyze.</p>';
    return;
  }
  const pond = await getById('ponds', pondId);
  if (!pond) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found.</p>';
    return;
  }
  
  let html = `<h3 style="margin-bottom:12px;">${escapeHtml(pond.name)}</h3>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:16px;">`;
  
  if (pond.species && pond.species.length > 0) {
    for (const sp of pond.species) {
      const species = getSpecies(sp.speciesId);
      const totals = await getSpeciesTotals(pondId, sp.speciesId);
      const color = species ? species.color : '#666';
      html += `
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);border-left:4px solid ${color};">
          <div style="font-weight:600;">${species ? species.icon : '🐟'} ${getSpeciesName(sp.speciesId)}</div>
          <div style="font-size:0.85rem;color:var(--text-light);">
            Stocked: ${sp.fingerlings || 0}<br>
            ${totals.survival !== null ? `Survival: ${totals.survival}%` : 'No data'}<br>
            ${totals.fcr !== null ? `FCR: ${totals.fcr}` : 'No data'}<br>
            ${totals.totalRevenue > 0 ? `Revenue: ${formatCurrency(totals.totalRevenue)}` : 'No harvest'}
          </div>
        </div>
      `;
    }
  } else {
    html += '<p style="color:var(--text-light);">No species data available.</p>';
  }
  
  html += `</div>`;
  container.innerHTML = html;
}

// ---- Render Decide ----
export async function renderDecide(pondId) {
  const container = document.getElementById('decide-content');
  if (!container) return;
  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to get decision support.</p>';
    return;
  }
  const pond = await getById('ponds', pondId);
  if (!pond) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found.</p>';
    return;
  }
  
  let html = `<h3 style="margin-bottom:12px;">${escapeHtml(pond.name)} - Decision Support</h3>`;
  html += `<p style="color:var(--text-muted);margin-bottom:16px;">Species-specific recommendations based on current data.</p>`;
  
  if (pond.species && pond.species.length > 0) {
    for (const sp of pond.species) {
      const species = getSpecies(sp.speciesId);
      const totals = await getSpeciesTotals(pondId, sp.speciesId);
      const color = species ? species.color : '#666';
      html += `
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);margin-bottom:12px;border-left:4px solid ${color};">
          <div style="font-weight:600;font-size:1.1rem;">${species ? species.icon : '🐟'} ${getSpeciesName(sp.speciesId)}</div>
          <div style="font-size:0.9rem;color:var(--text-light);margin-top:4px;">
            ${totals.survival !== null && species ? (totals.survival < species.targetSurvival ? '⚠️ Survival below target' : '✅ Survival on track') : '📊 No survival data'}
            ${totals.fcr !== null && species && species.targetFCR ? (totals.fcr > species.targetFCR ? '⚠️ FCR above target' : '✅ FCR on track') : ''}
          </div>
          ${species ? `
            <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">
              Target Survival: ${species.targetSurvival}% • Target FCR: ${species.targetFCR || 'N/A'}
            </div>
          ` : ''}
          ${totals.totalRevenue > 0 ? `<div style="font-size:0.85rem;color:var(--text-muted);">Revenue: ${formatCurrency(totals.totalRevenue)}</div>` : ''}
        </div>
      `;
    }
  } else {
    html += '<p style="color:var(--text-light);">No species data available.</p>';
  }
  
  container.innerHTML = html;
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

// ---- Delete Harvest ----
window.deleteHarvest = async function(harvestId) {
  if (!confirm('Delete this harvest record?')) return;
  await remove('harvests', harvestId);
  const harvestPond = document.getElementById('harvest-pond');
  if (harvestPond) await renderHarvestList(harvestPond.value);
  await renderPondList();
  showMessage('harvest-message', 'Harvest record deleted.', 'info');
};

// ---- Edit Harvest ----
window.editHarvest = async function(harvestId) {
  // Simplified - just alert for now
  alert('Edit harvest: Click the edit button on a harvest record to modify it.');
};

// ---- Expose functions to window ----
window.editPond = editPond;
window.deleteLog = deleteLog;
window.deletePond = window.deletePond;
window.deleteHarvest = window.deleteHarvest;
window.editHarvest = window.editHarvest;
window.printReport = printReport;
window.showMessage = showMessage;
window.renderPondList = renderPondList;
window.updateSelectors = updateSelectors;
window.renderHarvestList = renderHarvestList;
window.renderAnalysis = renderAnalysis;
window.renderDecide = renderDecide;
window.renderHelp = renderHelp;

// ---- Log that UI is loaded ----
console.log('✅ ui.js loaded with all exports');
