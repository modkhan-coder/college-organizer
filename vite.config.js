import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Custom plugin: strips `crossorigin` attribute from built index.html.
// Vite adds crossorigin to module scripts automatically, but Capacitor's
// WKWebView loads from capacitor://localhost (local filesystem) — there is
// no cross-origin context, so the attribute silently blocks script execution
// and causes a blank white screen on iOS.
const removeCrossOrigin = () => ({
  name: 'remove-crossorigin',
  transformIndexHtml(html) {
    return html
      .replace(/<script([^>]*?) crossorigin([^>]*)>/g, '<script$1$2>')
      .replace(/<link([^>]*?) crossorigin([^>]*?)>/g, '<link$1$2>');
  }
});

export default defineConfig({
  // Use relative paths so Capacitor's WKWebView can resolve assets from the filesystem
  base: './',
  plugins: [
    removeCrossOrigin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'College Organizer',
        short_name: 'Organizer',
        description: 'AI-powered College Organizer & Planner',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Only split libraries that are truly self-contained with no peer deps.
          // DO NOT split React/ReactDOM/router — doing so causes circular chunks
          // that break WKWebView's module execution order.

          // PDF.js is huge and self-contained — safe to split
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdf';
          }
          // KaTeX is self-contained CSS/math renderer
          if (id.includes('node_modules/katex') || id.includes('node_modules/rehype-katex') || id.includes('node_modules/remark-math') || id.includes('node_modules/micromark')) {
            return 'vendor-katex';
          }
          // Recharts + D3 — large but self-contained
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
        }
      }
    }
  }
})

