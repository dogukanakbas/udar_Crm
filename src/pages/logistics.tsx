// @ts-nocheck
// @ts-nocheck
import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/data-table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/app-shell'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/state/use-app-store'
import { formatDate, formatNumber } from '@/lib/utils'
import type { Vehicle } from '@/types'
import { MapPin, PauseCircle, PlayCircle, ThermometerSun, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForm } from 'react-hook-form'

export function LogisticsTrackingPage() {
  const { data, createVehicle } = useAppStore()
  const vehicles = data.vehicles ?? []
  const [status, setStatus] = useState<string>('all')
  const [driver, setDriver] = useState<string>('all')
  const [plateFilter, setPlateFilter] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(
    () =>
      vehicles.filter(
        (v) =>
          (status === 'all' || v.status === status) &&
          (driver === 'all' || v.driver === driver) &&
          (!plateFilter || v.plate.toLowerCase().includes(plateFilter.toLowerCase()))
      ),
    [vehicles, status, driver, plateFilter]
  )

  const columns: ColumnDef<Vehicle>[] = [
    { accessorKey: 'name', header: 'Araç' },
    { accessorKey: 'plate', header: 'Plaka' },
    { accessorKey: 'driver', header: 'Sürücü' },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
    },
    {
      accessorKey: 'location.city',
      header: 'Konum',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {row.original.location.city}
        </div>
      ),
    },
    { accessorKey: 'distanceToday', header: 'Km (bugün)', cell: ({ row }) => `${row.original.distanceToday} km` },
    { accessorKey: 'avgSpeed', header: 'Ortalama Hız', cell: ({ row }) => `${row.original.avgSpeed} km/s` },
    { accessorKey: 'idleMinutes', header: 'Rölanti', cell: ({ row }) => `${row.original.idleMinutes} dk` },
    { accessorKey: 'stops', header: 'Mola', cell: ({ row }) => row.original.stops },
    {
      id: 'eta',
      header: 'ETA',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.eta)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lojistik Takip"
        description="Araç bazlı konum, hız, mola, ETA takibi"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni araç
            </Button>
            <Badge variant="outline">{vehicles.length} araç</Badge>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {Array.from(new Set(data.vehicles.map((v) => v.status))).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={driver} onValueChange={setDriver}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sürücü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm sürücüler</SelectItem>
            {Array.from(new Set(data.vehicles.map((v) => v.driver))).map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={plateFilter}
          onChange={(e) => setPlateFilter(e.target.value)}
          placeholder="Plaka ara"
          className="w-48"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Araç Listesi</CardTitle>
            <CardDescription>Konum, hız, mola ve ETA</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={filtered} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Canlı Durum</CardTitle>
            <CardDescription>Seçilen filtreye göre özet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow label="Toplam km (bugün)" value={`${formatNumber(filtered.reduce((s, v) => s + v.distanceToday, 0))} km`} />
            <SummaryRow label="Ortalama hız" value={`${formatNumber(filtered.reduce((s, v) => s + v.avgSpeed, 0) / Math.max(filtered.length, 1))} km/s`} />
            <SummaryRow label="Toplam mola" value={`${filtered.reduce((s, v) => s + v.stops, 0)} mola`} />
            <SummaryRow label="Toplam rölanti" value={`${filtered.reduce((s, v) => s + v.idleMinutes, 0)} dk`} />
            <Separator />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ThermometerSun className="h-4 w-4" />
              Soğuk zincir: {filtered.filter((v) => (v.temperature ?? 0) < 8).length} araç stabil.
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PlayCircle className="h-4 w-4 text-success" />
              {filtered.filter((v) => v.status === 'Yolda').length} yolda
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PauseCircle className="h-4 w-4 text-warning" />
              {filtered.filter((v) => v.status === 'Mola').length} mola
            </div>
          </CardContent>
        </Card>
      </div>
      <NewVehicleDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={(values) => {
          createVehicle(values as any)
          setOpen(false)
        }}
      />
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function NewVehicleDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (v: { name: string; plate: string; driver: string; status: string }) => void
}) {
  const form = useForm<{ name: string; plate: string; driver: string; status: string }>({
    defaultValues: { name: '', plate: '', driver: '', status: 'Yolda' },
  })
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni araç</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ad</Label>
            <Input {...form.register('name')} />
          </div>
          <div>
            <Label>Plaka</Label>
            <Input {...form.register('plate')} />
          </div>
          <div>
            <Label>Sürücü</Label>
            <Input {...form.register('driver')} />
          </div>
          <div>
            <Label>Durum</Label>
            <Input {...form.register('status')} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={form.handleSubmit(onSave)}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

