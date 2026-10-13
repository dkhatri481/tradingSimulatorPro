(function () {
const SAVE_KEY = 'tradepro-empire-v1';
const STARTING_CASH = 250000;
const WINNING_NET_WORTH = 100000000;

const CITY_UNLOCKS = [
  { name: 'Mumbai', threshold: 0, description: 'Your home market' },
  { name: 'Delhi', threshold: 1000000, description: 'Unlock at ₹10 L net worth' },
  { name: 'Dubai', threshold: 5000000, description: 'Unlock at ₹50 L net worth' },
  { name: 'London', threshold: 20000000, description: 'Unlock at ₹2 Cr net worth' }
];

const ASSETS = [
  { id: 'tea-stall', name: 'Neighbourhood Tea Stall', category: 'Small business', city: 'Mumbai', basePrice: 45000, dailyIncome: 900, volatility: 0.045, description: 'A beloved corner stall with a steady morning crowd.' },
  { id: 'food-truck', name: 'Street Food Truck', category: 'Small business', city: 'Mumbai', basePrice: 85000, dailyIncome: 1650, volatility: 0.065, description: 'Follow the crowds; earn more near the weekend rush.' },
  { id: 'boutique-cafe', name: 'Boutique Café', category: 'Hospitality', city: 'Mumbai', basePrice: 225000, dailyIncome: 4200, volatility: 0.055, description: 'Premium coffee, loyal regulars, and room to grow.' },
  { id: 'studio-gallery', name: 'Indie Art Gallery', category: 'Art & culture', city: 'Mumbai', basePrice: 720000, dailyIncome: 9200, volatility: 0.08, description: 'Discover rising artists and curate your own gallery.' },
  { id: 'delhi-office', name: 'Connaught Place Office', category: 'Commercial real estate', city: 'Delhi', basePrice: 1100000, dailyIncome: 17500, volatility: 0.045, description: 'Prime offices, reliable leases, and a growing city.' },
  { id: 'delhi-motors', name: 'Classic Car Showroom', category: 'Luxury motors', city: 'Delhi', basePrice: 2500000, dailyIncome: 13500, volatility: 0.09, description: 'Trade collectible cars as demand shifts.' },
  { id: 'dubai-tower', name: 'Dubai Marina Offices', category: 'Commercial real estate', city: 'Dubai', basePrice: 6500000, dailyIncome: 82000, volatility: 0.065, description: 'A landmark property with international tenants.' },
  { id: 'dubai-supercar', name: 'Limited-edition Supercar', category: 'Luxury motors', city: 'Dubai', basePrice: 12000000, dailyIncome: 0, volatility: 0.11, description: 'A rare collector car. Prestige today; potential upside tomorrow.' },
  { id: 'london-gallery', name: 'Mayfair Art Gallery', category: 'Art & culture', city: 'London', basePrice: 24000000, dailyIncome: 185000, volatility: 0.075, description: 'An iconic address for collectors and international artists.' },
  { id: 'london-estate', name: 'West End Business District', category: 'Commercial real estate', city: 'London', basePrice: 65000000, dailyIncome: 620000, volatility: 0.055, description: 'A world-class portfolio of premium commercial leases.' }
];

const MARKET_EVENTS = [
  { id: 'business', text: 'Local business is booming; neighbourhood demand lifts small-business prices.', matches: ['Small business'], multiplier: 1.075 },
  { id: 'hospitality', text: 'A wave of visitors gives hospitality businesses a timely boost.', matches: ['Hospitality'], multiplier: 1.09 },
  { id: 'art', text: 'Collectors are back in the market; galleries attract new interest.', matches: ['Art & culture'], multiplier: 1.11 },
  { id: 'property', text: 'Investors favour reliable leases; commercial property is in demand.', matches: ['Commercial real estate'], multiplier: 1.065 },
  { id: 'motors', text: 'A luxury auction draws attention to the collector-car market.', matches: ['Luxury motors'], multiplier: 1.12 },
  { id: 'quiet', text: 'Trading is quiet today. Keep an eye out for tomorrow\'s opportunities.', matches: [], multiplier: 1 }
];

function makeNewGame() {
  return {
    playerName: '',
    day: 1,
    cash: STARTING_CASH,
    prices: Object.fromEntries(ASSETS.map(asset => [asset.id, asset.basePrice])),
    holdings: {},
    log: [
      { day: 1, text: `A new beginning in Mumbai. ₹${formatNumber(STARTING_CASH)} is yours to invest.` },
      { day: 1, text: 'Browse the open market and make your first deal.' }
    ],
    view: 'empire',
    unlockedCities: ['Mumbai'],
    lastNegotiationDay: 0
  };
}

function formatNumber(value) {
  return Math.round(value).toLocaleString('en-IN');
}

function formatMoney(value) {
  return `₹${formatNumber(value)}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return makeNewGame();

  const saved = JSON.parse(raw);
  const valid = saved && typeof saved === 'object' &&
    Number.isInteger(saved.day) && saved.day > 0 &&
    Number.isFinite(saved.cash) && saved.cash >= 0 &&
    saved.prices && typeof saved.prices === 'object' &&
    saved.holdings && typeof saved.holdings === 'object' &&
    Array.isArray(saved.log) && Array.isArray(saved.unlockedCities);
  if (!valid) throw new Error('Your saved empire data is invalid. Start a new empire to continue.');

  const game = { ...makeNewGame(), ...saved };
  for (const asset of ASSETS) {
    if (!Number.isFinite(game.prices[asset.id]) || game.prices[asset.id] <= 0) {
      throw new Error(`Your saved market price for ${asset.name} is invalid.`);
    }
    const quantity = game.holdings[asset.id] || 0;
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Your saved quantity for ${asset.name} is invalid.`);
    }
  }
  return game;
}

