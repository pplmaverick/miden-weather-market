import os
import time
import logging
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")
CITY    = os.environ.get("CITY", "Taipei")
INTERVAL_SECS = 3600  # 每小時一次
MAX_RETRIES   = 3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("miden_oracle")

# 合約 x10 溫度 bucket：250=25°C, 280=28°C, 310=31°C, 340=34°C
BUCKETS = [250, 280, 310, 340]


def bucket_for(temp_c: float) -> int:
    """回傳最接近 temp_c 的 x10 bucket 值。"""
    temp_x10 = round(temp_c * 10)
    return min(BUCKETS, key=lambda b: abs(b - temp_x10))


def fetch_weather(retries: int = MAX_RETRIES):
    url = (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?q={CITY}&appid={API_KEY}&units=metric"
    )
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            temp = data["main"]["temp"]
            city = data["name"]
            return city, temp
        except Exception as exc:
            log.warning("attempt %d/%d failed: %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(5)
    return None, None


def run():
    log.info("Miden Oracle started — city=%s, interval=%ds", CITY, INTERVAL_SECS)
    while True:
        city, temp = fetch_weather()
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if city is None:
            log.error("ts=%s  all retries failed, skipping round", ts)
        else:
            bucket = bucket_for(temp)
            log.info(
                "ts=%s  city=%s  temp=%.1f°C  winning_bucket=%d",
                ts, city, temp, bucket,
            )
        time.sleep(INTERVAL_SECS)


if __name__ == "__main__":
    run()
