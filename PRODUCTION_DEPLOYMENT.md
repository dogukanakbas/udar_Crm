# 🚀 PRODUCTION DEPLOYMENT REHBERİ

**Tarih**: 26 Şubat 2026  
**Durum**: Production'a alma adımları

---

## 📋 YAPILAN DEĞİŞİKLİKLER ÖZETİ

### Backend Değişiklikleri
1. ✅ Worker self-handover endpoint'i (`/api/tasks/{id}/self_handover/`)
2. ✅ Worker tracking endpoint'i (`/api/tasks/worker-tracking/`)
3. ✅ Celery beat scheduler aktif edildi
4. ✅ Task model'e handover alanları eklendi

### Frontend Değişiklikleri
1. ✅ Zustand persist middleware (sayfa yenileme fix)
2. ✅ Login loading state (kayma fix)
3. ✅ API 403 handler (yetki hatası toast)
4. ✅ Optimistic update rollback toasts
5. ✅ Token refresh loading indicator
6. ✅ SSE reconnect logic
7. ✅ RbacFormGuard component
8. ✅ Route change hydration
9. ✅ Görev detay sayfası tıklanabilir
10. ✅ Çalışan takip sayfası (`/worker-tracking`)

---

## ⚠️ KRİTİK: CACHE TEMİZLEME GEREKLİ

**SORUN**: Yeni eklenen kullanıcılar UI'da görünmüyor (localStorage cache sorunu)

**ÇÖZÜM**: Tarayıcı konsolunda şu komutu çalıştır:
```javascript
localStorage.removeItem('udar-app-storage')
```

Sonra sayfayı yenile (F5). Artık tüm kullanıcılar görünecek.

**NOT**: Bu değişiklik sonrası yeni kullanıcılar otomatik olarak cache'e alınmayacak (her zaman fresh data).

---

## 🔄 SUNUCUDA GÜNCELLEME ADIMLARI

### Adım 1: Kod Değişikliklerini Sunucuya Aktar

**Seçenek A: Git ile (Önerilen)**
```bash
# Sunucuya SSH ile bağlan
ssh user@your-server.com

# Proje dizinine git
cd /path/to/canban_frontend

# Değişiklikleri çek
git pull origin main

# Veya belirli bir branch
git pull origin production
```

**Seçenek B: Manuel Dosya Transferi**
```bash
# Lokal makineden sunucuya dosya gönder
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /path/to/local/canban_frontend/ \
  user@your-server.com:/path/to/canban_frontend/
```

---

### Adım 2: Veritabanı Migrasyonları

```bash
# Sunucuda proje dizininde
cd /path/to/canban_frontend

# Backend container'ına gir
docker compose -f docker-compose.prod.yml exec backend bash

# Migrasyonları çalıştır
python manage.py migrate

# Container'dan çık
exit
```

**Önemli**: Yeni migration dosyaları var mı kontrol et:
```bash
# Lokal makinede
ls backend/support/migrations/

# Eğer yeni migration varsa, sunucuda da olmalı
```

---

### Adım 3: Environment Değişkenlerini Kontrol Et

**BACKEND (.env veya backend/.env)**:
```bash
# Sunucuda
cd /path/to/canban_frontend

# Backend .env dosyasını kontrol et
cat backend/.env

# Gerekli değişkenler:
# - DATABASE_URL
# - REDIS_URL
# - SECRET_KEY
# - ALLOWED_HOSTS
# - CORS_ALLOWED_ORIGINS
```

**Yeni eklenmesi gerekenler (opsiyonel)**:
```bash
# backend/.env
CELERY_BEAT_ENABLED=true
```

**FRONTEND (.env - KRİTİK!)**:
```bash
# Frontend .env dosyasını kontrol et
cat .env

# MUTLAKA olması gereken:
VITE_API_BASE_URL=https://crm.udarsoft.com/api

# Eğer yoksa veya localhost:8000 yazıyorsa, düzelt:
echo "VITE_API_BASE_URL=https://crm.udarsoft.com/api" > .env
```

**NOT**: Frontend .env dosyası yoksa veya yanlış URL varsa, CORS hatası alırsınız!

---

### Adım 4: Docker Build ve Deploy

**Tüm servisleri yeniden build et:**
```bash
cd /path/to/canban_frontend

# Tüm servisleri durdur
docker compose -f docker-compose.prod.yml down

# Yeniden build et ve başlat
docker compose -f docker-compose.prod.yml up -d --build
```

**Sadece frontend'i build et:**
```bash
# Sadece frontend'i yeniden build et
docker compose -f docker-compose.prod.yml up -d --build frontend
```

