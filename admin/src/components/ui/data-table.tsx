'use client';

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableToolbar, FilterConfig } from '@/components/ui/data-table-toolbar';
import { DataTableEmpty } from '@/components/ui/data-table-empty';
import { cn } from '@/lib/utils';

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  enableSorting?: boolean;
  enablePagination?: boolean;
  enableRowSelection?: boolean;
  enableColumnVisibility?: boolean;
  pageSize?: number;
  isLoading?: boolean;
  searchColumn?: string;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  tableId?: string; // for localStorage persistence
  emptyTitle?: string;
  emptyDescription?: string;
  emptyCtaLabel?: string;
  onEmptyCta?: () => void;
  onExport?: (data: TData[], visibleColumnIds: string[]) => void;
  onRowSelectionChange?: (selectedRows: TData[]) => void;
  onRowClick?: (row: TData) => void;
  // Mobile card renderer
  renderMobileCard?: (row: TData) => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  enableSorting = true,
  enablePagination = true,
  enableRowSelection = false,
  enableColumnVisibility = true,
  pageSize = 20,
  isLoading = false,
  searchColumn,
  searchPlaceholder,
  filters = [],
  tableId,
  emptyTitle,
  emptyDescription,
  emptyCtaLabel,
  onEmptyCta,
  onExport,
  onRowSelectionChange,
  onRowClick,
  renderMobileCard,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Column visibility with localStorage persistence
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (tableId && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`datatable-cols-${tableId}`);
        if (stored) return JSON.parse(stored) as VisibilityState;
      } catch {
        // ignore
      }
    }
    return {};
  });

  // Persist column visibility changes
  useEffect(() => {
    if (tableId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`datatable-cols-${tableId}`, JSON.stringify(columnVisibility));
      } catch {
        // ignore
      }
    }
  }, [columnVisibility, tableId]);

  // Notify parent of row selection changes — exclude `data` and `onRowSelectionChange`
  // from deps to avoid infinite re-render loops (both can be new references each render).
  useEffect(() => {
    if (onRowSelectionChange) {
      const selected = Object.keys(rowSelection)
        .filter((k) => rowSelection[k])
        .map((k) => data[parseInt(k, 10)])
        .filter(Boolean);
      onRowSelectionChange(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: { pageSize },
    },
  });

  // Export handler
  const handleExport = onExport
    ? () => {
        const visibleIds = table
          .getVisibleFlatColumns()
          .map((col) => col.id);
        const rows = table.getFilteredRowModel().rows.map((r) => r.original);
        onExport(rows, visibleIds);
      }
    : undefined;

  const rows = table.getRowModel().rows;
  const hasData = rows.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {(searchColumn || filters.length > 0 || handleExport || enableColumnVisibility) && (
        <DataTableToolbar
          table={table}
          searchColumn={searchColumn}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          onExport={handleExport}
          enableColumnVisibility={enableColumnVisibility}
        />
      )}

      {/* Table — hidden on mobile if renderMobileCard is provided */}
      <div className={cn(renderMobileCard ? 'hidden md:block' : '')}>
        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : hasData ? (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={cn('hover:bg-muted/40 transition-colors', onRowClick && 'cursor-pointer')}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="p-0">
                      <DataTableEmpty
                        title={emptyTitle}
                        description={emptyDescription}
                        ctaLabel={emptyCtaLabel}
                        onCta={onEmptyCta}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Mobile card fallback */}
      {renderMobileCard && (
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
            ))
          ) : hasData ? (
            table.getFilteredRowModel().rows.map((row) => (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && 'cursor-pointer')}
              >
                {renderMobileCard(row.original)}
              </div>
            ))
          ) : (
            <DataTableEmpty
              title={emptyTitle}
              description={emptyDescription}
              ctaLabel={emptyCtaLabel}
              onCta={onEmptyCta}
            />
          )}
        </div>
      )}

      {/* Pagination */}
      {enablePagination && !isLoading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>
            {enableRowSelection && (
              <span className="mr-4">
                {table.getFilteredSelectedRowModel().rows.length} of{' '}
                {table.getFilteredRowModel().rows.length} row(s) selected
              </span>
            )}
            <span>
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {Math.max(table.getPageCount(), 1)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
