// ============================================================
// UI HELPERS - Complete with All Exports
// ============================================================

import { getAll, getByIndex, add, update, remove, getById, exportAllData, getSpeciesTotals, getLatestSampling } from './db.js';
import { 
  getSpecies, getSpeciesList, getSpeciesName, getSpeciesIcon, getSpeciesColor, 
  getSpeciesForOperation, getOperationTypes, getOperationTypeLabel, getSpeciesTargets 
} from './species.js';
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
    const opType = pond.operationType || 'growout';
    const opLabel = getOperationTypeLabel(opType);
    
    let totalStocked = 0;
    if (pond.species) {
      for (const sp of pond.species) {
        totalStocked += sp.fingerlings || 0;
      }
    }
    
    // ---- Get biomass, ABW, density from latest sampling ----
    let biomassDisplay = '';
    let abwDisplay = '';
    let densityDisplay = '';
    
    if (pond.species && pond.species.length > 0) {
      const firstSpecies = pond.species[0];
      const latestSample = await getLatestSampling(pond.id, firstSpecies.speciesId);
      
      if (latestSample) {
        if (latestSample.biomass) {
          biomassDisplay = `<div class="metric">⚖️ Biomass: <span>${formatNumber(latestSample.biomass, 1)}kg</span></div>`;
        }
        if (latestSample.avgWeight) {
          abwDisplay = `<div class="metric">📏 ABW: <span>${latestSample.avgWeight}g</span></div>`;
        }
        if (latestSample.density) {
          densityDisplay = `<div class="metric">📊 Density: <span>${formatNumber(latestSample.density, 0)}/ha</span></div>`;
        } else {
          const density = pond.area > 0 ? Math.round(firstSpecies.fingerlings / pond.area) : 0;
          if (density > 0) {
            densityDisplay = `<div class="metric">📊 Density: <span>${formatNumber(density, 0)}/ha</span></div>`;
          }
        }
      } else {
        const density = pond.area > 0 ? Math.round(firstSpecies.fingerlings / pond.area) : 0;
        if (density > 0) {
          densityDisplay = `<div class="metric">📊 Density: <span>${formatNumber(density, 0)}/ha</span></div>`;
        }
      }
    }
    
    html += `
      <div class="pond-card" data-pond-id="${escapeHtml(pond.id)}">
        <div class="name">${name}</div>
        <div class="species">${speciesList} • ${area}ha</div>
        <div class="metric">📋 ${opLabel}</div>
        <span class="status green">${hasHarvest ? 'Harvested' : 'Active'}</span>
        ${hasHarvest ? `<span class="harvested-badge">Harvested</span>` : ''}
        <div class="metric">📅 ${pond.stockingDate || 'Not stocked yet'}</div>
        <div class="metric">🐟 Stocked: ${totalStocked}</div>
        ${biomassDisplay}
        ${abwDisplay}
        ${densityDisplay}
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
  
  const opType = pond.operationType || 'growout';
  const opLabel = getOperationTypeLabel(opType);
  
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
  
  // Get latest sampling data for display
  let samplingHtml = '';
  if (pond.species && pond.species.length > 0) {
    const firstSpecies = pond.species[0];
    const latestSample = await getLatestSampling(pond.id, firstSpecies.speciesId);
    if (latestSample) {
      samplingHtml = `
        <div style="margin-top:12px;padding:12px;background:var(--bg);border-radius:8px;">
          <strong>📊 Latest Sampling</strong>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:6px;font-size:0.85rem;">
            ${latestSample.avgWeight ? `<div>ABW: <strong>${latestSample.avgWeight}g</strong></div>` : ''}
            ${latestSample.biomass ? `<div>Biomass: <strong>${formatNumber(latestSample.biomass, 1)}kg</strong></div>` : ''}
            ${latestSample.estimatedSurvival ? `<div>Survival: <strong>${latestSample.estimatedSurvival}%</strong></div>` : ''}
            ${latestSample.date ? `<div>Date: ${latestSample.date}</div>` : ''}
          </div>
        </div>
      `;
    }
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
      <div><strong>Operation:</strong> ${opLabel}</div>
      <div><strong>Harvested:</strong> ${pond.harvested ? '✅ Yes' : 'No'}</div>
    </div>
    ${speciesHtml}
    ${samplingHtml}
    <div style="margin-top:12px;font-size:0.8rem;color:var(--text-muted);">
      ${logs.length} log entries • ${harvests.length} harvests
    </div>
  `;
}

// ---- Show Add Pond Modal ----
