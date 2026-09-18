/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Works around an EISDIR/readlink crash webpack's filesystem cache hits
    // when the project sits on an exFAT-formatted drive (readlink() on a
    // regular file misbehaves there) — harmless on NTFS/ext4/APFS, and
    // needed for exFAT builds like this one.
    config.resolve.symlinks = false;
    config.cache = false;
    config.snapshot = { managedPaths: [], immutablePaths: [] };
    return config;
  },
  async rewrites() {
    // Local dev convenience: `next dev` proxies /api/* to a locally running
    // `uvicorn app.main:app --port 8000` so the frontend never needs to know
    // the backend's origin. On Vercel, vercel.json routes /api/* to the
    // Python function directly and this rewrite is never reached.
    if (process.env.NODE_ENV !== "production") {
      return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
    }
    return [];
  },
};

module.exports = nextConfig;
