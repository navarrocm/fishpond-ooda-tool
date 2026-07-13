// ============================================================
// OODA ENGINE - Calculations & Recommendations
// ============================================================

import { validateNumber } from './utils.js';

// ---- Phase Detection (Harvest-Aware) ----
export function getPhase(day, hasHarvest = false) {
  if (hasHarvest) return { id: 'post', label: 'Post-Harvest', color: '#95a5a6' };
  if (day <= 0) return { id: 'pre', label: 'Pre-Stocking', color: '#3498db' };
  if (day <= 30) return { id: 'early', label: 'Early Grow-out', color: '#2ecc71' };
  if (day <= 60) return { id: 'mid', label: 'Mid Grow-out', color: '#f39c12' };
  if (day <= 90) return { id: 'late', label: 'Late Grow-out', color: '#e67e22' };
  return { id: 'post', label: 'Post-Harvest', color: '#95a5a6' };
}

// ---- Core Calculations ----
export function calculateFCR(feedGiven, weightGain) {
  const f = validateNumber(feedGiven, 0);
  const w = validateNumber(weightGain, 0);
  if (!w || w <= 0 || !f || f <= 0) return null;
  return Math.round((f / w) * 100) / 100;
}

export function calculateSurvival(originalStocked, currentAlive) {
  const o = validateNumber(originalStocked, 0);
  const c = validateNumber(currentAlive, 0);
  if (!o || o <= 0) return null;
  return Math.round((c / o) * 100);
}

export function calculateDGR(currentWeight, stockingWeight, days) {
  const cw = validateNumber(currentWeight, 0);
  const sw = validateNumber(stockingWeight, 0);
  const d = validateNumber(days, 0);
  if (!d || d <= 0 || !cw || !sw) return null;
  return Math.round(((cw - sw) / d) * 100) / 100;
}

export function calculateBreakEven(totalCost, harvestWeight) {
  const tc = validateNumber(totalCost, 0);
  const hw = validateNumber(harvestWeight, 0);
  if (!hw || hw <= 0 || !tc || tc <= 0) return null;
  return Math.round((tc / hw) * 100) / 100;
}

export function calculateROI(netProfit, totalCost) {
  const np = validateNumber(netProfit, 0);
  const tc = validateNumber(totalCost, 0);
  if (!tc || tc <= 0) return null;
  return Math.round((np / tc) * 100);
}

