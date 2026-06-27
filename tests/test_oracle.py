import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "oracle"))
from miden_oracle import bucket_for, fetch_weather, BUCKETS


class TestBucketFor:
    """BUCKETS = [250, 280, 310, 340]  (unit: temp * 10)"""

    def test_25_5c_returns_250(self):
        # 25.5 * 10 = 255 → closest to 250 (diff=5) vs 280 (diff=25)
        assert bucket_for(25.5) == 250

    def test_30_0c_returns_310(self):
        # 30.0 * 10 = 300 → closest to 310 (diff=10) vs 280 (diff=20)
        assert bucket_for(30.0) == 310

    def test_20_0c_returns_250(self):
        # 20.0 * 10 = 200 → closest to 250 (diff=50); 200 is not a bucket
        assert bucket_for(20.0) == 250

    def test_28_0c_returns_280(self):
        # exact bucket value
        assert bucket_for(28.0) == 280

    def test_34_0c_returns_340(self):
        # exact bucket value
        assert bucket_for(34.0) == 340

    def test_31_0c_returns_310(self):
        # exact bucket value
        assert bucket_for(31.0) == 310

    def test_all_buckets_are_reachable(self):
        # each bucket should win for its own exact temperature
        for b in BUCKETS:
            assert bucket_for(b / 10) == b


class TestFetchWeatherRetry:
    """fetch_weather should retry up to MAX_RETRIES times on failure."""

    @patch("miden_oracle.requests.get")
    @patch("miden_oracle.time.sleep", return_value=None)
    def test_returns_none_after_all_retries_fail(self, mock_sleep, mock_get):
        mock_get.side_effect = Exception("network error")
        city, temp = fetch_weather(retries=3)
        assert city is None
        assert temp is None
        assert mock_get.call_count == 3

    @patch("miden_oracle.requests.get")
    @patch("miden_oracle.time.sleep", return_value=None)
    def test_retries_then_succeeds(self, mock_sleep, mock_get):
        fail = MagicMock()
        fail.raise_for_status.side_effect = Exception("server error")
        ok = MagicMock()
        ok.raise_for_status.return_value = None
        ok.json.return_value = {"main": {"temp": 27.3}, "name": "Taipei"}
        mock_get.side_effect = [fail, ok]

        city, temp = fetch_weather(retries=3)
        assert city == "Taipei"
        assert temp == 27.3
        assert mock_get.call_count == 2

    @patch("miden_oracle.requests.get")
    @patch("miden_oracle.time.sleep", return_value=None)
    def test_success_on_first_try(self, mock_sleep, mock_get):
        ok = MagicMock()
        ok.raise_for_status.return_value = None
        ok.json.return_value = {"main": {"temp": 31.5}, "name": "Tokyo"}
        mock_get.return_value = ok

        city, temp = fetch_weather(retries=3)
        assert city == "Tokyo"
        assert temp == 31.5
        assert mock_get.call_count == 1
