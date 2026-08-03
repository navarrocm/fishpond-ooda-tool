// ============================================================
// OODA ENGINE - Multi-Species v2 (Operation Type Aware)
// ============================================================

import { getById, getByIndex, getSpeciesTotals, getSpeciesLogFromEntry } from './db.js';
import { getSpecies, getSpeciesTargets, getOperationTypeLabel } from './species.js';
import { validateNumber } from './utils.js';

// ---- Safe Average ----
export function safeAverage(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
}

// ---- Phase Detection ----
export function getPhase(day, hasHarvest = false) {
  if (hasHarvest) return { id: 'post', label: 'Post-Harvest', color: '#95a5a6' };
  if (day <= 0) return { id: 'pre', label: 'Pre-Stocking', color: '#3498db' };
  if (day <= 30) return { id: 'early', label: 'Early Grow-out', color: '#2ecc71' };
  if (day <= 60) return { id: 'mid', label: 'Mid Grow-out', color: '#f39c12' };
  if (day <= 90) return { id: 'late', label: 'Late Grow-out', color: '#e67e22' };
  return { id: 'post', label: 'Post-Harvest', color: '#95a5a6' };
}

// ---- Get Species Status (Operation Type Aware) ----
export async function getSpeciesStatus(pondId, speciesId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return null;

  const speciesData = pond.species.find(s => s.speciesId === speciesId);
  if (!speciesData) return null;

  const species = getSpecies(speciesId);
  if (!species) return null;

  const operationType = speciesData.operationType || pond.operationType || 'growout';
  const targets = getSpeciesTargets(speciesId, operationType);

  const totals = await getSpeciesTotals(pondId, speciesId);
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);

  // Calculate days in cycle
  let daysInCycle = 0;
  let doc = null;
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedLogs.length > 0) {
    const firstLog = sortedLogs[0];
    const firstLogSpecies = getSpeciesLogFromEntry(firstLog, speciesId);
    if (firstLogSpecies && firstLogSpecies.doc !== undefined) {
      doc = firstLogSpecies.doc;
    } else {
      const start = new Date(speciesData.stockingDate);
      const now = new Date();
      daysInCycle = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    }
  }

  const hasHarvest = harvests.some(h => h.speciesId === speciesId);

  // Get operation-specific targets
  const targetFCR = targets?.targetFCR || species.targetFCR?.growout || null;
  const targetSurvival = targets?.targetSurvival || species.targetSurvival?.growout || null;
  const maturityDays = targets?.maturityDays || species.maturityDays?.growout || null;

  // Determine status
  let statusColor = 'green';
  let statusText = 'Active';
  
  if (hasHarvest) {
    statusColor = 'green';
    statusText = 'Harvested';
  } else if (totals.survival !== null && targetSurvival !== null && totals.survival < targetSurvival) {
    statusColor = 'red';
    statusText = '⚠️ Low Survival';
  } else if (totals.fcr !== null && targetFCR !== null && totals.fcr > targetFCR) {
    statusColor = 'yellow';
    statusText = '⚠️ High FCR';
  } else if (daysInCycle > 0 && maturityDays !== null && daysInCycle > maturityDays * 0.9) {
    statusColor = 'yellow';
    statusText = '🔔 Ready for Harvest';
  }

  return {
    speciesId,
    speciesName: species.name,
    speciesIcon: species.icon,
    speciesColor: species.color,
    operationType: operationType,
    ...totals,
    daysInCycle: daysInCycle || doc || 0,
    doc: doc || daysInCycle || 0,
    hasHarvest,
    targetFCR,
    targetSurvival,
    maturityDays,
    phase: getPhase(daysInCycle || doc || 0, hasHarvest),
    statusColor,
    statusText
  };
}

// ---- Get Pond Status (Multi-Species, Operation Aware) ----
export async function getPondStatus(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return null;

  const operationType = pond.operationType || 'growout';
  const operationLabel = getOperationTypeLabel(operationType);

  const speciesStatus = [];
  let totalFingerlings = 0;
  let totalRevenue = 0;
  let totalCost = 0;

  for (const sp of pond.species || []) {
    const status = await getSpeciesStatus(pondId, sp.speciesId);
    if (status) {
      speciesStatus.push(status);
      totalFingerlings += sp.fingerlings || 0;
      totalRevenue += status.totalRevenue || 0;
      totalCost += status.totalFeedCost || 0;
    }
  }

  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  let latestWaterQuality = null;
  if (logs.length > 0) {
    const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = sorted[sorted.length - 1];
    latestWaterQuality = {
      temp: latest.temp,
      ph: latest.ph,
      salinity: latest.salinity,
      do: latest.do,
      ammonia: latest.ammonia,
      nitrate: latest.nitrate,
      nitrite: latest.nitrite,
      date: latest.date
    };
  }

  return {
    id: pond.id,
    name: pond.name,
    area: pond.area,
    location: pond.location,
    operationType: operationType,
    operationLabel: operationLabel,
    species: speciesStatus,
    totalFingerlings,
    totalRevenue,
    totalCost,
    netProfit: totalRevenue - totalCost,
    latestWaterQuality,
    hasHarvest: speciesStatus.some(s => s.hasHarvest),
    allHarvested: speciesStatus.every(s => s.hasHarvest),
    dataCompleteness: {
      speciesCount: speciesStatus.length,
      harvestedCount: speciesStatus.filter(s => s.hasHarvest).length
    }
  };
}