let game;
let messageTimer;
const marketList = document.getElementById('marketList');
const holdingsList = document.getElementById('holdingsList');
const journalList = document.getElementById('journalList');
const citiesList = document.getElementById('citiesList');
const messageElement = document.getElementById('gameMessage');

function getNetWorth() {
  const businessValue = ASSETS.reduce((total, asset) =>
    total + (game.holdings[asset.id] || 0) * game.prices[asset.id], 0);
  if (typeof state === 'undefined') return game.cash + businessValue;

  const stockValue = state.balance +
    toAccountCurrency(state.usdBalance || 0, 'USD') +
    Object.entries(state.portfolio || {}).reduce((total, [symbol, position]) => {
      const currency = state.stockData[symbol]?.currency || 'USD';
      const price = state.livePrices[symbol] || position.avg || 0;
      return total + toAccountCurrency(position.qty * price, currency);
    }, 0);
  return game.cash + businessValue + stockValue;
}

function getDailyIncome() {
  return ASSETS.reduce((total, asset) =>
    total + (game.holdings[asset.id] || 0) * asset.dailyIncome, 0);
}

function appendLog(text) {
  game.log.unshift({ day: game.day, text });
  game.log = game.log.slice(0, 12);
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  } catch (error) {
    console.error('Could not save the text empire game.', error);
    showMessage('Your game could not be saved in this browser. Check available storage and try again.', 'error');
  }
}

function showMessage(text, type = '') {
  clearTimeout(messageTimer);
  messageElement.textContent = text;
  messageElement.className = `game-message${type ? ` ${type}` : ''}`;
  messageTimer = setTimeout(() => {
    messageElement.textContent = '';
    messageElement.className = 'game-message';
  }, 6000);
}

const TRANSFER_WALLETS = {
  'empire-inr': { label: 'Empire cash', currency: 'INR' },
  'stock-inr': { label: 'Stock wallet', currency: 'INR' },
  'stock-usd': { label: 'Stock wallet', currency: 'USD' }
};

function getTransferWalletBalance(wallet) {
  if (wallet === 'empire-inr') return game.cash;
  if (wallet === 'stock-inr') return state.balance;
  return state.usdBalance;
}

function openFundsTransfer() {
  const select = document.getElementById('transferFrom');
  select.value = 'empire-inr';
  document.getElementById('transferTo').value = 'stock-inr';
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferError').textContent = '';
  updateFundsTransfer();
  const dialog = document.getElementById('transferDialog');
  dialog.classList.add('open');
  dialog.setAttribute('aria-hidden', 'false');
  if (!window.getCurrentUsdInrRate()) window.refreshUsdInrRate(true);
}

