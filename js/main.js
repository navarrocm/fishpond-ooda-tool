// ============================================================
// MAIN APP - Entry Point
// ============================================================

import { 
  openDB, add, getAll, getByIndex, update, remove, clearStore, 
  exportAllData, importAllData, loadSampleData 
} from './db.js';
import { 
  getPondStatus, generateRecommendations, getPhase,
  calculateFCR, calculateSurvival, calculateDGR, 
  calculateBreakEven, calculateROI
} from './ooda.js';
import { 
  showTab, showMessage, renderPondList, showPondDetail, 
  showAddPondModal, updateSelectors, renderAnalysis, renderHarvestList,
  renderDecide, renderHelp, exportToCSV, printReport
} from './ui.js';
import { escapeHtml, formatNumber, formatCurrency, validateNumber, validateInt } from './utils.js';

// ---- INIT ----
async function init() {
  await openDB();
  
  // --- LOAD THEME ---
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
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

  // --- AUTO-EXPORT ON UNLOAD ---
  window.addEventListener('beforeunload', async (e) => {
    const lastExport = localStorage.getItem('lastExportDate');
    const now = new Date();
    const daysSince = (now - new Date(lastExport)) / (1000 * 60 * 60 * 24);
    if (daysSince > 1) {
      const data = await exportAllData();
      if (data.ponds && data.ponds.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved data. Please export your backup before leaving.';
        // Auto-export in background
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auto-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
  });

  console.log('Fishpond OODA Tool v3.0 initialized!');
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
  if (harvestPond) await renderHarvestList(harvestPond.value);
  await renderPondList();
  showMessage('harvest-message', 'Harvest record deleted.', 'info');
};

// ---- CHART RENDERING ----
function renderCharts(pond, logs, harvests) {
  const fcrCanvas = document.getElementById('chart-fcr');
  const growthCanvas = document.getElementById('chart-growth');
  if (!fcrCanvas || !growthCanvas) return;
  
  const ctx1 = fcrCanvas.getContext('2d');
  const ctx2 = growthCanvas.getContext('2d');
  ctx1.clearRect(0, 0, fcrCanvas.width, fcrCanvas.height);
  ctx2.clearRect(0, 0, growthCanvas.width, growthCanvas.height);
  
  fcrCanvas.width = fcrCanvas.parentElement.clientWidth || 400;
  fcrCanvas.height = 200;
  growthCanvas.width = growthCanvas.parentElement.clientWidth || 400;
  growthCanvas.height = 200;
  
  if (logs && logs.length > 1) {
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedLogs.map(l => l.date.substring(5));
    const fcrValues = [];
    let cumulativeFeed = 0;
    let cumulativeWeight = 0;
    
    for (const log of sortedLogs) {
      cumulativeFeed += validateNumber(log.feedAmount, 0);
      const alive = (pond.fingerlings || 0) - (log.mortality || 0);
      const weightGain = (alive * validateNumber(log.weight, 0)) / 1000;
      cumulativeWeight += weightGain;
      const fcr = cumulativeWeight > 0 ? Math.round((cumulativeFeed / cumulativeWeight) * 100) / 100 : 0;
      fcrValues.push(fcr);
    }
    drawBarChart(ctx1, labels, fcrValues, 'FCR', '#1a5f7a', 1.5);
  } else {
    ctx1.fillStyle = '#888';
    ctx1.font = '14px sans-serif';
    ctx1.textAlign = 'center';
    ctx1.fillText('Not enough data for FCR chart', fcrCanvas.width/2, fcrCanvas.height/2);
  }
  
  if (logs && logs.length > 1) {
    const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedLogs.map(l => l.date.substring(5));
    const growthValues = sortedLogs.map(l => validateNumber(l.weight, 0));
    drawLineChart(ctx2, labels, growthValues, 'Weight (g)', '#2ecc71');
  } else {
    ctx2.fillStyle = '#888';
    ctx2.font = '14px sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('Not enough data for growth chart', growthCanvas.width/2, growthCanvas.height/2);
  }
}

function drawBarChart(ctx, labels, values, label, color, targetLine) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const pad = { top: 20, bottom: 30, left: 40, right: 10 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...values, targetLine || 0) * 1.2 || 1;
  const barW = Math.min(chartW / values.length * 0.6, 30);
  const gap = chartW / values.length;
  
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((maxVal * i / 4).toFixed(1), pad.left - 5, y + 3);
  }
  
  for (let i = 0; i < values.length; i++) {
    const x = pad.left + i * gap + (gap - barW) / 2;
    const barH = (values[i] / maxVal) * chartH;
    const y = pad.top + chartH - barH;
    ctx.fillStyle = values[i] > (targetLine || Infinity) ? '#e74c3c' : color;
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i] || '', x + barW/2, h - pad.bottom + 15);
  }
  
  if (targetLine) {
    const targetY = pad.top + chartH - (targetLine / maxVal) * chartH;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, targetY);
    ctx.lineTo(w - pad.right, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e74c3c';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Target ' + targetLine, w - pad.right - 70, targetY - 5);
  }
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, w/2, h - 2);
}

