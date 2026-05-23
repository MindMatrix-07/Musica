import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Helper to resolve paths case-insensitively (fixes OS/Git case mismatch on Linux servers)
function findCaseInsensitivePath(target: string): string | null {
  if (fs.existsSync(target)) return target;

  const parts = path.normalize(target).split(path.sep);
  let current = '';

  if (target.startsWith('/')) {
    current = '/';
  } else if (parts[0] && parts[0].includes(':')) {
    current = parts[0] + path.sep;
    parts.shift();
  }

  for (const part of parts) {
    if (!part) continue;
    const currentLower = part.toLowerCase();

    try {
      if (!fs.existsSync(current)) return null;
      const files = fs.readdirSync(current);
      const matched = files.find((f) => f.toLowerCase() === currentLower);
      if (!matched) return null;
      current = path.join(current, matched);
    } catch {
      return null;
    }
  }
  return current;
}

const caseInsensitiveResolver = () => {
  return {
    name: 'case-insensitive-resolver',
    resolveId(source: string, importer: string | undefined) {
      if (source.startsWith('@/') || source.startsWith('.') || source.startsWith('..')) {
        let absolutePath = '';
        if (source.startsWith('@/')) {
          absolutePath = path.resolve(__dirname, 'src', source.slice(2));
        } else if (importer) {
          absolutePath = path.resolve(path.dirname(importer), source);
        } else {
          return null;
        }

        const exts = ['', '.tsx', '.ts', '.jsx', '.js', '.json'];
        for (const ext of exts) {
          const testPath = absolutePath + ext;
          const resolved = findCaseInsensitivePath(testPath);
          if (resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            return resolved;
          }
        }
      }
      return null;
    }
  };
};

export default defineConfig(() => {
  return {
    plugins: [caseInsensitiveResolver(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
