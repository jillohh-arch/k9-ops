import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/functions", () => ({}));

import {
  accessActions,
  accessPolicyVersion,
  defaultAccessProfiles,
  getCanonicalProfileId,
  getDefaultAccessProfile,
  getProfileIdFromLegacyValue,
  hasAccessPermission,
  isValidProfileIdFormat,
  isVisibleAccessProfile,
  mergeAccessProfilesWithDefaults,
  normalizePermissionMap,
  normalizeProfileId,
  sortAccessProfiles,
  visibleAccessProfiles,
  type AccessAction,
  type AccessProfile,
} from "../permissions/access-control";
import { accessProfileForFunction } from "@/features/access/data/access-profile-service";
import { resolveProfileId } from "@/features/access/providers/access-control-provider";
import {
  CAPABILITY_LABELS,
  LEGACY_TO_GRANULAR,
  type HealthCapability,
} from "@/features/health/domain/capabilities";

describe("getDefaultAccessProfile", () => {
  it("returns profile by exact id", () => {
    const profile = getDefaultAccessProfile("administrador");
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe("administrador");
  });

  it("returns null for unknown id", () => {
    expect(getDefaultAccessProfile("unknown_profile")).toBeNull();
  });

  it("returns null for empty/null input", () => {
    expect(getDefaultAccessProfile(null)).toBeNull();
    expect(getDefaultAccessProfile(undefined)).toBeNull();
    expect(getDefaultAccessProfile("")).toBeNull();
  });

  it("is case-insensitive", () => {
    const profile = getDefaultAccessProfile("Administrador");
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe("administrador");
  });
});

describe("getProfileIdFromLegacyValue", () => {
  it("maps legacy aliases correctly", () => {
    expect(getProfileIdFromLegacyValue("condutor")).toBe("operador_k9");
    expect(getProfileIdFromLegacyValue("guarda_k9")).toBe("operador_k9");
    expect(getProfileIdFromLegacyValue("comando")).toBe("gestor");
    expect(getProfileIdFromLegacyValue("comando_canil")).toBe("gestor");
    expect(getProfileIdFromLegacyValue("admin")).toBe("administrador");
    expect(getProfileIdFromLegacyValue("almoxarifado")).toBe("almoxarifado");
    expect(getProfileIdFromLegacyValue("estoque")).toBe("almoxarifado");
    expect(getProfileIdFromLegacyValue("instrutor")).toBe("instrutor_k9");
    expect(getProfileIdFromLegacyValue("adestrador")).toBe("instrutor_k9");
  });

  it("handles accented and mixed-case input", () => {
    expect(getProfileIdFromLegacyValue("Coordenador")).toBe("gestor");
    expect(getProfileIdFromLegacyValue("ADMINISTRADOR")).toBe("administrador");
  });

  it("returns null for unrecognized values", () => {
    expect(getProfileIdFromLegacyValue("random_value")).toBeNull();
    expect(getProfileIdFromLegacyValue(null)).toBeNull();
    expect(getProfileIdFromLegacyValue(undefined)).toBeNull();
    expect(getProfileIdFromLegacyValue("")).toBeNull();
  });
});

describe("normalizePermissionMap", () => {
  it("converts action arrays to boolean maps", () => {
    const result = normalizePermissionMap({
      dashboard: ["view", "edit"],
      k9: ["view"],
    });
    expect(result.dashboard).toEqual({ view: true, edit: true });
    expect(result.k9).toEqual({ view: true });
  });

  it("passes through already-normalized maps", () => {
    const already = { dashboard: { view: true, edit: true } };
    const result = normalizePermissionMap(already);
    expect(result.dashboard).toEqual({ view: true, edit: true });
  });

  it("preserves actions that are not represented by the current editor", () => {
    const result = normalizePermissionMap({
      health: { view: true, future_health_action: true },
    });

    expect(result.health).toEqual({
      view: true,
      future_health_action: true,
    });
  });
});

