// ============================================================
// SAMPLING TAB - ABW, Survival, Biomass Tracking
// ============================================================

import { getAll, getByIndex, add, update, remove, getById, getLatestSampling, getSamplingHistory } from './database.js';
import { getSpecies, getSpeciesName, getSpeciesTargets } from './species.js';
import { escapeHtml, formatCurrency, formatNumber, validateNumber } from './utils.js';

// ---- Render Sampling Tab ----
export async function renderSampling(pondId) {
  const container = document.getElementById('sampling-content');
  if (!container) return;

  if (!pondId) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Select a pond to view sampling events.</p>';
    return;
  }

  const pond = await getById('ponds', pondId);
  if (!pond) {
    container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Pond not found.</p>';
    return;
  }

  let html = `
    <div style="margin-bottom:16px;background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);">
      <h3>${escapeHtml(pond.name)} - Sampling</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);">
        ${pond.operationType === 'nursery' ? '🐣 Nursery operation' : '🌾 Grow-out operation'}
        ${pond.species ? ` • ${pond.species.length} species` : ''}
      </p>
      <button id="add-sampling-btn" class="primary-btn" style="margin-top:8px;">+ Add Sampling Event</button>
    </div>
  `;

  // ---- Species selector for sampling ----
  if (pond.species && pond.species.length > 0) {
    html += `
      <div style="margin-bottom:12px;">
        <select id="sampling-species-select" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text);">
          ${pond.species.map(sp => {
            const s = getSpecies(sp.speciesId);
            return `<option value="${sp.speciesId}">${s ? s.icon : '🐟'} ${getSpeciesName(sp.speciesId)}</option>`;
          }).join('')}
        </select>
      </div>
    `;
  }

  // ---- Sampling history ----
  if (pond.species) {
    for (const sp of pond.species) {
      const history = await getSamplingHistory(pondId, sp.speciesId);
      const species = getSpecies(sp.speciesId);
      const speciesName = species ? species.name : sp.speciesId;
      const speciesIcon = species ? species.icon : '🐟';
      const color = species ? species.color : '#666';

      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid ${color};">
          <h4 style="margin-bottom:8px;">${speciesIcon} ${speciesName}</h4>
          ${history.length === 0 ? `
            <p style="color:var(--text-muted);font-size:0.9rem;">No sampling events for this species yet.</p>
          ` : `
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                <thead>
                  <tr style="background:var(--bg);">
                    <th style="padding:6px 8px;text-align:left;">Date</th>
                    <th style="padding:6px 8px;text-align:center;">DOC</th>
                    <th style="padding:6px 8px;text-align:center;">Sample Size</th>
                    <th style="padding:6px 8px;text-align:center;">ABW (g)</th>
                    <th style="padding:6px 8px;text-align:center;">Survival %</th>
                    <th style="padding:6px 8px;text-align:center;">Biomass (kg)</th>
                    <th style="padding:6px 8px;text-align:center;">Feeding Response</th>
                    <th style="padding:6px 8px;text-align:center;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${history.map(s => `
                    <tr style="border-bottom:1px solid var(--border);">
                      <td style="padding:6px 8px;">${s.date}</td>
                      <td style="padding:6px 8px;text-align:center;">${s.doc || '—'}</td>
                      <td style="padding:6px 8px;text-align:center;">${s.sampleSize || '—'}</td>
                      <td style="padding:6px 8px;text-align:center;font-weight:600;">${s.avgWeight || '—'}g</td>
                      <td style="padding:6px 8px;text-align:center;color:${(s.estimatedSurvival || 0) > 80 ? '#2ecc71' : (s.estimatedSurvival || 0) > 60 ? '#f39c12' : '#e74c3c'};">${s.estimatedSurvival || '—'}%</td>
                      <td style="padding:6px 8px;text-align:center;">${s.biomass ? formatNumber(s.biomass, 1) : '—'}kg</td>
                      <td style="padding:6px 8px;text-align:center;font-size:0.8rem;">${s.feedingResponse || '—'}</td>
                      <td style="padding:6px 8px;text-align:center;">
                        <button onclick="window.editSampling('${s.id}')" class="small-btn edit">Edit</button>
                        <button onclick="window.deleteSampling('${s.id}')" class="small-btn delete">Del</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">
              ${history.length} sampling events • Latest: ${history[history.length - 1].date}
            </div>
          `}
        </div>
      `;
    }
  }

  container.innerHTML = html;

  // ---- Add Sampling Event handler ----
  document.getElementById('add-sampling-btn')?.addEventListener('click', () => {
    showAddSamplingModal(pondId);
  });
}

