'use client';

import { Table } from '@tanstack/react-table';
import { X, Search, SlidersHorizontal, Download, Columns } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  columnId: string;
  label: string;
  options: FilterOption[];
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchColumn?: string;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  onExport?: () => void;
  enableColumnVisibility?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  searchColumn,
  searchPlaceholder = 'Search...',
  filters = [],
  onExport,
  enableColumnVisibility = true,
}: DataTableToolbarProps<TData>) {
  const [searchValue, setSearchValue] = useState('');

  // Debounced search — intentionally excludes `table` from deps.
  // TanStack Table creates a new instance each render; adding it would cause infinite loops.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchColumn) {
        table.getColumn(searchColumn)?.setFilterValue(searchValue);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue, searchColumn]);

  const isFiltered = table.getState().columnFilters.length > 0;
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  const handleReset = () => {
    table.resetColumnFilters();
    setSearchValue('');
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Row 1: Search + Filters + Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        {searchColumn && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 h-9"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Filter dropdowns */}
        {filters.map((filter) => {
          const column = table.getColumn(filter.columnId);
          if (!column) return null;
          const currentValue = (column.getFilterValue() as string) ?? '';

          return (
            <Select
              key={filter.columnId}
              value={currentValue || 'all'}
              onValueChange={(val) =>
                column.setFilterValue(val === 'all' ? undefined : val)
              }
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}

        {/* Reset filters */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={handleReset}
            className="h-9 px-3 text-sm"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Column visibility */}
        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== 'undefined' &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id.replace(/_/g, ' ')}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Export button */}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} className="h-9">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </div>

      {/* Row 2: Bulk selection indicator */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{selectedCount} selected</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => table.toggleAllRowsSelected(false)}
          >
            Clear selection
          </Button>
        </div>
      )}
    </div>
  );
}