**Sadece backend'i build et:**
```bash
# Sadece backend'i yeniden build et
docker compose -f docker-compose.prod.yml up -d --build backend
```

---

### Adım 5: Logları Kontrol Et

```bash
# Tüm servislerin loglarını izle
docker compose -f docker-compose.prod.yml logs -f

# Sadece frontend logları
docker compose -f docker-compose.prod.yml logs -f frontend

# Sadece backend logları
docker compose -f docker-compose.prod.yml logs -f backend

# Celery beat logları (yeni)
docker compose -f docker-compose.prod.yml logs -f celery_beat
```

**Kontrol edilmesi gerekenler:**
- ✅ Frontend build başarılı
- ✅ Backend başladı
- ✅ Database bağlantısı OK
- ✅ Redis bağlantısı OK
- ✅ Celery worker çalışıyor
- ✅ Celery beat çalışıyor (yeni)

---

### Adım 6: Servis Durumunu Kontrol Et

```bash
# Çalışan container'ları listele
docker compose -f docker-compose.prod.yml ps

# Beklenen çıktı:
# NAME                    STATUS
# backend                 Up
# frontend                Up
# db                      Up
# redis                   Up
# celery_worker           Up
# celery_beat             Up (yeni)
```

---

### Adım 7: Uygulama Testleri

**1. Frontend Erişim Testi**
```bash
# Tarayıcıda
https://your-domain.com

# Veya curl ile
curl -I https://your-domain.com
```

**2. Backend API Testi**
```bash
# Health check
curl https://your-domain.com/api/health/

# Auth test
curl https://your-domain.com/api/auth/me/
```

**3. Yeni Endpoint Testleri**
```bash
# Worker tracking (Admin token gerekli)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/tasks/worker-tracking/
```

**4. Frontend Özellikleri**
- ✅ Login yapabilme
- ✅ Sayfa yenileme sonrası veriler korunuyor mu
- ✅ Görev detay sayfası açılıyor mu
- ✅ Çalışan takip sayfası görünüyor mu (Admin)
- ✅ Worker self-handover çalışıyor mu

---

## 🔧 SORUN GİDERME

### Sorun 0: SSE Worker Timeout (KRİTİK!)

**Hata**: Backend loglarında `[CRITICAL] WORKER TIMEOUT` ve `/api/stream/` endpoint'i

**Açıklama**: Gunicorn sync worker'ları SSE endpoint'inde takılıyor ve 120 saniye sonra timeout oluyor.

**Çözüm 1: Gevent Worker Kullan (Önerilen)**:
```bash
# requirements.txt'e ekle
echo "gevent==24.2.1" >> backend/requirements.txt

# Dockerfile'da worker class'ı değiştir
# Şu satırı bul:
# CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000"]
# Şununla değiştir:
# CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--worker-class", "gevent", "--workers", "4"]

# Yeniden build et
docker compose -f docker-compose.prod.yml up -d --build backend
```

**Çözüm 2: SSE'yi Devre Dışı Bırak (Geçici)**:
```bash
# Frontend'de SSE'yi kapat
# src/state/use-app-store.ts içinde startSse fonksiyonunu boş return yap
# Veya SSE endpoint'ini nginx'de block et
```

**Kontrol**:
```bash
# Worker timeout hatası gitmeli
docker compose -f docker-compose.prod.yml logs backend | grep TIMEOUT
```

---

### Sorun 1: Frontend Build Hatası

**Hata**: `npm run build` başarısız

**Çözüm**:
```bash
# Frontend container'ına gir
docker compose -f docker-compose.prod.yml exec frontend sh

# Node modules'ü temizle
rm -rf node_modules package-lock.json

# Yeniden install
npm install

# Build dene
npm run build

# Container'dan çık
exit

# Container'ı yeniden başlat
docker compose -f docker-compose.prod.yml restart frontend
```

---

### Sorun 2: Database Migration Hatası

**Hata**: Migration uygulanamıyor

**Çözüm**:
```bash
# Backend container'ına gir
docker compose -f docker-compose.prod.yml exec backend bash

# Migration durumunu kontrol et
python manage.py showmigrations

# Fake migration (sadece gerekirse)
python manage.py migrate --fake support 0016

# Gerçek migration
python manage.py migrate

exit
```

---

### Sorun 3: Celery Beat Çalışmıyor

**Hata**: SLA otomasyonları çalışmıyor

