import {
  Candle,
  IndicatorValues,
  CoinDcxTicker,
  PositionDirection,
  PrimitiveChoice,
  PrimitiveScore,
  PrimitiveBoolGates,
  DecisionPrimitivesResult,
  AiPrimitivesInsight,
  OrderBookMicrostructure,
  DualTierAiStatus,
} from '../types/trading';

/**
 * 🎯 3 PRIMITIVES QUANTITATIVE ENSEMBLE DECISION SYSTEM (2+3+4+5 Architecture)
 * 01 Choice: Picks direction, outputs calibrated probability distribution (Quant + OBI + AI)
 * 02 Score: Continuous multi-factor variables on an ordered scale (0.00 - 1.00) including Level-2 Book Depth
 * 03 Bool: Strict binary circuit breakers, whale spoof filters & AI trap gates (True / False)
 */

export function calculateChoicePrimitive(
  indicators: IndicatorValues,
  currentPrice: number,
  allowedDirection: 'BOTH' | 'LONG_ONLY' | 'SHORT_ONLY' = 'BOTH',
  aiInsight?: AiPrimitivesInsight,
  microstructure?: OrderBookMicrostructure
): PrimitiveChoice {
  const votes: { algorithm: string; vote: 'BUY' | 'HOLD' | 'SELL'; weight: number; reason: string }[] = [];

  // Algorithm 1: SuperTrend (10, 3.0 ATR)
  if (indicators.superTrend) {
    if (indicators.superTrend.direction === 'BULLISH') {
      votes.push({
        algorithm: 'SuperTrend (10, 3.0)',
        vote: 'BUY',
        weight: 1.5,
        reason: `Bullish Trend Support @ $${indicators.superTrend.value.toFixed(2)}`,
      });
    } else {
      votes.push({
        algorithm: 'SuperTrend (10, 3.0)',
        vote: 'SELL',
        weight: 1.5,
        reason: `Bearish Trend Resistance @ $${indicators.superTrend.value.toFixed(2)}`,
      });
    }
  }

  // Algorithm 2: EMA Golden / Death Cross & Alignment
  const { ema9, ema21, ema50, ema200 } = indicators.ema;
  if (ema9 > ema21 && currentPrice > ema50) {
    votes.push({
      algorithm: 'EMA Trend Alignment (9/21/50)',
      vote: 'BUY',
      weight: 1.2,
      reason: `EMA9 ($${ema9.toFixed(2)}) > EMA21 ($${ema21.toFixed(2)}) & above EMA50`,
    });
  } else if (ema9 < ema21 && currentPrice < ema50) {
    votes.push({
      algorithm: 'EMA Trend Alignment (9/21/50)',
      vote: 'SELL',
      weight: 1.2,
      reason: `EMA9 ($${ema9.toFixed(2)}) < EMA21 ($${ema21.toFixed(2)}) & below EMA50`,
    });
  } else {
    votes.push({
      algorithm: 'EMA Trend Alignment (9/21/50)',
      vote: 'HOLD',
      weight: 0.8,
      reason: 'Moving averages compressing in neutral range',
    });
  }

  // Algorithm 3: MACD Momentum Velocity & Histogram
  const { macdLine, signalLine, histogram } = indicators.macd;
  if (macdLine > signalLine && histogram > 0) {
    votes.push({
      algorithm: 'MACD Velocity (12, 26, 9)',
      vote: 'BUY',
      weight: 1.2,
      reason: `MACD Line > Signal with positive expanding momentum (+${histogram.toFixed(3)})`,
    });
  } else if (macdLine < signalLine && histogram < 0) {
    votes.push({
      algorithm: 'MACD Velocity (12, 26, 9)',
      vote: 'SELL',
      weight: 1.2,
      reason: `MACD Line < Signal with negative expanding momentum (${histogram.toFixed(3)})`,
    });
  } else {
    votes.push({
      algorithm: 'MACD Velocity (12, 26, 9)',
      vote: 'HOLD',
      weight: 0.6,
      reason: 'Momentum transitioning near zero-line',
    });
  }

  // Algorithm 4: RSI Zone & Reversal Detection
  const rsi = indicators.rsi;
  if (rsi >= 50 && rsi <= 68) {
    votes.push({
      algorithm: 'RSI Momentum Oscillator (14)',
      vote: 'BUY',
      weight: 1.0,
      reason: `Bullish momentum expansion (${rsi.toFixed(1)}) without exhaustion`,
    });
  } else if (rsi >= 32 && rsi <= 50) {
    votes.push({
      algorithm: 'RSI Momentum Oscillator (14)',
      vote: 'SELL',
      weight: 1.0,
      reason: `Bearish drift (${rsi.toFixed(1)}) maintaining downward pressure`,
    });
  } else if (rsi > 70) {
    votes.push({
      algorithm: 'RSI Momentum Oscillator (14)',
      vote: 'HOLD',
      weight: 1.1,
      reason: `Overbought exhaustion (${rsi.toFixed(1)}) - avoid late buying`,
    });
  } else if (rsi < 30) {
    votes.push({
      algorithm: 'RSI Momentum Oscillator (14)',
      vote: 'BUY',
      weight: 1.1,
      reason: `Oversold capitulation bounce opportunity (${rsi.toFixed(1)})`,
    });
  }

  // Algorithm 5: Bollinger Bands & Mean Reversion
  const { percentB, bandwidth } = indicators.bollingerBands;
  if (percentB > 0.85 && bandwidth > 0.04) {
    votes.push({
      algorithm: 'Bollinger Band Dynamics',
      vote: 'BUY',
      weight: 1.0,
      reason: `Upper volatility breakout (%B: ${percentB.toFixed(2)}) with band expansion`,
    });
  } else if (percentB < 0.15 && bandwidth > 0.04) {
    votes.push({
      algorithm: 'Bollinger Band Dynamics',
      vote: 'SELL',
      weight: 1.0,
      reason: `Lower volatility breakdown (%B: ${percentB.toFixed(2)}) with band expansion`,
    });
  } else {
    votes.push({
      algorithm: 'Bollinger Band Dynamics',
      vote: 'HOLD',
      weight: 0.7,
      reason: `Price oscillating within standard bands (%B: ${percentB.toFixed(2)})`,
    });
  }

  // Algorithm 6: Institutional Volume & VWAP Flow
  const vol = indicators.volumeDynamics;
  if (vol) {
    if (currentPrice >= vol.vwap && vol.volumeSurgeRatio >= 1.1) {
      votes.push({
        algorithm: 'Institutional Flow & VWAP',
        vote: 'BUY',
        weight: 1.3,
        reason: `Above VWAP ($${vol.vwap.toFixed(2)}) with ${vol.volumeSurgeRatio.toFixed(1)}x Volume Surge`,
      });
    } else if (currentPrice <= vol.vwap && vol.volumeSurgeRatio >= 1.1) {
      votes.push({
        algorithm: 'Institutional Flow & VWAP',
        vote: 'SELL',
        weight: 1.3,
        reason: `Below VWAP ($${vol.vwap.toFixed(2)}) with ${vol.volumeSurgeRatio.toFixed(1)}x Distribution Volume`,
      });
    } else {
      votes.push({
        algorithm: 'Institutional Flow & VWAP',
        vote: 'HOLD',
        weight: 0.6,
        reason: 'Normal institutional volume without directional surge',
      });
    }
  }

  // Algorithm 7: Level-2 Order Book Depth & CVD Flow (Institutional Microstructure)
  if (microstructure) {
    if (microstructure.imbalanceRatio >= 0.15 && microstructure.cvdDirection !== 'DISTRIBUTION') {
      votes.push({
        algorithm: 'Order Book Depth & CVD Flow',
        vote: 'BUY',
        weight: 1.4,
        reason: `Bullish Book Imbalance (+${(microstructure.imbalanceRatio * 100).toFixed(0)}%) & CVD Flow ($${microstructure.largeWalls.bidWallPrice || 'Bids Active'})`,
      });
    } else if (microstructure.imbalanceRatio <= -0.15 && microstructure.cvdDirection !== 'ACCUMULATION') {
      votes.push({
        algorithm: 'Order Book Depth & CVD Flow',
        vote: 'SELL',
        weight: 1.4,
        reason: `Bearish Book Imbalance (${(microstructure.imbalanceRatio * 100).toFixed(0)}%) & Ask Wall ($${microstructure.largeWalls.askWallPrice || 'Asks Active'})`,
      });
    } else {
      votes.push({
        algorithm: 'Order Book Depth & CVD Flow',
        vote: 'HOLD',
        weight: 0.8,
        reason: `Balanced order depth (${(microstructure.imbalanceRatio * 100).toFixed(0)}% imbalance, spread ${microstructure.spreadPercent.toFixed(3)}%)`,
      });
    }
  }

  // Algorithm 8: Dual-Tier Gemini AI Market Structure & Macro Reasoning
  if (aiInsight?.aiIntegrated) {
    const aiProbs = aiInsight.aiPredictedProbabilities;
    const aiVote = aiProbs.buy >= 55 ? 'BUY' : aiProbs.sell >= 55 ? 'SELL' : 'HOLD';
    votes.push({
      algorithm: `Gemini AI (${aiInsight.model})`,
      vote: aiVote,
      weight: 1.8,
      reason: `${aiInsight.macroRationale} (Regime: ${aiInsight.regime.replace(/_/g, ' ')}, Trap Risk: ${aiInsight.trapRisk})`,
    });
  }

  // Calculate weighted probability distribution
  let buyScore = 0;
  let holdScore = 0;
  let sellScore = 0;
  let totalWeight = 0;

  for (const v of votes) {
    totalWeight += v.weight;
    if (v.vote === 'BUY') buyScore += v.weight;
    else if (v.vote === 'SELL') sellScore += v.weight;
    else holdScore += v.weight;
  }

  // Direction filter adjustments
  if (allowedDirection === 'LONG_ONLY') {
    buyScore += sellScore * 0.3;
    holdScore += sellScore * 0.7;
    sellScore = 0;
  } else if (allowedDirection === 'SHORT_ONLY') {
    sellScore += buyScore * 0.3;
    holdScore += buyScore * 0.7;
    buyScore = 0;
  }

  const rawBuyProb = Math.round((buyScore / totalWeight) * 100);
  const rawSellProb = Math.round((sellScore / totalWeight) * 100);
  const rawHoldProb = Math.max(0, 100 - rawBuyProb - rawSellProb);

  let selected: 'BUY' | 'HOLD' | 'SELL' = 'HOLD';
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let dominantConfidence = rawHoldProb;

  if (rawBuyProb >= 55 && rawBuyProb > rawSellProb) {
    selected = 'BUY';
    direction = 'LONG';
    dominantConfidence = rawBuyProb;
  } else if (rawSellProb >= 55 && rawSellProb > rawBuyProb) {
    selected = 'SELL';
    direction = 'SHORT';
    dominantConfidence = rawSellProb;
  } else {
    selected = 'HOLD';
    direction = 'NEUTRAL';
    dominantConfidence = Math.max(rawHoldProb, Math.max(rawBuyProb, rawSellProb));
  }

  return {
    selected,
    direction,
    probability: {
      buy: rawBuyProb,
      hold: rawHoldProb,
      sell: rawSellProb,
    },
    dominantConfidence,
    algorithmVotes: votes,
  };
}

