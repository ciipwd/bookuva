import { Candle, IndicatorValues } from '../types/trading';

/**
 * Calculates exponential moving average
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return new Array(values.length).fill(NaN);
  
  const multiplier = 2 / (period + 1);
  const ema: number[] = new Array(values.length).fill(NaN);

  // First value is simple SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  ema[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

/**
 * Calculates Wilder's RSI (14-period standard)
 */
export function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsi;
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: number[] = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  // Calculate signal line as EMA of MACD line (skipping NaN values)
  const validMacdValues: number[] = [];
  const validIndices: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) {
      validMacdValues.push(macdLine[i]);
      validIndices.push(i);
    }
  }

  const signalLineValid = calculateEMA(validMacdValues, signalPeriod);
  const signalLine: number[] = new Array(closes.length).fill(NaN);
  const histogram: number[] = new Array(closes.length).fill(NaN);

  for (let j = 0; j < validIndices.length; j++) {
    const origIdx = validIndices[j];
    signalLine[origIdx] = signalLineValid[j];
    if (!isNaN(macdLine[origIdx]) && !isNaN(signalLine[origIdx])) {
      histogram[origIdx] = macdLine[origIdx] - signalLine[origIdx];
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates Bollinger Bands (20-period, 2-std dev)
 */
export function calculateBollingerBands(
  closes: number[],
  period = 20,
  multiplier = 2
): { upper: number[]; middle: number[]; lower: number[]; bandwidth: number[]; percentB: number[] } {
  const upper: number[] = new Array(closes.length).fill(NaN);
  const middle: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  const bandwidth: number[] = new Array(closes.length).fill(NaN);
  const percentB: number[] = new Array(closes.length).fill(NaN);

  if (closes.length < period) {
    return { upper, middle, lower, bandwidth, percentB };
  }

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += closes[i - j];
    }
    const sma = sum / period;
    middle[i] = sma;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(closes[i - j] - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    upper[i] = sma + multiplier * stdDev;
    lower[i] = sma - multiplier * stdDev;

    bandwidth[i] = sma === 0 ? 0 : ((upper[i] - lower[i]) / sma) * 100;
    const bandDiff = upper[i] - lower[i];
    percentB[i] = bandDiff === 0 ? 0.5 : (closes[i] - lower[i]) / bandDiff;
  }

  return { upper, middle, lower, bandwidth, percentB };
}

/**
 * Calculates Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < 2) return atr;

  const trueRanges: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return atr;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  atr[period - 1] = sum / period;

  for (let i = period; i < trueRanges.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

/**
 * Calculates SuperTrend (default: period 10, multiplier 3.0)
 * Uses true trailing ATR bands to generate high-accuracy trend reversals and dynamic support/resistance.
 */
export function calculateSuperTrend(
  candles: Candle[],
  period = 10,
  multiplier = 3.0
): {
  values: number[];
  directions: ('BULLISH' | 'BEARISH')[];
  upperBands: number[];
  lowerBands: number[];
  trendFlips: boolean[];
} {
  const len = candles.length;
  const values: number[] = new Array(len).fill(NaN);
  const directions: ('BULLISH' | 'BEARISH')[] = new Array(len).fill('BULLISH');
  const upperBands: number[] = new Array(len).fill(NaN);
  const lowerBands: number[] = new Array(len).fill(NaN);
  const trendFlips: boolean[] = new Array(len).fill(false);

  if (len < period) {
    return { values, directions, upperBands, lowerBands, trendFlips };
  }

  const atr = calculateATR(candles, period);

  const basicUpper: number[] = new Array(len).fill(0);
  const basicLower: number[] = new Array(len).fill(0);
  const finalUpper: number[] = new Array(len).fill(0);
  const finalLower: number[] = new Array(len).fill(0);

  // Initialize
  for (let i = period - 1; i < len; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const currentAtr = isNaN(atr[i]) ? (candles[i].high - candles[i].low) : atr[i];
    basicUpper[i] = hl2 + multiplier * currentAtr;
    basicLower[i] = hl2 - multiplier * currentAtr;

    if (i === period - 1) {
      finalUpper[i] = basicUpper[i];
      finalLower[i] = basicLower[i];
      directions[i] = candles[i].close > finalUpper[i] ? 'BULLISH' : 'BEARISH';
      values[i] = directions[i] === 'BULLISH' ? finalLower[i] : finalUpper[i];
      continue;
    }

    const prevFinalLower = finalLower[i - 1];
    const prevFinalUpper = finalUpper[i - 1];
    const prevClose = candles[i - 1].close;

    // Trailing Lower Band (cannot drop while price remains above it)
    if (basicLower[i] > prevFinalLower || prevClose < prevFinalLower) {
      finalLower[i] = basicLower[i];
    } else {
      finalLower[i] = prevFinalLower;
    }

    // Trailing Upper Band (cannot rise while price remains below it)
    if (basicUpper[i] < prevFinalUpper || prevClose > prevFinalUpper) {
      finalUpper[i] = basicUpper[i];
    } else {
      finalUpper[i] = prevFinalUpper;
    }

    // Direction Logic
    const prevDir = directions[i - 1];
    let currentDir: 'BULLISH' | 'BEARISH' = prevDir;

    if (prevDir === 'BEARISH' && candles[i].close > prevFinalUpper) {
      currentDir = 'BULLISH';
      trendFlips[i] = true;
    } else if (prevDir === 'BULLISH' && candles[i].close < prevFinalLower) {
      currentDir = 'BEARISH';
      trendFlips[i] = true;
    }

    directions[i] = currentDir;
    values[i] = currentDir === 'BULLISH' ? finalLower[i] : finalUpper[i];
    upperBands[i] = finalUpper[i];
    lowerBands[i] = finalLower[i];
  }

  return { values, directions, upperBands, lowerBands, trendFlips };
}

/**
 * Calculates Volume-Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: Candle[]): number[] {
  const vwap: number[] = new Array(candles.length).fill(NaN);
  let cumVol = 0;
  let cumTypicalVol = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = Math.max(0.0001, c.volume);

    cumTypicalVol += typicalPrice * vol;
    cumVol += vol;

    vwap[i] = cumVol > 0 ? cumTypicalVol / cumVol : typicalPrice;
  }

  return vwap;
}

/**
 * Calculates On-Balance Volume (OBV)
 */
export function calculateOBV(candles: Candle[]): number[] {
  const obv: number[] = new Array(candles.length).fill(0);
  if (candles.length === 0) return obv;

  obv[0] = candles[0].volume;
  for (let i = 1; i < candles.length; i++) {
    const currentClose = candles[i].close;
    const prevClose = candles[i - 1].close;
    const vol = candles[i].volume;

    if (currentClose > prevClose) {
      obv[i] = obv[i - 1] + vol;
    } else if (currentClose < prevClose) {
      obv[i] = obv[i - 1] - vol;
    } else {
      obv[i] = obv[i - 1];
    }
  }

  return obv;
}

/**
 * Calculates Chaikin Money Flow (CMF, 20-period)
 * Measures institutional accumulation (> +0.05) vs distribution (< -0.05)
 */
export function calculateCMF(candles: Candle[], period = 20): number[] {
  const cmf: number[] = new Array(candles.length).fill(0);
  if (candles.length < period) return cmf;

  const mfv: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    const mfm = range > 0 ? ((c.close - c.low) - (c.high - c.close)) / range : 0;
    mfv.push(mfm * c.volume);
  }

  for (let i = period - 1; i < candles.length; i++) {
    let sumMfv = 0;
    let sumVol = 0;
    for (let j = 0; j < period; j++) {
      sumMfv += mfv[i - j];
      sumVol += candles[i - j].volume;
    }
    cmf[i] = sumVol > 0 ? sumMfv / sumVol : 0;
  }

  return cmf;
}

