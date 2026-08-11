import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getDefaultAccessProfile } from "@/lib/permissions/access-control";
import { PermissionsEditor } from "./access-profiles-editor";
import { setModuleAccessLevel, togglePermission } from "./access-profiles-types";

describe("Health permission editor", () => {
  it("renders dedicated read and nutrition management actions", () => {
    render(
      <PermissionsEditor
        draft={getDefaultAccessProfile("gestor")!}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Pode ler dados Health v1")).toBeTruthy();
    expect(screen.getByText("Pode gerenciar planos alimentares")).toBeTruthy();
  });

  it("preserves Health v1 actions when another permission changes", () => {
    const gestor = getDefaultAccessProfile("gestor")!;
    const changed = togglePermission(gestor, "health", "audit");

    expect(changed.permissions.health?.view).toBe(true);
    expect(changed.permissions.health?.read).toBe(true);
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
    expect(changed.permissions.health?.read).toBe(true);
    expect(changed.permissions.health?.manage_nutrition_plan).toBe(true);
    expect(changed.permissions.health?.future_health_action).toBe(true);
    expect(changed.permissions.health?.edit).toBe(false);
  });
});