**Çözüm**:
```bash
# Celery beat loglarını kontrol et
docker compose -f docker-compose.prod.yml logs celery_beat

# Celery beat'i yeniden başlat
docker compose -f docker-compose.prod.yml restart celery_beat

# Celery beat schedule'ı kontrol et
docker compose -f docker-compose.prod.yml exec celery_beat bash
python -c "from core.celery import app; print(app.conf.beat_schedule)"
exit
```

---

### Sorun 4: Static Files Yüklenmiyor

**Hata**: CSS/JS dosyaları 404

**Çözüm**:
```bash
# Backend container'ına gir
docker compose -f docker-compose.prod.yml exec backend bash

# Static files'ı topla
python manage.py collectstatic --noinput

exit

# Nginx'i yeniden başlat (varsa)
docker compose -f docker-compose.prod.yml restart nginx
```

---

### Sorun 5: CORS Hatası

**Hata**: Frontend backend'e istek atamıyor

**Çözüm**:
```bash
# backend/.env dosyasını düzenle
nano backend/.env

# Ekle/güncelle:
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Backend'i yeniden başlat
docker compose -f docker-compose.prod.yml restart backend
```

---

### Sorun 6: Yeni Kullanıcılar UI'da Görünmüyor

**Hata**: Database'de kullanıcılar var ama Settings sayfasında veya görev atama dropdown'larında görünmüyor

**Açıklama**: Zustand persist middleware eski kullanıcı listesini cache'lemiş

**Çözüm**:
```javascript
// Tarayıcı konsolunda (F12 > Console)
localStorage.removeItem('udar-app-storage')
// Sonra sayfayı yenile (F5)
```

**Kalıcı Çözüm**: Frontend'i yeniden build et (users/teams artık cache'lenmiyor):
```bash
docker compose -f docker-compose.prod.yml up -d --build frontend
```

**Kontrol**:
```bash
# Tarayıcı konsolunda
const state = JSON.parse(localStorage.getItem('udar-app-storage'))
console.log('Cached users:', state?.state?.data?.users)
// Boş array dönmeli: []
```

---

## 📊 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Lokal testler başarılı
- [ ] Git commit ve push yapıldı
- [ ] Database backup alındı
- [ ] Environment variables kontrol edildi
- [ ] Migration dosyaları hazır

### Deployment
- [ ] Kod sunucuya aktarıldı
- [ ] Database migration çalıştırıldı
- [ ] Docker build başarılı
- [ ] Tüm container'lar çalışıyor
- [ ] Loglar kontrol edildi

### Post-Deployment
- [ ] Frontend erişilebilir
- [ ] Backend API çalışıyor
- [ ] Login yapılabiliyor
- [ ] Yeni özellikler çalışıyor
- [ ] Celery beat aktif
- [ ] Monitoring kuruldu (opsiyonel)

---

## 🔄 ROLLBACK PLANI

Eğer bir sorun çıkarsa, eski versiyona dön:

```bash
# Git ile eski commit'e dön
git checkout PREVIOUS_COMMIT_HASH

# Docker'ı yeniden build et
docker compose -f docker-compose.prod.yml up -d --build

# Database'i restore et (gerekirse)
docker compose -f docker-compose.prod.yml exec db psql -U postgres -d dbname < backup.sql
```

---

## 📝 DEPLOYMENT KOMUTLARI (ÖZET)

### Hızlı Deployment (Tüm Servisler)
```bash
cd /path/to/canban_frontend
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml logs -f
```

### Sadece Frontend Güncellemesi
```bash
cd /path/to/canban_frontend
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build frontend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Sadece Backend Güncellemesi
```bash
cd /path/to/canban_frontend
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build backend
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 🎯 ÖNEMLİ NOTLAR

### 1. Database Backup
Her deployment öncesi mutlaka backup al:
```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres dbname > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Zero-Downtime Deployment
Eğer zero-downtime istiyorsan:
- Blue-green deployment kullan
- Load balancer arkasında 2 instance çalıştır
- Birini güncelle, test et, diğerini güncelle

### 3. Monitoring
Production'da mutlaka monitoring kur:
- Sentry (error tracking)
- Prometheus + Grafana (metrics)
- ELK Stack (log aggregation)

### 4. SSL Certificate
HTTPS için SSL certificate kontrol et:
```bash
# Let's Encrypt ile
certbot renew --dry-run
```

---

## 📞 DESTEK

Sorun yaşarsan:
1. Logları kontrol et
2. Bu dokümandaki sorun giderme bölümüne bak
3. GitHub issues'a yaz
4. Rollback yap (gerekirse)

---

**Hazırlayan**: Kiro AI  
**Tarih**: 26 Şubat 2026  
**Versiyon**: 1.0  
**Durum**: Production Ready 🚀
