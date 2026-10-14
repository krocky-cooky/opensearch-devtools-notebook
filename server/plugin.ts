import {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '../../../src/core/server';

import { OpensearchNotebookPluginSetup, OpensearchNotebookPluginStart } from './types';
import { defineRoutes } from './routes';

export class OpensearchNotebookPlugin
  implements Plugin<OpensearchNotebookPluginSetup, OpensearchNotebookPluginStart> {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('opensearch_notebook: Setup');
    const router = core.http.createRouter();

    // Register server side APIs
    defineRoutes(router);

    return {};
  }

  public start(core: CoreStart) {
    this.logger.debug('opensearch_notebook: Started');
    return {};
  }

  public stop() {}
}
