// ============================================================
// SPECIES MASTER - All Species Profiles
// ============================================================

export const SPECIES = {
  bangus: {
    id: 'bangus',
    name: 'Bangus (Milkfish)',
    icon: '🐟',
    scientificName: 'Chanos chanos',
    salinityTolerance: { min: 0, max: 40, optimalMin: 20, optimalMax: 30 },
    temperatureTolerance: { min: 20, max: 35, optimalMin: 27, optimalMax: 30 },
    doMin: 3,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: 1.5,
    targetSurvival: 85,
    targetDGR: { min: 2, max: 3, unit: 'g/day' },
    maturityDays: 120,
    harvestWeightMin: 300,
    harvestWeightMax: 400,
    feedTypes: ['Starter', 'Grower', 'Finisher'],
    notes: 'Saline-tolerant, can be cultured in brackish water',
    defaultStockingDensity: 7500, // per hectare
    color: '#2ecc71'
  },
  tilapiaSaltTolerant: {
    id: 'tilapiaSaltTolerant',
    name: 'Saline-Tolerant Tilapia',
    icon: '🐠',
    scientificName: 'Oreochromis niloticus',
    salinityTolerance: { min: 0, max: 35, optimalMin: 15, optimalMax: 25 },
    temperatureTolerance: { min: 18, max: 35, optimalMin: 25, optimalMax: 30 },
    doMin: 2.5,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: 1.6,
    targetSurvival: 80,
    targetDGR: { min: 1.5, max: 2.5, unit: 'g/day' },
    maturityDays: 150,
    harvestWeightMin: 200,
    harvestWeightMax: 300,
    feedTypes: ['Starter', 'Grower', 'Finisher'],
    notes: 'More saline-tolerant than Nile tilapia',
    defaultStockingDensity: 5000,
    color: '#3498db'
  },
  tilapiaSpinYY: {
    id: 'tilapiaSpinYY',
    name: 'SPIN YY Tilapia',
    icon: '🐠',
    scientificName: 'Oreochromis niloticus',
    salinityTolerance: { min: 0, max: 30, optimalMin: 10, optimalMax: 20 },
    temperatureTolerance: { min: 18, max: 35, optimalMin: 25, optimalMax: 30 },
    doMin: 2.5,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: 1.4,
    targetSurvival: 90,
    targetDGR: { min: 2, max: 3, unit: 'g/day' },
    maturityDays: 130,
    harvestWeightMin: 250,
    harvestWeightMax: 350,
    feedTypes: ['Starter', 'Grower', 'Finisher'],
    notes: 'All-male tilapia, faster growth, better FCR',
    defaultStockingDensity: 6000,
    color: '#9b59b6'
  },
  shrimp: {
    id: 'shrimp',
    name: 'Shrimp (Sugpo/Vanamei)',
    icon: '🦐',
    scientificName: 'Penaeus vannamei',
    salinityTolerance: { min: 0, max: 45, optimalMin: 25, optimalMax: 35 },
    temperatureTolerance: { min: 20, max: 33, optimalMin: 28, optimalMax: 32 },
    doMin: 4,
    ammoniaMax: 0.3,
    nitriteMax: 0.3,
    nitrateMax: 30,
    targetFCR: 1.2,
    targetSurvival: 70,
    targetDGR: { min: 0.5, max: 1, unit: 'g/day' },
    maturityDays: 90,
    harvestWeightMin: 30,
    harvestWeightMax: 40,
    feedTypes: ['Starter', 'Grower', 'Finisher', 'Specialty'],
    notes: 'High-value species, sensitive to water quality',
    defaultStockingDensity: 100000, // per hectare
    color: '#e67e22'
  },
  mudCrab: {
    id: 'mudCrab',
    name: 'Mud Crab',
    icon: '🦀',
    scientificName: 'Scylla serrata',
    salinityTolerance: { min: 10, max: 35, optimalMin: 20, optimalMax: 30 },
    temperatureTolerance: { min: 22, max: 35, optimalMin: 26, optimalMax: 32 },
    doMin: 3,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: 2.0,
    targetSurvival: 60,
    targetDGR: { min: 0.5, max: 1.5, unit: 'g/day' },
    maturityDays: 180,
    harvestWeightMin: 200,
    harvestWeightMax: 400,
    feedTypes: ['Trash Fish', 'Pelleted Feed', 'Mollusks'],
    notes: 'Cannibalistic - requires shelters/hides',
    defaultStockingDensity: 2000,
    color: '#e74c3c'
  },
  oyster: {
    id: 'oyster',
    name: 'Single Shell Oyster',
    icon: '🦪',
    scientificName: 'Crassostrea iredalei',
    salinityTolerance: { min: 15, max: 35, optimalMin: 25, optimalMax: 30 },
    temperatureTolerance: { min: 18, max: 32, optimalMin: 24, optimalMax: 28 },
    doMin: 4,
    ammoniaMax: 0.3,
    nitriteMax: 0.3,
    nitrateMax: 30,
    targetFCR: null,
    targetSurvival: 70,
    targetDGR: null,
    maturityDays: 180,
    harvestWeightMin: 50,
    harvestWeightMax: 100,
    feedTypes: ['Phytoplankton'],
    notes: 'Filter feeder - improves water quality. No feed cost.',
    defaultStockingDensity: 20000,
    color: '#1abc9c'
  }
};

