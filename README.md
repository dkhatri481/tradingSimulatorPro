# tradingSimulatorPro

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