import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EuiButton,
  EuiButtonEmpty,
  EuiCheckbox,
  EuiConfirmModal,
  EuiEmptyPrompt,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { CoreStart, SavedObjectsClientContract } from '../../../../src/core/public';
import {
  CellOutput,
  DslCell,
  EXECUTE_ROUTE,
  ExecuteRequestBody,
  ExecuteResponseBody,
  Notebook,
  NotebookCell,
} from '../../common';
import { downloadNotebookFile, NotebookStorage, readNotebookFile } from '../storage';
import { Cell } from './cell';
import { SavedNotebooksFlyout } from './saved_notebooks_flyout';

interface Props {
  http: CoreStart['http'];
  notifications: CoreStart['notifications'];
  savedObjects: SavedObjectsClientContract;
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as any).randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const newCell = (type: NotebookCell['type']): NotebookCell =>
  type === 'dsl'
    ? { id: newId(), type: 'dsl', request: { method: 'GET', path: '_search', body: '' } }
    : { id: newId(), type: 'markdown', markdown: '' };

const emptyNotebook = (): Notebook => ({
  title: i18n.translate('opensearchNotebook.untitled', { defaultMessage: 'Untitled notebook' }),
  cells: [
    {
      id: newId(),
      type: 'markdown',
      markdown: '# New notebook\n\nAdd DSL cells and run them with Shift+Enter.',
    },
    {
      id: newId(),
      type: 'dsl',
      request: {
        method: 'GET',
        path: '_cat/indices?v&format=json',
        body: '',
      },
    },
  ],
});

/** Read the notebook id from the Dev Tools hash route, e.g. #/notebook?id=xxx */
const readIdFromHash = (): string | undefined => {
  const hash = window.location.hash;
  const q = hash.indexOf('?');
  if (q < 0) return undefined;
  return new URLSearchParams(hash.slice(q + 1)).get('id') ?? undefined;
};