function closeFundsTransfer() {
  const dialog = document.getElementById('transferDialog');
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
}

function updateFundsTransfer() {
  const fromSelect = document.getElementById('transferFrom');
  const toSelect = document.getElementById('transferTo');
  const fromKey = fromSelect.value;
  if (fromKey === toSelect.value) {
    toSelect.value = Object.keys(TRANSFER_WALLETS).find(wallet => wallet !== fromKey);
  }
  const toKey = toSelect.value;
  const fromWallet = TRANSFER_WALLETS[fromKey];
  const toWallet = TRANSFER_WALLETS[toKey];
  const rawAmount = Number(document.getElementById('transferAmount').value);
  const amount = Number.isFinite(rawAmount) ? Math.round(rawAmount * 100) / 100 : rawAmount;
  const rate = fromWallet.currency === toWallet.currency ? 1 : window.getCurrentUsdInrRate();
  const received = rate
    ? Number((fromWallet.currency === 'INR' ? amount / rate : amount * rate).toFixed(2))
    : 0;
  const sourceBalance = getTransferWalletBalance(fromKey);
  const validAmount = Number.isFinite(amount) && amount > 0 && amount <= sourceBalance;
  const quote = document.getElementById('transferQuote');

  document.getElementById('transferEmpireBalance').textContent = fmtPrice(game.cash, 'INR');
  document.getElementById('transferStockInrBalance').textContent = fmtPrice(state.balance, 'INR');
  document.getElementById('transferStockUsdBalance').textContent = fmtPrice(state.usdBalance, 'USD');
  document.getElementById('transferPreview').textContent = rate && validAmount
    ? fmtPrice(received, toWallet.currency)
    : '—';

  if (!rate) {
    quote.textContent = 'Waiting for a fresh Yahoo Finance USD/INR quote; USD transfers are disabled until it arrives.';
  } else if (fromWallet.currency !== toWallet.currency) {
    quote.textContent = `Live rate: $1 = ${fmtPrice(rate, 'INR')} · No conversion fee`;
  } else {
    quote.textContent = 'Same-currency transfer · No transfer fee';
  }

  const error = document.getElementById('transferError');
  error.textContent = Number.isFinite(amount) && amount > sourceBalance
    ? `Insufficient funds. Available: ${fmtPrice(sourceBalance, fromWallet.currency)}.`
    : '';
  document.getElementById('transferSubmit').disabled =
    !validAmount || !rate || received <= 0 || (fromKey === 'stock-inr' && amount > state.balance);
}

function executeFundsTransfer(event) {
  event.preventDefault();
  const fromKey = document.getElementById('transferFrom').value;
  const toKey = document.getElementById('transferTo').value;
  const fromWallet = TRANSFER_WALLETS[fromKey];
  const toWallet = TRANSFER_WALLETS[toKey];
  const rawAmount = Number(document.getElementById('transferAmount').value);
  const amount = Number.isFinite(rawAmount) ? Math.round(rawAmount * 100) / 100 : rawAmount;
  const sourceBalance = getTransferWalletBalance(fromKey);
  const rate = fromWallet.currency === toWallet.currency ? 1 : window.getCurrentUsdInrRate();
  if (!Number.isFinite(amount) || amount <= 0 || !rate || fromKey === toKey) {
    document.getElementById('transferError').textContent = rate
      ? 'Enter a valid transfer amount and choose two different wallets.'
      : 'A fresh USD/INR rate is required for this transfer. The quote is being refreshed.';
    if (!rate) window.refreshUsdInrRate(true);
    updateFundsTransfer();
    return;
  }
  if (amount > sourceBalance) {
    updateFundsTransfer();
    return;
  }

  const received = Number((fromWallet.currency === 'INR' ? amount / rate : amount * rate).toFixed(2));
  if (fromKey === 'empire-inr') game.cash -= amount;
  else if (fromKey === 'stock-inr') state.balance -= amount;
  else state.usdBalance -= amount;

  if (toKey === 'empire-inr') game.cash += received;
  else if (toKey === 'stock-inr') state.balance += received;
  else state.usdBalance += received;

  const fromName = fromWallet.label;
  const toName = toWallet.label;
  const crossCurrency = fromWallet.currency !== toWallet.currency;
  state.orders.unshift({
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    sym: `${fromName} → ${toName}`,
    type: 'TRANSFER',
    qty: amount,
    quantityCurrency: fromWallet.currency,
    price: rate,
    priceCurrency: crossCurrency ? 'INR' : fromWallet.currency,
    total: received,
    currency: toWallet.currency
  });
  if (state.orders.length > 50) state.orders.pop();

  const transferDescription = `Transferred ${fmtPrice(amount, fromWallet.currency)} from ${fromName} to ${toName}${crossCurrency ? ` at $1 = ${fmtPrice(rate, 'INR')}` : ''}.`;
  appendLog(transferDescription);
  updateStats();
  renderOrders();
  saveState();
  saveGame();
  render();
  closeFundsTransfer();
  showMessage(`${transferDescription} Received ${fmtPrice(received, toWallet.currency)}.`, 'success');
}

