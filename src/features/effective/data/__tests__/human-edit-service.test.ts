import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Gate 10H-HUMAN-EDIT-WEB.IMPL.B2 — READ-ONLY Human Edit loader.
 *
 * Integration between the service and the FROZEN A1 adapter: `firebase/
 * firestore` and `@/lib/firebase/client` are mocked (no live Firebase, no
 * env, no emulator), but `projectHumanEditPersonnel`/`resolveHumanVersionToken`
 * run for real, so these prove SERVICE WIRING to the frozen pure adapter.
 * The callable is never imported or invoked.
 */

const getDoc = vi.fn();
const doc = vi.fn((_db: unknown, ...segments: string[]) => ({
  path: segments.join("/"),
}));

vi.mock("firebase/firestore", () => ({ getDoc, doc }));
vi.mock("@/lib/firebase/client", () => ({ db: { __brand: "db" } }));

const { loadHumanForEdit } = await import("../human-edit-service");

function snap(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data };
}

afterEach(() => {
  getDoc.mockReset();
  doc.mockClear();
});

describe("B2 — read location", () => {
  it("reads exactly users/{ra} via canonical db, one getDoc per load", async () => {
    getDoc.mockResolvedValueOnce(snap({ name: "N", callsign: "C" }));
    await loadHumanForEdit("990011");
    expect(doc).toHaveBeenCalledTimes(1);
    expect(doc.mock.calls[0][0]).toEqual({ __brand: "db" });
    expect(doc.mock.calls[0].slice(1)).toEqual(["users", "990011"]);
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it("does not read access_profiles or query Auth", async () => {
    getDoc.mockResolvedValueOnce(snap({ name: "N", callsign: "C" }));
    await loadHumanForEdit("990011");
    const paths = doc.mock.calls.map((c) => c.slice(1).join("/"));
    expect(paths).toEqual(["users/990011"]);
    expect(paths.some((p) => p.includes("access_profiles"))).toBe(false);
  });
});

describe("B2 — not found", () => {
  it("missing document returns null (not a fabricated empty Human)", async () => {
    getDoc.mockResolvedValueOnce(snap(null));
    const result = await loadHumanForEdit("990099");
    expect(result).toBeNull();
  });
});

describe("B2 — projection wiring (real frozen adapter)", () => {
  it("returns baseline of exactly the 12 A1 fields with correct aliases", async () => {
    getDoc.mockResolvedValueOnce(
      snap({
        nomeCompleto: "Ana Paula",
        callsign: "APAULA",
        cpf: "111",
        birth_date: "1990-01-01",
        telefone: "1199",
        institutional_email: "a@gcm",
        rank: "Cabo",
        cargo: "Adestrador",
        unit: "Canil",
        team: "Alpha",
        admission_date: "2010-05-05",
        notes: "obs",
      }),
    );
    const result = await loadHumanForEdit("990011");
    expect(result?.ra).toBe("990011");
    expect(result?.baseline).toEqual({
      fullName: "Ana Paula",
      callsign: "APAULA",
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
    expect(Object.keys(result?.baseline ?? {})).toHaveLength(12);
  });

  it("cargo does NOT derive from role/accessLevel", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", role: "gestor", accessLevel: "Gestor" }),
    );
    const result = await loadHumanForEdit("990011");
    expect(result?.baseline.cargo).toBe("");
  });

  it("institutionalEmail does NOT derive from Auth email", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", email: "990011@gcm.com.br" }),
    );
    const result = await loadHumanForEdit("990011");
    expect(result?.baseline.institutionalEmail).toBe("");
  });

  it("photo/access/Auth/training raw values do not enter baseline", async () => {
    getDoc.mockResolvedValueOnce(
      snap({
        name: "N",
        callsign: "C",
        photoUrl: "http://x/a.png",
        access_profile_id: "gestor",
        uid: "stg-x",
        isK9Instructor: true,
        specialties: ["Adestramento"],
      }),
    );
    const result = await loadHumanForEdit("990011");
    const values = Object.values(result?.baseline ?? {});
    for (const leaked of [
      "http://x/a.png",
      "gestor",
      "stg-x",
      "Adestramento",
    ]) {
      expect(values).not.toContain(leaked);
    }
  });
});

describe("B2 — version-token wiring", () => {
  it("updated_at only", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", updated_at: 1000 }),
    );
    expect((await loadHumanForEdit("990011"))?.versionToken).toBe(1000);
  });

  it("updatedAt only", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", updatedAt: 2000 }),
    );
    expect((await loadHumanForEdit("990011"))?.versionToken).toBe(2000);
  });

  it("both present: newest wins", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", updated_at: 1000, updatedAt: 2000 }),
    );
    expect((await loadHumanForEdit("990011"))?.versionToken).toBe(2000);
  });

  it("malformed first mirror + valid second wins", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", updated_at: "x", updatedAt: 2000 }),
    );
    expect((await loadHumanForEdit("990011"))?.versionToken).toBe(2000);
  });

  it("absent/malformed both -> null", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", updated_at: "x" }),
    );
    expect((await loadHumanForEdit("990011"))?.versionToken).toBeNull();
  });
});

describe("B2 — archived classification (lifecycle only)", () => {
  const cases: Array<[string, Record<string, unknown>, boolean]> = [
    ["active=false", { name: "N", callsign: "C", active: false }, true],
    ["deleted_at present", { name: "N", callsign: "C", deleted_at: "2026-01-01" }, true],
    ["archived_at present", { name: "N", callsign: "C", archived_at: "2026-01-01" }, true],
    ["status=inactive", { name: "N", callsign: "C", status: "inactive" }, true],
    ["status=inativo", { name: "N", callsign: "C", status: "Inativo" }, true],
    ["active record", { name: "N", callsign: "C", active: true, status: "Ativo" }, false],
  ];
  for (const [label, data, expected] of cases) {
    it(`${label} -> archived=${expected}`, async () => {
      getDoc.mockResolvedValueOnce(snap(data));
      expect((await loadHumanForEdit("990011"))?.archived).toBe(expected);
    });
  }

  it("does NOT infer archived from access/role/missing profile", async () => {
    getDoc.mockResolvedValueOnce(
      snap({ name: "N", callsign: "C", role: "gestor", access_profile_id: undefined }),
    );
    expect((await loadHumanForEdit("990011"))?.archived).toBe(false);
  });
});

describe("B2 — read failure", () => {
  it("getDoc rejection propagates (not converted to null)", async () => {
    getDoc.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(loadHumanForEdit("990011")).rejects.toThrow("permission-denied");
  });

  it("read failure is not returned as null nor empty baseline", async () => {
    getDoc.mockRejectedValueOnce(new Error("network"));
    let settledValue: unknown = "unset";
    try {
      settledValue = await loadHumanForEdit("990011");
    } catch {
      settledValue = "threw";
    }
    expect(settledValue).toBe("threw");
  });
});
