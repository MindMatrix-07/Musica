import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // On Vercel Services, /api is routed to the FastAPI service via vercel.json.
    if (process.env.VERCEL) {
      return [];
    }
    const backend = process.env.BACKEND_URL;
    if (!backend) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