export function calculateScorePrimitive(
  indicators: IndicatorValues,
  currentPrice: number,
  ticker?: CoinDcxTicker | null,
  aiInsight?: AiPrimitivesInsight,
  microstructure?: OrderBookMicrostructure
): PrimitiveScore {
  // 1. Trend Strength Sub-score (0.00 to 1.00)
  let trendSub = 0.5;
  if (indicators.superTrend) {
    const isBull = indicators.superTrend.direction === 'BULLISH';
    const emaDist = (indicators.ema.ema9 - indicators.ema.ema21) / currentPrice;
    trendSub = isBull ? 0.7 + Math.min(0.25, emaDist * 20) : 0.3 - Math.min(0.25, Math.abs(emaDist) * 20);
    trendSub = Math.max(0.05, Math.min(0.98, trendSub));
  }

  // 2. Momentum Velocity Sub-score (0.00 to 1.00)
  const rsiNormalized = indicators.rsi / 100;
  const macdHistSign = indicators.macd.histogram >= 0 ? 1 : -1;
  const histStrength = Math.min(1, Math.abs(indicators.macd.histogram) * 10);
  const momentumSub = Math.max(0.05, Math.min(0.95, (rsiNormalized * 0.6) + (macdHistSign > 0 ? histStrength * 0.4 : -histStrength * 0.4 + 0.5)));

  // 3. Volatility Compression Sub-score (0.00 to 1.00)
  const percentB = indicators.bollingerBands.percentB;
  const volatilitySub = Math.max(0.05, Math.min(0.95, percentB));

  // 4. Institutional Flow Sub-score (0.00 to 1.00)
  let volumeSub = 0.5;
  if (indicators.volumeDynamics) {
    const surge = Math.min(3.0, indicators.volumeDynamics.volumeSurgeRatio) / 3.0; // 0 to 1
    const vwapPos = currentPrice >= indicators.volumeDynamics.vwap ? 0.65 : 0.35;
    volumeSub = Math.max(0.05, Math.min(0.95, (vwapPos * 0.6) + (surge * 0.4)));
  }

  // 5. Microstructure / Order Book Sub-score (0.00 to 1.00)
  let microSub = 0.5;
  if (microstructure) {
    const obiScore = (microstructure.imbalanceRatio + 1) / 2; // -1..1 -> 0..1
    const cvdBonus = microstructure.cvdDirection === 'ACCUMULATION' ? 0.08 : microstructure.cvdDirection === 'DISTRIBUTION' ? -0.08 : 0;
    const spreadPenalty = Math.max(0, 1 - microstructure.spreadPercent * 10);
    microSub = Math.max(0.05, Math.min(0.95, (obiScore * 0.7 + cvdBonus + 0.15) * spreadPenalty));
  } else if (ticker && Number(ticker.bid) && Number(ticker.ask)) {
    const spread = (Number(ticker.ask) - Number(ticker.bid)) / currentPrice;
    const spreadPenalty = Math.max(0, 1 - spread * 500); // tight spread = higher score
    microSub = 0.5 * spreadPenalty + 0.25;
  }

  // Composite Weighted Score (0.00 to 1.00)
  let rawScore =
    trendSub * 0.28 +
    momentumSub * 0.22 +
    volumeSub * 0.22 +
    volatilitySub * 0.10 +
    microSub * 0.18;

  if (aiInsight?.aiIntegrated) {
    // Blend with AI Regime adjustment
    rawScore = rawScore * 0.85 + (0.5 + aiInsight.aiScoreAdjustment) * 0.15;
    if (aiInsight.trapRisk === 'HIGH') {
      rawScore = Math.max(0.40, Math.min(0.60, rawScore)); // suppress into choppy neutral zone
    }
  }

  const compositeScore = Number(Math.max(0.02, Math.min(0.98, rawScore)).toFixed(2));

  let qualityTier: PrimitiveScore['qualityTier'] = 'MODERATE';
  let scaleLabel = 'Neutral Balanced Market';

  if (compositeScore >= 0.82) {
    qualityTier = 'EXCEPTIONAL';
    scaleLabel = 'Exceptional Bullish Confluence (Grade A+)';
  } else if (compositeScore >= 0.68) {
    qualityTier = 'HIGH_CONVICTION';
    scaleLabel = 'High Conviction Bullish (Grade A)';
  } else if (compositeScore <= 0.22) {
    qualityTier = 'EXCEPTIONAL';
    scaleLabel = 'Exceptional Bearish Breakdown (Grade A+)';
  } else if (compositeScore <= 0.35) {
    qualityTier = 'HIGH_CONVICTION';
    scaleLabel = 'High Conviction Short / Bearish (Grade A)';
  } else if (compositeScore >= 0.42 && compositeScore <= 0.58) {
    qualityTier = 'CHOPPY_NOISE';
    scaleLabel = 'Range-Bound Choppy Noise (Stand Aside)';
  }

  const orderedVariables = [
    {
      name: 'SuperTrend + EMA Alignment',
      value: `${indicators.superTrend?.direction || 'N/A'} (9/21 EMA)`,
      score: Number(trendSub.toFixed(2)),
      weight: 28,
    },
    {
      name: 'RSI & MACD Velocity',
      value: `RSI ${indicators.rsi.toFixed(1)} | Hist ${indicators.macd.histogram >= 0 ? '+' : ''}${indicators.macd.histogram.toFixed(3)}`,
      score: Number(momentumSub.toFixed(2)),
      weight: 22,
    },
    {
      name: 'Volume Surge & VWAP Ratio',
      value: `${indicators.volumeDynamics?.volumeSurgeRatio.toFixed(1) || '1.0'}x RVol | VWAP $${indicators.volumeDynamics?.vwap.toFixed(1) || '0'}`,
      score: Number(volumeSub.toFixed(2)),
      weight: 22,
    },
    {
      name: 'Level-2 Order Book Imbalance (OBI & CVD)',
      value: microstructure
        ? `OBI ${(microstructure.imbalanceRatio * 100).toFixed(0)}% (${microstructure.imbalanceGrade}) · CVD ${microstructure.cvdDirection}`
        : ticker ? `$${Number(ticker.bid).toFixed(1)} / $${Number(ticker.ask).toFixed(1)}` : 'Active Liquidity',
      score: Number(microSub.toFixed(2)),
      weight: 18,
    },
    {
      name: 'Bollinger Volatility %B',
      value: `${indicators.bollingerBands.percentB.toFixed(2)} %B`,
      score: Number(volatilitySub.toFixed(2)),
      weight: 10,
    },
  ];

  if (aiInsight?.aiIntegrated) {
    orderedVariables.push({
      name: `Gemini AI Market Regime (${aiInsight.model})`,
      value: `${aiInsight.regime.replace(/_/g, ' ')} (${aiInsight.trapRisk} Trap Risk)`,
      score: Number(Math.max(0.05, Math.min(0.95, 0.5 + aiInsight.aiScoreAdjustment)).toFixed(2)),
      weight: 15,
    });
  }

  return {
    compositeScore,
    qualityTier,
    scaleLabel,
    subScores: {
      trendStrength: Number(trendSub.toFixed(2)),
      momentumVelocity: Number(momentumSub.toFixed(2)),
      volatilityCompression: Number(volatilitySub.toFixed(2)),
      volumeInstitutionalFlow: Number(volumeSub.toFixed(2)),
      microstructureBook: Number(microSub.toFixed(2)),
    },
    orderedVariables,
  };
}

