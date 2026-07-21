// ============================================================
// OODA ENGINE - Calculations & Recommendations
// ============================================================

import { validateNumber } from './utils.js';

// ---- Safe Average (Skips null/undefined values) ----
export function safeAverage(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}

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

// ---- Get Data Completeness ----
export function getDataCompleteness(logs) {
  if (!logs || logs.length === 0) {
    return { completeness: 0, available: [], missing: [], totalFields: 0 };
  }
  
  const fields = ['temp', 'ph', 'salinity', 'do', 'ammonia', 'feedAmount', 'feedCost'];
  const available = [];
  const missing = [];
  
  for (const field of fields) {
    const hasData = logs.some(l => {
      const val = validateNumber(l[field]);
      return val !== null && val !== undefined && !isNaN(val);
    });
    if (hasData) {
      available.push(field);
    } else {
      missing.push(field);
    }
  }
  
  const totalFields = fields.length;
  const completeness = Math.round((available.length / totalFields) * 100);
  
  return { completeness, available, missing, totalFields };
}

// ---- Get Pond Status (Updated with partial data support) ----
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
    harvestCount: 0,
    dataCompleteness: { completeness: 0, available: [], missing: [], totalFields: 0 }
  };

  if (!logs || logs.length === 0) {
    if (harvests && harvests.length > 0) {
      status.hasHarvest = true;
      status.harvestCount = harvests.length;
      status.phase = getPhase(0, true);
      status.statusText = 'Harvested';
    }
    status.dataCompleteness = getDataCompleteness(logs);
    return status;
  }

  const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastLog = sortedLogs[sortedLogs.length - 1];

  if (harvests && harvests.length > 0) {
    status.hasHarvest = true;
    status.harvestCount = harvests.length;
    status.phase = getPhase(0, true);
    status.statusText = 'Harvested';
  }

  if (!status.hasHarvest && pond.stockingDate) {
    const start = new Date(pond.stockingDate);
    const now = new Date();
    status.daysInCycle = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    status.phase = getPhase(status.daysInCycle, false);
  }

  let totalFeed = 0, totalMortality = 0, totalCost = 0, totalRevenue = 0;
  let hasFeedData = false;
  let hasCostData = false;
  
  for (const log of logs) {
    const feed = validateNumber(log.feedAmount, 0);
    const cost = validateNumber(log.feedCost, 0);
    totalFeed += feed;
    totalCost += cost;
    totalMortality += validateNumber(log.mortality, 0);
    if (feed > 0) hasFeedData = true;
    if (cost > 0) hasCostData = true;
  }
  for (const harvest of harvests || []) {
    totalRevenue += validateNumber(harvest.revenue, 0);
  }

  status.totalFeed = Math.round(totalFeed * 100) / 100;
  status.totalCost = Math.round(totalCost * 100) / 100;
  status.totalRevenue = Math.round(totalRevenue * 100) / 100;

  // Only calculate survival if we have mortality data or stocking data
  const totalStocked = pond.fingerlings || 0;
  if (totalStocked > 0 || totalMortality > 0) {
    status.currentAlive = Math.max(0, totalStocked - totalMortality);
    status.survival = calculateSurvival(totalStocked, status.currentAlive);
  }

  // Only calculate FCR if we have feed and weight data
  const latestWeight = validateNumber(lastLog?.weight, 0);
  const stockingWeight = validateNumber(pond.stockingWeight, 0);
  if (hasFeedData && latestWeight > 0 && stockingWeight > 0) {
    const totalWeightGain = (status.currentAlive * (latestWeight - stockingWeight)) / 1000;
    status.totalWeightGain = Math.round(totalWeightGain * 100) / 100;
    status.fcr = calculateFCR(totalFeed, totalWeightGain);
    status.dgr = calculateDGR(latestWeight, stockingWeight, status.daysInCycle);
    status.currentWeight = latestWeight;
  }

  // Break-even and ROI (only if we have cost and harvest data)
  const harvestWeight = harvests && harvests.length > 0 
    ? harvests.reduce((sum, h) => sum + validateNumber(h.weight, 0), 0)
    : status.totalWeightGain;
  
  if (hasCostData && harvestWeight > 0) {
    status.breakEven = calculateBreakEven(status.totalCost, harvestWeight);
  }
  if (hasCostData && status.totalRevenue > 0) {
    const netProfit = status.totalRevenue - status.totalCost;
    status.roi = calculateROI(netProfit, status.totalCost);
  }

  // Determine status color (with partial data awareness)
  if (status.hasHarvest) {
    status.statusColor = 'green';
    status.statusText = 'Harvested';
    if (status.roi !== null && status.roi < 50) { status.statusColor = 'yellow'; status.statusText = 'Low ROI'; }
    if (status.roi !== null && status.roi < 0) { status.statusColor = 'red'; status.statusText = 'Loss'; }
  } else if (status.survival !== null && status.survival < 70) {
    status.statusColor = 'red'; status.statusText = 'Critical';
  } else if (status.fcr !== null && status.fcr > 1.8) {
    status.statusColor = 'yellow'; status.statusText = 'Monitor FCR';
  } else if (status.survival !== null && status.survival < 85) {
    status.statusColor = 'yellow'; status.statusText = 'Monitor Survival';
  } else if (status.daysInCycle > 0) {
    status.statusColor = 'green'; status.statusText = 'Growing';
  } else {
    status.statusColor = 'green'; status.statusText = 'Ready';
  }

  // Add data completeness
  status.dataCompleteness = getDataCompleteness(logs);

  return status;
}

