/**
 * Excel teklif şablonlarında sabit görünen şirket bilgileri (TASLAKLAR analizi).
 * Satıcı kolonu seçimi bu kayıtlardan hangisinin «satışı yapan» olarak notlara yazılacağını belirler.
 */
export type InternalSellerKey = 'ortka' | 'ayka'

export interface InternalSellerProfile {
  key: InternalSellerKey
  /** Excel sol/C kolonu = ORTKA, sağ/K kolonu = AYKA */
  columnHint: 'C16–C19 (sol)' | 'K16–K19 (sağ)'
  title: string
  taxOfficeLine: string
  taxNoLine: string
  mailTelLine: string
}

export const INTERNAL_SELLERS: Record<InternalSellerKey, InternalSellerProfile> = {
  ortka: {
    key: 'ortka',
    columnHint: 'C16–C19 (sol)',
    title: 'ORTKA YAPI ELEMANLARI ÜRETİM SAN.LTD.ŞTİ',
    taxOfficeLine: 'VERGİ DAİRESİ : BEYDAĞI',
    taxNoLine: 'VERGİ NO: 6480365207',
    mailTelLine: 'MAİL/TEL: muhasebe@aykakapi.com.tr / 444 0 932',
  },
  ayka: {
    key: 'ayka',
    columnHint: 'K16–K19 (sağ)',
    title: 'AYKA KAPI SANAYİ TİCARET ANONİM ŞİRKETİ',
    taxOfficeLine: 'VERGİ DAİRESİ : BEYDAĞI',
    taxNoLine: 'VERGİ NO: 1210461108',
    mailTelLine: 'MAİL/TEL: muhasebe@aykakapi.com.tr / 444 0 932',
  },
}

/** Excel satır 31 «HAZIRLAYAN» hücrelerindeki isimler (tick ile işaretlenebilir anlamında). */
export const QUOTE_PREPARER_OPTIONS: { id: string; label: string }[] = [
  { id: 'tug', label: 'TUĞRUL MELİH TÜRKYILMAZ' },
  { id: 'fur', label: 'FURKAN NAİM BÜKER' },
  { id: 'mah', label: 'MAHMUT SAYAR' },
  { id: 'ube', label: 'UBEYDE SALKINI' },
  { id: 'vah', label: 'VAHAP DARDAN' },
  { id: 'yon', label: 'YÖNETİM' },
]

/** Excel satır 79–83 IBAN blokları özet (şablondaki sabit metin). */
export const IBAN_BLOCK_ORTKA = [
  'ORTKA YAPI ELEMANLARI ÜRETİM SAN.LTD.ŞTİ TL',
  'Türkiye İş Bankası TR24 0006 4000 0018 6003 9367 45',
  'Ziraat Bankası TR07 0001 0021 6935 0399 4450 09',
  'Albaraka Türk K.Bank TR66 0020 3000 0056 3735 0000 02',
  'Vakıflar Bankası TR57 0001 5001 5800 7284 2692 06',
].join('\n')

export const IBAN_BLOCK_AYKA = [
  'AYKA KAPI SANAYİ TİCARET ANONİM ŞİRKETİ TL',
  'Garanti BBVA Bankası TR14 0006 2000 1120 0006 2913 29',
  'Ziraat Bankası TR72 0001 0021 6994 2088 8850 01',
  'Albaraka Türk K.Bank. TR25 0020 3000 0770 5276 0000 01',
].join('\n')

export function formatSellerBlock(key: InternalSellerKey): string {
  const s = INTERNAL_SELLERS[key]
  return [s.title, s.taxOfficeLine, s.taxNoLine, s.mailTelLine, `(Excel ${s.columnHint})`].join('\n')
}
