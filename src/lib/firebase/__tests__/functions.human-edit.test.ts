import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gate 10H-HUMAN-EDIT-WEB.IMPL.B1 — typed Web wrapper for the homologated
 * `adminPatchHumanPersonnel` callable.
 *
 * PURE unit tests: no live Firebase, no staging, no emulator, no `.env.local`.
 * `firebase/functions` and `@/lib/firebase/client` are mocked so importing
 * `functions.ts` neither initializes Firebase nor performs network I/O. The
 * callable is NEVER invoked — this proves module WIRING (correct callable name
 * + canonical `functions` instance) and the TypeScript wire contract only.
 */

const httpsCallable = vi.fn((_functions: unknown, name: string) => {
  const fn = vi.fn();
  (fn as unknown as { __callableName: string }).__callableName = name;
  return fn;
});

vi.mock("firebase/functions", () => ({ httpsCallable }));

// Sentinel instance — the wrapper must register against exactly this object.
const FUNCTIONS_SENTINEL = { __brand: "functions-instance" };
vi.mock("@/lib/firebase/client", () => ({ functions: FUNCTIONS_SENTINEL }));

const mod = await import("../functions");
const {
  callAdminPatchHumanPersonnel,
} = mod;

type Request = import("../functions").AdminPatchHumanPersonnelRequest;
type Field = import("../functions").AdminPatchHumanPersonnelField;
type Clearable = import("../functions").AdminPatchHumanPersonnelClearableField;

describe("B1 — adminPatchHumanPersonnel wrapper registration", () => {
  beforeEach(() => {
    // Registration happens once at module import; do not clear that history.
  });

  it("registers callAdminPatchHumanPersonnel against the exact callable name", () => {
    const name = (
      callAdminPatchHumanPersonnel as unknown as { __callableName: string }
    ).__callableName;
    expect(name).toBe("adminPatchHumanPersonnel");
  });

  it("registers using the canonical functions instance", () => {
    const call = httpsCallable.mock.calls.find(
      ([, name]) => name === "adminPatchHumanPersonnel",
    );
    expect(call).toBeDefined();
    expect(call?.[0]).toBe(FUNCTIONS_SENTINEL);
  });

  it("does NOT register a wide adminUpsertHuman fallback for edit", () => {
    // The wrapper module may register adminUpsertHuman for legacy create, but
    // Human Edit must not route through it. Assert our wrapper's name is the
    // narrow personnel callable, distinct from the wide upsert.
    const name = (
      callAdminPatchHumanPersonnel as unknown as { __callableName: string }
    ).__callableName;
    expect(name).not.toBe("adminUpsertHuman");
  });
});

describe("B1 — wire contract type closure", () => {
  it("accepts all 12 editable fields in patch + both expectedUpdatedAt forms", () => {
    const full: Request = {
      ra: "990011",
      expectedUpdatedAt: 1787443394308,
      patch: {
        fullName: "Ana",
        callsign: "ANA",
        cpf: "1",
        birthDate: "1990-01-01",
        phone: "1199",
        institutionalEmail: "a@gcm",
        rank: "Cabo",
        cargo: "Adestrador",
        unit: "Canil",
        team: "Alpha",
        admissionDate: "2010-01-01",
        notes: "obs",
      },
    };
    expect(Object.keys(full.patch ?? {})).toHaveLength(12);

    const nullToken: Request = { ra: "990011", expectedUpdatedAt: null };
    expect(nullToken.expectedUpdatedAt).toBeNull();
  });

  it("accepts all 10 clearable fields in clearFields", () => {
    const clears: Clearable[] = [
      "cpf",
      "birthDate",
      "phone",
      "institutionalEmail",
      "rank",
      "cargo",
      "unit",
      "team",
      "admissionDate",
      "notes",
    ];
    const req: Request = {
      ra: "990011",
      expectedUpdatedAt: 1,
      clearFields: clears,
    };
    expect(req.clearFields).toHaveLength(10);
  });

  it("patch and clearFields are both optional; ra + expectedUpdatedAt required", () => {
    const minimal: Request = { ra: "990011", expectedUpdatedAt: 1 };
    expect(minimal.ra).toBe("990011");
  });

  it("fullName/callsign are editable but NOT in the clearable union", () => {
    const editable: Field[] = ["fullName", "callsign"];
    expect(editable).toHaveLength(2);
    // @ts-expect-error — fullName is not clearable
    const badFullName: Clearable = "fullName";
    // @ts-expect-error — callsign is not clearable
    const badCallsign: Clearable = "callsign";
    void badFullName;
    void badCallsign;
  });

  // --- Negative compile-time closure (proven via @ts-expect-error) ---

  it("rejects missing expectedUpdatedAt", () => {
    // @ts-expect-error — expectedUpdatedAt is a mandatory key
    const bad: Request = { ra: "990011" };
    void bad;
  });

  it("rejects cross-domain patch keys", () => {
    const base = { ra: "990011", expectedUpdatedAt: 1 } as const;
    // @ts-expect-error — ra is not a patch field
    const ra: Request = { ...base, patch: { ra: "x" } };
    // @ts-expect-error — role is access-domain
    const role: Request = { ...base, patch: { role: "gestor" } };
    // @ts-expect-error — accessLevel is access-domain
    const accessLevel: Request = { ...base, patch: { accessLevel: "x" } };
    // @ts-expect-error — email is Auth-domain
    const email: Request = { ...base, patch: { email: "x@gcm" } };
    // @ts-expect-error — photoUrl is photo-domain
    const photoUrl: Request = { ...base, patch: { photoUrl: "http://x" } };
    // @ts-expect-error — access_profile_id is access-domain
    const apid: Request = { ...base, patch: { access_profile_id: "gestor" } };
    void ra;
    void role;
    void accessLevel;
    void email;
    void photoUrl;
    void apid;
  });

  it("rejects non-clearable / cross-domain entries in clearFields", () => {
    const base = { ra: "990011", expectedUpdatedAt: 1 } as const;
    // @ts-expect-error — fullName cannot be cleared
    const cf1: Request = { ...base, clearFields: ["fullName"] };
    // @ts-expect-error — callsign cannot be cleared
    const cf2: Request = { ...base, clearFields: ["callsign"] };
    // @ts-expect-error — ra cannot be cleared
    const cf3: Request = { ...base, clearFields: ["ra"] };
    // @ts-expect-error — role is not a clearable field
    const cf4: Request = { ...base, clearFields: ["role"] };
    void cf1;
    void cf2;
    void cf3;
    void cf4;
  });
});
