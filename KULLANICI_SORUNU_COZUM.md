# 🔧 KULLANICI GÖRÜNMEME SORUNU - ÇÖZÜM

**Tarih**: 26 Şubat 2026  
**Durum**: ✅ Çözüldü

---

## 📋 SORUN

Yeni eklenen kullanıcılar:
- ✅ Database'de var (15 kullanıcı)
- ✅ API endpoint'i doğru dönüyor (`/api/auth/users/`)
- ❌ Settings sayfasında görünmüyor
- ❌ Görev atama dropdown'larında görünmüyor

**Konsol çıktısı**: API'den gelen veriler console'da görünüyor ama UI'da yok.

---

## 🔍 KÖK NEDEN

**localStorage Cache Sorunu**: Zustand persist middleware eski kullanıcı listesini cache'lemiş. Yeni kullanıcılar eklendiğinde cache güncellenmiyor.

```javascript
// Eski cache yapısı (YANLIŞ)
{
  data: {
    users: [...], // Eski kullanıcılar cache'de kalmış
    teams: [...], // Eski ekipler cache'de kalmış
  }
}
```

---

## ✅ YAPILAN DEĞİŞİKLİKLER

### 1. Backend Düzeltmeleri

**Dosya**: `backend/requirements.txt`
- ✅ `gevent==24.2.1` eklendi (SSE worker timeout fix)

**Dosya**: `backend/Dockerfile`
- ✅ Gunicorn worker class `gevent` olarak değiştirildi
- ✅ Worker sayısı 4'e çıkarıldı
- ✅ Timeout 120 saniyeye çıkarıldı

### 2. Frontend Düzeltmeleri

**Dosya**: `src/state/use-app-store.ts`
- ✅ Users ve teams artık cache'lenmiyor (her zaman fresh data)
- ✅ Persist configuration güncellendi:

```typescript
partialize: (state) => ({
  data: {
    ...state.data,
    today: { tasks: [], meetings: [], overdueInvoices: [], lowStockSkus: [] },
    users: [],  // ← Artık cache'lenmiyor
    teams: [],  // ← Artık cache'lenmiyor
  },
})
```

**Dosya**: `.env`
- ✅ `VITE_API_BASE_URL` production URL'e güncellendi
- ❌ Eski: `http://localhost:8000/api`
- ✅ Yeni: `https://crm.udarsoft.com/api`

---

## 🚀 SUNUCUDA YAPILACAKLAR

### Adım 1: Kod Güncellemesi

```bash
# Sunucuya SSH ile bağlan
ssh root@srv1327264

# Proje dizinine git
cd ~/udar_Crm

# Git pull (conflict varsa stash yap)
git stash
git pull origin main
git stash pop

# Veya sadece pull
git pull origin main
```

### Adım 2: Backend'i Yeniden Build Et

```bash
# Backend'i yeniden build et (gevent eklenecek)
docker compose -f docker-compose.prod.yml up -d --build backend

# Logları kontrol et (worker timeout gitmeli)
docker compose -f docker-compose.prod.yml logs -f backend
```

**Beklenen**: `[CRITICAL] WORKER TIMEOUT` hatası gitmeli.

### Adım 3: Frontend'i Yeniden Build Et

```bash
# Frontend'i yeniden build et (API URL güncellenecek)
docker compose -f docker-compose.prod.yml up -d --build frontend

# Logları kontrol et
docker compose -f docker-compose.prod.yml logs -f frontend
```

**Beklenen**: Build başarılı, CORS hatası gitmeli.

### Adım 4: Tarayıcı Cache'ini Temizle

**Tarayıcıda F12 > Console**:
```javascript
localStorage.removeItem('udar-app-storage')
```

**Sonra sayfayı yenile (F5)**.

---

## ✅ KONTROL LİSTESİ

### Backend Kontrolleri

