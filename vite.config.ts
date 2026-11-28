import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function cloudflareSubpathRedirects(): Plugin {
  return {
    name: 'cloudflare-subpath-redirects',
    closeBundle() {
      const distRoot = path.resolve('dist');
      if (!fs.existsSync(distRoot)) return;
      const redirectsContent = [
        '/toolkit/allvoices /toolkit/index.html 200',
        '/toolkit/allvoices/ /toolkit/index.html 200',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(distRoot, '_redirects'), redirectsContent, 'utf8');
    },
  };
}

export default defineConfig({
  base: '/toolkit/',
  build: {
    outDir: 'dist/toolkit',
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss(), cloudflareSubpathRedirects()],
});