describe("hasAccessPermission", () => {
  it("declares the canonical Health actions in policy v7 (without read)", () => {
    expect(accessPolicyVersion).toBe(7);
    expect(accessActions.some((action) => (action.id as string) === "read")).toBe(false);
    expect(
      accessActions.some((action) => action.id === "manage_nutrition_plan"),
    ).toBe(true);
    expect(
      accessActions.some((action) => action.id === "record_routine"),
    ).toBe(true);
  });

  // CT3.AUTH-HEALTH-01: F10 persisted authorization uses health.view == true.
  // There is NO persisted health.read in canonical default profiles.
  it.each([
    ["administrador", false, true],
    ["gestor", false, true],
    ["instrutor_k9", false, false],
    ["operador_k9", false, false],
    ["almoxarifado", false, false],
  ])(
    "defaults %s health.read=%s and manage_nutrition_plan=%s",
    (profileId, canRead, canManage) => {
      const profile = getDefaultAccessProfile(profileId)!;
      expect(hasAccessPermission(profile, "health", "read" as AccessAction)).toBe(canRead);
      expect(
        hasAccessPermission(profile, "health", "manage_nutrition_plan"),
      ).toBe(canManage);
    },
  );

  it("keeps view, read and nutrition management as distinct permissions", () => {
    const base = getDefaultAccessProfile("operador_k9")!;
    const profile = {
      ...base,
      permissions: {
        ...base.permissions,
        health: { view: true, read: false, manage_nutrition_plan: false },
      },
    };

    expect(hasAccessPermission(profile, "health", "view")).toBe(true);
    expect(hasAccessPermission(profile, "health", "read" as AccessAction)).toBe(false);
    expect(hasAccessPermission(profile, "health", "manage_nutrition_plan")).toBe(
      false,
    );
  });

  it("does not grant nutrition management from health.edit", () => {
    const base = getDefaultAccessProfile("operador_k9")!;
    const profile = {
      ...base,
      permissions: {
        ...base.permissions,
        health: { view: true, read: true, edit: true },
      },
    };

    expect(hasAccessPermission(profile, "health", "edit")).toBe(true);
    expect(hasAccessPermission(profile, "health", "manage_nutrition_plan")).toBe(
      false,
    );
  });

  it("returns true when profile has the permission", () => {
    const admin = defaultAccessProfiles.find((p) => p.id === "administrador")!;
    expect(hasAccessPermission(admin, "access", "edit")).toBe(true);
  });

  it("returns false when profile lacks the permission", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(hasAccessPermission(operador, "access", "edit")).toBe(false);
  });

  it("defaults action to 'view'", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(hasAccessPermission(operador, "dashboard")).toBe(true);
  });
});

describe("isVisibleAccessProfile", () => {
  it("returns true for canonical active modern profiles", () => {
    expect(isVisibleAccessProfile({ id: "operador_k9", ui_hidden: undefined })).toBe(true);
    expect(isVisibleAccessProfile({ id: "gestor", ui_hidden: undefined })).toBe(true);
    expect(isVisibleAccessProfile({ id: "almoxarifado", ui_hidden: undefined })).toBe(true);
    expect(isVisibleAccessProfile({ id: "administrador", ui_hidden: undefined })).toBe(true);
  });

  it("returns false for canonical profiles when explicitly ui_hidden: true", () => {
    expect(isVisibleAccessProfile({ id: "operador_k9", ui_hidden: true })).toBe(false);
    expect(isVisibleAccessProfile({ id: "gestor", ui_hidden: true })).toBe(false);
  });

  it("returns false for legacy instrutor_k9 regardless of ui_hidden value", () => {
    // 1. Hidden when ui_hidden: true
    expect(isVisibleAccessProfile({ id: "instrutor_k9", ui_hidden: true })).toBe(false);
    // 2. Hidden even if stale metadata provides ui_hidden: false
    expect(isVisibleAccessProfile({ id: "instrutor_k9", ui_hidden: false })).toBe(false);
    // 3. Hidden when ui_hidden is absent / undefined
    expect(isVisibleAccessProfile({ id: "instrutor_k9", ui_hidden: undefined })).toBe(false);
    // 4. Case-insensitive / whitespace-tolerant rejection
    expect(isVisibleAccessProfile({ id: "INSTRUTOR_K9", ui_hidden: false })).toBe(false);
  });

  it("returns false for non-canonical profiles", () => {
    expect(isVisibleAccessProfile({ id: "random_profile", ui_hidden: undefined })).toBe(false);
    expect(isVisibleAccessProfile({ id: "", ui_hidden: undefined })).toBe(false);
  });
});

