export type MarketCurrency = 'USDT' | 'INR';

export type PositionSide = 'BUY' | 'SELL'; // BUY = LONG, SELL = SHORT
export type PositionDirection = 'LONG' | 'SHORT';

export interface CoinDcxTicker {
  market: string;
  change_24_hour: string;
  high: string;
  low: string;
  volume: string;
  last_price: string;
  bid: string;
  ask: string;
  timestamp: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SuperTrendValues {
  value: number;
  direction: 'BULLISH' | 'BEARISH';
  upperBand: number;
  lowerBand: number;
  trendFlipped: boolean;
  signal: 'BUY' | 'SELL' | 'HOLD';
}

export interface VolumeValues {
  currentVolume: number;
  volumeSma20: number;
  volumeSurgeRatio: number;
  volumeTrend: 'EXPANDING' | 'CONTRACTING' | 'NORMAL';
  obv: number;
  obvSma20: number;
  obvTrend: 'BULLISH_ACCUMULATION' | 'BEARISH_DISTRIBUTION' | 'NEUTRAL';
  vwap: number;
  priceVsVwapPercent: number;
  vwapPosition: 'ABOVE_INSTITUTIONAL_BUY' | 'BELOW_INSTITUTIONAL_SELL';
  cmf: number; // Chaikin Money Flow (-1 to +1)
  mfi: number; // Money Flow Index (0 to 100)
}

export interface AdxValues {
  adx: number;
  plusDi: number;
  minusDi: number;
  trendStrength: 'STRONG_TREND' | 'MODERATE_TREND' | 'WEAK_CHOP';
}

export interface IndicatorValues {
  rsi: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
  };
  ema: {
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
  };
  atr: number;
  volumeSma20: number;
  pivotPoints: {
    pivot: number;
    r1: number;
    s1: number;
    r2: number;
    s2: number;
  };
  superTrend: SuperTrendValues;
  volumeDynamics: VolumeValues;
  adx: AdxValues;
}

export type StrategyType = 
  | 'confluence_ensemble'
  | 'gemini_ai_confluence'
  | 'supertrend_volume_flow'
  | 'rsi_macd_reversal'
  | 'bollinger_breakout'
  | 'ema_golden_cross'
  | 'dynamic_grid_dca';

// -------------------------------------------------------------
// 3 PRIMITIVES ENSEMBLE DECISION ENGINE (Typesafe Trading Framework)
// Primitive 1: Choice (Direction & Probability Distribution)
// Primitive 2: Score (Continuous Quantitative Factor Index 0.00 - 1.00)
// Primitive 3: Bool (Binary Circuit Breakers & Risk Verification Gates)
// -------------------------------------------------------------

export interface PrimitiveChoice {
  selected: 'BUY' | 'HOLD' | 'SELL';
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  probability: {
    buy: number; // e.g. 78%
    hold: number; // e.g. 15%
    sell: number; // e.g. 7%
  };
  dominantConfidence: number; // 0 to 100
  algorithmVotes: {
    algorithm: string;
    vote: 'BUY' | 'HOLD' | 'SELL';
    weight: number;
    reason: string;
  }[];
}

export interface PrimitiveScore {
  compositeScore: number; // 0.00 to 1.00
  qualityTier: 'EXCEPTIONAL' | 'HIGH_CONVICTION' | 'MODERATE' | 'CHOPPY_NOISE' | 'ADVERSE_RISK';
  scaleLabel: string;
  subScores: {
    trendStrength: number; // 0.00 to 1.00 (EMA + SuperTrend slope)
    momentumVelocity: number; // 0.00 to 1.00 (RSI + MACD histogram expansion)
    volatilityCompression: number; // 0.00 to 1.00 (Bollinger %B & Bandwidth)
    volumeInstitutionalFlow: number; // 0.00 to 1.00 (VWAP delta + Surge Ratio)
    microstructureBook: number; // 0.00 to 1.00 (Bid/Ask pressure)
  };
  orderedVariables: {
    name: string;
    value: string | number;
    score: number;
    weight: number;
  }[];
}

export interface PrimitiveBoolGates {
  allGatesPassed: boolean;
  circuitBreakerActive: boolean;
  gates: {
    id: string;
    name: string;
    passed: boolean;
    description: string;
    criticality: 'CRITICAL' | 'GUARD' | 'FILTER';
  }[];
}

