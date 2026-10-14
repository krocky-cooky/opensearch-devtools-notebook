/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  EuiBasicTable,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiText,
  EuiTitle,
  EuiToolTip,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { SavedNotebookSummary } from '../storage';

interface Props {
  list: () => Promise<SavedNotebookSummary[]>;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export const SavedNotebooksFlyout: React.FC<Props> = ({ list, onOpen, onDelete, onClose }) => {
  const [items, setItems] = useState<SavedNotebookSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <EuiFlyout onClose={onClose} size="m" ownFocus aria-labelledby="osnb-saved-title">
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="m">
          <h2 id="osnb-saved-title">
            {i18n.translate('opensearchNotebook.saved.title', {
              defaultMessage: 'Saved notebooks',
            })}
          </h2>
        </EuiTitle>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <EuiBasicTable
          tableCaption="Saved notebooks"
          items={items}
          loading={loading}
          noItemsMessage={i18n.translate('opensearchNotebook.saved.empty', {
            defaultMessage: 'No saved notebooks yet.',
          })}
          columns={[
            {
              field: 'title',
              name: i18n.translate('opensearchNotebook.saved.colTitle', {
                defaultMessage: 'Title',
              }),
              render: (title: string, item: SavedNotebookSummary) => (
                <EuiButtonEmpty size="xs" flush="left" onClick={() => onOpen(item.id)}>
                  {title}
                </EuiButtonEmpty>
              ),
            },
            {
              field: 'description',
              name: i18n.translate('opensearchNotebook.saved.colDescription', {
                defaultMessage: 'Description',
              }),
              truncateText: true,
            },
            {
              field: 'updatedAt',
              name: i18n.translate('opensearchNotebook.saved.colUpdated', {
                defaultMessage: 'Updated',
              }),
              width: '180px',
              render: (v?: string) => (
                <EuiText size="xs">{v ? new Date(v).toLocaleString() : ''}</EuiText>
              ),
            },
            {
              name: '',
              width: '40px',
              render: (item: SavedNotebookSummary) => (
                <EuiToolTip content="Delete notebook">
                  <EuiButtonIcon
                    iconType="trash"
                    color="danger"
                    aria-label="Delete notebook"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${item.title}"?`)) return;
                      await onDelete(item.id);
                      await refresh();
                    }}
                  />
                </EuiToolTip>
              ),
            },
          ]}
        />
      </EuiFlyoutBody>
    </EuiFlyout>
  );
};
