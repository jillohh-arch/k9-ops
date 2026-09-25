import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getDefaultAccessProfile } from "@/lib/permissions/access-control";
import { PermissionsEditor } from "./access-profiles-editor";
import { setModuleAccessLevel, togglePermission } from "./access-profiles-types";

describe("Health permission editor", () => {
  it("renders nutrition management action and does not render deprecated read toggle", () => {
    render(
      <PermissionsEditor
        draft={getDefaultAccessProfile("gestor")!}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Pode ler dados Health v1")).toBeNull();
    expect(screen.getByText("Pode gerenciar planos alimentares")).toBeTruthy();
    expect(screen.getByText("Pode registrar rotina de saúde (pesagem)")).toBeTruthy();
  });

  it("renders record_routine sensitive toggle for operador_k9", () => {
    render(
      <PermissionsEditor
        draft={getDefaultAccessProfile("operador_k9")!}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Pode registrar rotina de saúde (pesagem)")).toBeTruthy();
  });

  it("toggles health.record_routine correctly", () => {
    const operador = getDefaultAccessProfile("operador_k9")!;
    expect(operador.permissions.health?.record_routine).toBe(true);

    const toggledOff = togglePermission(operador, "health", "record_routine");
    expect(toggledOff.permissions.health?.record_routine).toBe(false);

    const toggledOn = togglePermission(toggledOff, "health", "record_routine");
    expect(toggledOn.permissions.health?.record_routine).toBe(true);
  });

  it("preserves health.record_routine when generic level changes", () => {
    const operador = getDefaultAccessProfile("operador_k9")!;
    expect(operador.permissions.health?.record_routine).toBe(true);

    const changed = setModuleAccessLevel(operador, "health", "consulta");
    expect(changed.permissions.health?.view).toBe(true);
    expect(changed.permissions.health?.edit).toBe(false);
    expect(changed.permissions.health?.record_routine).toBe(true);
  });

  it("does not include record_routine in levelActions.total", () => {
    const blank = {
      ...getDefaultAccessProfile("operador_k9")!,
      permissions: { health: {} },
    };

    const total = setModuleAccessLevel(blank, "health", "total");
    expect(total.permissions.health?.view).toBe(true);
    expect(total.permissions.health?.create).toBe(true);
    expect(total.permissions.health?.edit).toBe(true);
    expect(total.permissions.health?.archive).toBe(true);
    expect(total.permissions.health?.approve).toBe(true);
    expect(total.permissions.health?.audit).toBe(true);
    expect(total.permissions.health?.export).toBe(true);
    expect(total.permissions.health?.record_routine).toBeUndefined();
    expect(total.permissions.health?.manage_nutrition_plan).toBeUndefined();
  });

  it("preserves Health v1 actions when another permission changes", () => {
    const gestor = getDefaultAccessProfile("gestor")!;
    const changed = togglePermission(gestor, "health", "audit");

    expect(changed.permissions.health?.view).toBe(true);
    expect(changed.permissions.health?.manage_nutrition_plan).toBe(true);
  });

  it("preserves dedicated and unknown actions when a generic level changes", () => {
    const gestor = getDefaultAccessProfile("gestor")!;
    const withUnknown = {
      ...gestor,
      permissions: {
        ...gestor.permissions,
        health: {
          ...gestor.permissions.health,
          future_health_action: true,
        },
      },
    };

    const changed = setModuleAccessLevel(withUnknown, "health", "consulta");

    expect(changed.permissions.health?.view).toBe(true);
    expect(changed.permissions.health?.manage_nutrition_plan).toBe(true);
    expect(changed.permissions.health?.future_health_action).toBe(true);
    expect(changed.permissions.health?.edit).toBe(false);
  });
});
