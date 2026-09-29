import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('la página de Conversaciones mantiene su adaptador interno fuera de los exports de Next', () => {
  const fuente = readFileSync(new URL('../app/(panel)/conversaciones/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /export\s+function\s+autorDe\b/);
  assert.match(fuente, /autor:\s*autorDe\(m\)/);
});
