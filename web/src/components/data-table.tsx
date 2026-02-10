interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total?: number;
  offset: number;
  limit: number;
  onPageChange: (offset: number) => void;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, index: number) => string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  total,
  offset,
  limit,
  onPageChange,
  onRowClick,
  rowKey,
  emptyMessage = 'No data',
}: DataTableProps<T>) {
  const hasNext = total !== undefined ? offset + limit < total : data.length === limit;
  const hasPrev = offset > 0;

  return (
    <div>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border last:border-b-0 hover:bg-surface/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={!hasPrev}
            className="btn-secondary px-4 py-2 text-sm rounded-lg disabled:opacity-30"
          >
            Previous
          </button>
          {total !== undefined && (
            <span className="text-xs text-muted">
              {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
          )}
          <button
            onClick={() => onPageChange(offset + limit)}
            disabled={!hasNext}
            className="btn-secondary px-4 py-2 text-sm rounded-lg disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
