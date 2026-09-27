import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browsers that have seen the site over HTTPS keep to HTTPS for 180 days (only the site's own address: no subdomains, no
          // preload list). Only ever sent over HTTPS, so a local http:// run is untouched.
          { key: "Strict-Transport-Security", value: "max-age=15552000" },
          // Nothing here needs the camera, microphone, location, payments or USB, so no script on the page (an ad's included) may ask.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
