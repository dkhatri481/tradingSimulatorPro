// ============================================================
//  TRADING – Buy/Sell, Portfolio, Orders, UI Rendering
// ============================================================

// ---------- TRADE PANEL ----------
function updateTradeTotal() {
  const qty = parseInt(document.getElementById('tradeQty').value) || 0;
  const marketPrice = state.livePrices[state.selected] || 0;
  const orderType = document.getElementById('orderType').value;
  const limitPrice = Number(document.getElementById('limitPrice').value);
  const price = orderType === 'limit' && limitPrice > 0 ? limitPrice : marketPrice;
  const total = qty * price;
  const currency = state.stockData[state.selected]?.currency || 'USD';
  document.getElementById('tradeTotal').textContent = fmtPrice(total, currency);
  renderTradeFunds(total, currency);
  return total;
}

function renderTradeFunds(total = 0, currency = state.stockData[state.selected]?.currency || 'USD') {
  const element = document.getElementById('tradeFunds');
  if (!element) return;
  const walletBalance = currency === 'INR' ? state.balance : state.usdBalance;
  const walletName = currency === 'INR' ? 'INR wallet' : 'USD wallet';
  element.textContent = `${walletName}: ${fmtPrice(walletBalance, currency)}${total > walletBalance ? ` · Short by ${fmtPrice(total - walletBalance, currency)}` : ''}`;
  element.className = 'trade-funds' + (total > walletBalance ? ' insufficient' : '');
}

function setOrderType(type) {
  const limitGroup = document.getElementById('limitPriceGroup');
  const limitInput = document.getElementById('limitPrice');
  const marketPrice = state.livePrices[state.selected] || 0;
  limitGroup.style.display = type === 'limit' ? 'block' : 'none';
  if (type === 'limit' && marketPrice > 0 && (!limitInput.value || Number(limitInput.value) <= 0)) {
    limitInput.value = marketPrice.toFixed(2);
  }
  updateTradeTotal();
}

let tradeMsgTimer;
function showTradeMsg(msg, type) {
  const el = document.getElementById('tradeMsg');
  el.textContent = msg;
  el.className = 'trade-msg ' + type;
  clearTimeout(tradeMsgTimer);
  tradeMsgTimer = setTimeout(() => { el.className = 'trade-msg'; }, 5000);
}

function openCurrencyDialog() {
  document.getElementById('convertInrBalance').textContent = fmtPrice(state.balance, 'INR');
  document.getElementById('convertUsdBalance').textContent = fmtPrice(state.usdBalance, 'USD');
  document.getElementById('convertFrom').value = 'INR';
  document.getElementById('convertTo').value = 'USD';
  document.getElementById('convertAmount').value = '10000';
  updateCurrencyConversion();
  const dialog = document.getElementById('currencyDialog');
  dialog.classList.add('open');
  dialog.setAttribute('aria-hidden', 'false');
  refreshUsdInrRate(true);
}

function closeCurrencyDialog() {
  const dialog = document.getElementById('currencyDialog');
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
}

function updateCurrencyConversion() {
  const from = document.getElementById('convertFrom').value;
  const toSelect = document.getElementById('convertTo');
  if (from === toSelect.value) toSelect.value = from === 'INR' ? 'USD' : 'INR';
  const to = toSelect.value;
  const amount = Number(document.getElementById('convertAmount').value);
  const converted = from === 'INR' ? amount / USD_TO_INR : amount * USD_TO_INR;
  const rateStatus = usdInrRateRefreshing
    ? ' · Fetching current Yahoo Finance rate'
    : hasCurrentUsdInrRate()
      ? ' · Live Yahoo Finance rate'
      : usdInrRateUpdatedAt
        ? ' · Last known rate — refresh failed'
        : usdInrRateError ? ' · Fallback rate' : ' · Waiting for live rate';
  document.getElementById('conversionRate').textContent = `Rate: $1 = ${fmtPrice(USD_TO_INR, 'INR')}${rateStatus} · No conversion fee`;
  document.getElementById('conversionPreview').textContent = hasCurrentUsdInrRate() ? fmtPrice(converted, to) : '—';
  document.getElementById('convertSubmit').disabled = !hasCurrentUsdInrRate();
}

