import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ExcelJS is a large CommonJS library: load it from node_modules on the server
  // instead of bundling it into every route that exports a spreadsheet.
  serverExternalPackages: ['exceljs'],
};

export default nextConfig;
