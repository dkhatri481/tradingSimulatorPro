// ============================================================
//  DATA – Mock Candles & Stock Data
// ============================================================

function generateMockData(symbol) {
  const name = STOCK_UNIVERSE[symbol] || symbol;
  const isINR = symbol.endsWith('.NS');
  const isCrypto = symbol.endsWith('-USD');
  const basePrice = isINR ? 800 + Math.random() * 4200 :
                    isCrypto ? 200 + Math.random() * 3800 :
                    40 + Math.random() * 460;
  const allTfs = ['1m','5m','15m','1h','4h','1d'];
  const candlesByTimeframe = {};
  allTfs.forEach(tf => {
    candlesByTimeframe[tf] = generateCandles(basePrice, tf, isCrypto);
  });
  const currentPrice = candlesByTimeframe['1d'][candlesByTimeframe['1d'].length - 1].Close;
  return {
    symbol,
    name,
    currency: isINR ? 'INR' : isCrypto ? 'USD' : 'USD',
    currentPrice,
    candles: candlesByTimeframe['1d'],
    candlesByTimeframe
  };
}

const TIMEFRAME_MINUTES = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440 };
const CANDLE_LIMITS = { '1m': 240, '5m': 288, '15m': 192, '1h': 168, '4h': 42, '1d': 7 };
const MARKET_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const FETCH_CONFIG = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '1mo' },
  '1h': { interval: '1h', range: '6mo' },
  '4h': { interval: '1h', range: '6mo' },
  '1d': { interval: '1d', range: '2y' }
};
const pendingMarketRequests = {};

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
  return result.timestamp.map((time, i) => ({
    Date: new Date(time * 1000).toISOString(),
    Open: Number(quote.open?.[i]),
    High: Number(quote.high?.[i]),
    Low: Number(quote.low?.[i]),
    Close: Number(quote.close?.[i]),
    Volume: Number(quote.volume?.[i] || 0)
  })).filter(c => [c.Open, c.High, c.Low, c.Close].every(Number.isFinite));
}

async function fetchMarketCandles(symbol, timeframe) {
  const config = FETCH_CONFIG[timeframe];
  if (!config) throw new Error('Unsupported timeframe');
  const response = await fetch(`${MARKET_ENDPOINT}${encodeURIComponent(symbol)}?interval=${config.interval}&range=${config.range}`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
  let candles = parseYahooResponse(symbol, await response.json());
  if (timeframe === '4h') candles = aggregateCandles(candles, 240);
  return candles.slice(-CANDLE_LIMITS[timeframe]);
}

async function refreshMarketData(symbol, timeframe = state.currentTimeframe) {
  const data = state.stockData[symbol];
  if (!data) return false;
  const requestKey = `${symbol}:${timeframe}`;
  if (pendingMarketRequests[requestKey]) return pendingMarketRequests[requestKey];
  pendingMarketRequests[requestKey] = (async () => {
  try {
    const candles = await fetchMarketCandles(symbol, timeframe);
    if (!candles.length) return false;
    data.candlesByTimeframe[timeframe] = candles;
    if (timeframe === '1d') {
      data.candles = candles;
      data.currentPrice = candles[candles.length - 1].Close;
    }
    state.livePrices[symbol] = data.currentPrice || candles[candles.length - 1].Close;
    saveState();
    return true;
  } catch (error) {
    console.warn(`Market data unavailable for ${symbol} (${timeframe}); using cached data`, error);
    return false;
  } finally {
    delete pendingMarketRequests[requestKey];
  }
  })();
  return pendingMarketRequests[requestKey];
}

function generateCandles(basePrice, timeframe, isCrypto) {
  const minutes = TIMEFRAME_MINUTES[timeframe] || 1440;
  const count = CANDLE_LIMITS[timeframe] || Math.floor((7 * 24 * 60) / minutes);
  const candles = [];
  const now = Date.now();
  let previous = basePrice;
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now - i * minutes * 60000);
    const volatility = isCrypto ? 0.012 : 0.006;
    const open = previous;
    const close = Math.max(0.01, open * (1 + (Math.random() - 0.5) * volatility));
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.45);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.45);
    candles.push({
      Date: date.toISOString(),
      Open: Math.round(open * 100) / 100,
      High: Math.round(high * 100) / 100,
      Low: Math.round(low * 100) / 100,
      Close: Math.round(close * 100) / 100,
      Volume: Math.floor(Math.random() * 400000 + 50000)
    });
    previous = close;
  }
  return candles;
}

function getCandles(sym, timeframe) {
  const data = state.stockData[sym];
  if (!data) return [];
  if (!data.candlesByTimeframe) {
    data.candlesByTimeframe = { '1d': data.candles || [] };
  }
  if (!data.candlesByTimeframe[timeframe] || data.candlesByTimeframe[timeframe].length === 0) {
    const seed = data.candles && data.candles.length ? data.candles[0].Open : data.currentPrice;
    data.candlesByTimeframe[timeframe] = generateCandles(seed, timeframe, sym.endsWith('-USD'));
  }
  const maxCandles = CANDLE_LIMITS[timeframe];
  if (maxCandles && data.candlesByTimeframe[timeframe].length > maxCandles) {
    data.candlesByTimeframe[timeframe] = data.candlesByTimeframe[timeframe].slice(-maxCandles);
    if (timeframe === '1d') data.candles = data.candlesByTimeframe['1d'];
  }
  return data.candlesByTimeframe[timeframe];
}

function generateAllMockData() {
  const data = {};
  Object.keys(STOCK_UNIVERSE).forEach(sym => {
    data[sym] = generateMockData(sym);
    state.livePrices[sym] = data[sym].currentPrice;
  });
  return data;
}