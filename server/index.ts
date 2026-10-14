/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import { PluginInitializerContext } from '../../../src/core/server';
import { OpensearchNotebookPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, OpenSearch Dashboards Platform `plugin()` initializer.

export function plugin(initializerContext: PluginInitializerContext) {
  return new OpensearchNotebookPlugin(initializerContext);
}

export { OpensearchNotebookPluginSetup, OpensearchNotebookPluginStart } from './types';
