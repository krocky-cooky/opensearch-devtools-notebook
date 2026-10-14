import { schema } from '@osd/config-schema';
import { IRouter } from '../../../../src/core/server';
import { EXECUTE_ROUTE, HTTP_METHODS, ExecuteResponseBody } from '../../common';

/** Normalize a user supplied path: ensure a single leading slash, split query string. */
function splitPath(raw: string): { path: string; querystring?: Record<string, string> } {
  const trimmed = raw.trim();
  const [p, qs] = trimmed.split('?', 2);
  const path = p.startsWith('/') ? p : `/${p}`;
  if (!qs) return { path };
  const querystring: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(qs).entries()) {
    querystring[k] = v;
  }
  return { path, querystring };
}

/** Parse the body text; fall back to the raw string for NDJSON / non JSON payloads. */
function parseBody(text: string | undefined): Record<string, any> | string | undefined {
  if (!text || !text.trim()) return undefined;
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return text;
  }
}

export function defineRoutes(router: IRouter) {
  router.post(
    {
      path: EXECUTE_ROUTE,
      validate: {
        body: schema.object({
          method: schema.oneOf(HTTP_METHODS.map((m) => schema.literal(m)) as any),
          path: schema.string({ minLength: 1, maxLength: 4096 }),
          body: schema.maybe(schema.string({ maxLength: 10 * 1024 * 1024 })),
        }),
      },
    },
    async (context, request, response) => {
      const { method, path, body } = request.body;
      const { path: cleanPath, querystring } = splitPath(path);
      const client = context.core.opensearch.client.asCurrentUser;
      const started = Date.now();

      try {
        const result = await client.transport.request(
          {
            method,
            path: cleanPath,
            querystring,
            body: parseBody(body),
          },
          { ignore: [400, 401, 403, 404, 405, 409, 429] }
        );
        const payload: ExecuteResponseBody = {
          statusCode: result.statusCode ?? 200,
          body: result.body,
          durationMs: Date.now() - started,
        };
        return response.ok({ body: payload });
      } catch (err: any) {
        // Non-ignored errors (5xx, connection failures) still return a 200 to the UI
        // with the error captured, so the notebook can render it as cell output.
        const payload: ExecuteResponseBody = {
          statusCode: err?.statusCode ?? 500,
          body: err?.body ?? { error: err?.message ?? 'Unknown error' },
          durationMs: Date.now() - started,
        };
        return response.ok({ body: payload });
      }
    }
  );
}
