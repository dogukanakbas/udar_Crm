## Loglama ve Alerting (Plan)

- **Structured JSON**: backend logları JSON formatına çek; PII redaksiyon middleware uygulanmış içerik loglansın.
- **Toplama**: merkezi log (ELK/OpenSearch veya Loki) endpointine forward; stdout collection yeterli ise Docker logging driver ile.
- **Access/Audit ayrımı**: access log (request/response meta, masked) ve audit (entity change) ayrı index’e.
- **Alertler (örnek)**:
  - HTTP 5xx oranı eşiği (5m pencerede %>1 veya ardışık 10+ hata).
  - Login başarısız / throttle spike.
  - Celery heartbeat/görev kuyruğu gecikmesi.
  - Disk/CPU/RAM/DB bağlantı hatası (ops seviyesinde).
- **SSE/WS**: reconnect hataları ve 401 sayısı monitor edilsin.
- **Uptime**: basit endpoint monitor (ping/health) + domain SSL süresi.
- **Dashboard**: response time/5xx, DB/Redis ping, queue length.

## Backup Schedule (Öneri)

- **Postgres**: pg_dump (custom format) günde 1; saklama 7-14 gün; şifreli sakla. Dosya adı: `db-YYYYMMDD.dump`.
- **Media/Static**: günlük tar + saklama 7 gün; büyükse haftalık full + günlük diff.
- **Konum**: offsite veya farklı disk/bucket; erişim kontrollü.
- **Otomasyon**: cron veya CI job; hata durumunda alert (e-posta/Slack).
- **Restore Prova**: ayda bir test restore (staging’e) ve belge.

