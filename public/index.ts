import './index.scss';

import { OpensearchNotebookPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, OpenSearch Dashboards Platform `plugin()` initializer.
export function plugin() {
  return new OpensearchNotebookPlugin();
}
export { OpensearchNotebookPluginSetup, OpensearchNotebookPluginStart } from './types';
