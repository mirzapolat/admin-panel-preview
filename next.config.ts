import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/pb/:path*",
        destination: "http://pb1.mirzapolat.com/:path*",
      },
    ];
  },
};

export default nextConfig;
