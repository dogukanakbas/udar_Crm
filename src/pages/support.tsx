import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { MessageCircle, Send } from 'lucide-react'

import { PageHeader } from '@/components/app-shell'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/state/use-app-store'
import { formatDate } from '@/lib/utils'
import type { Ticket } from '@/types'
import { RbacGuard } from '@/components/rbac'

export function TicketsPage() {
  const { data, addTicketMessage, updateTicket } = useAppStore()
  const [selectedId, setSelectedId] = useState(data.tickets[0]?.id)
  const [message, setMessage] = useState('')

  const columns: ColumnDef<Ticket>[] = [
    { accessorKey: 'subject', header: 'Konu' },
    { accessorKey: 'status', header: 'Durum', cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
    { accessorKey: 'priority', header: 'Öncelik', cell: ({ row }) => <Badge variant="destructive">{row.original.priority}</Badge> },
    { accessorKey: 'assignee', header: 'Atanan' },
    { accessorKey: 'sla', header: 'SLA' },
  ]

  const ticket = data.tickets.find((t) => t.id === selectedId)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Destek Ticketları"
        description="Mesaj akışı, SLA, öncelikler"
        actions={
          <RbacGuard perm="tickets.edit">
            <Badge variant="outline">{data.tickets.length} açık</Badge>
          </RbacGuard>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kuyruk</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={data.tickets}
              searchKey="subject"
              renderToolbar={<></>}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {data.tickets.slice(0, 6).map((t) => (
                <Button key={t.id} size="sm" variant={t.id === selectedId ? 'default' : 'outline'} onClick={() => setSelectedId(t.id)}>
                  {t.subject}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mesaj Akışı</CardTitle>
            <CardDescription>{ticket?.subject}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticket?.thread.map((msg) => (
              <div key={msg.id} className="rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{msg.author}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(msg.time)}</span>
                </div>
                <p className="mt-1 text-sm">{msg.message}</p>
                {msg.internal && <Badge variant="outline">Dahili</Badge>}
              </div>
            ))}
              <RbacGuard perm="tickets.edit">
                <div className="rounded-lg border border-border/70 p-3 space-y-2">
                  <Textarea
                    placeholder="Yanıt yaz veya dahili not ekle"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!ticket) return
                        addTicketMessage(ticket.id, {
                          id: '',
                          author: 'You',
                          message,
                          time: new Date().toISOString(),
                        })
                        setMessage('')
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Gönder
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => ticket && updateTicket(ticket.id, { status: 'Resolved' })}
                    >
                      Çözüldü
                    </Button>
                  </div>
                </div>
              </RbacGuard>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

