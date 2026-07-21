// ============================================================
// UI HELPERS - Complete with All Features
// ============================================================

import { getAll, getByIndex, add, update, remove, exportAllData } from './db.js';
import { getPondStatus, generateRecommendations, getPhase } from './ooda.js';
import { escapeHtml, formatCurrency, formatNumber, validateNumber, validateRange } from './utils.js';

// ============================================================
// TAB NAVIGATION
// ============================================================

export function showTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
}

// ============================================================
// MESSAGES
// ============================================================

export function showMessage(target, message, type = 'success') {
  const el = document.getElementById(target);
  if (!el) return;
  el.textContent = message;
  el.className = `message show ${type}`;
  setTimeout(() => {
    el.className = 'message';
  }, 5000);
}

// ============================================================
// POND LIST
// ============================================================

export async function renderPondList() {
  const container = document.getElementById('pond-list');
  if (!container) return;
  const ponds = await getAll('ponds');
  if (ponds.length === 0) {
    container.innerHTML = `<p style="color:var(--text-light);text-align:center;padding:40px 0;">No ponds yet. Click "Add Pond" to get started. Load sample data in Settings → Help.</p>`;
    return;
  }
  let html = '';
  for (const pond of ponds) {
    const logs = await getByIndex('dailyLogs', 'pondId', pond.id);
    const harvests = await getByIndex('harvests', 'pondId', pond.id);
    const status = getPondStatus(pond, logs, harvests);
    const name = escapeHtml(pond.name || 'Unnamed Pond');
    const species = escapeHtml(pond.species || 'Bangus');
    const area = formatNumber(pond.area, 2);
    html += `
      <div class="pond-card" data-pond-id="${escapeHtml(pond.id)}">
        <div class="name">${name}</div>
        <div class="species">${species} • ${area}ha</div>
        <span class="status ${status.statusColor}">${escapeHtml(status.statusText)}</span>
        ${status.hasHarvest ? `<span class="harvested-badge">Harvested</span>` : ''}
        <div class="metric">${status.hasHarvest ? 'Done' : `Day ${status.daysInCycle} • ${status.phase.label}`}</div>
        ${status.fcr !== null ? `<div class="metric">FCR: <span>${status.fcr}</span></div>` : ''}
        ${status.survival !== null ? `<div class="metric">Survival: <span>${status.survival}%</span></div>` : ''}
        ${status.roi !== null ? `<div class="metric">ROI: <span>${status.roi}%</span></div>` : ''}
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

// ============================================================
// POND DETAIL
// ============================================================

export async function showPondDetail(pondId) {
  const allPonds = await getAll('ponds');
  const pond = allPonds.find(p => p.id === pondId);
  if (!pond) return;
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  const status = getPondStatus(pond, logs, harvests);
  const recs = generateRecommendations(pond, logs, harvests);
  const container = document.getElementById('pond-detail');
  container.style.display = 'block';
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
      <div><strong>Species:</strong> ${escapeHtml(pond.species)}</div>
      <div><strong>Area:</strong> ${formatNumber(pond.area, 2)}ha</div>
      <div><strong>Stocked:</strong> ${pond.fingerlings || 0}</div>
      <div><strong>Alive:</strong> ${status.currentAlive}</div>
      ${status.hasHarvest ? `<div><strong>Status:</strong> Harvested</div>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-bottom:12px;background:var(--bg);padding:12px;border-radius:8px;">
      ${status.fcr !== null ? `<div><small>FCR</small><br><strong>${status.fcr}</strong></div>` : ''}
      ${status.survival !== null ? `<div><small>Survival</small><br><strong>${status.survival}%</strong></div>` : ''}
      ${status.dgr !== null ? `<div><small>DGR</small><br><strong>${status.dgr}g/d</strong></div>` : ''}
      ${status.roi !== null ? `<div><small>ROI</small><br><strong>${status.roi}%</strong></div>` : ''}
      ${status.breakEven !== null ? `<div><small>Break-even</small><br><strong>₱${status.breakEven}/kg</strong></div>` : ''}
    </div>
    <div style="background:var(--card-bg);padding:12px;border-radius:8px;border-left:4px solid var(--primary);">
      <strong>${escapeHtml(recs.decision[0] || 'No decision yet')}</strong>
      <ul style="margin-top:6px;font-size:0.9rem;padding-left:18px;">
        ${recs.action.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
      </ul>
      ${recs.observations.length > 0 ? `<div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted);">${recs.observations.map(o => escapeHtml(o)).join('; ')}</div>` : ''}
    </div>
    ${logs.length > 0 ? `
      <div style="margin-top:12px;">
        <strong>Log Entries (${logs.length})</strong>
        <div style="max-height:200px;overflow-y:auto;margin-top:8px;">
          ${logs.slice(-10).reverse().map(l => `
            <div class="harvest-item" style="font-size:0.85rem;">
              <div class="info">
                ${l.date} • Temp: ${l.temp}°C • pH: ${l.ph} • DO: ${l.do}ppm
                ${l.weight ? ` • Weight: ${l.weight}g` : ''}
              </div>
              <div class="actions">
                <button onclick="window.editLog('${l.id}')" class="small-btn edit">Edit</button>
                <button onclick="window.deleteLog('${l.id}')" class="small-btn delete">Del</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${harvests.length > 0 ? `
      <div style="margin-top:12px;">
        <strong>Harvest Records (${harvests.length})</strong>
        ${harvests.map(h => `
          <div class="harvest-item">
            <div class="info">
              ${new Date(h.date).toLocaleDateString()} • 
              <strong>${formatNumber(h.weight, 1)}kg</strong> @ 
              ₱${formatNumber(h.price, 2)}/kg = 
              <strong>₱${formatNumber(h.revenue, 0)}</strong>
              ${h.buyer ? ` • ${escapeHtml(h.buyer)}` : ''}
            </div>
            <div class="actions">
              <button onclick="window.editHarvest('${h.id}')" class="small-btn edit">Edit</button>
              <button onclick="window.deleteHarvest('${escapeHtml(h.id)}')" class="small-btn delete">Del</button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

// ============================================================
// ADD POND MODAL
// ============================================================

export function showAddPondModal() {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';
  body.innerHTML = `
    <h2>Add New Pond</h2>
    <form id="add-pond-form">
      <div class="form-group"><label>Pond Name *</label><input type="text" id="pond-name" required placeholder="e.g., West Pond"></div>
      <div class="form-row">
        <div class="form-group"><label>Species *</label><input type="text" id="pond-species" placeholder="Bangus" value="Bangus" required></div>
        <div class="form-group"><label>Area (hectares) *</label><input type="number" id="pond-area" step="0.01" required placeholder="0.5"></div>
      </div>
      <div class="form-group"><label>Location</label><input type="text" id="pond-location" placeholder="Region/Province/Municipality"></div>
      <div class="form-row">
        <div class="form-group"><label>Fingerlings Stocked *</label><input type="number" id="pond-fingerlings" required placeholder="0"></div>
        <div class="form-group"><label>Stocking Date *</label><input type="date" id="pond-stocking-date" required></div>
      </div>
      <div class="form-group">
        <label>Stocking Weight (g)</label>
        <input type="number" id="pond-stocking-weight" step="0.1" placeholder="5">
        <span class="hint">Average weight of fingerlings at stocking</span>
      </div>
      <button type="submit" class="primary-btn" style="width:100%;margin-top:10px;">Add Pond</button>
    </form>
  `;
  document.getElementById('add-pond-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pond = {
      name: document.getElementById('pond-name').value.trim(),
      species: document.getElementById('pond-species').value.trim() || 'Bangus',
      area: validateNumber(document.getElementById('pond-area').value, 0),
      location: document.getElementById('pond-location').value.trim() || '',
      fingerlings: validateNumber(document.getElementById('pond-fingerlings').value, 0),
      stockingDate: document.getElementById('pond-stocking-date').value || new Date().toISOString().split('T')[0],
      stockingWeight: validateNumber(document.getElementById('pond-stocking-weight').value, 0),
      harvested: false,
      createdAt: new Date().toISOString()
    };
    if (!pond.name || !pond.area || !pond.fingerlings) {
      alert('Please fill in all required fields.');
      return;
    }
    await add('ponds', pond);
    modal.style.display = 'none';
    await renderPondList();
    updateSelectors();
    showMessage('log-message', 'Pond added successfully!', 'success');
  });
}

// ============================================================
// EDIT POND
// ============================================================

export async function editPond(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';
  body.innerHTML = `
    <h2>Edit Pond</h2>
    <form id="edit-pond-form">
      <input type="hidden" id="edit-pond-id" value="${pond.id}">
      <div class="form-group"><label>Pond Name *</label><input type="text" id="edit-pond-name" value="${escapeHtml(pond.name)}" required></div>
      <div class="form-row">
        <div class="form-group"><label>Species *</label><input type="text" id="edit-pond-species" value="${escapeHtml(pond.species)}" required></div>
        <div class="form-group"><label>Area (hectares) *</label><input type="number" id="edit-pond-area" step="0.01" value="${pond.area}" required></div>
      </div>
      <div class="form-group"><label>Location</label><input type="text" id="edit-pond-location" value="${escapeHtml(pond.location || '')}"></div>
      <div class="form-row">
        <div class="form-group"><label>Fingerlings Stocked *</label><input type="number" id="edit-pond-fingerlings" value="${pond.fingerlings}" required></div>
        <div class="form-group"><label>Stocking Date *</label><input type="date" id="edit-pond-stocking-date" value="${pond.stockingDate}" required></div>
      </div>
      <div class="form-group">
        <label>Stocking Weight (g)</label>
        <input type="number" id="edit-pond-stocking-weight" step="0.1" value="${pond.stockingWeight || 0}">
      </div>
      <button type="submit" class="primary-btn" style="width:100%;margin-top:10px;">Update Pond</button>
    </form>
  `;
  document.getElementById('edit-pond-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
      ...pond,
      name: document.getElementById('edit-pond-name').value.trim(),
      species: document.getElementById('edit-pond-species').value.trim() || 'Bangus',
      area: validateNumber(document.getElementById('edit-pond-area').value, 0),
      location: document.getElementById('edit-pond-location').value.trim() || '',
      fingerlings: validateNumber(document.getElementById('edit-pond-fingerlings').value, 0),
      stockingDate: document.getElementById('edit-pond-stocking-date').value || pond.stockingDate,
      stockingWeight: validateNumber(document.getElementById('edit-pond-stocking-weight').value, 0)
    };
    if (!updated.name || !updated.area || !updated.fingerlings) {
      alert('Please fill in all required fields.');
      return;
    }
    await update('ponds', updated);
    modal.style.display = 'none';
    await renderPondList();
    updateSelectors();
    showMessage('log-message', 'Pond updated!', 'success');
  });
}

// ============================================================
// EDIT LOG
// ============================================================

export async function editLog(logId) {
  const log = await getById('dailyLogs', logId);
  if (!log) return;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';
  body.innerHTML = `
    <h2>Edit Log Entry</h2>
    <form id="edit-log-form">
      <input type="hidden" id="edit-log-id" value="${log.id}">
      <div class="form-row">
        <div class="form-group"><label>Date *</label><input type="date" id="edit-log-date" value="${log.date}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Temperature (°C)</label><input type="number" id="edit-log-temp" step="0.1" value="${log.temp || ''}" required></div>
        <div class="form-group"><label>pH</label><input type="number" id="edit-log-ph" step="0.1" value="${log.ph || ''}" required></div>
        <div class="form-group"><label>Salinity (ppt)</label><input type="number" id="edit-log-salinity" step="0.1" value="${log.salinity || ''}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>DO (ppm)</label><input type="number" id="edit-log-do" step="0.1" value="${log.do || ''}" required></div>
        <div class="form-group"><label>Ammonia (ppm)</label><input type="number" id="edit-log-ammonia" step="0.01" value="${log.ammonia || ''}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Feed Amount (kg)</label><input type="number" id="edit-log-feed-amount" step="0.1" value="${log.feedAmount || 0}"></div>
        <div class="form-group"><label>Feed Cost (₱)</label><input type="number" id="edit-log-feed-cost" step="1" value="${log.feedCost || 0}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Mortality</label><input type="number" id="edit-log-mortality" value="${log.mortality || 0}"></div>
        <div class="form-group"><label>Weather</label>
          <select id="edit-log-weather">
            <option value="Sunny" ${log.weather === 'Sunny' ? 'selected' : ''}>Sunny</option>
            <option value="Rainy" ${log.weather === 'Rainy' ? 'selected' : ''}>Rainy</option>
            <option value="Cloudy" ${log.weather === 'Cloudy' ? 'selected' : ''}>Cloudy</option>
            <option value="Stormy" ${log.weather === 'Stormy' ? 'selected' : ''}>Stormy</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Sample Weight (g)</label><input type="number" id="edit-log-weight" step="0.1" value="${log.weight || 0}"></div>
        <div class="form-group"><label>Cause (if mortality)</label><input type="text" id="edit-log-cause" value="${escapeHtml(log.cause || '')}"></div>
      </div>
      <div class="form-group"><label>Notes</label><input type="text" id="edit-log-notes" value="${escapeHtml(log.notes || '')}"></div>
      <button type="submit" class="primary-btn" style="width:100%;margin-top:10px;">Update Log</button>
    </form>
  `;
  document.getElementById('edit-log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
      ...log,
      date: document.getElementById('edit-log-date').value,
      temp: validateNumber(document.getElementById('edit-log-temp').value),
      ph: validateNumber(document.getElementById('edit-log-ph').value),
      salinity: validateNumber(document.getElementById('edit-log-salinity').value),
      do: validateNumber(document.getElementById('edit-log-do').value),
      ammonia: validateNumber(document.getElementById('edit-log-ammonia').value),
      feedAmount: validateNumber(document.getElementById('edit-log-feed-amount').value, 0),
      feedCost: validateNumber(document.getElementById('edit-log-feed-cost').value, 0),
      mortality: validateNumber(document.getElementById('edit-log-mortality').value, 0),
      weather: document.getElementById('edit-log-weather').value,
      weight: validateNumber(document.getElementById('edit-log-weight').value, 0),
      cause: document.getElementById('edit-log-cause').value.trim() || '',
      notes: document.getElementById('edit-log-notes').value.trim() || ''
    };
    await update('dailyLogs', updated);
    modal.style.display = 'none';
    await renderPondList();
    showMessage('log-message', 'Log updated!', 'success');
  });
}