function hasCurrentUsdInrRate() {
  return Boolean(usdInrRateUpdatedAt &&
    Date.now() - usdInrRateUpdatedAt.getTime() < 90000 &&
    !usdInrRateError &&
    !usdInrRateRefreshing);
}

function updateCurrencyRateDisplay() {
  const rateValue = document.querySelector('.fx-stat .value');
  const rateLabel = document.getElementById('fxRateLabel');
  if (!rateValue || !rateLabel) return;
  rateValue.textContent = fmtPrice(USD_TO_INR, 'INR');
  const status = usdInrRateRefreshing
    ? 'USD/INR loading'
    : hasCurrentUsdInrRate()
      ? 'USD/INR live'
      : usdInrRateUpdatedAt
        ? 'USD/INR stale'
        : usdInrRateError ? 'USD/INR fallback' : 'USD/INR loading';
  const updated = usdInrRateUpdatedAt ? ` Last updated ${usdInrRateUpdatedAt.toLocaleTimeString()}.` : '';
  const error = usdInrRateError ? ` Refresh error: ${usdInrRateError}.` : '';
  rateLabel.textContent = status;
  rateLabel.title = `${updated}${error}` || 'Fetching the current USD/INR rate from Yahoo Finance.';
  if (document.getElementById('currencyDialog').classList.contains('open')) {
    updateCurrencyConversion();
  }
}

function executeCurrencyConversion(event) {
  event.preventDefault();
  if (!hasCurrentUsdInrRate()) {
    showTradeMsg('Waiting for a current USD/INR quote. Refreshing the rate; try again when it is ready.', 'error');
    refreshUsdInrRate(true);
    return;
  }
  const from = document.getElementById('convertFrom').value;
  const to = document.getElementById('convertTo').value;
  const amount = Number(document.getElementById('convertAmount').value);
  if (!Number.isFinite(amount) || amount <= 0 || from === to) {
    showTradeMsg('Enter a valid conversion amount and currency pair.', 'error');
    return;
  }
  const sourceBalance = from === 'INR' ? state.balance : state.usdBalance;
  if (amount > sourceBalance) {
    showTradeMsg(`Not enough ${from} in your wallet. Available: ${fmtPrice(sourceBalance, from)}.`, 'error');
    return;
  }
  const received = Number((from === 'INR' ? amount / USD_TO_INR : amount * USD_TO_INR).toFixed(2));
  if (from === 'INR') {
    state.balance -= amount;
    state.usdBalance += received;
  } else {
    state.usdBalance -= amount;
    state.balance += received;
  }
  state.orders.unshift({
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    sym: `${from}/${to}`,
    type: 'CONVERT',
    qty: amount,
    price: USD_TO_INR,
    priceCurrency: 'INR',
    total: received,
    currency: to
  });
  if (state.orders.length > 50) state.orders.pop();
  updateStats();
  updateTradeTotal();
  renderOrders();
  saveState();
  document.getElementById('convertInrBalance').textContent = fmtPrice(state.balance, 'INR');
  document.getElementById('convertUsdBalance').textContent = fmtPrice(state.usdBalance, 'USD');
  showTradeMsg(`Converted ${fmtPrice(amount, from)} to ${fmtPrice(received, to)}.`, 'success');
  closeCurrencyDialog();
}

