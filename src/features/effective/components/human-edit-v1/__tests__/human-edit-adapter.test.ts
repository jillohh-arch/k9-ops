import { describe, expect, it } from "vitest";

import {
  buildHumanEditPatch,
  projectHumanEditPersonnel,
  resolveHumanVersionToken,
} from "../human-edit-adapter";
import {
  HUMAN_EDIT_CLEARABLE_FIELDS,
  HUMAN_EDIT_FIELDS,
  HUMAN_EDIT_REQUIRED_FIELDS,
  HumanEditError,
  type HumanEditPersonnel,
} from "../human-edit-types";

const EMPTY: HumanEditPersonnel = {
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

function personnel(overrides: Partial<HumanEditPersonnel>): HumanEditPersonnel {
  return { ...EMPTY, ...overrides };
}

/** A valid non-empty baseline (both required fields present). */
function baseline(
  overrides: Partial<HumanEditPersonnel> = {},
): HumanEditPersonnel {
  return personnel({ fullName: "Ana Paula", callsign: "APAULA", ...overrides });
}

describe("A1 field sets — exact frozen contract", () => {
  it("editable set is EXACTLY the 12 frozen fields (canonical order)", () => {
    expect([...HUMAN_EDIT_FIELDS]).toEqual([
      "fullName",
      "callsign",
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
    ]);
    expect(HUMAN_EDIT_FIELDS).toHaveLength(12);
  });

  it("clearable set is EXACTLY the 10 frozen fields", () => {
    expect([...HUMAN_EDIT_CLEARABLE_FIELDS]).toEqual([
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
    ]);
    expect(HUMAN_EDIT_CLEARABLE_FIELDS).toHaveLength(10);
  });

  it("fullName/callsign are required and NOT clearable", () => {
    expect([...HUMAN_EDIT_REQUIRED_FIELDS]).toEqual(["fullName", "callsign"]);
    expect(HUMAN_EDIT_CLEARABLE_FIELDS).not.toContain("fullName");
    expect(HUMAN_EDIT_CLEARABLE_FIELDS).not.toContain("callsign");
  });

  it("ra is neither editable nor clearable", () => {
    expect(HUMAN_EDIT_FIELDS as readonly string[]).not.toContain("ra");
    expect(HUMAN_EDIT_CLEARABLE_FIELDS as readonly string[]).not.toContain(
      "ra",
    );
  });
});

describe("A1 projection boundary — Personnel aliases only", () => {
  it("reads every supported Personnel alias with exact precedence", () => {
    const p = projectHumanEditPersonnel({
      nomeCompleto: "Nome Completo",
      name: "Ignored Name",
      callsign: "CS",
      callSign: "IGN",
      cpf: "111",
      document: "222",
      birth_date: "1990-01-01",
      birthDate: "2000-01-01",
      telefone: "1199",
      phone: "0000",
      institutional_email: "a@gcm",
      institutionalEmail: "b@gcm",
      rank: "Cabo",
      posto: "IGN",
      cargo: "Adestrador",
      função: "IGN",
      unit: "Canil",
      unidade: "IGN",
      team: "Alpha",
      equipe: "IGN",
      admission_date: "2010-05-05",
      admissionDate: "IGN",
      notes: "obs",
      observações: "IGN",
    });
    expect(p).toEqual({
      fullName: "Nome Completo",
      callsign: "CS",
      cpf: "111",
      birthDate: "1990-01-01",
      phone: "1199",
      institutionalEmail: "a@gcm",
      rank: "Cabo",
      cargo: "Adestrador",
      unit: "Canil",
      team: "Alpha",
      admissionDate: "2010-05-05",
      notes: "obs",
    });
  });

  it("falls through to secondary Personnel aliases when primary empty", () => {
    const p = projectHumanEditPersonnel({
      name: "Fallback Name",
      nome_guerra: "GUERRA",
      document: "DOC123",
      posto: "Sargento",
      graduacao: "IGN",
      lotação: "Base Sul",
      observações: "legacy note",
    });
    expect(p.fullName).toBe("Fallback Name");
    expect(p.callsign).toBe("GUERRA");
    expect(p.cpf).toBe("DOC123");
    expect(p.rank).toBe("Sargento");
    expect(p.unit).toBe("Base Sul");
    expect(p.notes).toBe("legacy note");
  });

  it("projection is closed to the 12 Personnel fields", () => {
    const p = projectHumanEditPersonnel({ name: "X", callsign: "Y" });
    expect(Object.keys(p).sort()).toEqual([...HUMAN_EDIT_FIELDS].sort());
  });

  it("role / accessLevel do NOT become cargo", () => {
    const p = projectHumanEditPersonnel({
      name: "N",
      callsign: "C",
      role: "gestor",
      accessLevel: "Gestor / Comando",
      access_level: "gestor",
    });
    expect(p.cargo).toBe("");
  });

  it("Auth email does NOT become institutionalEmail", () => {
    const p = projectHumanEditPersonnel({
      name: "N",
      callsign: "C",
      email: "990010@gcm.com.br",
    });
    expect(p.institutionalEmail).toBe("");
  });

  it("photoUrl / photoURL / profileImageUrl do NOT enter projection", () => {
    const p = projectHumanEditPersonnel({
      name: "N",
      callsign: "C",
      photoUrl: "http://x/a.png",
      photoURL: "http://x/b.png",
      profileImageUrl: "http://x/c.png",
    });
    expect(Object.values(p)).not.toContain("http://x/a.png");
    expect(Object.values(p)).not.toContain("http://x/b.png");
    expect(Object.values(p)).not.toContain("http://x/c.png");
  });

  it("access-profile / Auth / training / lifecycle fields do NOT enter projection", () => {
    const p = projectHumanEditPersonnel({
      name: "N",
      callsign: "C",
      access_profile_id: "gestor",
      accessProfileId: "gestor",
      access_profile: "Gestor",
      roles: ["gestor"],
      admin: true,
      access_scope: "global",
      claim_role: "gestor",
      uid: "stg-x",
      password: "secret",
      displayName: "DN",
      isK9Instructor: true,
      training_role: "instrutor_k9",
      specialties: ["Adestramento"],
      certifications: ["x"],
      shiftGroupId: "sg1",
      shiftLabel: "Manhã",
      active: false,
      status: "Inativo",
    });
    const values = Object.values(p);
    for (const leaked of [
      "gestor",
      "Gestor",
      "global",
      "stg-x",
      "secret",
      "DN",
      "instrutor_k9",
      "Adestramento",
      "sg1",
      "Manhã",
      "Inativo",
    ]) {
      expect(values).not.toContain(leaked);
    }
  });

  it("null/undefined document projects to all-empty Personnel", () => {
    expect(projectHumanEditPersonnel(null)).toEqual(EMPTY);
    expect(projectHumanEditPersonnel(undefined)).toEqual(EMPTY);
  });
});

describe("A1 patch builder — diff semantics", () => {
  it("unchanged fields are omitted (noop when nothing changed)", () => {
    const b = baseline({ cargo: "Adestrador", unit: "Canil" });
    expect(buildHumanEditPatch(b, { ...b })).toEqual({ noop: true });
  });

  it("changed non-empty field enters patch", () => {
    const b = baseline();
    const plan = buildHumanEditPatch(b, baseline({ cargo: "Condutor" }));
    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("expected non-noop");
    expect(plan.patch).toEqual({ cargo: "Condutor" });
    expect(plan.clearFields).toEqual([]);
    expect(plan.updatedFields).toEqual(["cargo"]);
  });

  it("multiple changes produce only those owned changed fields", () => {
    const b = baseline({ cargo: "Adestrador" });
    const plan = buildHumanEditPatch(
      b,
      baseline({ cargo: "Condutor", phone: "11988887777", notes: "nova obs" }),
    );
    if (plan.noop) throw new Error("expected non-noop");
    expect(plan.patch).toEqual({
      phone: "11988887777",
      cargo: "Condutor",
      notes: "nova obs",
    });
    expect(plan.clearFields).toEqual([]);
    // canonical order: phone (5) < cargo (8) < notes (12)
    expect(plan.updatedFields).toEqual(["phone", "cargo", "notes"]);
  });

  it("clearable populated -> emptied becomes clearFields", () => {
    const b = baseline({ phone: "1199", cargo: "Adestrador" });
    const plan = buildHumanEditPatch(b, baseline({ phone: "", cargo: "" }));
    if (plan.noop) throw new Error("expected non-noop");
    expect(plan.patch).toEqual({});
    expect(plan.clearFields).toEqual(["phone", "cargo"]);
  });

  it("baseline-empty / current-empty produces no clear", () => {
    const b = baseline({ phone: "" });
    const plan = buildHumanEditPatch(b, baseline({ phone: "" }));
    expect(plan).toEqual({ noop: true });
  });

  it("whitespace-only change is treated as empty (clear), not patch", () => {
    const b = baseline({ notes: "algo" });
    const plan = buildHumanEditPatch(b, baseline({ notes: "   " }));
    if (plan.noop) throw new Error("expected non-noop");
    expect(plan.clearFields).toEqual(["notes"]);
    expect(plan.patch).toEqual({});
  });

  it("fullName emptied throws local validation error", () => {
    const b = baseline();
    expect(() => buildHumanEditPatch(b, baseline({ fullName: "" }))).toThrow(
      HumanEditError,
    );
  });

  it("callsign emptied throws local validation error", () => {
    const b = baseline();
    try {
      buildHumanEditPatch(b, baseline({ callsign: "  " }));
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HumanEditError);
      expect((err as HumanEditError).field).toBe("callsign");
    }
  });

  it("null is never emitted anywhere in the plan", () => {
    const b = baseline({ phone: "1199", cargo: "Adestrador" });
    const plan = buildHumanEditPatch(
      b,
      baseline({ phone: "", cargo: "Condutor" }),
    );
    if (plan.noop) throw new Error("expected non-noop");
    expect(Object.values(plan.patch)).not.toContain(null);
    expect(JSON.stringify(plan)).not.toContain("null");
  });

  it("ra can never appear in patch (not part of the model)", () => {
    // ra is not a key of HumanEditPersonnel; a raw doc carrying it is ignored
    // by projection, and the diff only iterates the 12 owned fields.
    const b = projectHumanEditPersonnel({ name: "N", callsign: "C", ra: "990011" });
    const c = projectHumanEditPersonnel({
      name: "N2",
      callsign: "C",
      ra: "990099",
    });
    const plan = buildHumanEditPatch(b, c);
    if (plan.noop) throw new Error("expected non-noop");
    expect(plan.patch).toEqual({ fullName: "N2" });
    expect(Object.keys(plan.patch)).not.toContain("ra");
  });

  it("cross-domain values cannot cross the adapter boundary via projection", () => {
    const b = projectHumanEditPersonnel({ name: "N", callsign: "C" });
    const c = projectHumanEditPersonnel({
      name: "N",
      callsign: "C",
      role: "gestor",
      email: "x@gcm",
      photoUrl: "http://x",
      access_profile_id: "gestor",
    });
    // Only Personnel fields were read; none changed -> noop.
    expect(buildHumanEditPatch(b, c)).toEqual({ noop: true });
  });

  it("clearFields ordering is deterministic (canonical field order)", () => {
    const b = baseline({
      notes: "n",
      cpf: "c",
      unit: "u",
      phone: "p",
    });
    const plan = buildHumanEditPatch(
      b,
      baseline({ notes: "", cpf: "", unit: "", phone: "" }),
    );
    if (plan.noop) throw new Error("expected non-noop");
    // canonical: cpf(3) phone(5) unit(9) notes(12)
    expect(plan.clearFields).toEqual(["cpf", "phone", "unit", "notes"]);
  });
});