// ============================================================
// EDIT HARVEST
// ============================================================

export async function editHarvest(harvestId) {
  const harvest = await getById('harvests', harvestId);
  if (!harvest) return;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';
  body.innerHTML = `
    <h2>Edit Harvest Record</h2>
    <form id="edit-harvest-form">
      <input type="hidden" id="edit-harvest-id" value="${harvest.id}">
      <div class="form-row">
        <div class="form-group"><label>Date *</label><input type="date" id="edit-harvest-date" value="${harvest.date}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Weight (kg) *</label><input type="number" id="edit-harvest-weight" step="0.1" value="${harvest.weight}" required></div>
        <div class="form-group"><label>Price (₱/kg) *</label><input type="number" id="edit-harvest-price" step="0.01" value="${harvest.price}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Revenue (₱)</label><input type="number" id="edit-harvest-revenue" step="1" value="${harvest.revenue}"></div>
        <div class="form-group"><label>Buyer</label><input type="text" id="edit-harvest-buyer" value="${escapeHtml(harvest.buyer || '')}"></div>
      </div>
      <div class="form-group"><label>Notes</label><input type="text" id="edit-harvest-notes" value="${escapeHtml(harvest.notes || '')}"></div>
      <button type="submit" class="primary-btn" style="width:100%;margin-top:10px;">Update Harvest</button>
    </form>
  `;
  document.getElementById('edit-harvest-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const weight = validateNumber(document.getElementById('edit-harvest-weight').value);
    const price = validateNumber(document.getElementById('edit-harvest-price').value);
    let revenue = validateNumber(document.getElementById('edit-harvest-revenue').value);
    if (revenue === null || revenue <= 0) {
      revenue = Math.round(weight * price);
    }
    const updated = {
      ...harvest,
      date: document.getElementById('edit-harvest-date').value,
      weight: weight,
      price: price,
      revenue: revenue,
      buyer: document.getElementById('edit-harvest-buyer').value.trim() || '',
      notes: document.getElementById('edit-harvest-notes').value.trim() || ''
    };
    await update('harvests', updated);
    modal.style.display = 'none';
    await renderPondList();
    showMessage('harvest-message', 'Harvest updated!', 'success');
  });
}