function drawLineChart(ctx, labels, values, label, color) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const pad = { top: 20, bottom: 30, left: 40, right: 10 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1) * 1.2;
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;
  
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    const val = minVal + (range * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(1), pad.left - 5, y + 3);
  }
  
  if (values.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < values.length; i++) {
      const x = pad.left + (i / (values.length - 1)) * chartW;
      const y = pad.top + chartH - ((values[i] - minVal) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < values.length; i++) {
      const x = pad.left + (i / (values.length - 1)) * chartW;
      const y = pad.top + chartH - ((values[i] - minVal) / range) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i] || '', x, h - pad.bottom + 15);
    }
  }
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, w/2, h - 2);
}

// ---- TREND ANALYSIS ----
function renderTrendAnalysis(pond, logs, harvests) {
  const container = document.getElementById('trend-analysis');
  if (!container) return;
  if (!logs || logs.length < 3) {
    container.innerHTML = '<p style="color:var(--text-light);">Need at least 3 days of data for trend analysis.</p>';
    return;
  }
  
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = sortedLogs.slice(-7);
  const old = sortedLogs.slice(-14, -7);
  
  const avgRecent = {
    temp: recent.reduce((s, l) => s + validateNumber(l.temp, 0), 0) / recent.length,
    ph: recent.reduce((s, l) => s + validateNumber(l.ph, 0), 0) / recent.length,
    do: recent.reduce((s, l) => s + validateNumber(l.do, 0), 0) / recent.length,
    ammonia: recent.reduce((s, l) => s + validateNumber(l.ammonia, 0), 0) / recent.length
  };
  
  const avgOld = old.length > 0 ? {
    temp: old.reduce((s, l) => s + validateNumber(l.temp, 0), 0) / old.length,
    ph: old.reduce((s, l) => s + validateNumber(l.ph, 0), 0) / old.length,
    do: old.reduce((s, l) => s + validateNumber(l.do, 0), 0) / old.length,
    ammonia: old.reduce((s, l) => s + validateNumber(l.ammonia, 0), 0) / old.length
  } : null;
  
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:12px;">';
  
  const metrics = [
    { key: 'temp', label: 'Temperature', unit: '°C', target: '27-30', recent: avgRecent.temp, old: avgOld?.temp || null },
    { key: 'ph', label: 'pH', unit: '', target: '7.5-8.5', recent: avgRecent.ph, old: avgOld?.ph || null },
    { key: 'do', label: 'DO', unit: ' ppm', target: '>5', recent: avgRecent.do, old: avgOld?.do || null },
    { key: 'ammonia', label: 'Ammonia', unit: ' ppm', target: '<0.5', recent: avgRecent.ammonia, old: avgOld?.ammonia || null }
  ];
  
  for (const m of metrics) {
    const direction = m.old !== null ? (m.recent - m.old) : 0;
    const arrow = direction > 0.05 ? '↑' : direction < -0.05 ? '↓' : '→';
    const color = direction > 0.05 ? 'green' : direction < -0.05 ? 'red' : 'gray';
    html += `
      <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);">
        <div style="font-size:0.75rem;color:var(--text-muted);">${m.label}</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--primary);">
          ${m.recent.toFixed(1)}${m.unit}
          <span style="font-size:0.8rem;color:var(--${color});">${arrow}</span>
        </div>
        ${m.old !== null ? `<div style="font-size:0.7rem;color:var(--text-muted);">Previous: ${m.old.toFixed(1)}${m.unit}</div>` : ''}
        <div style="font-size:0.7rem;color:var(--text-muted);">Target: ${m.target}</div>
      </div>
    `;
  }
  html += '</div>';
  
  let totalFeedCost = 0;
  let totalOtherCost = 0;
  for (const log of logs) {
    totalFeedCost += validateNumber(log.feedCost, 0);
    totalOtherCost += validateNumber(log.feedCost, 0) * 0.4;
  }
  const totalCost = totalFeedCost + totalOtherCost;
  const feedPercent = totalCost > 0 ? Math.round((totalFeedCost / totalCost) * 100) : 0;
  
  html += `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
      <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);text-align:center;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Feed Cost</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--primary);">${feedPercent}%</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">of total operating cost</div>
      </div>
      <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);text-align:center;">
        <div style="font-size:0.75rem;color:var(--text-muted);">Status</div>
        <div style="font-size:1.2rem;font-weight:700;color:${feedPercent > 70 ? '#e74c3c' : feedPercent > 60 ? '#f39c12' : '#2ecc71'};">
          ${feedPercent > 70 ? 'High' : feedPercent > 60 ? 'Moderate' : 'Good'}
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);">Target: <60% of total cost</div>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

// ---- BREAK-EVEN SENSITIVITY ----
function renderBreakEvenSensitivity(pond, logs, harvests) {
  const container = document.getElementById('break-even-sensitivity');
  if (!container) return;
  const status = getPondStatus(pond, logs, harvests);
  if (!status.totalCost || status.totalCost <= 0) {
    container.innerHTML = '<p style="color:var(--text-light);">Not enough data for break-even analysis.</p>';
    return;
  }
  const harvestWeight = harvests && harvests.length > 0 
    ? harvests.reduce((s, h) => s + validateNumber(h.weight, 0), 0)
    : status.totalWeightGain;
  if (harvestWeight <= 0) {
    container.innerHTML = '<p style="color:var(--text-light);">No harvest weight recorded yet.</p>';
    return;
  }
  const breakEven = status.breakEven || (status.totalCost / harvestWeight);
  const scenarios = [
    { label: 'Low Price', price: Math.round(breakEven * 0.8 * 100) / 100 },
    { label: 'Current Price', price: Math.round(breakEven * 100) / 100 },
    { label: 'Good Price', price: Math.round(breakEven * 1.2 * 100) / 100 },
    { label: 'High Price', price: Math.round(breakEven * 1.4 * 100) / 100 }
  ];
  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:12px;">`;
  for (const s of scenarios) {
    const profit = (s.price - breakEven) * harvestWeight;
    const color = profit > 0 ? '#2ecc71' : '#e74c3c';
    const emoji = profit > 0 ? '✅' : '❌';
    html += `
      <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);text-align:center;border-left:4px solid ${color};">
        <div style="font-size:0.75rem;color:var(--text-muted);">${s.label}</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--primary);">₱${s.price}/kg</div>
        <div style="font-size:0.9rem;color:${color};font-weight:600;">${emoji} ${formatCurrency(profit)}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">Break-even: ₱${breakEven.toFixed(2)}/kg</div>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}

// ---- CROSS-CYCLE COMPARISON ----
function renderCrossCycleComparison(pond, logs, harvests) {
  const container = document.getElementById('cross-cycle-comparison');
  if (!container) return;
  if (!harvests || harvests.length < 2) {
    container.innerHTML = '<p style="color:var(--text-light);">Need at least 2 harvest cycles for comparison.</p>';
    return;
  }
  const sortedHarvests = [...harvests].sort((a, b) => new Date(a.date) - new Date(b.date));
  const cycles = sortedHarvests.map((h, i) => {
    const logsForCycle = logs.filter(l => new Date(l.date) <= new Date(h.date));
    const prevDate = i > 0 ? new Date(sortedHarvests[i-1].date) : new Date(0);
    const cycleLogs = logsForCycle.filter(l => new Date(l.date) > prevDate);
    const totalFeed = cycleLogs.reduce((s, l) => s + validateNumber(l.feedAmount, 0), 0);
    const totalCost = cycleLogs.reduce((s, l) => s + validateNumber(l.feedCost, 0), 0);
    const weight = validateNumber(h.weight, 0);
    const revenue = validateNumber(h.revenue, 0);
    const fcr = weight > 0 ? Math.round((totalFeed / weight) * 100) / 100 : 0;
    const roi = totalCost > 0 ? Math.round(((revenue - totalCost) / totalCost) * 100) : 0;
    return { cycle: i + 1, date: h.date, weight, revenue, totalCost, totalFeed, fcr, roi };
  });
  
  let html = `
    <div style="overflow-x:auto;margin-top:12px;">
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;background:var(--card-bg);border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:var(--primary);color:#fff;">
            <th style="padding:8px 12px;text-align:left;">Cycle</th>
            <th style="padding:8px 12px;text-align:right;">Harvest (kg)</th>
            <th style="padding:8px 12px;text-align:right;">FCR</th>
            <th style="padding:8px 12px;text-align:right;">ROI</th>
            <th style="padding:8px 12px;text-align:right;">Revenue</th>
          </tr>
        </thead>
        <tbody>
  `;
  for (const c of cycles) {
    const isBest = c.roi === Math.max(...cycles.map(x => x.roi));
    html += `
      <tr style="border-bottom:1px solid var(--border);${isBest ? 'background:var(--secondary);opacity:0.1;' : ''}">
        <td style="padding:8px 12px;font-weight:600;">#${c.cycle} ${isBest ? '🏆' : ''}</td>
        <td style="padding:8px 12px;text-align:right;">${formatNumber(c.weight, 1)}</td>
        <td style="padding:8px 12px;text-align:right;color:${c.fcr < 1.5 ? '#2ecc71' : '#e74c3c'};">${c.fcr}</td>
        <td style="padding:8px 12px;text-align:right;color:${c.roi > 100 ? '#2ecc71' : c.roi > 50 ? '#f39c12' : '#e74c3c'};">${c.roi}%</td>
        <td style="padding:8px 12px;text-align:right;">${formatCurrency(c.revenue)}</td>
      </tr>
    `;
  }
  html += '</tbody></table></div>';
  
  if (cycles.length >= 2) {
    const last = cycles[cycles.length - 1];
    const first = cycles[0];
    const roiChange = last.roi - first.roi;
    const fcrChange = last.fcr - first.fcr;
    html += `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);text-align:center;border-left:4px solid ${roiChange > 0 ? '#2ecc71' : '#e74c3c'};">
          <div style="font-size:0.75rem;color:var(--text-muted);">ROI Change</div>
          <div style="font-size:1.2rem;font-weight:700;color:${roiChange > 0 ? '#2ecc71' : '#e74c3c'};">
            ${roiChange > 0 ? '+' : ''}${roiChange}%
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);">Cycle ${cycles.length} vs Cycle 1</div>
        </div>
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);text-align:center;border-left:4px solid ${fcrChange < 0 ? '#2ecc71' : '#e74c3c'};">
          <div style="font-size:0.75rem;color:var(--text-muted);">FCR Change</div>
          <div style="font-size:1.2rem;font-weight:700;color:${fcrChange < 0 ? '#2ecc71' : '#e74c3c'};">
            ${fcrChange < 0 ? '↓' : '↑'} ${Math.abs(fcrChange).toFixed(2)}
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);">${fcrChange < 0 ? 'Improved' : 'Worsened'}</div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

