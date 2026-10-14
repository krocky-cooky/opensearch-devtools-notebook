import { PluginInitializerContext } from '../../../src/core/server';
import { OpensearchNotebookPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, OpenSearch Dashboards Platform `plugin()` initializer.

export function plugin(initializerContext: PluginInitializerContext) {
  return new OpensearchNotebookPlugin(initializerContext);
}

export { OpensearchNotebookPluginSetup, OpensearchNotebookPluginStart } from './types';
