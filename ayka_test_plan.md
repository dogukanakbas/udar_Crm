## Ayka Kapı Üretim Süreci Demo Senaryosu

Bu dosya, MDF girişinden ebatlama çıkışına kadar süreci sistemde uçtan uca kurgulamak için ayrıntılı adımları içerir. Adımlar sırasıyla uygulandığında görev akışları, ekip/kullanıcı atamaları, dosya ekleri, zaman takibi ve raporlama doğrulanmış olur.

---

### 1) Ön Hazırlık
- **Roller**: Admin, Supervisor/Planlama, Operatör (Worker), Kalite, Lojistik.
- **Ekipler (Team)**: Depo, MDF Dilimleme, Yarı Otomatik Hat, Tam Otomatik Hat, PWC Sarma, Vakum, Birleştirme, Pres, Ebatlama, Kalite.
- **Kullanıcılar**: Her ekip için 1–2 operatör (Worker), 1 Supervisor (görev açar/atar), 1 Kalite, 1 Lojistik. Kullanıcı oluştururken rol + ekip seç, sistemin ürettiği şifreyi not et.
- **Ürün/İş Emri**: “Ayka Kapı – Model X” (lot/seri no, adet, hedef teslim tarihi).

### 2) Temel Tanımlar
- **Ürün**: ERP/Ürünler sekmesinden “Ayka Kapı – Model X” oluştur.
- **İş Emri/Görev Grubu**: Lot/seri no, adet, hedef tarih bilgisini her görev notunda/referansında kullan.

### 3) Görev Aşamaları (iş akışı)
Aşağıdaki her adım için ayrı görev aç; ilgili ekibe ve operatöre ata; öncelik ve SLA son tarihlerini iş emri hedef tarihine göre ayarla.
1. Depo - MDF İnişi (stok alanına indirme)
2. MDF Dilimleme
3. Yarı Otomatik Hat (alt görevler: Yarı Otomatik #1, Yarı Otomatik #2)
4. Tam Otomatik Hat
5. PWC Sarma
6. Vakum Odası
7. Birleştirme
8. Pres
9. Ebatlama
10. Kalite Kontrol / Çıkış

### 4) Görev Oluşturma ve Atama
- Supervisor, her aşama için görev açar: başlıkta iş emri + adım adı; açıklamada lot/seri, adet, hedef tarih, özel talimat.
- **Team**: ilgili hat/istasyon ekibi.
- **Assignee**: o ekibin operatörü (Worker). Gerekirse “Owner” Supervisor kalır.
- **Öncelik**: Kritik istasyonlar (PWC, Vakum, Pres) için “yüksek”.
- **SLA**: Hedef tarih veya ara tarih (ör. dilimleme tamamlanma T0+1g).

### 5) Checklist / Alt Görevler (örnek)
- Depo: “MDF indirildi”, “Sayım yapıldı”, “Lot etiketi basıldı”
- Dilimleme: “Kesim planı yüklendi”, “İlk parça onayı”
- Yarı otomatik: “Makine 1 batch tamam”, “Makine 2 batch tamam”
- Tam otomatik: “Program yüklendi”, “Deneme parça OK”
- PWC: “Sarma tamam”, “Görsel kontrol”
- Vakum: “Basınç kaydı alındı”
- Birleştirme: “Aksesuar montajı”, “Ara kontrol”
- Pres: “Basınç/süre kaydı”
- Ebatlama: “Kesim listesi tamam”, “Kenar kontrol”
- Kalite: “Final kontrol”, “Sevk etiketi”

### 6) Dosya / Ekler
- Her görevde foto/PDF yükle (10MB sınır). Örnekler: pres basınç kaydı, kalite formu, görsel kontrol fotoğrafı.
- Aynı isimli dosyalarda versiyonlama otomatik; istersen yeniden adlandır veya açıklama ekle.
- Büyük dosya için chunked/presigned yükleme destekleniyor (10MB üstü parçalı).

### 7) Zaman Takibi
- Operatör görev başlarken “başlat”, biterken “durdur”. Kısa işler için manuel giriş serbest.
- Süreler raporlarda “planlanan vs gerçekleşen” için kullanılır.
- Görevlere `planlanan saat` ve `planlanan maliyet` alanlarını doldur (iş emri bazlı bütçe için).

### 8) Yorum / Mention / Bildirim
- Kritik notlarda `@supervisor`, kalite taleplerinde `@kalite` mention kullan.
- Durum değişimlerinde ve atamalarda sistem bildirim üretir; SLA yaklaşınca “due soon/overdue” uyarıları görünür.

### 9) Durum ve Kanban
- Durum akışı önerisi: `Beklemede` → `Devam` → `Kontrol` → `Tamam`.
- Kanban’da WIP limitlerini set et (özellikle PWC/Vakum/Pres).
- Quick edit ile öncelik/etiket güncellenebilir; filtreleri kaydet/yeniden yükle.

### 10) Workload ve Raporlar
- Workload görünümünden ekip ve kullanıcı bazlı yükü kontrol et.
- Raporlar: geciken görevler, throughput (tamamlanan/gün), ort. tamamlama süresi, planlanan vs gerçekleşen süre/maliyet.
- CSV export: Filtrelenmiş görev listesini dışa aktar.
- ICS: Takvim entegrasyonu için ICS URL’ini ayarlardan kopyala (tek yön feed).

### 11) Test Senaryosu (koşum sırası)
1. Ekipleri ve kullanıcıları oluştur (role + team).
2. Ürünü tanımla, iş emri bilgilerini hazırla.
3. 10 adımlık görevleri aç, team + assignee ata, öncelik/SLA ver.
4. Checklist’leri gir.
5. Her adımda: süre başlat/durdur, dosya yükle, durum güncelle, mention ile iletişim kur.
6. Yarı otomatik hat için iki alt görev aç ve her birini farklı operatöre ata.
7. Süreç sonunda Kalite görevinde final kontrolü ve çıkış etiketini doğrula.
8. Raporlardan gecikme, süre, throughput ve planlanan/gerçekleşen kıyasını kontrol et; CSV/ICS export al.

### 12) Beklenen Çıktılar
- Her adımın tamamlanma zamanı ve toplanan dosyalar görülür.
- SLA yaklaşan veya aşan adımlar uyarı verir.
- Planlanan vs gerçekleşen süre/maliyet kartları raporlanır.
- Operatörler sadece kendi görevlerini, Supervisor tüm hattı görür (RBAC).

---

Hızlı başlatmak için: önce ekip ve kullanıcıları tanımla, sonra 10 adımlık görevleri açıp atamaları yap, checklist ve SLA’ları gir. Ardından zaman/dosya/yorum akışı ile süreci işlet; en sonda raporları ve export’ları al. 