function renderHeader() {
  document.getElementById('dayCounter').innerHTML =
    `DAY ${game.day} <span>·</span> MUMBAI${game.unlockedCities.length > 1 ? ` + ${game.unlockedCities.length - 1} CITIES` : ''}`;
  document.querySelector('.intro .eyebrow').textContent =
    game.view === 'stocks'
      ? 'YOUR MARKET DESK'
      : game.playerName ? `WELCOME, ${game.playerName.toUpperCase()}` : 'YOUR STORY STARTS HERE';
}

function renderStats() {
  const netWorth = getNetWorth();
  const goalProgress = Math.min(100, netWorth / WINNING_NET_WORTH * 100);
  document.getElementById('cashValue').textContent = formatMoney(game.cash);
  document.getElementById('netWorthValue').textContent = formatMoney(netWorth);
  document.getElementById('goalProgressLabel').textContent = goalProgress >= 100
    ? 'Empire goal achieved!'
    : `Goal ${formatMoney(WINNING_NET_WORTH)} · ${goalProgress.toFixed(1)}%`;
  document.getElementById('goalProgress').style.width = `${goalProgress}%`;
  document.querySelector('.goal-track').setAttribute('aria-valuenow', goalProgress.toFixed(1));
  document.getElementById('incomeValue').textContent = formatMoney(getDailyIncome());
  document.getElementById('assetCountValue').textContent = formatNumber(
    Object.values(game.holdings).reduce((total, quantity) => total + quantity, 0)
  );
  document.getElementById('cityCountValue').textContent =
    `${game.unlockedCities.length} ${game.unlockedCities.length === 1 ? 'city' : 'cities'} unlocked`;
}

function renderMarket() {
  marketList.innerHTML = ASSETS.map(asset => {
    const price = game.prices[asset.id];
    const isUnlocked = game.unlockedCities.includes(asset.city);
    const quantity = game.holdings[asset.id] || 0;
    const canAfford = game.cash >= price;
    return `
      <article class="asset-row${isUnlocked ? '' : ' locked-row'}">
        <div class="asset-main">
          <span class="asset-icon" aria-hidden="true">${asset.category === 'Luxury motors' ? '↗' : asset.category === 'Art & culture' ? '✳' : asset.category === 'Commercial real estate' ? '▥' : '✦'}</span>
          <div class="asset-copy"><div class="asset-name">${escapeHTML(asset.name)}${quantity ? `<span class="owned-tag">OWN ${quantity}</span>` : ''}</div><div class="asset-description">${escapeHTML(asset.description)}</div><div class="asset-meta">${escapeHTML(asset.category)} <span>·</span> ${escapeHTML(asset.city)} <span>·</span> ${asset.dailyIncome ? `${formatMoney(asset.dailyIncome)}/day` : 'Collector asset'}</div></div>
        </div>
        <div class="asset-deal">
          <strong>${formatMoney(price)}</strong>
          ${isUnlocked
            ? `<div class="deal-actions"><button type="button" class="negotiate-button" data-negotiate="${asset.id}" ${game.lastNegotiationDay === game.day ? 'disabled' : ''}>Negotiate</button><button type="button" class="buy-button" data-buy="${asset.id}" ${canAfford ? '' : 'disabled'}>${canAfford ? 'Buy' : 'Need more cash'}</button></div>`
            : `<span class="locked-note">Unlock ${escapeHTML(asset.city)} · ${formatMoney(CITY_UNLOCKS.find(city => city.name === asset.city).threshold)}</span>`}
        </div>
      </article>`;
  }).join('');
}

