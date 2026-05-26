import * as React from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type DataTableProps<TData> = {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  searchKey?: string
  onExport?: (rows: TData[]) => void
  renderToolbar?: React.ReactNode
  renderSelectionActions?: (context: { selectedRows: TData[]; selectedCount: number; clearSelection: () => void }) => React.ReactNode
  pageSizeOptions?: number[]
  initialPageSize?: number
}

export function DataTable<TData>({
  columns,
  data,
  searchKey,
  onExport,
  renderToolbar,
  renderSelectionActions,
  pageSizeOptions,
  initialPageSize,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const resolvedPageSizeOptions = React.useMemo(
    () => (pageSizeOptions?.length ? pageSizeOptions : [10, 25, 50, 100]),
    [pageSizeOptions]
  )
  const resolvedInitialPageSize =
    initialPageSize && resolvedPageSizeOptions.includes(initialPageSize)
      ? initialPageSize
      : resolvedPageSizeOptions[0]

  const table = useReactTable({
    data,
    columns,
    initialState: {
      pagination: {
        pageSize: resolvedInitialPageSize,
      },
    },
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (row: any, index) => String(row?.id ?? index),
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onChange',
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedOriginalRows = selectedRows.map((row) => row.original)
  const filteredRows = table.getFilteredRowModel().rows
  const clearSelection = React.useCallback(() => table.resetRowSelection(), [table])
  const selectAllFilteredRows = React.useCallback(() => {
    const nextSelection: RowSelectionState = {}
    table.getFilteredRowModel().rows.forEach((row) => {
      nextSelection[row.id] = true
    })
    setRowSelection(nextSelection)
  }, [table])

  return (
    <div className="space-y-3">
      {selectedRows.length > 0 && renderSelectionActions ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 shadow-sm">
          <span className="text-sm font-medium">{selectedRows.length} satır seçildi</span>
          {selectedRows.length < filteredRows.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={selectAllFilteredRows}>
              Filtrelenenlerin tümünü seç
            </Button>
          ) : null}
          {renderSelectionActions({
            selectedRows: selectedOriginalRows,
            selectedCount: selectedRows.length,
            clearSelection,
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/80 p-3 shadow-sm">
        {searchKey && (
          <Input
            placeholder="Ara..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-full bg-background md:w-72"
          />
        )}
        {renderToolbar}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-[110px]">
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sayfa boyutu" />
              </SelectTrigger>
              <SelectContent>
                {resolvedPageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / sayfa
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport(table.getFilteredRowModel().rows.map((row) => row.original))}
            >
              <Download className="mr-2 h-4 w-4" />
              Dışa aktar (CSV)
            </Button>
          )}
          <span className="hidden rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground md:inline">
            {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_18px_50px_-40px_rgba(15,23,42,0.58)]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none' : undefined}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' ↑',
                      desc: ' ↓',
                    }[header.column.getIsSorted() as string] ?? null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  Sonuç bulunamadı.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {selectedRows.length > 0 && !renderSelectionActions ? <p className="text-xs text-muted-foreground">{selectedRows.length} satır seçildi</p> : null}
    </div>
  )
}
