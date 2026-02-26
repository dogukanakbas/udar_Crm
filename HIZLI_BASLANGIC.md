# 🚀 Hızlı Başlangıç - Worker Self-Handover

## Değişiklikleri Aktif Etme

### 1. Backend'i Yeniden Başlat

```bash
# Docker kullanıyorsanız
docker-compose restart backend celery_worker

# Manuel çalıştırıyorsanız
cd backend
source .venv/bin/activate
python manage.py runserver
```

### 2. Frontend'i Yeniden Başlat

```bash
# Docker kullanıyorsanız
docker-compose restart frontend

# Manuel çalıştırıyorsanız
npm run dev
```

### 3. İzinleri Güncelle (Opsiyonel)

```bash
cd backend
source .venv/bin/activate
python manage.py seed_permissions
```

---

## 🎮 Kullanım

### Worker Olarak Bölüm Değişimi

1. **Login**: Worker hesabı ile giriş yap
2. **Görev Seç**: Size atanan bir görevi aç
3. **Devir Yap**:
   - "Hedef takım" dropdown'ından yeni ekibi seç
   - "Not" alanına sebep yaz (örn: "Depoda iş yok")
   - "🔄 Başka bölümde çalışıyorum" butonuna tıkla
4. **Sonuç**: Görev yeni ekibe devredilir, sizden kaldırılır

### Ekip Lideri Olarak Takip

1. **Görev Detayı**: Herhangi bir görevi aç
2. **Devir Geçmişi**: Sayfanın alt kısmında "Devir Geçmişi" bölümünü gör
3. **Filtrele**: "(kendi isteği)" etiketi olan kayıtlar worker'ın kendi devrettiği görevlerdir

---

## 🧪 Test Et

### API ile Test

```bash
# 1. Token al
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "worker1", "password": "password"}'

# 2. Self-handover yap
curl -X POST http://localhost:8000/api/tasks/1/self_handover/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"team": "2", "reason": "Depoda iş yok"}'

# 3. Görev detayını kontrol et
curl http://localhost:8000/api/tasks/1/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Frontend ile Test

1. http://localhost:5173 adresine git
2. Worker hesabı ile login ol (örn: `worker1 / password`)
3. Görevler sayfasına git
4. Kendine atanan bir görevi aç
5. "🔄 Başka bölümde çalışıyorum" butonunu test et

---

## ✅ Kontrol Listesi

- [ ] Backend yeniden başlatıldı
- [ ] Frontend yeniden başlatıldı
- [ ] Worker hesabı ile login yapıldı
- [ ] Self-handover butonu görünüyor
- [ ] Devir işlemi başarılı
- [ ] Devir geçmişi görüntüleniyor
- [ ] Ekip isimleri doğru gösteriliyor

---

## 🐛 Sorun Giderme

### "tasks.handover izni yok" Hatası

```bash
# İzinleri güncelle
cd backend
python manage.py seed_permissions
```

### "Hedef ekip bulunamadı" Hatası

- Ekip ID'sinin doğru olduğundan emin ol
- Ekip aynı organizasyonda olmalı

### Self-Handover Butonu Görünmüyor

- Worker rolünde olduğundan emin ol
- Görev size atanmış olmalı
- Sayfayı yenile (Ctrl+R)

### Devir Geçmişi Boş

- Görevde henüz devir yapılmamış olabilir
- Backend'de `handover_history` alanı dolu mu kontrol et

---

## 📞 Yardım

Sorun yaşıyorsanız:

1. **Backend Logları**: `docker-compose logs backend`
2. **Frontend Logları**: Tarayıcı Console (F12)
3. **API Dokümantasyonu**: http://localhost:8000/api/docs/

---

**Hazır!** Artık Worker'lar bağımsız olarak bölüm değişimi yapabilir. 🎉
