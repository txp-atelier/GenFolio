"""A minimal in-memory sliding-window rate limiter. Good enough for a
single-process app where the goal is just capping runaway LLM spend, not
distributed/multi-worker correctness — if this ever runs behind multiple
worker processes, this would need to move to something shared (e.g. Redis)."""

import time
import uuid
from collections import defaultdict

_request_log: dict[uuid.UUID, list[float]] = defaultdict(list)


class RateLimitExceededError(Exception):
    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"Rate limit exceeded, retry after {retry_after_seconds}s")


def check_rate_limit(key: uuid.UUID, max_requests: int, window_seconds: int) -> None:
    now = time.monotonic()
    timestamps = _request_log[key]

    cutoff = now - window_seconds
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)

    if len(timestamps) >= max_requests:
        retry_after = int(window_seconds - (now - timestamps[0])) + 1
        raise RateLimitExceededError(retry_after)

    timestamps.append(now)
