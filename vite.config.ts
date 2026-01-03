import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'restructure-output',
      closeBundle() {
        // copy manifest to dist
        copyFileSync('manifest.json', 'dist/manifest.json');

        // create icons dir
        if (!existsSync('dist/icons')) {
          mkdirSync('dist/icons', { recursive: true });
        }

        // copy icons if they exist
        if (existsSync('public/icons')) {
          for (const icon of ['icon16.png', 'icon48.png', 'icon128.png']) {
            if (existsSync(`public/icons/${icon}`)) {
              copyFileSync(`public/icons/${icon}`, `dist/icons/${icon}`);
            }
          }
        }

        // move HTML files from dist/src/* to dist/* and fix paths
        if (existsSync('dist/src/sidepanel')) {
          if (!existsSync('dist/sidepanel')) {
            mkdirSync('dist/sidepanel', { recursive: true });
          }
          if (existsSync('dist/src/sidepanel/index.html')) {
            let html = readFileSync('dist/src/sidepanel/index.html', 'utf-8');
            // fix paths for sidepanel/index.html
            html = html.replace(/\.\.\/\.\.\/sidepanel\//g, './');
            html = html.replace(/\.\.\/\.\.\/chunks\//g, '../chunks/');
            writeFileSync('dist/sidepanel/index.html', html);
          }
        }

        if (existsSync('dist/src/offscreen')) {
          if (!existsSync('dist/offscreen')) {
            mkdirSync('dist/offscreen', { recursive: true });
          }
          if (existsSync('dist/src/offscreen/audio.html')) {
            let html = readFileSync('dist/src/offscreen/audio.html', 'utf-8');
            // fix paths for offscreen/audio.html
            html = html.replace(/\.\.\/\.\.\/offscreen\//g, './');
            html = html.replace(/\.\.\/\.\.\/chunks\//g, '../chunks/');
            writeFileSync('dist/offscreen/audio.html', html);
          }
        }

        // clean up dist/src
        if (existsSync('dist/src')) {
          rmSync('dist/src', { recursive: true, force: true });
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        offscreen: resolve(__dirname, 'src/offscreen/audio.html')
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background/index.js';
          if (chunk.name === 'content') return 'content/index.js';
          return '[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'sidepanel/styles.css';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