// ---- INJECT CHARTS INTO ANALYSIS ----
async function injectChartsIntoAnalysis() {
  const container = document.getElementById('analysis-content');
  if (!container) return;
  if (document.getElementById('chart-section')) return;
  
  const pondId = document.getElementById('analysis-pond')?.value;
  if (!pondId) return;
  
  const allPonds = await getAll('ponds');
  const pond = allPonds.find(p => p.id === pondId);
  if (!pond) return;
  
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);
  
  const chartSection = document.createElement('div');
  chartSection.id = 'chart-section';
  chartSection.innerHTML = `
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <h3 style="margin-bottom:12px;">Performance Charts</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">FCR Trend</div>
          <canvas id="chart-fcr" style="width:100%;height:200px;"></canvas>
        </div>
        <div style="background:var(--card-bg);padding:12px;border-radius:8px;box-shadow:var(--shadow);">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">Growth Trend</div>
          <canvas id="chart-growth" style="width:100%;height:200px;"></canvas>
        </div>
      </div>
    </div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <h3 style="margin-bottom:12px;">Trend Analysis</h3>
      <div id="trend-analysis"></div>
    </div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <h3 style="margin-bottom:12px;">Break-Even Sensitivity</h3>
      <div id="break-even-sensitivity"></div>
    </div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <h3 style="margin-bottom:12px;">Cross-Cycle Comparison</h3>
      <div id="cross-cycle-comparison"></div>
    </div>
  `;
  container.appendChild(chartSection);
  
  renderCharts(pond, logs, harvests);
  renderTrendAnalysis(pond, logs, harvests);
  renderBreakEvenSensitivity(pond, logs, harvests);
  renderCrossCycleComparison(pond, logs, harvests);
}