function openTradeDialog(type, sym) {
  if (sym) selectStock(sym);
  state.dialogAction = type;
  const symbol = state.selected;
  const price = state.livePrices[symbol] || 0;
  document.getElementById('dialogAction').textContent = type === 'buy' ? 'Buy' : 'Sell';
  document.getElementById('dialogSymbol').textContent = symbol;
  document.getElementById('dialogMarketPrice').textContent = fmtPrice(price, state.stockData[symbol]?.currency);
  const posQty = state.portfolio[symbol] ? state.portfolio[symbol].qty : 0;
  document.getElementById('dialogQty').value = type === 'sell' && posQty > 0 ? posQty : 1;
  document.getElementById('dialogOrderType').value = 'market';
  document.getElementById('dialogLimitPrice').value = price > 0 ? price.toFixed(2) : '';
  document.getElementById('dialogStopLoss').value = '';
  document.getElementById('dialogSubmit').className = 'trade-btn ' + type + ' dialog-submit';
  document.getElementById('dialogSubmit').textContent = 'Execute ' + (type === 'buy' ? 'Buy' : 'Sell');
  updateDialogFields();
  const dialog = document.getElementById('tradeDialog');
  dialog.classList.add('open');
  dialog.setAttribute('aria-hidden', 'false');
  document.getElementById('dialogQty').focus();
}

function closeTradeDialog() {
  const dialog = document.getElementById('tradeDialog');
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
}

function updateDialogFields() {
  const type = document.getElementById('dialogOrderType').value;
  document.getElementById('dialogLimitGroup').hidden = type !== 'limit';
  const symbol = state.selected;
  const price = type === 'limit' ? Number(document.getElementById('dialogLimitPrice').value) : state.livePrices[symbol];
  const qty = Number(document.getElementById('dialogQty').value) || 0;
  const currency = state.stockData[symbol]?.currency || 'USD';
  const total = qty * price;
  document.getElementById('dialogTotal').textContent = fmtPrice(total, currency);
  const orderHint = type === 'limit'
    ? (state.dialogAction === 'buy' ? 'Buy limit must be at or above the current market to fill now.' : 'Sell limit must be at or below the current market to fill now.')
    : 'The trade executes at the current market price.';
  const cashHint = state.dialogAction === 'sell'
    ? `Sale proceeds go to your ${currency} wallet.`
    : currency === 'INR'
      ? `Uses your INR wallet (${fmtPrice(state.balance, 'INR')}).`
      : `Uses your USD wallet (${fmtPrice(state.usdBalance, 'USD')}). Convert INR to USD first if needed.`;
  document.getElementById('dialogHint').textContent = `${orderHint} ${cashHint}`;
}

function submitTradeDialog(event) {
  event.preventDefault();
  const type = state.dialogAction;
  const sym = state.selected;
  const qty = Number(document.getElementById('dialogQty').value);
  const marketPrice = state.livePrices[sym];
  const orderType = document.getElementById('dialogOrderType').value;
  const limitPrice = Number(document.getElementById('dialogLimitPrice').value);
  const stopLoss = Number(document.getElementById('dialogStopLoss').value);
  if (!Number.isInteger(qty) || qty <= 0) return showTradeMsg('Enter a whole quantity', 'error');
  if (!marketPrice || marketPrice <= 0) return showTradeMsg('Price not available', 'error');
  if (orderType === 'limit' && (!Number.isFinite(limitPrice) || limitPrice <= 0)) return showTradeMsg('Enter a valid limit price', 'error');
  if (orderType === 'limit' && ((type === 'buy' && limitPrice < marketPrice) || (type === 'sell' && limitPrice > marketPrice))) {
    return showTradeMsg('Limit order is not executable at the current market price', 'error');
  }
  if (Number.isFinite(stopLoss) && stopLoss > 0 && ((type === 'buy' && stopLoss >= (orderType === 'limit' ? limitPrice : marketPrice)) || (type === 'sell' && stopLoss <= (orderType === 'limit' ? limitPrice : marketPrice)))) {
    return showTradeMsg(type === 'buy' ? 'Buy stop-loss must be below entry price' : 'Sell stop-loss must be above entry price', 'error');
  }
  const oldQty = document.getElementById('tradeQty').value;
  const oldOrder = document.getElementById('orderType').value;
  const oldLimit = document.getElementById('limitPrice').value;
  document.getElementById('tradeQty').value = qty;
  document.getElementById('orderType').value = orderType;
  document.getElementById('limitPrice').value = orderType === 'limit' ? limitPrice : '';
  executeTrade(type, { stopLoss });
  document.getElementById('tradeQty').value = oldQty;
  document.getElementById('orderType').value = oldOrder;
  document.getElementById('limitPrice').value = oldLimit;
  closeTradeDialog();
}

