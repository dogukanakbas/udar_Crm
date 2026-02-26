# 🧪 TEST SENARYOLARI - AYKA SİSTEMİ

**Tarih**: 26 Şubat 2026  
**Durum**: Frontend düzeltmeleri test rehberi

---

## 🚀 HIZLI BAŞLANGIÇ

### 1. Sistemi Başlat

```bash
# Docker ile başlat
docker compose up --build

# Tarayıcıda aç
http://localhost:5173
```

### 2. Test Kullanıcıları

| Kullanıcı | Şifre | Role | Test Amacı |
|-----------|-------|------|------------|
| admin | password | Admin | Tüm yetkiler |
| worker | password | Worker | Kısıtlı yetkiler |
| manager | password | Manager | Orta seviye yetkiler |

---

## ✅ TEST 1: SAYFA YENİLEME (Zustand Persist)

### Amaç
Sayfa yenilendiğinde verilerin korunduğunu test et

### Adımlar
1. `admin` / `password` ile login ol
2. Dashboard'a git
3. Görevler sayfasına git (`/tasks`)
4. Tarayıcıda **F5** bas (sayfa yenile)

### Beklenen Sonuç ✅
- ✅ Sayfa yenilenir
- ✅ Veriler korunur (görevler görünür)
- ✅ Login sayfasına dönmez
- ✅ Role bilgisi korunur

### Hatalı Durum ❌
- ❌ Login sayfasına yönlendirir
- ❌ Veriler kaybolur
- ❌ Boş sayfa görünür

---

## ✅ TEST 2: LOGIN KAYMASI (Loading State)

### Amaç
Login sonrası UI kaymasının olmadığını test et

### Adımlar
1. Logout ol (sağ üst menü)
2. Login sayfasına git
3. `admin` / `password` gir
4. "Giriş yap" butonuna tıkla
5. **Dikkatli izle**: Buton durumunu ve sayfa geçişini

### Beklenen Sonuç ✅
- ✅ Buton "Giriş yapılıyor..." olur
- ✅ Sonra "Yükleniyor..." olur
- ✅ Dashboard açılır
- ✅ Kayma/flickering yok
- ✅ Admin menüleri hemen görünür

### Hatalı Durum ❌
- ❌ Dashboard açılır ama menüler sonradan gelir
- ❌ Worker menüsü görünüp kaybolur
- ❌ Sayfa titreyerek yüklenir

---

## ✅ TEST 3: YETKİ HATASI (403 Handler)

### Amaç
Yetkisiz işlemlerde kullanıcının bilgilendirildiğini test et

### Adımlar
1. `worker` / `password` ile login ol
2. Tarayıcı console'u aç (F12)
3. Console'da şunu çalıştır:
```javascript
fetch('http://localhost:8000/api/partners/', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
})
```

### Beklenen Sonuç ✅
- ✅ Sağ üstte kırmızı toast görünür
- ✅ "Yetki Hatası" başlığı
- ✅ "Bu işlem için yetkiniz yok" mesajı

### Hatalı Durum ❌
- ❌ Hiçbir bildirim görünmez
- ❌ Console'da sadece hata görünür

---

## ✅ TEST 4: OPTİMİSTİK UPDATE ROLLBACK (Toast)

### Amaç
API hatası olunca kullanıcının bilgilendirildiğini test et

### Adımlar
1. `admin` / `password` ile login ol
2. Görevler sayfasına git (`/tasks`)
3. Bir görevi sürükle-bırak ile taşı (örn: "Yapılacak" → "Devam Ediyor")
4. **Hemen ardından** backend'i durdur:
```bash
# Başka terminalde
docker compose stop backend
```
5. Tekrar bir görevi taşımaya çalış

### Beklenen Sonuç ✅
- ✅ Görev önce taşınır (optimistic)
- ✅ Sonra eski yerine döner (rollback)
- ✅ Kırmızı toast görünür
- ✅ "Değişiklik Kaydedilemedi" mesajı

### Hatalı Durum ❌
- ❌ Görev taşınmış gibi görünür ama kaybolur
- ❌ Hiçbir bildirim görünmez
- ❌ Sayfa donup kalır

### Temizlik
```bash
# Backend'i tekrar başlat
docker compose start backend
```

