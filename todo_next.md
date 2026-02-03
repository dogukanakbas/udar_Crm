# İş Takip / CRM geliştirme planı (detaylı)

## Yapıldı
- Checklist/alt görevler + tamamlanma yüzdesi (görev detayı)
- İş yükü görünümü (kullanıcı/ekip bazlı, filtrelerle)
- Takvim entegrasyonu (görevler + toplantı sekmeli görünüm)
- Rapor/KPI: geciken görev, throughput, ortalama tamamlanma süresi
- CSV dışa aktarım: görev listesi filtreli export

## Öncelik 1 (yüksek etki, düşük risk)
1) **Bildirim/mention + SLA uyarı**
   - @mention destekli yorum; atama/durum/SLA yaklaştı tetikleyicileri
   - Toast + opsiyonel e-posta; bildirim ayarları (sessize alma)
2) **Aktivite log / timeline birleşik görünüm**
   - Durum/alan değişikliği, yorum, ek, checklist hareketleri tek akışta
   - Filtre: sadece yorum / sadece sistem / hepsi
3) **Form doğrulama ve hata mesajları**
   - Zorunlu alan, tarih aralığı, SKU/benzersiz alan kontrolleri
   - Satır içi hata mesajı, submit bloklama
4) **Ek/medya iyileştirmesi**
   - Sürükle-bırak yükleme, çoklu önizleme, dosya boyut tipi kontrolü
   - Ek silme/yeniden adlandırma; presigned URL hazırlığı

## Öncelik 2 (kullanılabilirlik/artı değer)
5) **Kanban iyileştirme**
   - WIP limit, hızlı etiket/öncelik değişimi, sıralama/filtre kaydetme
6) **Görev şablonları**
   - Sık kullanılan checklist/alan setini şablon olarak kaydet-uygula
7) **Arama & kayıtlı filtreler**
   - Global arama içinde görev/ekip/yorum; sık filtreleri kaydet/çağır
8) **Medya/ek yönetimi gelişmiş**
   - Versiyonlama, etiketleme; büyük dosya için chunk/presigned altyapı

## Öncelik 3 (opsiyonel/ileri seviye)
9) **Takvim senkronizasyonu**
   - iCal/Google/Outlook export; tek yön push
10) **İş akışı otomasyonları**
    - Kural motoru: koşul -> aksiyon (ör. durum=done ⇒ bildirim+arşiv)
11) **Zaman takibi**
    - Start/stop kronometre, manuel giriş; raporu ve bütçe karşılaştırması
12) **RBAC ince ayarı**
    - İnce-granüler izin: yorum/ek silme, alan bazlı yetki; erişim logu

## Uygulama sırası (öneri)
- Sprint 1: (1) Bildirim/mention + SLA, (3) Form doğrulama
- Sprint 2: (2) Aktivite log birleşik, (4) Ek/medya iyileştirme
- Sprint 3: (5) Kanban WIP/quick edit, (6) Görev şablonları
- Sprint 4: (7) Arama & kayıtlı filtreler, (8) Medya gelişmiş
- Sprint 5: (9) Takvim sync, (10) Otomasyon, (11) Zaman takibi, (12) RBAC ince ayarı

