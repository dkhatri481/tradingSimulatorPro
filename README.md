# tradingSimulatorPro

## Paper trading

The simulator starts with ₹100,000 in an INR wallet and a separate USD wallet.
Indian stocks trade from the INR wallet; US stocks, USD-quoted crypto, and the Forex
pairs (EUR/USD, GBP/USD, AUD/USD, NZD/USD) trade from the USD wallet. Use
**Convert** to exchange between the wallets at the live USD/INR quote fetched
from Yahoo Finance; the rate refreshes at startup and every 60 seconds while
logged in. A last-known/fallback rate is clearly marked if the live quote is
unavailable, and currency conversion stays disabled until a fresh quote is
available. Selling an asset returns its proceeds to that asset's wallet. All
trading is simulated.

## Run locally

Yahoo Finance blocks or rate-limits many direct browser requests. Run the included
same-origin proxy and open the app through it instead of opening `index.html`
directly:

```powershell
py server.py
```

If the `py` launcher is unavailable on this Windows setup, run:

```powershell
& "$env:LOCALAPPDATA\Python\bin\python.exe" server.py
```

Then visit <http://127.0.0.1:8000>. The proxy uses Python's standard library,
keeps successful chart responses for 60 seconds to reduce Yahoo requests, and
supports the chart's configured timeframes and date ranges. Stop it with
`Ctrl+C`.