function renderHoldings() {
  const owned = ASSETS.filter(asset => (game.holdings[asset.id] || 0) > 0);
  document.getElementById('holdingsSummary').textContent =
    owned.length ? `${owned.length} ${owned.length === 1 ? 'investment' : 'investments'}` : 'No assets yet';
  if (!owned.length) {
    holdingsList.innerHTML = '<div class="empty-state"><span>◈</span><strong>Your story is just getting started.</strong><p>Pick a business from the open market to make your first investment.</p></div>';
    return;
  }
  holdingsList.innerHTML = owned.map(asset => {
    const quantity = game.holdings[asset.id];
    const value = quantity * game.prices[asset.id];
    const dailyIncome = quantity * asset.dailyIncome;
    return `
      <article class="holding-row">
        <div class="holding-copy"><strong>${escapeHTML(asset.name)}</strong><span>${escapeHTML(asset.city)} · ${quantity} owned</span></div>
        <div class="holding-value"><strong>${formatMoney(value)}</strong><span>${dailyIncome ? `+${formatMoney(dailyIncome)}/day` : 'No daily income'}</span></div>
        <button type="button" class="sell-button" data-sell="${asset.id}">Sell one</button>
      </article>`;
  }).join('');
}

function renderCities() {
  const netWorth = getNetWorth();
  let unlockedCity = false;
  for (const city of CITY_UNLOCKS) {
    if (netWorth >= city.threshold && !game.unlockedCities.includes(city.name)) {
      game.unlockedCities.push(city.name);
      appendLog(`${city.name} is open for business! Your growing empire unlocked a new city.`);
      unlockedCity = true;
    }
  }
  if (unlockedCity) saveGame();
  citiesList.innerHTML = CITY_UNLOCKS.map((city, index) => {
    const unlocked = game.unlockedCities.includes(city.name);
    const progress = city.threshold === 0 ? 100 : Math.min(100, (netWorth / city.threshold) * 100);
    const nextCity = CITY_UNLOCKS[index + 1];
    return `
      <article class="city-row">
        <span class="city-indicator${unlocked ? ' unlocked' : ''}">${unlocked ? '✓' : '·'}</span>
        <div class="city-copy"><strong>${escapeHTML(city.name)}${unlocked ? '<span class="city-open">OPEN</span>' : ''}</strong><span>${unlocked ? escapeHTML(city.description) : `${formatMoney(city.threshold)} empire value to unlock`}</span>${!unlocked && nextCity ? `<span class="city-progress"><i style="width:${progress}%"></i></span>` : ''}</div>
      </article>`;
  }).join('');
}

function renderJournal() {
  journalList.innerHTML = game.log.length
    ? game.log.map(entry => `<li><span class="journal-day">DAY ${escapeHTML(entry.day)}</span><span>${escapeHTML(entry.text)}</span></li>`).join('')
    : '<li class="journal-empty">Your next great deal goes here.</li>';
}

function render() {
  renderHeader();
  renderStats();
  renderCities();
  renderMarket();
  renderHoldings();
  renderJournal();
  const nextDayButton = document.getElementById('nextDayButton');
  const won = getNetWorth() >= WINNING_NET_WORTH;
  nextDayButton.innerHTML = won
    ? 'Keep growing your empire <span aria-hidden="true">→</span>'
    : 'Advance to next day <span aria-hidden="true">→</span>';
  if (won && !game.log.some(entry => entry.text.startsWith('You did it!'))) {
    appendLog(`You did it! Your empire crossed ${formatMoney(WINNING_NET_WORTH)}. Keep building as a true market legend.`);
    renderJournal();
  }
}

