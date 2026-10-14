import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  EuiButtonIcon,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiMarkdownFormat,
  EuiPanel,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTextArea,
  EuiToolTip,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { CodeEditor } from '../../../../src/plugins/opensearch_dashboards_react/public';
import {
  DslCell,
  DslRequest,
  HTTP_METHODS,
  HttpMethod,
  MarkdownCell,
  NotebookCell,
} from '../../common';
import { parseConsoleRequests, toConsoleText } from '../../common/console_request';
import { DSL_BODY_LANGUAGE_ID, registerDslBodyLanguage } from '../dsl_language';
import { CellOutputView } from './cell_output';

registerDslBodyLanguage();

interface Props {
  cell: NotebookCell;
  index: number;
  total: number;
  isRunning: boolean;
  onChange: (cell: NotebookCell) => void;
  onRun: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onInsertBelow: (type: NotebookCell['type']) => void;
  /** Called when Console-formatted text with several requests is pasted into a DSL cell. */
  onInsertRequestsBelow: (requests: DslRequest[]) => void;
}

const methodOptions = HTTP_METHODS.map((m) => ({ value: m, text: m }));

const CellToolbar: React.FC<
  Omit<Props, 'onChange' | 'cell'> & {
    label: string;
    runIcon: string;
    runTooltip: string;
    onCopyConsole?: () => void;
  }
> = ({
  index,
  total,
  isRunning,
  onRun,
  onDelete,
  onMove,
  onInsertBelow,
  label,
  runIcon,
  runTooltip,
  onCopyConsole,
}) => (
  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
    <EuiFlexItem grow={false}>
      <EuiText size="xs" color="subdued">
        [{index + 1}] {label}
      </EuiText>
    </EuiFlexItem>
    <EuiFlexItem />
    {onCopyConsole && (
      <EuiFlexItem grow={false}>
        <EuiToolTip
          content={i18n.translate('opensearchNotebook.cell.copyConsole', {
            defaultMessage: 'Copy as Console request',
          })}
        >
          <EuiButtonIcon
            iconType="copyClipboard"
            aria-label="Copy as Console request"
            onClick={onCopyConsole}
          />
        </EuiToolTip>
      </EuiFlexItem>
    )}
    <EuiFlexItem grow={false}>
      <EuiToolTip content={runTooltip}>
        {isRunning ? (
          <EuiLoadingSpinner size="m" />
        ) : (
          <EuiButtonIcon iconType={runIcon} aria-label={runTooltip} onClick={onRun} />
        )}
      </EuiToolTip>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiToolTip content="Move up">
        <EuiButtonIcon
          iconType="sortUp"
          aria-label="Move up"
          isDisabled={index === 0}
          onClick={() => onMove(-1)}
        />
      </EuiToolTip>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiToolTip content="Move down">
        <EuiButtonIcon
          iconType="sortDown"
          aria-label="Move down"
          isDisabled={index === total - 1}
          onClick={() => onMove(1)}
        />
      </EuiToolTip>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiToolTip
        content={i18n.translate('opensearchNotebook.cell.addDsl', {
          defaultMessage: 'Insert DSL cell below',
        })}
      >
        <EuiButtonIcon
          iconType="plusInCircle"
          aria-label="Insert DSL cell below"
          onClick={() => onInsertBelow('dsl')}
        />
      </EuiToolTip>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiToolTip
        content={i18n.translate('opensearchNotebook.cell.addMarkdown', {
          defaultMessage: 'Insert Markdown cell below',
        })}
      >
        <EuiButtonIcon
          iconType="document"
          aria-label="Insert Markdown cell below"
          onClick={() => onInsertBelow('markdown')}
        />
      </EuiToolTip>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiToolTip content="Delete cell">
        <EuiButtonIcon
          iconType="trash"
          color="danger"
          aria-label="Delete cell"
          onClick={onDelete}
        />
      </EuiToolTip>
    </EuiFlexItem>
  </EuiFlexGroup>
);

