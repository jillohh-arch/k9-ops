import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminUpsertK9 = vi.fn();
const uploadBytes = vi.fn();
const getDownloadURL = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({
  callAdminUpsertK9,
  callAdminArchiveK9: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));

vi.mock("firebase/firestore", () => ({
  Timestamp: { fromDate: (d: Date) => ({ d }) },
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: "generated-dog-id" })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(() => ({})),
  uploadBytes,
  getDownloadURL,
}));

const { saveNewK9V1 } = await import("../../../data/k9-admin-service");

const authProfile = { uid: "tester" } as never;

describe("saveNewK9V1 — payload CREATE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callAdminUpsertK9.mockResolvedValue({ data: { id: "generated-dog-id" } });
  });

  function baseValues() {
    return {
      birthDate: "2020-01-02",
      breed: "Malinois Belga",
      color: "Caramelo",
      microchip: "981000",
      name: "Bono",
      notes: "Observação",
      profileImageUrl: "",
      registrationNumber: "K9-001",
      sex: "M",
      size: "Grande",
    };
  }

  it("fixa operationalStatus Ativo e gera dogId", async () => {
    const id = await saveNewK9V1({
      photoFile: null,
      profile: authProfile,
      values: baseValues(),
    });

    expect(id).toBe("generated-dog-id");
    expect(callAdminUpsertK9).toHaveBeenCalledTimes(1);
    const arg = callAdminUpsertK9.mock.calls[0][0];
    expect(arg.mode).toBe("create");
    expect(arg.dogId).toBe("generated-dog-id");
    expect(arg.profile.operationalStatus).toBe("Ativo");
  });

  it("não envia nenhum campo de Saúde", async () => {
    await saveNewK9V1({ photoFile: null, profile: authProfile, values: baseValues() });
    const profile = callAdminUpsertK9.mock.calls[0][0].profile;

    expect(profile).not.toHaveProperty("weight");
    expect(profile).not.toHaveProperty("idealWeightMin");
    expect(profile).not.toHaveProperty("idealWeightMax");
    expect(profile).not.toHaveProperty("physicalCondition");
    expect(profile).not.toHaveProperty("readiness");
  });

  it("não envia campos de Binômios", async () => {
    await saveNewK9V1({ photoFile: null, profile: authProfile, values: baseValues() });
    const profile = callAdminUpsertK9.mock.calls[0][0].profile;

    expect(profile).not.toHaveProperty("conductorRa");
    expect(profile).not.toHaveProperty("conductor_ra");
    expect(profile).not.toHaveProperty("handlerId");
  });

  it("não envia campos de Treinamento", async () => {
    await saveNewK9V1({ photoFile: null, profile: authProfile, values: baseValues() });
    const profile = callAdminUpsertK9.mock.calls[0][0].profile;

    expect(profile).not.toHaveProperty("specialties");
    expect(profile).not.toHaveProperty("modalities");
  });

  it("envia exatamente as chaves do contrato CREATE", async () => {
    await saveNewK9V1({ photoFile: null, profile: authProfile, values: baseValues() });
    const profile = callAdminUpsertK9.mock.calls[0][0].profile;

    expect(Object.keys(profile).sort()).toEqual(
      [
        "birthDate",
        "breed",
        "color",
        "microchip",
        "name",
        "notes",
        "operationalStatus",
        "profileImageUrl",
        "registrationNumber",
        "sex",
        "size",
      ].sort(),
    );
  });

  it("faz upload da foto quando presente e usa a URL resultante", async () => {
    getDownloadURL.mockResolvedValue("https://cdn/photo.jpg");
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

    await saveNewK9V1({
      photoFile: file,
      profile: authProfile,
      values: baseValues(),
    });

    expect(uploadBytes).toHaveBeenCalledTimes(1);
    const profile = callAdminUpsertK9.mock.calls[0][0].profile;
    expect(profile.profileImageUrl).toBe("https://cdn/photo.jpg");
  });

  it("envia profileImageUrl null quando não há foto", async () => {
    await saveNewK9V1({ photoFile: null, profile: authProfile, values: baseValues() });
    const profile = callAdminUpsertK9.mock.calls[0][0].profile;
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(profile.profileImageUrl).toBeNull();
  });
});