// ---- Helper Functions ----
export function getSpeciesList() {
  return Object.values(SPECIES).map(s => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    color: s.color
  }));
}

export function getSpecies(id) {
  return SPECIES[id] || null;
}

export function getSpeciesName(id) {
  const s = getSpecies(id);
  return s ? s.name : id;
}

export function getSpeciesIcon(id) {
  const s = getSpecies(id);
  return s ? s.icon : '🐟';
}

export function getSpeciesColor(id) {
  const s = getSpecies(id);
  return s ? s.color : '#2ecc71';
}

export function isSalinityCompatible(speciesId, salinity) {
  const s = getSpecies(speciesId);
  if (!s) return false;
  return salinity >= s.salinityTolerance.min && salinity <= s.salinityTolerance.max;
}

export function isTemperatureCompatible(speciesId, temp) {
  const s = getSpecies(speciesId);
  if (!s) return false;
  return temp >= s.temperatureTolerance.min && temp <= s.temperatureTolerance.max;
}

export function getPolycultureCompatibility(speciesIds) {
  const speciesList = speciesIds.map(id => getSpecies(id)).filter(Boolean);
  if (speciesList.length < 2) {
    return { compatible: true, message: 'Single species only' };
  }

  // Check salinity compatibility
  const salinityRanges = speciesList.map(s => s.salinityTolerance);
  const salinityOverlap = salinityRanges.every(r =>
    r.min <= Math.max(...salinityRanges.map(r => r.min)) &&
    r.max >= Math.min(...salinityRanges.map(r => r.max))
  );

  // Check temperature compatibility
  const tempRanges = speciesList.map(s => s.temperatureTolerance);
  const tempOverlap = tempRanges.every(r =>
    r.min <= Math.max(...tempRanges.map(r => r.min)) &&
    r.max >= Math.min(...tempRanges.map(r => r.max))
  );

  // Check for aggressive species (crab)
  const hasCrab = speciesList.some(s => s.id === 'mudCrab');
  const hasShrimp = speciesList.some(s => s.id === 'shrimp');

  let warnings = [];
  if (hasCrab && hasShrimp) {
    warnings.push('⚠️ Mud crabs may eat shrimp - provide shelters');
  }
  if (hasCrab && speciesList.some(s => s.id === 'bangus')) {
    warnings.push('⚠️ Mud crabs may attack juvenile fish');
  }

  const compatible = salinityOverlap && tempOverlap;

  return {
    compatible: compatible,
    message: compatible ? 'Species share compatible salinity and temperature ranges' :
      'Species have different requirements - may need compartmentalization',
    warnings: warnings,
    details: {
      salinityOverlap: salinityOverlap,
      tempOverlap: tempOverlap,
      species: speciesList.map(s => s.name).join(', ')
    }
  };
}

export function getSpeciesRecommendations(speciesId, logData, status) {
  const s = getSpecies(speciesId);
  if (!s) return [];

  const recs = [];

  // Salinity check
  if (logData.salinity !== undefined && logData.salinity !== null) {
    if (logData.salinity < s.salinityTolerance.optimalMin ||
      logData.salinity > s.salinityTolerance.optimalMax) {
      recs.push(`⚠️ Salinity (${logData.salinity} ppt) is outside ${s.name}'s optimal range (${s.salinityTolerance.optimalMin}-${s.salinityTolerance.optimalMax} ppt)`);
    }
    if (logData.salinity < s.salinityTolerance.min ||
      logData.salinity > s.salinityTolerance.max) {
      recs.push(`🚨 Salinity (${logData.salinity} ppt) is outside ${s.name}'s survival range!`);
    }
  }

  // Temperature check
  if (logData.temp !== undefined && logData.temp !== null) {
    if (logData.temp < s.temperatureTolerance.optimalMin ||
      logData.temp > s.temperatureTolerance.optimalMax) {
      recs.push(`⚠️ Temperature (${logData.temp}°C) is outside ${s.name}'s optimal range (${s.temperatureTolerance.optimalMin}-${s.temperatureTolerance.optimalMax}°C)`);
    }
    if (logData.temp < s.temperatureTolerance.min ||
      logData.temp > s.temperatureTolerance.max) {
      recs.push(`🚨 Temperature (${logData.temp}°C) is outside ${s.name}'s survival range!`);
    }
  }

  // DO check
  if (logData.do !== undefined && logData.do !== null && logData.do < s.doMin) {
    recs.push(`🚨 DO (${logData.do} ppm) is below ${s.name}'s minimum (${s.doMin} ppm)`);
  }

  // Ammonia check
  if (logData.ammonia !== undefined && logData.ammonia !== null && logData.ammonia > s.ammoniaMax) {
    recs.push(`⚠️ Ammonia (${logData.ammonia} ppm) exceeds ${s.name}'s maximum (${s.ammoniaMax} ppm)`);
  }

  // FCR check
  if (status && status.fcr !== null && s.targetFCR && status.fcr > s.targetFCR) {
    recs.push(`⚠️ FCR (${status.fcr}) is above ${s.name}'s target (${s.targetFCR})`);
  }

  // Survival check
  if (status && status.survival !== null && status.survival < s.targetSurvival) {
    recs.push(`⚠️ Survival (${status.survival}%) is below ${s.name}'s target (${s.targetSurvival}%)`);
  }

  return recs;
}
