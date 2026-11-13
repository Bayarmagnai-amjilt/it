import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ExcelJS is a large CommonJS library: load it from node_modules on the server
  // instead of bundling it into every route that exports a spreadsheet.
  serverExternalPackages: ['exceljs'],
  experimental: {
    // class logos are sent with the class form; the browser shrinks them first,
    // but an older browser sends the original (up to 2 MB, see LOGO_MAX_BYTES)
    serverActions: { bodySizeLimit: '3mb' },
  },
};

export default nextConfig;