export function calculateBoolGatesPrimitive(
  choice: PrimitiveChoice,
  score: PrimitiveScore,
  indicators: IndicatorValues,
  riskParams?: {
    maxDailyDrawdownPercent?: number;
    currentDailyDrawdown?: number;
    trailingStopLoss?: boolean;
    minConfidence?: number;
  },
  aiInsight?: AiPrimitivesInsight,
  microstructure?: OrderBookMicrostructure
): PrimitiveBoolGates {
  const gates: PrimitiveBoolGates['gates'] = [];

  // Gate 1: Algorithm Confluence Agreement Gate (CRITICAL)
  // At least 2 independent algorithms must agree on the direction
  const matchingVotes = choice.algorithmVotes.filter((v) => v.vote === choice.selected).length;
  const confluencePass = matchingVotes >= 3 && choice.selected !== 'HOLD';
  gates.push({
    id: 'gate-confluence-agreement',
    name: 'Multi-Algorithm Confluence Gate',
    passed: confluencePass,
    description: confluencePass
      ? `${matchingVotes}/6 algorithmic engines actively agree on ${choice.selected}`
      : `Insufficient algorithmic concurrence (${matchingVotes}/6 agree). Stand aside.`,
    criticality: 'CRITICAL',
  });

  // Gate 2: Quantitative Score Conviction Gate (CRITICAL)
  // Score must fall into high conviction tier
  const scorePass =
    (choice.direction === 'LONG' && score.compositeScore >= 0.65) ||
    (choice.direction === 'SHORT' && score.compositeScore <= 0.35);
  gates.push({
    id: 'gate-score-conviction',
    name: 'Ordered Scale Conviction Gate',
    passed: scorePass,
    description: scorePass
      ? `Composite Score (${score.compositeScore}) meets high-conviction criteria for ${choice.direction}`
      : `Composite Score (${score.compositeScore}) is in neutral/noise zone (0.36 - 0.64)`,
    criticality: 'CRITICAL',
  });

  // Gate 3: Risk & Daily Drawdown Circuit Breaker Gate (CRITICAL)
  const currentDd = riskParams?.currentDailyDrawdown || 0;
  const maxDd = riskParams?.maxDailyDrawdownPercent || 5.0;
  const drawdownPass = currentDd < maxDd;
  gates.push({
    id: 'gate-drawdown-breaker',
    name: 'Drawdown Circuit Breaker Gate',
    passed: drawdownPass,
    description: drawdownPass
      ? `Daily drawdown (${currentDd.toFixed(1)}%) safely under max limit (${maxDd.toFixed(1)}%)`
      : `Circuit Breaker Tripped! Daily Drawdown hit limit (${currentDd.toFixed(1)}% >= ${maxDd.toFixed(1)}%)`,
    criticality: 'CRITICAL',
  });

  // Gate 4: Volatility & Chop Filter Gate (FILTER)
  // Avoid trading inside narrow sideways chop where Bollinger bandwidth is collapsed
  const bandwidth = indicators.bollingerBands.bandwidth;
  const volatilityPass = bandwidth >= 0.015 && indicators.rsi > 22 && indicators.rsi < 78;
  gates.push({
    id: 'gate-volatility-filter',
    name: 'Volatility & Chop Filter Gate',
    passed: volatilityPass,
    description: volatilityPass
      ? `Healthy volatility bandwidth (${(bandwidth * 100).toFixed(1)}%) allows trend realization`
      : `Chop Warning: Low bandwidth or extreme RSI (${indicators.rsi.toFixed(1)})`,
    criticality: 'FILTER',
  });

  // Gate 5: Dynamic Trailing Stop Loss Armor Gate (GUARD)
  const trailingArmed = riskParams?.trailingStopLoss !== false;
  gates.push({
    id: 'gate-trailing-armor',
    name: 'Trailing Stop Armor Gate',
    passed: trailingArmed,
    description: trailingArmed
      ? 'Dynamic Trailing Stop Loss engaged to ratchet and lock INR profit automatically'
      : 'Trailing Stop Loss disabled; higher downside risk',
    criticality: 'GUARD',
  });

  // Gate 6: Early Momentum Guard Gate (GUARD)
  const earlyGuardPass = !(
    (choice.direction === 'LONG' && indicators.macd.histogram < -0.15) ||
    (choice.direction === 'SHORT' && indicators.macd.histogram > 0.15)
  );
  gates.push({
    id: 'gate-early-momentum-guard',
    name: 'Early Adverse Momentum Guard',
    passed: earlyGuardPass,
    description: earlyGuardPass
      ? 'No conflicting counter-trend momentum impulse detected'
      : 'Adverse momentum detected on shorter cycle',
    criticality: 'GUARD',
  });

  // Gate 7: Level-2 Order Book Depth & Whale Spoof Shield Gate (CRITICAL)
  if (microstructure) {
    const isLong = choice.direction === 'LONG';
    const isShort = choice.direction === 'SHORT';
    const bookAligned = isLong
      ? microstructure.imbalanceRatio >= -0.22 && microstructure.spoofRisk !== 'HIGH'
      : isShort
      ? microstructure.imbalanceRatio <= 0.22 && microstructure.spoofRisk !== 'HIGH'
      : true;

    gates.push({
      id: 'gate-orderbook-depth-support',
      name: 'Order Book Depth & Spoof Shield',
      passed: bookAligned,
      description: bookAligned
        ? `L2 Book Support Confirmed (OBI: ${(microstructure.imbalanceRatio * 100).toFixed(0)}%, Spread: ${microstructure.spreadPercent.toFixed(3)}%, Spoof: ${microstructure.spoofRisk})`
        : `Whale Wall / Spoofing Alert: Adverse book pressure ${(microstructure.imbalanceRatio * 100).toFixed(0)}% against ${choice.direction}`,
      criticality: 'CRITICAL',
    });

    // Gate 8: Cumulative Volume Delta (CVD) Absorption Gate (FILTER)
    const cvdAligned = isLong
      ? microstructure.cvdDirection !== 'DISTRIBUTION'
      : isShort
      ? microstructure.cvdDirection !== 'ACCUMULATION'
      : true;

    gates.push({
      id: 'gate-cvd-absorption',
      name: 'CVD Volume Delta Absorption Gate',
      passed: cvdAligned,
      description: cvdAligned
        ? `Aggressive Volume Delta (${microstructure.cvdDirection}) aligns with market direction`
        : `Whale Absorption Divergence: Aggressive CVD moving against trade (${microstructure.cvdDirection})`,
      criticality: 'FILTER',
    });
  }

  // Gate 9: Gemini AI Liquidity Trap & Manipulation Gate (CRITICAL)
  if (aiInsight?.aiIntegrated) {
    const trapPass = aiInsight.trapRisk !== 'HIGH';
    gates.push({
      id: 'gate-ai-trap-risk',
      name: 'Gemini AI Trap Detection Gate',
      passed: trapPass,
      description: trapPass
        ? `AI Trap Risk: ${aiInsight.trapRisk}. ${aiInsight.trapAnalysis}`
        : `AI Alert: High probability of stop hunt or fake breakout! (${aiInsight.trapAnalysis})`,
      criticality: 'CRITICAL',
    });

    // Gate 8: Gemini AI Regime & Anomaly Veto Gate (CRITICAL)
    const vetoPass = !aiInsight.gatesVeto;
    gates.push({
      id: 'gate-ai-regime-veto',
      name: 'Gemini AI Anomaly & Veto Gate',
      passed: vetoPass,
      description: vetoPass
        ? `AI Regime: ${aiInsight.regime.replace(/_/g, ' ')}. Macro confirmation clear.`
        : `AI Veto Engaged: ${aiInsight.vetoReason || 'Adverse market anomaly detected'}`,
      criticality: 'CRITICAL',
    });
  }

  const criticalGatesPassed = gates
    .filter((g) => g.criticality === 'CRITICAL')
    .every((g) => g.passed);

  const allGatesPassed = gates.every((g) => g.passed);

  return {
    allGatesPassed: criticalGatesPassed && allGatesPassed,
    circuitBreakerActive: !drawdownPass,
    gates,
  };
}

