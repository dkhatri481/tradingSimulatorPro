// ============================================================
//  DATA – Yahoo Finance Market Data
// ============================================================

function sanitizeCandles(candles) {
  return candles.filter(candle =>
    [candle.Open, candle.High, candle.Low, candle.Close].every(price => Number.isFinite(price) && price > 0) &&
    candle.High >= Math.max(candle.Open, candle.Close) &&
    candle.Low <= Math.min(candle.Open, candle.Close) &&
    candle.High >= candle.Low);
}

const CANDLE_LIMITS = { '5m': 288, '15m': 192, '1h': 168, '4h': 42, '1d': 7 };

const MARKET_ENDPOINT = '/api/market';
const FETCH_CONFIG = {
  '5m': { interval: '5m', days: 3 },
  '15m': { interval: '15m', days: 3 },
  '1h': { interval: '1h', days: 5 },
  '4h': { interval: '1h', days: 5 },
  '1d': { interval: '1d', days: 7 }
};
const pendingMarketRequests = {};
const marketRequestVersions = {};
const marketRequestErrors = {};

function aggregateCandles(candles, minutes) {
  const intervalMs = minutes * 60000;
  const groups = new Map();
  candles.forEach(candle => {
    const bucket = Math.floor(new Date(candle.Date).getTime() / intervalMs) * intervalMs;
    const existing = groups.get(bucket);
    if (!existing) {
      groups.set(bucket, { Date: new Date(bucket).toISOString(), Open: candle.Open, High: candle.High,
        Low: candle.Low, Close: candle.Close, Volume: candle.Volume });
    } else {
      existing.High = Math.max(existing.High, candle.High);
      existing.Low = Math.min(existing.Low, candle.Low);
      existing.Close = candle.Close;
      existing.Volume += candle.Volume;
    }
  });
  return [...groups.values()].sort((a, b) => new Date(a.Date) - new Date(b.Date));
}

function parseYahooResponse(symbol, payload) {
  const result = payload?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error('Market data returned no candles');
  const quote = result.indicators?.quote?.[0] || {};
  const candles = sanitizeCandles(result.timestamp.map((time, i) => ({
    Date: new Date(time * 1000).toISOString(),
    Open: Number(quote.open?.[i]),
    High: Number(quote.high?.[i]),
    Low: Number(quote.low?.[i]),
    Close: Number(quote.close?.[i]),
    Volume: Number(quote.volume?.[i] || 0)
  })));
  if (!candles.length) throw new Error(`Yahoo Finance returned no valid candles for ${symbol}`);
  return { candles, meta: result.meta || {} };
}

async function fetchMarketCandles(symbol, timeframe, forceRefresh = false) {
  const config = FETCH_CONFIG[timeframe];
  if (!config) throw new Error('Unsupported timeframe');
  const params = new URLSearchParams({
    symbol,
    interval: config.interval,
    days: String(config.days)
  });
  if (forceRefresh) params.set('refresh', '1');
  const response = await fetch(`${MARKET_ENDPOINT}?${params}`, {
    headers: { Accept: 'application/json' },
    cache: forceRefresh ? 'no-store' : 'default'
  });
  if (!response.ok) {
    let message = `Market data request failed (${response.status})`;
    try {
      const error = await response.json();
      if (error.error) message = error.upstreamStatus
        ? `${error.error} (${error.upstreamStatus})`
        : error.error;
    } catch (parseError) {
      console.warn('Could not read market data error response', parseError);
    }
    throw new Error(message);
  }
  const { candles: rawCandles, meta } = parseYahooResponse(symbol, await response.json());
  const candles = timeframe === '4h' ? aggregateCandles(rawCandles, 240) : rawCandles;
  return { candles: candles.slice(-CANDLE_LIMITS[timeframe]), meta };
}

async function refreshMarketData(symbol, timeframe = state.currentTimeframe, forceRefresh = false) {
  const data = state.stockData[symbol];
  if (!data) return false;
  const requestKey = `${symbol}:${timeframe}`;
  if (pendingMarketRequests[requestKey] && !forceRefresh) return pendingMarketRequests[requestKey];
  const requestVersion = (marketRequestVersions[requestKey] || 0) + 1;
  marketRequestVersions[requestKey] = requestVersion;
  const request = (async () => {
  try {
    const { candles, meta } = await fetchMarketCandles(symbol, timeframe, forceRefresh);
    if (marketRequestVersions[requestKey] !== requestVersion) return false;
    if (!candles.length) return false;
    data.candlesByTimeframe[timeframe] = candles;
    delete marketRequestErrors[requestKey];
    const marketPrice = Number(meta.regularMarketPrice);
    state.livePrices[symbol] = Number.isFinite(marketPrice) && marketPrice > 0
      ? marketPrice
      : candles[candles.length - 1].Close;
    data.currentPrice = state.livePrices[symbol];
    if (timeframe === '1d') data.candles = candles;
    saveState();
    return true;
  } catch (error) {
    if (marketRequestVersions[requestKey] !== requestVersion) return false;
    marketRequestErrors[requestKey] = error.message || 'Unknown market data error';
    console.warn(`Yahoo Finance request failed for ${symbol} (${timeframe})`, error);
    return false;
  } finally {
    if (pendingMarketRequests[requestKey] === request) delete pendingMarketRequests[requestKey];
  }
  })();
  pendingMarketRequests[requestKey] = request;
  return request;
}

function getMarketRequestError(symbol, timeframe) {
  return marketRequestErrors[`${symbol}:${timeframe}`] || '';
}

function createStockData(symbol) {
  const isINR = symbol.endsWith('.NS');
  return {
    symbol,
    name: STOCK_UNIVERSE[symbol] || symbol,
    currency: isINR ? 'INR' : 'USD',
    currentPrice: null,
    candles: [],
    candlesByTimeframe: {}
  };
}

function getCandles(sym, timeframe) {
  const data = state.stockData[sym];
  if (!data) return [];
  if (!data.candlesByTimeframe) {
    data.candlesByTimeframe = { '1d': data.candles || [] };
  }
  return data.candlesByTimeframe[timeframe] || [];
}

function createAllStockData() {
  return Object.fromEntries(Object.keys(STOCK_UNIVERSE).map(symbol => [symbol, createStockData(symbol)]));
}