/**
 * Calculates Money Flow Index (MFI, 14-period)
 * Volume-weighted RSI
 */
export function calculateMFI(candles: Candle[], period = 14): number[] {
  const mfi: number[] = new Array(candles.length).fill(50);
  if (candles.length <= period) return mfi;

  const typicalPrices = candles.map((c) => (c.high + c.low + c.close) / 3);
  const rawMoneyFlow = candles.map((c, i) => typicalPrices[i] * c.volume);

  for (let i = period; i < candles.length; i++) {
    let posFlow = 0;
    let negFlow = 0;

    for (let j = 0; j < period; j++) {
      const currIdx = i - j;
      const prevIdx = currIdx - 1;
      if (typicalPrices[currIdx] > typicalPrices[prevIdx]) {
        posFlow += rawMoneyFlow[currIdx];
      } else if (typicalPrices[currIdx] < typicalPrices[prevIdx]) {
        negFlow += rawMoneyFlow[currIdx];
      }
    }

    if (negFlow === 0) {
      mfi[i] = 100;
    } else {
      const moneyRatio = posFlow / negFlow;
      mfi[i] = 100 - (100 / (1 + moneyRatio));
    }
  }

  return mfi;
}

/**
 * Calculates Average Directional Index (ADX 14) with +DI and -DI
 * Filters out low-liquidity chop (ADX < 20) and identifies explosive trend breakouts (ADX > 25)
 */
