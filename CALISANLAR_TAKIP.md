# 👥 ÇALIŞAN TAKİP SİSTEMİ

**Tarih**: 26 Şubat 2026  
**Durum**: ✅ Tamamlandı

---

## 🎯 ÖZELLİK AÇIKLAMASI

Admin ve Manager'lar, çalışanların hangi departmanda çalıştığını gerçek zamanlı olarak takip edebilir.

### Senaryo Örneği

1. **Depo Görevlisi** (Worker):
   - Ana ekibi: "Depo"
   - Depoda işi yok
   - Kaplama departmanına yardıma gidiyor
   - Görev detayında "🔄 Başka bölümde çalışıyorum" butonuna tıklıyor
   - "Kaplama" departmanını seçiyor
   - Sebep: "Depoda iş yok, kaplama yoğun"

2. **Admin/Manager**:
   - "Çalışan Takibi" sayfasını açıyor
   - Depo görevlisinin "Kaplama" departmanında çalıştığını görüyor
   - Son departman değişimini görüyor
   - Hangi sebepten değiştiğini görüyor
   - Kaç aktif görevi olduğunu görüyor

---

## 🚀 NASIL KULLANILIR

### Worker (Çalışan) Tarafı

1. Görevler sayfasına git (`/tasks`)
2. Bir görev kartına tıkla (detay sayfası)
3. "🔄 Başka bölümde çalışıyorum" butonunu bul
4. Butona tıkla
5. Hedef departmanı seç
6. Sebep yaz (örn: "Depoda iş yok")
7. "Aktar" butonuna tıkla

**Sonuç:**
- Görev yeni departmana atanır
- Görev geçmişine kaydedilir
- Admin/Manager takip edebilir

### Admin/Manager Tarafı

1. Sol menüden "Çalışan Takibi" sayfasına git
2. Tüm çalışanları ve durumlarını gör:
   - Ana ekibi
   - Şu an çalıştığı departman
   - Aktif görev sayısı
   - Son aktivite zamanı
   - Son departman değişimi

**Özellikler:**
- Otomatik 30 saniyede bir güncellenir
- Manuel yenileme butonu
- Departman değişimi olanlar turuncu işaretli
- Aktif görevli olanlar yeşil işaretli

---

## 📊 EKRAN GÖRÜNTÜLERİ

### Çalışan Takibi Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ Çalışan Takibi                    Son güncelleme: 14:30:25  │
│ Çalışanların hangi departmanda çalıştığını takip edin       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Toplam       │  │ Aktif        │  │ Departman    │     │
│  │ Çalışan      │  │ Görevli      │  │ Değişimi     │     │
│  │     15       │  │     12       │  │      3       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Çalışan    │ Ana Ekip │ Şu An Çalıştığı │ Aktif │ Son     │
│            │          │ Departman       │ Görev │ Değişim │
├─────────────────────────────────────────────────────────────┤
│ Ali Yılmaz │ Depo     │ Kaplama 🔄      │ 2     │ Depo →  │
│ ali@...    │          │                 │       │ Kaplama │
│            │          │                 │       │ 14:25   │
├─────────────────────────────────────────────────────────────┤
│ Ayşe Kaya  │ Üretim   │ Üretim          │ 5     │ -       │
│ ayse@...   │          │                 │       │         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 TEKNİK DETAYLAR

### Backend Endpoint

**URL**: `GET /api/tasks/worker-tracking/`

**Yetki**: Sadece Admin ve Manager

**Response**:
```json
{
  "workers": [
    {
      "worker_id": 5,
      "worker_name": "ali",
      "worker_email": "ali@example.com",
      "primary_teams": ["Depo"],
      "current_department": "Kaplama",
      "active_tasks_count": 2,
      "last_handover": {
        "from_team_name": "Depo",
        "to_team_name": "Kaplama",
        "by": "ali",
        "note": "Depoda iş yok",
        "at": "2026-02-26T14:25:00Z"
      },
      "last_activity": "2026-02-26T14:30:00Z"
    }
  ],
  "total_workers": 15,
  "timestamp": "2026-02-26T14:30:25Z"
}
```

### Frontend Sayfası

**Dosya**: `src/pages/worker-tracking.tsx`

**Route**: `/worker-tracking`

**Özellikler**:
- Otomatik 30 saniyede bir güncellenir
- Manuel yenileme butonu
- RBAC guard (sadece Admin/Manager)
- Responsive tasarım
- Loading ve error state'leri

### Veritabanı Alanları

**Task Model**:
- `current_team`: Şu an çalıştığı departman
- `handover_history`: Departman değişim geçmişi (JSON)
- `handover_reason`: Son değişim sebebi
- `handover_at`: Son değişim zamanı

**Handover History Format**:
```json
[
  {
    "from_team": 1,
    "from_team_name": "Depo",
    "to_team": 2,
    "to_team_name": "Kaplama",
    "by": "ali",
    "note": "Depoda iş yok",
    "type": "self-initiated",
    "at": "2026-02-26T14:25:00Z"
  }
]
```

---

## 📋 KULLANIM SENARYOLARI

### Senaryo 1: Depo Görevlisi Kaplama'ya Geçiyor