// ---- WRAPPER FUNCTION ----
async function renderFullAnalysis(pondId) {
  await renderAnalysis(pondId);
  await injectChartsIntoAnalysis();
}

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
        await renderFullAnalysis(pondId);
      }
      if (tab === 'decide') {
        await updateSelectors();
        const pondId = document.getElementById('decide-pond')?.value;
        await renderDecide(pondId);
      }
      if (tab === 'log') await updateSelectors();
      if (tab === 'harvest') {
        await updateSelectors();
        const pondId = document.getElementById('harvest-pond')?.value;
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
    const feedAmount = validateNumber(document.getElementById('log-feed-amount').value, 0);
    const feedCost = validateNumber(document.getElementById('log-feed-cost').value, 0);
    const mortality = validateInt(document.getElementById('log-mortality').value, 0);
    const weight = validateNumber(document.getElementById('log-weight').value, 0);
    
    if (temp === null || ph === null || salinity === null || doVal === null || ammonia === null) {
      showMessage('log-message', 'Please fill in all water quality fields with valid numbers.', 'error');
      return;
    }

    const log = {
      pondId, date: document.getElementById('log-date').value,
      temp, ph, salinity, do: doVal, ammonia,
      feedType: document.getElementById('log-feed-type').value,
      feedAmount, feedCost, mortality,
      cause: document.getElementById('log-cause').value.trim() || '',
      weather: document.getElementById('log-weather').value,
      weight, notes: document.getElementById('log-notes').value.trim() || '',
      createdAt: new Date().toISOString()
    };

    await add('dailyLogs', log);
    showMessage('log-message', 'Log saved successfully!', 'success');
    document.getElementById('log-form').reset();
    document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
    await updateSelectors();
    await renderPondList();
  });

  // --- HARVEST FORM ---
  document.getElementById('harvest-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pondId = document.getElementById('harvest-pond').value;
    if (!pondId) { showMessage('harvest-message', 'Please select a pond first.', 'error'); return; }
    
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
      pondId, date: document.getElementById('harvest-date').value,
      weight, price, revenue,
      buyer: document.getElementById('harvest-buyer').value.trim() || '',
      notes: document.getElementById('harvest-notes').value.trim() || '',
      createdAt: new Date().toISOString()
    };

    await add('harvests', harvest);
    const pond = (await getAll('ponds')).find(p => p.id === pondId);
    if (pond) { pond.harvested = true; await update('ponds', pond); }
    
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
    await renderHarvestList(e.target.value);
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
    await renderFullAnalysis(pondId);
  });

  // --- DECIDE POND SELECTOR ---
  document.getElementById('decide-pond')?.addEventListener('change', async (e) => {
    const pondId = e.target.value;
    await renderDecide(pondId);
  });

  // --- THEME ---
  document.getElementById('theme-light')?.addEventListener('click', () => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  });
  document.getElementById('theme-dark')?.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  });

  // --- LOAD SAMPLE DATA ---
  document.getElementById('load-sample-data')?.addEventListener('click', async () => {
    if (confirm('Load sample data? This will add a demo pond with 60 days of logs.')) {
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
    showMessage('log-message', 'Data exported! Last export date saved.', 'success');
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
      await renderPondList();
      await updateSelectors();
      showMessage('log-message', 'All data cleared.', 'info');
    }
  });
}

// ---- START ----
document.addEventListener('DOMContentLoaded', init);