function executeTrade(type, options = {}) {
  const qtyInput = document.getElementById('tradeQty');
  const qty = parseInt(qtyInput.value) || 0;
  if (qty <= 0) {
    showTradeMsg('Enter a valid quantity', 'error');
    return;
  }
  const sym = state.selected;
  const marketPrice = state.livePrices[sym];
  if (!marketPrice || marketPrice <= 0) {
    showTradeMsg('Price not available', 'error');
    return;
  }
  const orderType = document.getElementById('orderType').value;
  const limitPrice = Number(document.getElementById('limitPrice').value);
  if (orderType === 'limit') {
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      showTradeMsg('Enter a valid limit price', 'error');
      return;
    }
    const executable = type === 'buy' ? limitPrice >= marketPrice : limitPrice <= marketPrice;
    if (!executable) {
      showTradeMsg(`Limit order not filled. Market is ${fmtCompact(marketPrice)}`, 'error');
      return;
    }
  }
  const price = orderType === 'limit' ? limitPrice : marketPrice;
  const total = qty * price;
  const currency = state.stockData[sym]?.currency || 'USD';
  const walletBalance = currency === 'INR' ? state.balance : state.usdBalance;

  if (type === 'buy') {
    if (total > walletBalance) {
      if (currency === 'INR') {
        showTradeMsg(`Insufficient INR balance. Need ${fmtPrice(total, 'INR')}.`, 'error');
      } else {
        const shortfallInr = (total - walletBalance) * USD_TO_INR;
        showTradeMsg(`Insufficient USD. Convert at least ${fmtPrice(shortfallInr, 'INR')} to your USD wallet first.`, 'error');
      }
      return;
    }
    if (currency === 'INR') state.balance -= total;
    else state.usdBalance -= total;
    if (!state.portfolio[sym]) state.portfolio[sym] = { qty: 0, avg: 0, invested: 0 };
    const p = state.portfolio[sym];
    const previousQty = p.qty;
    p.qty += qty;
    p.invested += total;
    p.avg = ((p.avg * previousQty) + (price * qty)) / p.qty;
    p.avgNative = p.avg;
    if (options.stopLoss > 0) p.stopLoss = options.stopLoss;
    showTradeMsg(`✅ Bought ${qty} ${sym} @ ${fmtCompact(price)}`, 'success');
  } else {
    if (!state.portfolio[sym] || state.portfolio[sym].qty < qty) {
      showTradeMsg(`❌ Not enough shares. You have ${state.portfolio[sym]?.qty || 0} ${sym}`, 'error');
      return;
    }
    const p = state.portfolio[sym];
    const sellVal = qty * price;
    const cost = qty * p.avg;
    const pl = toAccountCurrency(sellVal - cost, currency);
    state.dayPnL += pl;
    if (currency === 'INR') state.balance += sellVal;
    else state.usdBalance += sellVal;
    p.qty -= qty;
    p.invested = p.qty * p.avg;
    p.avgNative = p.avg;
    if (options.stopLoss > 0) p.stopLoss = options.stopLoss;
    if (p.qty === 0) delete state.portfolio[sym];
    const sign = pl >= 0 ? '+' : '';
    showTradeMsg(`✅ Sold ${qty} ${sym} @ ${fmtCompact(price)}  |  P&L: ${sign}${fmtCompact(pl)}`, pl >= 0 ? 'success' : 'error');
  }

  state.orders.unshift({
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    sym,
    type: type.toUpperCase(),
    qty,
    price,
    total,
    currency
  });
  if (state.orders.length > 50) state.orders.pop();

  // Keep the quantity user entered – DO NOT reset to 1
  // Only reset limit price to market if limit order
  if (orderType === 'limit') document.getElementById('limitPrice').value = marketPrice.toFixed(2);
  updateTradeTotal();
  updateStats();
  renderPositions();
  renderHoldings();
  renderOrders();
  saveState();
}

