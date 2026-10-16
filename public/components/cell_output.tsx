/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  EuiBadge,
  EuiButtonGroup,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { CellOutput } from '../../common';
import { ResponseDataGrid, Row } from './response_data_grid';

interface Props {
  output: CellOutput;
}

type ViewId = 'json' | 'table';

const isObject = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);

const HIT_LEADING_COLUMNS = ['_index', '_id', '_score'];

/**
 * Turn a response into table rows when its shape allows it:
 * - `_search` results: one row per `hits.hits[]` entry (_index/_id/_score + top-level _source keys)
 * - top-level array of objects (e.g. `_cat/*?format=json`, `_tasks`): one row per element
 * - SQL/PPL plugin results (`schema` + `datarows`): one row per datarow, columns from schema
 * Nested objects/arrays stay as a single value in their column; the grid shows them as
 * compact JSON and pretty-prints them when the cell is expanded.
 */
function extractRows(body: unknown): { rows: Row[]; leading: string[] } | null {
  const hits = (body as any)?.hits?.hits;
  if (Array.isArray(hits) && hits.length > 0) {
    return {
      rows: hits.map((h: any) => ({
        _index: h._index,
        _id: h._id,
        _score: h._score ?? null,
        ...(isObject(h._source) ? h._source : {}),
      })),
      leading: HIT_LEADING_COLUMNS,
    };
  }
  if (Array.isArray(body) && body.length > 0 && body.every(isObject)) {
    return { rows: body, leading: [] };
  }
  // SQL / PPL plugin response: { schema: [{name,type}], datarows: [[...]] }
  const schema = (body as any)?.schema;
  const datarows = (body as any)?.datarows;
  if (Array.isArray(schema) && Array.isArray(datarows) && datarows.length > 0) {
    const names: string[] = schema.map((c: any, i: number) =>
      typeof c?.name === 'string' ? c.name : `col${i}`
    );
    return {
      rows: datarows.map((r: unknown[]) => Object.fromEntries(names.map((n, i) => [n, r?.[i]]))),
      leading: [],
    };
  }
  return null;
}

const statusColor = (code: number) => {
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warning';
  if (code >= 300) return 'default';
  return 'success';
};

export const CellOutputView: React.FC<Props> = ({ output }) => {
  const table = useMemo(() => extractRows(output.body), [output.body]);
  const [view, setView] = useState<ViewId>('json');
  const effectiveView: ViewId = table ? view : 'json';

  const jsonText =
    typeof output.body === 'string' ? output.body : JSON.stringify(output.body, null, 2);

  return (
    <div className="osnbCellOutput">
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiBadge color={statusColor(output.statusCode)}>{output.statusCode}</EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued">
            {output.durationMs} ms
            {output.executedAt ? ` · ${new Date(output.executedAt).toLocaleString()}` : ''}
          </EuiText>
        </EuiFlexItem>
        {output.error && (
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="danger">
              {output.error}
            </EuiText>
          </EuiFlexItem>
        )}
        <EuiFlexItem />
        {table && (
          <EuiFlexItem grow={false}>
            <EuiButtonGroup
              legend={i18n.translate('opensearchNotebook.output.viewLegend', {
                defaultMessage: 'Output view',
              })}
              buttonSize="compressed"
              idSelected={effectiveView}
              onChange={(id) => setView(id as ViewId)}
              options={[
                { id: 'json', label: 'JSON' },
                {
                  id: 'table',
                  label: i18n.translate('opensearchNotebook.output.tableView', {
                    defaultMessage: 'Table ({count})',
                    values: { count: table.rows.length },
                  }),
                },
              ]}
            />
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
      <EuiSpacer size="xs" />
      {effectiveView === 'table' && table ? (
        <ResponseDataGrid rows={table.rows} leadingColumns={table.leading} />
      ) : (
        <EuiCodeBlock language="json" fontSize="s" paddingSize="s" overflowHeight={400} isCopyable>
          {jsonText}
        </EuiCodeBlock>
      )}
    </div>
  );
};
