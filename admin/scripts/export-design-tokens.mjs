/** Export the canonical CSS tokens as machine-readable JSON for design handoff.
 * Usage: npm run design:tokens
 * No dependencies or network access required.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(projectRoot, 'src/styles/tokens.css'), 'utf8');

function extract(selector) {
  const safe = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${safe}\\s*\\{([^}]+)\\}`));
  if (!match) throw new Error(`Missing ${selector} token block`);
  const entries = [...match[1].matchAll(/(--[a-z\d-]+):\s*([^;]+);/gi)];
  if (entries.length < 35) throw new Error(`Missing tokens in ${selector}: ${entries.length} found`);
  return Object.fromEntries(entries.map(([, key, value]) => [key.slice(2), value.trim()]));
}

const light = extract(':root');
const dark = extract(':root.dark');
const output = {
  $description: 'BrainPulses semantic tokens: canonical declarations are in src/styles/tokens.css',
  $source: 'src/styles/tokens.css',
  $brand: { name: 'BrainPulses', svg: 'public/brand.svg', logoHex: '#45058F' },
  light,
  dark,
};
const file = resolve(projectRoot, 'docs/design-system/tokens.json');
writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
console.log(`Exported ${Object.keys(light).length} light and ${Object.keys(dark).length} dark tokens to docs/design-system/tokens.json`);