1. Ali (Depo görevlisi) depoda işi bitirdi
2. Kaplama departmanı yoğun, yardıma gidiyor
3. Görev detayında "🔄 Başka bölümde çalışıyorum" tıklıyor
4. "Kaplama" seçiyor, sebep: "Depoda iş yok, kaplama yoğun"
5. Admin dashboard'da Ali'nin Kaplama'da çalıştığını görüyor
6. Ali'nin kaç saat Kaplama'da çalıştığını takip edebiliyor

### Senaryo 2: Üretim Görevlisi Montaj'a Geçiyor

1. Ayşe (Üretim görevlisi) üretim hattında sorun var
2. Montaj departmanına geçici olarak geçiyor
3. Self-handover yapıyor
4. Manager montaj departmanının kaç kişi olduğunu görüyor
5. Kaynak planlaması yapabiliyor

### Senaryo 3: Çoklu Departman Değişimi

1. Mehmet sabah Depo'da başlıyor
2. Öğlen Kaplama'ya geçiyor
3. Akşam Montaj'a geçiyor
4. Admin tüm geçmişi görebiliyor
5. Mehmet'in hangi departmanlarda ne kadar zaman harcadığını analiz edebiliyor

---

## 🎯 FAYDALARI

### İşletme İçin

1. **Kaynak Optimizasyonu**
   - Hangi departman yoğun, hangi departman boş
   - Çalışanları dinamik olarak yönlendirebilme

2. **Şeffaflık**
   - Çalışanların nerede olduğunu bilme
   - Departmanlar arası yardımlaşmayı görme

3. **Raporlama**
   - Hangi departman ne kadar destek alıyor
   - Çalışanların esnekliğini ölçme

### Çalışan İçin

1. **Özerklik**
   - Kendi kararını verebilme
   - Yöneticiye sormadan departman değiştirebilme

2. **Kayıt**
   - Hangi departmanlarda çalıştığının kaydı
   - Performans değerlendirmesinde kullanılabilir

3. **İletişim**
   - Nerede olduğunu bildirme
   - Yöneticinin takip edebilmesi

---

## 🔍 RAPORLAMA ÖRNEKLERİ

### Günlük Rapor

```
Tarih: 26 Şubat 2026

Departman Değişimleri:
- Ali: Depo → Kaplama (14:25)
- Mehmet: Üretim → Montaj (15:30)
- Fatma: Kaplama → Depo (16:00)

En Çok Destek Alan Departman: Kaplama (2 kişi)
En Çok Destek Veren Departman: Depo (2 kişi)
```

### Haftalık Rapor

```
Hafta: 24-28 Şubat 2026

Toplam Departman Değişimi: 15
Ortalama Değişim/Gün: 3

En Esnek Çalışan: Ali (5 değişim)
En Çok Destek Alan Departman: Kaplama
```

---

## 🧪 TEST SENARYOSU

### Test 1: Worker Self-Handover

1. `worker` / `password` ile login ol
2. Görevler sayfasına git
3. Bir görev kartına tıkla
4. "🔄 Başka bölümde çalışıyorum" butonunu bul
5. Butona tıkla
6. Hedef departmanı seç
7. Sebep yaz
8. "Aktar" butonuna tıkla

**Beklenen**: ✅ Başarılı mesajı, görev geçmişinde kayıt

### Test 2: Admin Tracking

1. `admin` / `password` ile login ol
2. Sol menüden "Çalışan Takibi" sayfasına git
3. Worker'ın yeni departmanını gör
4. Son departman değişimini gör
5. "🔄 Yenile" butonuna tıkla

**Beklenen**: ✅ Güncel veriler, departman değişimi görünür

### Test 3: Otomatik Güncelleme

1. Admin olarak "Çalışan Takibi" sayfasını aç
2. Başka bir tarayıcıda worker olarak login ol
3. Worker departman değiştir
4. Admin sayfasında 30 saniye bekle

**Beklenen**: ✅ Otomatik güncellenir, yeni departman görünür

---

## 📝 NOTLAR

### Önemli

- Worker sadece kendi görevlerini aktarabilir
- Admin/Manager tüm çalışanları görebilir
- Departman değişimi görev geçmişine kaydedilir
- Otomatik güncelleme 30 saniyede bir

### Gelecek İyileştirmeler

- [ ] Departman bazlı filtreleme
- [ ] Tarih aralığı filtreleme
- [ ] Excel export
- [ ] Grafik görünümü
- [ ] Bildirim sistemi (departman değişiminde)
- [ ] Zaman bazlı analiz (kaç saat hangi departmanda)

---

## 🎉 SONUÇ

Çalışan takip sistemi başarıyla eklendi! Admin ve Manager'lar artık çalışanların hangi departmanda çalıştığını gerçek zamanlı olarak takip edebilir.

**Özellikler:**
- ✅ Worker self-handover
- ✅ Admin/Manager tracking dashboard
- ✅ Gerçek zamanlı güncelleme
- ✅ Departman değişim geçmişi
- ✅ Aktif görev sayısı
- ✅ Son aktivite zamanı

**Dosyalar:**
- Backend: `backend/support/views.py` (worker-tracking endpoint)
- Frontend: `src/pages/worker-tracking.tsx`
- Router: `src/router.tsx`
- Menu: `src/components/app-shell.tsx`

---

**Hazırlayan**: Kiro AI  
**Tarih**: 26 Şubat 2026  
**Versiyon**: 1.0  
**Durum**: ✅ Production Ready 🚀
