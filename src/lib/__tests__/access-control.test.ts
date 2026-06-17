import { describe, expect, it } from "vitest";

import {
  defaultAccessProfiles,
  getDefaultAccessProfile,
  getProfileIdFromLegacyValue,
  hasAccessPermission,
  isVisibleAccessProfile,
  mergeAccessProfilesWithDefaults,
  normalizePermissionMap,
  sortAccessProfiles,
  visibleAccessProfiles,
} from "../permissions/access-control";

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
});

describe("hasAccessPermission", () => {
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
  it("returns true for canonical profiles", () => {
    expect(isVisibleAccessProfile({ id: "operador_k9", ui_hidden: undefined })).toBe(true);
    expect(isVisibleAccessProfile({ id: "administrador", ui_hidden: undefined })).toBe(true);
  });

  it("returns false for hidden profiles", () => {
    expect(isVisibleAccessProfile({ id: "instrutor_k9", ui_hidden: true })).toBe(false);
  });

  it("returns false for non-canonical profiles", () => {
    expect(isVisibleAccessProfile({ id: "random_profile", ui_hidden: undefined })).toBe(false);
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
  it("excludes hidden profiles and sorts", () => {
    const visible = visibleAccessProfiles(defaultAccessProfiles);
    const ids = visible.map((p) => p.id);
    expect(ids).not.toContain("instrutor_k9");
    expect(ids).toContain("operador_k9");
    expect(ids).toContain("administrador");
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
