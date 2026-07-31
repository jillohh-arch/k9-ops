import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import {getDefaultAccessProfile} from "@/lib/permissions/access-control";
import {PermissionsEditor} from "./access-profiles-editor";
import {setModuleAccessLevel, togglePermission} from "./access-profiles-types";

describe("nutrition plan permission editor", () => {
  it("renders the dedicated action", () => {
    render(<PermissionsEditor draft={getDefaultAccessProfile("gestor")!} onChange={vi.fn()} />);
    expect(screen.getByText("Pode gerenciar planos alimentares")).toBeTruthy();
  });

  it("preserves the capability when another health permission changes", () => {
    const gestor = getDefaultAccessProfile("gestor")!;
    const changed = togglePermission(gestor, "health", "audit");
    expect(changed.permissions.health?.manage_nutrition_plan).toBe(true);
  });

  it("preserves the capability when the generic health level changes", () => {
    const gestor = getDefaultAccessProfile("gestor")!;
    const changed = setModuleAccessLevel(gestor, "health", "consulta");
    expect(changed.permissions.health?.manage_nutrition_plan).toBe(true);
    expect(changed.permissions.health?.view).toBe(true);
    expect(changed.permissions.health?.edit).toBe(false);
  });
});
