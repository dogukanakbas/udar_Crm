import * as React from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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
  pageSizeOptions?: number[]
  initialPageSize?: number
}

export function DataTable<TData>({
  columns,
  data,
  searchKey,
  onExport,
  renderToolbar,
  pageSizeOptions,
  initialPageSize,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
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
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onChange',
  })

  const selectedRows = table.getSelectedRowModel().rows

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchKey && (
          <Input
            placeholder="Ara..."
            value={globalFilter ?? ''}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-60"
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
          <span className="hidden text-xs text-muted-foreground md:inline">
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
      <div className="rounded-xl border border-border/70">
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {selectedRows.length > 0 && (
        <p className="text-xs text-muted-foreground">{selectedRows.length} row(s) selected</p>
      )}
    </div>
  )
}
