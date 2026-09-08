// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const STAGING_BUCKET = "k9-ops-staging.firebasestorage.app";
const PRODUCTION_BUCKET = "canil-gcm.firebasestorage.app";

const ORIGINAL_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

afterEach(() => {
  if (ORIGINAL_BUCKET === undefined) {
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  } else {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = ORIGINAL_BUCKET;
  }
  vi.resetModules();
});

/**
 * next.config.ts derives its image authority from process.env at module
 * evaluation time, so each scenario must set the environment before a fresh
 * dynamic import.
 */
async function loadRemotePatterns(bucket: string | undefined): Promise<RemotePattern[]> {
  if (bucket === undefined) {
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  } else {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = bucket;
  }
  vi.resetModules();

  const loaded = (await import("../../../next.config")).default as NextConfig;
  const patterns = loaded.images?.remotePatterns ?? [];

  return patterns.filter((pattern): pattern is RemotePattern => !(pattern instanceof URL));
}

function hostnames(patterns: RemotePattern[]): string[] {
  return patterns.map((pattern) => pattern.hostname);
}

function patternFor(patterns: RemotePattern[], hostname: string): RemotePattern {
  const found = patterns.find((pattern) => pattern.hostname === hostname);
  expect(found, `expected a remote pattern for ${hostname}`).toBeDefined();
  return found as RemotePattern;
}

function matchesAny(patterns: RemotePattern[], url: string): boolean {
  const parsed = new URL(url);
  return patterns.some((pattern) => matchRemotePattern(pattern, parsed));
}

const CONFIG_ENTRY = path.resolve(__dirname, "../../../next.config.ts");

/**
 * Next's own `config.js` is itself published with a nested default export, so
 * the callable loader can sit at either level depending on how the bundler
 * resolves it.
 */
async function loadNextConfig(dir: string): Promise<NextConfig> {
  const mod = (await import("next/dist/server/config.js")) as unknown as {
    default:
      | ((phase: string, dir: string) => Promise<NextConfig>)
      | { default: (phase: string, dir: string) => Promise<NextConfig> };
  };
  const loadConfig =
    typeof mod.default === "function" ? mod.default : mod.default.default;

  return loadConfig("phase-production-server", dir);
}

/**
 * Reproduces the deployed Gen2 path: the Firebase framework backend build
 * esbuilds next.config.ts into a CommonJS `next.config.js`, and the Next
 * production server re-loads it through `loadConfig`. `loadConfig` is what
 * applies the single `interopDefault` unwrap and normalizes the result, so the
 * effective `remotePatterns` here is exactly what the running optimizer sees —
 * not the source object's intended config. A bare `export default` collapses
 * this to an empty allow-list; the CommonJS re-export keeps it at four.
 */
async function loadEffectiveRemotePatterns(
  bucket: string | undefined,
): Promise<RemotePattern[]> {
  if (bucket === undefined) {
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  } else {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = bucket;
  }

  const dir = mkdtempSync(path.join(tmpdir(), "next-config-effective-"));
  await build({
    entryPoints: [CONFIG_ENTRY],
    outfile: path.join(dir, "next.config.js"),
    bundle: true,
    platform: "node",
    target: `node${parseInt(process.versions.node, 10)}`,
    logLevel: "error",
    external: ["next"],
  });
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "effective-probe" }));

  const config = await loadNextConfig(dir);
  const patterns = config.images?.remotePatterns ?? [];
  return patterns.filter((pattern): pattern is RemotePattern => !(pattern instanceof URL));
}

describe("next.config.ts image remote authority — staging", () => {
  it("authorizes only the staging Firebase Storage bucket", async () => {
    const patterns = await loadRemotePatterns(STAGING_BUCKET);
    const hosts = hostnames(patterns);

    expect(hosts).toContain(STAGING_BUCKET);
    expect(hosts).not.toContain(PRODUCTION_BUCKET);
    expect(hosts).not.toContain("**.firebasestorage.app");
    expect(hosts.some((host) => host.includes("*"))).toBe(false);
  });

  it("scopes the generic Google endpoints to the staging bucket path", async () => {
    const patterns = await loadRemotePatterns(STAGING_BUCKET);

    expect(patternFor(patterns, "firebasestorage.googleapis.com").pathname).toBe(
      `/v0/b/${STAGING_BUCKET}/o/**`,
    );
    expect(patternFor(patterns, "storage.googleapis.com").pathname).toBe(
      `/${STAGING_BUCKET}/**`,
    );
  });

  it("preserves the Google avatar host", async () => {
    const patterns = await loadRemotePatterns(STAGING_BUCKET);
    expect(hostnames(patterns)).toContain("lh3.googleusercontent.com");
  });

  it("requires https on every pattern", async () => {
    const patterns = await loadRemotePatterns(STAGING_BUCKET);
    expect(patterns.every((pattern) => pattern.protocol === "https")).toBe(true);
  });
});

