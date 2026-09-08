import type { NextConfig } from "next";

/**
 * Firebase Storage image authority is environment-scoped.
 *
 * The Next Image optimizer (`/_next/image`) runs on the SSR backend and will
 * fetch any URL whose host/path matches `images.remotePatterns`. A hardcoded or
 * wildcard Firebase Storage host therefore lets a staging deployment reach
 * production Storage. The allow-list below is derived exclusively from
 * `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` — the same value that backs the Firebase
 * Web SDK (`src/lib/firebase/client.ts`) — so image authority can never diverge
 * from the project the app is actually configured for.
 *
 * Validation is fail-closed: an absent or malformed bucket aborts the build
 * rather than falling back to a broader authority.
 */
const STORAGE_BUCKET_SUFFIX = ".firebasestorage.app";

function resolveStorageBucket(): string {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required to derive the Next Image remote authority.",
    );
  }

  if (/\s/.test(raw)) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET must not contain whitespace.",
    );
  }

  if (/[:/?#*]/.test(raw)) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET must be a bare bucket hostname (no protocol, path, query, fragment or wildcard).",
    );
  }

  if (!raw.endsWith(STORAGE_BUCKET_SUFFIX) || raw === STORAGE_BUCKET_SUFFIX) {
    throw new Error(
      `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET must end in "${STORAGE_BUCKET_SUFFIX}".`,
    );
  }

  return raw;
}

const storageBucket = resolveStorageBucket();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Firebase Storage download domain for the active project only.
      {
        protocol: "https",
        hostname: storageBucket,
        pathname: "/**",
      },
      // Firebase Storage REST endpoint, scoped to the active project's bucket.
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: `/v0/b/${storageBucket}/o/**`,
      },
      // Google Cloud Storage endpoint, scoped to the active project's bucket.
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: `/${storageBucket}/**`,
      },
      // Google account avatars: environment-agnostic, unrelated to Firebase
      // project isolation. Preserved as-is.
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;

/**
 * The Firebase framework backend build esbuilds this file into a CommonJS
 * `next.config.js`, and the Next.js production server re-loads that bundle
 * through a single `interopDefault` unwrap. A lone `export default` survives
 * esbuild's CommonJS wrapper as `{ default: { default: config } }`, so the
 * single unwrap yields an object without `images` and the remote-image
 * allow-list silently collapses to empty. Re-exporting through CommonJS makes
 * the config resolvable after exactly one unwrap on that path, while the
 * `export default` above keeps serving the ordinary `next build`.
 *
 * The assignment is attempted defensively because this file is also loaded as a
 * native ES module — by `next build` and by the unit tests — where `module` is
 * either absent or a read-only ES module namespace. On those paths the
 * assignment is a harmless no-op and the `export default` above is the
 * authority; only the bundled CommonJS path needs this line.
 */
try {
  module.exports = nextConfig;
} catch {
  // Native/shimmed ESM: the default export above already carries the config.
}