// ---- Show Add Sampling Modal ----
export function showAddSamplingModal(pondId) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';

  const speciesSelect = document.getElementById('sampling-species-select');
  const selectedSpecies = speciesSelect ? speciesSelect.value : '';
  
  // Get pond data
  getById('ponds', pondId).then(pond => {
    body.innerHTML = `
      <h2>Add Sampling Event</h2>
      <form id="add-sampling-form">
        <input type="hidden" id="sampling-pond-id" value="${pondId}">
        
        <div class="form-row">
          <div class="form-group">
            <label>Date *</label>
            <input type="date" id="sampling-date" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>DOC (Day of Culture)</label>
            <input type="number" id="sampling-doc" min="0" step="1" placeholder="e.g., 45">
            <span class="hint">Days since stocking</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>Species *</label>
          <select id="sampling-species" required>
            <option value="">Select species</option>
            ${pond.species ? pond.species.map(sp => {
              const s = getSpecies(sp.speciesId);
              return `<option value="${sp.speciesId}" ${sp.speciesId === selectedSpecies ? 'selected' : ''}>${s ? s.icon : '🐟'} ${getSpeciesName(sp.speciesId)}</option>`;
            }).join('') : ''}
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Sample Size (number of fish sampled)</label>
            <input type="number" id="sampling-sample-size" min="1" step="1" placeholder="e.g., 30">
            <span class="hint">How many fish were weighed</span>
          </div>
          <div class="form-group">
            <label>Average Body Weight (g) *</label>
            <input type="number" id="sampling-avg-weight" step="0.1" required placeholder="e.g., 150">
            <span class="hint">ABW from sampling</span>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Estimated Survival (%)</label>
            <input type="number" id="sampling-survival" min="0" max="100" step="1" placeholder="e.g., 85">
            <span class="hint">Your educated guess based on feeding, size, DOC</span>
          </div>
          <div class="form-group">
            <label>Biomass (kg)</label>
            <input type="number" id="sampling-biomass" step="0.1" placeholder="Auto-calculated">
            <span class="hint">Auto-calculated from ABW × survival × density</span>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Feeding Response</label>
            <select id="sampling-feeding-response">
              <option value="">Select</option>
              <option value="Excellent">Excellent - Fish eating aggressively</option>
              <option value="Good">Good - Normal feeding</option>
              <option value="Fair">Fair - Some reduction</option>
              <option value="Poor">Poor - Not eating well</option>
            </select>
          </div>
          <div class="form-group">
            <label>Density (pieces/ha)</label>
            <input type="number" id="sampling-density" step="1" placeholder="Auto-calculated">
            <span class="hint">Current stocking density</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>Notes</label>
          <input type="text" id="sampling-notes" placeholder="Observations, health, behavior...">
        </div>
        
        <button type="submit" class="primary-btn" style="width:100%;margin-top:10px;">Save Sampling Event</button>
      </form>
    `;

    // ---- Auto-calculate biomass ----
    document.getElementById('sampling-avg-weight')?.addEventListener('input', autoCalcBiomass);
    document.getElementById('sampling-survival')?.addEventListener('input', autoCalcBiomass);
    document.getElementById('sampling-density')?.addEventListener('input', autoCalcBiomass);

    function autoCalcBiomass() {
      const avgWeight = validateNumber(document.getElementById('sampling-avg-weight').value, 0);
      const survival = validateNumber(document.getElementById('sampling-survival').value, 0) / 100;
      const density = validateNumber(document.getElementById('sampling-density').value, 0);
      
      if (avgWeight > 0 && survival > 0 && density > 0) {
        const biomass = (avgWeight * survival * density) / 1000;
        document.getElementById('sampling-biomass').value = Math.round(biomass * 10) / 10;
      }
    }

    // ---- Submit handler ----
    document.getElementById('add-sampling-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const pondId = document.getElementById('sampling-pond-id').value;
      const date = document.getElementById('sampling-date').value;
      const doc = validateNumber(document.getElementById('sampling-doc').value);
      const speciesId = document.getElementById('sampling-species').value;
      const sampleSize = validateNumber(document.getElementById('sampling-sample-size').value);
      const avgWeight = validateNumber(document.getElementById('sampling-avg-weight').value);
      const estimatedSurvival = validateNumber(document.getElementById('sampling-survival').value);
      let biomass = validateNumber(document.getElementById('sampling-biomass').value);
      const feedingResponse = document.getElementById('sampling-feeding-response').value;
      const density = validateNumber(document.getElementById('sampling-density').value);
      const notes = document.getElementById('sampling-notes').value.trim() || '';
      
      if (!date || !speciesId || !avgWeight) {
        alert('Please fill in Date, Species, and Average Body Weight.');
        return;
      }
      
      // Auto-calculate biomass if not entered
      if (!biomass || biomass <= 0) {
        const surv = estimatedSurvival || 0;
        const dens = density || 0;
        if (avgWeight > 0 && surv > 0 && dens > 0) {
          biomass = (avgWeight * (surv / 100) * dens) / 1000;
        }
      }
      
      const samplingData = {
        pondId: pondId,
        speciesId: speciesId,
        date: date,
        doc: doc || null,
        sampleSize: sampleSize || null,
        avgWeight: avgWeight,
        estimatedSurvival: estimatedSurvival || null,
        biomass: biomass || null,
        feedingResponse: feedingResponse || null,
        density: density || null,
        notes: notes,
        createdAt: new Date().toISOString()
      };
      
      await add('samplingEvents', samplingData);
      modal.style.display = 'none';
      await renderSampling(pondId);
      showMessage('log-message', 'Sampling event saved!', 'success');
    });
  });
}

// ---- Edit Sampling ----
export async function editSampling(samplingId) {
  const sample = await getById('samplingEvents', samplingId);
  if (!sample) {
    showMessage('log-message', 'Sampling event not found.', 'error');
    return;
  }
  
  // Simplified: show current data and prompt for update
  if (confirm(`Edit sampling event from ${sample.date}? (ABW: ${sample.avgWeight}g)\n\nDelete and re-add to update.`)) {
    await remove('samplingEvents', samplingId);
    const pondId = document.getElementById('sampling-pond')?.value;
    if (pondId) {
      await renderSampling(pondId);
      showAddSamplingModal(pondId);
    }
    showMessage('log-message', 'Sampling removed. Please re-add with updated info.', 'info');
  }
}

// ---- Delete Sampling ----
window.deleteSampling = async function(samplingId) {
  if (!confirm('Delete this sampling event?')) return;
  await remove('samplingEvents', samplingId);
  const samplingPond = document.getElementById('sampling-pond');
  if (samplingPond) await renderSampling(samplingPond.value);
  showMessage('log-message', 'Sampling event deleted.', 'info');
};

// ---- Expose to window ----
window.editSampling = editSampling;
window.deleteSampling = window.deleteSampling;

console.log('✅ sampling.js loaded');