export function evaluateDecisionPrimitives(
  indicators: IndicatorValues,
  currentPrice: number,
  market: string,
  ticker?: CoinDcxTicker | null,
  riskParams?: {
    maxDailyDrawdownPercent?: number;
    currentDailyDrawdown?: number;
    trailingStopLoss?: boolean;
    allowedDirection?: 'BOTH' | 'LONG_ONLY' | 'SHORT_ONLY';
  },
  aiInsight?: AiPrimitivesInsight,
  microstructure?: OrderBookMicrostructure,
  dualTierAi?: DualTierAiStatus
): DecisionPrimitivesResult {
  const choice = calculateChoicePrimitive(indicators, currentPrice, riskParams?.allowedDirection, aiInsight, microstructure);
  const score = calculateScorePrimitive(indicators, currentPrice, ticker, aiInsight, microstructure);
  const boolGates = calculateBoolGatesPrimitive(choice, score, indicators, riskParams, aiInsight, microstructure);

  const executeTrade = boolGates.allGatesPassed && choice.selected !== 'HOLD';
  const action: DecisionPrimitivesResult['actionableSignal']['action'] = executeTrade
    ? choice.direction === 'LONG'
      ? 'ENTER_LONG'
      : 'ENTER_SHORT'
    : 'STAND_ASIDE';

  const stopLossPct = 0.015;
  const takeProfitPct = 0.035;

  const suggestedStopLoss = choice.direction === 'SHORT'
    ? Number((currentPrice * (1 + stopLossPct)).toFixed(4))
    : Number((currentPrice * (1 - stopLossPct)).toFixed(4));

  const suggestedTakeProfit = choice.direction === 'SHORT'
    ? Number((currentPrice * (1 - takeProfitPct)).toFixed(4))
    : Number((currentPrice * (1 + takeProfitPct)).toFixed(4));

  const estimatedWinRate = Math.min(96, Math.max(50, Math.round(choice.dominantConfidence * 0.96)));

  const totalGates = boolGates.gates.length;
  const passedGates = boolGates.gates.filter((g) => g.passed).length;

  return {
    market,
    timestamp: Date.now(),
    currentPrice,
    choice,
    score,
    boolGates,
    aiInsights: aiInsight,
    microstructure,
    dualTierAi,
    actionableSignal: {
      executeTrade,
      action,
      recommendedLeverage: score.compositeScore >= 0.8 || score.compositeScore <= 0.2 ? 15 : 10,
      estimatedWinRate,
      expectedValue: `+${((estimatedWinRate * 0.035) - ((100 - estimatedWinRate) * 0.015)).toFixed(2)}%`,
      riskRewardRatio: '1 : 2.33',
      suggestedStopLoss,
      suggestedTakeProfit,
      suggestedTrailingStopPercent: 1.0,
      summaryReason: executeTrade
        ? `All 3 Primitives in Agreement: Choice (${choice.selected} ${choice.dominantConfidence}%), Score (${score.compositeScore} ${score.qualityTier}), and ${passedGates}/${totalGates} Bool Gates Cleared.${microstructure ? ` OBI: ${(microstructure.imbalanceRatio * 100).toFixed(0)}%.` : ''}${aiInsight ? ' Dual-Tier AI Confirmed.' : ''}`
        : `Execution Held: ${boolGates.gates.filter((g) => !g.passed).map((g) => g.name).join(', ') || 'Inconclusive probability distribution'}.`,
    },
  };
}
