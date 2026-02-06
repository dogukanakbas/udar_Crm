## E2E Smoke (elle/otomatize)

1) Login (+OTP varsa)
   - Kullanıcı girişi yap, 2FA açık ise OTP kodunu gir.
   - Başarılı login sonrası dashboard’un yüklendiğini doğrula.

2) Görev oluştur
   - Tasks sayfasına git, yeni görev formunu aç.
   - Başlık/owner/assignee/status/priority/start/end/due alanlarını doldur.
   - Kaydet; listede görevi gör.

3) Görev güncelle + otomasyon tetikle
   - Durumu “done” yap.
   - SLA/notify otomasyonlarının (varsa) activity’de loglandığını ve SSE toast geldiğini doğrula.

4) Dosya ekle
   - Görev detayında ek yükle (PNG/PDF); listeye eklendiğini gör.

5) Global arama
   - Arama aç, q “task title” ile ara; görev sonuçlarında gör.
   - Sayfa/limit değiştir, sonuç güncelleniyor mu kontrol et.

6) SSE / bildirim
   - Ayrı sekmede aynı görevi güncelle (status/comment); açık sekmede SSE ile toast veya listede güncellemeyi gör.

Notlar:
- Script için Playwright/Cypress tercih edilebilir; adımlar UI seçicilerine göre uyarlanmalı.
- Login için API token/çerez reuse yerine form yoluyla git; OTP gerekiyorsa test kullanıcıya sabit secret tanımla.

