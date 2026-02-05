## Yapılacaklar (Görev Takip Sistemi ve UX iyileştirmeleri)

1) Girişte hard refresh ihtiyacını kaldır
   - Login sonrası `/auth/me/` rolünü state’e yaz, nav’ı yeniden hesapla
   - Token geçersizse otomatik temizle ve login’e yönlendir

2) Gerçek zamanlı bildirimler
   - Atama, yorum, durum değişikliği için websocket/SSE
   - UI’da toast/indicator

3) Erişim kısıtları ve rol iyileştirme
   - “view-only/comment-only” mod
   - Alan bazlı yetki (örn. due date değişimi)

4) WIP/SLA metrikleri
   - Ekip bazlı WIP limit uyarısı
   - SLA ihlal listesi, gecikme ısı haritası

5) Operatör/mobil modu
   - Sade ekran: sadece kendi görevleri, büyük butonlar, offline queue

6) Arama/filtre iyileştirmeleri
   - Çoklu tag/durum filtresi, kayıtlı görünümler, paylaşılabilir link

7) Raporlama
   - Görev yaşlanma analizi, cycle time histogram, ekip throughput
   - PDF/Excel export

8) Yorum + ek tek API
   - Yorum gönderirken dosya ekini aynı çağrıda yükle

9) Bildirim kanalları
   - Slack/webhook ve gerçek SMTP (stub yerine)

10) Zaman takibi/bütçe
    - Bütçe karşılaştırma, eşik uyarısı

11) Otomasyon
    - Kural test/önizleme, kopyala/klonla

12) Kanban UX
    - Sürükle-bırak sonrası optimistic update, hata rollback


