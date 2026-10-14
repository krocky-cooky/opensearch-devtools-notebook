/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  EuiBadge,
  EuiBasicTable,
  EuiButtonGroup,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { CellOutput } from '../../common';

interface Props {
  output: CellOutput;
}

type ViewId = 'json' | 'table';

type Row = Record<string, unknown>;

/** Flatten nested objects into dotted keys, keeping arrays as JSON strings. */
function flatten(obj: unknown, prefix = '', out: Row = {}) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix || 'value'] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj as Row)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

const isObject = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Turn a response into table rows when its shape allows it:
 * - `_search` results: one row per `hits.hits[]` entry (_index/_id/_score + flattened _source)
 * - top-level array of objects (e.g. `_cat/*?format=json`, `_tasks`): one row per element
 */
function extractRows(body: unknown): Row[] | null {
  const hits = (body as any)?.hits?.hits;
  if (Array.isArray(hits) && hits.length > 0) {
    return hits.map((h: any) => ({
      _index: h._index,
      _id: h._id,
      _score: h._score ?? null,
      ...flatten(h._source ?? {}),
    }));
  }
  if (Array.isArray(body) && body.length > 0 && body.every(isObject)) {
    return body.map((item) => flatten(item));
  }
  return null;
}

const formatCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const statusColor = (code: number) => {
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warning';
  if (code >= 300) return 'default';
  return 'success';
};

export const CellOutputView: React.FC<Props> = ({ output }) => {
  const rows = useMemo(() => extractRows(output.body), [output.body]);
  const [view, setView] = useState<ViewId>('json');
  const effectiveView: ViewId = rows ? view : 'json';

  const columns = useMemo(() => {
    if (!rows) return [];
    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    return Array.from(keys).map((k) => ({
      field: k,
      name: k,
      truncateText: true,
      render: (v: unknown) => formatCell(v),
    }));
  }, [rows]);

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
        {rows && (
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
                    values: { count: rows.length },
                  }),
                },
              ]}
            />
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
      <EuiSpacer size="xs" />
      {effectiveView === 'table' && rows ? (
        <div style={{ overflowX: 'auto' }}>
          <EuiBasicTable
            tableCaption="Response rows"
            items={rows}
            columns={columns}
            tableLayout="auto"
            compressed
          />
        </div>
      ) : (
        <EuiCodeBlock language="json" fontSize="s" paddingSize="s" overflowHeight={400} isCopyable>
          {jsonText}
        </EuiCodeBlock>
      )}
    </div>
  );
};
