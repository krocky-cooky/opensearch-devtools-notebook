export const PLUGIN_ID = 'opensearchNotebook';
export const PLUGIN_NAME = 'Notebook';

/** Saved object type used to persist notebooks in the .kibana index. */
export const NOTEBOOK_SAVED_OBJECT_TYPE = 'opensearch-notebook';

/** REST API prefix served by this plugin's server side. */
export const API_PREFIX = '/api/opensearch_notebook';
export const EXECUTE_ROUTE = `${API_PREFIX}/execute`;

/** Version of the exported notebook file schema. */
export const FILE_SCHEMA_VERSION = 1;
export const FILE_EXTENSION = '.osnb.json';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type CellType = 'dsl' | 'markdown';

export interface DslRequest {
  method: HttpMethod;
  path: string;
  /** Raw request body as typed by the user (JSON text, may be empty). */
  body: string;
}

export interface CellOutput {
  statusCode: number;
  /** Parsed JSON response body, or raw string when the response was not JSON. */
  body: unknown;
  /** Wall-clock time of the round trip measured on the Dashboards server, in ms. */
  durationMs: number;
  /** ISO timestamp of when the cell was executed. */
  executedAt: string;
  error?: string;
}

export interface DslCell {
  id: string;
  type: 'dsl';
  request: DslRequest;
  output?: CellOutput;
}

export interface MarkdownCell {
  id: string;
  type: 'markdown';
  markdown: string;
}

export type NotebookCell = DslCell | MarkdownCell;

/** In-memory / saved-object representation of a notebook. */
export interface Notebook {
  title: string;
  description?: string;
  cells: NotebookCell[];
}

/** Attributes stored on the saved object. */
export interface NotebookSavedObjectAttributes {
  title: string;
  description: string;
  /** JSON-serialized NotebookCell[]; stored as a string so the mapping stays small. */
  cells: string;
  schemaVersion: number;
}

/** Shape of the exported `.osnb.json` file. */
export interface NotebookFile {
  schemaVersion: number;
  title: string;
  description?: string;
  exportedAt: string;
  cells: NotebookCell[];
}

export interface ExecuteRequestBody {
  method: HttpMethod;
  path: string;
  body?: string;
}

export interface ExecuteResponseBody {
  statusCode: number;
  body: unknown;
  durationMs: number;
}
