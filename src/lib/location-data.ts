import * as countries from 'i18n-iso-countries'

import { TURKEY_CITY_NAMES } from '@/data/turkey-cities'
import { normalizeSearchText } from '@/lib/utils'

export const DEFAULT_COMPANY_COUNTRY_CODE = 'TR'
export const DEFAULT_COMPANY_COUNTRY_LABEL = 'Türkiye'
export const COMPANY_SIZE_OPTIONS = ['Küçük', 'Orta', 'Büyük', 'Kurumsal'] as const

export type CompanySizeOption = (typeof COMPANY_SIZE_OPTIONS)[number]

export type CountryOption = {
  code: string
  label: string
  searchText: string
}

export type CityOption = {
  value: string
  label: string
  searchText: string
}

const countryDisplayNamesTr =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['tr'], { type: 'region' })
    : null

const countryDisplayNamesEn =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

const COUNTRY_ALIASES: Record<string, string[]> = {
  TR: ['Türkiye', 'Turkiye', 'Turkey', 'Türk', 'Turk', 'TR', 'TUR'],
}

const getCountryLabel = (countryCode: string) => {
  if (countryCode === DEFAULT_COMPANY_COUNTRY_CODE) return DEFAULT_COMPANY_COUNTRY_LABEL
  return countryDisplayNamesTr?.of(countryCode) || countryDisplayNamesEn?.of(countryCode) || countryCode
}

const sortByLabel = <T extends { label: string }>(items: T[]) =>
  [...items].sort((left, right) => left.label.localeCompare(right.label, 'tr'))

const buildCountryOptions = () =>
  sortByLabel(
    Object.keys(countries.getAlpha2Codes()).map((countryCode) => {
      const label = getCountryLabel(countryCode)
      const alpha3Code = countries.alpha2ToAlpha3(countryCode)
      const englishLabel = countryDisplayNamesEn?.of(countryCode) || ''

      return {
        code: countryCode,
        label,
        searchText: [
          label,
          englishLabel,
          countryCode,
          alpha3Code,
          ...(COUNTRY_ALIASES[countryCode] || []),
        ]
          .filter(Boolean)
          .join(' '),
      }
    })
  )

const COUNTRY_OPTIONS = buildCountryOptions()

const TURKEY_CITY_OPTIONS: CityOption[] = sortByLabel(
  TURKEY_CITY_NAMES.map((cityName) => ({
    value: cityName,
    label: cityName,
    searchText: cityName,
  }))
)

export const getCountryOptions = () => COUNTRY_OPTIONS

export const findCountryOption = (value?: string) => {
  const normalizedValue = normalizeSearchText(value)
  if (!normalizedValue) return null

  return (
    COUNTRY_OPTIONS.find(
      (option) =>
        normalizeSearchText(option.code) === normalizedValue ||
        normalizeSearchText(option.label) === normalizedValue ||
        normalizeSearchText(option.searchText).includes(normalizedValue)
    ) ?? null
  )
}

export const normalizeCountryLabel = (value?: string) => {
  const matchedCountry = findCountryOption(value)
  return matchedCountry?.label || (value || '').trim()
}

export const isTurkeyCountry = (value?: string) => findCountryOption(value)?.code === DEFAULT_COMPANY_COUNTRY_CODE

export const getCityOptionsForCountry = (countryValue?: string) =>
  isTurkeyCountry(countryValue) ? TURKEY_CITY_OPTIONS : []

export const includeCustomCityOption = (options: CityOption[], cityValue?: string) => {
  const trimmedValue = cityValue?.trim()
  if (!trimmedValue) return options
  if (options.some((option) => normalizeSearchText(option.value) === normalizeSearchText(trimmedValue))) return options
  return [{ value: trimmedValue, label: trimmedValue, searchText: trimmedValue }, ...options]
}

export const normalizeCompanySize = (value?: string) => {
  const normalizedValue = normalizeSearchText(value)
  if (!normalizedValue) return ''
  if (normalizedValue === 'enterprise' || normalizedValue === 'kurumsal') return 'Kurumsal'
  if (normalizedValue === 'mid-market' || normalizedValue === 'mid market' || normalizedValue === 'orta') return 'Orta'
  if (normalizedValue === 'smb' || normalizedValue === 'small business' || normalizedValue === 'kucuk') return 'Küçük'
  if (normalizedValue === 'large' || normalizedValue === 'buyuk') return 'Büyük'
  return (value || '').trim()
}
