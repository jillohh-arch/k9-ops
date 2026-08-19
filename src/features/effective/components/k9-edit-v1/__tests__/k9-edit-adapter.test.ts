import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminPatchK9Identity = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({
  callAdminPatchK9Identity,
  callAdminUpsertK9: vi.fn(),
  callAdminArchiveK9: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));

const {
  K9EditError,
  buildK9IdentityPatch,
  findNonIdentityDirtyFields,
  mapK9EditCallableError,
  patchK9Identity,
  projectK9EditIdentity,
  resolveK9VersionToken,
} = await import("../k9-edit-adapter");

type FormValues = Parameters<typeof findNonIdentityDirtyFields>[0];

/** Legacy form snapshot, matching the loaded staging fixture shape. */
function baseValues(overrides: Partial<FormValues> = {}): FormValues {
  return {
    birthDate: "2021-03-04",
    breed: "Pastor Belga Malinois",
    color: "Fulvo",
    conductorRa: "990002",
    idealWeightMax: "35",
    idealWeightMin: "30",
    microchip: "900000000000STG1",
    name: "STG K9 Edit Fixture",
    notes: "Observação inicial",
    operationalStatus: "Ativo",
    physicalCondition: "ideal",
    profileImageUrl: "https://example.invalid/a.jpg",
    registrationNumber: "STG-K9-EDIT-0001",
    sex: "M",
    size: "Grande",
    specialties: ["deteccao"],
    weight: "32.5",
    ...overrides,
  } as FormValues;
}

const TOKEN = 1787150985600;

function ts(millis: number) {
  return { toMillis: () => millis };
}

async function callWith(
  baseline: FormValues,
  current: FormValues,
  versionToken: number | null = TOKEN,
) {
  return patchK9Identity({
    baselineValues: baseline,
    currentValues: current,
    dogId: "stg-dog-nutrition-unlinked-001",
    versionToken,
  });
}

function lastRequest() {
  expect(callAdminPatchK9Identity).toHaveBeenCalledTimes(1);
  return callAdminPatchK9Identity.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  callAdminPatchK9Identity.mockResolvedValue({
    data: { id: "stg-dog-nutrition-unlinked-001", updatedFields: [], clearedFields: [] },
  });
});

// ---------------------------------------------------------------- A. token

describe("resolveK9VersionToken — authority is max(updated_at, updatedAt)", () => {
  it("both mirrors present and equal -> that value", () => {
    expect(resolveK9VersionToken({ updated_at: ts(1000), updatedAt: ts(1000) })).toBe(1000);
  });

  it("camel newer -> camel wins", () => {
    expect(resolveK9VersionToken({ updated_at: ts(1000), updatedAt: ts(5000) })).toBe(5000);
  });

  it("snake newer -> snake wins", () => {
    expect(resolveK9VersionToken({ updated_at: ts(9000), updatedAt: ts(1000) })).toBe(9000);
  });

  it("only camel present", () => {
    expect(resolveK9VersionToken({ updatedAt: ts(4242) })).toBe(4242);
  });

  it("only snake present", () => {
    expect(resolveK9VersionToken({ updated_at: ts(4242) })).toBe(4242);
  });

  it("neither present -> null", () => {
    expect(resolveK9VersionToken({ name: "x" })).toBeNull();
    expect(resolveK9VersionToken(null)).toBeNull();
  });

  it("accepts ISO strings, Date and epoch millis", () => {
    const iso = "2026-08-19T02:56:14.328Z";
    expect(resolveK9VersionToken({ updated_at: iso })).toBe(Date.parse(iso));
    expect(resolveK9VersionToken({ updatedAt: new Date(1500) })).toBe(1500);
    expect(resolveK9VersionToken({ updated_at: 1700 })).toBe(1700);
  });

  it("is NOT the forbidden `updated_at ?? updatedAt` pattern", () => {
    // Under `??`, a present-but-older snake mirror would win and accept a stale
    // precondition. Gate E2 proved that is a lost-update hole.
    expect(resolveK9VersionToken({ updated_at: ts(1000), updatedAt: ts(5000) })).not.toBe(1000);
  });
});

