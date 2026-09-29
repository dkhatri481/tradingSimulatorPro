// ============================================================
//  CORE – Config, State, Utilities
// ============================================================

// ---------- STOCK UNIVERSE ----------
const STOCK_UNIVERSE = {
  'AAPL': 'Apple Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc.',
  'AMZN': 'Amazon.com Inc.',
  'NVDA': 'NVIDIA Corporation',
  'META': 'Meta Platforms Inc.',
  'TSLA': 'Tesla Inc.',
  'AMD': 'Advanced Micro Devices',
  'NFLX': 'Netflix Inc.',
  'JPM': 'JPMorgan Chase',
  'RELIANCE.NS': 'Reliance Industries',
  'TCS.NS': 'Tata Consultancy Services',
  'INFY.NS': 'Infosys Limited',
  'HDFC.NS': 'HDFC Bank',
  'ICICIBANK.NS': 'ICICI Bank',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'BNB-USD': 'Binance Coin',
  'SOL-USD': 'Solana',
  'XRP-USD': 'Ripple'
};

// ---------- GLOBAL STATE ----------
let state = {
  user: null,
  balance: 100000,
  selected: 'AAPL',
  tab: 'all',
  portfolio: {},           // { sym: { qty, avg, invested, stopLoss? } }
  orders: [],
  dayPnL: 0,
  livePrices: {},
  stockData: {},
  currentTimeframe: '1d',
  showVolume: true,
  showMA: false,
  dialogAction: 'buy',
  _updateTimer: null
};

const STORAGE_KEY = 'tradepro-simulator-v2';
let USD_TO_INR = 83.5;

function toAccountCurrency(amount, currency) {
  return currency === 'INR' ? amount / USD_TO_INR : amount;
}

function fromAccountCurrency(amount, currency) {
  return currency === 'INR' ? amount * USD_TO_INR : amount;
}

function saveState() {
  const compactStockData = {};
  Object.entries(state.stockData).forEach(([sym, data]) => {
    const candlesByTimeframe = {};
    Object.entries(data.candlesByTimeframe || {}).forEach(([tf, candles]) => {
      const limit = CANDLE_LIMITS[tf];
      candlesByTimeframe[tf] = limit ? candles.slice(-limit) : candles;
    });
    compactStockData[sym] = {
      symbol: data.symbol,
      name: data.name,
      currency: data.currency,
      currentPrice: data.currentPrice,
      candles: candlesByTimeframe['1d'] || data.candles || [],
      candlesByTimeframe
    };
  });
  const snapshot = {
    user: state.user,
    balance: state.balance,
    selected: state.selected,
    tab: state.tab,
    portfolio: state.portfolio,
    orders: state.orders,
    dayPnL: state.dayPnL,
    livePrices: state.livePrices,
    stockData: compactStockData,
    currentTimeframe: state.currentTimeframe,
    showVolume: state.showVolume,
    showMA: state.showMA,
    USD_TO_INR: USD_TO_INR
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('⚠️ Failed to save state (quota exceeded?)', e);
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    console.log('ℹ️ No saved state found');
    return false;
  }
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || !saved.stockData) {
      console.warn('⚠️ Saved state is invalid');
      return false;
    }
    // Restore main state
    Object.assign(state, saved);
    // Ensure required fields exist
    state.portfolio = state.portfolio || {};
    state.orders = state.orders || [];
    state.livePrices = state.livePrices || {};
    state.stockData = state.stockData || {};
    if (saved.USD_TO_INR) USD_TO_INR = saved.USD_TO_INR;

    // Ensure all universe symbols exist in stockData
    Object.keys(STOCK_UNIVERSE).forEach(sym => {
      if (!state.stockData[sym] || !Array.isArray(state.stockData[sym].candles)) {
        const generated = generateMockData(sym);
        state.stockData[sym] = generated;
        state.livePrices[sym] = generated.currentPrice;
      } else {
        state.stockData[sym].name = STOCK_UNIVERSE[sym];
        state.stockData[sym].currency = sym.endsWith('.NS') ? 'INR' : 'USD';
        // Ensure all timeframes exist
        const allTfs = ['1m','5m','15m','1h','4h','1d'];
        allTfs.forEach(tf => {
          if (!state.stockData[sym].candlesByTimeframe || !state.stockData[sym].candlesByTimeframe[tf] || state.stockData[sym].candlesByTimeframe[tf].length === 0) {
            if (!state.stockData[sym].candlesByTimeframe) state.stockData[sym].candlesByTimeframe = {};
            const seed = state.stockData[sym].candles && state.stockData[sym].candles.length ? state.stockData[sym].candles[0].Open : state.stockData[sym].currentPrice;
            state.stockData[sym].candlesByTimeframe[tf] = generateCandles(seed, tf, sym.endsWith('-USD'));
          }
          const limit = CANDLE_LIMITS[tf];
          if (limit && state.stockData[sym].candlesByTimeframe[tf].length > limit) {
            state.stockData[sym].candlesByTimeframe[tf] =
              state.stockData[sym].candlesByTimeframe[tf].slice(-limit);
          }
        });
        state.stockData[sym].candles = state.stockData[sym].candlesByTimeframe['1d'];
        // Restore live price
        if (state.livePrices[sym] === undefined || state.livePrices[sym] === null) {
          state.livePrices[sym] = state.stockData[sym].currentPrice;
        }
      }
    });

    // Migrate old portfolio records whose INR average was calculated in USD.
    Object.entries(state.portfolio).forEach(([sym, position]) => {
      if (!position || !Number.isFinite(position.avg) || position.qty <= 0) return;
      if (Number.isFinite(position.avgNative)) {
        position.avg = position.avgNative;
      } else if (state.stockData[sym]?.currency === 'INR') {
        position.avg *= USD_TO_INR;
      }
      position.avgNative = position.avg;
    });

    // Ensure selected symbol exists
    if (!state.stockData[state.selected]) state.selected = 'AAPL';

    console.log('✅ State loaded successfully. Portfolio size:', Object.keys(state.portfolio).length);
    // Debug: log portfolio contents
    console.log('📊 Portfolio:', state.portfolio);

    saveState(); // re-save to ensure consistency
    return true;
  } catch (error) {
    console.warn('⚠️ TradePro saved data could not be loaded', error);
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

// ---------- UTILITY FUNCTIONS ----------
function fmtPrice(p, curr) {
  if (p === undefined || p === null || isNaN(p)) return '—';
  const s = curr === 'INR' ? '₹' : '$';
  return s + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(p) {
  if (p === undefined || p === null || isNaN(p)) return '0.00';
  const abs = Math.abs(p);
  if (abs >= 1e5) return (p / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return (p / 1e3).toFixed(2) + 'K';
  return p.toFixed(2);
}

function fmtVol(v) {
  if (!v) return '0';
  if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}