// ---- Get Pond Status ----
export function getPondStatus(pond, logs, harvests) {
  const status = {
    phase: { id: 'pre', label: 'Pre-Stocking', color: '#3498db' },
    daysInCycle: 0,
    fcr: null,
    survival: null,
    dgr: null,
    breakEven: null,
    roi: null,
    totalFeed: 0,
    totalWeightGain: 0,
    currentAlive: pond.fingerlings || 0,
    currentWeight: 0,
    totalCost: 0,
    totalRevenue: 0,
    statusColor: 'green',
    statusText: 'No Data',
    hasHarvest: false,
    harvestCount: 0
  };

  if (!logs || logs.length === 0) {
    if (harvests && harvests.length > 0) {
      status.hasHarvest = true;
      status.harvestCount = harvests.length;
      status.phase = getPhase(0, true);
      status.statusText = 'Harvested';
    }
    return status;
  }

  // Sort logs by date
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstLog = sortedLogs[0];
  const lastLog = sortedLogs[sortedLogs.length - 1];

  // Check for harvests
  if (harvests && harvests.length > 0) {
    status.hasHarvest = true;
    status.harvestCount = harvests.length;
    status.phase = getPhase(0, true);
    status.statusText = 'Harvested';
  }

  // Calculate days in cycle (only if not harvested)
  if (!status.hasHarvest && pond.stockingDate) {
    const start = new Date(pond.stockingDate);
    const now = new Date();
    status.daysInCycle = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    status.phase = getPhase(status.daysInCycle, false);
  }

  // Calculate totals
  let totalFeed = 0;
  let totalMortality = 0;
  let totalCost = 0;
  let totalRevenue = 0;

  for (const log of logs) {
    totalFeed += validateNumber(log.feedAmount, 0);
    totalMortality += validateNumber(log.mortality, 0);
    totalCost += validateNumber(log.feedCost, 0);
  }

  for (const harvest of harvests || []) {
    totalRevenue += validateNumber(harvest.revenue, 0);
    // Harvest cost is already accounted in logs
  }

  status.totalFeed = Math.round(totalFeed * 100) / 100;
  status.totalCost = Math.round(totalCost * 100) / 100;
  status.totalRevenue = Math.round(totalRevenue * 100) / 100;

  // Current alive
  const totalStocked = pond.fingerlings || 0;
  status.currentAlive = Math.max(0, totalStocked - totalMortality);
  status.survival = calculateSurvival(totalStocked, status.currentAlive);

  // FCR (if we have weight data)
  const latestWeight = validateNumber(lastLog?.weight, 0);
  const stockingWeight = validateNumber(pond.stockingWeight, 0);
  if (latestWeight > 0 && stockingWeight > 0) {
    const totalWeightGain = (status.currentAlive * (latestWeight - stockingWeight)) / 1000;
    status.totalWeightGain = Math.round(totalWeightGain * 100) / 100;
    status.fcr = calculateFCR(totalFeed, totalWeightGain);
    status.dgr = calculateDGR(latestWeight, stockingWeight, status.daysInCycle);
    status.currentWeight = latestWeight;
  }

  // Break-even & ROI
  const harvestWeight = harvests && harvests.length > 0 
    ? harvests.reduce((sum, h) => sum + validateNumber(h.weight, 0), 0)
    : status.totalWeightGain;
  
  if (harvestWeight > 0) {
    status.breakEven = calculateBreakEven(status.totalCost, harvestWeight);
  }
  if (status.totalCost > 0 && status.totalRevenue > 0) {
    const netProfit = status.totalRevenue - status.totalCost;
    status.roi = calculateROI(netProfit, status.totalCost);
  }

  // Determine status color
  if (status.hasHarvest) {
    status.statusColor = 'green';
    status.statusText = '✅ Harvested';
    if (status.roi !== null && status.roi < 50) {
      status.statusColor = 'yellow';
      status.statusText = '⚠️ Low ROI';
    }
    if (status.roi !== null && status.roi < 0) {
      status.statusColor = 'red';
      status.statusText = '❌ Loss';
    }
  } else if (status.survival !== null && status.survival < 70) {
    status.statusColor = 'red';
    status.statusText = '🚨 Critical';
  } else if (status.fcr !== null && status.fcr > 1.8) {
    status.statusColor = 'yellow';
    status.statusText = '⚠️ Monitor FCR';
  } else if (status.survival !== null && status.survival < 85) {
    status.statusColor = 'yellow';
    status.statusText = '⚠️ Monitor Survival';
  } else if (status.daysInCycle > 0) {
    status.statusColor = 'green';
    status.statusText = '🌱 Growing';
  } else {
    status.statusColor = 'green';
    status.statusText = 'Ready';
  }

  return status;
}

