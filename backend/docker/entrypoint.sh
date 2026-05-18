#!/usr/bin/env bash
set -euo pipefail

wait_for_postgres() {
  python <<'PY'
import os
import time

import psycopg2

deadline = time.time() + int(os.getenv("DATABASE_WAIT_TIMEOUT", "60"))
last_error = None

while time.time() < deadline:
    try:
        connection = psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB", "udar_crm"),
            user=os.getenv("POSTGRES_USER", "udar"),
            password=os.getenv("POSTGRES_PASSWORD", "udar"),
            host=os.getenv("POSTGRES_HOST", "db"),
            port=os.getenv("POSTGRES_PORT", "5432"),
        )
        connection.close()
        raise SystemExit(0)
    except Exception as exc:
        last_error = exc
        time.sleep(1)

raise SystemExit(f"Postgres is not ready: {last_error}")
PY
}

wait_for_redis() {
  python <<'PY'
import os
import time

import redis

deadline = time.time() + int(os.getenv("REDIS_WAIT_TIMEOUT", "60"))
last_error = None
url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")

while time.time() < deadline:
    try:
        client = redis.from_url(url)
        client.ping()
        raise SystemExit(0)
    except Exception as exc:
        last_error = exc
        time.sleep(1)

raise SystemExit(f"Redis is not ready: {last_error}")
PY
}

wait_for_postgres
wait_for_redis

case "${1:-web}" in
  dev)
    python manage.py migrate
    python manage.py runserver 0.0.0.0:8000
    ;;
  web)
    python manage.py migrate
    python manage.py collectstatic --noinput
    gunicorn core.wsgi:application \
      --bind 0.0.0.0:8000 \
      --worker-class gevent \
      --workers "${GUNICORN_WORKERS:-4}" \
      --timeout 120
    ;;
  celery-worker)
    celery -A core worker -l "${CELERY_LOG_LEVEL:-info}"
    ;;
  celery-beat)
    celery -A core beat -l "${CELERY_LOG_LEVEL:-info}"
    ;;
  *)
    exec "$@"
    ;;
esac
