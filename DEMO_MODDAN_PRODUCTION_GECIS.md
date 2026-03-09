# 🚀 DEMO MODDAN PRODUCTION'A GEÇİŞ REHBERİ

**Tarih**: 26 Şubat 2026  
**Durum**: Production Hazırlık

---

## 📋 DEMO MOD NEDİR?

Demo mod, sistemde test ve geliştirme için kullanılan özelliklerdir:

### Demo Mod Özellikleri
1. **Demo Filigranı**: Sayfada "Udar_CRM_Demo" yazısı görünür
2. **Demo Kullanıcılar**: `admin@demo.com`, `sales@demo.com`, `finance@demo.com`
3. **Demo Organizasyon**: "Udar Demo" adlı test organizasyonu
4. **Demo Veriler**: Test müşterileri, ürünler, teklifler
5. **Demo Reset Butonu**: Tüm veriyi sıfırlama özelliği
6. **Login Sayfası**: "Demo kullanıcı: admin / password" yazısı

---

## ✅ PRODUCTION'A GEÇİŞ ADIMLARI

### 1. Frontend Değişiklikleri

#### A. Demo Filigranını Kaldır

**Dosya**: `src/components/app-shell.tsx` (satır ~137)

**Önce**:
```tsx
<div className={cn('min-h-screen bg-gradient-to-b from-background to-muted/30', 
  data.settings.demoWatermark && "relative before:content-['Udar_CRM_Demo'] ...")}>
```

**Sonra**:
```tsx
<div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
```

#### B. Demo Workspace Yazısını Değiştir

**Dosya**: `src/components/app-shell.tsx` (satır ~147)

**Önce**:
```tsx
<p className="text-base font-semibold">Demo Çalışma Alanı</p>
```

**Sonra**:
```tsx
<p className="text-base font-semibold">Udar CRM</p>
```

#### C. Login Sayfası Demo Yazısını Kaldır

**Dosya**: `src/pages/login.tsx` (satır ~71)

**Önce**:
```tsx
<p className="text-xs text-slate-500">Demo kullanıcı: admin / password</p>
```

**Sonra**:
```tsx
{/* Demo yazısı kaldırıldı */}
```

#### D. Settings Sayfası Demo Özelliklerini Kaldır

**Dosya**: `src/pages/settings.tsx`

**Kaldırılacaklar**:
1. "Demo verisini sıfırla" butonu (satır ~294)
2. "Demo filigranı" switch (satır ~354)
3. "Demo workspace bilgisini güncelle" yazısı (satır ~127)

#### E. User Menu Demo Özelliklerini Kaldır

**Dosya**: `src/components/app-shell.tsx` (satır ~354)

**Kaldırılacak**:
```tsx
<div className="flex items-center justify-between">
  <span className="text-sm">Demo filigranı</span>
  <Switch checked={data.settings.demoWatermark} onCheckedChange={toggleWatermark} />
</div>
```

#### F. State'ten Demo Özelliklerini Kaldır

**Dosya**: `src/state/use-app-store.ts`

**Kaldırılacaklar**:
1. `resetDemo` fonksiyonu
2. `toggleWatermark` fonksiyonu
3. `demoWatermark` state'i

#### G. Diğer Demo Yazıları

**Dosya**: `src/pages/erp.tsx` (satır ~440)
```tsx
// Kaldır: <Badge variant="outline">Demo</Badge>
```

**Dosya**: `src/pages/quotes.tsx` (satır ~107)
```tsx
// Değiştir: onClick={() => toast({ title: 'CSV indirildi (demo)' })}
// Şununla: onClick={() => toast({ title: 'CSV indirildi' })}
```

---

### 2. Backend Değişiklikleri

#### A. Demo Seed Command'ini Devre Dışı Bırak

**Dosya**: `backend/accounts/management/commands/seed_demo.py`

**Seçenek 1**: Dosyayı sil
```bash
rm backend/accounts/management/commands/seed_demo.py
```

**Seçenek 2**: Dosyayı yedekle
```bash
mv backend/accounts/management/commands/seed_demo.py backend/accounts/management/commands/seed_demo.py.backup
```

#### B. Demo Kullanıcıları Sil (Opsiyonel)

**Sunucuda Django shell**:
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from django.contrib.auth import get_user_model
User = get_user_model()

# Demo kullanıcıları sil
User.objects.filter(email__contains='@demo.com').delete()

# Veya sadece listele
demo_users = User.objects.filter(email__contains='@demo.com')
for u in demo_users:
    print(f"{u.id} - {u.email} - {u.role}")
```

#### C. Demo Organizasyonu Güncelle

**Django shell**:
```python
from organizations.models import Organization

# Demo organizasyonu bul
org = Organization.objects.get(code="UDAR")

# Adını değiştir
org.name = "Udar Şirket Adı"  # Gerçek şirket adı
org.save()
```

---

### 3. Environment Değişkenleri

#### A. Backend .env

**Dosya**: `backend/.env`

**Production ayarları**:
```bash
# Debug modunu kapat
DJANGO_DEBUG=False

# Güvenlik
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# Allowed hosts
ALLOWED_HOSTS=crm.udarsoft.com

# CORS
CORS_ALLOWED_ORIGINS=https://crm.udarsoft.com

# CSRF
CSRF_TRUSTED_ORIGINS=https://crm.udarsoft.com