export function calculateADX(
  candles: Candle[],
  period = 14
): { adx: number[]; plusDi: number[]; minusDi: number[] } {
  const len = candles.length;
  const adxArr: number[] = new Array(len).fill(0);
  const plusDiArr: number[] = new Array(len).fill(0);
  const minusDiArr: number[] = new Array(len).fill(0);

  if (len < period * 2) {
    return { adx: adxArr, plusDi: plusDiArr, minusDi: minusDiArr };
  }

  const tr: number[] = [candles[0].high - candles[0].low];
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];

  for (let i = 1; i < len; i++) {
    const c = candles[i];
    const prev = candles[i - 1];

    const upMove = c.high - prev.high;
    const downMove = prev.low - c.low;

    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const trueRange = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
    tr.push(trueRange);
  }

  // Smooth TR, +DM, -DM using Wilder's smoothing
  let smoothTr = 0;
  let smoothPlusDm = 0;
  let smoothMinusDm = 0;

  for (let i = 0; i < period; i++) {
    smoothTr += tr[i];
    smoothPlusDm += plusDm[i];
    smoothMinusDm += minusDm[i];
  }

  const dx: number[] = new Array(len).fill(0);

  for (let i = period; i < len; i++) {
    smoothTr = smoothTr - (smoothTr / period) + tr[i];
    smoothPlusDm = smoothPlusDm - (smoothPlusDm / period) + plusDm[i];
    smoothMinusDm = smoothMinusDm - (smoothMinusDm / period) + minusDm[i];

    const plusDi = smoothTr > 0 ? (smoothPlusDm / smoothTr) * 100 : 0;
    const minusDi = smoothTr > 0 ? (smoothMinusDm / smoothTr) * 100 : 0;

    plusDiArr[i] = plusDi;
    minusDiArr[i] = minusDi;

    const diSum = plusDi + minusDi;
    const diDiff = Math.abs(plusDi - minusDi);
    dx[i] = diSum > 0 ? (diDiff / diSum) * 100 : 0;
  }

  // First ADX is average of DX
  let adxSum = 0;
  const startAdx = period * 2 - 1;
  if (startAdx < len) {
    for (let i = period; i <= startAdx; i++) {
      adxSum += dx[i];
    }
    adxArr[startAdx] = adxSum / period;

    for (let i = startAdx + 1; i < len; i++) {
      adxArr[i] = (adxArr[i - 1] * (period - 1) + dx[i]) / period;
    }
  }

  return { adx: adxArr, plusDi: plusDiArr, minusDi: minusDiArr };
}