describe("next.config.ts image remote authority — production", () => {
  it("authorizes only the production Firebase Storage bucket", async () => {
    const patterns = await loadRemotePatterns(PRODUCTION_BUCKET);
    const hosts = hostnames(patterns);

    expect(hosts).toContain(PRODUCTION_BUCKET);
    expect(hosts).not.toContain(STAGING_BUCKET);
    expect(hosts).not.toContain("**.firebasestorage.app");
  });

  it("scopes the generic Google endpoints to the production bucket path", async () => {
    const patterns = await loadRemotePatterns(PRODUCTION_BUCKET);

    expect(patternFor(patterns, "firebasestorage.googleapis.com").pathname).toBe(
      `/v0/b/${PRODUCTION_BUCKET}/o/**`,
    );
    expect(patternFor(patterns, "storage.googleapis.com").pathname).toBe(
      `/${PRODUCTION_BUCKET}/**`,
    );
  });
});

describe("next.config.ts bucket contract is fail-closed", () => {
  it("throws when the bucket is missing", async () => {
    await expect(loadRemotePatterns(undefined)).rejects.toThrow(
      /NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/,
    );
  });

  it.each([
    ["empty", ""],
    ["protocol", "https://k9-ops-staging.firebasestorage.app"],
    ["trailing slash", "k9-ops-staging.firebasestorage.app/"],
    ["path", "k9-ops-staging.firebasestorage.app/o/photo.jpg"],
    ["query", "k9-ops-staging.firebasestorage.app?alt=media"],
    ["fragment", "k9-ops-staging.firebasestorage.app#frag"],
    ["wildcard", "*.firebasestorage.app"],
    ["double wildcard", "**.firebasestorage.app"],
    ["whitespace", "k9-ops-staging.firebasestorage.app "],
    ["inner whitespace", "k9-ops staging.firebasestorage.app"],
    ["unexpected suffix", "canil-gcm.appspot.com"],
    ["bare suffix", ".firebasestorage.app"],
    ["unrelated host", "evil.example.com"],
  ])("throws for a %s bucket value", async (_label, value) => {
    await expect(loadRemotePatterns(value)).rejects.toThrow(
      /NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/,
    );
  });

  it("never falls back to a production or wildcard authority", async () => {
    await expect(loadRemotePatterns("")).rejects.toThrow();

    const patterns = await loadRemotePatterns(STAGING_BUCKET);
    expect(hostnames(patterns)).not.toContain(PRODUCTION_BUCKET);
  });
});

describe("cross-project matching via the Next remote-pattern matcher", () => {
  it("rejects every production Storage URL form under the staging config", async () => {
    const patterns = await loadRemotePatterns(STAGING_BUCKET);

    expect(matchesAny(patterns, `https://${STAGING_BUCKET}/dogs%2Fbono.jpg`)).toBe(true);
    expect(matchesAny(patterns, `https://${PRODUCTION_BUCKET}/dogs%2Fbono.jpg`)).toBe(false);

    expect(
      matchesAny(
        patterns,
        `https://firebasestorage.googleapis.com/v0/b/${STAGING_BUCKET}/o/dogs%2Fbono.jpg?alt=media&token=t`,
      ),
    ).toBe(true);
    expect(
      matchesAny(
        patterns,
        `https://firebasestorage.googleapis.com/v0/b/${PRODUCTION_BUCKET}/o/dogs%2Fbono.jpg?alt=media&token=t`,
      ),
    ).toBe(false);

    expect(
      matchesAny(patterns, `https://storage.googleapis.com/${STAGING_BUCKET}/dogs/bono.jpg`),
    ).toBe(true);
    expect(
      matchesAny(patterns, `https://storage.googleapis.com/${PRODUCTION_BUCKET}/dogs/bono.jpg`),
    ).toBe(false);
  });

  it("rejects every staging Storage URL form under the production config", async () => {
    const patterns = await loadRemotePatterns(PRODUCTION_BUCKET);

    expect(matchesAny(patterns, `https://${PRODUCTION_BUCKET}/dogs%2Fbono.jpg`)).toBe(true);
    expect(matchesAny(patterns, `https://${STAGING_BUCKET}/dogs%2Fbono.jpg`)).toBe(false);

    expect(
      matchesAny(
        patterns,
        `https://firebasestorage.googleapis.com/v0/b/${STAGING_BUCKET}/o/dogs%2Fbono.jpg`,
      ),
    ).toBe(false);
    expect(
      matchesAny(patterns, `https://storage.googleapis.com/${STAGING_BUCKET}/dogs/bono.jpg`),
    ).toBe(false);
  });

  it("does not authorize an unrelated bucket on the generic endpoints", async () => {
    const patterns = await loadRemotePatterns(STAGING_BUCKET);

    expect(
      matchesAny(
        patterns,
        "https://firebasestorage.googleapis.com/v0/b/attacker.firebasestorage.app/o/x.jpg",
      ),
    ).toBe(false);
    expect(
      matchesAny(patterns, "https://storage.googleapis.com/attacker-bucket/x.jpg"),
    ).toBe(false);
  });
});

