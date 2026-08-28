import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gate 10H-HUMAN-EDIT-WEB.IMPL.C1 — save orchestration.
 *
 * Joins the FROZEN A1 patch planner to the FROZEN B1 callable. Only the B1
 * callable is mocked (to intercept invocation + inject responses/errors);
 * `buildHumanEditPatch` and the HumanEditPersonnel types run for real, so
 * these prove wiring A1 → B1 without React, Firestore, env, or live Firebase.
 */

const callAdminPatchHumanPersonnel = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({
  callAdminPatchHumanPersonnel,
}));

const { saveHumanEdit, mapHumanEditSaveError, HumanEditSaveError } =
  await import("../human-edit-save");
const { HumanEditError } = await import("../human-edit-types");

type Personnel = import("../human-edit-types").HumanEditPersonnel;

const EMPTY: Personnel = {
  fullName: "",
  callsign: "",
  cpf: "",
  birthDate: "",
  phone: "",
  institutionalEmail: "",
  rank: "",
  cargo: "",
  unit: "",
  team: "",
  admissionDate: "",
  notes: "",
};

function base(overrides: Partial<Personnel> = {}): Personnel {
  return { ...EMPTY, fullName: "Ana Paula", callsign: "APAULA", ...overrides };
}

function ok(data: Record<string, unknown> = {}) {
  callAdminPatchHumanPersonnel.mockResolvedValueOnce({ data });
}
function fail(code: string) {
  callAdminPatchHumanPersonnel.mockRejectedValueOnce(
    Object.assign(new Error("backend prose " + code), { code }),
  );
}

beforeEach(() => {
  callAdminPatchHumanPersonnel.mockReset();
});

describe("C1-A — no-op", () => {
  it("unchanged baseline/current returns noop=true, ZERO callable", async () => {
    const b = base({ cargo: "Adestrador" });
    const result = await saveHumanEdit({
      ra: "990011",
      baseline: b,
      current: { ...b },
      versionToken: 1787443394308,
    });
    expect(result).toEqual({
      ra: "990011",
      noop: true,
      updatedFields: [],
      clearedFields: [],
    });
    expect(callAdminPatchHumanPersonnel).toHaveBeenCalledTimes(0);
  });
});

describe("C1-B — patch", () => {
  it("one changed field sends only that patch key; RA at root, not in patch", async () => {
    ok({ ra: "990011", updated: true, updatedFields: ["cargo"] });
    await saveHumanEdit({
      ra: "990011",
      baseline: base(),
      current: base({ cargo: "Condutor" }),
      versionToken: 1787443394308,
    });
    expect(callAdminPatchHumanPersonnel).toHaveBeenCalledTimes(1);
    const req = callAdminPatchHumanPersonnel.mock.calls[0][0];
    expect(req.ra).toBe("990011");
    expect(req.patch).toEqual({ cargo: "Condutor" });
    expect(req.expectedUpdatedAt).toBe(1787443394308);
    expect("ra" in req.patch).toBe(false);
    expect(req.clearFields).toBeUndefined();
  });
});

describe("C1-C — null version token", () => {
  it("expectedUpdatedAt:null is PRESENT as a key (not omitted)", async () => {
    ok({ updated: true });
    await saveHumanEdit({
      ra: "990011",
      baseline: base(),
      current: base({ notes: "nova" }),
      versionToken: null,
    });
    const req = callAdminPatchHumanPersonnel.mock.calls[0][0];
    expect("expectedUpdatedAt" in req).toBe(true);
    expect(req.expectedUpdatedAt).toBeNull();
  });
});

describe("C1-D — clear", () => {
  it("emptied clearable sends clearFields; no empty string in patch; patch omitted", async () => {
    ok({ updated: true, clearedFields: ["phone"] });
    await saveHumanEdit({
      ra: "990011",
      baseline: base({ phone: "1199" }),
      current: base({ phone: "" }),
      versionToken: 1,
    });
    const req = callAdminPatchHumanPersonnel.mock.calls[0][0];
    expect(req.clearFields).toEqual(["phone"]);
    expect(req.patch).toBeUndefined();
    expect(JSON.stringify(req)).not.toContain('"phone":""');
  });
});

describe("C1-E — mixed", () => {
  it("simultaneous patch + clear produces both exact sections, no extra field", async () => {
    ok({ updated: true });
    await saveHumanEdit({
      ra: "990011",
      baseline: base({ cargo: "Adestrador", phone: "1199", unit: "Canil" }),
      current: base({ cargo: "Condutor", phone: "", unit: "Canil" }),
      versionToken: 1,
    });
    const req = callAdminPatchHumanPersonnel.mock.calls[0][0];
    expect(req.patch).toEqual({ cargo: "Condutor" });
    expect(req.clearFields).toEqual(["phone"]);
    // unit unchanged -> not resent
    expect("unit" in req.patch).toBe(false);
  });

  it("no cross-domain key can exist in the request", async () => {
    ok({ updated: true });
    await saveHumanEdit({
      ra: "990011",
      baseline: base(),
      current: base({ notes: "x" }),
      versionToken: 1,
    });
    const req = callAdminPatchHumanPersonnel.mock.calls[0][0];
    const flat = JSON.stringify(req);
    for (const k of ["role", "accessLevel", "access_profile_id", "email", "photoUrl", "uid", "password"]) {
      expect(flat).not.toContain(k);
    }
  });
});

