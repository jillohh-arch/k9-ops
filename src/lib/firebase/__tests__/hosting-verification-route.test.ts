import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

interface FirebaseHostingRewrite {
  source: string;
  function?: {
    functionId: string;
    region: string;
  } | string;
  destination?: string;
}

interface FirebaseConfig {
  hosting?: {
    site?: string;
    source?: string;
    rewrites?: FirebaseHostingRewrite[];
    frameworksBackend?: {
      region?: string;
    };
  };
}

describe("Firebase Hosting Contract - Public Verification Route (/v/**)", () => {
  const firebaseJsonPath = path.resolve(__dirname, "../../../../firebase.json");

  it("ensures firebase.json exists and is valid JSON", () => {
    expect(fs.existsSync(firebaseJsonPath)).toBe(true);
    const content = fs.readFileSync(firebaseJsonPath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("preserves the hosting site and framework backend identity", () => {
    const config: FirebaseConfig = JSON.parse(
      fs.readFileSync(firebaseJsonPath, "utf-8"),
    );
    expect(config.hosting).toBeDefined();
    expect(config.hosting?.site).toBe("canil-gcm");
    expect(config.hosting?.frameworksBackend?.region).toBe("southamerica-east1");
  });

  it("contains an explicit rewrite for /v/** pointing to verifyOccurrence Cloud Function", () => {
    const config: FirebaseConfig = JSON.parse(
      fs.readFileSync(firebaseJsonPath, "utf-8"),
    );
    const rewrites = config.hosting?.rewrites;

    expect(Array.isArray(rewrites)).toBe(true);
    expect(rewrites?.length).toBeGreaterThanOrEqual(1);

    const vRewrite = rewrites?.find((r) => r.source === "/v/**");
    expect(vRewrite).toBeDefined();
    expect(vRewrite?.function).toBeDefined();

    if (typeof vRewrite?.function === "object") {
      expect(vRewrite.function.functionId).toBe("verifyOccurrence");
      expect(vRewrite.function.region).toBe("southamerica-east1");
    } else {
      throw new Error("Expected rewrite.function to be an object with functionId and region");
    }
  });

  it("guarantees /v/** precedes any fallback/catch-all rewrite in firebase.json", () => {
    const config: FirebaseConfig = JSON.parse(
      fs.readFileSync(firebaseJsonPath, "utf-8"),
    );
    const rewrites = config.hosting?.rewrites ?? [];

    const vRewriteIndex = rewrites.findIndex((r) => r.source === "/v/**");
    expect(vRewriteIndex).toBeGreaterThanOrEqual(0);

    for (let i = 0; i < vRewriteIndex; i++) {
      const prior = rewrites[i];
      expect(prior.source).not.toBe("**");
      expect(prior.source).not.toBe("/**");
    }
  });

  it("maintains edge precedence when Firebase web-frameworks appends the SSR catch-all", () => {
    const config: FirebaseConfig = JSON.parse(
      fs.readFileSync(firebaseJsonPath, "utf-8"),
    );
    const rewrites = [...(config.hosting?.rewrites ?? [])];

    const frameworkCatchAll: FirebaseHostingRewrite = {
      source: "**",
      function: {
        functionId: "ssrCanilgcm",
        region: "southamerica-east1",
      },
    };
    rewrites.push(frameworkCatchAll);

    const vIndex = rewrites.findIndex((r) => r.source === "/v/**");
    const catchAllIndex = rewrites.findIndex((r) => r.source === "**");

    expect(vIndex).toBeLessThan(catchAllIndex);
  });
});
