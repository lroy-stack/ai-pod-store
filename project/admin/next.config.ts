import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No i18n — admin panel is English-only
  output: "standalone",
  // basePath for Caddy reverse proxy routing (/panel → admin:3001)
  basePath: process.env.ADMIN_BASE_PATH || "",
};

export default nextConfig;
