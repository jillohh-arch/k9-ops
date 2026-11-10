import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * T3-07 SDK import boundary — enforcement tests.
 *
 * These tests run the REAL project ESLint flat config (the one that `npm run
 * lint` and CI use) against virtual fixtures that simulate `src/**` paths.
 * They are not a textual grep: if the config stops applying the boundary
 * rules to real files, these tests fail.
 *
 * Declared limitation: computed specifiers, eval-generated code, and
 * dependency bundles are outside AST-lint reach.
 */

const require_ = createRequire(import.meta.url);
const repoRoot = path.resolve(__dirname, "../../..");
// eslint is a devDependency of the app; resolve from repo root.
const { ESLint } = require_(path.join(repoRoot, "node_modules", "eslint", "lib", "api.js"));

const RESTRICTED_MSG =
  "Firebase app initialization surface is restricted to src/lib/firebase/**";

async function lint(filePath: string, code: string): Promise<{ blocked: boolean; messages: { ruleId: string | null; message: string }[] }> {
  const eslint = new ESLint({ cwd: repoRoot });
  const results = await eslint.lintText(code, { filePath });
  // Only severity 2 (errors) count as a boundary violation: inherited
  // warnings (e.g. no-unused-vars) must not mask or fake a verdict.
  const messages = (results[0]?.messages ?? [])
    .filter((m: { severity: number }) => m.severity === 2)
    .map((m: { ruleId: string | null; message: string }) => ({
      ruleId: m.ruleId,
      message: m.message,
    }));
  return { blocked: messages.length > 0, messages };
}

const expectBlocked = async (filePath: string, code: string) => {
  const { blocked, messages } = await lint(filePath, code);
  expect(blocked, `expected BLOCK for ${filePath}: ${JSON.stringify(messages)}`).toBe(true);
  expect(
    messages.some(
      (m) =>
        m.message.includes(RESTRICTED_MSG) ||
        m.ruleId === "no-restricted-imports" ||
        m.ruleId === "no-restricted-syntax" ||
        // require('firebase/app') is caught by the inherited
        // @typescript-eslint/no-require-imports rule, which forbids the
        // syntax outright — an acceptable boundary diagnostic for CJS.
        m.ruleId === "@typescript-eslint/no-require-imports",
    ),
    `expected boundary diagnostic, got ${JSON.stringify(messages)}`,
  ).toBe(true);
};

const expectAllowed = async (filePath: string, code: string) => {
  const { blocked, messages } = await lint(filePath, code);
  expect(messages, `expected ALLOW for ${filePath}: ${JSON.stringify(messages)}`).toEqual([]);
  expect(blocked).toBe(false);
};

describe("T3-07 firebase/app import boundary (real ESLint config)", () => {
  it("BLOCKS named import of firebase/app outside src/lib/firebase", { timeout: 20_000 }, async () => {
    await expectBlocked(
      "src/features/foo/bar.ts",
      `import { initializeApp } from "firebase/app";\nexport const x = initializeApp;`,
    );
  });

  it("BLOCKS default import of firebase/app outside the layer", async () => {
    await expectBlocked(
      "src/features/foo/baz.ts",
      `import firebase from "firebase/app";\nexport const y = firebase;`,
    );
  });

  it("BLOCKS namespace import of firebase/app outside the layer", async () => {
    await expectBlocked(
      "src/features/foo/qux.ts",
      `import * as fb from "firebase/app";\nexport const z = fb;`,
    );
  });

  it("BLOCKS re-export (export ... from) of firebase/app outside the layer", async () => {
    await expectBlocked(
      "src/features/foo/reexport.ts",
      `export { initializeApp } from "firebase/app";`,
    );
  });

  it("BLOCKS dynamic import('firebase/app') outside the layer", async () => {
    await expectBlocked(
      "src/features/foo/lazy.ts",
      `export async function f() { return import("firebase/app"); }`,
    );
  });

  it("BLOCKS require('firebase/app') outside the layer (no-require-imports)", async () => {
    await expectBlocked(
      "src/features/foo/cjs.cjs",
      `const fb = require("firebase/app");\nmodule.exports = fb;`,
    );
  });

  it("BLOCKS compat entry firebase/app/compat outside the layer", async () => {
    await expectBlocked(
      "src/features/foo/compat.ts",
      `import { initializeApp } from "firebase/app/compat";\nexport const w = initializeApp;`,
    );
  });

  it("BLOCKS compat entry firebase/compat/app outside the layer", async () => {
    await expectBlocked(
      "src/features/foo/compat2.ts",
      `import { initializeApp } from "firebase/compat/app";\nexport const w = initializeApp;`,
    );
  });

  it("ALLOWS firebase/app imports inside src/lib/firebase/**", async () => {
    await expectAllowed(
      "src/lib/firebase/other.ts",
      `import { initializeApp } from "firebase/app";\nexport const v = initializeApp;`,
    );
  });

  it("ALLOWS legitimate service imports (firebase/auth) outside the layer", async () => {
    await expectAllowed(
      "src/features/auth/providers/auth-provider.tsx",
      `import { getAuth } from "firebase/auth";\nexport const a = getAuth;`,
    );
  });

  it("ALLOWS type-only import of FirebaseApp outside the layer", async () => {
    await expectAllowed(
      "src/features/x/y.ts",
      `import type { FirebaseApp } from "firebase/app";\nexport type F = FirebaseApp;`,
    );
  });

  it("does not flag the specifier inside a comment (no false positive)", async () => {
    await expectAllowed(
      "src/features/x/z.ts",
      `// import { initializeApp } from "firebase/app";\nexport const q = 1;`,
    );
  });
});
