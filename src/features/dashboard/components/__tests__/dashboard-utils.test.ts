import { describe, expect, it } from "vitest";

import { detectUserProfile, isK9Instructor } from "../dashboard-utils";

describe("dashboard/components/dashboard-utils — detectUserProfile (R1 parity)", () => {
  it("IR-01 / IR-02: never elevates via roles or JWT claims when isK9Instructor is false", () => {
    expect(
      detectUserProfile({
        isK9Instructor: false,
        roles: ["instrutor_k9", "instrutor", "adestrador"],
        claims: { instrutor_k9: true, role: "instrutor_k9" },
      }),
    ).toBe("operador");
  });

  it("IR-06 / IR-07 / IR-08: missing/inactive/loading fail closed despite JWT instructor claims", () => {
    expect(
      detectUserProfile({
        isK9Instructor: false,
        roles: [],
        claims: { instrutor_k9: true },
      }),
    ).toBe("operador");
    expect(
      detectUserProfile({
        roles: [],
        claims: { instrutor_k9: true },
      }),
    ).toBe("operador");
  });

  it("IR-03 / IR-04 / IR-05: returns 'instrutor' when isK9Instructor is true and preserves higher admin/gestor", () => {
    expect(
      detectUserProfile({
        isK9Instructor: true,
        roles: [],
        claims: {},
      }),
    ).toBe("instrutor");
    expect(
      detectUserProfile({
        isK9Instructor: true,
        roles: ["gestor"],
        claims: {},
      }),
    ).toBe("gestor");
    expect(
      detectUserProfile({
        isK9Instructor: true,
        roles: ["administrador"],
        claims: {},
      }),
    ).toBe("admin");
  });
});

describe("dashboard/components/dashboard-utils — isK9Instructor record helper (R1 parity)", () => {
  it("IR-01 / IR-02: explicit is_k9_instructor: false overrides all legacy flags", () => {
    expect(
      isK9Instructor({
        active: true,
        is_k9_instructor: false,
        training_instructor: true,
        instrutor_k9: true,
        instrutor: true,
        adestrador: true,
        training_role: "instrutor_k9",
        role: "instrutor_k9",
        roles: ["instrutor_k9", "instrutor", "adestrador"],
      }),
    ).toBe(false);
  });

  it("IR-03 / IR-04: active canonical is_k9_instructor: true returns true", () => {
    expect(isK9Instructor({ active: true, is_k9_instructor: true })).toBe(true);
    expect(isK9Instructor({ is_k9_instructor: true })).toBe(true);
  });

  it("IR-05: absent canonical field honors ratified legacy compatibility fields", () => {
    expect(isK9Instructor({ training_instructor: true })).toBe(true);
    expect(isK9Instructor({ instrutor_k9: true })).toBe(true);
    expect(isK9Instructor({ instrutor: true })).toBe(true);
    expect(isK9Instructor({ adestrador: true })).toBe(true);
    expect(isK9Instructor({ training_role: "  Instrutor_K9 " })).toBe(true);
    expect(isK9Instructor({ training_role: "k9_instructor" })).toBe(true);
    expect(isK9Instructor({ roles: ["adestrador"] })).toBe(true);
    expect(isK9Instructor({ roles: ["adestrador_k9"] })).toBe(true);
    expect(isK9Instructor({ role: "instrutor_k9" })).toBe(false);
  });

  it("IR-07: inactive, soft-deleted, or archived records fail closed", () => {
    expect(isK9Instructor({ is_k9_instructor: true, active: false })).toBe(false);
    expect(
      isK9Instructor({
        is_k9_instructor: true,
        deleted_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
    expect(
      isK9Instructor({
        is_k9_instructor: true,
        deleted_at: { seconds: 1700000000 },
      }),
    ).toBe(false);
    expect(
      isK9Instructor({
        is_k9_instructor: true,
        archived_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
    expect(
      isK9Instructor({ is_k9_instructor: true, status: "Inativo" }),
    ).toBe(false);
    expect(
      isK9Instructor({ is_k9_instructor: true, status: "inactive" }),
    ).toBe(false);
  });

  it("fails closed on non-boolean non-nullish is_k9_instructor values", () => {
    expect(
      isK9Instructor({
        is_k9_instructor: "true",
        training_instructor: true,
      }),
    ).toBe(false);
    expect(
      isK9Instructor({
        is_k9_instructor: 1,
        instrutor_k9: true,
      }),
    ).toBe(false);
  });
});
