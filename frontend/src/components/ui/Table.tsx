import { ReactNode } from 'react';

export interface Column<T> { header: string; render: (row: T) => ReactNode }

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  emptyText: string;
  rowKey: (row: T) => string;
}

export function Table<T>({ columns, rows, loading, emptyText, rowKey }: Props<T>) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />)}
      </div>
    );
  }
  if (!rows.length) return <div className="p-12 text-center text-sm text-gray-500">{emptyText}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
          <tr>{columns.map((c) => <th key={c.header} className="px-4 py-3 font-medium">{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-gray-50">
              {columns.map((c) => <td key={c.header} className="px-4 py-3">{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
