"""HMM-based market regime detection."""

import warnings
from datetime import date, datetime, time

import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM

REGIME_LABELS_3 = ["bearish", "sideways", "bullish"]
REGIME_LABELS_2 = ["bearish", "bullish"]
REGIME_LABELS_VOL_3 = ["low_vol", "normal_vol", "high_vol"]
REGIME_LABELS_VOL_2 = ["low_vol", "high_vol"]
VALID_REGIME_TYPES = {"directional", "volatility", "combined"}

MIN_BARS = 30


class RegimeDetector:
    def __init__(
        self,
        n_regimes: int = 3,
        random_state: int = 42,
        regime_type: str = "directional",
    ):
        if regime_type not in VALID_REGIME_TYPES:
            raise ValueError(f"regime_type must be one of {VALID_REGIME_TYPES}, got {regime_type!r}")
        self.n_regimes = n_regimes
        self.random_state = random_state
        self.regime_type = regime_type

    def detect(self, df: pd.DataFrame) -> list[dict]:
        if len(df) < MIN_BARS:
            return []

        features = self._build_features(df)
        states = self._fit_hmm(features)
        if states is None:
            return []

        labels = self._map_state_labels(features, states)
        segments = self._compress_segments(df, states, labels)
        return segments

    def _build_features(self, df: pd.DataFrame) -> np.ndarray:
        close = df["close"].values.astype(float)
        log_returns = np.diff(np.log(close))
        vol_window = min(10, len(log_returns) // 3)
        vol_window = max(vol_window, 2)
        rolling_vol = pd.Series(log_returns).rolling(window=vol_window).std().values

        valid_start = vol_window - 1
        features = np.column_stack([log_returns[valid_start:], rolling_vol[valid_start:]])

        nan_mask = np.isnan(features).any(axis=1)
        features = features[~nan_mask]

        return features

    def _fit_hmm(self, features: np.ndarray) -> np.ndarray | None:
        if len(features) < self.n_regimes * 5:
            return None

        seeds = [self.random_state, self.random_state + 1, self.random_state + 2]
        best_model = None
        best_score = float("-inf")

        for seed in seeds:
            model = GaussianHMM(
                n_components=self.n_regimes,
                covariance_type="full",
                n_iter=200,
                random_state=seed,
            )
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                try:
                    model.fit(features)
                    score = model.score(features)
                    if score > best_score:
                        best_score = score
                        best_model = model
                except Exception:
                    continue

        if best_model is None:
            return None

        return best_model.predict(features)

    def _map_state_labels(self, features: np.ndarray, states: np.ndarray) -> dict[int, str]:
        if self.regime_type == "directional":
            return self._map_directional(features, states)
        if self.regime_type == "volatility":
            return self._map_volatility(features, states)
        return self._map_combined(features, states)

    def _map_directional(self, features: np.ndarray, states: np.ndarray) -> dict[int, str]:
        mean_returns = {}
        for state in range(self.n_regimes):
            mask = states == state
            mean_returns[state] = features[mask, 0].mean() if mask.any() else 0.0

        sorted_states = sorted(mean_returns, key=lambda s: mean_returns[s])
        labels_list = REGIME_LABELS_2 if self.n_regimes == 2 else REGIME_LABELS_3
        return {state: labels_list[i] for i, state in enumerate(sorted_states)}

    def _map_volatility(self, features: np.ndarray, states: np.ndarray) -> dict[int, str]:
        mean_vols = {}
        for state in range(self.n_regimes):
            mask = states == state
            mean_vols[state] = features[mask, 1].mean() if mask.any() else 0.0

        sorted_states = sorted(mean_vols, key=lambda s: mean_vols[s])
        labels_list = REGIME_LABELS_VOL_2 if self.n_regimes == 2 else REGIME_LABELS_VOL_3
        return {state: labels_list[i] for i, state in enumerate(sorted_states)}

    def _map_combined(self, features: np.ndarray, states: np.ndarray) -> dict[int, str]:
        if self.n_regimes != 4:
            raise ValueError(f"combined regime_type requires n_regimes=4, got n_regimes={self.n_regimes}")

        mean_returns = {}
        mean_vols = {}
        for state in range(self.n_regimes):
            mask = states == state
            mean_returns[state] = features[mask, 0].mean() if mask.any() else 0.0
            mean_vols[state] = features[mask, 1].mean() if mask.any() else 0.0

        sorted_by_return = sorted(mean_returns, key=lambda s: mean_returns[s])
        bearish_group = sorted_by_return[:2]
        bullish_group = sorted_by_return[2:]

        # higher vol within bearish → bearish_high_vol
        bearish_sorted = sorted(bearish_group, key=lambda s: mean_vols[s], reverse=True)
        # lower vol within bullish → bullish_low_vol
        bullish_sorted = sorted(bullish_group, key=lambda s: mean_vols[s])

        return {
            bearish_sorted[0]: "bearish_high_vol",
            bearish_sorted[1]: "bearish_low_vol",
            bullish_sorted[0]: "bullish_low_vol",
            bullish_sorted[1]: "bullish_high_vol",
        }

    def _compress_segments(self, df: pd.DataFrame, states: np.ndarray, labels: dict[int, str]) -> list[dict]:
        timestamps = df["timestamp"].values
        offset = len(timestamps) - len(states)
        segment_timestamps = timestamps[offset:]

        segments: list[dict] = []
        current_label = labels[states[0]]
        segment_start = self._to_datetime(segment_timestamps[0])

        for i in range(1, len(states)):
            label = labels[states[i]]
            if label != current_label:
                segments.append(
                    {
                        "start": segment_start,
                        "end": self._to_datetime(segment_timestamps[i - 1]),
                        "regime": current_label,
                    }
                )
                current_label = label
                segment_start = self._to_datetime(segment_timestamps[i])

        segments.append(
            {
                "start": segment_start,
                "end": self._to_datetime(segment_timestamps[-1]),
                "regime": current_label,
            }
        )

        return segments

    @staticmethod
    def _to_datetime(ts) -> datetime:
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, date):
            return datetime.combine(ts, time.min)
        if isinstance(ts, np.datetime64):
            return pd.Timestamp(ts).to_pydatetime()
        if isinstance(ts, str):
            return datetime.fromisoformat(ts)
        return datetime.fromtimestamp(ts)