describe("sortAccessProfiles", () => {
  it("sorts by canonical order", () => {
    const profiles = defaultAccessProfiles.filter((p) =>
      ["administrador", "operador_k9", "gestor"].includes(p.id),
    );
    const sorted = sortAccessProfiles(profiles);
    expect(sorted.map((p) => p.id)).toEqual([
      "operador_k9",
      "gestor",
      "administrador",
    ]);
  });
});

describe("visibleAccessProfiles", () => {
  it("excludes hidden and deprecated profiles and sorts canonical ones", () => {
    const visible = visibleAccessProfiles(defaultAccessProfiles);
    const ids = visible.map((p) => p.id);
    expect(ids).not.toContain("instrutor_k9");
    expect(ids).toEqual(["operador_k9", "gestor", "almoxarifado", "administrador"]);
  });

  it("excludes instrutor_k9 even if injected from remote with ui_hidden: false", () => {
    const corruptedRemote = [
      ...defaultAccessProfiles,
      {
        ...defaultAccessProfiles.find((p) => p.id === "instrutor_k9")!,
        ui_hidden: false,
      },
    ];
    const visible = visibleAccessProfiles(corruptedRemote);
    const ids = visible.map((p) => p.id);
    expect(ids).not.toContain("instrutor_k9");
  });
});

describe("mergeAccessProfilesWithDefaults", () => {
  it("overrides defaults with custom profiles", () => {
    const custom = {
      ...defaultAccessProfiles.find((p) => p.id === "operador_k9")!,
      name: "Custom Operador",
    };
    const merged = mergeAccessProfilesWithDefaults([custom]);
    const operador = merged.find((p) => p.id === "operador_k9")!;
    expect(operador.name).toBe("Custom Operador");
  });

  it("keeps all default profiles present", () => {
    const merged = mergeAccessProfilesWithDefaults([]);
    expect(merged.length).toBe(defaultAccessProfiles.length);
  });
});