/**
 * Extracts latest technical indicator snapshot for strategy decision
 */
export function extractLatestIndicators(candles: Candle[]): IndicatorValues {
  // Ensure chronological order (oldest to newest)
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const closes = sorted.map((c) => c.close);
  const volumes = sorted.map((c) => c.volume);

  const rsiArr = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes, 12, 26, 9);
  const bbData = calculateBollingerBands(closes, 20, 2);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const atrArr = calculateATR(sorted, 14);

  // SuperTrend (10, 3.0)
  const stData = calculateSuperTrend(sorted, 10, 3.0);

  // Volume & Flow Indicators
  const vwapArr = calculateVWAP(sorted);
  const obvArr = calculateOBV(sorted);
  const cmfArr = calculateCMF(sorted, 20);
  const mfiArr = calculateMFI(sorted, 14);
  const adxData = calculateADX(sorted, 14);

  // Volume 20 SMA
  let volumeSma20 = 0;
  const volSlice = volumes.slice(-20);
  if (volSlice.length > 0) {
    volumeSma20 = volSlice.reduce((acc, v) => acc + v, 0) / volSlice.length;
  }

  const lastIdx = sorted.length - 1;
  const lastCandle = sorted[lastIdx] || { high: 0, low: 0, close: 0, volume: 0 };
  const prevCandle = sorted[lastIdx - 1] || lastCandle;

  // SuperTrend latest state
  const stDir = stData.directions[lastIdx] || 'BULLISH';
  const stVal = stData.values[lastIdx] || (stDir === 'BULLISH' ? lastCandle.low * 0.99 : lastCandle.high * 1.01);
  const stUpper = stData.upperBands[lastIdx] || lastCandle.high * 1.02;
  const stLower = stData.lowerBands[lastIdx] || lastCandle.low * 0.98;
  const stFlipped = Boolean(stData.trendFlips[lastIdx]);
  const stSignal = stFlipped ? (stDir === 'BULLISH' ? 'BUY' : 'SELL') : 'HOLD';

  // Volume Dynamics analysis
  const currentVol = lastCandle.volume;
  const volumeSurgeRatio = volumeSma20 > 0 ? Number((currentVol / volumeSma20).toFixed(2)) : 1.0;
  const volumeTrend: 'EXPANDING' | 'CONTRACTING' | 'NORMAL' =
    volumeSurgeRatio >= 1.4 ? 'EXPANDING' : volumeSurgeRatio <= 0.7 ? 'CONTRACTING' : 'NORMAL';

  const latestVwap = vwapArr[lastIdx] || lastCandle.close;
  const priceVsVwapPercent = latestVwap > 0 ? Number((((lastCandle.close - latestVwap) / latestVwap) * 100).toFixed(2)) : 0;
  const vwapPosition: 'ABOVE_INSTITUTIONAL_BUY' | 'BELOW_INSTITUTIONAL_SELL' =
    lastCandle.close >= latestVwap ? 'ABOVE_INSTITUTIONAL_BUY' : 'BELOW_INSTITUTIONAL_SELL';

  // OBV trend slope over last 10 candles
  const latestObv = obvArr[lastIdx] || 0;
  const pastObv = obvArr[Math.max(0, lastIdx - 10)] || latestObv;
  const obvTrend: 'BULLISH_ACCUMULATION' | 'BEARISH_DISTRIBUTION' | 'NEUTRAL' =
    latestObv > pastObv ? 'BULLISH_ACCUMULATION' : latestObv < pastObv ? 'BEARISH_DISTRIBUTION' : 'NEUTRAL';

  // ADX trend strength
  const currentAdx = adxData.adx[lastIdx] || 20;
  const currentPlusDi = adxData.plusDi[lastIdx] || 25;
  const currentMinusDi = adxData.minusDi[lastIdx] || 20;
  const trendStrength: 'STRONG_TREND' | 'MODERATE_TREND' | 'WEAK_CHOP' =
    currentAdx >= 25 ? 'STRONG_TREND' : currentAdx >= 18 ? 'MODERATE_TREND' : 'WEAK_CHOP';

  // Standard Floor Pivot Points based on previous candle
  const pivot = (prevCandle.high + prevCandle.low + prevCandle.close) / 3;
  const r1 = 2 * pivot - prevCandle.low;
  const s1 = 2 * pivot - prevCandle.high;
  const r2 = pivot + (prevCandle.high - prevCandle.low);
  const s2 = pivot - (prevCandle.high - prevCandle.low);

  return {
    rsi: Number((rsiArr[lastIdx] || 50).toFixed(2)),
    macd: {
      macdLine: Number((macdData.macdLine[lastIdx] || 0).toFixed(4)),
      signalLine: Number((macdData.signalLine[lastIdx] || 0).toFixed(4)),
      histogram: Number((macdData.histogram[lastIdx] || 0).toFixed(4)),
    },
    bollingerBands: {
      upper: Number((bbData.upper[lastIdx] || lastCandle.close * 1.02).toFixed(4)),
      middle: Number((bbData.middle[lastIdx] || lastCandle.close).toFixed(4)),
      lower: Number((bbData.lower[lastIdx] || lastCandle.close * 0.98).toFixed(4)),
      bandwidth: Number((bbData.bandwidth[lastIdx] || 0).toFixed(2)),
      percentB: Number((bbData.percentB[lastIdx] || 0.5).toFixed(3)),
    },
    ema: {
      ema9: Number((ema9[lastIdx] || lastCandle.close).toFixed(4)),
      ema21: Number((ema21[lastIdx] || lastCandle.close).toFixed(4)),
      ema50: Number((ema50[lastIdx] || lastCandle.close).toFixed(4)),
      ema200: Number((ema200[lastIdx] || lastCandle.close).toFixed(4)),
    },
    atr: Number((atrArr[lastIdx] || (lastCandle.high - lastCandle.low) || 1).toFixed(4)),
    volumeSma20: Number(volumeSma20.toFixed(2)),
    pivotPoints: {
      pivot: Number(pivot.toFixed(4)),
      r1: Number(r1.toFixed(4)),
      s1: Number(s1.toFixed(4)),
      r2: Number(r2.toFixed(4)),
      s2: Number(s2.toFixed(4)),
    },
    superTrend: {
      value: Number(stVal.toFixed(4)),
      direction: stDir,
      upperBand: Number(stUpper.toFixed(4)),
      lowerBand: Number(stLower.toFixed(4)),
      trendFlipped: stFlipped,
      signal: stSignal,
    },
    volumeDynamics: {
      currentVolume: Number(currentVol.toFixed(2)),
      volumeSma20: Number(volumeSma20.toFixed(2)),
      volumeSurgeRatio,
      volumeTrend,
      obv: Number(latestObv.toFixed(2)),
      obvSma20: Number((obvArr.slice(-20).reduce((a, b) => a + b, 0) / 20 || latestObv).toFixed(2)),
      obvTrend,
      vwap: Number(latestVwap.toFixed(4)),
      priceVsVwapPercent,
      vwapPosition,
      cmf: Number((cmfArr[lastIdx] || 0).toFixed(3)),
      mfi: Number((mfiArr[lastIdx] || 50).toFixed(1)),
    },
    adx: {
      adx: Number(currentAdx.toFixed(1)),
      plusDi: Number(currentPlusDi.toFixed(1)),
      minusDi: Number(currentMinusDi.toFixed(1)),
      trendStrength,
    },
  };
}