# Secret key (güçlü bir key kullan)
DJANGO_SECRET_KEY=<güçlü-random-key>

# Password minimum length
PASSWORD_MIN_LENGTH=12
```

#### B. Frontend .env

**Dosya**: `.env`

**Production ayarları**:
```bash
VITE_API_BASE_URL=https://crm.udarsoft.com/api
```

---

### 4. Database Temizliği (Opsiyonel)

Eğer demo verilerini tamamen silmek istiyorsan:

```bash
# Sunucuda
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from crm.models import BusinessPartner, Quote, Lead, Opportunity
from erp.models import Product, SalesOrder
from support.models import Task, Ticket

# Demo verilerini sil (DİKKATLİ!)
BusinessPartner.objects.filter(name__contains="ACME").delete()
Quote.objects.filter(number__startswith="Q-1000").delete()
Product.objects.filter(sku__startswith="SKU-1000").delete()
SalesOrder.objects.filter(number__startswith="SO-1000").delete()

# Veya tüm verileri sil (ÇOK DİKKATLİ!)
# BusinessPartner.objects.all().delete()
# Quote.objects.all().delete()
# Task.objects.all().delete()
```

---

### 5. Güvenlik Ayarları

#### A. Güçlü Şifreler

Tüm kullanıcıların şifrelerini değiştir:

```python
from django.contrib.auth import get_user_model
User = get_user_model()

# Admin şifresini değiştir
admin = User.objects.get(username='admin@demo.com')
admin.set_password('YeniGüçlüŞifre123!')
admin.save()
```

#### B. Django Secret Key

Yeni bir secret key oluştur:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Backend `.env` dosyasına ekle:
```bash
DJANGO_SECRET_KEY=<yeni-key>
```

#### C. HTTPS Zorunlu

Nginx config'de HTTP'yi HTTPS'e yönlendir (zaten yapılmış olmalı).

---

### 6. Monitoring ve Logging

#### A. Sentry (Error Tracking)

**Backend**: `backend/requirements.txt`
```txt
sentry-sdk==1.40.0
```

**Backend**: `backend/core/settings.py`
```python
import sentry_sdk

sentry_sdk.init(
    dsn="https://your-sentry-dsn",
    environment="production",
)
```

#### B. Log Rotation

**Docker Compose**: `docker-compose.prod.yml`
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

### 7. Backup Stratejisi

#### A. Database Backup

**Cron job ekle** (günlük backup):
```bash
# Sunucuda
crontab -e

# Ekle:
0 2 * * * docker compose -f /root/udar_Crm/docker-compose.prod.yml exec -T db pg_dump -U postgres udar_crm > /root/backups/db_$(date +\%Y\%m\%d).sql
```

#### B. Media Files Backup

```bash
# Haftalık media backup
0 3 * * 0 tar -czf /root/backups/media_$(date +\%Y\%m\%d).tar.gz /root/udar_Crm/media/
```

---

## 📝 DEPLOYMENT CHECKLIST

### Pre-Production
- [ ] Frontend demo yazıları kaldırıldı
- [ ] Backend demo seed devre dışı
- [ ] Demo kullanıcılar silindi/güncellendi
- [ ] Organizasyon adı güncellendi
- [ ] Environment variables production'a ayarlandı
- [ ] Secret key değiştirildi
- [ ] Tüm şifreler güçlü şifrelerle değiştirildi
- [ ] HTTPS zorunlu
- [ ] Debug mode kapalı

### Production Deployment
- [ ] Git commit ve push
- [ ] Database backup alındı
- [ ] Frontend build
- [ ] Backend build
- [ ] Servisler restart edildi
- [ ] Health check başarılı
- [ ] Login test edildi
- [ ] Tüm özellikler çalışıyor

### Post-Production
- [ ] Monitoring kuruldu (Sentry)
- [ ] Log rotation aktif
- [ ] Backup cron job'ları çalışıyor
- [ ] SSL certificate geçerli
- [ ] Performance test yapıldı
- [ ] Kullanıcı eğitimi verildi

---

## 🔧 HIZLI DEMO KALDIRMA KOMUTU

Tüm değişiklikleri otomatik yapmak için:

```bash
# Frontend
cd ~/udar_Crm

# Demo yazılarını kaldır (manuel düzenleme gerekli)
# Yukarıdaki dosyaları tek tek düzenle

# Backend demo seed'i sil
rm backend/accounts/management/commands/seed_demo.py

# Build ve deploy
git add .
git commit -m "Remove demo mode, production ready"
git push origin main

# Sunucuda
cd ~/udar_Crm
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Backup**: Mutlaka production'a geçmeden önce tam backup al
2. **Test**: Staging ortamında önce test et
3. **Rollback**: Sorun çıkarsa geri dönüş planı hazır olsun
4. **Kullanıcılar**: Mevcut kullanıcılara bilgi ver
5. **Downtime**: Bakım penceresi planla (gece saatleri)

---

## 📞 DESTEK

Sorun yaşarsan:
1. Logları kontrol et: `docker compose -f docker-compose.prod.yml logs`
2. Database backup'tan geri dön
3. Rollback yap: `git checkout <previous-commit>`

---

**Hazırlayan**: Kiro AI  
**Tarih**: 26 Şubat 2026  
**Durum**: Production Hazırlık Rehberi 🚀
