// ============================================================
// DECISION SUPPORT ENGINE - MBA Concepts
// ============================================================

import { getPondStatus, calculateBreakEven, calculateROI } from './ooda.js';
import { validateNumber, formatCurrency, formatNumber } from './utils.js';

// ---- RISK PREFERENCE MATRIX ----
export function generateDecisionMatrix(pond, logs, harvests, scenarios) {
  // scenarios: [{ label, price, weight, probability }]
  // Example: harvest now, wait 2 weeks, wait 4 weeks
  
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
  
  // Maximax: best-case (highest profit)
  const maxProfit = Math.max(...matrix.map(m => m.profit));
  const maximax = matrix.find(m => m.profit === maxProfit);
  
  // Maximin: worst-case (highest of the worst outcomes)
  // For each scenario, find the worst possible outcome (assume 20% price drop)
  const withWorst = matrix.map(m => ({
    ...m,
    worstProfit: (m.weight * m.price * 0.8) - baseCost
  }));
  const maxWorstProfit = Math.max(...withWorst.map(m => m.worstProfit));
  const maximin = withWorst.find(m => m.worstProfit === maxWorstProfit);
  
  // Minimax: minimize maximum regret
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
  // optionA and optionB are scenario objects with { label, profit }
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
  // lifespan in cycles (years), discount rate for net present value
  const npv = annualBenefit * (1 - Math.pow(1 + discountRate, -lifespan)) / discountRate - investmentCost;
  const paybackPeriod = investmentCost / annualBenefit;
  const roi = ((annualBenefit * lifespan - investmentCost) / investmentCost) * 100;
  const benefitCostRatio = (annualBenefit * lifespan) / investmentCost;
  
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

// ---- WEIGHTED AVERAGE (POND HEALTH SCORE) ----
export function calculatePondHealthScore(logs, weights) {
  // weights: { temp, ph, salinity, do, ammonia, fcr, survival }
  // Each weight should sum to 1 (100%)
  
  if (!logs || logs.length < 3) return null;
  
  const recent = logs.slice(-7);
  const scores = {};
  
  // Temperature: optimal 27-30°C
  const avgTemp = recent.reduce((s, l) => s + validateNumber(l.temp, 0), 0) / recent.length;
  scores.temp = avgTemp >= 27 && avgTemp <= 30 ? 100 : 
                 avgTemp >= 25 && avgTemp <= 32 ? 70 : 40;
  
  // pH: optimal 7.5-8.5
  const avgPh = recent.reduce((s, l) => s + validateNumber(l.ph, 0), 0) / recent.length;
  scores.ph = avgPh >= 7.5 && avgPh <= 8.5 ? 100 :
               avgPh >= 7.0 && avgPh <= 9.0 ? 70 : 40;
  
  // DO: optimal >5 ppm
  const avgDo = recent.reduce((s, l) => s + validateNumber(l.do, 0), 0) / recent.length;
  scores.do = avgDo >= 5 ? 100 : avgDo >= 3 ? 60 : 20;
  
  // Salinity: optimal 20-30 ppt
  const avgSalinity = recent.reduce((s, l) => s + validateNumber(l.salinity, 0), 0) / recent.length;
  scores.salinity = avgSalinity >= 20 && avgSalinity <= 30 ? 100 :
                     avgSalinity >= 15 && avgSalinity <= 35 ? 70 : 40;
  
  // Ammonia: optimal <0.5 ppm
  const avgAmmonia = recent.reduce((s, l) => s + validateNumber(l.ammonia, 0), 0) / recent.length;
  scores.ammonia = avgAmmonia < 0.5 ? 100 : avgAmmonia < 1.0 ? 60 : 20;
  
  // FCR: optimal <1.5 (if available)
  // Survival: optimal >85% (if available)
  
  // Weighted average
  let totalScore = 0;
  let totalWeight = 0;
  for (const key of Object.keys(weights)) {
    if (scores[key] !== undefined && weights[key]) {
      totalScore += scores[key] * weights[key];
      totalWeight += weights[key];
    }
  }
  
  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  
  return {
    score: finalScore,
    breakdown: scores,
    weights,
    rating: finalScore >= 80 ? 'Excellent' :
             finalScore >= 65 ? 'Good' :
             finalScore >= 50 ? 'Fair' : 'Poor'
  };
}

// ---- HISTORICAL AVERAGES (Law of Averages) ----
export function calculateHistoricalAverages(pond, logs, harvests) {
  if (!logs || logs.length === 0) return null;
  
  const cycles = harvests && harvests.length > 0 ? harvests.length : 0;
  
  // FCR from logs
  let totalFeed = 0;
  let totalWeightGain = 0;
  let totalMortality = 0;
  let totalFeedCost = 0;
  
  for (const log of logs) {
    totalFeed += validateNumber(log.feedAmount, 0);
    totalMortality += validateNumber(log.mortality, 0);
    totalFeedCost += validateNumber(log.feedCost, 0);
  }
  
  // Estimate weight gain
  const totalStocked = pond.fingerlings || 0;
  const currentAlive = Math.max(0, totalStocked - totalMortality);
  const avgWeight = logs.length > 0 ? logs.reduce((s, l) => s + validateNumber(l.weight, 0), 0) / logs.length : 0;
  totalWeightGain = (currentAlive * avgWeight) / 1000;
  
  const avgFCR = totalWeightGain > 0 ? Math.round((totalFeed / totalWeightGain) * 100) / 100 : null;
  const avgSurvival = totalStocked > 0 ? Math.round((currentAlive / totalStocked) * 100) : null;
  const avgFeedCostPerCycle = cycles > 0 ? Math.round(totalFeedCost / cycles) : totalFeedCost;
  
  return {
    cycles,
    avgFCR,
    avgSurvival,
    avgFeedCostPerCycle,
    avgMortality: Math.round(totalMortality / (logs.length || 1)),
    avgWeight,
    totalFeed,
    totalFeedCost,
    currentAlive
  };
}
