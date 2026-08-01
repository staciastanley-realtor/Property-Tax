/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allows embedding inside a KW Command iframe on your own domain(s).
  // Replace with your actual KW Command host before deploying.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.kw.com https://*.yourdomain.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
