// ============================================================
// SPECIES MASTER - All Species Profiles
// ============================================================

export const SPECIES = {
  bangus: {
    id: 'bangus',
    name: 'Bangus (Milkfish)',
    icon: '🐟',
    scientificName: 'Chanos chanos',
    operationTypes: ['growout', 'nursery'],
    salinityTolerance: { min: 0, max: 40, optimalMin: 20, optimalMax: 30 },
    temperatureTolerance: { min: 20, max: 35, optimalMin: 27, optimalMax: 30 },
    doMin: 3,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: {
      growout: 1.5,
      nursery: 1.2
    },
    targetSurvival: {
      growout: 85,
      nursery: 90
    },
    targetDGR: {
      growout: { min: 2, max: 3, unit: 'g/day' },
      nursery: { min: 0.3, max: 0.5, unit: 'g/day' }
    },
    maturityDays: {
      growout: 120,
      nursery: 45
    },
    harvestWeightMin: {
      growout: 300,
      nursery: 10
    },
    harvestWeightMax: {
      growout: 400,
      nursery: 20
    },
    feedTypes: {
      growout: ['Starter', 'Grower', 'Finisher'],
      nursery: ['Starter']
    },
    defaultStockingDensity: {
      growout: 7500,
      nursery: 15000
    },
    notes: 'Saline-tolerant, can be cultured in brackish water. Nursery operation: fry to fingerlings.',
    color: '#2ecc71'
  },
  tilapiaSaltTolerant: {
    id: 'tilapiaSaltTolerant',
    name: 'Saline-Tolerant Tilapia',
    icon: '🐠',
    scientificName: 'Oreochromis niloticus',
    operationTypes: ['growout', 'nursery'],
    salinityTolerance: { min: 0, max: 35, optimalMin: 15, optimalMax: 25 },
    temperatureTolerance: { min: 18, max: 35, optimalMin: 25, optimalMax: 30 },
    doMin: 2.5,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: {
      growout: 1.6,
      nursery: 1.3
    },
    targetSurvival: {
      growout: 80,
      nursery: 85
    },
    targetDGR: {
      growout: { min: 1.5, max: 2.5, unit: 'g/day' },
      nursery: { min: 0.2, max: 0.4, unit: 'g/day' }
    },
    maturityDays: {
      growout: 150,
      nursery: 50
    },
    harvestWeightMin: {
      growout: 200,
      nursery: 8
    },
    harvestWeightMax: {
      growout: 300,
      nursery: 15
    },
    feedTypes: {
      growout: ['Starter', 'Grower', 'Finisher'],
      nursery: ['Starter']
    },
    defaultStockingDensity: {
      growout: 5000,
      nursery: 12000
    },
    notes: 'More saline-tolerant than Nile tilapia. Nursery operation: fry to fingerlings.',
    color: '#3498db'
  },
  tilapiaSpinYY: {
    id: 'tilapiaSpinYY',
    name: 'SPIN YY Tilapia',
    icon: '🐠',
    scientificName: 'Oreochromis niloticus',
    operationTypes: ['growout', 'nursery'],
    salinityTolerance: { min: 0, max: 30, optimalMin: 10, optimalMax: 20 },
    temperatureTolerance: { min: 18, max: 35, optimalMin: 25, optimalMax: 30 },
    doMin: 2.5,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: {
      growout: 1.4,
      nursery: 1.1
    },
    targetSurvival: {
      growout: 90,
      nursery: 92
    },
    targetDGR: {
      growout: { min: 2, max: 3, unit: 'g/day' },
      nursery: { min: 0.3, max: 0.5, unit: 'g/day' }
    },
    maturityDays: {
      growout: 130,
      nursery: 45
    },
    harvestWeightMin: {
      growout: 250,
      nursery: 10
    },
    harvestWeightMax: {
      growout: 350,
      nursery: 18
    },
    feedTypes: {
      growout: ['Starter', 'Grower', 'Finisher'],
      nursery: ['Starter']
    },
    defaultStockingDensity: {
      growout: 6000,
      nursery: 14000
    },
    notes: 'All-male tilapia, faster growth, better FCR. Nursery operation available.',
    color: '#9b59b6'
  },
  shrimp: {
    id: 'shrimp',
    name: 'Shrimp (Sugpo/Vanamei)',
    icon: '🦐',
    scientificName: 'Penaeus vannamei',
    operationTypes: ['growout'],
    salinityTolerance: { min: 0, max: 45, optimalMin: 25, optimalMax: 35 },
    temperatureTolerance: { min: 20, max: 33, optimalMin: 28, optimalMax: 32 },
    doMin: 4,
    ammoniaMax: 0.3,
    nitriteMax: 0.3,
    nitrateMax: 30,
    targetFCR: {
      growout: 1.2
    },
    targetSurvival: {
      growout: 70
    },
    targetDGR: {
      growout: { min: 0.5, max: 1, unit: 'g/day' }
    },
    maturityDays: {
      growout: 90
    },
    harvestWeightMin: {
      growout: 30
    },
    harvestWeightMax: {
      growout: 40
    },
    feedTypes: {
      growout: ['Starter', 'Grower', 'Finisher', 'Specialty']
    },
    defaultStockingDensity: {
      growout: 100000
    },
    notes: 'High-value species, sensitive to water quality.',
    color: '#e67e22'
  },
  mudCrab: {
    id: 'mudCrab',
    name: 'Mud Crab',
    icon: '🦀',
    scientificName: 'Scylla serrata',
    operationTypes: ['growout'],
    salinityTolerance: { min: 10, max: 35, optimalMin: 20, optimalMax: 30 },
    temperatureTolerance: { min: 22, max: 35, optimalMin: 26, optimalMax: 32 },
    doMin: 3,
    ammoniaMax: 0.5,
    nitriteMax: 0.5,
    nitrateMax: 50,
    targetFCR: {
      growout: 2.0
    },
    targetSurvival: {
      growout: 60
    },
    targetDGR: {
      growout: { min: 0.5, max: 1.5, unit: 'g/day' }
    },
    maturityDays: {
      growout: 180
    },
    harvestWeightMin: {
      growout: 200
    },
    harvestWeightMax: {
      growout: 400
    },
    feedTypes: {
      growout: ['Trash Fish', 'Pelleted Feed', 'Mollusks']
    },
    defaultStockingDensity: {
      growout: 2000
    },
    notes: 'Cannibalistic - requires shelters/hides.',
    color: '#e74c3c'
  },
  oyster: {
    id: 'oyster',
    name: 'Single Shell Oyster',
    icon: '🦪',
    scientificName: 'Crassostrea iredalei',
    operationTypes: ['growout'],
    salinityTolerance: { min: 15, max: 35, optimalMin: 25, optimalMax: 30 },
    temperatureTolerance: { min: 18, max: 32, optimalMin: 24, optimalMax: 28 },
    doMin: 4,
    ammoniaMax: 0.3,
    nitriteMax: 0.3,
    nitrateMax: 30,
    targetFCR: {
      growout: null
    },
    targetSurvival: {
      growout: 70
    },
    targetDGR: {
      growout: null
    },
    maturityDays: {
      growout: 180
    },
    harvestWeightMin: {
      growout: 50
    },
    harvestWeightMax: {
      growout: 100
    },
    feedTypes: {
      growout: ['Phytoplankton']
    },
    defaultStockingDensity: {
      growout: 20000
    },
    notes: 'Filter feeder - improves water quality. No feed cost.',
    color: '#1abc9c'
  }
};