describe("CT3.AUTH-HEALTH-01 / CT3.F10.HEALTH-READ-ACTION-SCHEMA-CLOSURE-R2 — 8 Invariants", () => {
  it("1. AccessAction canonical persisted vocabulary does NOT contain 'read'", () => {
    const actionIds = accessActions.map((a) => a.id as string);
    expect(actionIds).not.toContain("read");
    expect(actionIds).toContain("view");
    expect(actionIds).toContain("create");
    expect(actionIds).toContain("edit");
    expect(actionIds).toContain("archive");
    expect(actionIds).toContain("approve");
    expect(actionIds).toContain("audit");
    expect(actionIds).toContain("export");
    expect(actionIds).toContain("manage_nutrition_plan");
    expect(actionIds).toContain("record_routine");
  });

  it("2. default operador_k9 contains health.view=true, health.create=true, health.edit=true, health.record_routine=true, health.read ABSENT", () => {
    const profile = getDefaultAccessProfile("operador_k9")!;
    expect(profile).toBeDefined();
    expect(profile.permissions.health).toEqual({
      view: true,
      create: true,
      edit: true,
      record_routine: true,
    });
    expect("read" in (profile.permissions.health ?? {})).toBe(false);
    expect(profile.permissions.health?.["read" as unknown as AccessAction]).toBeUndefined();
    expect(hasAccessPermission(profile, "health", "view")).toBe(true);
    expect(hasAccessPermission(profile, "health", "create")).toBe(true);
    expect(hasAccessPermission(profile, "health", "edit")).toBe(true);
    expect(hasAccessPermission(profile, "health", "record_routine")).toBe(true);
    expect(hasAccessPermission(profile, "health", "read" as AccessAction)).toBe(false);
  });

  it("3. default gestor contains its valid grants and health.read ABSENT", () => {
    const profile = getDefaultAccessProfile("gestor")!;
    expect(profile).toBeDefined();
    expect(profile.permissions.health?.view).toBe(true);
    expect(profile.permissions.health?.edit).toBe(true);
    expect(profile.permissions.health?.archive).toBe(true);
    expect(profile.permissions.health?.approve).toBeUndefined();
    expect(profile.permissions.health?.audit).toBe(true);
    expect(profile.permissions.health?.export).toBe(true);
    expect(profile.permissions.health?.manage_nutrition_plan).toBe(true);
    expect("read" in (profile.permissions.health ?? {})).toBe(false);
    expect(profile.permissions.health?.["read" as unknown as AccessAction]).toBeUndefined();
    expect(hasAccessPermission(profile, "health", "read" as AccessAction)).toBe(false);
  });

  it("4. canonical authority evaluation does NOT allow health.read=true + health.view absent/false to substitute for health.view", () => {
    const base = getDefaultAccessProfile("operador_k9")!;
    const profileWithOnlyRead: AccessProfile = {
      ...base,
      permissions: {
        ...base.permissions,
        health: {
          ...base.permissions.health,
          view: false,
          read: true,
        } as unknown as Record<AccessAction, boolean>,
      },
    };

    // Stale health.read MUST NOT independently grant view authority
    expect(hasAccessPermission(profileWithOnlyRead, "health", "view")).toBe(false);

    const profileWithoutView: AccessProfile = {
      ...base,
      permissions: {
        ...base.permissions,
        health: {
          read: true,
        } as unknown as Record<AccessAction, boolean>,
      },
    };
    expect(hasAccessPermission(profileWithoutView, "health", "view")).toBe(false);
  });

  it("5. adminSaveAccessProfile client payload generation strips health.read", () => {
    const base = getDefaultAccessProfile("operador_k9")!;
    const profileWithRead: AccessProfile = {
      ...base,
      permissions: {
        ...base.permissions,
        health: {
          view: true,
          create: true,
          edit: true,
          read: true,
        } as unknown as Record<AccessAction, boolean>,
      },
    };

    const payload = accessProfileForFunction(profileWithRead);
    expect("read" in (payload.permissions.health ?? {})).toBe(false);
    expect(payload.permissions.health?.view).toBe(true);
    expect(payload.permissions.health?.create).toBe(true);
    expect(payload.permissions.health?.edit).toBe(true);
  });

  it("6. canonical profile editor/save flow does not re-emit health.read but preserves forward-compatible actions", () => {
    const base = getDefaultAccessProfile("operador_k9")!;
    const profileWithBoth: AccessProfile = {
      ...base,
      permissions: {
        ...base.permissions,
        health: {
          view: true,
          create: true,
          edit: true,
          read: true,
          future_health_action: true,
        } as unknown as Record<AccessAction, boolean>,
      },
    };

    const payload = accessProfileForFunction(profileWithBoth);
    expect("read" in (payload.permissions.health ?? {})).toBe(false);
    expect((payload.permissions.health as Record<string, unknown>).future_health_action).toBe(true);
    expect(payload.permissions.health?.view).toBe(true);
  });

  it("7. Health semantic capability name 'health.read' remains available in its domain vocabulary", () => {
    const healthCapability: HealthCapability = "health.read";
    expect(healthCapability).toBe("health.read");
    expect(CAPABILITY_LABELS["health.read"]).toBe("Ler Dados de Saúde");
    expect(LEGACY_TO_GRANULAR["health.view"]).toContain("health.read");
  });

  it("8. manage_nutrition_plan behavior remains unchanged", () => {
    const gestor = getDefaultAccessProfile("gestor")!;
    expect(gestor.permissions.health?.manage_nutrition_plan).toBe(true);
    expect(hasAccessPermission(gestor, "health", "manage_nutrition_plan")).toBe(true);

    const operador = getDefaultAccessProfile("operador_k9")!;
    expect(operador.permissions.health?.manage_nutrition_plan).toBeUndefined();
    expect(hasAccessPermission(operador, "health", "manage_nutrition_plan")).toBe(false);
  });
});