export interface OrderBookMicrostructure {
  bidsTotal: number;
  asksTotal: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  imbalanceRatio: number; // -1.0 (100% sell pressure) to +1.0 (100% buy pressure), 0 = balanced
  imbalanceGrade: 'STRONG_BUY_WALL' | 'MODERATE_BUY' | 'BALANCED' | 'MODERATE_SELL' | 'STRONG_SELL_WALL';
  spread: number;
  spreadPercent: number;
  cumulativeVolumeDelta: number; // CVD: aggregated net buying vs selling flow
  cvdDirection: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  spoofRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  largeWalls: {
    bidWallPrice?: number;
    bidWallQuantity?: number;
    askWallPrice?: number;
    askWallQuantity?: number;
  };
}

export interface DualTierAiStatus {
  tier1: {
    model: string; // 'gemini-3.1-flash-lite'
    latencyMs: number;
    active: boolean;
    scanSummary: string;
  };
  tier2: {
    model: string; // 'gemini-3.8-flash'
    latencyMs: number;
    active: boolean;
    regime: string;
    trapVerdict: string;
    macroThesis: string;
  };
}

export interface AiPrimitivesInsight {
  aiIntegrated: boolean;
  model: string;
  latencyMs: number;
  regime: 'BULLISH_EXPANSION' | 'BEARISH_EXPANSION' | 'RANGE_BOUND_CHOP' | 'VOLATILITY_SQUEEZE' | 'REVERSAL_EXHAUSTION';
  trapRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  trapAnalysis: string;
  macroRationale: string;
  aiPredictedProbabilities: {
    buy: number;
    hold: number;
    sell: number;
  };
  aiScoreAdjustment: number;
  gatesVeto: boolean;
  vetoReason?: string;
  dualTier?: DualTierAiStatus;
}

export interface DecisionPrimitivesResult {
  market: string;
  timestamp: number;
  currentPrice: number;
  choice: PrimitiveChoice;
  score: PrimitiveScore;
  boolGates: PrimitiveBoolGates;
  aiInsights?: AiPrimitivesInsight;
  microstructure?: OrderBookMicrostructure;
  dualTierAi?: DualTierAiStatus;
  actionableSignal: {
    executeTrade: boolean;
    action: 'ENTER_LONG' | 'ENTER_SHORT' | 'STAND_ASIDE' | 'HOLD_CURRENT';
    recommendedLeverage: number;
    estimatedWinRate: number;
    expectedValue: string;
    riskRewardRatio: string;
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    suggestedTrailingStopPercent: number;
    summaryReason: string;
  };
}

export interface RiskConfig {
  capitalPerTradePercent: number; // e.g., 5%
  maxOpenPositions: number; // e.g., 3
  stopLossPercent: number; // e.g., 1.5%
  takeProfitPercent: number; // e.g., 3.0%
  trailingStopLoss: boolean;
  trailingStopPercent: number; // e.g., 1.0%
  trailingActivationPercent?: number; // Profit % required before trailing starts (0 = immediate)
  trailingUseSuperTrend?: boolean; // Dynamically link trailing stop to SuperTrend ATR line
  maxDailyDrawdownPercent: number; // e.g., 5.0%
  cooldownMinutes: number; // e.g., 1
  slippageTolerancePercent: number; // e.g., 0.15%
  minWinProbabilityPercent: number; // e.g., 80% threshold to prevent losses
  autoBreakevenLock: boolean; // Automatically move SL to entry+fee when in profit
  breakevenTriggerPercent: number; // e.g., 0.8% profit triggers breakeven lock
  earlyMomentumCut: boolean; // Cut adverse reversals early to avoid full loss
  autoScanMultiMarket: boolean; // Continuous auto-scanner across top pairs
  superTrendFilter?: boolean; // Ensure SuperTrend direction aligns before entering
  volumeSurgeFilter?: boolean; // Ensure volume surge confirms before entering
}

export interface BotConfig {
  isRunning: boolean;
  mode: 'paper' | 'live';
  tradingType: 'futures' | 'spot'; // Default 'futures'
  marginCurrency: 'INR' | 'USDT'; // Default 'INR'
  defaultLeverage: number; // e.g., 10x
  allowedDirection: 'BOTH' | 'LONG_ONLY' | 'SHORT_ONLY';
  activeMarket: string; // e.g., 'BTCUSDT'
  candlePair: string; // e.g., 'B-BTC_USDT'
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  strategy: StrategyType;
  minAiConfidence: number; // 50 to 95
  risk: RiskConfig;
}

export interface Position {
  id: string;
  market: string;
  side: PositionSide; // BUY = LONG, SELL = SHORT
  positionDirection: PositionDirection;
  tradingType: 'futures' | 'spot';
  marginCurrency: 'INR' | 'USDT';
  leverage: number;
  marginAmountInr: number;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  notionalValue: number;
  notionalValueInr: number;
  liquidationPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  highestPriceSinceEntry?: number;
  lowestPriceSinceEntry?: number;
  unrealizedPnl: number;
  unrealizedPnlInr: number;
  unrealizedPnlPercent: number;
  openedAt: number;
  strategyUsed: StrategyType;
  entryReason: string;
  breakevenLocked?: boolean;
  initialWinProbability?: number;
  trailingStopLoss?: boolean;
  trailingStopPercent?: number;
  trailingActivationPercent?: number;
  trailingActivated?: boolean;
  trailingStopPrice?: number;
  trailingProfitLockedInr?: number;
  trailingUseSuperTrend?: boolean;
}

