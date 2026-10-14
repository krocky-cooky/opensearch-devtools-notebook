/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '../../../src/core/server';

import { OpensearchNotebookPluginSetup, OpensearchNotebookPluginStart } from './types';
import { defineRoutes } from './routes';
import { notebookSavedObjectType } from './saved_objects';

export class OpensearchNotebookPlugin implements Plugin<
  OpensearchNotebookPluginSetup,
  OpensearchNotebookPluginStart
> {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('opensearchNotebook: Setup');
    core.savedObjects.registerType(notebookSavedObjectType);
    defineRoutes(core.http.createRouter());
    return {};
  }

  public start(core: CoreStart) {
    this.logger.debug('opensearchNotebook: Started');
    return {};
  }

  public stop() {}
}