// ============================================================
// DELETE LOG
// ============================================================

window.deleteLog = async function(logId) {
  if (!confirm('Delete this log entry?')) return;
  await remove('dailyLogs', logId);
  await renderPondList();
  showMessage('log-message', 'Log deleted.', 'info');
};

// ============================================================
// UPDATE SELECTORS
// ============================================================

export async function updateSelectors() {
  const ponds = await getAll('ponds');
  const selectors = ['log-pond', 'harvest-pond', 'analysis-pond', 'decide-pond'];
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

// ============================================================
// HARVEST LIST
// ============================================================

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

// ============================================================
// ANALYSIS
// ============================================================

export async function renderAnalysis(pondId) {
  const container = document.getElementById('analysis-content');
  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to analyze.</p>';
    return;
  }
  const allPonds = await getAll('ponds');
  const pond = allPonds.find(p => p.id === pondId);
  if (!pond) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found.</p>';
    return;
  }
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  const status = getPondStatus(pond, logs, harvests);
  const recs = generateRecommendations(pond, logs, harvests);

  const metricsHtml = `
    <div class="metric-card"><div class="value">${status.fcr !== null ? status.fcr : '—'}</div><div class="label">FCR</div></div>
    <div class="metric-card"><div class="value">${status.survival !== null ? status.survival + '%' : '—'}</div><div class="label">Survival</div></div>
    <div class="metric-card"><div class="value">${status.dgr !== null ? status.dgr + 'g' : '—'}</div><div class="label">DGR</div></div>
    <div class="metric-card"><div class="value">${status.roi !== null ? status.roi + '%' : '—'}</div><div class="label">ROI</div></div>
    <div class="metric-card"><div class="value">${status.hasHarvest ? 'Done' : 'Day ' + status.daysInCycle}</div><div class="label">${status.phase.label}</div></div>
    <div class="metric-card"><div class="value">${status.currentAlive}</div><div class="label">Alive</div></div>
    ${status.breakEven !== null ? `<div class="metric-card"><div class="value">₱${status.breakEven}</div><div class="label">Break-even/kg</div></div>` : ''}
    ${status.totalRevenue > 0 ? `<div class="metric-card"><div class="value">₱${formatNumber(status.totalRevenue, 0)}</div><div class="label">Revenue</div></div>` : ''}
  `;

  const recClass = status.statusColor === 'red' ? 'danger' : status.statusColor === 'yellow' ? 'warning' : '';
  const recHtml = `
    <div class="recommendation-box ${recClass}">
      <strong>${escapeHtml(recs.decision[0] || 'No recommendation yet')}</strong>
      <ul>${recs.action.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
      <div class="confidence">Confidence: ${recs.confidence} • ${recs.observations.length > 0 ? recs.observations.map(o => escapeHtml(o)).join('; ') : ''}</div>
    </div>
  `;

  container.innerHTML = `
    <div class="metrics-grid">${metricsHtml}</div>
    ${recHtml}
    <div style="margin-top:16px;background:var(--card-bg);padding:12px;border-radius:8px;">
      <strong>Orientation</strong>
      <ul style="padding-left:18px;font-size:0.9rem;">${recs.orientation.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>
    </div>
    <div style="margin-top:12px;font-size:0.8rem;color:var(--text-muted);">${logs.length} log entries • ${harvests.length} harvests</div>
  `;
}

