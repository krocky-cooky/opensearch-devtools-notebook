import { SavedObjectsType } from '../../../src/core/server';
import { NOTEBOOK_SAVED_OBJECT_TYPE } from '../common';

/**
 * Notebook saved object. Cells are stored as a JSON string so that
 * the .kibana mapping does not grow with the notebook content.
 */
export const notebookSavedObjectType: SavedObjectsType = {
  name: NOTEBOOK_SAVED_OBJECT_TYPE,
  hidden: false,
  namespaceType: 'single',
  management: {
    defaultSearchField: 'title',
    importableAndExportable: true,
    icon: 'notebookApp',
    getTitle(obj) {
      return obj.attributes.title;
    },
    getInAppUrl(obj) {
      return {
        path: `/app/dev_tools#/notebook?id=${encodeURIComponent(obj.id)}`,
        uiCapabilitiesPath: 'dev_tools.show',
      };
    },
  },
  mappings: {
    dynamic: false,
    properties: {
      title: { type: 'text' },
      description: { type: 'text' },
      cells: { type: 'text', index: false },
      schemaVersion: { type: 'integer' },
    },
  },
  migrations: {},
};
