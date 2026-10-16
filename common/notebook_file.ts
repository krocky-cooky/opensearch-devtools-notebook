/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CellOutput,
  FILE_SCHEMA_VERSION,
  HTTP_METHODS,
  Notebook,
  NotebookCell,
  NotebookFile,
  HttpMethod,
} from './index';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isHttpMethod = (v: unknown): v is HttpMethod =>
  typeof v === 'string' && (HTTP_METHODS as readonly string[]).includes(v);

function parseOutput(raw: unknown): CellOutput | undefined {
  if (!isRecord(raw) || typeof raw.statusCode !== 'number') return undefined;
  return {
    statusCode: raw.statusCode,
    body: raw.body,
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : 0,
    executedAt: typeof raw.executedAt === 'string' ? raw.executedAt : '',
    ...(typeof raw.error === 'string' ? { error: raw.error } : {}),
  };
}

/**
 * Validate an arbitrary parsed JSON value as a NotebookCell.
 * Returns a normalized cell or throws with a human readable reason.
 */
export function parseCell(raw: unknown, index: number): NotebookCell {
  if (!isRecord(raw)) throw new Error(`cells[${index}] is not an object`);
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `cell-${index}`;

  if (raw.type === 'markdown') {
    return {
      id,
      type: 'markdown',
      markdown: typeof raw.markdown === 'string' ? raw.markdown : '',
    };
  }

  if (raw.type === 'ppl') {
    const cell: NotebookCell = {
      id,
      type: 'ppl',
      query: typeof raw.query === 'string' ? raw.query : '',
    };
    const output = parseOutput(raw.output);
    if (output) cell.output = output;
    return cell;
  }

  if (raw.type === 'dsl') {
    const req = raw.request;
    if (!isRecord(req)) throw new Error(`cells[${index}].request is missing`);
    if (!isHttpMethod(req.method)) {
      throw new Error(`cells[${index}].request.method must be one of ${HTTP_METHODS.join(', ')}`);
    }
    if (typeof req.path !== 'string')
      throw new Error(`cells[${index}].request.path must be a string`);
    const cell: NotebookCell = {
      id,
      type: 'dsl',
      request: {
        method: req.method,
        path: req.path,
        body: typeof req.body === 'string' ? req.body : '',
      },
    };
    const output = parseOutput(raw.output);
    if (output) cell.output = output;
    return cell;
  }

  throw new Error(`cells[${index}].type must be "dsl", "ppl" or "markdown"`);
}

/** Parse the text content of an exported notebook file. Throws on invalid input. */
export function parseNotebookFile(text: string): Notebook {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error('File is not valid JSON');
  }
  if (!isRecord(raw)) throw new Error('File root must be an object');
  if (raw.schemaVersion !== FILE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${String(raw.schemaVersion)} (expected ${FILE_SCHEMA_VERSION})`
    );
  }
  if (!Array.isArray(raw.cells)) throw new Error('cells must be an array');
  return {
    title: typeof raw.title === 'string' && raw.title ? raw.title : 'Imported notebook',
    description: typeof raw.description === 'string' ? raw.description : undefined,
    cells: raw.cells.map(parseCell),
  };
}

/** Build the exported file object. Optionally strips cell outputs. */
export function toNotebookFile(notebook: Notebook, includeOutputs: boolean): NotebookFile {
  const cells = notebook.cells.map((cell) => {
    if ((cell.type === 'dsl' || cell.type === 'ppl') && !includeOutputs) {
      const { output, ...rest } = cell;
      return rest;
    }
    return cell;
  });
  return {
    schemaVersion: FILE_SCHEMA_VERSION,
    title: notebook.title,
    description: notebook.description,
    exportedAt: new Date().toISOString(),
    cells,
  };
}

/** Parse the JSON string stored in the saved object `cells` attribute. */
export function parseStoredCells(text: string): NotebookCell[] {
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) throw new Error('Stored cells are not an array');
  return raw.map(parseCell);
}
