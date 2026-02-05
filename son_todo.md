[ ] Bildirim kanalları (Slack/SMTP ayar UI + sessize alma/kanal seçimi)
[ ] SLA ihlal/ısı haritası + liste (dashboard/görevler)
[ ] Aktivite log: durum/atama/SLA/etiket değişikliklerini timeline’a ekle, filtreler
[ ] Presigned upload + rename/sil/etiket/versiyon (ek/medya)
[ ] Kanban: hızlı etiket/öncelik değişimi iyileştirme, WIP metrik kartı
[ ] Görev şablonları kaydet/uygula (checklist + alan seti)
[ ] Global arama: görev/ekip/yorum + etiketli arama, sık filtre kaydet/çağır
[ ] Zaman takibi raporları (görev/ekip toplam, bütçe vs planlanan, export)
[ ] Otomasyon kütüphanesini genişlet (etiket ekle/alan set et/çoklu bildirim + yardım metinleri/test)
[ ] RBAC ince ayar: view-only/comment-only mod, yorum/ek silme granular politika
[ ] Operasyonel: health/bağımlılık kartı, compose prod örnek env, CI lint/test örneği



SLA ısı haritası/daha detaylı görünüm: sadece kart/listede sayım var; heatmap veya detay tablosu yok.
Zaman takibi raporlarını dışa aktarma ve daha fazla özet: kullanıcı/ekip kartları eklendi ama CSV/PDF export veya bütçe/planlanan karşılaştırması yok.
Otomasyon kütüphanesi genişletme: yeni aksiyon/koşul seti (çoklu bildirim, alan set, tag vb. kısmen var), kural yardım metni/test/önizleme eksik.
RBAC daha granüler: view-only modu (tam salt okunur) ve ek/yorum silme için rol/politika ekranı; comment-only prefs eklendi ama view-only yok.
Operasyonel: health kartı ve prod env örneği/CI örneği eklendi, fakat compose prod örnek dosyası (docker-compose.prod.yml) yok.
Presigned upload: tip/boyut filtreleri var; S3/MinIO gerçek presign entegrasyonu yapılmadı (şu an backend upload endpointi kullanılıyor).
Global arama: tip filtresi eklendi; etiketli arama var; yorum/ekip/görev mevcut; sık filtre kaydet var; ancak sonuç sayısı/paginasyon veya gelişmiş filtre yok.
SLA ihlal listesi var ama ısı haritası/rapor ekranı yok.