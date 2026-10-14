// Flat ESLint config. The plugin lives in OSD's plugins/ (possibly via symlink),
// so resolve the shared config relative to the OpenSearch Dashboards root.
const path = require('node:path');
const { createRequire } = require('node:module');

const osdRoot = process.env.OSD_ROOT || path.resolve(__dirname, '..', '..');
const osdRequire = createRequire(path.join(osdRoot, 'package.json'));

const osdConfig = osdRequire('@elastic/eslint-config-kibana');
const { eui } = osdRequire('@elastic/eslint-config-kibana/extras');

module.exports = [
  ...osdConfig,
  ...eui,
  {
    rules: {
      '@osd/eslint/require-license-header': 'off',
    },
  },
];
