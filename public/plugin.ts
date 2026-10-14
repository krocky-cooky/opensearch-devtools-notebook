/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import { i18n } from '@osd/i18n';
import { CoreSetup, CoreStart, Plugin } from '../../../src/core/public';
import {
  OpensearchNotebookPluginSetup,
  OpensearchNotebookPluginStart,
  SetupDependencies,
} from './types';

export class OpensearchNotebookPlugin implements Plugin<
  OpensearchNotebookPluginSetup,
  OpensearchNotebookPluginStart,
  SetupDependencies
> {
  public setup(core: CoreSetup, { devTools }: SetupDependencies): OpensearchNotebookPluginSetup {
    devTools.register({
      id: 'notebook',
      title: i18n.translate('opensearchNotebook.devToolsTabTitle', {
        defaultMessage: 'Notebook',
      }),
      order: 10,
      enableRouting: false,
      mount: async ({ element }) => {
        const [coreStart] = await core.getStartServices();
        const { renderApp } = await import('./application');
        return renderApp(coreStart, element);
      },
    });
    return {};
  }

  public start(core: CoreStart): OpensearchNotebookPluginStart {
    return {};
  }

  public stop() {}
}
