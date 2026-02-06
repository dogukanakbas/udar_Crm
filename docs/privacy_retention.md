# Privacy & Retention Playbook (Özet)

## PII Maskeleme
- Günlükler: Kullanıcı e-posta/ad soyad/IP gibi PII alanlarını log yazmadan önce maskele (regex veya allowlist).
- Destek/yorum alanları: Export veya raporlarda PII içerebilecek serbest metni paylaşırken rol bazlı filtre uygula.
- Screenshot/redaction: Destek ekibi ekran görüntüsü paylaşırken PII’yi karart.

## Retention / Purge
- Kullanıcı talebi (right to erasure): Account soft-delete + ilişkili kişisel verilerin (email, isim) tokenize/maskelenmesi; audit loglarda ID bırak.
- Operasyonel retention: Uygulama logları (7-30 gün), audit log (90-180 gün), job/beat log (7 gün) – ihtiyaç ve regülasyona göre ayarlanır.
- Yedekler: Backup saklama süresi (örn. 14/30/90 gün); süre sonunda otomatik sil; şifreli sakla.

## Gizlilik Bildirimi
- Hangi veriler toplanıyor: kimlik (email/ad), aktivite logu, görev/yorum içerikleri, IP/UA (güvenlik).
- Amaçlar: kimlik doğrulama, ürün işlevi (görev/CRM), güvenlik/denetim, destek.
- Üçüncü taraflar: e-posta sağlayıcı (SMTP), Slack webhook (isteğe bağlı), S3/MinIO dosya depolama.
- Kullanıcı hakları: veri erişim, düzeltme, silme talebi; destek kanalına yönlendirme.

## Teknik Notlar
- Config: Log redaksiyonunu merkezi middleware ile yap (örn. request/response body’de e-posta/telefon maskesi).
- Export/rapor: CSV/PDF dışa aktarımda rol/izin kontrolü; PII mask opsiyonu.
- Presign: Obje adlarında PII kullanılmaz; random UUID kullanılır (mevcut).