// ---------- SIDEBAR & FILTERS ----------
function getChange(sym) {
  const c = getCandles(sym, '1d');
  if (c.length < 2) return null;
  const prev = c[c.length - 2].Close;
  const curr = c[c.length - 1].Close;
  return ((curr - prev) / prev) * 100;
}

function renderStockList() {
  const el = document.getElementById('stockList');
  el.innerHTML = '';
  const q = (document.getElementById('stockSearch').value || '').trim().toLowerCase();
  let list = Object.keys(state.stockData).map(sym => ({
    sym,
    name: state.stockData[sym].name,
    currency: state.stockData[sym].currency,
    price: state.livePrices[sym] ?? null,
    change: getChange(sym)
  }));
  if (state.tab === 'india') list = list.filter(s => s.sym.endsWith('.NS'));
  else if (state.tab === 'us') list = list.filter(s => !s.sym.endsWith('.NS') && !s.sym.endsWith('-USD') && !s.sym.endsWith('=X'));
  else if (state.tab === 'crypto') list = list.filter(s => s.sym.endsWith('-USD'));
  else if (state.tab === 'forex') list = list.filter(s => s.sym.endsWith('=X'));
  if (q) {
    list = list.filter(s =>
      s.sym.toLowerCase().includes(q) ||
      String(s.name || '').toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0));

  list.forEach(s => {
    const div = document.createElement('div');
    div.className = 'stock-item' + (s.sym === state.selected ? ' active' : '');
    div.onclick = () => selectStock(s.sym);
    const chClass = s.change === null ? '' : s.change >= 0 ? 'up' : 'down',
          chSign = s.change !== null && s.change >= 0 ? '+' : '';
    div.innerHTML = `
      <div class="stock-info">
        <span class="stock-symbol">${s.sym}</span>
        <span class="stock-name">${s.name}</span>
      </div>
      <div class="stock-actions">
        <button class="quick-trade quick-buy" onclick="event.stopPropagation(); openTradeDialog('buy', '${s.sym}')">B</button>
        <button class="quick-trade quick-sell" onclick="event.stopPropagation(); openTradeDialog('sell', '${s.sym}')">S</button>
      </div>
      <div class="stock-price">
        <span class="stock-price-val">${fmtPrice(s.price, s.currency)}</span>
        <span class="stock-change ${chClass}">${s.change === null ? '—' : `${chSign}${s.change.toFixed(2)}%`}</span>
      </div>
    `;
    el.appendChild(div);
  });
}

function selectStock(sym) {
  state.selected = sym;
  renderStockList();
  const info = state.stockData[sym];
  if (!info) return;
  document.getElementById('chartSymbol').textContent = sym;
  document.getElementById('chartName').textContent = info.name;
  updateOHLC(sym);
  updateTradeTotal();
  drawCandlestickChart(sym, state.currentTimeframe);
  const timeframe = state.currentTimeframe;
  refreshMarketData(sym, timeframe).then(loaded => {
    if (loaded && state.selected === sym && state.currentTimeframe === timeframe) {
      renderMarketData(sym, timeframe);
    } else if (!loaded && state.selected === sym && state.currentTimeframe === timeframe) {
      showMarketDataError(sym, timeframe);
    }
  });
}

function filterStocks() { renderStockList(); }

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderStockList();
}

