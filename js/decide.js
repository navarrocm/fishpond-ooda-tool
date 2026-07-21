// ============================================================
// DECISION SUPPORT ENGINE - MBA Concepts
// ============================================================

import { getPondStatus, calculateBreakEven, calculateROI, safeAverage } from './ooda.js';
import { validateNumber, formatCurrency, formatNumber } from './utils.js';

// ---- RISK PREFERENCE MATRIX ----
export function generateDecisionMatrix(pond, logs, harvests, scenarios) {
  const status = getPondStatus(pond, logs, harvests);
  const baseCost = status.totalCost || 0;
  
  if (scenarios.length < 2) return null;
  
  const matrix = scenarios.map(s => {
    const revenue = s.weight * s.price;
    const profit = revenue - baseCost;
    const roi = baseCost > 0 ? Math.round((profit / baseCost) * 100) : 0;
    return {
      ...s,
      revenue,
      profit,
      roi,
      cost: baseCost
    };
  });
  
  const maxProfit = Math.max(...matrix.map(m => m.profit));
  const maximax = matrix.find(m => m.profit === maxProfit);
  
  const withWorst = matrix.map(m => ({
    ...m,
    worstProfit: (m.weight * m.price * 0.8) - baseCost
  }));
  const maxWorstProfit = Math.max(...withWorst.map(m => m.worstProfit));
  const maximin = withWorst.find(m => m.worstProfit === maxWorstProfit);
  
  const bestForEach = {
    profit: Math.max(...matrix.map(m => m.profit))
  };
  const withRegret = matrix.map(m => ({
    ...m,
    regret: bestForEach.profit - m.profit
  }));
  const minRegret = Math.min(...withRegret.map(m => m.regret));
  const minimax = withRegret.find(m => m.regret === minRegret);
  
  return {
    matrix,
    maximax,
    maximin,
    minimax,
    withWorst,
    withRegret,
    baseCost,
    bestProfit: bestForEach.profit
  };
}

// ---- OPPORTUNITY GAIN/LOSS ----
export function calculateOpportunityGainLoss(optionA, optionB) {
  const gain = optionB.profit - optionA.profit;
  return {
    gain: gain > 0 ? gain : 0,
    loss: gain < 0 ? Math.abs(gain) : 0,
    net: gain,
    betterOption: gain > 0 ? optionB.label : optionA.label,
    worseOption: gain > 0 ? optionA.label : optionB.label
  };
}