export interface Trade {
  id: string;
  positionId: string;
  market: string;
  side: PositionSide;
  positionDirection: PositionDirection;
  tradingType: 'futures' | 'spot';
  marginCurrency: 'INR' | 'USDT';
  leverage: number;
  marginAmountInr: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  notionalValue: number;
  realizedPnl: number;
  realizedPnlInr: number;
  realizedPnlPercent: number;
  fee: number;
  feeInr: number;
  openedAt: number;
  closedAt: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'BREAKEVEN_GUARD' | 'EARLY_PROTECTIVE_CUT' | 'AI_SIGNAL' | 'MANUAL' | 'CIRCUIT_BREAKER' | 'LIQUIDATION';
  strategyUsed: StrategyType;
  winProbabilityAtEntry?: number;
}

export interface ProbabilityFactorBreakdown {
  trendScore: number; // 0 - 100
  momentumScore: number; // 0 - 100
  orderbookScore: number; // 0 - 100
  volatilityScore: number; // 0 - 100
  priceActionScore: number; // 0 - 100
  overallWinProbability: number; // 0 - 100%
  recommendedDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
  lossRiskLevel: 'ULTRA_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
  lossPreventionActive: boolean;
  expectedValue: number;
  riskRewardRatio: string;
  multiTimeframeConsensus: {
    '1m': 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    '5m': 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    '15m': 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  keySignals: string[];
}

export interface MarketScanResult {
  market: string;
  candlePair: string;
  lastPrice: number;
  lastPriceInr: number;
  change24h: number;
  volume24h: number;
  winProbability: number;
  direction: 'LONG' | 'SHORT' | 'WAIT';
  lossRisk: 'ULTRA_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
  confluenceGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  status: 'PRIME_SETUP' | 'WATCH' | 'FILTERED_OUT';
  reason: string;
  expectedReturnPercent: number;
  optimalLeverage: number;
  scannedAt: number;
  superTrendSignal?: 'BULLISH' | 'BEARISH';
  volumeSurgeRatio?: number;
}

export interface PerformanceStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage
  netProfit: number;
  netProfitInr: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  averageTradePnl: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  currentEquity: number;
  currentEquityInr: number;
  startingEquity: number;
  startingEquityInr: number;
  equityHistory: Array<{ timestamp: number; equity: number; equityInr: number }>;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBook {
  timestamp: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPercent: number;
}

export type AiSignal = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface AiAnalysisResult {
  signal: AiSignal;
  recommendedPosition: 'LONG' | 'SHORT' | 'NEUTRAL';
  suggestedLeverage: number;
  confidence: number; // 0 to 100
  winProbability?: number; // Calculated statistical win probability 0-100%
  expectedValue?: number; // Calculated EV ratio
  riskRewardRatio?: string; // e.g. "1:3.2"
  lossPreventionVerdict?: 'LOSS_PROTECTED_SAFE' | 'MARGINAL_RISK' | 'HIGH_LOSS_RISK_AVOID';
  breakevenTriggerPrice?: number; // Price level where breakeven lock activates
  probabilityFactors?: {
    trendScore: number;
    momentumScore: number;
    orderbookScore: number;
    volatilityScore: number;
    priceActionScore: number;
  };
  summary: string;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  thesis: string;
  suggestedEntry: number;
  suggestedEntryInr: number;
  suggestedTakeProfit: number;
  suggestedStopLoss: number;
  estimatedLiquidationPrice: number;
  technicalBreakdown: {
    rsiAssessment: string;
    macdAssessment: string;
    bollingerAssessment: string;
    trendAssessment: string;
    volumeAssessment: string;
    superTrendAssessment?: string;
  };
  invalidationLevel: number;
  timestamp: number;
}

export interface LiveWalletBalances {
  inr: number;
  usdt: number;
  totalInr: number;
  isFunded: boolean;
  minOrderValueUsdt: number;
  minOrderValueInr: number;
  lastUpdated: number;
}

export interface ApiKeyStatus {
  hasApiKey: boolean;
  hasApiSecret: boolean;
  maskedKey: string;
  isLiveAvailable: boolean;
  activeMode: 'paper' | 'live';
  serverIpInfo: string;
  permissions: string[];
  liveBalances?: LiveWalletBalances;
}