// ---- Generate Recommendations ----
export function generateRecommendations(pond, logs, harvests, tideData) {
  const status = getPondStatus(pond, logs, harvests);
  const phase = status.phase;
  const recommendations = {
    observations: [],
    orientation: [],
    decision: [],
    action: [],
    confidence: 'moderate'
  };

  // ---- OBSERVE ----
  if (logs && logs.length > 0) {
    const recent = logs.slice(-7);
    const avgTemp = recent.reduce((s, l) => s + validateNumber(l.temp, 0), 0) / recent.length;
    const avgPh = recent.reduce((s, l) => s + validateNumber(l.ph, 0), 0) / recent.length;
    const avgDo = recent.reduce((s, l) => s + validateNumber(l.do, 0), 0) / recent.length;
    const avgAmmonia = recent.reduce((s, l) => s + validateNumber(l.ammonia, 0), 0) / recent.length;

    recommendations.observations.push(`Avg temp: ${avgTemp.toFixed(1)}°C`);
    recommendations.observations.push(`Avg pH: ${avgPh.toFixed(1)}`);
    recommendations.observations.push(`Avg DO: ${avgDo.toFixed(1)} ppm`);
    recommendations.observations.push(`Avg ammonia: ${avgAmmonia.toFixed(2)} ppm`);

    if (avgTemp < 25 || avgTemp > 32) {
      recommendations.observations.push('⚠️ Temp outside optimal (27-30°C)');
    }
    if (avgPh < 6.5 || avgPh > 9.0) {
      recommendations.observations.push('⚠️ pH outside optimal (7.5-8.5)');
    }
    if (avgDo < 3) {
      recommendations.observations.push('🚨 DO critically low (<3 ppm)!');
    }
    if (avgAmmonia > 1.0) {
      recommendations.observations.push('🚨 Ammonia high (>1.0 ppm)!');
    }
  }

  // ---- ORIENT ----
  if (status.hasHarvest) {
    recommendations.orientation.push(`🌾 Harvested: ${status.harvestCount} records`);
    if (status.roi !== null) {
      recommendations.orientation.push(`ROI: ${status.roi}%`);
    }
    if (status.breakEven !== null) {
      recommendations.orientation.push(`Break-even: ₱${status.breakEven}/kg`);
    }
  } else {
    if (status.survival !== null) {
      recommendations.orientation.push(`Survival: ${status.survival}% (target >85%)`);
    }
    if (status.fcr !== null) {
      recommendations.orientation.push(`FCR: ${status.fcr} (target <1.5)`);
    }
    if (status.dgr !== null) {
      recommendations.orientation.push(`DGR: ${status.dgr} g/day (target 2-3)`);
    }
  }

  // ---- DECIDE ----
  if (status.hasHarvest) {
    recommendations.decision.push(`📊 Cycle complete. ${status.roi !== null && status.roi > 0 ? '✅ Profitable' : '⚠️ Review needed'}`);
    if (status.roi !== null && status.roi < 50) {
      recommendations.decision.push('ROI below target. Review feed costs and survival rate.');
    }
  } else if (phase.id === 'pre') {
    recommendations.decision.push('Ready to stock.');
    if (pond.area) {
      const density = Math.round(pond.area * 7500);
      recommendations.decision.push(`Recommended stocking: ${density} fingerlings (${pond.area}ha × 7,500/ha)`);
    }
  } else if (phase.id === 'early') {
    if (status.survival !== null && status.survival < 85) {
      recommendations.decision.push('⚠️ Survival below target. Check water quality.');
    } else {
      recommendations.decision.push('Early grow-out on track.');
    }
  } else if (phase.id === 'mid') {
    if (status.fcr !== null && status.fcr > 1.8) {
      recommendations.decision.push('⚠️ FCR high. Consider better feed.');
    } else if (status.fcr !== null && status.fcr < 1.5) {
      recommendations.decision.push('✅ Excellent FCR. Maintain feeding.');
    }
  } else if (phase.id === 'late') {
    recommendations.decision.push('🔄 Harvest window approaching.');
    if (status.breakEven !== null && status.breakEven < 100) {
      recommendations.decision.push(`💰 Break-even: ₱${status.breakEven}/kg. Likely profitable.`);
    }
  }

  // ---- ACT ----
  if (status.hasHarvest) {
    recommendations.action.push('Clean and prepare pond for next cycle.');
    recommendations.action.push('Review this cycle\'s data for improvements.');
    recommendations.action.push('Plan next stocking based on lessons learned.');
  } else if (phase.id === 'pre') {
    recommendations.action.push('Prepare pond: dry, lime, fertilize.');
    recommendations.action.push('Order fingerlings from trusted hatchery.');
    recommendations.action.push('Set up water monitoring schedule.');
  } else if (phase.id === 'early') {
    recommendations.action.push('Feed at 5% body weight daily, 2-3 feedings.');
    recommendations.action.push('Monitor water quality daily.');
    recommendations.action.push('Check for disease signs daily.');
  } else if (phase.id === 'mid') {
    recommendations.action.push('Increase feeding to 4-6% body weight.');
    recommendations.action.push('Sample fish weekly to track growth.');
    recommendations.action.push('Prepare for potential disease outbreaks.');
  } else if (phase.id === 'late') {
    recommendations.action.push('Contact buyers 1-2 weeks before harvest.');
    recommendations.action.push('Withhold feeding 24 hours before harvest.');
    recommendations.action.push('Prepare harvest equipment (nets, ice, transport).');
  }

  return recommendations;
}
