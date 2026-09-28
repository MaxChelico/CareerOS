import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The parent folder has its own package.json; pin the project root to this folder.
  turbopack: { root: import.meta.dirname },
  experimental: {
    // Room for resume and cover-letter PDFs uploaded through forms.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