// ============================================================
// DECIDE (Decision Support)
// ============================================================

export async function renderDecide(pondId) {
  const container = document.getElementById('decide-content');
  if (!container) return;
  
  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to get decision support.</p>';
    return;
  }
  
  const allPonds = await getAll('ponds');
  const pond = allPonds.find(p => p.id === pondId);
  if (!pond) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found.</p>';
    return;
  }
  
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  const status = getPondStatus(pond, logs, harvests);
  
  try {
    const { 
      generateDecisionMatrix, calculateCostBenefit, calculateReorderPoint,
      calculatePondHealthScore, calculateHistoricalAverages
    } = await import('./decide.js');
    
    let html = '';
    
    // Historical Averages
    const avgData = calculateHistoricalAverages(pond, logs, harvests);
    if (avgData && logs.length > 0) {
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #3498db;">
          <h3 style="margin-bottom:8px;">Historical Averages</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">
            <div><small>Cycles</small><br><strong>${avgData.cycles || 0}</strong></div>
            ${avgData.avgFCR !== null ? `<div><small>Avg FCR</small><br><strong>${avgData.avgFCR}</strong></div>` : ''}
            ${avgData.avgSurvival !== null ? `<div><small>Avg Survival</small><br><strong>${avgData.avgSurvival}%</strong></div>` : ''}
            <div><small>Avg Feed Cost</small><br><strong>${formatCurrency(avgData.avgFeedCostPerCycle)}</strong></div>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">Based on ${avgData.cycles || 0} cycles and ${logs.length} log entries</div>
        </div>
      `;
    }
    
    // Pond Health Score
    const weights = { temp: 0.20, ph: 0.20, salinity: 0.10, do: 0.25, ammonia: 0.15, fcr: 0.10 };
    const health = calculatePondHealthScore(logs, weights);
    if (health) {
      const color = health.score >= 80 ? '#2ecc71' : health.score >= 65 ? '#f39c12' : '#e74c3c';
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid ${color};">
          <h3 style="margin-bottom:8px;">Pond Health Score</h3>
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="font-size:2.5rem;font-weight:700;color:${color};">${health.score}</div>
            <div><div style="font-weight:600;">${health.rating}</div><div style="font-size:0.8rem;color:var(--text-muted);">Weighted average of water quality factors</div></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:4px;margin-top:8px;">
            ${Object.entries(health.breakdown).map(([key, val]) => 
              `<div style="background:var(--bg);padding:4px 8px;border-radius:4px;text-align:center;font-size:0.7rem;"><div>${key}</div><strong>${val}%</strong></div>`
            ).join('')}
          </div>
        </div>
      `;
    }
    
    // Reorder Point
    if (logs.length > 0) {
      const dailyFeed = logs.reduce((s, l) => s + validateNumber(l.feedAmount, 0), 0) / Math.max(1, logs.length);
      if (dailyFeed > 0) {
        const reorder = calculateReorderPoint(dailyFeed, 5, 5);
        html += `
          <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #e67e22;">
            <h3 style="margin-bottom:8px;">Feed Reorder Point</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">
              <div><small>Daily Feed</small><br><strong>${formatNumber(reorder.dailyConsumption, 1)} kg</strong></div>
              <div><small>Reorder Point</small><br><strong>${formatNumber(reorder.reorderPoint, 1)} kg</strong></div>
              <div><small>Safety Stock</small><br><strong>${formatNumber(reorder.safetyStock, 1)} kg</strong></div>
              <div><small>Lead Time</small><br><strong>${reorder.leadTimeDays} days</strong></div>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">Order more feed when inventory drops below ${formatNumber(reorder.reorderPoint, 1)} kg</div>
          </div>
        `;
      }
    }
    
    // Decision Matrix
    const currentWeight = status.totalWeightGain > 0 ? status.totalWeightGain : 1000;
    const currentPrice = 140;
    const scenarios = [
      { label: 'Harvest Now', weight: currentWeight, price: currentPrice },
      { label: 'Wait 1 Week', weight: currentWeight * 1.05, price: currentPrice * 1.02 },
      { label: 'Wait 2 Weeks', weight: currentWeight * 1.10, price: currentPrice * 1.05 },
      { label: 'Wait 3 Weeks', weight: currentWeight * 1.15, price: currentPrice * 1.08 }
    ];
    
    const decisionMatrix = generateDecisionMatrix(pond, logs, harvests, scenarios);
    if (decisionMatrix) {
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #9b59b6;">
          <h3 style="margin-bottom:12px;">Decision Matrix</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">Compare harvest timing options based on your risk preference:</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:12px;">
            <div style="background:var(--bg);padding:12px;border-radius:8px;border-left:4px solid #2ecc71;">
              <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Maximax (Risk-Taker)</div>
              <div style="font-weight:700;">${decisionMatrix.maximax.label}</div>
              <div style="font-size:0.9rem;">Profit: ${formatCurrency(decisionMatrix.maximax.profit)}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;border-left:4px solid #f39c12;">
              <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Maximin (Risk-Averse)</div>
              <div style="font-weight:700;">${decisionMatrix.maximin.label}</div>
              <div style="font-size:0.9rem;">Worst-case: ${formatCurrency(decisionMatrix.maximin.worstProfit)}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;border-left:4px solid #3498db;">
              <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Minimax (Minimize Regret)</div>
              <div style="font-weight:700;">${decisionMatrix.minimax.label}</div>
              <div style="font-size:0.9rem;">Regret: ${formatCurrency(decisionMatrix.minimax.regret)}</div>
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
              <thead><tr style="background:var(--primary);color:#fff;">
                <th style="padding:6px 10px;text-align:left;">Option</th>
                <th style="padding:6px 10px;text-align:right;">Harvest (kg)</th>
                <th style="padding:6px 10px;text-align:right;">Price (₱/kg)</th>
                <th style="padding:6px 10px;text-align:right;">Revenue</th>
                <th style="padding:6px 10px;text-align:right;">Profit</th>
                <th style="padding:6px 10px;text-align:right;">Regret</th>
              </tr></thead>
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
            <strong>Recommendation:</strong> ${decisionMatrix.maximin.label} is safest (Maximin). ${decisionMatrix.maximax.label} gives highest potential profit (Maximax).
          </div>
        </div>
      `;
    }
    
    // Cost-Benefit Analysis
    if (status.totalCost > 0 && status.totalWeightGain > 0) {
      const currentProfit = status.totalRevenue - status.totalCost;
      const improvementBenefit = currentProfit * 0.15;
      const cba = calculateCostBenefit(15000, improvementBenefit, 3, 0.1);
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid ${cba.recommended ? '#2ecc71' : '#e74c3c'};">
          <h3 style="margin-bottom:8px;">Cost-Benefit Analysis</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;">Example: Aerator Purchase (₱15,000 investment)</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">
            <div><small>Investment</small><br><strong>${formatCurrency(cba.investmentCost)}</strong></div>
            <div><small>Annual Benefit</small><br><strong>${formatCurrency(cba.annualBenefit)}</strong></div>
            <div><small>NPV (3 yrs)</small><br><strong style="color:${cba.npv > 0 ? '#2ecc71' : '#e74c3c'};">${formatCurrency(cba.npv)}</strong></div>
            <div><small>Payback</small><br><strong>${cba.paybackPeriod} cycles</strong></div>
            <div><small>ROI</small><br><strong style="color:${cba.roi > 100 ? '#2ecc71' : '#f39c12'};">${cba.roi}%</strong></div>
          </div>
          <div style="font-size:0.85rem;font-weight:600;margin-top:6px;color:${cba.recommended ? '#2ecc71' : '#e74c3c'};">
            ${cba.recommended ? 'Recommended - Positive net value' : 'Not recommended - Negative net value'}
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html || '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Not enough data for decision support. Add more logs and harvests.</p>';
  } catch (error) {
    console.error('Error loading decision engine:', error);
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Error loading decision support. Please check that js/decide.js exists.</p>';
  }
}

// ============================================================
// EXPORT FUNCTIONS (CSV, Print)
// ============================================================

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

export function printReport() {
  window.print();
}

// ============================================================
// HELP / FAQ
// ============================================================

export function renderHelp() {
  const container = document.getElementById('help-content');
  if (!container) return;
  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <h2 style="margin-bottom:16px;">Help & FAQ</h2>
      
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #3498db;">
        <h3 style="margin-bottom:8px;color:#3498db;">Getting Started</h3>
        <p><strong>Q: How do I start using the app?</strong></p>
        <p>A: First, add a pond using the Dashboard. Then start logging data daily.</p>
        <p style="margin-top:8px;"><strong>Q: What's the sample data?</strong></p>
        <p>A: Go to Settings → Load Sample Data. This creates a demo pond with 60 days of logs.</p>
      </div>
      
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #2ecc71;">
        <h3 style="margin-bottom:8px;color:#2ecc71;">Data Entry</h3>
        <p><strong>Q: What should I enter for each field?</strong></p>
        <ul style="padding-left:18px;">
          <li><strong>Temperature:</strong> 27-30°C is optimal for bangus</li>
          <li><strong>pH:</strong> 7.5-8.5 is optimal</li>
          <li><strong>Dissolved Oxygen:</strong> >5 ppm is optimal</li>
          <li><strong>Ammonia:</strong> <0.5 ppm is optimal</li>
          <li><strong>Salinity:</strong> 20-30 ppt for bangus</li>
        </ul>
        <p style="margin-top:8px;"><strong>Q: What is FCR?</strong></p>
        <p>A: Feed Conversion Ratio = Feed Given ÷ Weight Gain. Lower is better. Target: <1.5 for bangus.</p>
      </div>
      
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #f39c12;">
        <h3 style="margin-bottom:8px;color:#f39c12;">Data Safety</h3>
        <p><strong>Q: How do I back up my data?</strong></p>
        <p>A: Go to Settings → Export Data. Save the JSON file to your computer. We recommend doing this weekly.</p>
        <p style="margin-top:8px;"><strong>Q: What happens if I clear my browser cache?</strong></p>
        <p>A: Your data will be lost. Always export regularly!</p>
        <p style="margin-top:8px;"><strong>Q: Can I restore my data?</strong></p>
        <p>A: Yes, use Settings → Import Data.</p>
      </div>
      
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #e74c3c;">
        <h3 style="margin-bottom:8px;color:#e74c3c;">Troubleshooting</h3>
        <p><strong>Q: The app isn't loading.</strong></p>
        <p>A: Try clearing your browser cache or opening in a private/incognito window.</p>
        <p style="margin-top:8px;"><strong>Q: My buttons aren't working.</strong></p>
        <p>A: Check if JavaScript is enabled. Try a different browser (Chrome, Firefox, Edge).</p>
        <p style="margin-top:8px;"><strong>Q: I lost my data!</strong></p>
        <p>A: If you exported regularly, use Import Data to restore. If not, we're sorry — always export!</p>
      </div>
      
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #9b59b6;">
        <h3 style="margin-bottom:8px;color:#9b59b6;">Privacy</h3>
        <p><strong>Q: Where is my data stored?</strong></p>
        <p>A: Only in your browser. We don't send data anywhere.</p>
        <p style="margin-top:8px;"><strong>Q: Can I delete my data?</strong></p>
        <p>A: Yes, go to Settings → Clear All Data.</p>
      </div>
    </div>
  `;
}

// ============================================================
// WINDOW EXPOSURE (For inline onclick)
// ============================================================

window.editPond = editPond;
window.editLog = editLog;
window.editHarvest = editHarvest;
window.deleteLog = deleteLog;
