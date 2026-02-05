// @ts-nocheck
import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { FileText, PlusCircle, Search } from 'lucide-react'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

export function GlobalSearch({ open, onOpenChange }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [tags, setTags] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [limit, setLimit] = useState(10)
  const [saved, setSaved] = useState<{ name: string; query: string; tags: string; types: string }[]>([])
  const [savedPick, setSavedPick] = useState('none')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    partners: any[]
    quotes: any[]
    products: any[]
    tasks: any[]
    comments: any[]
    teams: any[]
  }>({ partners: [], quotes: [], products: [], tasks: [], comments: [], teams: [] })

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpenChange])

  useEffect(() => {
    const raw = localStorage.getItem('global-search-saved')
    if (raw) {
      try {
        setSaved(JSON.parse(raw))
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('global-search-saved', JSON.stringify(saved))
  }, [saved])

  const go = (to: string) => {
    onOpenChange(false)
    router.navigate({ to })
  }

  useEffect(() => {
    if (!open) return
    if (query.trim().length < 2 && tags.trim().length === 0) {
      setResults({ partners: [], quotes: [], products: [], tasks: [], comments: [], teams: [] })
      return
    }
    setLoading(true)
    api
      .get('/search/', { params: { q: query, tags, type: types.join(','), limit } })
      .then((res) => setResults(res.data || {}))
      .finally(() => setLoading(false))
  }, [query, tags, types, limit, open])

  const quickActions = [
    { label: 'Lead oluştur', to: '/crm/leads', action: () => toast({ title: 'Lead formu hazır' }) },
    { label: 'Yeni fatura', to: '/erp/invoicing', action: () => toast({ title: 'Fatura modalı hazır' }) },
    { label: 'Destek kaydı aç', to: '/support/tickets', action: () => toast({ title: 'Ticket bilgisi girin' }) },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <Command>
          <div className="p-3 space-y-2">
            <CommandInput placeholder="Görev, şirket, teklif, ekip ara..." value={query} onValueChange={setQuery} />
            <div className="flex items-center gap-2">
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Etiketler (virgül ile)"
                className="h-9"
              />
              <Input
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Math.min(50, Math.max(1, Number(e.target.value) || 10)))}
                className="h-9 w-20"
                placeholder="Limit"
              />
              <Select
                value={types.join(',') || 'all'}
                onValueChange={(v) => setTypes(v === 'all' ? [] : v.split(',').filter(Boolean))}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Tür seç (opsiyonel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="tasks">Görev</SelectItem>
                  <SelectItem value="comments">Yorum</SelectItem>
                  <SelectItem value="teams">Ekip</SelectItem>
                  <SelectItem value="partners">Şirket</SelectItem>
                  <SelectItem value="quotes">Teklif</SelectItem>
                  <SelectItem value="products">Ürün</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Kayıt adı"
                className="h-9 w-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (!val) return
                    const next = [...saved.filter((s) => s.name !== val), { name: val, query, tags, types: types.join(',') }]
                    setSaved(next)
                    setSavedPick(val)
                    ;(e.target as HTMLInputElement).value = ''
                    toast({ title: 'Kayıt edildi', description: val })
                  }
                }}
              />
              <SelectSaved saved={saved} savedPick={savedPick} onPick={(name) => {
                setSavedPick(name)
                if (name === 'none') return
                const item = saved.find((s) => s.name === name)
                if (!item) return
                setQuery(item.query)
                setTags(item.tags)
                setTypes(item.types ? item.types.split(',').filter(Boolean) : [])
              }} />
            </div>
          </div>
          <CommandList>
            <CommandEmpty>{loading ? 'Aranıyor...' : 'Sonuç yok.'}</CommandEmpty>
            <CommandGroup heading="Hızlı aksiyonlar">
              {quickActions.map((action) => (
                <CommandItem
                  key={action.label}
                  onSelect={() => {
                    action.action()
                    go(action.to)
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={`Görevler (${results.tasks_count ?? 0})`}>
              {results.tasks?.map((t: any) => (
                <CommandItem key={`task-${t.id}`} onSelect={() => go(`/tasks/${t.id}`)}>
                  <Search className="mr-2 h-4 w-4" />
                  <span>{t.title}</span>
                  <Badge variant="outline" className="ml-auto">
                    {t.status}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={`Yorumlar (${results.comments_count ?? 0})`}>
              {results.comments?.map((c: any) => (
                <CommandItem key={`comment-${c.id}`} onSelect={() => go(`/tasks/${c.task_id}`)}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="truncate">{c.text}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {c.task_title}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={`Ekipler (${results.teams_count ?? 0})`}>
              {results.teams?.map((tm: any) => (
                <CommandItem key={`team-${tm.id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{tm.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={`Şirketler (${results.partners_count ?? 0})`}>
              {results.partners?.map((p: any) => (
                <CommandItem key={`partner-${p.id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={`Teklifler (${results.quotes_count ?? 0})`}>
              {results.quotes?.map((q: any) => (
                <CommandItem key={`quote-${q.id}`} onSelect={() => go(`/crm/quotes/${q.id}`)}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{q.number}</span>
                  <Badge variant="outline" className="ml-auto">
                    {q.status}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={`Ürünler (${results.products_count ?? 0})`}>
              {results.products?.map((pr: any) => (
                <CommandItem key={`prod-${pr.id}`} onSelect={() => go('/erp/inventory')}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{pr.name}</span>
                  <Badge variant="outline" className="ml-auto">
                    {pr.sku}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function SelectSaved({
  saved,
  savedPick,
  onPick,
}: {
  saved: { name: string; query: string; tags: string }[]
  savedPick: string
  onPick: (name: string) => void
}) {
  return (
    <Select value={savedPick} onValueChange={onPick}>
      <SelectTrigger className="h-9 w-40">
        <SelectValue placeholder="Kayıtlı arama" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Seçilmedi</SelectItem>
        {saved.map((s) => (
          <SelectItem key={s.name} value={s.name}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