// ---- Generate Multi-Species Recommendations (Operation Aware) ----
export async function generateMultiSpeciesRecommendations(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return null;

  const status = await getPondStatus(pondId);
  if (!status) return null;

  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const recs = {
    observations: [],
    orientation: [],
    decision: [],
    action: [],
    speciesRecs: {},
    confidence: 'moderate',
    dataWarning: null
  };

  const operationLabel = status.operationLabel;
  const isNursery = status.operationType === 'nursery';

  // Operation-specific context
  recs.observations.push(`📋 Operation Type: ${operationLabel}`);
  if (isNursery) {
    recs.observations.push('🐣 Nursery operation: Fry to fingerlings. Quick turnaround (30-60 days).');
  } else {
    recs.observations.push('🌾 Grow-out operation: Harvest at market size.');
  }

  // Water quality observations
  if (status.latestWaterQuality) {
    const wq = status.latestWaterQuality;
    recs.observations.push(`Water Quality (${wq.date}): Temp ${wq.temp}°C, pH ${wq.ph}, DO ${wq.do}ppm`);

    if (wq.temp < 25 || wq.temp > 32) {
      recs.observations.push('⚠️ Temperature outside optimal range (27-30°C)');
    }
    if (wq.ph < 6.5 || wq.ph > 9.0) {
      recs.observations.push('⚠️ pH outside optimal range (7.5-8.5)');
    }
    if (wq.do < 3) {
      recs.observations.push('🚨 DO critically low (<3 ppm)!');
    }
    if (wq.ammonia > 0.5) {
      recs.observations.push(`⚠️ Ammonia high (${wq.ammonia} ppm)`);
    }
  }

  // Species-specific observations
  for (const sp of status.species) {
    const species = getSpecies(sp.speciesId);
    if (!species) continue;

    const targets = getSpeciesTargets(sp.speciesId, status.operationType);
    
    if (sp.survival !== null && targets?.targetSurvival !== null) {
      if (sp.survival < targets.targetSurvival) {
        recs.observations.push(`⚠️ ${species.name}: Survival ${sp.survival}% (target ${targets.targetSurvival}%)`);
      }
    }
    if (sp.fcr !== null && targets?.targetFCR !== null) {
      if (sp.fcr > targets.targetFCR) {
        recs.observations.push(`⚠️ ${species.name}: FCR ${sp.fcr} (target ${targets.targetFCR})`);
      }
    }
    
    // Nursery-specific: check if ready for harvest
    if (isNursery && sp.daysInCycle > 0 && targets?.maturityDays !== null) {
      if (sp.daysInCycle >= targets.maturityDays * 0.8) {
        recs.observations.push(`🐣 ${species.name}: Ready for harvest in approximately ${Math.round(targets.maturityDays - sp.daysInCycle)} days`);
      }
    }
  }

  // Decisions
  if (status.allHarvested) {
    recs.decision.push('✅ All species harvested. Prepare for next cycle.');
    if (status.netProfit < 0) {
      recs.decision.push('⚠️ Overall loss. Review costs and survival rates.');
    }
    recs.action.push('Clean and prepare pond for next cycle.');
    recs.action.push('Review species performance data.');
    if (isNursery) {
      recs.action.push('🔄 Plan next nursery batch. Consider timing for market demand.');
    }
  } else if (status.hasHarvest) {
    recs.decision.push('🔄 Some species harvested. Monitor remaining species.');
    recs.action.push('Continue monitoring unharvested species.');
  } else {
    // Check if any species is ready for harvest
    let harvestReady = false;
    for (const sp of status.species) {
      const species = getSpecies(sp.speciesId);
      if (!species) continue;
      const targets = getSpeciesTargets(sp.speciesId, status.operationType);
      if (targets?.maturityDays && sp.daysInCycle >= targets.maturityDays * 0.85) {
        harvestReady = true;
        recs.decision.push(`📊 ${species.name} approaching ${isNursery ? 'fingerling size' : 'harvest'} maturity (Day ${sp.daysInCycle}/${targets.maturityDays})`);
        recs.action.push(`Prepare for ${species.name} ${isNursery ? 'fingerling sale' : 'harvest'} in ${Math.round(targets.maturityDays - sp.daysInCycle)} days.`);
      }
    }
    if (!harvestReady) {
      if (isNursery) {
        recs.decision.push('🐣 Nursery grow-out in progress. Continue monitoring.');
        recs.action.push('Monitor fry growth daily.');
        recs.action.push('Ensure starter feed availability.');
      } else {
        recs.decision.push('🌱 Grow-out in progress. Continue monitoring.');
        recs.action.push('Monitor water quality daily.');
        recs.action.push('Track feed consumption by species.');
      }
    }
  }

  // Nursery-specific actions
  if (isNursery) {
    recs.action.push('🐣 Check fry survival and growth rates.');
    recs.action.push('Monitor for cannibalism and size grading needs.');
    recs.action.push('Prepare marketing for fingerling sale.');
  }

  return recs;
}

// ---- Get Polyculture Recommendation (Operation Aware) ----
export function getPolycultureRecommendation(speciesIds) {
  // Re-export from species.js
  return getPolycultureCompatibility(speciesIds);
}