describe("normalizeProfileId", () => {
  it("normalizes dynamic IDs", () => {
    expect(normalizeProfileId("stg_health_readiness_homologator")).toBe(
      "stg_health_readiness_homologator",
    );
    expect(normalizeProfileId("  STG-Health.Readiness Homologator  ")).toBe(
      "stg_health_readiness_homologator",
    );
  });

  it("returns null for empty/invalid", () => {
    expect(normalizeProfileId(null)).toBeNull();
    expect(normalizeProfileId("")).toBeNull();
    expect(normalizeProfileId("   ")).toBeNull();
  });
});

describe("isValidProfileIdFormat", () => {
  it("accepts valid Firestore-like IDs", () => {
    expect(isValidProfileIdFormat("operador_k9")).toBe(true);
    expect(isValidProfileIdFormat("stg_health_readiness_homologator")).toBe(true);
    expect(isValidProfileIdFormat("custom_profile_123")).toBe(true);
    expect(isValidProfileIdFormat("abc")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidProfileIdFormat("ab")).toBe(false);
    expect(isValidProfileIdFormat("")).toBe(false);
    expect(isValidProfileIdFormat("_invalid")).toBe(false);
    expect(isValidProfileIdFormat("a")).toBe(false);
  });
});

describe("getCanonicalProfileId", () => {
  it("operador_k9 remains operador_k9", () => {
    expect(getCanonicalProfileId("operador_k9")).toBe("operador_k9");
  });

  it("gestor remains gestor", () => {
    expect(getCanonicalProfileId("gestor")).toBe("gestor");
  });

  it("administrador remains administrador", () => {
    expect(getCanonicalProfileId("administrador")).toBe("administrador");
  });

  it("known legacy aliases still resolve", () => {
    expect(getCanonicalProfileId("condutor")).toBe("operador_k9");
    expect(getCanonicalProfileId("comando")).toBe("gestor");
    expect(getCanonicalProfileId("admin")).toBe("administrador");
    expect(getCanonicalProfileId("estoque")).toBe("almoxarifado");
    expect(getCanonicalProfileId("instrutor")).toBe("instrutor_k9");
  });

  it("valid dynamic canonical profile resolves correctly", () => {
    expect(getCanonicalProfileId("stg_health_readiness_homologator")).toBe(
      "stg_health_readiness_homologator",
    );
    expect(getCanonicalProfileId("custom_profile_123")).toBe("custom_profile_123");
    expect(getCanonicalProfileId("my_dynamic_profile")).toBe("my_dynamic_profile");
  });

  it("stg_health_readiness_homologator resolves to itself", () => {
    expect(getCanonicalProfileId("stg_health_readiness_homologator")).toBe(
      "stg_health_readiness_homologator",
    );
  });

  it("invalid/nonexistent profile fails safely", () => {
    expect(getCanonicalProfileId(null)).toBeNull();
    expect(getCanonicalProfileId("")).toBeNull();
    expect(getCanonicalProfileId("ab")).toBeNull();
    expect(getCanonicalProfileId("!@#")).toBeNull();
  });

  it("does not hard-code only homologator — other dynamics work", () => {
    expect(getCanonicalProfileId("another_dynamic_profile_xyz")).toBe(
      "another_dynamic_profile_xyz",
    );
  });
});