export const NotebookApp: React.FC<Props> = ({ http, notifications, savedObjects }) => {
  const storage = useMemo(() => new NotebookStorage(savedObjects), [savedObjects]);
  const [notebook, setNotebook] = useState<Notebook>(emptyNotebook);
  const [savedId, setSavedId] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [showSaved, setShowSaved] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [includeOutputs, setIncludeOutputs] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toasts = notifications.toasts;
  // Latest notebook for async callbacks (execution) without re-creating them on every edit.
  const notebookRef = useRef(notebook);
  notebookRef.current = notebook;

  const mutate = useCallback((fn: (nb: Notebook) => Notebook) => {
    setNotebook((nb) => fn(nb));
    setDirty(true);
  }, []);

  // ---- loading ---------------------------------------------------------

  const openSaved = useCallback(
    async (id: string) => {
      try {
        const { notebook: nb } = await storage.load(id);
        setNotebook(nb);
        setSavedId(id);
        setDirty(false);
        setShowSaved(false);
      } catch (e: any) {
        toasts.addDanger(
          i18n.translate('opensearchNotebook.toast.loadFailed', {
            defaultMessage: 'Failed to load notebook: {message}',
            values: { message: e?.message ?? String(e) },
          })
        );
      }
    },
    [storage, toasts]
  );

  // Open a notebook referenced by the URL (#/notebook?id=...), on mount and on hash changes
  // (Dev Tools keeps the tool mounted when only the query string changes).
  const savedIdRef = useRef(savedId);
  savedIdRef.current = savedId;
  useEffect(() => {
    const syncFromHash = () => {
      const id = readIdFromHash();
      if (id && id !== savedIdRef.current) openSaved(id);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [openSaved]);

  const guardDirty = (action: () => void) => {
    if (dirty) setConfirmDiscard(() => action);
    else action();
  };

  // ---- cell editing -----------------------------------------------------

  const updateCell = (index: number, cell: NotebookCell) =>
    mutate((nb) => ({ ...nb, cells: nb.cells.map((c, i) => (i === index ? cell : c)) }));

  const deleteCell = (index: number) =>
    mutate((nb) => ({ ...nb, cells: nb.cells.filter((_, i) => i !== index) }));

  const moveCell = (index: number, dir: -1 | 1) =>
    mutate((nb) => {
      const target = index + dir;
      if (target < 0 || target >= nb.cells.length) return nb;
      const cells = [...nb.cells];
      [cells[index], cells[target]] = [cells[target], cells[index]];
      return { ...nb, cells };
    });

  const insertCell = (index: number, type: NotebookCell['type']) =>
    mutate((nb) => {
      const cells = [...nb.cells];
      cells.splice(index, 0, newCell(type));
      return { ...nb, cells };
    });

  // ---- execution --------------------------------------------------------

  const executeCell = useCallback(
    async (cellId: string) => {
      const found = notebookRef.current.cells.find((c) => c.id === cellId);
      if (!found || found.type !== 'dsl') return;
      const cell: DslCell = found;

      setRunning((s) => new Set(s).add(cellId));
      const body: ExecuteRequestBody = {
        method: cell.request.method,
        path: cell.request.path,
        body: cell.request.body,
      };
      let output: CellOutput;
      try {
        const res = await http.post<ExecuteResponseBody>(EXECUTE_ROUTE, {
          body: JSON.stringify(body),
        });
        output = { ...res, executedAt: new Date().toISOString() };
      } catch (e: any) {
        output = {
          statusCode: e?.response?.status ?? 0,
          body: e?.body ?? null,
          durationMs: 0,
          executedAt: new Date().toISOString(),
          error: e?.body?.message ?? e?.message ?? 'Request failed',
        };
      }
      setNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((c) => (c.id === cellId && c.type === 'dsl' ? { ...c, output } : c)),
      }));
      setDirty(true);
      setRunning((s) => {
        const next = new Set(s);
        next.delete(cellId);
        return next;
      });
    },
    [http]
  );

  const runAll = async () => {
    for (const c of notebook.cells) {
      if (c.type === 'dsl') {
        await executeCell(c.id);
      }
    }
  };

  const clearOutputs = () =>
    mutate((nb) => ({
      ...nb,
      cells: nb.cells.map((c) => (c.type === 'dsl' ? { ...c, output: undefined } : c)),
    }));

  // ---- persistence ------------------------------------------------------

  const save = async () => {
    try {
      if (savedId) {
        await storage.update(savedId, notebook);
      } else {
        const id = await storage.create(notebook);
        setSavedId(id);
      }
      setDirty(false);
      toasts.addSuccess(
        i18n.translate('opensearchNotebook.toast.saved', { defaultMessage: 'Notebook saved' })
      );
    } catch (e: any) {
      toasts.addDanger(
        i18n.translate('opensearchNotebook.toast.saveFailed', {
          defaultMessage: 'Failed to save notebook: {message}',
          values: { message: e?.message ?? String(e) },
        })
      );
    }
  };

  const saveAsCopy = async () => {
    try {
      const id = await storage.create({ ...notebook, title: `${notebook.title} (copy)` });
      setNotebook((nb) => ({ ...nb, title: `${nb.title} (copy)` }));
      setSavedId(id);
      setDirty(false);
      toasts.addSuccess(
        i18n.translate('opensearchNotebook.toast.savedCopy', {
          defaultMessage: 'Saved as a new notebook',
        })
      );
    } catch (e: any) {
      toasts.addDanger(e?.message ?? String(e));
    }
  };

  const newNotebook = () =>
    guardDirty(() => {
      setNotebook(emptyNotebook());
      setSavedId(undefined);
      setDirty(false);
    });

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const nb = await readNotebookFile(file);
      guardDirty(() => {
        setNotebook(nb);
        setSavedId(undefined);
        setDirty(true);
      });
      toasts.addSuccess(
        i18n.translate('opensearchNotebook.toast.imported', {
          defaultMessage: 'Imported "{title}" ({count} cells). Save it to keep it.',
          values: { title: nb.title, count: nb.cells.length },
        })
      );
    } catch (err: any) {
      toasts.addDanger(
        i18n.translate('opensearchNotebook.toast.importFailed', {
          defaultMessage: 'Import failed: {message}',
          values: { message: err?.message ?? String(err) },
        })
      );
    }
  };

  // ---- render -----------------------------------------------------------

  return (
    <div className="osnbApp" style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={2} style={{ minWidth: 240 }}>
          <EuiFieldText
            compressed
            aria-label="Notebook title"
            prepend={i18n.translate('opensearchNotebook.titleLabel', { defaultMessage: 'Title' })}
            value={notebook.title}
            onChange={(e) => mutate((nb) => ({ ...nb, title: e.target.value }))}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued">
            {savedId ? (dirty ? '● unsaved changes' : 'saved') : dirty ? '● not saved' : 'new'}
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem />
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="s" iconType="plusInCircle" onClick={newNotebook}>
            {i18n.translate('opensearchNotebook.action.new', { defaultMessage: 'New' })}
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="s" iconType="folderOpen" onClick={() => setShowSaved(true)}>
            {i18n.translate('opensearchNotebook.action.open', { defaultMessage: 'Open' })}
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton size="s" iconType="save" fill onClick={save} isDisabled={!dirty && !!savedId}>
            {i18n.translate('opensearchNotebook.action.save', { defaultMessage: 'Save' })}
          </EuiButton>
        </EuiFlexItem>
        {savedId && (
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty size="s" iconType="copy" onClick={saveAsCopy}>
              {i18n.translate('opensearchNotebook.action.saveCopy', {
                defaultMessage: 'Save as copy',
              })}
            </EuiButtonEmpty>
          </EuiFlexItem>
        )}
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="s" iconType="exportAction" onClick={() => setExportModal(true)}>
            {i18n.translate('opensearchNotebook.action.export', { defaultMessage: 'Export' })}
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            iconType="importAction"
            onClick={() => fileInputRef.current?.click()}
          >
            {i18n.translate('opensearchNotebook.action.import', { defaultMessage: 'Import' })}
          </EuiButtonEmpty>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            iconType="playFilled"
            onClick={runAll}
            isDisabled={running.size > 0}
          >
            {i18n.translate('opensearchNotebook.action.runAll', { defaultMessage: 'Run all' })}
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="s" iconType="eraser" onClick={clearOutputs}>
            {i18n.translate('opensearchNotebook.action.clearOutputs', {
              defaultMessage: 'Clear outputs',
            })}
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {notebook.cells.length === 0 ? (
        <EuiEmptyPrompt
          iconType="notebookApp"
          title={
            <h3>
              {i18n.translate('opensearchNotebook.empty.title', {
                defaultMessage: 'This notebook has no cells',
              })}
            </h3>
          }
          actions={[
            <EuiButton key="dsl" onClick={() => insertCell(0, 'dsl')}>
              {i18n.translate('opensearchNotebook.empty.addDsl', {
                defaultMessage: 'Add DSL cell',
              })}
            </EuiButton>,
            <EuiButtonEmpty key="md" onClick={() => insertCell(0, 'markdown')}>
              {i18n.translate('opensearchNotebook.empty.addMarkdown', {
                defaultMessage: 'Add Markdown cell',
              })}
            </EuiButtonEmpty>,
          ]}
        />
      ) : (
        notebook.cells.map((cell, index) => (
          <React.Fragment key={cell.id}>
            <Cell
              cell={cell}
              index={index}
              total={notebook.cells.length}
              isRunning={running.has(cell.id)}
              onChange={(c) => updateCell(index, c)}
              onRun={() => executeCell(cell.id)}
              onDelete={() => deleteCell(index)}
              onMove={(dir) => moveCell(index, dir)}
              onInsertBelow={(type) => insertCell(index + 1, type)}
            />
            <EuiSpacer size="s" />
          </React.Fragment>
        ))
      )}

      {notebook.cells.length > 0 && (
        <EuiFlexGroup gutterSize="s" justifyContent="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="s"
              iconType="plusInCircle"
              onClick={() => insertCell(notebook.cells.length, 'dsl')}
            >
              {i18n.translate('opensearchNotebook.action.addDsl', {
                defaultMessage: 'DSL cell',
              })}
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="s"
              iconType="document"
              onClick={() => insertCell(notebook.cells.length, 'markdown')}
            >
              {i18n.translate('opensearchNotebook.action.addMarkdown', {
                defaultMessage: 'Markdown cell',
              })}
            </EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
      )}

      {showSaved && (
        <SavedNotebooksFlyout
          list={() => storage.list()}
          onOpen={(id) => guardDirty(() => openSaved(id))}
          onDelete={async (id) => {
            await storage.delete(id);
            if (id === savedId) {
              setSavedId(undefined);
              setDirty(true);
            }
          }}
          onClose={() => setShowSaved(false)}
        />
      )}

      {exportModal && (
        <EuiModal onClose={() => setExportModal(false)} aria-labelledby="osnb-export-title">
          <EuiModalHeader>
            <EuiModalHeaderTitle id="osnb-export-title">
              {i18n.translate('opensearchNotebook.export.title', {
                defaultMessage: 'Export notebook',
              })}
            </EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <EuiCheckbox
              id="osnb-include-outputs"
              label={i18n.translate('opensearchNotebook.export.includeOutputs', {
                defaultMessage: 'Include cell outputs (query results)',
              })}
              checked={includeOutputs}
              onChange={(e) => setIncludeOutputs(e.target.checked)}
            />
          </EuiModalBody>
          <EuiModalFooter>
            <EuiButtonEmpty onClick={() => setExportModal(false)}>
              {i18n.translate('opensearchNotebook.cancel', { defaultMessage: 'Cancel' })}
            </EuiButtonEmpty>
            <EuiButton
              fill
              onClick={() => {
                downloadNotebookFile(notebook, includeOutputs);
                setExportModal(false);
              }}
            >
              {i18n.translate('opensearchNotebook.export.download', {
                defaultMessage: 'Download',
              })}
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}

      {confirmDiscard && (
        <EuiConfirmModal
          aria-label={i18n.translate('opensearchNotebook.discard.title', {
            defaultMessage: 'Discard unsaved changes?',
          })}
          title={i18n.translate('opensearchNotebook.discard.title', {
            defaultMessage: 'Discard unsaved changes?',
          })}
          onCancel={() => setConfirmDiscard(null)}
          onConfirm={() => {
            const action = confirmDiscard;
            setConfirmDiscard(null);
            action();
          }}
          cancelButtonText={i18n.translate('opensearchNotebook.cancel', {
            defaultMessage: 'Cancel',
          })}
          confirmButtonText={i18n.translate('opensearchNotebook.discard.confirm', {
            defaultMessage: 'Discard',
          })}
          buttonColor="danger"
        >
          <p>
            {i18n.translate('opensearchNotebook.discard.body', {
              defaultMessage: 'The current notebook has unsaved changes that will be lost.',
            })}
          </p>
        </EuiConfirmModal>
      )}
    </div>
  );
};