const DslCellBody: React.FC<{
  cell: DslCell;
  onChange: (cell: DslCell) => void;
  onRun: () => void;
  onInsertRequestsBelow: (requests: DslRequest[]) => void;
}> = ({ cell, onChange, onRun, onInsertRequestsBelow }) => {
  const update = (patch: Partial<DslCell['request']>) =>
    onChange({ ...cell, request: { ...cell.request, ...patch } });

  // Pasting Console-formatted text ("GET index/_search" + body) anywhere in the cell fills the
  // method dropdown, path and body. Additional requests become new cells below this one.
  // Captured on the wrapper so it works for both the path field and the Monaco textarea.
  const onPasteCapture = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    const requests = parseConsoleRequests(text);
    if (requests.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const [first, ...rest] = requests;
    onChange({ ...cell, request: first });
    if (rest.length) onInsertRequestsBelow(rest);
  };

  // Keep the latest onRun in a ref so the Monaco keybinding registered once stays current.
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onRun();
    }
  };

  const lineCount = Math.max(3, Math.min(30, cell.request.body.split('\n').length + 1));

  return (
    <div onPasteCapture={onPasteCapture}>
      <EuiFlexGroup gutterSize="s" responsive={false} onKeyDown={onKeyDown}>
        <EuiFlexItem grow={false} style={{ width: 120 }}>
          <EuiSelect
            compressed
            aria-label="HTTP method"
            options={methodOptions}
            value={cell.request.method}
            onChange={(e) => update({ method: e.target.value as HttpMethod })}
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiFieldText
            compressed
            aria-label="Request path"
            placeholder={i18n.translate('opensearchNotebook.cell.pathPlaceholder', {
              defaultMessage: 'my-index/_search  (or paste a Console request here)',
            })}
            value={cell.request.path}
            onChange={(e) => update({ path: e.target.value })}
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="xs" />
      <div className="osnbBodyEditor">
        <CodeEditor
          languageId={DSL_BODY_LANGUAGE_ID}
          height={`${lineCount * 19}px`}
          value={cell.request.body}
          onChange={(body) => update({ body })}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            fontSize: 12,
            lineHeight: 19,
            renderLineHighlight: 'all',
            renderWhitespace: 'none',
            guides: { indentation: true, bracketPairs: true },
            bracketPairColorization: { enabled: true },
            scrollBeyondLastLine: false,
            scrollbar: { alwaysConsumeMouseWheel: false },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            automaticLayout: true,
            wordWrap: 'on',
            padding: { top: 4, bottom: 4 },
          }}
          editorDidMount={(editor) => {
            // Shift+Enter runs the cell, like Jupyter.
            editor.addCommand(
              // monaco.KeyMod.Shift | monaco.KeyCode.Enter
              // eslint-disable-next-line no-bitwise
              1024 | 3,
              () => onRunRef.current()
            );
          }}
        />
      </div>
    </div>
  );
};

const MarkdownCellBody: React.FC<{
  cell: MarkdownCell;
  onChange: (cell: MarkdownCell) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
}> = ({ cell, onChange, editing, setEditing }) => {
  if (editing) {
    return (
      <EuiTextArea
        fullWidth
        compressed
        autoFocus
        rows={Math.max(3, cell.markdown.split('\n').length + 1)}
        value={cell.markdown}
        placeholder={i18n.translate('opensearchNotebook.cell.markdownPlaceholder', {
          defaultMessage: 'Write Markdown here. Shift+Enter to render.',
        })}
        onChange={(e) => onChange({ ...cell, markdown: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <div
      onDoubleClick={() => setEditing(true)}
      title={i18n.translate('opensearchNotebook.cell.markdownEditHint', {
        defaultMessage: 'Double-click to edit',
      })}
      style={{ cursor: 'text', minHeight: 24 }}
    >
      {cell.markdown.trim() ? (
        <EuiMarkdownFormat>{cell.markdown}</EuiMarkdownFormat>
      ) : (
        <EuiText size="s" color="subdued">
          <em>
            {i18n.translate('opensearchNotebook.cell.emptyMarkdown', {
              defaultMessage: '(empty Markdown cell — double-click to edit)',
            })}
          </em>
        </EuiText>
      )}
    </div>
  );
};

export const Cell: React.FC<Props> = (props) => {
  const { cell, onChange, onRun, onInsertRequestsBelow } = props;
  const [editing, setEditing] = useState(cell.type === 'markdown' && !cell.markdown);

  const handleRun = useCallback(() => {
    if (cell.type === 'markdown') {
      setEditing(false);
      return;
    }
    onRun();
  }, [cell.type, onRun]);

  return (
    <EuiPanel paddingSize="s" hasShadow={false} hasBorder className="osnbCell">
      <CellToolbar
        {...props}
        onRun={cell.type === 'markdown' ? () => setEditing((v) => !v) : handleRun}
        label={cell.type === 'dsl' ? 'DSL' : 'Markdown'}
        runIcon={cell.type === 'dsl' ? 'play' : editing ? 'eye' : 'pencil'}
        onCopyConsole={
          cell.type === 'dsl'
            ? () => navigator.clipboard?.writeText(toConsoleText(cell.request))
            : undefined
        }
        runTooltip={
          cell.type === 'dsl'
            ? i18n.translate('opensearchNotebook.cell.runTooltip', {
                defaultMessage: 'Run cell (Shift+Enter)',
              })
            : editing
              ? i18n.translate('opensearchNotebook.cell.renderTooltip', {
                  defaultMessage: 'Render Markdown (Shift+Enter)',
                })
              : i18n.translate('opensearchNotebook.cell.editTooltip', {
                  defaultMessage: 'Edit Markdown',
                })
        }
      />
      <EuiSpacer size="xs" />
      {cell.type === 'dsl' ? (
        <>
          <DslCellBody
            cell={cell}
            onChange={onChange}
            onRun={handleRun}
            onInsertRequestsBelow={onInsertRequestsBelow}
          />
          {cell.output && (
            <>
              <EuiSpacer size="s" />
              <CellOutputView output={cell.output} />
            </>
          )}
        </>
      ) : (
        <MarkdownCellBody
          cell={cell}
          onChange={onChange}
          editing={editing}
          setEditing={setEditing}
        />
      )}
    </EuiPanel>
  );
};
