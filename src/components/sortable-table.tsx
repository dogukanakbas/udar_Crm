import * as React from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { GripVertical, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type SortableTableProps<TData extends Record<string, any>> = {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  searchKey?: string
  onExport?: (rows: TData[]) => void
  renderToolbar?: React.ReactNode
  pageSizeOptions?: number[]
  initialPageSize?: number
  enableDragAndDrop?: boolean
  onReorder?: (items: TData[]) => void | Promise<void>
  getRowId?: (row: TData, index: number) => string
}

function DraggableTableRow({
  row,
  id,
  enableDragAndDrop,
}: {
  row: any
  id: string
  enableDragAndDrop?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enableDragAndDrop,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'bg-muted' : ''} ${enableDragAndDrop ? 'cursor-grab hover:bg-muted/50' : ''}`}
    >
      {enableDragAndDrop && (
        <TableCell className="w-10 cursor-grab text-muted-foreground hover:text-foreground">
          <button
            type="button"
            aria-label="Satırı sırala"
            className="rounded p-2"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TableCell>
      )}
      {row.getVisibleCells().map((cell: any) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function SortableTable<TData extends Record<string, any>>({
  columns,
  data: initialData,
  searchKey,
  onExport,
  renderToolbar,
  pageSizeOptions,
  initialPageSize,
  enableDragAndDrop = false,
  onReorder,
  getRowId = (_, index) => String(index),
}: SortableTableProps<TData>) {
  const [data, setData] = React.useState(initialData)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [isReordering, setIsReordering] = React.useState(false)

  const resolvedPageSizeOptions = React.useMemo(
    () => (pageSizeOptions?.length ? pageSizeOptions : [10, 25, 50, 100]),
    [pageSizeOptions]
  )
  const resolvedInitialPageSize =
    initialPageSize && resolvedPageSizeOptions.includes(initialPageSize)
      ? initialPageSize
      : resolvedPageSizeOptions[0]

  React.useEffect(() => {
    setData(initialData)
  }, [initialData])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

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

  const visibleRows = table.getRowModel().rows
  const rowIds = visibleRows.map((row, index) => getRowId(row.original, index))

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isReordering) return

    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = data.findIndex((item, index) => getRowId(item, index) === String(active.id))
    const newIndex = data.findIndex((item, index) => getRowId(item, index) === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const previousData = data
    const newData = arrayMove(data, oldIndex, newIndex)
    setData(newData)

    if (onReorder) {
      setIsReordering(true)
      try {
        await onReorder(newData)
      } catch {
        setData(previousData)
      } finally {
        setIsReordering(false)
      }
    }
  }

  const tableContent = (
    <div className="space-y-3">
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
          <Button
            variant="ghost"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_18px_50px_-40px_rgba(15,23,42,0.58)]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {enableDragAndDrop && <TableHead className="w-10"></TableHead>}
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={header.column.getCanSort() && !enableDragAndDrop ? 'cursor-pointer select-none' : undefined}
                    onClick={!enableDragAndDrop ? header.column.getToggleSortingHandler() : undefined}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {!enableDragAndDrop && (
                      <>
                        {
                          {
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null
                        }
                      </>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows?.length ? (
              visibleRows.map((row, index) => (
                <DraggableTableRow
                  key={rowIds[index]}
                  id={rowIds[index]}
                  row={row}
                  enableDragAndDrop={enableDragAndDrop}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + (enableDragAndDrop ? 1 : 0)} className="h-24 text-center">
                  Sonuç yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )

  if (!enableDragAndDrop) {
    return tableContent
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
        {tableContent}
      </SortableContext>
    </DndContext>
  )
}
