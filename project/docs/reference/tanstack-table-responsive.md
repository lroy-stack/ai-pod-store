# TanStack Table Column Visibility and Responsive Patterns

## Overview

TanStack Table (formerly React Table) provides comprehensive column visibility functionality that allows you to dynamically show/hide columns. This is essential for building responsive data tables that adapt to different screen sizes.

## Column Visibility Feature

### Core Functionality

Column visibility is part of TanStack Table's feature set and works alongside other presentation features:

- **Column Visibility** - Show/hide specific columns
- **Column Ordering** - Arrange column sequence
- **Column Pinning** - Keep specific columns fixed while scrolling
- **Column Sizing** - Control width and responsive behavior

### What It Does

- Toggle columns on/off dynamically
- Save visibility state in client or server
- Provide UI controls for users to customize table
- Support responsive behavior for mobile/tablet/desktop

## Responsive Table Patterns

### Mobile-First Approach

Build tables that work great on mobile, then enhance for larger screens.

#### Small Screens (Mobile - 375px-480px)

```typescript
const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "id",
    header: "Order",
    cell: (info) => info.getValue(),
    // Always visible on mobile
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => <Badge>{info.getValue()}</Badge>,
    // Always visible on mobile
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: (info) => formatCurrency(info.getValue()),
    // Always visible on mobile
  },
]
```

#### Medium Screens (Tablet - 768px)

```typescript
// Add optional columns visible from md: breakpoint
const columns = [
  // ... core columns
  {
    accessorKey: "email",
    header: "Email",
    enableHiding: true,  // Can be hidden
    // Show by default on tablet
  },
  {
    accessorKey: "date",
    header: "Date",
    enableHiding: true,
  },
]
```

#### Large Screens (Desktop - 1024px+)

```typescript
// All columns visible on desktop
const columns = [
  // ... all previous columns
  {
    accessorKey: "actions",
    header: "Actions",
    enableHiding: false,  // Always visible
  },
]
```

### Implementation Example

```typescript
import { useReactTable, getCoreRowModel, getFilteredRowModel } from '@tanstack/react-table'

export function ResponsiveDataTable({ data, columns }) {
  const [columnVisibility, setColumnVisibility] = useState({
    email: false,        // Hidden on mobile
    date: false,         // Hidden on mobile
    details: false,      // Hidden on tablet
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <>
      <ColumnVisibilityControls table={table} />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : header.column.columnDef.header}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {/* render cell */}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
```

## API Reference

### Column Configuration

```typescript
interface ColumnDef<TData> {
  // ... other properties

  // Controls visibility feature
  enableHiding?: boolean        // Default: true
  enableSorting?: boolean
  enableColumnFilter?: boolean
}
```

### Table Options

```typescript
interface TableOptions {
  state?: {
    columnVisibility?: VisibilityState  // Record<string, boolean>
  }

  onColumnVisibilityChange?: OnChangeFn<VisibilityState>

  // Getters for visible columns
  getLeafColumns(): Column[]
  getVisibleLeafColumns(): Column[]
}
```

### Column Methods

```typescript
// On a Column instance
column.getIsVisible()              // boolean
column.getCanHide()                // boolean
column.toggleVisibility(value?)    // void
```

### Table Instance Methods

```typescript
// Get visible columns
table.getVisibleLeafColumns()
table.getLeafColumns()

// Get visibility state
table.getState().columnVisibility

// Update visibility
table.setColumnVisibility(state)
table.getColumn(columnId)?.toggleVisibility()
```

## Responsive Column Hiding Strategy

### Strategy 1: Breakpoint-Based

```typescript
const useResponsiveVisibility = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

// Usage
const isMobile = useResponsiveVisibility()

const columnVisibility = {
  email: !isMobile,
  phone: !isMobile,
  address: false,  // Always hidden
  actions: true,   // Always visible
}
```

### Strategy 2: User-Controlled

```typescript
<ColumnVisibilityDropdown table={table}>
  {table.getAllLeafColumns().map((column) => (
    <DropdownMenuCheckboxItem
      key={column.id}
      checked={column.getIsVisible()}
      onCheckedChange={(value) => column.toggleVisibility(!!value)}
    >
      {column.columnDef.header}
    </DropdownMenuCheckboxItem>
  ))}
</ColumnVisibilityDropdown>
```

### Strategy 3: Context-Aware

```typescript
// Hide detailed columns in compact view, show in expanded
const useTableContext = () => {
  const [isCompact, setIsCompact] = useState(true)

  const columnVisibility = {
    description: !isCompact,
    notes: !isCompact,
    metadata: !isCompact,
  }

  return { isCompact, setIsCompact, columnVisibility }
}
```

## Mobile Table Patterns

### Pattern 1: Collapsible Rows

Hide details in collapsed state, expand on tap:

```typescript
const columns = [
  // Core columns for all sizes
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },

  // Expandable details
  {
    id: 'expand',
    cell: ({ row }) => (
      <Button
        size="sm"
        onClick={() => row.toggleExpanded()}
      >
        {row.getIsExpanded() ? '−' : '+'}
      </Button>
    ),
  },
]

// Show extra columns only when expanded
const columnVisibility = expandedRow ? allColumnsVisible : coreColumnsOnly
```

### Pattern 2: Horizontal Scroll on Mobile

```typescript
<div className="overflow-x-auto md:overflow-x-visible">
  <Table>
    {/* table content */}
  </Table>
</div>

// Min width on mobile to enable scroll
<div className="min-w-[500px] md:min-w-auto">
  <Table>
    {/* table content */}
  </Table>
</div>
```

### Pattern 3: Card Layout on Mobile

Switch to card/list layout on very small screens:

```typescript
function ResponsiveTable({ data, columns }) {
  const isMobile = useResponsiveVisibility()

  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((item) => (
          <Card key={item.id}>
            <CardContent>
              {columns.map((col) => (
                <div key={col.id} className="flex justify-between py-2">
                  <span className="font-semibold">{col.header}</span>
                  <span>{item[col.accessorKey]}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Desktop table
  return <Table>{/* ... */}</Table>
}
```

### Pattern 4: Sticky Actions Column

```typescript
const columns = [
  // ... data columns
  {
    id: 'actions',
    header: 'Actions',
    cell: ActionCell,
    enableHiding: false,  // Always visible
    size: 80,
    // Make sticky on right side
    className: 'sticky right-0 bg-background',
  },
]
```

## Column Visibility Storage

### Local Storage (Client)

```typescript
const [columnVisibility, setColumnVisibility] = useState(() => {
  const saved = localStorage.getItem('tableColumnVisibility')
  return saved ? JSON.parse(saved) : defaultVisibility
})

const handleColumnVisibilityChange = (newVisibility) => {
  setColumnVisibility(newVisibility)
  localStorage.setItem('tableColumnVisibility', JSON.stringify(newVisibility))
}

const table = useReactTable({
  // ...
  onColumnVisibilityChange: handleColumnVisibilityChange,
})
```

### Server Storage (User Preference)

```typescript
const [columnVisibility, setColumnVisibility] = useState(
  userPreferences.tableColumns
)

const handleColumnVisibilityChange = async (newVisibility) => {
  setColumnVisibility(newVisibility)

  await fetch('/api/user/preferences', {
    method: 'PUT',
    body: JSON.stringify({ tableColumns: newVisibility }),
  })
}
```

## Best Practices

### 1. Essential Columns First

```typescript
// Good: Essential columns never hidden
const columnVisibility = {
  id: true,              // Always visible
  name: true,            // Always visible
  email: false,          // Can be hidden
  phone: false,          // Can be hidden
  notes: false,          // Can be hidden
}
```

### 2. User Control

```typescript
// Provide clear UI to control visibility
<DataTableViewOptions table={table} />

// Show which columns are hidden
<div>Hidden: {Object.entries(columnVisibility)
  .filter(([_, v]) => !v)
  .map(([k]) => k)
  .join(', ')}
</div>
```

### 3. Sensible Defaults

```typescript
// Mobile-optimized defaults
const defaultVisibility = {
  id: true,
  status: true,
  amount: true,
  email: false,          // Hidden by default on mobile
  createdAt: false,      // Hidden by default on mobile
  notes: false,          // Hidden by default on mobile
}
```

### 4. Responsive Behavior

```typescript
// Adjust visibility based on screen size
useEffect(() => {
  const handleResize = () => {
    const isMobile = window.innerWidth < 768
    setColumnVisibility({
      ...columnVisibility,
      email: !isMobile,
      phone: !isMobile,
    })
  }

  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

## Troubleshooting

### Columns Not Hiding

- Ensure `enableHiding` is not explicitly set to `false`
- Check that visibility state is properly connected to table
- Verify `getVisibleCells()` is used in render

### State Not Persisting

- Use localStorage or server storage
- Ensure JSON serialization works
- Handle undefined/null values

### Performance Issues

- Memoize column definitions
- Use `useMemo` for large datasets
- Implement virtual scrolling for many rows

## Related Features

- **Column Pinning** - Keep columns fixed while scrolling
- **Column Sizing** - Control responsive widths
- **Column Ordering** - User-controlled column order
- **Sorting & Filtering** - Work with visible columns only
- **Row Expansion** - Show/hide row details

## Summary

Column visibility in TanStack Table enables:

1. **Mobile Responsiveness** - Show only essential columns on small screens
2. **User Control** - Let users customize their view
3. **Responsive Design** - Adapt to any screen size
4. **Data Management** - Control information density
5. **Customizable UX** - Different layouts for different contexts

Use these patterns to build data tables that work beautifully across all devices and screen sizes.