// ---- COST-BENEFIT ANALYSIS ----
export function calculateCostBenefit(investmentCost, annualBenefit, lifespan = 3, discountRate = 0.1) {
  const npv = annualBenefit * (1 - Math.pow(1 + discountRate, -lifespan)) / discountRate - investmentCost;
  const paybackPeriod = investmentCost / (annualBenefit || 1);
  const roi = ((annualBenefit * lifespan - investmentCost) / (investmentCost || 1)) * 100;
  const benefitCostRatio = (annualBenefit * lifespan) / (investmentCost || 1);
  
  return {
    investmentCost,
    annualBenefit,
    lifespan,
    discountRate,
    npv: Math.round(npv * 100) / 100,
    paybackPeriod: Math.round(paybackPeriod * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    benefitCostRatio: Math.round(benefitCostRatio * 100) / 100,
    recommended: npv > 0 && paybackPeriod < lifespan
  };
}

// ---- REORDER POINT ----
export function calculateReorderPoint(dailyConsumption, leadTimeDays, safetyStockDays = 5) {
  const safetyStock = dailyConsumption * safetyStockDays;
  const leadTimeDemand = dailyConsumption * leadTimeDays;
  const reorderPoint = safetyStock + leadTimeDemand;
  return {
    dailyConsumption,
    leadTimeDays,
    safetyStockDays,
    safetyStock: Math.round(safetyStock * 10) / 10,
    leadTimeDemand: Math.round(leadTimeDemand * 10) / 10,
    reorderPoint: Math.round(reorderPoint * 10) / 10
  };
}

// ---- WEIGHTED AVERAGE (POND HEALTH SCORE) - WITH PARTIAL DATA ----
export function calculatePondHealthScore(logs, weights) {
  if (!logs || logs.length === 0) return null;
  
  const recent = logs.slice(-7);
  const scores = {};
  const availableMetrics = [];
  const details = {};
  
  // Temperature
  const temps = recent.map(l => validateNumber(l.temp)).filter(v => v !== null);
  if (temps.length > 0) {
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    scores.temp = avgTemp >= 27 && avgTemp <= 30 ? 100 : 
                   avgTemp >= 25 && avgTemp <= 32 ? 70 : 40;
    availableMetrics.push('temp');
    details.temp = { value: Math.round(avgTemp * 10) / 10, count: temps.length };
  }
  
  // pH
  const phs = recent.map(l => validateNumber(l.ph)).filter(v => v !== null);
  if (phs.length > 0) {
    const avgPh = phs.reduce((a, b) => a + b, 0) / phs.length;
    scores.ph = avgPh >= 7.5 && avgPh <= 8.5 ? 100 :
                 avgPh >= 7.0 && avgPh <= 9.0 ? 70 : 40;
    availableMetrics.push('ph');
    details.ph = { value: Math.round(avgPh * 10) / 10, count: phs.length };
  }
  
  // DO
  const dos = recent.map(l => validateNumber(l.do)).filter(v => v !== null);
  if (dos.length > 0) {
    const avgDo = dos.reduce((a, b) => a + b, 0) / dos.length;
    scores.do = avgDo >= 5 ? 100 : avgDo >= 3 ? 60 : 20;
    availableMetrics.push('do');
    details.do = { value: Math.round(avgDo * 10) / 10, count: dos.length };
  }
  
  // Salinity
  const salinities = recent.map(l => validateNumber(l.salinity)).filter(v => v !== null);
  if (salinities.length > 0) {
    const avgSalinity = salinities.reduce((a, b) => a + b, 0) / salinities.length;
    scores.salinity = avgSalinity >= 20 && avgSalinity <= 30 ? 100 :
                       avgSalinity >= 15 && avgSalinity <= 35 ? 70 : 40;
    availableMetrics.push('salinity');
    details.salinity = { value: Math.round(avgSalinity * 10) / 10, count: salinities.length };
  }
  
  // Ammonia
  const ammonias = recent.map(l => validateNumber(l.ammonia)).filter(v => v !== null);
  if (ammonias.length > 0) {
    const avgAmmonia = ammonias.reduce((a, b) => a + b, 0) / ammonias.length;
    scores.ammonia = avgAmmonia < 0.5 ? 100 : avgAmmonia < 1.0 ? 60 : 20;
    availableMetrics.push('ammonia');
    details.ammonia = { value: Math.round(avgAmmonia * 100) / 100, count: ammonias.length };
  }
  
  // If no metrics available, return null
  if (availableMetrics.length === 0) {
    return {
      score: 0,
      breakdown: {},
      weights,
      availableMetrics: [],
      missingMetrics: Object.keys(weights),
      rating: 'No Data',
      dataCompleteness: 0,
      details: {}
    };
  }
  
  // Calculate weighted score using ONLY available metrics
  let totalScore = 0;
  let totalWeight = 0;
  for (const key of availableMetrics) {
    if (scores[key] !== undefined && weights[key]) {
      totalScore += scores[key] * weights[key];
      totalWeight += weights[key];
    }
  }
  
  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  const missingMetrics = Object.keys(weights).filter(k => !availableMetrics.includes(k));
  
  return {
    score: finalScore,
    breakdown: scores,
    weights,
    availableMetrics,
    missingMetrics,
    details,
    rating: finalScore >= 80 ? 'Excellent' :
             finalScore >= 65 ? 'Good' :
             finalScore >= 50 ? 'Fair' : 'Poor',
    dataCompleteness: Math.round((availableMetrics.length / Object.keys(weights).length) * 100)
  };
}

// ---- HISTORICAL AVERAGES (Law of Averages) ----
export function calculateHistoricalAverages(pond, logs, harvests) {
  if (!logs || logs.length === 0) return null;
  
  const cycles = harvests && harvests.length > 0 ? harvests.length : 0;
  
  let totalFeed = 0;
  let totalWeightGain = 0;
  let totalMortality = 0;
  let totalFeedCost = 0;
  let hasFeedData = false;
  let hasWeightData = false;
  
  for (const log of logs) {
    const feed = validateNumber(log.feedAmount, 0);
    totalFeed += feed;
    if (feed > 0) hasFeedData = true;
    
    totalFeedCost += validateNumber(log.feedCost, 0);
    totalMortality += validateNumber(log.mortality, 0);
    
    const weight = validateNumber(log.weight, 0);
    if (weight > 0) hasWeightData = true;
  }
  
  const totalStocked = pond.fingerlings || 0;
  const currentAlive = Math.max(0, totalStocked - totalMortality);
  const avgSurvival = totalStocked > 0 ? Math.round((currentAlive / totalStocked) * 100) : null;
  
  // Only calculate FCR if we have feed and weight data
  let avgFCR = null;
  if (hasFeedData && hasWeightData) {
    const avgWeight = logs.reduce((s, l) => s + validateNumber(l.weight, 0), 0) / logs.length;
    totalWeightGain = (currentAlive * avgWeight) / 1000;
    avgFCR = totalWeightGain > 0 ? Math.round((totalFeed / totalWeightGain) * 100) / 100 : null;
  }
  
  return {
    cycles,
    avgFCR,
    avgSurvival,
    avgFeedCostPerCycle: cycles > 0 ? Math.round(totalFeedCost / cycles) : totalFeedCost,
    avgMortality: Math.round(totalMortality / (logs.length || 1)),
    totalFeed,
    totalFeedCost,
    currentAlive,
    hasFeedData,
    hasWeightData,
    dataCompleteness: {
      feed: hasFeedData,
      weight: hasWeightData,
      mortality: totalMortality > 0
    }
  };
}
