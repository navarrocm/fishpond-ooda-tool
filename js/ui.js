// ============================================================
// ANALYSIS RENDERER (Updated with Data Completeness)
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
  const completeness = status.dataCompleteness;

  // --- Data Completeness Card ---
  let completenessHtml = '';
  if (completeness && completeness.totalFields > 0) {
    const color = completeness.completeness >= 80 ? '#2ecc71' :
                  completeness.completeness >= 50 ? '#f39c12' : '#e74c3c';
    completenessHtml = `
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid ${color};">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong>Data Completeness</strong>
            <span style="font-size:0.8rem;color:var(--text-muted);margin-left:8px;">
              ${completeness.completeness}% (${completeness.available.length}/${completeness.totalFields} fields)
            </span>
          </div>
          <span style="font-size:0.8rem;color:${color};font-weight:600;">
            ${completeness.completeness >= 80 ? '✅ Good' : completeness.completeness >= 50 ? '⚠️ Partial' : '❌ Limited'}
          </span>
        </div>
        ${completeness.missing.length > 0 ? `
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
            Missing: ${completeness.missing.join(', ')}
          </div>
        ` : ''}
        ${recs.dataWarning ? `
          <div style="font-size:0.85rem;color:#f39c12;margin-top:6px;padding:6px 10px;background:rgba(243,156,18,0.1);border-radius:6px;">
            ⚠️ ${recs.dataWarning}
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- Metrics Grid ---
  const metricsHtml = `
    <div class="metrics-grid">
      <div class="metric-card"><div class="value">${status.fcr !== null ? status.fcr : '—'}</div><div class="label">FCR</div></div>
      <div class="metric-card"><div class="value">${status.survival !== null ? status.survival + '%' : '—'}</div><div class="label">Survival</div></div>
      <div class="metric-card"><div class="value">${status.dgr !== null ? status.dgr + 'g' : '—'}</div><div class="label">DGR</div></div>
      <div class="metric-card"><div class="value">${status.roi !== null ? status.roi + '%' : '—'}</div><div class="label">ROI</div></div>
      <div class="metric-card"><div class="value">${status.hasHarvest ? '✅' : 'Day ' + status.daysInCycle}</div><div class="label">${status.phase.label}</div></div>
      <div class="metric-card"><div class="value">${status.currentAlive}</div><div class="label">Alive</div></div>
      ${status.breakEven !== null ? `<div class="metric-card"><div class="value">₱${status.breakEven}</div><div class="label">Break-even/kg</div></div>` : ''}
      ${status.totalRevenue > 0 ? `<div class="metric-card"><div class="value">₱${formatNumber(status.totalRevenue, 0)}</div><div class="label">Revenue</div></div>` : ''}
    </div>
  `;

  // --- Recommendations ---
  const recClass = status.statusColor === 'red' ? 'danger' : status.statusColor === 'yellow' ? 'warning' : '';
  const recHtml = `
    <div class="recommendation-box ${recClass}">
      <strong>${escapeHtml(recs.decision[0] || 'No recommendation yet')}</strong>
      <ul>${recs.action.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
      <div class="confidence">
        Confidence: ${recs.confidence} • 
        ${recs.observations.length > 0 ? recs.observations.map(o => escapeHtml(o)).join('; ') : 'No observations available'}
      </div>
    </div>
  `;

  // --- Orientation ---
  const orientationHtml = `
    <div style="margin-top:16px;background:var(--card-bg);padding:12px;border-radius:8px;">
      <strong>Orientation</strong>
      <ul style="padding-left:18px;font-size:0.9rem;">
        ${recs.orientation.map(o => `<li>${escapeHtml(o)}</li>`).join('')}
      </ul>
    </div>
    <div style="margin-top:12px;font-size:0.8rem;color:var(--text-muted);">
      ${logs.length} log entries • ${harvests.length} harvests
    </div>
  `;

  container.innerHTML = completenessHtml + metricsHtml + recHtml + orientationHtml;
}
