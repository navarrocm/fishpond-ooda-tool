// ============================================================
// UI HELPERS - Add this to your existing ui.js
// ============================================================

// ---- Render Decision Support ----
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
  
  // Import decision engine functions
  const { 
    generateDecisionMatrix, calculateOpportunityGainLoss,
    calculateCostBenefit, calculateReorderPoint,
    calculatePondHealthScore, calculateHistoricalAverages
  } = await import('./decide.js');
  
  // Build HTML
  let html = '';
  
  // ---- SECTION 1: Historical Averages (Law of Averages) ----
  const avgData = calculateHistoricalAverages(pond, logs, harvests);
  if (avgData && logs.length > 0) {
    html += `
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #3498db;">
        <h3 style="margin-bottom:8px;">📊 Historical Averages</h3>
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
  
  // ---- SECTION 2: Pond Health Score (Weighted Average) ----
  const weights = { temp: 0.20, ph: 0.20, salinity: 0.10, do: 0.25, ammonia: 0.15, fcr: 0.10 };
  const health = calculatePondHealthScore(logs, weights);
  if (health) {
    const color = health.score >= 80 ? '#2ecc71' : health.score >= 65 ? '#f39c12' : '#e74c3c';
    html += `
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid ${color};">
        <h3 style="margin-bottom:8px;">🏥 Pond Health Score</h3>
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="font-size:2.5rem;font-weight:700;color:${color};">${health.score}</div>
          <div>
            <div style="font-weight:600;">${health.rating}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">Weighted average of water quality factors</div>
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
      </div>
    `;
  }
  
  // ---- SECTION 3: Reorder Point ----
  if (logs.length > 0) {
    const dailyFeed = logs.reduce((s, l) => s + validateNumber(l.feedAmount, 0), 0) / Math.max(1, logs.length);
    if (dailyFeed > 0) {
      const reorder = calculateReorderPoint(dailyFeed, 5, 5);
      html += `
        <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid #e67e22;">
          <h3 style="margin-bottom:8px;">📦 Feed Reorder Point</h3>
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
  
  // ---- SECTION 4: Decision Matrix (Maximax/Maximin/Minimax) ----
  // Generate scenarios based on current status
  const currentWeight = status.totalWeightGain > 0 ? status.totalWeightGain : 1000;
  const currentPrice = 140; // Default or from market data
  
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
        <h3 style="margin-bottom:12px;">🎯 Decision Matrix</h3>
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
          💡 <strong>Recommendation:</strong> 
          ${decisionMatrix.maximin.label} is safest (Maximin). 
          ${decisionMatrix.maximax.label} gives highest potential profit (Maximax).
        </div>
      </div>
    `;
  }
  
  // ---- SECTION 5: Cost-Benefit Analysis ----
  if (status.totalCost > 0 && status.totalWeightGain > 0) {
    const currentProfit = status.totalRevenue - status.totalCost;
    const improvementBenefit = currentProfit * 0.15; // 15% improvement from investment
    
    const cba = calculateCostBenefit(15000, improvementBenefit, 3, 0.1);
    html += `
      <div style="background:var(--card-bg);padding:16px;border-radius:12px;box-shadow:var(--shadow);margin-bottom:16px;border-left:4px solid ${cba.recommended ? '#2ecc71' : '#e74c3c'};">
        <h3 style="margin-bottom:8px;">💰 Cost-Benefit Analysis</h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;">Example: Aerator Purchase (₱15,000 investment)</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;">
          <div><small>Investment</small><br><strong>${formatCurrency(cba.investmentCost)}</strong></div>
          <div><small>Annual Benefit</small><br><strong>${formatCurrency(cba.annualBenefit)}</strong></div>
          <div><small>NPV (3 yrs)</small><br><strong style="color:${cba.npv > 0 ? '#2ecc71' : '#e74c3c'};">${formatCurrency(cba.npv)}</strong></div>
          <div><small>Payback</small><br><strong>${cba.paybackPeriod} cycles</strong></div>
          <div><small>ROI</small><br><strong style="color:${cba.roi > 100 ? '#2ecc71' : '#f39c12'};">${cba.roi}%</strong></div>
        </div>
        <div style="font-size:0.85rem;font-weight:600;margin-top:6px;color:${cba.recommended ? '#2ecc71' : '#e74c3c'};">
          ${cba.recommended ? '✅ Recommended - Positive net value' : '❌ Not recommended - Negative net value'}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html || '<p style="color:var(--text-light);text-align:center;padding:40px 0;">Not enough data for decision support. Add more logs and harvests.</p>';
}