---

## ✅ TEST 5: TOKEN REFRESH LOADING

### Amaç
Token yenilenirken kullanıcının bilgilendirildiğini test et

### Adımlar
1. `admin` / `password` ile login ol
2. Tarayıcı console'u aç (F12)
3. Console'da token'ı expire et:
```javascript
// Access token'ı sil (refresh tetiklemek için)
localStorage.setItem('access_token', 'invalid_token')
```
4. Herhangi bir işlem yap (örn: görev listesini yenile)

### Beklenen Sonuç ✅
- ✅ "Oturum yenileniyor..." toast görünür
- ✅ Toast kısa süre sonra kaybolur
- ✅ İşlem başarılı olur
- ✅ Login sayfasına dönmez

### Hatalı Durum ❌
- ❌ Hiçbir bildirim görünmez
- ❌ Sayfa donup kalır
- ❌ Login sayfasına yönlendirir

---

## ✅ TEST 6: SSE RECONNECT

### Amaç
SSE bağlantısı kopunca otomatik yeniden bağlandığını test et

### Adımlar
1. `admin` / `password` ile login ol
2. Tarayıcı console'u aç (F12)
3. Network tab'ına git
4. "stream" isteğini bul (EventSource)
5. Backend'i durdur:
```bash
docker compose stop backend
```
6. Console'da "SSE error" mesajlarını izle
7. 10 saniye bekle
8. Backend'i başlat:
```bash
docker compose start backend
```

### Beklenen Sonuç ✅
- ✅ Console'da "SSE error" görünür
- ✅ "SSE reconnecting in Xms" mesajları görünür
- ✅ Backend başlayınca "SSE connected" görünür
- ✅ Otomatik yeniden bağlanır

### Hatalı Durum ❌
- ❌ Reconnect denemeleri görünmez
- ❌ Backend başlayınca bağlanmaz
- ❌ Sayfa yenilemeden bağlanmaz

---

## ✅ TEST 7: VIEW-ONLY FORM GUARD

### Amaç
Yetkisiz kullanıcıların form submit edemediğini test et

### Not
Bu özellik şu an sadece component olarak hazır, sayfalarda henüz kullanılmıyor. Manuel test için:

### Adımlar
1. `src/pages/tasks.tsx` dosyasını aç
2. Bir form'u `RbacFormGuard` ile sar:
```tsx
import { RbacFormGuard } from '@/components/rbac'

<RbacFormGuard perm="tasks.edit">
  <form onSubmit={handleSubmit}>
    {/* form fields */}
  </form>
</RbacFormGuard>
```
3. `worker` / `password` ile login ol
4. Görev oluşturma formunu aç

### Beklenen Sonuç ✅
- ✅ Form disabled görünür
- ✅ "Bu işlem için yetkiniz yok" mesajı
- ✅ Submit butonu tıklanamaz

### Hatalı Durum ❌
- ❌ Form normal görünür
- ❌ Submit edilebilir

---

## ✅ TEST 8: ROUTE CHANGE HYDRATION

### Amaç
Sayfa geçişlerinde verilerin güncellendiğini test et

### Adımlar
1. `admin` / `password` ile login ol
2. Görevler sayfasına git (`/tasks`)
3. Bir görevin detayına git (görev kartına tıkla)
4. Tarayıcı console'u aç (F12)
5. Network tab'ına git
6. Dashboard'a dön (sol menüden)
7. Network tab'ında API isteklerini izle

### Beklenen Sonuç ✅
- ✅ Her sayfa geçişinde API istekleri görünür
- ✅ `/auth/me/` çağrılır
- ✅ `/tasks/` çağrılır
- ✅ Veriler güncellenir

### Hatalı Durum ❌
- ❌ Sayfa geçişinde API çağrısı yok
- ❌ Eski veriler görünür
- ❌ Sadece ilk yüklemede API çağrılır

---

## 🎯 WORKER SELF-HANDOVER TESTİ

### Amaç
Worker'ın görevi başka departmana aktarabildiğini test et

### Adımlar
1. `worker` / `password` ile login ol
2. Görevler sayfasına git (`/tasks`)
3. Bir görev kartına tıkla (detay sayfası)
4. "🔄 Başka bölümde çalışıyorum" butonunu bul
5. Butona tıkla
6. Hedef departmanı seç (örn: "Üretim")
7. "Aktar" butonuna tıkla