describe("resolveProfileId — precedence and fail-safe", () => {
  function authProfile(overrides: {
    access_profile_id?: string | null;
    accessProfileId?: string | null;
    accessProfile?: string | null;
    access_profile?: string | null;
    accessLevel?: string | null;
    roles?: string[];
    isK9Instructor?: boolean;
  }) {
    const mirror: Record<string, unknown> = {};
    if (overrides.access_profile_id !== undefined)
      mirror.access_profile_id = overrides.access_profile_id;
    if (overrides.accessProfileId !== undefined)
      mirror.accessProfileId = overrides.accessProfileId;
    if (overrides.accessProfile !== undefined)
      mirror.accessProfile = overrides.accessProfile;
    if (overrides.access_profile !== undefined)
      mirror.access_profile = overrides.access_profile;
    if (overrides.accessLevel !== undefined)
      mirror.accessLevel = overrides.accessLevel;
    return {
      uid: "uid",
      email: "test@gcm.com.br",
      displayName: "Test",
      photoUrl: null,
      ra: "123",
      roles: overrides.roles ?? [],
      isK9Instructor: overrides.isK9Instructor ?? false,
      claims: {},
      userMirror: mirror,
    };
  }

  it("explicit canonical profile has precedence over legacy role", () => {
    const profile = authProfile({
      access_profile_id: "stg_health_readiness_homologator",
      roles: ["condutor"],
    });
    expect(resolveProfileId(profile as never)).toBe(
      "stg_health_readiness_homologator",
    );
  });

  it("valid explicit profile does not fall back to condutor/operador_k9", () => {
    const profile = authProfile({
      access_profile_id: "stg_health_readiness_homologator",
      roles: ["condutor"],
    });
    const resolved = resolveProfileId(profile as never);
    expect(resolved).not.toBe("operador_k9");
    expect(resolved).toBe("stg_health_readiness_homologator");
  });

  it("explicit dynamic profile resolves even with operador role present", () => {
    const profile = authProfile({
      access_profile_id: "custom_profile_123",
      roles: ["operador_k9"],
    });
    expect(resolveProfileId(profile as never)).toBe("custom_profile_123");
  });

  it("invalid explicit ID fails safely to fallback (not to role)", () => {
    const profile = authProfile({
      access_profile_id: "ab",
      roles: ["condutor"],
    });
    expect(resolveProfileId(profile as never)).toBe("operador_k9");
  });

  it("no explicit ID falls back to legacy role", () => {
    const profile = authProfile({ roles: ["condutor"] });
    expect(resolveProfileId(profile as never)).toBe("operador_k9");
  });

  it("legacy alias via explicit field still resolves", () => {
    const profile = authProfile({ access_profile_id: "condutor" });
    expect(resolveProfileId(profile as never)).toBe("operador_k9");
  });

  it("null profile returns fallback", () => {
    expect(resolveProfileId(null)).toBe("operador_k9");
  });
});

describe("operador_k9 permissions invariant", () => {
  it("operador_k9 must NOT have health archive/approve/audit", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(hasAccessPermission(operador, "health", "archive")).toBe(false);
    expect(hasAccessPermission(operador, "health", "approve")).toBe(false);
    expect(hasAccessPermission(operador, "health", "audit")).toBe(false);
    expect(hasAccessPermission(operador, "health", "export")).toBe(false);
  });

  it("operador_k9 has routine operational recording on health (view/create/edit/record_routine)", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(hasAccessPermission(operador, "health", "view")).toBe(true);
    expect(hasAccessPermission(operador, "health", "create")).toBe(true);
    expect(hasAccessPermission(operador, "health", "edit")).toBe(true);
    expect(hasAccessPermission(operador, "health", "record_routine")).toBe(true);
  });

  it("capabilities come from resolved canonical profile", () => {
    const homologator = {
      id: "stg_health_readiness_homologator",
      status: "active" as const,
      permissions: {
        health: { view: true, create: true, edit: true, archive: true, approve: true },
      },
      name: "Homologator",
      description: "",
      level: "test",
      module_tags: [],
      role_keys: [],
      scope: "global" as const,
      seed_version: 1,
      slug: "stg_health_readiness_homologator",
      tone: "cyan",
    };
    expect(hasAccessPermission(homologator, "health", "archive")).toBe(true);
    expect(hasAccessPermission(homologator, "health", "approve")).toBe(true);
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(hasAccessPermission(operador, "health", "archive")).toBe(false);
  });
});

