import * as XLSX from 'xlsx'

import type { Company } from '@/types'

const buildCountRows = (title: string, values: string[]) => {
  const counts = values.reduce<Map<string, number>>((accumulator, value) => {
    const normalizedValue = value.trim() || 'Belirtilmemiş'
    accumulator.set(normalizedValue, (accumulator.get(normalizedValue) || 0) + 1)
    return accumulator
  }, new Map())

  const rows = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
  return [[title, 'Adet'], ...rows]
}

export function downloadCompaniesAsXlsx(companies: Company[]) {
  const workbook = XLSX.utils.book_new()

  const companyRows = companies.map((company) => ({
    ID: company.id,
    Şirket: company.name || '',
    Sektör: company.industry || '',
    Yetkili: company.authorizedPerson || '',
    Sahip: company.owner || '',
    Ölçek: company.size || '',
    Ülke: company.country || '',
    Şehir: company.region || '',
    Adres: company.address || '',
    'Vergi Dairesi': company.taxOffice || '',
    'Vergi No': company.taxNumber || '',
    Telefon: company.phone || '',
    'E-posta': company.email || '',
    'Para Birimi': company.currency || '',
    'Yıllık Ciro': Number(company.annualRevenue || 0),
    Puan: Number(company.rating || 0),
  }))

  const companySheet = XLSX.utils.json_to_sheet(companyRows)
  companySheet['!cols'] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 36 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(workbook, companySheet, 'Şirketler')

  const breakdownSheet = XLSX.utils.aoa_to_sheet([
    ['Şirket kırılımları'],
    [],
    ...buildCountRows(
      'Sektöre göre dağılım',
      companies.map((company) => company.industry || '')
    ),
    [],
    ...buildCountRows(
      'Ülkeye göre dağılım',
      companies.map((company) => company.country || '')
    ),
    [],
    ...buildCountRows(
      'Şehre göre dağılım',
      companies.map((company) => company.region || '')
    ),
    [],
    ...buildCountRows(
      'Ölçeğe göre dağılım',
      companies.map((company) => company.size || '')
    ),
    [],
    ...buildCountRows(
      'Para birimine göre dağılım',
      companies.map((company) => company.currency || '')
    ),
  ])
  breakdownSheet['!cols'] = [{ wch: 28 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'Kırılımlar')

  const fileDate = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `sirketler_${fileDate}.xlsx`)
}
