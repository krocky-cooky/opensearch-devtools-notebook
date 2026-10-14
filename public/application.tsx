import React from 'react';
import ReactDOM from 'react-dom';
import { CoreStart } from '../../../src/core/public';
import { OpenSearchDashboardsContextProvider } from '../../../src/plugins/opensearch_dashboards_react/public';
import { NotebookApp } from './components/notebook_app';

export const renderApp = (core: CoreStart, element: HTMLElement) => {
  const {
    i18n: { Context: I18nContext },
  } = core;

  ReactDOM.render(
    <I18nContext>
      <OpenSearchDashboardsContextProvider services={core}>
        <NotebookApp
          http={core.http}
          notifications={core.notifications}
          savedObjects={core.savedObjects.client}
        />
      </OpenSearchDashboardsContextProvider>
    </I18nContext>,
    element
  );

  return () => ReactDOM.unmountComponentAtNode(element);
};
