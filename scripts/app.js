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
window.refreshChart = refreshChart;
window.openCurrencyDialog = openCurrencyDialog;
window.closeCurrencyDialog = closeCurrencyDialog;
window.updateCurrencyConversion = updateCurrencyConversion;
window.executeCurrencyConversion = executeCurrencyConversion;
window.getCurrentUsdInrRate = () => hasCurrentUsdInrRate() ? USD_TO_INR : null;
window.refreshUsdInrRate = refreshUsdInrRate;

// ---------- MARKET DATA REFRESH ----------
function renderMarketData(symbol, timeframe) {
  if (state.selected !== symbol || state.currentTimeframe !== timeframe) return;
  updateOHLC(symbol);
  updateTradeTotal();
  drawCandlestickChart(symbol, timeframe);
  renderStockList();
  updateStats();
  renderPositions();
  renderHoldings();
}

function showMarketDataError(symbol, timeframe = state.currentTimeframe) {
  if (state.selected === symbol && state.currentTimeframe === timeframe) {
    const error = getMarketRequestError(symbol, timeframe);
    if (!getCandles(symbol, timeframe).length) {
      setChartStatus(error || 'Yahoo Finance data unavailable. Retrying...');
    }
    showTradeMsg(error ? `Chart data error: ${error}` : `Yahoo Finance data unavailable for ${symbol}. Try again shortly.`, 'error');
  }
}

async function refreshChart() {
  const symbol = state.selected;
  const timeframe = state.currentTimeframe;
  const data = state.stockData[symbol];
  const button = document.getElementById('chartRefreshBtn');
  if (!data || !symbol || !button) return;

  button.disabled = true;
  button.title = 'Refreshing Yahoo Finance data...';

  try {
    const loaded = await refreshMarketData(symbol, timeframe, true);
    if (state.selected !== symbol || state.currentTimeframe !== timeframe) return;
    if (loaded) renderMarketData(symbol, timeframe);
    else showMarketDataError(symbol, timeframe);
  } finally {
    button.disabled = false;
    button.title = 'Clear chart cache and fetch fresh Yahoo Finance data';
  }
}

function startMarketDataPolling() {
  if (state._updateTimer) clearInterval(state._updateTimer);
  refreshUsdInrRate(true);
  state._updateTimer = setInterval(async () => {
    const symbol = state.selected;
    const timeframe = state.currentTimeframe;
    if (!symbol || !state.user) return;
    refreshUsdInrRate(true);
    const loaded = await refreshMarketData(symbol, timeframe);
    if (loaded) renderMarketData(symbol, timeframe);
    else showMarketDataError(symbol, timeframe);
  }, 60000);
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
  startMarketDataPolling();
}

function doLogout() {
  if (state._updateTimer) { clearInterval(state._updateTimer); state._updateTimer = null; }
  state.user = null;
  state.balance = INITIAL_INR_BALANCE;
  state.usdBalance = 0;
  state.initialBalance = INITIAL_INR_BALANCE;
  state.selected = 'AAPL';
  state.tab = 'all';
  state.portfolio = {};
  state.orders = [];
  state.dayPnL = 0;
  state.livePrices = {};
  state.stockData = createAllStockData();
  saveState();
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (mainApp) mainApp.classList.remove('active');
}

// ---------- INIT ----------
function initApp() {
  const unifiedGame = Boolean(document.getElementById('stocksView'));
  // Load saved state
  const loaded = loadState();
  if (!loaded) {
    state.stockData = createAllStockData();
    saveState();
  }
  updateTimeframeButtons(state.currentTimeframe);
  updateCurrencyRateDisplay();
  refreshUsdInrRate(true);

  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) loadingScreen.style.display = 'none';
  if (unifiedGame && !state.user) state.user = 'Founder';

  if (state.user) {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const userPill = document.getElementById('userPill');
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.classList.add('active');
    if (userPill) userPill.textContent = '👤 ' + state.user;
    renderStockList();
    selectStock(state.selected || 'AAPL');
    updateStats();
    // ★ CRITICAL: render bottom panels immediately after app start
    renderPositions();
    renderHoldings();
    renderOrders();
    startMarketDataPolling();
    if (window.syncEmpireStockState) window.syncEmpireStockState();
  } else {
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'flex';
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