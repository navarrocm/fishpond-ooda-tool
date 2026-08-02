// ============================================================
// PREP TAB - Pond Preparation Tracking
// ============================================================

import { getAll, getByIndex, add, update, remove, getById } from './db.js';  // <-- ADDED getById
import { escapeHtml, formatNumber, validateNumber } from './utils.js';
import { getSpecies, getSpeciesList, getSpeciesName } from './species.js';

// ---- Render Prep Tab ----
export async function renderPrep(pondId) {
  const container = document.getElementById('prep-content');
  if (!container) return;

  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to start preparation tracking.</p>';
    return;
  }

  const pond = await getById('ponds', pondId);
  if (!pond) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found.</p>';
    return;
  }

  const prepLogs = await getByIndex('prepLogs', 'pondId', pondId);

  // Task templates
  const taskTemplates = [
    { id: 'drying', label: 'Drying', icon: '☀️', fields: ['startDate', 'endDate', 'notes'] },
    { id: 'liming', label: 'Liming', icon: '🧪', fields: ['date', 'amount', 'soilPhBefore', 'soilPhAfter', 'notes'] },
    { id: 'tilling', label: 'Tilling', icon: '🚜', fields: ['date', 'depth', 'notes'] },
    { id: 'waterFilling', label: 'Water Filling', icon: '💧', fields: ['startDate', 'endDate', 'source', 'waterDepth', 'notes'] },
    { id: 'fertilization', label: 'Fertilization', icon: '🌱', fields: ['date', 'fertilizerType', 'amount', 'notes'] },
    { id: 'planktonBloom', label: 'Plankton Bloom', icon: '🌿', fields: ['date', 'color', 'density', 'notes'] },
    { id: 'stocking', label: 'Stocking', icon: '🐟', fields: ['date', 'fingerlings', 'notes'] }
  ];

  const taskMap = {};
  for (const log of prepLogs) {
    taskMap[log.task] = log;
  }

  let html = `
    <div style="margin-bottom:16px;background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);">
      <h3>${escapeHtml(pond.name)} - Preparation Status</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);">
        ${pond.stockingDate ? `Stocking Date: ${pond.stockingDate}` : 'Not stocked yet'}
        ${prepLogs.length > 0 ? ` • ${prepLogs.length} tasks logged` : ' • No preparation tasks logged'}
      </p>
      <div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted);">
        💡 Complete tasks as you go. Missing data won't break anything — just leave it blank.
      </div>
    </div>
  `;

  html += `<div style="display:grid;gap:12px;">`;

  for (const task of taskTemplates) {
    const existing = taskMap[task.id];
    const status = existing ? existing.status || 'Completed' : 'Pending';
    const statusColor = status === 'Completed' ? '#2ecc71' : status === 'In Progress' ? '#f39c12' : '#666';

    html += `
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);border-left:4px solid ${statusColor};">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span style="font-size:1.2rem;">${task.icon}</span>
            <strong style="margin-left:8px;">${task.label}</strong>
            <span style="margin-left:12px;font-size:0.8rem;color:${statusColor};font-weight:600;">${status}</span>
          </div>
          <div style="display:flex;gap:6px;">
            ${existing ? `
              <button onclick="window.editPrepTask('${existing.id}')" class="small-btn edit">Edit</button>
              <button onclick="window.deletePrepTask('${existing.id}')" class="small-btn delete">Delete</button>
            ` : `
              <button onclick="window.addPrepTask('${pond.id}','${task.id}')" class="small-btn edit">Add</button>
            `}
          </div>
        </div>
        ${existing ? `
          <div style="margin-top:8px;font-size:0.85rem;color:var(--text-light);">
            ${existing.date ? `📅 ${existing.date}` : ''}
            ${existing.startDate ? `📅 Start: ${existing.startDate}` : ''}
            ${existing.endDate ? ` → End: ${existing.endDate}` : ''}
            ${existing.amount ? ` • ${existing.amount} ${existing.unit || ''}` : ''}
            ${existing.fingerlings ? ` • ${existing.fingerlings} fingerlings` : ''}
            ${existing.notes ? `<div style="margin-top:4px;font-style:italic;color:var(--text-muted);">${escapeHtml(existing.notes)}</div>` : ''}
          </div>
        ` : `
          <div style="margin-top:8px;font-size:0.8rem;color:var(--text-muted);">No data logged yet. Click "Add" to start.</div>
        `}
      </div>
    `;
  }

  html += `</div>`;

  // Water quality readings
  const waterReadings = prepLogs.filter(l => l.task === 'waterQualityReading');
  html += `
    <div style="margin-top:20px;background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <h3>💧 Water Quality Readings (Pre-stocking)</h3>
        <button onclick="window.addWaterQualityReading('${pond.id}')" class="primary-btn" style="padding:4px 12px;font-size:0.8rem;">Add Reading</button>
      </div>
      ${waterReadings.length === 0 ? `
        <p style="color:var(--text-muted);font-size:0.9rem;margin-top:8px;">No water quality readings logged.</p>
      ` : `
        <div style="overflow-x:auto;margin-top:8px;">
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <thead>
              <tr style="background:var(--bg);">
                <th style="padding:6px 8px;text-align:left;">Date</th>
                <th style="padding:6px 8px;text-align:center;">Temp</th>
                <th style="padding:6px 8px;text-align:center;">pH</th>
                <th style="padding:6px 8px;text-align:center;">Salinity</th>
                <th style="padding:6px 8px;text-align:center;">DO</th>
                <th style="padding:6px 8px;text-align:center;">Ammonia</th>
                <th style="padding:6px 8px;text-align:center;">Nitrate</th>
                <th style="padding:6px 8px;text-align:center;">Nitrite</th>
                <th style="padding:6px 8px;text-align:center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${waterReadings.map(r => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:6px 8px;">${r.date}</td>
                  <td style="padding:6px 8px;text-align:center;">${r.temp || '-'}°C</td>
                  <td style="padding:6px 8px;text-align:center;">${r.ph || '-'}</td>
                  <td style="padding:6px 8px;text-align:center;">${r.salinity || '-'}ppt</td>
                  <td style="padding:6px 8px;text-align:center;">${r.do || '-'}ppm</td>
                  <td style="padding:6px 8px;text-align:center;">${r.ammonia || '-'}ppm</td>
                  <td style="padding:6px 8px;text-align:center;">${r.nitrate || '-'}ppm</td>
                  <td style="padding:6px 8px;text-align:center;">${r.nitrite || '-'}ppm</td>
                  <td style="padding:6px 8px;text-align:center;">
                    <button onclick="window.editWaterQualityReading('${r.id}')" class="small-btn edit">Edit</button>
                    <button onclick="window.deletePrepTask('${r.id}')" class="small-btn delete">Del</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Prep summary
  const completedTasks = prepLogs.filter(l => l.status === 'Completed' || l.status === 'Done');
  const totalTasks = taskTemplates.length;
  const progress = Math.round((completedTasks.length / totalTasks) * 100);

  html += `
    <div style="margin-top:20px;background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);border-left:4px solid ${progress === 100 ? '#2ecc71' : progress >= 50 ? '#f39c12' : '#e74c3c'};">
      <h3>📊 Preparation Progress</h3>
      <div style="display:flex;align-items:center;gap:16px;margin-top:8px;">
        <div style="flex:1;height:12px;background:var(--bg);border-radius:6px;overflow:hidden;">
          <div style="width:${progress}%;height:100%;background:${progress === 100 ? '#2ecc71' : progress >= 50 ? '#f39c12' : '#e74c3c'};transition:width 0.3s;"></div>
        </div>
        <span style="font-weight:600;">${progress}%</span>
      </div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">
        ${completedTasks.length}/${totalTasks} tasks completed
        ${progress === 100 ? ' ✅ Ready to stock!' : progress >= 50 ? ' ⏳ In progress' : ' ⚠️ Getting started'}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ---- Add Prep Task ----
export function addPrepTask(pondId, taskId) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';

  const taskLabels = {
    drying: 'Drying',
    liming: 'Liming',
    tilling: 'Tilling',
    waterFilling: 'Water Filling',
    fertilization: 'Fertilization',
    planktonBloom: 'Plankton Bloom',
    stocking: 'Stocking',
    waterQualityReading: 'Water Quality Reading'
  };

  const label = taskLabels[taskId] || taskId;

  body.innerHTML = `
    <h2>Add ${label}</h2>
    <form id="add-prep-form">
      <input type="hidden" id="prep-pond-id" value="${pondId}">
      <input type="hidden" id="prep-task-id" value="${taskId}">
      
      ${taskId === 'drying' ? `
        <div class="form-row">
          <div class="form-group"><label>Start Date</label><input type="date" id="prep-start-date"></div>
          <div class="form-group"><label>End Date</label><input type="date" id="prep-end-date"></div>
        </div>
        <div class="form-group"><label>Status</label>
          <select id="prep-status">
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed" selected>Completed</option>
          </select>
        </div>
      ` : ''}
      
      ${taskId === 'liming' ? `
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" id="prep-date"></div>
          <div class="form-group"><label>Amount (kg/ha)</label><input type="number" id="prep-amount" step="0.1" placeholder="1000"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Soil pH (Before)</label><input type="number" id="prep-ph-before" step="0.1" placeholder="5.8"></div>
          <div class="form-group"><label>Soil pH (After)</label><input type="number" id="prep-ph-after" step="0.1" placeholder="6.8"></div>
        </div>
      ` : ''}
      
      ${taskId === 'tilling' ? `
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" id="prep-date"></div>
          <div class="form-group"><label>Depth (cm)</label><input type="number" id="prep-depth" step="0.5" placeholder="15"></div>
        </div>
      ` : ''}
      
      ${taskId === 'waterFilling' ? `
        <div class="form-row">
          <div class="form-group"><label>Start Date</label><input type="date" id="prep-start-date"></div>
          <div class="form-group"><label>End Date</label><input type="date" id="prep-end-date"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Water Source</label><input type="text" id="prep-source" placeholder="River, Well, etc."></div>
          <div class="form-group"><label>Water Depth (m)</label><input type="number" id="prep-water-depth" step="0.1" placeholder="1.2"></div>
        </div>
      ` : ''}
      
      ${taskId === 'fertilization' ? `
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" id="prep-date"></div>
          <div class="form-group"><label>Fertilizer Type</label><input type="text" id="prep-fertilizer-type" placeholder="Urea + Triple 16"></div>
        </div>
        <div class="form-group"><label>Amount (kg/ha)</label><input type="number" id="prep-amount" step="0.1" placeholder="40"></div>
      ` : ''}
      
      ${taskId === 'planktonBloom' ? `
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" id="prep-date"></div>
          <div class="form-group"><label>Color</label>
            <select id="prep-color">
              <option value="">Select</option>
              <option value="Green">Green</option>
              <option value="Brown">Brown</option>
              <option value="Yellow">Yellow</option>
              <option value="Clear">Clear</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>Density</label>
          <select id="prep-density">
            <option value="">Select</option>
            <option value="Low">Low</option>
            <option value="Moderate">Moderate</option>
            <option value="High">High</option>
          </select>
        </div>
      ` : ''}
      
      ${taskId === 'stocking' ? `
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" id="prep-date"></div>
          <div class="form-group"><label>Fingerlings</label><input type="number" id="prep-fingerlings" placeholder="5000"></div>
        </div>
      ` : ''}
      
      ${taskId === 'waterQualityReading' ? `
        <div class="form-row">
          <div class="form-group"><label>Date</label><input type="date" id="prep-date" required></div>
          <div class="form-group"><label>Time</label><input type="time" id="prep-time" value="08:00"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Temperature (°C)</label><input type="number" id="prep-temp" step="0.1" placeholder="27"></div>
          <div class="form-group"><label>pH</label><input type="number" id="prep-ph" step="0.1" placeholder="7.8"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Salinity (ppt)</label><input type="number" id="prep-salinity" step="0.1" placeholder="25"></div>
          <div class="form-group"><label>DO (ppm)</label><input type="number" id="prep-do" step="0.1" placeholder="5.2"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Ammonia (ppm)</label><input type="number" id="prep-ammonia" step="0.01" placeholder="0.05"></div>
          <div class="form-group"><label>Nitrate (ppm)</label><input type="number" id="prep-nitrate" step="0.01" placeholder="0.5"></div>
        </div>
        <div class="form-group"><label>Nitrite (ppm)</label><input type="number" id="prep-nitrite" step="0.01" placeholder="0.02"></div>
      ` : ''}
      
      <div class="form-group"><label>Notes</label><input type="text" id="prep-notes" placeholder="Any observations..."></div>
      
      <button type="submit" class="primary-btn" style="width:100%;margin-top:10px;">Save Task</button>
    </form>
  `;

  document.getElementById('add-prep-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      pondId: document.getElementById('prep-pond-id').value,
      task: document.getElementById('prep-task-id').value,
      status: document.getElementById('prep-status')?.value || 'Completed',
      startDate: document.getElementById('prep-start-date')?.value || '',
      endDate: document.getElementById('prep-end-date')?.value || '',
      date: document.getElementById('prep-date')?.value || '',
      amount: validateNumber(document.getElementById('prep-amount')?.value, null),
      unit: document.getElementById('prep-unit')?.value || '',
      soilPhBefore: validateNumber(document.getElementById('prep-ph-before')?.value, null),
      soilPhAfter: validateNumber(document.getElementById('prep-ph-after')?.value, null),
      depth: validateNumber(document.getElementById('prep-depth')?.value, null),
      source: document.getElementById('prep-source')?.value || '',
      waterDepth: validateNumber(document.getElementById('prep-water-depth')?.value, null),
      fertilizerType: document.getElementById('prep-fertilizer-type')?.value || '',
      color: document.getElementById('prep-color')?.value || '',
      density: document.getElementById('prep-density')?.value || '',
      fingerlings: validateNumber(document.getElementById('prep-fingerlings')?.value, null),
      temp: validateNumber(document.getElementById('prep-temp')?.value, null),
      ph: validateNumber(document.getElementById('prep-ph')?.value, null),
      salinity: validateNumber(document.getElementById('prep-salinity')?.value, null),
      do: validateNumber(document.getElementById('prep-do')?.value, null),
      ammonia: validateNumber(document.getElementById('prep-ammonia')?.value, null),
      nitrate: validateNumber(document.getElementById('prep-nitrate')?.value, null),
      nitrite: validateNumber(document.getElementById('prep-nitrite')?.value, null),
      time: document.getElementById('prep-time')?.value || '',
      notes: document.getElementById('prep-notes')?.value || '',
      createdAt: new Date().toISOString()
    };

    for (const key in data) {
      if (data[key] === '' || data[key] === null || data[key] === undefined) {
        delete data[key];
      }
    }

    await add('prepLogs', data);
    modal.style.display = 'none';
    await renderPrep(pondId);
    showMessage('log-message', 'Task saved successfully!', 'success');
  });
}

// ---- Edit Prep Task ----
export async function editPrepTask(taskId) {
  const task = await getById('prepLogs', taskId);
  if (!task) {
    showMessage('log-message', 'Task not found.', 'error');
    return;
  }
  // Simplified: show current data and let user re-add
  if (confirm(`Edit task "${task.task}"? Current notes: ${task.notes || 'None'}\n\nDelete and re-add to update.`)) {
    await remove('prepLogs', taskId);
    const pondId = document.getElementById('prep-pond')?.value;
    if (pondId) {
      await renderPrep(pondId);
      // Open add modal for this task
      addPrepTask(pondId, task.task);
    }
    showMessage('log-message', 'Task removed. Please re-add with updated info.', 'info');
  }
}

// ---- Delete Prep Task ----
window.deletePrepTask = async function(taskId) {
  if (!confirm('Delete this task?')) return;
  await remove('prepLogs', taskId);
  const prepPond = document.getElementById('prep-pond');
  if (prepPond) await renderPrep(prepPond.value);
  showMessage('log-message', 'Task deleted.', 'info');
};

// ---- Add Water Quality Reading ----
window.addWaterQualityReading = addPrepTask;

// ---- Edit Water Quality Reading ----
window.editWaterQualityReading = editPrepTask;

// ---- Expose functions to window ----
window.addPrepTask = addPrepTask;
window.editPrepTask = editPrepTask;
window.deletePrepTask = window.deletePrepTask;
window.addWaterQualityReading = addPrepTask;
window.editWaterQualityReading = editPrepTask;

console.log('✅ prep.js loaded');