### Beklenen Sonuç ✅
- ✅ Modal açılır
- ✅ Departman seçilebilir
- ✅ Aktarım başarılı mesajı
- ✅ Görev geçmişinde "Self-handover" kaydı
- ✅ Görev yeni departmana atanır

### Hatalı Durum ❌
- ❌ Buton görünmez
- ❌ Modal açılmaz
- ❌ Aktarım başarısız
- ❌ Geçmişte kayıt yok

---

## 🔥 STRES TESTLERİ

### Test 1: Hızlı Sayfa Yenileme
1. Login ol
2. 5 saniyede 10 kez F5 bas
3. **Beklenen**: Veriler korunur, crash olmaz

### Test 2: Çoklu Tab
1. Login ol
2. Aynı sayfayı 3 tab'da aç
3. Bir tab'da logout ol
4. **Beklenen**: Diğer tab'lar da logout olur

### Test 3: Offline/Online
1. Login ol
2. İnternet bağlantısını kes
3. Bir işlem yap
4. **Beklenen**: Hata mesajı görünür
5. İnternet bağlantısını aç
6. **Beklenen**: Otomatik düzelir

---

## 📊 TEST SONUÇLARI TABLOSU

| Test | Durum | Notlar |
|------|-------|--------|
| 1. Sayfa Yenileme | ⬜ | |
| 2. Login Kayması | ⬜ | |
| 3. Yetki Hatası | ⬜ | |
| 4. Optimistic Update | ⬜ | |
| 5. Token Refresh | ⬜ | |
| 6. SSE Reconnect | ⬜ | |
| 7. View-Only Guard | ⬜ | |
| 8. Route Hydration | ⬜ | |
| 9. Worker Handover | ⬜ | |

**Notasyon:**
- ⬜ Test edilmedi
- ✅ Başarılı
- ❌ Başarısız
- ⚠️ Kısmen başarılı

---

## 🐛 HATA BULURSAN

### 1. Console Hatalarını Kontrol Et
```
F12 → Console tab
```

### 2. Network İsteklerini Kontrol Et
```
F12 → Network tab
```

### 3. Backend Loglarını Kontrol Et
```bash
docker compose logs backend -f
```

### 4. Frontend Loglarını Kontrol Et
```bash
docker compose logs frontend -f
```

---

## 💡 HIZLI İPUÇLARI

### LocalStorage Temizle
```javascript
// Console'da
localStorage.clear()
location.reload()
```

### Token'ları Kontrol Et
```javascript
// Console'da
console.log('Access:', localStorage.getItem('access_token'))
console.log('Refresh:', localStorage.getItem('refresh_token'))
```

### State'i Kontrol Et
```javascript
// Console'da
console.log('State:', JSON.parse(localStorage.getItem('udar-app-storage')))
```

### SSE Durumunu Kontrol Et
```javascript
// Console'da - Network tab'ında "stream" isteğini bul
// Status: "pending" ise bağlı
// Status: "failed" ise kopuk
```

---

## 🎯 ÖNCELİKLİ TESTLER

Zamanın kısıtlıysa, bu testleri mutlaka yap:

1. ✅ **Test 1**: Sayfa Yenileme (en kritik)
2. ✅ **Test 2**: Login Kayması (UX için önemli)
3. ✅ **Test 4**: Optimistic Update (veri bütünlüğü)
4. ✅ **Test 9**: Worker Handover (yeni özellik)

---

## 📝 TEST RAPORU ŞABLONU

Test tamamladıktan sonra:

```
# Test Raporu - [Tarih]

## Başarılı Testler
- Test 1: Sayfa Yenileme ✅
- Test 2: Login Kayması ✅
...

## Başarısız Testler
- Test X: [Açıklama] ❌
  - Hata: [Detay]
  - Adımlar: [Nasıl tekrarlanır]

## Notlar
- [Genel gözlemler]
```

---

**Hazırlayan**: Kiro AI  
**Tarih**: 26 Şubat 2026  
**Versiyon**: 1.0  
**Durum**: Test için hazır 🧪