function renderGameView(view) {
  game.view = view === 'stocks' ? 'stocks' : 'empire';
  const stockMode = game.view === 'stocks';
  document.getElementById('empireScoreboard').hidden = game.view !== 'empire';
  document.getElementById('empireView').hidden = game.view !== 'empire';
  document.getElementById('stocksView').hidden = game.view !== 'stocks';
  document.querySelector('.intro .eyebrow').textContent = stockMode
    ? 'YOUR MARKET DESK'
    : game.playerName ? `WELCOME, ${game.playerName.toUpperCase()}` : 'YOUR STORY STARTS HERE';
  document.getElementById('gameTitle').innerHTML = stockMode
    ? 'Read the market.<br /><span>Build your portfolio.</span>'
    : 'Build an empire.<br /><span>One move at a time.</span>';
  document.getElementById('gameDescription').textContent = stockMode
    ? 'Trade Indian and US stocks, crypto, and forex. Follow live charts, grow your stock portfolio, and use its value to expand your business empire.'
    : "Scout the market, buy real businesses, collect daily income and grow your portfolio across the world's most exciting cities. Every new day brings a new market.";
  document.querySelectorAll('[data-game-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.gameView === game.view);
  });
  if (game.view === 'stocks' && typeof selectStock === 'function') {
    renderStockList();
    renderPositions();
    renderHoldings();
    renderOrders();
    updateStats();
    selectStock(state.selected || 'AAPL');
    startMarketDataPolling();
  }
}

function setGameView(view) {
  renderGameView(view);
  if (window.location.hash !== `#${game.view}`) {
    window.location.hash = game.view;
  }
  saveGame();
}

function buyAsset(assetId) {
  const asset = ASSETS.find(item => item.id === assetId);
  if (!asset || !game.unlockedCities.includes(asset.city)) return;
  const price = game.prices[asset.id];
  if (game.cash < price) {
    showMessage(`Not enough cash for ${asset.name}. Advance a day to collect income or sell another asset.`, 'error');
    return;
  }
  game.cash -= price;
  game.holdings[asset.id] = (game.holdings[asset.id] || 0) + 1;
  appendLog(`Bought ${asset.name} in ${asset.city} for ${formatMoney(price)}.`);
  saveGame();
  render();
  showMessage(`Deal done: ${asset.name} is now part of your empire.`, 'success');
}

function sellAsset(assetId) {
  const asset = ASSETS.find(item => item.id === assetId);
  const quantity = game.holdings[assetId] || 0;
  if (!asset || quantity < 1) return;
  const price = game.prices[asset.id];
  game.cash += price;
  game.holdings[asset.id] = quantity - 1;
  if (game.holdings[asset.id] === 0) delete game.holdings[asset.id];
  appendLog(`Sold ${asset.name} in ${asset.city} for ${formatMoney(price)}.`);
  saveGame();
  render();
  showMessage(`Sold ${asset.name} at today's market price.`, 'success');
}

function negotiateAsset(assetId) {
  const asset = ASSETS.find(item => item.id === assetId);
  if (!asset || !game.unlockedCities.includes(asset.city)) return;
  if (game.lastNegotiationDay === game.day) {
    showMessage('You have already negotiated a deal today. Come back tomorrow.', 'error');
    return;
  }

  game.lastNegotiationDay = game.day;
  if (Math.random() < 0.7) {
    const discount = 0.04 + Math.random() * 0.07;
    const previousPrice = game.prices[asset.id];
    game.prices[asset.id] = Math.max(asset.basePrice * 0.65, Math.round(previousPrice * (1 - discount)));
    const saving = previousPrice - game.prices[asset.id];
    appendLog(`Negotiated a ${formatMoney(saving)} discount on ${asset.name}. New price: ${formatMoney(game.prices[asset.id])}.`);
    saveGame();
    render();
    showMessage(`The seller agreed! ${asset.name} is now ${formatMoney(saving)} cheaper.`, 'success');
    return;
  }

  appendLog(`The seller held firm on ${asset.name}. Try a different negotiation tomorrow.`);
  saveGame();
  render();
  showMessage(`No deal today. The seller held firm on ${asset.name}; try again tomorrow.`, 'error');
}

