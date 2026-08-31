/**
 * Writes the OpenAPI 3 document to backend/openapi.json.
 *
 *   npm run openapi:generate            # pulls from a running server
 *   OPENAPI_URL=http://host/api/v1/docs-json npm run openapi:generate
 *
 * It fetches GET /api/v1/docs-json from a running instance because that
 * document is produced by `nest build` with the @nestjs/swagger CLI plugin
 * active (see nest-cli.json) — it has the full request/response schemas the
 * plugin derives from the class-validator DTOs. Start the server first
 * (npm run start:prod), then run this.
 *
 * The live equivalents are GET /api/v1/docs (Swagger UI) and
 * GET /api/v1/docs-json (this same document).
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const url =
    process.env.OPENAPI_URL ?? 'http://localhost:3001/api/v1/docs-json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}. Is the server running?`);
  }
  const document: any = await res.json();

  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');

  const paths = Object.keys(document.paths ?? {}).length;
  const ops = Object.values<Record<string, unknown>>(document.paths ?? {}).reduce(
    (n, item) => n + Object.keys(item).length,
    0,
  );
  const schemas = Object.keys(document.components?.schemas ?? {}).length;
  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${outPath} — ${paths} paths, ${ops} operations, ${schemas} schemas.`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message ?? err);
  process.exit(1);
});
