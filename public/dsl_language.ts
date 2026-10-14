/*
 * Copyright 2026 Takuo Kuroki
 * SPDX-License-Identifier: Apache-2.0
 */

import { monaco } from '@osd/monaco';

/**
 * Language id used by DSL body editors. OSD's Monaco build does not ship the
 * basic-languages JSON tokenizer (plain `json` renders without colours) and the
 * `xjson` language's worker fails to load outside Console, so register a small
 * Monarch grammar of our own. Token names match the CodeEditor theme
 * (`string.key.json`, `string.value.json`, `number`, `keyword`, `delimiter`).
 */
export const DSL_BODY_LANGUAGE_ID = 'osnb-json';

let registered = false;

export function registerDslBodyLanguage() {
  if (registered) return;
  registered = true;
  if (monaco.languages.getLanguages().some((l) => l.id === DSL_BODY_LANGUAGE_ID)) return;

  monaco.languages.register({ id: DSL_BODY_LANGUAGE_ID });

  monaco.languages.setLanguageConfiguration(DSL_BODY_LANGUAGE_ID, {
    brackets: [
      ['{', '}'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
    ],
    comments: { lineComment: '//' },
  });

  monaco.languages.setMonarchTokensProvider(DSL_BODY_LANGUAGE_ID, {
    defaultToken: '',
    tokenPostfix: '.json',
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/#.*$/, 'comment'],
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key'],
        [/"(?:[^"\\]|\\.)*"/, 'string.value'],
        [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/\b(?:true|false|null)\b/, 'keyword'],
        [/[{}[\]]/, '@brackets'],
        [/[,:]/, 'delimiter'],
        [/\s+/, 'white'],
      ],
    },
  } as monaco.languages.IMonarchLanguage);
}