describe("A1 no-op", () => {
  it("identical baseline/current returns noop", () => {
    const b = baseline({ cargo: "Adestrador", team: "Alpha" });
    expect(buildHumanEditPatch(b, { ...b })).toEqual({ noop: true });
  });

  it("noop plan carries no patch/clearFields payload", () => {
    const plan = buildHumanEditPatch(baseline(), baseline());
    expect(plan).toEqual({ noop: true });
    expect("patch" in plan).toBe(false);
    expect("clearFields" in plan).toBe(false);
  });
});

describe("A1 version token — max(updated_at, updatedAt), never ??", () => {
  it("updated_at only", () => {
    expect(resolveHumanVersionToken({ updated_at: 1000 })).toBe(1000);
  });

  it("updatedAt only", () => {
    expect(resolveHumanVersionToken({ updatedAt: 2000 })).toBe(2000);
  });

  it("both present: newer wins", () => {
    expect(
      resolveHumanVersionToken({ updated_at: 1000, updatedAt: 2000 }),
    ).toBe(2000);
    expect(
      resolveHumanVersionToken({ updated_at: 3000, updatedAt: 2000 }),
    ).toBe(3000);
  });

  it("malformed first + valid second: valid second wins", () => {
    expect(
      resolveHumanVersionToken({ updated_at: "not-a-date", updatedAt: 2000 }),
    ).toBe(2000);
  });

  it("valid first + malformed second: valid first wins", () => {
    expect(
      resolveHumanVersionToken({ updated_at: 1000, updatedAt: Number.NaN }),
    ).toBe(1000);
  });

  it("both absent/malformed -> null", () => {
    expect(resolveHumanVersionToken({})).toBeNull();
    expect(resolveHumanVersionToken(null)).toBeNull();
    expect(
      resolveHumanVersionToken({ updated_at: "x", updatedAt: {} }),
    ).toBeNull();
  });

  it("Date normalization", () => {
    const d = new Date("2026-08-23T00:03:14.308Z");
    expect(resolveHumanVersionToken({ updatedAt: d })).toBe(d.getTime());
  });

  it("toMillis() normalization (Firestore Timestamp-like)", () => {
    expect(
      resolveHumanVersionToken({ updated_at: { toMillis: () => 1787443394308 } }),
    ).toBe(1787443394308);
  });

  it("toDate() normalization", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(
      resolveHumanVersionToken({ updatedAt: { toDate: () => d } }),
    ).toBe(d.getTime());
  });

  it("ISO string normalization", () => {
    expect(
      resolveHumanVersionToken({ updated_at: "2026-08-23T00:03:14.308Z" }),
    ).toBe(Date.parse("2026-08-23T00:03:14.308Z"));
  });

  it("REGRESSION: throwing toMillis() on first mirror does NOT hide a valid second mirror", () => {
    const throwing = {
      toMillis: () => {
        throw new Error("booby-trapped timestamp");
      },
    };
    let token: number | null = null;
    expect(() => {
      token = resolveHumanVersionToken({
        updated_at: throwing,
        updatedAt: 5000,
      });
    }).not.toThrow();
    expect(token).toBe(5000);
  });

  it("REGRESSION: throwing toDate() on first mirror does NOT hide a valid second mirror", () => {
    const throwing = {
      toDate: () => {
        throw new Error("booby-trapped timestamp");
      },
    };
    let token: number | null = null;
    expect(() => {
      token = resolveHumanVersionToken({
        updated_at: throwing,
        updatedAt: 7000,
      });
    }).not.toThrow();
    expect(token).toBe(7000);
  });

  it("throwing helper with no valid sibling degrades to null (never throws)", () => {
    const throwing = {
      toMillis: () => {
        throw new Error("boom");
      },
    };
    let token: number | null = 123;
    expect(() => {
      token = resolveHumanVersionToken({ updated_at: throwing });
    }).not.toThrow();
    expect(token).toBeNull();
  });

  it("toDate() returning an Invalid Date degrades to null", () => {
    expect(
      resolveHumanVersionToken({ updated_at: { toDate: () => new Date("nope") } }),
    ).toBeNull();
  });

  it("REGRESSION: `updated_at ?? updatedAt` would be wrong when first is stale/malformed", () => {
    // A first-present authority would return updated_at (malformed -> stale),
    // hiding the newer valid updatedAt and accepting a stale precondition.
    const token = resolveHumanVersionToken({
      updated_at: "not-a-date",
      updatedAt: 5000,
    });
    expect(token).toBe(5000);
    expect(token).not.toBeNull();

    // And when the older mirror is first, max still wins over first-present.
    expect(
      resolveHumanVersionToken({ updated_at: 1000, updatedAt: 9999 }),
    ).toBe(9999);
  });
});