// ---- Generate Recommendations (Updated with partial data awareness) ----
export function generateRecommendations(pond, logs, harvests, tideData) {
  const status = getPondStatus(pond, logs, harvests);
  const phase = status.phase;
  const completeness = status.dataCompleteness;
  const recs = { 
    observations: [], 
    orientation: [], 
    decision: [], 
    action: [], 
    confidence: 'moderate',
    dataWarning: null
  };

  // ---- Data Completeness Warning ----
  if (completeness.completeness < 50) {
    recs.dataWarning = 'Limited data available. Recommendations are based on incomplete data.';
    recs.confidence = 'low';
  } else if (completeness.completeness < 80) {
    recs.dataWarning = 'Some data fields are missing. Recommendations may be less accurate.';
    recs.confidence = 'moderate';
  }

  // ---- OBSERVE ----
  if (logs && logs.length > 0) {
    const recent = logs.slice(-7);
    
    // Only calculate averages for fields that have data
    const temps = recent.map(l => validateNumber(l.temp)).filter(v => v !== null);
    const phs = recent.map(l => validateNumber(l.ph)).filter(v => v !== null);
    const dos = recent.map(l => validateNumber(l.do)).filter(v => v !== null);
    const ammonias = recent.map(l => validateNumber(l.ammonia)).filter(v => v !== null);
    const salinities = recent.map(l => validateNumber(l.salinity)).filter(v => v !== null);
    
    if (temps.length > 0) {
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      recs.observations.push(`Temperature: ${avgTemp.toFixed(1)}°C (${temps.length}/${recent.length} days)`);
      if (avgTemp < 25 || avgTemp > 32) {
        recs.observations.push('⚠️ Temperature outside optimal range (27-30°C)');
      }
    } else {
      recs.observations.push('⚠️ Temperature data missing');
    }
    
    if (phs.length > 0) {
      const avgPh = phs.reduce((a, b) => a + b, 0) / phs.length;
      recs.observations.push(`pH: ${avgPh.toFixed(1)} (${phs.length}/${recent.length} days)`);
      if (avgPh < 6.5 || avgPh > 9.0) {
        recs.observations.push('⚠️ pH outside optimal range (7.5-8.5)');
      }
    } else {
      recs.observations.push('⚠️ pH data missing');
    }
    
    if (dos.length > 0) {
      const avgDo = dos.reduce((a, b) => a + b, 0) / dos.length;
      recs.observations.push(`DO: ${avgDo.toFixed(1)} ppm (${dos.length}/${recent.length} days)`);
      if (avgDo < 3) {
        recs.observations.push('🚨 DO critically low (<3 ppm)!');
      }
    } else {
      recs.observations.push('⚠️ Dissolved Oxygen data missing');
    }
    
    if (ammonias.length > 0) {
      const avgAmmonia = ammonias.reduce((a, b) => a + b, 0) / ammonias.length;
      recs.observations.push(`Ammonia: ${avgAmmonia.toFixed(2)} ppm (${ammonias.length}/${recent.length} days)`);
      if (avgAmmonia > 1.0) {
        recs.observations.push('🚨 Ammonia high (>1.0 ppm)!');
      }
    } else {
      recs.observations.push('⚠️ Ammonia data missing');
    }
    
    if (salinities.length > 0) {
      const avgSalinity = salinities.reduce((a, b) => a + b, 0) / salinities.length;
      recs.observations.push(`Salinity: ${avgSalinity.toFixed(1)} ppt (${salinities.length}/${recent.length} days)`);
    } else {
      recs.observations.push('⚠️ Salinity data missing');
    }
  }

  // ---- ORIENT ----
  if (status.hasHarvest) {
    recs.orientation.push(`Harvested: ${status.harvestCount} records`);
    if (status.roi !== null) recs.orientation.push(`ROI: ${status.roi}%`);
    if (status.breakEven !== null) recs.orientation.push(`Break-even: ₱${status.breakEven}/kg`);
  } else {
    if (status.survival !== null) {
      recs.orientation.push(`Survival: ${status.survival}% (target >85%)`);
    } else {
      recs.orientation.push('⚠️ Survival rate unavailable (no mortality data)');
    }
    if (status.fcr !== null) {
      recs.orientation.push(`FCR: ${status.fcr} (target <1.5)`);
    } else {
      recs.orientation.push('⚠️ FCR unavailable (need feed and weight data)');
    }
    if (status.dgr !== null) {
      recs.orientation.push(`DGR: ${status.dgr} g/day (target 2-3)`);
    } else {
      recs.orientation.push('⚠️ Growth rate unavailable (need weight data)');
    }
  }

  // ---- DECIDE ----
  if (status.hasHarvest) {
    recs.decision.push(`Cycle complete. ${status.roi !== null && status.roi > 0 ? 'Profitable' : 'Review needed'}`);
    if (status.roi !== null && status.roi < 50) {
      recs.decision.push('ROI below target. Review feed costs and survival rate.');
    }
    recs.action.push('Clean and prepare pond for next cycle.');
    recs.action.push('Review this cycle\'s data for improvements.');
    recs.action.push('Plan next stocking based on lessons learned.');
  } else if (phase.id === 'pre') {
    recs.decision.push('Ready to stock.');
    if (pond.area) {
      const density = Math.round(pond.area * 7500);
      recs.decision.push(`Recommended stocking: ${density} fingerlings (${pond.area}ha × 7,500/ha)`);
    }
    recs.action.push('Prepare pond: dry, lime, fertilize.');
    recs.action.push('Order fingerlings from trusted hatchery.');
    recs.action.push('Set up water monitoring schedule.');
  } else if (phase.id === 'early') {
    if (status.survival !== null && status.survival < 85) {
      recs.decision.push('⚠️ Survival below target. Check water quality.');
    } else if (status.survival === null) {
      recs.decision.push('⚠️ Survival data missing. Track mortality to assess health.');
    } else {
      recs.decision.push('Early grow-out on track.');
    }
    recs.action.push('Feed at 5% body weight daily, 2-3 feedings.');
    recs.action.push('Monitor water quality daily.');
    recs.action.push('Check for disease signs daily.');
  } else if (phase.id === 'mid') {
    if (status.fcr !== null && status.fcr > 1.8) {
      recs.decision.push('⚠️ FCR high. Consider better feed.');
    } else if (status.fcr === null) {
      recs.decision.push('⚠️ FCR data missing. Track feed and weight.');
    } else if (status.fcr !== null && status.fcr < 1.5) {
      recs.decision.push('✅ Excellent FCR. Maintain feeding.');
    }
    recs.action.push('Increase feeding to 4-6% body weight.');
    recs.action.push('Sample fish weekly to track growth.');
    recs.action.push('Prepare for potential disease outbreaks.');
  } else if (phase.id === 'late') {
    recs.decision.push('Harvest window approaching.');
    if (status.breakEven !== null && status.breakEven < 100) {
      recs.decision.push(`💰 Break-even: ₱${status.breakEven}/kg. Likely profitable.`);
    } else if (status.breakEven === null) {
      recs.decision.push('⚠️ Break-even data missing. Track costs and expected harvest.');
    }
    recs.action.push('Contact buyers 1-2 weeks before harvest.');
    recs.action.push('Withhold feeding 24 hours before harvest.');
    recs.action.push('Prepare harvest equipment (nets, ice, transport).');
  }

  // ---- Data completeness recommendation ----
  if (completeness.missing.length > 0) {
    recs.action.push(`📊 Suggested measurements: ${completeness.missing.join(', ')}`);
  }

  return recs;
}
