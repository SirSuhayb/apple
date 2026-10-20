import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Dev-only: tunnels + 127.0.0.1 must be allowed or Next blocks /_next
  // resources and client components never hydrate (juicer tap is a no-op).
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "little-cloths-wait.loca.lt",
    "brave-string-reynolds-smooth.trycloudflare.com",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
