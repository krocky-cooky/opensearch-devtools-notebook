import { SavedObjectsClientContract, SimpleSavedObject } from '../../../src/core/public';
import {
  FILE_EXTENSION,
  FILE_SCHEMA_VERSION,
  Notebook,
  NOTEBOOK_SAVED_OBJECT_TYPE,
  NotebookSavedObjectAttributes,
} from '../common';
import { parseNotebookFile, parseStoredCells, toNotebookFile } from '../common/notebook_file';

export interface SavedNotebookSummary {
  id: string;
  title: string;
  description: string;
  updatedAt?: string;
}

const toAttributes = (notebook: Notebook): NotebookSavedObjectAttributes => ({
  title: notebook.title,
  description: notebook.description ?? '',
  cells: JSON.stringify(notebook.cells),
  schemaVersion: FILE_SCHEMA_VERSION,
});

const fromSavedObject = (
  so: SimpleSavedObject<NotebookSavedObjectAttributes>
): { id: string; notebook: Notebook } => ({
  id: so.id,
  notebook: {
    title: so.attributes.title,
    description: so.attributes.description || undefined,
    cells: parseStoredCells(so.attributes.cells || '[]'),
  },
});

export class NotebookStorage {
  constructor(private readonly client: SavedObjectsClientContract) {}

  async list(): Promise<SavedNotebookSummary[]> {
    const res = await this.client.find<NotebookSavedObjectAttributes>({
      type: NOTEBOOK_SAVED_OBJECT_TYPE,
      perPage: 1000,
      fields: ['title', 'description'],
      sortField: 'updated_at',
    });
    return res.savedObjects
      .map((so) => ({
        id: so.id,
        title: so.attributes.title,
        description: so.attributes.description,
        updatedAt: so.updated_at,
      }))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  async load(id: string) {
    const so = await this.client.get<NotebookSavedObjectAttributes>(NOTEBOOK_SAVED_OBJECT_TYPE, id);
    if (so.error) throw new Error(so.error.message);
    return fromSavedObject(so);
  }

  async create(notebook: Notebook): Promise<string> {
    const so = await this.client.create(NOTEBOOK_SAVED_OBJECT_TYPE, toAttributes(notebook));
    return so.id;
  }

  async update(id: string, notebook: Notebook): Promise<void> {
    await this.client.update(NOTEBOOK_SAVED_OBJECT_TYPE, id, toAttributes(notebook));
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(NOTEBOOK_SAVED_OBJECT_TYPE, id);
  }
}

const safeFileName = (title: string) =>
  (title.trim().replace(/[\\/:*?"<>|\s]+/g, '_') || 'notebook').slice(0, 80);

/** Trigger a browser download of the notebook as a .osnb.json file. */
export function downloadNotebookFile(notebook: Notebook, includeOutputs: boolean) {
  const file = toNotebookFile(notebook, includeOutputs);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(notebook.title)}${FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Read a File chosen by the user and parse it as a notebook. */
export async function readNotebookFile(file: File): Promise<Notebook> {
  const text = await file.text();
  return parseNotebookFile(text);
}
