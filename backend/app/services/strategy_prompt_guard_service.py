"""Guardrails for natural-language strategy compiler prompts."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from html import unescape
from typing import Literal


Decision = Literal["accept", "accept_with_warnings", "reject"]

MIN_PROMPT_CHARS = 25
MAX_PROMPT_CHARS = 8000
WARN_PROMPT_CHARS = 4000
MAX_PROMPT_WORDS = 1200
MAX_REPEAT_LINE_COUNT = 5
MAX_REPEATED_WORD_SHARE = 0.2
MIN_ALPHA_WORDS = 3
MAX_NOISE_RATIO = 0.35
MAX_UPPERCASE_RATIO = 0.6
LONG_PROMPT_UPPERCASE_MIN_CHARS = 80
WARN_REMOVED_LINE_RATIO = 0.2

TRADING_NOUNS = {
    "stock",
    "stocks",
    "etf",
    "price",
    "bars",
    "candles",
    "market",
    "symbol",
    "spy",
    "qqq",
    "iwm",
    "entry",
    "exit",
    "long",
    "buy",
    "sell",
    "position",
    "risk",
    "slippage",
    "commission",
    "timeframe",
}

STRATEGY_TERMS = {
    "when",
    "if",
    "cross",
    "crosses",
    "above",
    "below",
    "greater",
    "less",
    "rsi",
    "ema",
    "sma",
    "macd",
    "bollinger",
    "stochastic",
    "atr",
    "daily",
    "hourly",
    "minute",
}

PROFANITY_TERMS = {
    "fuck",
    "fucking",
    "shit",
    "damn",
    "bitch",
    "asshole",
}

INJECTION_MARKERS = (
    "ignore previous instructions",
    "ignore all previous instructions",
    "system prompt",
    "developer message",
    "reveal your instructions",
    "return the raw schema",
    "print your hidden prompt",
    "bypass",
    "jailbreak",
)

EXFILTRATION_MARKERS = (
    "api key",
    "secret",
    "token",
    "password",
    "env",
    "environment variable",
    "filesystem",
    "file://",
)

URL_ONLY_RE = re.compile(r"^(?:https?://|www\.)\S+$", re.IGNORECASE)
HTML_TAG_RE = re.compile(r"<[^>]+>")
CODE_FENCE_RE = re.compile(r"^```.*$")
WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")


@dataclass
class PromptGuardResult:
    """Result of prompt validation and normalization."""

    decision: Decision
    normalized_prompt: str
    reasons: list[str]
    warnings: list[str]
    metrics: dict[str, int | float | bool]


class StrategyPromptGuardService:
    """Evaluate prompts before they are sent to the compiler model."""

    def evaluate(self, prompt: str, name: str | None = None, description: str | None = None) -> PromptGuardResult:
        normalized_prompt, normalization_metrics = self._normalize_prompt(prompt)
        words = WORD_RE.findall(normalized_prompt.lower())
        lowered = normalized_prompt.lower()
        reasons: list[str] = []
        warnings: list[str] = []

        char_count = len(normalized_prompt)
        word_count = len(words)
        alpha_word_count = sum(1 for word in words if any(char.isalpha() for char in word))
        letters = [char for char in normalized_prompt if char.isalpha()]
        uppercase_letters = [char for char in letters if char.isupper()]
        noise_chars = [
            char
            for char in normalized_prompt
            if not char.isalnum() and not char.isspace() and char not in {".", ",", "%"}
        ]
        repeated_word_share = self._repeated_word_share(words)
        has_trading_noun = any(term in words for term in TRADING_NOUNS)
        has_strategy_term = any(term in words for term in STRATEGY_TERMS)
        profanity_hits = sorted({word for word in words if word in PROFANITY_TERMS})

        metrics: dict[str, int | float | bool] = {
            "char_count": char_count,
            "word_count": word_count,
            "alpha_word_count": alpha_word_count,
            "noise_ratio": len(noise_chars) / char_count if char_count else 0.0,
            "uppercase_ratio": len(uppercase_letters) / len(letters) if letters else 0.0,
            "repeated_word_share": repeated_word_share,
            "lines_removed": normalization_metrics["lines_removed"],
            "original_line_count": normalization_metrics["original_line_count"],
            "urls_removed": normalization_metrics["urls_removed"],
            "code_fences_removed": normalization_metrics["code_fences_removed"],
        }

        if not normalized_prompt.strip():
            reasons.append("Prompt is empty after removing irrelevant or spammy content.")
        if char_count and char_count < MIN_PROMPT_CHARS:
            reasons.append("Prompt is too short. Describe entry, exit, or indicator conditions in more detail.")
        if char_count > MAX_PROMPT_CHARS or word_count > MAX_PROMPT_WORDS:
            reasons.append("Prompt is too long. Remove unrelated text and keep only the strategy description.")
        if alpha_word_count < MIN_ALPHA_WORDS:
            reasons.append("Prompt does not contain enough meaningful words to describe a strategy.")

        repeated_line = normalization_metrics["max_duplicate_line_count"] > MAX_REPEAT_LINE_COUNT
        if repeated_line:
            reasons.append("Prompt appears spammy because it repeats the same line too many times.")

        if word_count >= 30 and repeated_word_share > MAX_REPEATED_WORD_SHARE:
            reasons.append("Prompt appears spammy because one word is repeated excessively.")

        if metrics["noise_ratio"] > MAX_NOISE_RATIO:
            reasons.append("Prompt contains too much noisy or non-strategy text.")

        if char_count > LONG_PROMPT_UPPERCASE_MIN_CHARS and metrics["uppercase_ratio"] > MAX_UPPERCASE_RATIO:
            reasons.append("Prompt contains too much uppercase or shouty text.")

        if any(marker in lowered for marker in INJECTION_MARKERS):
            reasons.append("Prompt contains instruction-injection text and cannot be compiled.")

        if any(marker in lowered for marker in EXFILTRATION_MARKERS):
            reasons.append("Prompt requests secrets or hidden system data and cannot be compiled.")

        if normalized_prompt.strip() and not (has_trading_noun and has_strategy_term):
            reasons.append("Prompt appears unrelated to a technical trading strategy.")

        if char_count >= WARN_PROMPT_CHARS:
            warnings.append("Prompt is long; consider trimming unrelated details for more predictable compilation.")

        if normalization_metrics["urls_removed"]:
            warnings.append("Removed URL-only lines before compilation.")

        if normalization_metrics["code_fences_removed"]:
            warnings.append("Removed markdown code fences before compilation.")

        if normalization_metrics["original_line_count"]:
            removed_ratio = normalization_metrics["lines_removed"] / normalization_metrics["original_line_count"]
            if removed_ratio > WARN_REMOVED_LINE_RATIO:
                warnings.append("Removed a substantial amount of noisy or duplicate text before compilation.")

        if profanity_hits and not reasons:
            warnings.append("Prompt contains profanity; only the trading instructions will be used.")

        decision: Decision = "reject" if reasons else ("accept_with_warnings" if warnings else "accept")
        return PromptGuardResult(
            decision=decision,
            normalized_prompt=normalized_prompt,
            reasons=reasons,
            warnings=warnings,
            metrics=metrics,
        )

    def _normalize_prompt(self, prompt: str) -> tuple[str, dict[str, int]]:
        text = unescape(prompt or "").replace("\r\n", "\n").replace("\r", "\n")
        lines = text.split("\n")
        normalized_lines: list[str] = []
        line_counts: Counter[str] = Counter()
        lines_removed = 0
        urls_removed = 0
        code_fences_removed = 0

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                continue
            if CODE_FENCE_RE.fullmatch(line):
                lines_removed += 1
                code_fences_removed += 1
                continue

            line = HTML_TAG_RE.sub(" ", line)
            line = re.sub(r"\s+", " ", line).strip()
            if not line:
                lines_removed += 1
                continue
            if URL_ONLY_RE.fullmatch(line):
                lines_removed += 1
                urls_removed += 1
                continue
            if all(not char.isalnum() for char in line):
                lines_removed += 1
                continue

            lowered = line.lower()
            if any(marker in lowered for marker in INJECTION_MARKERS):
                normalized_lines.append(line)
                line_counts[line] += 1
                continue

            line_counts[line] += 1
            if line_counts[line] > 1:
                lines_removed += 1
                continue
            normalized_lines.append(line)

        normalized_prompt = "\n".join(normalized_lines).strip()
        return normalized_prompt, {
            "lines_removed": lines_removed,
            "original_line_count": len(lines),
            "urls_removed": urls_removed,
            "code_fences_removed": code_fences_removed,
            "max_duplicate_line_count": max(line_counts.values(), default=0),
        }

    @staticmethod
    def _repeated_word_share(words: list[str]) -> float:
        if not words:
            return 0.0
        counts = Counter(words)
        return counts.most_common(1)[0][1] / len(words)