describe("CT3.F10.OPERATOR-HEALTH-ROUTINE-CAPABILITY-REPAIR-R1", () => {
  it("operador_k9 contains health.record_routine = true", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(operador).toBeDefined();
    expect(operador.permissions.health?.record_routine).toBe(true);
  });

  it("operador_k9 hasAccessPermission(operador, 'health', 'record_routine') === true", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(hasAccessPermission(operador, "health", "record_routine")).toBe(true);
  });

  it("operador_k9 does NOT gain issue_restriction, release_restriction, cancel_restriction or admin capabilities", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    expect(hasAccessPermission(operador, "health", "issue_restriction" as AccessAction)).toBe(false);
    expect(hasAccessPermission(operador, "health", "release_restriction" as AccessAction)).toBe(false);
    expect(hasAccessPermission(operador, "health", "cancel_restriction" as AccessAction)).toBe(false);
    expect(hasAccessPermission(operador, "health", "archive")).toBe(false);
    expect(hasAccessPermission(operador, "health", "approve")).toBe(false);
    expect(hasAccessPermission(operador, "health", "audit")).toBe(false);
    expect(hasAccessPermission(operador, "health", "export")).toBe(false);
    expect(hasAccessPermission(operador, "health", "manage_nutrition_plan")).toBe(false);
  });

  it("defaultAccessProfiles includes record_routine in operador_k9 and administrador", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    const admin = defaultAccessProfiles.find((p) => p.id === "administrador")!;
    const gestor = defaultAccessProfiles.find((p) => p.id === "gestor")!;
    const almoxarifado = defaultAccessProfiles.find((p) => p.id === "almoxarifado")!;

    expect(operador.permissions.health?.record_routine).toBe(true);
    expect(admin.permissions.health?.record_routine).toBe(true);
    expect(gestor.permissions.health?.record_routine).toBeUndefined();
    expect(almoxarifado.permissions.health?.record_routine).toBeUndefined();
  });

  it("normalizePermissionMap preserves record_routine across array and map shapes", () => {
    const fromArray = normalizePermissionMap({
      health: ["view", "create", "edit", "record_routine"],
    });
    expect(fromArray.health).toEqual({
      view: true,
      create: true,
      edit: true,
      record_routine: true,
    });

    const fromMap = normalizePermissionMap({
      health: {
        view: true,
        record_routine: true,
      },
    });
    expect(fromMap.health?.record_routine).toBe(true);
  });

  it("seed payload simulation preserves record_routine (accessProfileForFunction)", () => {
    const operador = defaultAccessProfiles.find((p) => p.id === "operador_k9")!;
    const payload = accessProfileForFunction(operador);

    expect(payload.permissions.health?.record_routine).toBe(true);
    expect(payload.permissions.health?.view).toBe(true);
    expect(payload.permissions.health?.create).toBe(true);
    expect(payload.permissions.health?.edit).toBe(true);
    expect("read" in (payload.permissions.health ?? {})).toBe(false);
  });

  it("dynamic profile resolution (stg_health_readiness_homologator) remains intact with canonical precedence", () => {
    expect(getCanonicalProfileId("stg_health_readiness_homologator")).toBe(
      "stg_health_readiness_homologator",
    );

    const userProfile = {
      uid: "test-homologator-uid",
      email: "homolog@gcm.com.br",
      displayName: "Homologator",
      photoUrl: null,
      ra: "999999",
      roles: ["condutor"],
      isK9Instructor: false,
      claims: {},
      userMirror: {
        access_profile_id: "stg_health_readiness_homologator",
      },
    };

    expect(resolveProfileId(userProfile as never)).toBe(
      "stg_health_readiness_homologator",
    );
  });
});
