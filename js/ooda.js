// ============================================================
// OODA ENGINE - Multi-Species v2
// ============================================================

import { validateNumber } from './utils.js';
import { getSpecies, getSpeciesRecommendations, getSpeciesColor, getSpeciesIcon } from './species.js';
import { getById, getSpeciesTotals, getSpeciesLogFromEntry } from './db.js';

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

// ---- Get Species Status ----
export async function getSpeciesStatus(pondId, speciesId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return null;

  const speciesData = pond.species.find(s => s.speciesId === speciesId);
  if (!speciesData) return null;

  const species = getSpecies(speciesId);
  if (!species) return null;

  const totals = await getSpeciesTotals(pondId, speciesId);
  const logs = await getByIndex('dailyLogs', 'pondId', pondId);
  const harvests = await getByIndex('harvests', 'pondId', pondId);

  // Calculate days in cycle
  let daysInCycle = 0;
  let doc = null;
  const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedLogs.length > 0) {
    const firstLog = sortedLogs[0];
    const lastLog = sortedLogs[sortedLogs.length - 1];
    // Get DOC from first log or calculate
    const firstLogSpecies = getSpeciesLogFromEntry(firstLog, speciesId);
    if (firstLogSpecies && firstLogSpecies.doc !== undefined) {
      doc = firstLogSpecies.doc;
    } else {
      const start = new Date(speciesData.stockingDate);
      const now = new Date();
      daysInCycle = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    }
  }

  // Check if harvested
  const hasHarvest = harvests.some(h => h.speciesId === speciesId);

  return {
    speciesId,
    speciesName: species.name,
    speciesIcon: species.icon,
    speciesColor: species.color,
    ...totals,
    daysInCycle: daysInCycle || doc || 0,
    doc: doc || daysInCycle || 0,
    hasHarvest,
    targetFCR: species.targetFCR,
    targetSurvival: species.targetSurvival,
    phase: getPhase(daysInCycle || doc || 0, hasHarvest),
    statusColor: totals.survival !== null && totals.survival < species.targetSurvival ? 'red' :
      totals.fcr !== null && totals.fcr > species.targetFCR ? 'yellow' : 'green',
    statusText: hasHarvest ? 'Harvested' :
      totals.survival !== null && totals.survival < species.targetSurvival ? '⚠️ Low Survival' :
      totals.fcr !== null && totals.fcr > species.targetFCR ? '⚠️ High FCR' : 'Growing'
  };
}

// ---- Get Pond Status (Multi-Species) ----
export async function getPondStatus(pondId) {
  const pond = await getById('ponds', pondId);
  if (!pond) return null;

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

  // Water quality from latest log
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

// ---- Generate Recommendations (Multi-Species) ----
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
    confidence: 'moderate'
  };

  // --- Water quality observations ---
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
    if (wq.nitrite > 0.5) {
      recs.observations.push(`🚨 Nitrite high (${wq.nitrite} ppm) - toxic!`);
    }
    if (wq.nitrate > 50) {
      recs.observations.push(`⚠️ Nitrate high (${wq.nitrate} ppm) - consider water exchange`);
    }
  }

  // --- Species-specific observations ---
  for (const sp of status.species) {
    const species = getSpecies(sp.speciesId);
    if (!species) continue;

    const spRecs = getSpeciesRecommendations(species.id, status.latestWaterQuality || {}, sp);
    if (spRecs.length > 0) {
      recs.speciesRecs[sp.speciesId] = spRecs;
      recs.observations.push(`🐟 ${species.name}: ${spRecs.join('; ')}`);
    }

    // Orientation
    if (sp.survival !== null) {
      recs.orientation.push(`${species.name}: Survival ${sp.survival}% (target ${species.targetSurvival}%)`);
    }
    if (sp.fcr !== null && species.targetFCR) {
      recs.orientation.push(`${species.name}: FCR ${sp.fcr} (target ${species.targetFCR})`);
    }
  }

  // --- Decisions ---
  const allHarvested = status.allHarvested;
  const someHarvested = status.species.some(s => s.hasHarvest);

  if (allHarvested) {
    recs.decision.push('✅ All species harvested. Prepare for next cycle.');
    if (status.netProfit < 0) {
      recs.decision.push('⚠️ Overall loss. Review costs and survival rates.');
    }
    recs.action.push('Clean and prepare pond for next cycle.');
    recs.action.push('Review species performance data.');
    recs.action.push('Plan next stocking composition.');
  } else if (someHarvested) {
    recs.decision.push('🔄 Some species harvested. Monitor remaining species.');
    recs.action.push('Continue monitoring unharvested species.');
    recs.action.push('Consider partial water exchange.');
  } else {
    // Check if any species is ready for harvest
    for (const sp of status.species) {
      const species = getSpecies(sp.speciesId);
      if (!species) continue;
      if (sp.daysInCycle >= species.maturityDays * 0.9) {
        recs.decision.push(`📊 ${species.name} approaching harvest maturity (Day ${sp.daysInCycle}/${species.maturityDays})`);
        recs.action.push(`Prepare for ${species.name} harvest in ${Math.round(species.maturityDays - sp.daysInCycle)} days.`);
      }
    }

    if (recs.decision.length === 0) {
      recs.decision.push('🌱 Grow-out in progress. Continue monitoring.');
    }
  }

  // --- Action items ---
  if (!allHarvested) {
    recs.action.push('Monitor water quality daily.');
    recs.action.push('Track feed consumption by species.');
    recs.action.push('Check for disease signs.');
  }

  return recs;
}

// ---- Get Polyculture Recommendation ----
export function getPolycultureRecommendation(speciesList) {
  const compatibility = getPolycultureCompatibility(speciesList);

  if (!compatibility.compatible) {
    return {
      recommendation: '⚠️ These species may not be compatible in the same pond.',
      details: compatibility.message,
      warnings: compatibility.warnings
    };
  }

  if (compatibility.warnings && compatibility.warnings.length > 0) {
    return {
      recommendation: '✅ Compatible but with precautions.',
      details: compatibility.message,
      warnings: compatibility.warnings
    };
  }

  return {
    recommendation: '✅ Excellent polyculture combination!',
    details: 'These species share compatible water quality requirements.',
    warnings: []
  };
}