/**
 * The source object above is correct in memory, but the deployed Gen2 backend
 * never sees it directly: firebase-tools esbuilds next.config.ts to a CommonJS
 * next.config.js and the Next production server re-loads it. These tests drive
 * that exact path so the export shape itself is covered — a regression to a
 * bare `export default` collapses the effective allow-list to empty even though
 * every source assertion above still passes.
 */
describe("next.config.ts EFFECTIVE production-server config (esbuild + loadConfig)", () => {
  it("exposes exactly four remote patterns after the single interopDefault unwrap", async () => {
    const patterns = await loadEffectiveRemotePatterns(STAGING_BUCKET);
    expect(patterns).toHaveLength(4);
  });

  it("scopes the effective staging authority and preserves lh3", async () => {
    const patterns = await loadEffectiveRemotePatterns(STAGING_BUCKET);
    const hosts = hostnames(patterns);

    expect(hosts).toContain(STAGING_BUCKET);
    expect(hosts).not.toContain(PRODUCTION_BUCKET);
    expect(hosts).toContain("lh3.googleusercontent.com");
    expect(hosts.some((host) => host.includes("*"))).toBe(false);

    expect(patternFor(patterns, "firebasestorage.googleapis.com").pathname).toBe(
      `/v0/b/${STAGING_BUCKET}/o/**`,
    );
    expect(patternFor(patterns, "storage.googleapis.com").pathname).toBe(
      `/${STAGING_BUCKET}/**`,
    );
  });

  it("enforces the full ALLOW/DENY matrix on the effective config", async () => {
    const patterns = await loadEffectiveRemotePatterns(STAGING_BUCKET);

    // ALLOW — staging authority only.
    expect(matchesAny(patterns, `https://${STAGING_BUCKET}/dogs%2Fbono.jpg`)).toBe(true);
    expect(
      matchesAny(
        patterns,
        `https://firebasestorage.googleapis.com/v0/b/${STAGING_BUCKET}/o/dogs%2Fbono.jpg?alt=media`,
      ),
    ).toBe(true);
    expect(
      matchesAny(patterns, `https://storage.googleapis.com/${STAGING_BUCKET}/dogs/bono.jpg`),
    ).toBe(true);
    expect(
      matchesAny(patterns, "https://lh3.googleusercontent.com/a/avatar.jpg"),
    ).toBe(true);

    // DENY — production, cross-project, and unrelated buckets.
    expect(matchesAny(patterns, `https://${PRODUCTION_BUCKET}/dogs%2Fbono.jpg`)).toBe(false);
    expect(
      matchesAny(patterns, "https://other-project.firebasestorage.app/x.jpg"),
    ).toBe(false);
    expect(
      matchesAny(patterns, "https://storage.googleapis.com/attacker-bucket/x.jpg"),
    ).toBe(false);
    expect(
      matchesAny(
        patterns,
        `https://firebasestorage.googleapis.com/v0/b/${PRODUCTION_BUCKET}/o/x.jpg`,
      ),
    ).toBe(false);
  });

  it("fails closed on the effective path when the bucket env is absent", async () => {
    await expect(loadEffectiveRemotePatterns(undefined)).rejects.toThrow(
      /NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/,
    );
  });
});
