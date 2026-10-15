/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EuiCodeBlock,
  EuiDataGrid,
  EuiDataGridCellValueElementProps,
  EuiDataGridColumn,
  EuiDataGridSorting,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';

export type Row = Record<string, unknown>;

interface Props {
  rows: Row[];
  /** Column ids to put first, in this order (e.g. _index, _id, _score). */
  leadingColumns?: string[];
}

const isComplex = (v: unknown) => v !== null && typeof v === 'object';

/** One-line representation used inside grid cells. */
const toCellText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (isComplex(v)) return JSON.stringify(v);
  return String(v);
};

/** Pretty-printed representation shown when a cell is expanded. */
const toDetailText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (isComplex(v)) return JSON.stringify(v, null, 2);
  return String(v);
};

const schemaOf = (values: unknown[]): EuiDataGridColumn['schema'] => {
  const defined = values.filter((v) => v !== null && v !== undefined);
  if (defined.length === 0) return undefined;
  if (defined.every((v) => typeof v === 'number')) return 'numeric';
  if (defined.every((v) => typeof v === 'boolean')) return 'boolean';
  return undefined;
};

export const ResponseDataGrid: React.FC<Props> = ({ rows, leadingColumns = [] }) => {
  const columns = useMemo<EuiDataGridColumn[]>(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const k of leadingColumns) {
      if (rows.some((r) => k in r)) {
        keys.push(k);
        seen.add(k);
      }
    }
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) {
          keys.push(k);
          seen.add(k);
        }
      }
    }
    return keys.map((id) => {
      const values = rows.map((r) => r[id]);
      const schema = schemaOf(values);
      const longest = Math.max(...values.map((v) => toCellText(v).length), id.length);
      return {
        id,
        displayAsText: id,
        schema,
        // Rough initial width from content length, clamped so one long field
        // cannot push everything else off-screen. Users can drag to resize.
        initialWidth: Math.min(360, Math.max(90, longest * 7 + 24)),
        isExpandable: true,
      };
    });
  }, [rows, leadingColumns]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => columns.map((c) => c.id));
  useEffect(() => {
    setVisibleColumns(columns.map((c) => c.id));
  }, [columns]);

  const [sortingColumns, setSortingColumns] = useState<EuiDataGridSorting['columns']>([]);
  const onSort = useCallback((cols: EuiDataGridSorting['columns']) => setSortingColumns(cols), []);

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [rows]);

  const renderCellValue = useCallback(
    ({ rowIndex, columnId, isDetails }: EuiDataGridCellValueElementProps) => {
      const value = rows[rowIndex]?.[columnId];
      if (isDetails && isComplex(value)) {
        return (
          <EuiCodeBlock
            language="json"
            fontSize="s"
            paddingSize="s"
            isCopyable
            transparentBackground
          >
            {toDetailText(value)}
          </EuiCodeBlock>
        );
      }
      return <>{isDetails ? toDetailText(value) : toCellText(value)}</>;
    },
    [rows]
  );

  return (
    <EuiDataGrid
      aria-label={i18n.translate('opensearchNotebook.output.gridLabel', {
        defaultMessage: 'Response rows',
      })}
      columns={columns}
      columnVisibility={{ visibleColumns, setVisibleColumns }}
      rowCount={rows.length}
      renderCellValue={renderCellValue}
      inMemory={{ level: 'sorting' }}
      // The built-in 'json' popover re-parses the cell's innerText instead of using
      // renderCellValue; route it through our isDetails rendering instead.
      popoverContents={{ json: ({ children }) => <>{children}</> }}
      sorting={{ columns: sortingColumns, onSort }}
      gridStyle={{ border: 'horizontal', fontSize: 's', cellPadding: 's', rowHover: 'highlight' }}
      toolbarVisibility={{
        showColumnSelector: true,
        showSortSelector: true,
        showStyleSelector: false,
        showFullScreenSelector: true,
      }}
      pagination={{
        ...pagination,
        pageSizeOptions: [10, 25, 50, 100],
        onChangePage: (pageIndex) => setPagination((p) => ({ ...p, pageIndex })),
        onChangeItemsPerPage: (pageSize) => setPagination({ pageIndex: 0, pageSize }),
      }}
    />
  );
};