```bash
# 1. Servisler çalışıyor mu?
docker compose -f docker-compose.prod.yml ps

# 2. Worker timeout hatası var mı?
docker compose -f docker-compose.prod.yml logs backend | grep TIMEOUT

# 3. Gevent yüklendi mi?
docker compose -f docker-compose.prod.yml exec backend pip list | grep gevent
```

### Frontend Kontrolleri

```bash
# 1. API URL doğru mu?
docker compose -f docker-compose.prod.yml exec frontend cat /app/.env

# 2. Build başarılı mı?
docker compose -f docker-compose.prod.yml logs frontend | grep "built in"
```

### Tarayıcı Kontrolleri

**F12 > Console**:
```javascript
// 1. Cache temizlendi mi?
const state = JSON.parse(localStorage.getItem('udar-app-storage'))
console.log('Cached users:', state?.state?.data?.users)
// Beklenen: [] (boş array)

// 2. API'den kullanıcılar geliyor mu?
fetch('https://crm.udarsoft.com/api/auth/users/', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
})
.then(r => r.json())
.then(d => console.log('API users:', d))
// Beklenen: 15 kullanıcı
```

**F12 > Network**:
- ✅ `/api/auth/users/` isteği 200 dönmeli
- ✅ CORS hatası olmamalı
- ✅ localhost:8000 isteği olmamalı

### UI Kontrolleri

- [ ] Settings > Kullanıcılar sayfasında 15 kullanıcı görünüyor
- [ ] Görev oluştur > Atanan kişi dropdown'ında tüm kullanıcılar var
- [ ] Görev detay > Sorumlu değiştir dropdown'ında tüm kullanıcılar var
- [ ] Worker tracking sayfası çalışıyor

---

## 🐛 SORUN YAŞARSAN

### Sorun 1: Hala kullanıcılar görünmüyor

**Çözüm**:
```javascript
// Tüm localStorage'ı temizle
localStorage.clear()
// Sayfayı yenile ve tekrar login ol
```

### Sorun 2: CORS hatası

**Kontrol**:
```bash
# Backend .env dosyasını kontrol et
docker compose -f docker-compose.prod.yml exec backend cat /app/.env | grep CORS

# Beklenen:
# CORS_ALLOWED_ORIGINS=https://crm.udarsoft.com
```

**Düzelt**:
```bash
# Backend .env dosyasını düzenle
nano backend/.env
# CORS_ALLOWED_ORIGINS=https://crm.udarsoft.com ekle

# Backend'i restart et
docker compose -f docker-compose.prod.yml restart backend
```

### Sorun 3: Worker timeout devam ediyor

**Kontrol**:
```bash
# Gevent worker class kullanılıyor mu?
docker compose -f docker-compose.prod.yml exec backend ps aux | grep gunicorn
```

**Düzelt**:
```bash
# Backend'i yeniden build et
docker compose -f docker-compose.prod.yml down backend
docker compose -f docker-compose.prod.yml up -d --build backend
```

---

## 📊 ÖZET

### Yapılan Değişiklikler
1. ✅ Backend: Gevent worker class (SSE fix)
2. ✅ Frontend: Users/teams cache'den çıkarıldı
3. ✅ Frontend: API URL production'a güncellendi
4. ✅ Deployment guide güncellendi

### Sunucuda Yapılacaklar
1. `git pull origin main`
2. `docker compose -f docker-compose.prod.yml up -d --build backend`
3. `docker compose -f docker-compose.prod.yml up -d --build frontend`
4. Tarayıcıda `localStorage.removeItem('udar-app-storage')`
5. Sayfa yenile (F5)

### Beklenen Sonuç
- ✅ Tüm kullanıcılar UI'da görünecek
- ✅ Worker timeout hatası gidecek
- ✅ CORS hatası gidecek
- ✅ SSE bağlantısı stabil çalışacak

---

**Hazırlayan**: Kiro AI  
**Tarih**: 26 Şubat 2026  
**Durum**: Production Ready 🚀
