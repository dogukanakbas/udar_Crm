import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn, normalizeSearchText } from '@/lib/utils'

export type SearchableComboboxOption = {
  value: string
  label: string
  searchText?: string
}

type SearchableComboboxProps = {
  value: string
  options: SearchableComboboxOption[]
  placeholder: string
  searchPlaceholder: string
  emptyMessage: string
  disabled?: boolean
  loading?: boolean
  triggerClassName?: string
  contentClassName?: string
  onValueChange: (value: string) => void
}

export function SearchableCombobox({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
  loading,
  triggerClassName,
  contentClassName,
  onValueChange,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(deferredQuery)
    if (!normalizedQuery) return options

    return options.filter((option) =>
      normalizeSearchText(`${option.label} ${option.searchText || ''}`).includes(normalizedQuery)
    )
  }, [deferredQuery, options])

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={cn(
          'w-full justify-between font-normal',
          !selectedOption && 'text-muted-foreground',
          triggerClassName
        )}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
      </Button>
      {open ? (
        <div
          className={cn(
            'absolute inset-x-0 top-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-xl border border-border bg-background shadow-xl',
            contentClassName
          )}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div
            className="max-h-64 overflow-y-auto overscroll-contain p-2"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {loading ? 'Yükleniyor...' : emptyMessage}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/80 focus:bg-muted/80 focus:outline-none',
                      option.value === value && 'bg-muted'
                    )}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', option.value === value ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
