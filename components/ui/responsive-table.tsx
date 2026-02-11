"use client";

import { ReactNode } from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  mobilePriority?: boolean; // Show on mobile cards
}

export interface ResponsiveTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  actions?: (row: T) => ReactNode;
  searchKeys?: (keyof T | string)[];
  placeholder?: string;
  onRowClick?: (row: T) => void;
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns,
  data,
  actions,
  searchKeys,
  placeholder = 'Search...',
  onRowClick,
}: ResponsiveTableProps<T>) {
  // Filter columns for mobile (show priority columns first, then first 3)
  const mobileColumns = columns
    .filter((col) => col.mobilePriority !== false)
    .slice(0, 4);

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <div className="rounded-md border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
                {actions && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${
                          column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''
                        }`}
                      >
                        {column.render ? column.render(row[column.key as keyof T], row) : String(row[column.key as keyof T] ?? '')}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div onClick={(e) => e.stopPropagation()}>
                          {actions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {data.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No data available
          </div>
        ) : (
          data.map((row, idx) => (
            <div
              key={idx}
              className={`bg-white p-4 rounded-lg shadow border border-gray-200 ${
                onRowClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
              }`}
              onClick={() => onRowClick?.(row)}
            >
              {mobileColumns.map((column) => (
                <div key={String(column.key)} className="mb-3 last:mb-0">
                  <span className="text-xs font-medium text-gray-500 uppercase block mb-1">
                    {column.label}
                  </span>
                  <span className="text-sm text-gray-900 block break-words">
                    {column.render ? column.render(row[column.key as keyof T], row) : String(row[column.key as keyof T] ?? '')}
                  </span>
                </div>
              ))}
              {actions && (
                <div className="mt-4 pt-4 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                  {actions(row)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

