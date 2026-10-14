import { DslRequest, HTTP_METHODS, HttpMethod } from './index';

const METHOD_LINE = new RegExp(`^\\s*(${HTTP_METHODS.join('|')})\\s+(\\S+)\\s*$`, 'i');
const COMMENT_LINE = /^\s*(#|\/\/)/;

/**
 * Parse text in the Dev Tools Console format into one or more requests:
 *
 *   GET posts/_search
 *   { "query": { "match_all": {} } }
 *
 *   # comment
 *   POST posts/_doc
 *   { "title": "x" }
 *
 * Returns an empty array when the text does not start with a method line,
 * so callers can fall back to treating it as a plain body.
 */
export function parseConsoleRequests(text: string): DslRequest[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const requests: DslRequest[] = [];
  let current: { method: HttpMethod; path: string; body: string[] } | undefined;

  for (const line of lines) {
    const m = METHOD_LINE.exec(line);
    if (m) {
      if (current) requests.push(finish(current));
      current = { method: m[1].toUpperCase() as HttpMethod, path: m[2], body: [] };
      continue;
    }
    if (!current) {
      // Leading comments / blank lines before the first method line are fine; anything else
      // means this is not Console-formatted text.
      if (line.trim() === '' || COMMENT_LINE.test(line)) continue;
      return [];
    }
    if (COMMENT_LINE.test(line)) continue;
    current.body.push(line);
  }
  if (current) requests.push(finish(current));
  return requests;
}

function finish(r: { method: HttpMethod; path: string; body: string[] }): DslRequest {
  // Drop leading/trailing blank lines but keep internal formatting (NDJSON for _bulk etc.).
  const body = r.body
    .join('\n')
    .replace(/^\s*\n/, '')
    .replace(/\s+$/, '');
  return { method: r.method, path: r.path, body };
}

/** Render a request back into Console format (used for copy-to-Console). */
export function toConsoleText(req: DslRequest): string {
  return req.body.trim() ? `${req.method} ${req.path}\n${req.body}` : `${req.method} ${req.path}`;
}
