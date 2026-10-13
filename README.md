# tradingSimulatorPro

## Unified trading empire

Open <http://127.0.0.1:8000> for both stock-market paper trading and the
text-based business empire in one game. Switch modes using the navigation at
the top. Stock-market net worth counts toward city unlocks and empire progress.
Start with ₹250,000 in the business empire; stocks use separate INR and USD
trading wallets. Buy and sell businesses, offices, art galleries, and luxury
cars; advance a day to collect business income and see the simulated market
move. Grow your empire to unlock Delhi, Dubai, and London. Progress saves
automatically in your browser. Stock quotes use the local Yahoo Finance proxy;
all trading is simulated. Use **Transfer funds** to move money between the
empire and either stock wallet; cross-currency transfers use the current USD/INR
rate and are recorded in the deal journal and order history.

## Paper trading

The stock simulator starts with ₹100,000 in an INR wallet and a separate USD wallet.
Indian stocks trade from the INR wallet; US stocks, USD-quoted crypto, and the Forex
pairs (EUR/USD, GBP/USD, AUD/USD, NZD/USD) trade from the USD wallet. Use
**Convert** to exchange between the wallets at the live USD/INR quote fetched
from Yahoo Finance; the rate refreshes at startup and every 60 seconds while
the game is open. A last-known/fallback rate is clearly marked if the live quote is
unavailable, and currency conversion stays disabled until a fresh quote is
available. Selling an asset returns its proceeds to that asset's wallet. All
trading is simulated.

## Run locally

Yahoo Finance blocks or rate-limits many direct browser requests. Run the included
same-origin proxy and open the app through it instead of opening an HTML file
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