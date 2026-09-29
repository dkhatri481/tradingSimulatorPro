// ============================================================
//  APP – Login, Logout, Simulation, Init
// ============================================================

// ---------- GLOBAL EXPOSURE (for inline onclick) ----------
window.setTimeframe = setTimeframe;
window.toggleIndicator = toggleIndicator;
window.executeTrade = executeTrade;
window.setTab = setTab;
window.filterStocks = filterStocks;
window.selectStock = selectStock;
window.updateTradeTotal = updateTradeTotal;
window.setOrderType = setOrderType;
window.openTradeDialog = openTradeDialog;
window.closeTradeDialog = closeTradeDialog;
window.updateDialogFields = updateDialogFields;
window.submitTradeDialog = submitTradeDialog;
window.doLogin = doLogin;
window.doLogout = doLogout;

// ---------- SIMULATION ----------
function startLiveSimulation() {
  if (state._updateTimer) clearInterval(state._updateTimer);
  state._updateTimer = setInterval(() => {
    // Update USD/INR with small random walk
    USD_TO_INR *= (1 + (Math.random() - 0.5) * 0.0002);
    USD_TO_INR = Math.round(USD_TO_INR * 100) / 100;

    Object.keys(state.stockData).forEach(sym => {
      const data = state.stockData[sym];
      if (!data || !data.candlesByTimeframe) return;
      const baseCandles = data.candlesByTimeframe['1d'];
      if (!baseCandles || !baseCandles.length) return;
      const last = baseCandles[baseCandles.length - 1];
      const vol = data.currency === 'INR' ? 0.004 : 0.0025;
      const minMove = data.currency === 'INR' ? 0.05 : 0.01;
      const move = Math.max(last.Close * vol * 0.6, minMove);
      let np = Math.round((last.Close + (Math.random() - 0.5) * move * 2) * 100) / 100;
      if (np <= 0) np = minMove;
      if (np === last.Close) np = Math.round((last.Close + (Math.random() < 0.5 ? -minMove : minMove)) * 100) / 100;
      state.livePrices[sym] = np;
      data.currentPrice = np;

      // Update ALL timeframes
      Object.keys(data.candlesByTimeframe).forEach(tf => {
        const candles = data.candlesByTimeframe[tf];
        if (!candles || !candles.length) return;
        const lastCandle = candles[candles.length - 1];
        lastCandle.Date = new Date().toISOString();
        lastCandle.Close = np;
        if (np > lastCandle.High) lastCandle.High = np;
        if (np < lastCandle.Low) lastCandle.Low = np;
      });

      // Stop-loss check
      const position = state.portfolio[sym];
      if (position && position.qty > 0 && position.stopLoss > 0 &&
          position.stopLoss >= np && position.avg > position.stopLoss) {
        const stopType = 'sell';
        document.getElementById('orderType').value = 'market';
        document.getElementById('limitPrice').value = '';
        document.getElementById('tradeQty').value = position.qty;
        state.selected = sym;
        executeTrade(stopType);
      }

    });

    renderStockList();
    if (state.selected && state.stockData[state.selected]) {
      const d = state.stockData[state.selected];
      if (d.candlesByTimeframe && d.candlesByTimeframe['1d'].length) {
        updateOHLC(state.selected);
        updateTradeTotal();
        drawCandlestickChart(state.selected, state.currentTimeframe);
      }
    }
    updateStats();
    renderPositions();
    renderHoldings();
    renderOrders();
    saveState();
  }, 2800);
}

async function loadSelectedMarketData() {
  if (!state.selected) return;
  const loaded = await refreshMarketData(state.selected, state.currentTimeframe);
  if (loaded) {
    updateOHLC(state.selected);
    updateTradeTotal();
    drawCandlestickChart(state.selected, state.currentTimeframe);
    renderStockList();
  }
}

// ---------- LOGIN / LOGOUT ----------
function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  if (!u) { alert('Enter username'); return; }
  state.user = u;
  saveState();
  document.getElementById('userPill').textContent = '👤 ' + u;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').classList.add('active');
  renderStockList();
  selectStock('AAPL');
  updateStats();
  // ★ CRITICAL: render bottom panels immediately after login
  renderPositions();
  renderHoldings();
  renderOrders();
  startLiveSimulation();
  loadSelectedMarketData();
}

function doLogout() {
  if (state._updateTimer) { clearInterval(state._updateTimer); state._updateTimer = null; }
  state.user = null;
  state.balance = 100000;
  state.selected = 'AAPL';
  state.tab = 'all';
  state.portfolio = {};
  state.orders = [];
  state.dayPnL = 0;
  state.livePrices = {};
  state.stockData = generateAllMockData();
  saveState();
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').classList.remove('active');
}

// ---------- INIT ----------
function initApp() {
  // Load saved state
  const loaded = loadState();
  if (!loaded) {
    // Only generate fresh data if no saved state exists
    state.stockData = generateAllMockData();
    saveState();
  }

  document.getElementById('loadingScreen').style.display = 'none';

  if (state.user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.add('active');
    document.getElementById('userPill').textContent = '👤 ' + state.user;
    renderStockList();
    selectStock(state.selected || 'AAPL');
    updateStats();
    // ★ CRITICAL: render bottom panels immediately after app start
    renderPositions();
    renderHoldings();
    renderOrders();
    startLiveSimulation();
    loadSelectedMarketData();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
  }
}

// ---------- PAGE UNLOAD CLEANUP ----------
window.addEventListener('beforeunload', () => {
  if (state._updateTimer) {
    clearInterval(state._updateTimer);
    state._updateTimer = null;
  }
  saveState();
});

// ---------- RESIZE HANDLER ----------
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.selected) drawCandlestickChart(state.selected, state.currentTimeframe);
  }, 150);
});

// ---------- START ----------
setTimeout(initApp, 120);