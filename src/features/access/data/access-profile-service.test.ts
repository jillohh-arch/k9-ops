import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/functions", () => ({
  callAdminAssignAccessProfile: vi.fn(),
  callAdminDuplicateAccessProfile: vi.fn(),
  callAdminSaveAccessProfile: vi.fn(),
  callAdminSeedAccessProfiles: vi.fn(),
  callAdminSetAccessProfileStatus: vi.fn(),
}));

import { callAdminSaveAccessProfile } from "@/lib/firebase/functions";
import { getDefaultAccessProfile } from "@/lib/permissions/access-control";
import {
  accessProfileForFunction,
  normalizeAccessProfile,
  saveAccessProfile,
} from "./access-profile-service";

describe("access profile save path", () => {
  beforeEach(() => {
    vi.mocked(callAdminSaveAccessProfile).mockReset();
    vi.mocked(callAdminSaveAccessProfile).mockResolvedValue({ data: {} });
  });

  it("preserves unknown actions through load and serialization", () => {
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

  it("sends preserved actions when another profile field is edited", async () => {
    const profile = getDefaultAccessProfile("gestor")!;
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
