import {
  Candle,
  IndicatorValues,
  OrderBook,
  ProbabilityFactorBreakdown,
  MarketScanResult,
  PositionDirection,
} from '../types/trading';

interface ProbabilityInput {
  candles: Candle[];
  indicators: IndicatorValues | null;
  orderBook?: OrderBook | null;
  currentPrice: number;
}

/**
 * Quantitative Multi-Factor Win Probability & Loss-Prevention Analyzer
 * Synthesizes Trend, Momentum, Orderbook Imbalance, Volatility and Price Action.
 */
export function calculateMarketProbability({
  candles,
  indicators,
  orderBook,
  currentPrice,
}: ProbabilityInput): ProbabilityFactorBreakdown {
  if (!candles || candles.length < 20 || !indicators) {
    return {
      trendScore: 50,
      momentumScore: 50,
      orderbookScore: 50,
      volatilityScore: 50,
      priceActionScore: 50,
      overallWinProbability: 50,
      recommendedDirection: 'NEUTRAL',
      lossRiskLevel: 'HIGH',
      lossPreventionActive: false,
      expectedValue: 0,
      riskRewardRatio: '1:1.5',
      multiTimeframeConsensus: {
        '1m': 'NEUTRAL',
        '5m': 'NEUTRAL',
        '15m': 'NEUTRAL',
      },
      keySignals: ['Awaiting sufficient candlestick history...'],
    };
  }

  const keySignals: string[] = [];

  // 1. Trend Factor (EMA alignment + SuperTrend Confluence)
  let trendScoreLong = 50;
  let trendScoreShort = 50;

  const { ema9, ema21, ema50, ema200 } = indicators.ema;
  if (!isNaN(ema9) && !isNaN(ema21) && !isNaN(ema50)) {
    if (ema9 > ema21 && ema21 > ema50 && currentPrice > ema50) {
      trendScoreLong = 85;
      trendScoreShort = 15;
      if (!isNaN(ema200) && currentPrice > ema200) {
        trendScoreLong = 94;
        keySignals.push('Bullish Quad-EMA Trend Alignment (EMA 9 > 21 > 50 > 200)');
      } else {
        keySignals.push('Bullish Golden Cross above 50 EMA');
      }
    } else if (ema9 < ema21 && ema21 < ema50 && currentPrice < ema50) {
      trendScoreShort = 85;
      trendScoreLong = 15;
      if (!isNaN(ema200) && currentPrice < ema200) {
        trendScoreShort = 94;
        keySignals.push('Bearish Death-Cross Quad-EMA Alignment (EMA 9 < 21 < 50 < 200)');
      } else {
        keySignals.push('Bearish Trend Breakdown below 50 EMA');
      }
    } else if (currentPrice > ema21) {
      trendScoreLong = 65;
      trendScoreShort = 35;
      keySignals.push('Price consolidating above 21 EMA');
    } else {
      trendScoreShort = 65;
      trendScoreLong = 35;
      keySignals.push('Price consolidating below 21 EMA');
    }
  }

  // SuperTrend Integration (Trailing ATR bands)
  if (indicators.superTrend) {
    const { direction, value, trendFlipped } = indicators.superTrend;
    if (direction === 'BULLISH') {
      trendScoreLong = Math.min(98, trendScoreLong + 20);
      trendScoreShort = Math.max(5, trendScoreShort - 20);
      if (trendFlipped) {
        keySignals.unshift(`🟢 SuperTrend Bullish Flip (Support: $${value.toLocaleString()})`);
      } else {
        keySignals.push(`SuperTrend Bullish Support ($${value.toLocaleString()})`);
      }
    } else {
      trendScoreShort = Math.min(98, trendScoreShort + 20);
      trendScoreLong = Math.max(5, trendScoreLong - 20);
      if (trendFlipped) {
        keySignals.unshift(`🔴 SuperTrend Bearish Flip (Resistance: $${value.toLocaleString()})`);
      } else {
        keySignals.push(`SuperTrend Bearish Overhead Resistance ($${value.toLocaleString()})`);
      }
    }
  }

  // 2. Momentum Factor (RSI + MACD Histogram slope + MFI)
  let momentumScoreLong = 50;
  let momentumScoreShort = 50;

  const rsi = indicators.rsi;
  const { macdLine, signalLine, histogram } = indicators.macd;

  // RSI Analysis
  if (!isNaN(rsi)) {
    if (rsi >= 44 && rsi <= 62) {
      // Golden sweetspot for continuation long
      momentumScoreLong += 20;
      keySignals.push(`RSI in Bullish Expansion Zone (${rsi.toFixed(1)})`);
    } else if (rsi < 30) {
      // Oversold bounce potential
      momentumScoreLong += 25;
      keySignals.push(`RSI Oversold Exhaustion Bounce (${rsi.toFixed(1)})`);
    } else if (rsi > 70) {
      // Overbought rejection potential
      momentumScoreShort += 25;
      keySignals.push(`RSI Overbought Rejection Trap (${rsi.toFixed(1)})`);
    } else if (rsi >= 38 && rsi <= 55) {
      momentumScoreShort += 15;
    }
  }

  // MACD Analysis
  if (!isNaN(histogram) && !isNaN(macdLine) && !isNaN(signalLine)) {
    if (histogram > 0 && macdLine > signalLine) {
      momentumScoreLong += 20;
      momentumScoreShort -= 15;
      keySignals.push(`MACD Bullish Histogram Accelerating (+${histogram.toFixed(3)})`);
    } else if (histogram < 0 && macdLine < signalLine) {
      momentumScoreShort += 20;
      momentumScoreLong -= 15;
      keySignals.push(`MACD Bearish Divergence Accelerating (${histogram.toFixed(3)})`);
    }
  }

  // 3. Volume & Flow Dynamics (Volume Surge + VWAP + OBV + CMF)
  let volumeScoreLong = 50;
  let volumeScoreShort = 50;

  if (indicators.volumeDynamics) {
    const { volumeSurgeRatio, vwapPosition, obvTrend, cmf, mfi, vwap } = indicators.volumeDynamics;

    // Volume Surge Verification
    if (volumeSurgeRatio >= 1.4) {
      keySignals.push(`📊 High Volume Surge (${volumeSurgeRatio.toFixed(1)}x 20-SMA expansion)`);
      if (indicators.superTrend?.direction === 'BULLISH' || currentPrice > vwap) {
        volumeScoreLong += 25;
        volumeScoreShort -= 15;
      } else {
        volumeScoreShort += 25;
        volumeScoreLong -= 15;
      }
    } else if (volumeSurgeRatio <= 0.6) {
      // Low volume fakeout warning
      volumeScoreLong -= 10;
      volumeScoreShort -= 10;
    }

    // VWAP Institutional Positioning
    if (vwapPosition === 'ABOVE_INSTITUTIONAL_BUY') {
      volumeScoreLong += 15;
      keySignals.push(`Price Above Institutional VWAP ($${vwap.toFixed(2)})`);
    } else {
      volumeScoreShort += 15;
      keySignals.push(`Price Below Institutional VWAP ($${vwap.toFixed(2)})`);
    }

    // OBV Trend Slope
    if (obvTrend === 'BULLISH_ACCUMULATION') {
      volumeScoreLong += 15;
      volumeScoreShort -= 10;
    } else if (obvTrend === 'BEARISH_DISTRIBUTION') {
      volumeScoreShort += 15;
      volumeScoreLong -= 10;
    }

    // Chaikin Money Flow (CMF)
    if (cmf > 0.08) {
      volumeScoreLong += 15;
    } else if (cmf < -0.08) {
      volumeScoreShort += 15;
    }

    // Money Flow Index (MFI)
    if (mfi < 25) {
      volumeScoreLong += 15; // MFI oversold
    } else if (mfi > 75) {
      volumeScoreShort += 15; // MFI overbought
    }
  }

  volumeScoreLong = Math.max(5, Math.min(98, volumeScoreLong));
  volumeScoreShort = Math.max(5, Math.min(98, volumeScoreShort));
  momentumScoreLong = Math.max(5, Math.min(98, momentumScoreLong));
  momentumScoreShort = Math.max(5, Math.min(98, momentumScoreShort));

  // 3. Orderbook Imbalance & Liquidity Walls
  let orderbookScoreLong = 50;
  let orderbookScoreShort = 50;

  if (orderBook && orderBook.bids?.length > 0 && orderBook.asks?.length > 0) {
    const topBids = orderBook.bids.slice(0, 15);
    const topAsks = orderBook.asks.slice(0, 15);
    const totalBidVol = topBids.reduce((sum, b) => sum + b.quantity, 0);
    const totalAskVol = topAsks.reduce((sum, a) => sum + a.quantity, 0);

    const ratio = totalAskVol > 0 ? totalBidVol / totalAskVol : 1;
    if (ratio >= 1.45) {
      orderbookScoreLong = Math.min(96, Math.round(50 + ratio * 15));
      orderbookScoreShort = Math.max(10, Math.round(50 - ratio * 15));
      keySignals.push(`Institutional Bid Wall Dominance (${ratio.toFixed(2)}x Buy Support)`);
    } else if (ratio <= 0.65) {
      orderbookScoreShort = Math.min(96, Math.round(50 + (1 / Math.max(0.1, ratio)) * 15));
      orderbookScoreLong = Math.max(10, Math.round(50 - (1 / Math.max(0.1, ratio)) * 15));
      keySignals.push(`Heavy Sell Wall Overhead (${(1 / ratio).toFixed(2)}x Resistance)`);
    } else {
      orderbookScoreLong = 52;
      orderbookScoreShort = 48;
    }
  } else {
    // Default neutral
    orderbookScoreLong = 55;
    orderbookScoreShort = 45;
  }

  // 4. Volatility Squeeze & Bollinger Reversion
  let volatilityScoreLong = 50;
  let volatilityScoreShort = 50;

  const bb = indicators.bollingerBands;
  if (bb && !isNaN(bb.bandwidth)) {
    if (bb.bandwidth < 2.0) {
      keySignals.push(`Low-Volatility Bollinger Squeeze (${bb.bandwidth.toFixed(2)}% BW)`);
    }
    if (bb.percentB > 0.85) {
      volatilityScoreLong = 75;
      volatilityScoreShort = 25;
      keySignals.push(`Bollinger Upper Band Expansion (%B: ${bb.percentB.toFixed(2)})`);
    } else if (bb.percentB < 0.15) {
      volatilityScoreShort = 75;
      volatilityScoreLong = 25;
      keySignals.push(`Bollinger Lower Band Breakdown (%B: ${bb.percentB.toFixed(2)})`);
    } else {
      volatilityScoreLong = 55;
      volatilityScoreShort = 55;
    }
  }

  // 5. Candlestick Structure & Price Action
  let priceActionLong = 50;
  let priceActionShort = 50;

  const recentCandles = candles.slice(-10);
  if (recentCandles.length >= 5) {
    const lastCandle = recentCandles[recentCandles.length - 1];
    const prevCandle = recentCandles[recentCandles.length - 2];

    const body = Math.abs(lastCandle.close - lastCandle.open);
    const range = lastCandle.high - lastCandle.low;
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);

    // Bullish pinbar / hammer
    if (range > 0 && lowerWick / range > 0.55 && lastCandle.close >= prevCandle.close) {
      priceActionLong = 88;
      priceActionShort = 15;
      keySignals.push('Bullish Pinbar Wick Rejection at Support');
    }
    // Bearish shooting star
    else if (range > 0 && upperWick / range > 0.55 && lastCandle.close <= prevCandle.close) {
      priceActionShort = 88;
      priceActionLong = 15;
      keySignals.push('Bearish Shooting Star Rejection at Resistance');
    }
    // Momentum candles
    else if (lastCandle.close > prevCandle.high) {
      priceActionLong = 72;
      priceActionShort = 28;
    } else if (lastCandle.close < prevCandle.low) {
      priceActionShort = 72;
      priceActionLong = 28;
    }
  }

  // Determine Direction Consensus with SuperTrend & Volume dynamics
  const longWeightedProb =
    trendScoreLong * 0.25 +
    volumeScoreLong * 0.25 +
    momentumScoreLong * 0.20 +
    orderbookScoreLong * 0.15 +
    volatilityScoreLong * 0.15;

  const shortWeightedProb =
    trendScoreShort * 0.25 +
    volumeScoreShort * 0.25 +
    momentumScoreShort * 0.20 +
    orderbookScoreShort * 0.15 +
    volatilityScoreShort * 0.15;

  let recommendedDirection: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let overallWinProbability = 50;
  let activeTrend = 50;
  let activeMomentum = 50;
  let activeOrderbook = 50;
  let activeVolatility = 50;
  let activePriceAction = 50;

  if (longWeightedProb > shortWeightedProb && longWeightedProb >= 58) {
    recommendedDirection = 'LONG';
    overallWinProbability = Math.round(longWeightedProb);
    activeTrend = trendScoreLong;
    activeMomentum = momentumScoreLong;
    activeOrderbook = orderbookScoreLong;
    activeVolatility = volatilityScoreLong;
    activePriceAction = priceActionLong;
  } else if (shortWeightedProb > longWeightedProb && shortWeightedProb >= 58) {
    recommendedDirection = 'SHORT';
    overallWinProbability = Math.round(shortWeightedProb);
    activeTrend = trendScoreShort;
    activeMomentum = momentumScoreShort;
    activeOrderbook = orderbookScoreShort;
    activeVolatility = volatilityScoreShort;
    activePriceAction = priceActionShort;
  } else {
    recommendedDirection = 'NEUTRAL';
    overallWinProbability = Math.round(Math.max(longWeightedProb, shortWeightedProb));
    activeTrend = Math.round((trendScoreLong + trendScoreShort) / 2);
    activeMomentum = Math.round((momentumScoreLong + momentumScoreShort) / 2);
    activeOrderbook = Math.round((orderbookScoreLong + orderbookScoreShort) / 2);
    activeVolatility = 50;
    activePriceAction = 50;
  }

  // 4. ADX Filter (Avoid Choppy False Breakouts, Boost Strong Trends)
  if (indicators.adx) {
    if (indicators.adx.trendStrength === 'WEAK_CHOP') {
      keySignals.push(`⚠️ Low ADX Chop Filter (${indicators.adx.adx} ADX - Rangebound Trap Risk)`);
      overallWinProbability = Math.min(65, overallWinProbability - 10);
    } else if (indicators.adx.trendStrength === 'STRONG_TREND') {
      keySignals.push(`🔥 Strong Trend Velocity (${indicators.adx.adx} ADX Trending)`);
      if (recommendedDirection !== 'NEUTRAL') {
        overallWinProbability = Math.min(96, overallWinProbability + 5);
      }
    }
  }

  // Loss Risk Rating & Protection Guard
  let lossRiskLevel: 'ULTRA_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
  if (overallWinProbability >= 82 && indicators.adx?.trendStrength !== 'WEAK_CHOP') {
    lossRiskLevel = 'ULTRA_LOW';
  } else if (overallWinProbability >= 75 && indicators.adx?.trendStrength !== 'WEAK_CHOP') {
    lossRiskLevel = 'LOW';
  } else if (overallWinProbability >= 65) {
    lossRiskLevel = 'MEDIUM';
  } else {
    lossRiskLevel = 'HIGH';
  }

  // Loss prevention is considered verified active when win prob is >= 75%
  const lossPreventionActive = overallWinProbability >= 75;

  // Expected Value Calculation: EV = (P(Win) * 3%) - (P(Loss) * 1.5%)
  const winFraction = overallWinProbability / 100;
  const lossFraction = (100 - overallWinProbability) / 100;
  const expectedValue = Number((winFraction * 3.0 - lossFraction * 1.5).toFixed(2));

  // Risk Reward Ratio
  const riskRewardRatio = overallWinProbability >= 80 ? '1:3.2' : overallWinProbability >= 70 ? '1:2.4' : '1:1.8';

  // Multi-Timeframe Consensus Estimation
  const mtfConsensus = {
    '1m': (recommendedDirection === 'LONG' ? 'BULLISH' : recommendedDirection === 'SHORT' ? 'BEARISH' : 'NEUTRAL') as any,
    '5m': (trendScoreLong > 70 ? 'BULLISH' : trendScoreShort > 70 ? 'BEARISH' : 'NEUTRAL') as any,
    '15m': (currentPrice > indicators.ema.ema50 ? 'BULLISH' : 'BEARISH') as any,
  };

  return {
    trendScore: Math.round(activeTrend),
    momentumScore: Math.round(activeMomentum),
    orderbookScore: Math.round(activeOrderbook),
    volatilityScore: Math.round(activeVolatility),
    priceActionScore: Math.round(activePriceAction),
    overallWinProbability,
    recommendedDirection,
    lossRiskLevel,
    lossPreventionActive,
    expectedValue,
    riskRewardRatio,
    multiTimeframeConsensus: mtfConsensus,
    keySignals: keySignals.slice(0, 4),
  };
}