// ---- Helper Functions ----
export function getSpeciesList() {
  return Object.values(SPECIES).map(s => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    color: s.color,
    operationTypes: s.operationTypes || ['growout']
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

export function getOperationTypes() {
  return [
    { id: 'growout', label: 'Grow-out (Harvest to Market Size)', icon: '🌾' },
    { id: 'nursery', label: 'Nursery (Fry to Fingerlings)', icon: '🐣' }
  ];
}

export function getOperationTypeLabel(id) {
  const types = getOperationTypes();
  const found = types.find(t => t.id === id);
  return found ? found.label : id;
}

export function getSpeciesForOperation(operationType) {
  return Object.values(SPECIES)
    .filter(s => s.operationTypes && s.operationTypes.includes(operationType))
    .map(s => ({ id: s.id, name: s.name, icon: s.icon, color: s.color }));
}

export function getSpeciesTargets(speciesId, operationType) {
  const s = getSpecies(speciesId);
  if (!s) return null;
  
  const op = operationType || 'growout';
  
  return {
    targetFCR: s.targetFCR?.[op] || s.targetFCR?.growout || null,
    targetSurvival: s.targetSurvival?.[op] || s.targetSurvival?.growout || null,
    targetDGR: s.targetDGR?.[op] || s.targetDGR?.growout || null,
    maturityDays: s.maturityDays?.[op] || s.maturityDays?.growout || null,
    harvestWeightMin: s.harvestWeightMin?.[op] || s.harvestWeightMin?.growout || null,
    harvestWeightMax: s.harvestWeightMax?.[op] || s.harvestWeightMax?.growout || null,
    feedTypes: s.feedTypes?.[op] || s.feedTypes?.growout || [],
    defaultStockingDensity: s.defaultStockingDensity?.[op] || s.defaultStockingDensity?.growout || null
  };
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

  const salinityRanges = speciesList.map(s => s.salinityTolerance);
  const salinityOverlap = salinityRanges.every(r =>
    r.min <= Math.max(...salinityRanges.map(r => r.min)) &&
    r.max >= Math.min(...salinityRanges.map(r => r.max))
  );

  const tempRanges = speciesList.map(s => s.temperatureTolerance);
  const tempOverlap = tempRanges.every(r =>
    r.min <= Math.max(...tempRanges.map(r => r.min)) &&
    r.max >= Math.min(...tempRanges.map(r => r.max))
  );

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
