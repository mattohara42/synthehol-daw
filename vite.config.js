import { defineConfig } from 'vite';

export default defineConfig({
  // On GitHub Pages the app is served from a subpath
  // (https://mattohara42.github.io/synthehol-daw/), so its build needs that as
  // the base for assets/worker URLs to resolve. Only the Pages CI build opts in
  // via GITHUB_PAGES=true (set in .github/workflows/deploy.yml) — local
  // dev/build/preview stay at "/" so `npm run dev`, `dev:live`, and `preview`
  // all serve at http://localhost:<port>/ as usual.
  base: process.env.GITHUB_PAGES === 'true' ? '/synthehol-daw/' : '/',
  root: '.',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    passWithNoTests: true,
  },
});
