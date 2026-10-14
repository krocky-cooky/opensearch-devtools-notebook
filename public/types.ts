/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import { DevToolsSetup } from '../../../src/plugins/dev_tools/public';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OpensearchNotebookPluginSetup {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OpensearchNotebookPluginStart {}

export interface SetupDependencies {
  devTools: DevToolsSetup;
}
