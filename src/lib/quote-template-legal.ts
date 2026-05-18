/** Excel «GENEL ŞARTLAR & TEKLİF NOTLARI» ile uyumlu sabit paragraflar (çoğunlukla KDV %20 şablonları). */
export const ERP_BOILERPLATE_TR = `Bu teklif, firmamızın Mikro ERP MRP II üretim, maliyetlendirme ve stok yönetim sistemi esas alınarak hazırlanmıştır. Onaylanan siparişler sistem üzerinden üretim iş emrine dönüştürülebilir.`

export const STANDARD_QUOTE_TERMS_KDV20_TR = [
  '1 — Belirtilen fiyatlara KDV hariçtir.',
  '2 — İşbu teklif, düzenleme tarihinden itibaren seçilen gün geçerlilik süresi kadar geçerlidir.',
  '3 — Ürün ölçü ve model onayı müşteri tarafından teyit edilmeden üretime başlanmaz.',
  '4 — Ödeme şartları teklif üzerinde belirtilen şekilde uygulanacaktır.',
  '5 — Montaj ve teslim süreleri (varsa) sipariş onayı ve ödeme planına göre planlanacaktır.',
]

export const STANDARD_QUOTE_NOTES_COLUMN_TR = [
  '1 — Ölçüler net ölçü üzerinden değerlendirilmiştir.',
  '2 — Üretim öncesi teyit alınacaktır.',
]

/** Mobilya teklif şablonu (KDV %10 bölümleri) için aynı yapıdaki metinler */
export const STANDARD_QUOTE_TERMS_KDV10_TR = [
  '1 — Belirtilen fiyatlara KDV hariçtir.',
  '2 — İşbu teklif, düzenleme tarihinden itibaren seçilen gün geçerlilik süresi kadar geçerlidir.',
  '3 — Ürün ölçü ve model onayı müşteri tarafından teyit edilmeden üretime başlanmaz.',
  '4 — Ödeme şartları teklif üzerinde belirtilen şekilde uygulanacaktır.',
  '5 — Montaj ve teslim süreleri (varsa) sipariş onayı ve ödeme planına göre planlanacaktır.',
]

export function formatTermsBlock(lines: string[], title: string): string {
  return [title, ...lines.map((l) => `• ${l}`)].join('\n')
}
