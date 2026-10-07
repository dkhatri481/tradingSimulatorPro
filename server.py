from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
import json
import re
import threading
import time


ROOT = Path(__file__).resolve().parent
YAHOO_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart/"
ALLOWED_INTERVAL_DAYS = {"5m": 3, "15m": 3, "1h": 5, "1d": 7}
CACHE_SECONDS = 60
SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9.^=_-]{1,32}$")
market_cache = {}
cache_lock = threading.Lock()


class TradeProHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlparse(self.path).path != "/api/market":
            return super().do_GET()
        self.handle_market_request()

    def handle_market_request(self):
        query = parse_qs(urlparse(self.path).query)
        symbol = query.get("symbol", [""])[0]
        interval = query.get("interval", [""])[0]
        try:
            days = int(query.get("days", ["0"])[0])
        except ValueError:
            self.send_json(400, {"error": "Invalid chart data range"})
            return

        if not SYMBOL_PATTERN.fullmatch(symbol):
            self.send_json(400, {"error": "Invalid stock symbol"})
            return
        if ALLOWED_INTERVAL_DAYS.get(interval) != days:
            self.send_json(400, {"error": "Unsupported chart interval or data range"})
            return

        cache_key = (symbol, interval, days)
        force_refresh = query.get("refresh", ["0"])[0] == "1"
        now = monotonic()
        with cache_lock:
            cached = market_cache.get(cache_key)
            if not force_refresh and cached and now - cached[0] < CACHE_SECONDS:
                self.send_json(200, cached[1])
                return

        period2 = int(time.time())
        params = urlencode({
            "interval": interval,
            "period1": period2 - days * 24 * 60 * 60,
            "period2": period2,
        })
        request = Request(
            YAHOO_ENDPOINT + symbol + "?" + params,
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; TradePro/1.0)",
            },
        )
        try:
            with urlopen(request, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            self.send_json(502, {
                "error": "Yahoo Finance request failed",
                "upstreamStatus": error.code,
            })
            return
        except (URLError, TimeoutError, OSError, ValueError) as error:
            self.send_json(502, {"error": "Could not fetch data from Yahoo Finance"})
            self.log_error("Yahoo Finance request failed: %s", error)
            return

        chart = payload.get("chart", {})
        if chart.get("error"):
            self.send_json(502, {"error": chart["error"].get("description", "Yahoo Finance returned an error")})
            return
        with cache_lock:
            market_cache[cache_key] = (monotonic(), payload)
        self.send_json(200, payload)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), TradeProHandler)
    print("TradePro running at http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping TradePro...")
    finally:
        server.server_close()
