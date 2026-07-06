import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-router-dom')) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-map';
          if (id.includes('jsqr')) return 'vendor-qr';
          if (id.includes('lucide-react')) return 'vendor-icons';
          return 'vendor';
        },
      },
    },
  },
});