describe("C1-F — required-field local failure", () => {
  it("emptied required field throws locally (HumanEditError), ZERO callable", async () => {
    await expect(
      saveHumanEdit({
        ra: "990011",
        baseline: base(),
        current: base({ fullName: "" }),
        versionToken: 1,
      }),
    ).rejects.toBeInstanceOf(HumanEditError);
    expect(callAdminPatchHumanPersonnel).toHaveBeenCalledTimes(0);
  });
});

describe("C1-G — RA validation", () => {
  it("empty RA rejected locally, ZERO callable", async () => {
    await expect(
      saveHumanEdit({
        ra: "   ",
        baseline: base(),
        current: base({ cargo: "X" }),
        versionToken: 1,
      }),
    ).rejects.toBeInstanceOf(HumanEditSaveError);
    expect(callAdminPatchHumanPersonnel).toHaveBeenCalledTimes(0);
  });
});

describe("C1-H — response normalization", () => {
  it("backend updatedFields/clearedFields/ra are respected", async () => {
    ok({ ra: "990011", updated: true, updatedFields: ["cargo"], clearedFields: ["phone"] });
    const r = await saveHumanEdit({
      ra: "990011",
      baseline: base({ phone: "1199" }),
      current: base({ cargo: "Condutor", phone: "" }),
      versionToken: 1,
    });
    expect(r).toEqual({
      ra: "990011",
      noop: false,
      updatedFields: ["cargo"],
      clearedFields: ["phone"],
    });
  });

  it("absent optional response arrays fall back to the A1 plan deterministically", async () => {
    ok({}); // backend returns nothing
    const r = await saveHumanEdit({
      ra: "990011",
      baseline: base({ phone: "1199" }),
      current: base({ cargo: "Condutor", phone: "" }),
      versionToken: 1,
    });
    expect(r.ra).toBe("990011");
    expect(r.noop).toBe(false);
    // canonical order: cargo(8) then phone(5)? clearFields separate.
    expect(r.updatedFields).toEqual(["phone", "cargo"]);
    expect(r.clearedFields).toEqual(["phone"]);
  });
});

describe("C1-I — callable error map (category, not prose)", () => {
  const cases: Array<[string, string]> = [
    ["functions/unauthenticated", "UNAUTHENTICATED"],
    ["permission-denied", "PERMISSION_DENIED"],
    ["functions/invalid-argument", "INVALID_ARGUMENT"],
    ["failed-precondition", "PRECONDITION_FAILED"],
    ["functions/failed-precondition", "PRECONDITION_FAILED"],
    ["not-found", "NOT_FOUND"],
    ["internal", "UNKNOWN"],
    ["some-unrecognized-code", "UNKNOWN"],
  ];
  for (const [code, category] of cases) {
    it(`${code} -> ${category}`, async () => {
      fail(code);
      await saveHumanEdit({
        ra: "990011",
        baseline: base(),
        current: base({ cargo: "Condutor" }),
        versionToken: 1,
      }).then(
        () => { throw new Error("expected rejection"); },
        (e) => {
          expect(e).toBeInstanceOf(HumanEditSaveError);
          expect(e.category).toBe(category);
        },
      );
    });
  }

  it("backend prose does NOT alter classification", async () => {
    callAdminPatchHumanPersonnel.mockRejectedValueOnce(
      Object.assign(new Error("Registro arquivado e obsoleto e stale e inactive"), {
        code: "failed-precondition",
      }),
    );
    await saveHumanEdit({
      ra: "990011",
      baseline: base(),
      current: base({ cargo: "Condutor" }),
      versionToken: 1,
    }).catch((e) => {
      expect(e.category).toBe("PRECONDITION_FAILED");
    });
  });
});

describe("C1-J — no automatic recovery", () => {
  it("PRECONDITION_FAILED rejects once, no retry, no second callable", async () => {
    fail("failed-precondition");
    await saveHumanEdit({
      ra: "990011",
      baseline: base(),
      current: base({ cargo: "Condutor" }),
      versionToken: 1,
    }).catch((e) => {
      expect(e.category).toBe("PRECONDITION_FAILED");
    });
    expect(callAdminPatchHumanPersonnel).toHaveBeenCalledTimes(1);
  });

  it("mapHumanEditSaveError passes an existing HumanEditSaveError through", () => {
    const original = new HumanEditSaveError("NOT_FOUND", "x");
    expect(mapHumanEditSaveError(original)).toBe(original);
  });
});
