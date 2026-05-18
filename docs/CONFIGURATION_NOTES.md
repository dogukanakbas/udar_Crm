# Yapılandırma Notları

Bu belge, Docker kurulumu ve teklif/fiyat listesi geliştirmeleri için yapılan ana yapılandırmaları özetler. Amaç, geliştirme ortamını Docker Desktop'ta görünür tutmak ve firma/production kurulumunu ayrı bir compose dosyasıyla yönetmektir.

## Docker geliştirme ortamı

Geliştirme ortamı ana `docker-compose.yml` dosyasını kullanır.

Servisler:

- `udar-crm-frontend`: Vite geliştirme sunucusu, `http://localhost:5173`
- `udar-crm-backend`: Django/DRF API, `http://localhost:8000/api`
- `udar-crm-postgres`: PostgreSQL, host portu `5432`
- `udar-crm-redis`: Redis, host portu `6379`
- `udar-crm-celery-worker`: Celery worker
- `udar-crm-celery-beat`: Celery beat
- `udar-crm-db-admin`: Adminer, varsayılan host portu `8080`
- `udar-crm-redis-admin`: RedisInsight, host portu `5540`

Geliştirme compose dosyasında restart policy tanımlı değildir. Bu nedenle Docker Desktop açılınca servislerin kendiliğinden ayağa kalkması beklenmez; stack elle başlatılır.

```bash
docker compose up --build
```

Kapatmak için:

```bash
docker compose down
```

Veriyi de sıfırlamak için:

```bash
docker compose down -v
```

Adminer için hostta `8080` doluysa port değiştirilebilir:

```bash
ADMINER_PORT_HOST=8081 docker compose up -d adminer
```

## Docker Desktop görünürlüğü

Container adları özellikle okunur tutuldu. Docker Desktop içinde doğrudan `udar-crm-*` prefix'iyle görülebilirler. Bu, hangi servisin frontend, backend, Postgres veya Redis olduğunu hızlı ayırt etmek için yapıldı.

Healthcheck akışı:

- Postgres: `pg_isready`
- Redis: `redis-cli ping`
- Backend: `/api/health/` endpoint'i üzerinden DB ve Redis kontrolü
- Frontend: Vite sayfasına HTTP kontrolü

Backend entrypoint dosyası: `backend/docker/entrypoint.sh`

Bu entrypoint Postgres ve Redis hazır olmadan Django, Celery worker veya Celery beat'i başlatmaz.

## Production compose ayrımı

Firmalar için `docker-compose.prod.yml` kullanılacaktır. Bu dosya geliştirme ortamından ayrı tutuldu.

Production farkları:

- `postgres:15-alpine` ve `redis:7-alpine` kullanılır.
- Redis append-only persistence ile başlar.
- Backend gunicorn ile çalışır.
- Static ve media dosyaları volume ile tutulur.
- Nginx reverse proxy olarak kullanılır.
- Production frontend build-time API adresi `PROD_VITE_API_BASE_URL` ile verilir.
- `restart: unless-stopped` production servislerinde aktiftir.

Örnek production başlatma:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d
```

Örnek production env dosyaları:

- `.env.prod.example`
- `backend/env.prod.example`

Gerçek secret, domain, SMTP ve storage değerleri bu örneklerden türetilmelidir.

## Demo kullanıcıları

Seed sonrası demo kullanıcıları:

- `admin@demo.com / Admin123!`
- `sales@demo.com / Sales123!`
- `finance@demo.com / Finance123!`
- `superadmin@udarsoft.com / SuperAdmin123!`

Seed komutu:

```bash
docker compose exec backend python manage.py seed_demo
```

## Teklif geçerliliği

Teklif ekranındaki geçerlilik metinleri `iş günü` yerine `gün` olarak güncellendi.

Örnekler:

- `3 gün`
- `5 gün`
- `7 gün`
- `10 gün`
- `Manuel gün`

Backend serializer fallback metni de aynı davranışa çekildi. Böylece frontend ve belge çıktıları aynı metni kullanır.

## Çoklu fiyat listesi yapısı

Fiyat listesi tek bir etiket olmaktan çıkarıldı. Artık organizasyon bazında birden fazla fiyat listesi tanımlanabilir.

Varsayılan başlangıç listeleri:

- `list_1`: `2026/1. LİSTE`
- `list_2`: `2026/2. LİSTE`

Eklenen alanlar:

- `OrganizationSettings.price_lists`
- `BusinessPartner.price_list_key`
- `Product.price_lists`

Davranış:

- Admin, belge/şablon yönetimi ekranından fiyat listelerini ekleyebilir, silebilir ve varsayılan listeyi seçebilir.
- Müşteri kartında varsayılan fiyat listesi seçilir.
- Ürün kartında her fiyat listesi için ayrı fiyat girilebilir.
- Teklif oluştururken müşterinin varsayılan fiyat listesi otomatik gelir.
- Teklifte fiyat listesi değiştirilirse ürün satır fiyatları seçilen listeye göre güncellenir.
- Excel/PDF belge çıktılarında teklifin seçili fiyat listesi etiketi kullanılır.

Geriye uyumluluk için eski `price_list_label` alanı tutuldu. Bu alan varsayılan fiyat listesi etiketiyle senkron çalışır.

## Ürün katalog importu

GitHub'da daha önce eklenmiş template/fiyat listesi kaynakları tekrar kullanıldı.

Kaynak dosyalar:

- `src/data/quote-template-lists.generated.ts`
- `src/lib/template-product-catalog.ts`
- `backend/erp/template_catalog_import.py`

Katalog importu şu grupları üretir:

- `Çelik Kapı`
- `İç Oda Kapısı`
- `Montaj`
- `Mobilya / Mutfak`
- `Mobilya / Portmanto`
- `Mobilya / Banyo`

SKU tekil olduğu için aynı SKU farklı listelerde tekrar ürün olarak açılmaz. Bu nedenle ham fiyat satırı sayısı ile oluşturulan ürün kartı sayısı birebir aynı olmayabilir; sistem benzersiz SKU üzerinden katalog oluşturur.

Arayüzden tekrar import:

1. Stok paneline gir.
2. `Şablon ürünlerini stoğa ekle` butonunu kullan.
3. Import edilen ürünler `attribute_values.import_origin = excel_templates` ile işaretlenir.

## Doğrulama komutları

Backend:

```bash
docker compose exec -T backend python manage.py check
```

Frontend:

```bash
docker compose exec -T frontend npm run build
```

Healthcheck:

```bash
curl http://localhost:8000/api/health/
```

Beklenen cevap:

```json
{"backend": "ok", "db": "ok", "redis": "ok"}
```