// ---------- STATS & BOTTOM PANELS ----------
function updateStats() {
  let portVal = 0;
  Object.entries(state.portfolio).forEach(([sym, p]) => {
    if (p.qty > 0 && state.livePrices[sym]) {
        const currency = state.stockData[sym]?.currency || 'USD';
        const cv = toAccountCurrency(p.qty * state.livePrices[sym], currency);
        portVal += cv;
    }
  });
  document.getElementById('statBalance').textContent = fmtPrice(state.balance, 'INR');
  document.getElementById('statUsdBalance').textContent = fmtPrice(state.usdBalance, 'USD');
  document.getElementById('statPortfolio').textContent = fmtPrice(portVal, 'INR');
  const plTotal = state.balance + toAccountCurrency(state.usdBalance, 'USD') + portVal - state.initialBalance;
  const plEl = document.getElementById('statPnL');
  plEl.textContent = (plTotal >= 0 ? '+' : '') + fmtPrice(plTotal, 'INR');
  plEl.className = 'value ' + (plTotal >= 0 ? 'green' : 'red');
  const dayEl = document.getElementById('statDayPnL');
  dayEl.textContent = (state.dayPnL >= 0 ? '+' : '') + fmtPrice(state.dayPnL, 'INR');
  dayEl.className = 'value ' + (state.dayPnL >= 0 ? 'green' : 'red');
  updateCurrencyRateDisplay();
  renderTradeFunds();
}

function renderPositions() {
  const tb = document.getElementById('posTable');
  tb.innerHTML = '';
  let c = 0;
  Object.entries(state.portfolio).forEach(([sym, p]) => {
    if (!p.qty) return;
    c++;
    const ltp = state.livePrices[sym] || 0;
    const currency = state.stockData[sym]?.currency || 'USD';
    const pl = (ltp - p.avg) * p.qty;
    const cls = pl >= 0 ? 'green' : 'red';
    const sg = pl >= 0 ? '+' : '';
    tb.innerHTML += `<tr>
      <td><strong>${sym}</strong></td>
      <td class="text-right">${p.qty}</td>
      <td class="text-right">${fmtPrice(p.avg, currency)}</td>
      <td class="text-right">${fmtPrice(ltp, currency)}</td>
      <td class="text-right ${cls}">${sg}${fmtPrice(pl, currency)}</td>
    </tr>`;
  });
  if (!c) tb.innerHTML = '<tr><td colspan="5" class="empty-state">No positions</td></tr>';
  document.getElementById('posCount').textContent = '(' + c + ')';
}

function renderHoldings() {
  const tb = document.getElementById('holdTable');
  tb.innerHTML = '';
  let c = 0;
  Object.entries(state.portfolio).forEach(([sym, p]) => {
    if (!p.qty) return;
    c++;
    const currency = state.stockData[sym]?.currency || 'USD';
    const avgPrice = p.avg;
    const investedNative = p.qty * avgPrice;
    const cv = p.qty * (state.livePrices[sym] || 0);
    const pl = cv - investedNative;
    const cls = pl >= 0 ? 'green' : 'red';
    const sg = pl >= 0 ? '+' : '';
    tb.innerHTML += `<tr>
      <td><strong>${sym}</strong></td>
      <td class="text-right">${p.qty}</td>
      <td class="text-right">${fmtPrice(avgPrice, currency)}</td>
      <td class="text-right">${fmtPrice(investedNative, currency)}</td>
      <td class="text-right">${fmtPrice(cv, currency)}</td>
      <td class="text-right ${cls}">${sg}${fmtPrice(pl, currency)}</td>
    </tr>`;
  });
  if (!c) tb.innerHTML = '<tr><td colspan="6" class="empty-state">No holdings</td></tr>';
  document.getElementById('holdCount').textContent = '(' + c + ')';
}

function renderOrders() {
  const tb = document.getElementById('orderTable');
  tb.innerHTML = '';
  if (!state.orders.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state">No orders</td></tr>';
    return;
  }
  state.orders.forEach(o => {
    const currency = o.currency || state.stockData[o.sym]?.currency || 'USD';
    tb.innerHTML += `<tr>
      <td style="color:var(--text3);font-size:10px;">${o.time}</td>
      <td><strong>${o.sym}</strong></td>
      <td><span class="badge ${o.type.toLowerCase()}">${o.type}</span></td>
      <td class="text-right">${o.qty}</td>
      <td class="text-right">${fmtPrice(o.price, o.priceCurrency || currency)}</td>
      <td class="text-right">${fmtPrice(o.total, currency)}</td>
    </tr>`;
  });
}