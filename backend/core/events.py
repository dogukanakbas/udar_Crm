import json
import queue
import threading
from typing import Dict, Any, List

_subscribers: List[queue.Queue] = []
_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: queue.Queue):
    with _lock:
        if q in _subscribers:
            _subscribers.remove(q)


def push_event(payload: Dict[str, Any]):
    data = json.dumps(payload)
    with _lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            q.put_nowait(data)
        except Exception:
            continue