// ---------------------------------------------------------------- B. patch

describe("identity diff — patch semantics", () => {
  it("unchanged identity produces empty plan", () => {
    const plan = buildK9IdentityPatch(
      projectK9EditIdentity(baseValues()),
      projectK9EditIdentity(baseValues()),
    );
    expect(plan.patch).toEqual({});
    expect(plan.clearFields).toEqual([]);
  });

  it("changed name yields only patch.name", async () => {
    await callWith(baseValues(), baseValues({ name: "Bono II" }));
    const req = lastRequest();
    expect(req.patch).toEqual({ name: "Bono II" });
    expect(req.clearFields).toBeUndefined();
  });

  it("changed color yields only patch.color", async () => {
    await callWith(baseValues(), baseValues({ color: "Preto" }));
    expect(lastRequest().patch).toEqual({ color: "Preto" });
  });

  it("optional emptied goes to clearFields, not patch", async () => {
    await callWith(baseValues(), baseValues({ microchip: "" }));
    const req = lastRequest();
    expect(req.clearFields).toEqual(["microchip"]);
    expect(req.patch).toBeUndefined();
  });

  it("originally empty and still empty is omitted (not a clear)", async () => {
    const baseline = baseValues({ microchip: "" });
    await callWith(baseline, baseValues({ microchip: "", name: "Bono II" }));
    const req = lastRequest();
    expect(req.clearFields).toBeUndefined();
    expect(req.patch).toEqual({ name: "Bono II" });
  });

  it("required field emptied fails closed without calling the backend", async () => {
    await expect(callWith(baseValues(), baseValues({ name: "  " }))).rejects.toMatchObject({
      category: "REQUIRED_FIELD_MISSING",
    });
    expect(callAdminPatchK9Identity).not.toHaveBeenCalled();
  });

  it("every required field is protected from clearing", () => {
    for (const field of ["name", "registrationNumber", "breed", "sex", "birthDate"] as const) {
      expect(() =>
        buildK9IdentityPatch(
          projectK9EditIdentity(baseValues()),
          projectK9EditIdentity(baseValues({ [field]: "" } as Partial<FormValues>)),
        ),
      ).toThrow(K9EditError);
    }
  });

  it("null never appears anywhere in the outgoing request", async () => {
    await callWith(baseValues(), baseValues({ microchip: "", notes: "novo" }));
    const serialized = JSON.stringify(lastRequest());
    expect(serialized).not.toContain("null");
    expect(serialized).not.toContain(":null");
  });

  it("trims values before comparing and sending", async () => {
    await callWith(baseValues(), baseValues({ name: "  Bono II  " }));
    expect(lastRequest().patch).toEqual({ name: "Bono II" });
  });

  it("whitespace-only change to an optional field is treated as clear", async () => {
    await callWith(baseValues(), baseValues({ notes: "   " }));
    expect(lastRequest().clearFields).toEqual(["notes"]);
  });
});

// ------------------------------------------------------------- C. denylist

describe("cross-domain dirty guard — fail closed locally", () => {
  const cases: Array<[string, Partial<FormValues>]> = [
    ["weight", { weight: "40" }],
    ["idealWeightMin", { idealWeightMin: "25" }],
    ["idealWeightMax", { idealWeightMax: "40" }],
    ["physicalCondition", { physicalCondition: "magro" }],
    ["conductorRa", { conductorRa: "999999" }],
    ["specialties", { specialties: ["patrulha"] }],
    ["operationalStatus", { operationalStatus: "Licenca" }],
  ];

  for (const [field, override] of cases) {
    it(`${field} changed blocks the save and never calls the callable`, async () => {
      await expect(
        callWith(baseValues(), baseValues(override as Partial<FormValues>)),
      ).rejects.toMatchObject({ category: "NON_IDENTITY_DIRTY", dirtyFields: [field] });
      expect(callAdminPatchK9Identity).not.toHaveBeenCalled();
    });
  }

  it("reports every dirty non-identity field at once", async () => {
    await expect(
      callWith(baseValues(), baseValues({ weight: "40", conductorRa: "111" })),
    ).rejects.toMatchObject({ dirtyFields: ["weight", "conductorRa"] });
  });

  it("unchanged non-identity fields do NOT block an identity save", async () => {
    await callWith(baseValues(), baseValues({ color: "Preto" }));
    expect(callAdminPatchK9Identity).toHaveBeenCalledTimes(1);
  });

  it("specialties compare semantically, not by array identity or order", () => {
    expect(
      findNonIdentityDirtyFields(
        baseValues({ specialties: ["deteccao", "patrulha"] }),
        baseValues({ specialties: ["patrulha", "deteccao"] }),
      ),
    ).toEqual([]);
  });
});

