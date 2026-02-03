import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

type AccessLog = {
  id: number
  path: string
  method: string
  ip?: string
  meta?: Record<string, any>
  user?: number
  created_at: string
}

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [method, setMethod] = useState<string>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    api
      .get('/access-logs/', { params: { search: q, ordering: '-created_at' } })
      .then((res) => setLogs(res.data || []))
      .catch(() => setLogs([]))
  }, [q])

  const filtered = logs.filter((l) => (method === 'all' ? true : l.method === method))

  return (
    <div className="space-y-4">
      <PageHeader title="Erişim Logları" description="API istek geçmişi (son 200 kayıt)" />
      <Card>
        <CardHeader>
          <CardTitle>Filtre</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input placeholder="Ara (path/method)" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Metot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {['GET', 'POST', 'PATCH', 'DELETE'].map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Loglar</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Zaman</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.path}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.method}</Badge>
                  </TableCell>
                  <TableCell>{log.ip || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Kayıt yok
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

