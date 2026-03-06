# shadcn/ui Data Table Documentation

## Overview

This documentation covers building custom data tables using shadcn/ui's `<Table />` component paired with TanStack Table library. The guide emphasizes a "headless UI" approach for flexibility and customization.

## Key Features

### Core Functionality

- Basic table rendering with column definitions
- Cell formatting and custom rendering
- Row actions with dropdown menus
- Pagination with navigation controls
- Sorting with toggleable column headers
- Filtering by column values

### Advanced Capabilities

- Column visibility toggling
- Row selection with checkboxes
- Reusable component patterns
- Responsive table layouts
- Mobile handling strategies

## Architecture Principles

The documentation recommends a modular structure approach:

### File Organization

- **`columns.tsx`** - Column definitions using ColumnDef type
- **`data-table.tsx`** - DataTable component wrapping TanStack Table
- **`page.tsx`** - Server component for data fetching

### Key Philosophy

> "Every data table or datagrid I've created has been unique...It doesn't make sense to combine all of these variations into a single component."

This means:
- Build custom tables rather than using pre-built components
- Align with modern headless UI principles
- Allow flexibility for different use cases
- Avoid monolithic component solutions

## Implementation Patterns

### Reusable Components

The guide demonstrates extracting common functionality into reusable components:

- `DataTableColumnHeader` - Sortable column headers with visual indicators
- `DataTablePagination` - Navigation controls and page information
- `DataTableViewOptions` - Column visibility toggling controls
- `DataTableRowActions` - Dropdown menus for row operations

### TypeScript Generics

- Uses TypeScript generics for type safety
- Column definitions are strongly typed
- Data shapes are enforced at compile time
- Reduces runtime errors

### Practical Examples

The documentation includes working examples with payment data:
- Real-world column configurations
- Filtering implementations
- Sorting logic
- Row selection handling

## Responsive Patterns

### Mobile Table Handling

The shadcn data table approach supports responsive behavior through:

1. **Column Visibility Control** - Hide less important columns on smaller screens
2. **Horizontal Scrolling** - Allow tables to scroll on mobile
3. **Responsive Column Hiding** - TanStack Table's column visibility feature
4. **Mobile-First Design** - Consider mobile as base, enhance for larger screens

### Best Practices for Responsive Tables

- Use column visibility to hide secondary information on mobile
- Combine with TanStack Table's responsive features
- Consider stack/card layouts for very small screens
- Test across multiple device sizes

## Internationalization Support

### RTL Language Support

- The guide provides RTL-specific examples
- Demonstrates Arabic localization
- Works with right-to-left layouts
- Proper text alignment handling

### Multi-Language Implementation

- Support for various languages
- Proper text direction handling
- Locale-aware sorting and filtering

## Integration with shadcn/ui

### Component Dependencies

- Built on shadcn/ui's base `<Table />` component
- Works seamlessly with other shadcn components:
  - `Button` for actions
  - `Dialog` for modals
  - `DropdownMenu` for row actions
  - `Checkbox` for selection
  - `Input` for filtering

### Styling

- Uses Tailwind CSS classes
- Semantic token support (e.g., `bg-muted`, `text-muted-foreground`)
- Responsive classes (md:, lg: prefixes)
- Dark mode support built-in

## Common Use Cases

### Admin Dashboards

- User management tables
- Order lists
- Product catalogs
- Analytics dashboards

### Data Management

- Filtering and searching
- Sorting by multiple columns
- Bulk operations on selected rows
- Pagination for large datasets

### Reporting

- Sortable reports
- Exportable data
- Column customization
- Data visibility controls

## Developer Experience

### TypeScript Support

- Full type safety with ColumnDef
- Generic types for flexibility
- IntelliSense support in IDEs
- Compile-time error detection

### Customization

- Complete control over appearance
- Flexibility in functionality
- No forced structure
- Build exactly what you need

## Performance Considerations

### Large Datasets

- Virtualization support through TanStack Table
- Pagination for handling large datasets
- Lazy loading patterns
- Efficient re-renders through React optimization

### Best Practices

- Memoize column definitions
- Use server-side pagination for large datasets
- Implement sorting on server when possible
- Cache filter results appropriately

## Common Implementation Example

A typical implementation structure:

```typescript
// columns.tsx - Define your columns
const columns: ColumnDef<Payment>[] = [
  {
    id: "select",
    header: ({ table }) => <Checkbox />,
    cell: ({ row }) => <Checkbox />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge>{row.getValue("status")}</Badge>,
  },
  // ... more columns
]

// data-table.tsx - Wrap TanStack Table
export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    // ... table options
  })

  return (
    <div>
      <Table>
        {/* render table */}
      </Table>
      <DataTablePagination table={table} />
    </div>
  )
}

// page.tsx - Use the DataTable
export default async function OrdersPage() {
  const data = await fetchOrders()
  return <DataTable columns={columns} data={data} />
}
```

## Migration and Maintenance

### When to Use shadcn Data Table

- Custom table requirements
- Need fine-grained control
- Building admin interfaces
- Responsive/mobile tables
- RTL language support needed

### When to Consider Alternatives

- Very simple tables (use plain HTML table)
- Pre-built admin panels
- Highly specialized requirements
- Legacy compatibility needs

## Related Resources

- TanStack Table documentation
- shadcn/ui component library
- Tailwind CSS responsive design
- React best practices
- TypeScript generics guide

## Summary

The shadcn data table approach provides a flexible, type-safe foundation for building custom data tables. Its modular architecture and emphasis on composition make it ideal for responsive admin panels that need to adapt to different screen sizes while maintaining a professional appearance and full functionality.