// -------------------------------------------------------- D. request shape

describe("callable request shape", () => {
  it("carries dogId and only allowlisted keys", async () => {
    await callWith(baseValues(), baseValues({ name: "Bono II", microchip: "" }));
    const req = lastRequest();
    expect(req.dogId).toBe("stg-dog-nutrition-unlinked-001");
    expect(Object.keys(req).sort()).toEqual(
      ["clearFields", "dogId", "expectedUpdatedAt", "patch"].sort(),
    );
    expect(Object.keys(req.patch)).toEqual(["name"]);
    expect(req.clearFields).toEqual(["microchip"]);
  });

  it("always sends expectedUpdatedAt, including when null", async () => {
    await callWith(baseValues(), baseValues({ name: "Bono II" }), null);
    const req = lastRequest();
    expect("expectedUpdatedAt" in req).toBe(true);
    expect(req.expectedUpdatedAt).toBeNull();
  });

  it("sends the numeric token when present", async () => {
    await callWith(baseValues(), baseValues({ name: "Bono II" }), TOKEN);
    expect(lastRequest().expectedUpdatedAt).toBe(TOKEN);
  });

  it("never sends mode, actor, profile or the wide snapshot", async () => {
    await callWith(baseValues(), baseValues({ name: "Bono II" }));
    const req = lastRequest();
    for (const forbidden of ["mode", "actor", "profile", "currentWeight", "values"]) {
      expect(req).not.toHaveProperty(forbidden);
    }
  });

  it("never sends Health, Binomial, Training or lifecycle keys", async () => {
    await callWith(baseValues(), baseValues({ name: "Bono II", notes: "x" }));
    const serialized = JSON.stringify(lastRequest());
    for (const forbidden of [
      "weight",
      "idealWeightMin",
      "idealWeightMax",
      "physicalCondition",
      "conductorRa",
      "specialties",
      "operationalStatus",
      "active",
      "status",
      "readiness",
      "restrictions",
      "training",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("omits patch entirely when only clearing", async () => {
    await callWith(baseValues(), baseValues({ notes: "" }));
    const req = lastRequest();
    expect(req).not.toHaveProperty("patch");
    expect(req.clearFields).toEqual(["notes"]);
  });
});

// ------------------------------------------------------------------ E. no-op

describe("no-op save", () => {
  it("does not invoke the backend when nothing changed", async () => {
    const result = await callWith(baseValues(), baseValues());
    expect(callAdminPatchK9Identity).not.toHaveBeenCalled();
    expect(result).toMatchObject({ noop: true, id: "stg-dog-nutrition-unlinked-001" });
  });

  it("no-op still resolves with the dog id for navigation", async () => {
    const result = await callWith(baseValues(), baseValues());
    expect(result.id).toBe("stg-dog-nutrition-unlinked-001");
    expect(result.updatedFields).toEqual([]);
    expect(result.clearedFields).toEqual([]);
  });
});

// ------------------------------------------------------------------ F. errors

describe("error model", () => {
  const cases: Array<[string, string]> = [
    ["unauthenticated", "UNAUTHENTICATED"],
    ["permission-denied", "PERMISSION_DENIED"],
    ["invalid-argument", "INVALID_ARGUMENT"],
    ["failed-precondition", "PRECONDITION_FAILED"],
    ["already-exists", "ALREADY_EXISTS"],
    ["internal", "UNKNOWN"],
  ];

  for (const [code, category] of cases) {
    it(`${code} maps to ${category}`, async () => {
      const err = Object.assign(new Error("backend prose"), { code });
      callAdminPatchK9Identity.mockRejectedValue(err);
      await expect(
        callWith(baseValues(), baseValues({ name: "Bono II" })),
      ).rejects.toMatchObject({ category, code, originalMessage: "backend prose" });
    });
  }

  it("accepts the functions/ prefixed code form", () => {
    const mapped = mapK9EditCallableError(
      Object.assign(new Error("x"), { code: "functions/already-exists" }),
    );
    expect(mapped.category).toBe("ALREADY_EXISTS");
  });

  it("FAILED_PRECONDITION is one category — no substring disambiguation", () => {
    const stale = mapK9EditCallableError(
      Object.assign(new Error("Registro do K9 foi alterado por outra sessao."), {
        code: "failed-precondition",
      }),
    );
    const archived = mapK9EditCallableError(
      Object.assign(new Error("K9 inativo: edicao administrativa nao permitida."), {
        code: "failed-precondition",
      }),
    );
    expect(stale.category).toBe("PRECONDITION_FAILED");
    expect(archived.category).toBe(stale.category);
    // Original messages preserved so E6 can re-read the K9 and decide.
    expect(stale.originalMessage).not.toBe(archived.originalMessage);
  });

  it("preserves code and message for unknown shapes", () => {
    const mapped = mapK9EditCallableError("not an error");
    expect(mapped.category).toBe("UNKNOWN");
    expect(mapped.code).toBeNull();
  });

  it("does not rewrap an existing K9EditError", () => {
    const original = new K9EditError("NON_IDENTITY_DIRTY", "dirty");
    expect(mapK9EditCallableError(original)).toBe(original);
  });

  it("missing dogId fails closed", async () => {
    await expect(
      patchK9Identity({
        baselineValues: baseValues(),
        currentValues: baseValues({ name: "X" }),
        dogId: "",
        versionToken: TOKEN,
      }),
    ).rejects.toMatchObject({ category: "INVALID_ARGUMENT" });
    expect(callAdminPatchK9Identity).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------- G. photo

describe("photo reference", () => {
  it("unchanged URL is preserved (omitted from the payload)", async () => {
    await callWith(baseValues(), baseValues({ name: "Bono II" }));
    expect(lastRequest().patch).not.toHaveProperty("profileImageUrl");
  });

  it("new URL goes into patch.profileImageUrl", async () => {
    await callWith(
      baseValues(),
      baseValues({ profileImageUrl: "https://example.invalid/new.jpg" }),
    );
    expect(lastRequest().patch).toEqual({
      profileImageUrl: "https://example.invalid/new.jpg",
    });
  });

  it("logical removal goes to clearFields, never null", async () => {
    await callWith(baseValues(), baseValues({ profileImageUrl: "" }));
    const req = lastRequest();
    expect(req.clearFields).toEqual(["profileImageUrl"]);
    expect(JSON.stringify(req)).not.toContain("null");
  });
});

// ------------------------------------------------------- H. projection safety

describe("identity projection", () => {
  it("exposes exactly the 10 allowlisted fields", () => {
    expect(Object.keys(projectK9EditIdentity(baseValues())).sort()).toEqual(
      [
        "birthDate",
        "breed",
        "color",
        "microchip",
        "name",
        "notes",
        "profileImageUrl",
        "registrationNumber",
        "sex",
        "size",
      ].sort(),
    );
  });

  it("drops every non-identity field from the wide snapshot", () => {
    const projected = projectK9EditIdentity(baseValues()) as Record<string, unknown>;
    for (const forbidden of [
      "weight",
      "idealWeightMin",
      "idealWeightMax",
      "physicalCondition",
      "conductorRa",
      "specialties",
      "operationalStatus",
    ]) {
      expect(projected).not.toHaveProperty(forbidden);
    }
  });
});
