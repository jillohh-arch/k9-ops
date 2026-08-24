import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/functions", () => ({
  callAdminAssignAccessProfile: vi.fn(),
  callAdminDuplicateAccessProfile: vi.fn(),
  callAdminSaveAccessProfile: vi.fn(),
  callAdminSeedAccessProfiles: vi.fn(),
  callAdminSetAccessProfileStatus: vi.fn(),
}));

import {
  callAdminDuplicateAccessProfile,
  callAdminSaveAccessProfile,
} from "@/lib/firebase/functions";
import { getDefaultAccessProfile } from "@/lib/permissions/access-control";
import {
  AccessProfileConcurrencyError,
  accessProfileForFunction,
  duplicateAccessProfile,
  normalizeAccessProfile,
  saveAccessProfile,
} from "./access-profile-service";

/**
 * A loaded profile with a concurrency token, as a live EDIT would hold.
 * The token is a required argument on purpose: a default value would swallow
 * the `undefined` case that matrix D has to exercise.
 */
function loadedGestor(updatedAtMillis: number | null | undefined) {
  const profile = getDefaultAccessProfile("gestor")!;
  return { ...profile, updatedAtMillis };
}

describe("access profile save path", () => {
  beforeEach(() => {
    vi.mocked(callAdminSaveAccessProfile).mockReset();
    vi.mocked(callAdminSaveAccessProfile).mockResolvedValue({ data: {} } as never);
    vi.mocked(callAdminDuplicateAccessProfile).mockReset();
    vi.mocked(callAdminDuplicateAccessProfile).mockResolvedValue({
      data: { id: "gestor_copia" },
    } as never);
  });

  // Matrix A — normalization of updated_at → epoch ms.
  describe("A: normalizeAccessProfile captures updated_at as epoch ms", () => {
    it("reads a Firestore Timestamp via toMillis()", () => {
      const profile = normalizeAccessProfile("gestor", {
        ...getDefaultAccessProfile("gestor")!,
        updated_at: { toMillis: () => 1_712_345_678_000 },
      });
      expect(profile.updatedAtMillis).toBe(1_712_345_678_000);
    });

    it("reads a Date fixture", () => {
      const when = new Date("2026-08-23T13:21:51.906Z");
      const profile = normalizeAccessProfile("gestor", {
        ...getDefaultAccessProfile("gestor")!,
        updated_at: when,
      });
      expect(profile.updatedAtMillis).toBe(when.getTime());
    });

    it("yields null when updated_at is absent", () => {
      const profile = normalizeAccessProfile("gestor", {
        ...getDefaultAccessProfile("gestor")!,
      });
      expect(profile.updatedAtMillis).toBeNull();
    });

    it("yields null for malformed shapes (string / number / NaN toMillis)", () => {
      expect(
        normalizeAccessProfile("gestor", { updated_at: "2026-08-23" })
          .updatedAtMillis,
      ).toBeNull();
      expect(
        normalizeAccessProfile("gestor", { updated_at: 1_712_345_678_000 })
          .updatedAtMillis,
      ).toBeNull();
      expect(
        normalizeAccessProfile("gestor", {
          updated_at: { toMillis: () => Number.NaN },
        }).updatedAtMillis,
      ).toBeNull();
    });

    it("never reads an updatedAt camelCase mirror", () => {
      const profile = normalizeAccessProfile("gestor", {
        ...getDefaultAccessProfile("gestor")!,
        updatedAt: { toMillis: () => 999 },
      });
      expect(profile.updatedAtMillis).toBeNull();
    });
  });

  // Matrix B — EDIT sends a top-level finite expectedUpdatedAt.
  it("B: sends top-level expectedUpdatedAt on EDIT", async () => {
    await saveAccessProfile(loadedGestor(1_712_345_678_000));

    expect(callAdminSaveAccessProfile).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(callAdminSaveAccessProfile).mock.calls[0]![0]!;
    expect(arg.expectedUpdatedAt).toBe(1_712_345_678_000);
    expect(Number.isFinite(arg.expectedUpdatedAt)).toBe(true);
  });

  // Matrix C — the token never leaks into the profile payload.
  it("C: keeps the token out of the profile payload", async () => {
    await saveAccessProfile(loadedGestor(1_712_345_678_000));

    const arg = vi.mocked(callAdminSaveAccessProfile).mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    const profile = arg.profile as Record<string, unknown>;
    expect("updatedAtMillis" in profile).toBe(false);
    expect("expectedUpdatedAt" in profile).toBe(false);
  });

  // Matrix D — fail closed when the token is unusable; callable never invoked.
  describe("D: fails closed without a usable token", () => {
    for (const token of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      it(`throws and never calls the callable for ${String(token)}`, async () => {
        await expect(
          saveAccessProfile(loadedGestor(token as number | null | undefined)),
        ).rejects.toBeInstanceOf(AccessProfileConcurrencyError);
        expect(callAdminSaveAccessProfile).not.toHaveBeenCalled();
      });
    }
  });

  // Matrix E — duplicate is a CREATE and must not carry expectedUpdatedAt.
  it("E: duplicate sends no expectedUpdatedAt", async () => {
    await duplicateAccessProfile(loadedGestor(1_712_345_678_000));

    expect(callAdminDuplicateAccessProfile).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(callAdminDuplicateAccessProfile).mock
      .calls[0]![0] as Record<string, unknown>;
    expect("expectedUpdatedAt" in arg).toBe(false);
    const profile = arg.profile as Record<string, unknown>;
    expect("expectedUpdatedAt" in profile).toBe(false);
    expect("updatedAtMillis" in profile).toBe(false);
    expect(callAdminSaveAccessProfile).not.toHaveBeenCalled();
  });

  // Matrix F — stale failed-precondition is classified, called once, no retry.
  it("F: classifies failed-precondition as a concurrency error without retry", async () => {
    vi.mocked(callAdminSaveAccessProfile).mockRejectedValue(
      Object.assign(new Error("stale"), { code: "functions/failed-precondition" }),
    );

    await expect(
      saveAccessProfile(loadedGestor(1_712_345_678_000)),
    ).rejects.toBeInstanceOf(AccessProfileConcurrencyError);
    expect(callAdminSaveAccessProfile).toHaveBeenCalledTimes(1);
  });

  it("F: passes through non-precondition failures untouched", async () => {
    const original = Object.assign(new Error("boom"), {
      code: "functions/internal",
    });
    vi.mocked(callAdminSaveAccessProfile).mockRejectedValue(original);

    await expect(
      saveAccessProfile(loadedGestor(1_712_345_678_000)),
    ).rejects.toBe(original);
    expect(callAdminSaveAccessProfile).toHaveBeenCalledTimes(1);
  });

  // Matrix G — pre-existing serialization behavior stays green.
  it("G: preserves unknown actions through load and serialization", () => {
    const loaded = normalizeAccessProfile("gestor", {
      ...getDefaultAccessProfile("gestor")!,
      permissions: {
        health: {
          view: true,
          read: true,
          manage_nutrition_plan: true,
          future_health_action: true,
        },
      },
    });

    const payload = accessProfileForFunction(loaded);

    expect(payload.permissions.health).toEqual({
      view: true,
      read: true,
      manage_nutrition_plan: true,
      future_health_action: true,
    });
  });

  it("G: sends preserved actions when another profile field is edited", async () => {
    const profile = loadedGestor(1_712_345_678_000);
    const edited = {
      ...profile,
      description: "Descrição alterada",
      permissions: {
        ...profile.permissions,
        health: {
          ...profile.permissions.health,
          future_health_action: true,
        },
      },
    };

    await saveAccessProfile(edited);

    expect(callAdminSaveAccessProfile).toHaveBeenCalledWith({
      expectedUpdatedAt: 1_712_345_678_000,
      id: "gestor",
      profile: expect.objectContaining({
        description: "Descrição alterada",
        permissions: expect.objectContaining({
          health: expect.objectContaining({
            view: true,
            read: true,
            manage_nutrition_plan: true,
            future_health_action: true,
          }),
        }),
      }),
    });
  });
});
