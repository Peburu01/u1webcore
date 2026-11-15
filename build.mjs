// Builds dist/:
//   index.mjs               pure core (browser + node), used by the dashboard
//   astro/integration.mjs   Astro integration (node)
//   astro/middleware.mjs    Astro middleware; imports the virtual data module the integration provides
//   cli.mjs                 `u1webcore audit dist/`
// Each file is self-contained so the dashboard can mount them into a WebContainer as-is.
import { watch } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { build } from 'rolldown';

async function buildAll() {
  const t = performance.now();
  await build({
    input: { index: 'src/index.ts' },
    platform: 'neutral',
    output: { dir: 'dist', format: 'esm', entryFileNames: '[name].mjs' },
  });
  for (const name of ['integration', 'middleware']) {
    await build({
      input: { [name]: `src/astro/${name}.ts` },
      platform: 'node',
      external: [/^node:/, /^virtual:/, /^astro(\/|$)/],
      output: { dir: 'dist/astro', format: 'esm', entryFileNames: '[name].mjs', codeSplitting: false },
    });
  }
  await build({
    input: { cli: 'src/cli.ts' },
    platform: 'node',
    external: [/^node:/],
    output: { dir: 'dist', format: 'esm', entryFileNames: '[name].mjs', codeSplitting: false, banner: '#!/usr/bin/env node' },
  });
  // Share cards: resvg's wasm and the Inter font, read next to the integration at run time.
  await Promise.all([
    copyFile('node_modules/@resvg/resvg-wasm/index_bg.wasm', 'dist/astro/resvg.wasm'),
    copyFile('node_modules/@fontsource/inter/files/inter-latin-400-normal.woff', 'dist/astro/inter-400.woff'),
    copyFile('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff', 'dist/astro/inter-700.woff'),
  ]);
  console.log(`[u1webcore] built dist/ in ${Math.round(performance.now() - t)}ms`);
}

await buildAll();

if (process.argv.includes('--watch')) {
  let timer;
  watch('src', { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildAll().catch((err) => console.error('[u1webcore] build failed:', err.message)), 80);
  });
  console.log('[u1webcore] watching src/');
}
