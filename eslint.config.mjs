import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // T3-07 SDK import boundary (CT4.APP-WEB.T3-07.SDK-IMPORT-BOUNDARY-R1):
    // outside src/lib/firebase/**, the Firebase app-initialization surface
    // (firebase/app and its compat entry) must not be imported at runtime —
    // the canonical client in src/lib/firebase/client.ts is the only place
    // allowed to resolve/initialize the Firebase app. Type-only imports do
    // not load the SDK at runtime, so they remain allowed everywhere.
    // Known limitation (declared): computed specifiers, eval-generated code,
    // and dependencies' own bundles are not covered by this rule.
    files: ["src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    ignores: ["src/lib/firebase/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "firebase/app",
                "firebase/app/*",
                "firebase/compat/app",
                "firebase/compat/app/*",
                "@firebase/app",
                "@firebase/app/*",
              ],
              allowTypeImports: true,
              message:
                "Firebase app initialization surface is restricted to src/lib/firebase/**. " +
                "Import the shared client from '@/lib/firebase/client' instead.",
            },
          ],
        },
      ],
      // ESLint 9 no-restricted-imports does not see dynamic import() calls,
      // so cover static literal specifiers there too. Computed specifiers are
      // a declared limitation.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression > Literal[value=/^(firebase\\/app|@firebase\\/app)(\\/.*)?$/]",
          message:
            "Firebase app initialization surface is restricted to src/lib/firebase/**. " +
            "Import the shared client from '@/lib/firebase/client' instead.",
        },
      ],
    },
  },
  // CI lint exemption for production guard scripts (CT4.WEB-P0.CI-FAILURE-TARGETED-REMEDIATION-R1):
  // these three CommonJS build-time scripts legitimately use require() for
  // Node built-ins. The exemption is scoped to the exact files; all other
  // .cjs files and the entire src/** tree remain subject to
  // @typescript-eslint/no-require-imports from eslint-config-next/typescript.
  {
    files: [
      "scripts/ct4-web-p0-production-env-guard.cjs",
      "scripts/ct4-web-p0-production-bundle-guard.cjs",
      "scripts/ct4-web-p0-production-guards.test.cjs",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".firebase/**",
    "firebase-debug.log*",
    "next-env.d.ts",
    // Compiled JS (CJS) outputs — not part of the Next.js app
    "functions/**",
    "tools/**",
  ]),
]);

export default eslintConfig;