function advanceDay() {
  const income = getDailyIncome();
  game.day += 1;
  game.cash += income;

  for (const asset of ASSETS) {
    const previousPrice = game.prices[asset.id];
    const dailySwing = (Math.random() * 2 - 1) * asset.volatility;
    game.prices[asset.id] = Math.max(
      asset.basePrice * 0.65,
      Math.min(asset.basePrice * 1.6, Math.round(previousPrice * (1 + dailySwing)))
    );
  }

  const event = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
  if (event.matches.length) {
    for (const asset of ASSETS.filter(item => event.matches.includes(item.category))) {
      game.prices[asset.id] = Math.min(asset.basePrice * 1.6, Math.round(game.prices[asset.id] * event.multiplier));
    }
  }

  appendLog(`Day ${game.day} begins. ${income ? `Your businesses earned ${formatMoney(income)}.` : 'Your cash is ready to put to work.'} ${event.text}`);
  if (game.cash === 0 && getDailyIncome() === 0 && Object.keys(game.holdings).length === 0) {
    game.cash = STARTING_CASH;
    appendLog('A fresh start: the city gave you a second chance and restored your opening cash.');
  }
  saveGame();
  render();
  showMessage(`Day ${game.day}: ${event.text}`, 'success');
}

marketList.addEventListener('click', event => {
  const button = event.target.closest('[data-buy]');
  if (button) buyAsset(button.dataset.buy);
  const negotiateButton = event.target.closest('[data-negotiate]');
  if (negotiateButton) negotiateAsset(negotiateButton.dataset.negotiate);
});
holdingsList.addEventListener('click', event => {
  const button = event.target.closest('[data-sell]');
  if (button) sellAsset(button.dataset.sell);
});
document.getElementById('nextDayButton').addEventListener('click', advanceDay);
document.getElementById('founderName').addEventListener('input', event => {
  game.playerName = event.target.value.trim().slice(0, 24);
  if (typeof state !== 'undefined') {
    state.user = game.playerName || 'Founder';
    const userPill = document.getElementById('userPill');
    if (userPill) userPill.textContent = `👤 ${state.user}`;
    if (typeof saveState === 'function') saveState();
  }
  saveGame();
  renderHeader();
});
document.querySelectorAll('[data-game-view]').forEach(button => {
  button.addEventListener('click', () => setGameView(button.dataset.gameView));
});
window.addEventListener('hashchange', () => {
  const view = window.location.hash.slice(1);
  if (view === 'empire' || view === 'stocks') renderGameView(view);
});
document.getElementById('resetButton').addEventListener('click', () => {
  if (!window.confirm('Start a new game? This will erase your saved businesses and all stock-market holdings, trades, and orders.')) return;
  game = makeNewGame();
  document.getElementById('founderName').value = '';
  saveGame();
  render();
  if (typeof state !== 'undefined') {
    state.user = 'Founder';
    state.balance = INITIAL_INR_BALANCE;
    state.usdBalance = 0;
    state.initialBalance = INITIAL_INR_BALANCE;
    state.portfolio = {};
    state.orders = [];
    state.dayPnL = 0;
    state.livePrices = {};
    state.stockData = createAllStockData();
    state.selected = 'AAPL';
    state.tab = 'all';
    saveState();
    renderStockList();
    renderPositions();
    renderHoldings();
    renderOrders();
    updateStats();
    if (game.view === 'stocks') selectStock('AAPL');
  }
  showMessage('A brand-new empire awaits. Your opening cash is ready.', 'success');
});

try {
  game = loadGame();
  document.getElementById('founderName').value = game.playerName;
  if (typeof state !== 'undefined') {
    state.user = game.playerName || state.user || 'Founder';
    if (state.user) {
      const userPill = document.getElementById('userPill');
      if (userPill) userPill.textContent = `👤 ${state.user}`;
    }
  }
  saveGame();
  render();
  window.setGameView = setGameView;
  window.openFundsTransfer = openFundsTransfer;
  window.closeFundsTransfer = closeFundsTransfer;
  window.updateFundsTransfer = updateFundsTransfer;
  window.executeFundsTransfer = executeFundsTransfer;
  window.syncEmpireStockState = () => {
    render();
    saveGame();
  };
  const startingView = window.location.hash.slice(1) === 'stocks'
    ? 'stocks'
    : game.view;
  renderGameView(startingView);
} catch (error) {
  console.error('Could not load the text empire game.', error);
  showMessage(error.message || 'Your saved empire could not be loaded.', 'error');
  marketList.innerHTML = '<div class="empty-state"><strong>Could not load your saved empire.</strong><p>Start a new empire to begin again.</p></div>';
  document.getElementById('resetButton').hidden = false;
}
})();
