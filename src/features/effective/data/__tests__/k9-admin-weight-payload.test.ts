/**
 * WEIGHT-01E-C2C-B — cadastro de K9 não envia peso.
 *
 * O formulário cadastral exigia "Peso atual (kg)" e o `saveK9` reenviava esse
 * valor via spread de `values`. No Backend, `adminUpsertK9` criava um documento
 * em `dogs/{dogId}/weight_records` a partir dele, com `measured_at` do save —
 * evidência clínica fabricada sem que ninguém tivesse pesado o cão.
 *
 * Esconder o input não bastaria: a prova que importa é o payload. Estes testes
 * exercitam `saveK9` com o mock do callable e asseguram que a chave `weight`
 * nunca chega ao Backend, inclusive quando o cão carregado já possui peso
 * cadastral e quando o valor persiste no estado do formulário.
 */

import { describe, expect, it, vi } from "vitest";

const callAdminUpsertK9 =
  vi.fn<(arg: unknown) => Promise<{ data: { id: string } }>>();
callAdminUpsertK9.mockResolvedValue({ data: { id: "dog-1" } });

const callAdminArchiveK9 =
  vi.fn<(arg: unknown) => Promise<{ data: unknown }>>();
callAdminArchiveK9.mockResolvedValue({ data: {} });

vi.mock("@/lib/firebase/functions", () => ({
  callAdminArchiveK9: (arg: unknown) => callAdminArchiveK9(arg),
  callAdminUpsertK9: (arg: unknown) => callAdminUpsertK9(arg),
}));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: "generated-dog-id" })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock("firebase/storage", () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));
vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));

import { saveK9 } from "../k9-admin-service";

/** Valores de formulário com peso cadastral preenchido (estado legado). */
function formValues(overrides: Record<string, unknown> = {}) {
  return {
    birthDate: "2020-01-15",
    breed: "Pastor Belga Malinois",
    handlerRa: "12345",
    idealWeightMax: "36",
    idealWeightMin: "28",
    microchip: "",
    name: "Apolo",
    notes: "",
    operationalStatus: "ativo",
    profileImageUrl: "",
    registrationNumber: "K9-001",
    sex: "M",
    specialties: ["patrulha"],
    // Sentinela: se este valor vazar para o Backend, o teste falha.
    weight: "99.9",
    ...overrides,
  } as never;
}

function lastProfilePayload(): Record<string, unknown> {
  const call = callAdminUpsertK9.mock.calls.at(-1);
  expect(call).toBeDefined();
  const [arg] = call as unknown as [{ profile: Record<string, unknown> }];
  return arg.profile;
}

describe("saveK9 — peso não é campo de cadastro", () => {
  it("T2 create: payload não possui a chave weight", async () => {
    callAdminUpsertK9.mockClear();

    await saveK9({
      mode: "create",
      photoFile: null,
      profile: {} as never,
      values: formValues(),
    });

    const profile = lastProfilePayload();
    expect(Object.keys(profile)).not.toContain("weight");
    expect(profile.weight).toBeUndefined();
  });

  it("T4 edit: cão com peso cadastral existente não reenvia weight", async () => {
    callAdminUpsertK9.mockClear();

    await saveK9({
      dogId: "dog-1",
      mode: "edit",
      photoFile: null,
      profile: {} as never,
      values: formValues({ name: "Apolo II" }),
    });

    const profile = lastProfilePayload();
    expect(Object.keys(profile)).not.toContain("weight");
    // O peso cadastral existente não pode ser promovido a nova pesagem.
    expect(JSON.stringify(profile)).not.toContain("99.9");
  });

  it("dados cadastrais continuam sendo enviados normalmente", async () => {
    callAdminUpsertK9.mockClear();

    await saveK9({
      dogId: "dog-1",
      mode: "edit",
      photoFile: null,
      profile: {} as never,
      values: formValues(),
    });

    const profile = lastProfilePayload();
    expect(profile.name).toBe("Apolo");
    expect(profile.registrationNumber).toBe("K9-001");
    expect(profile.breed).toBe("Pastor Belga Malinois");
    // Faixa ideal é dado cadastral legítimo e permanece.
    expect(profile.idealWeightMin).toBe("28");
    expect(profile.idealWeightMax).toBe("36");
  });

  it("T3/T5 nenhum comando de pesagem é disparado pelo cadastro", async () => {
    callAdminUpsertK9.mockClear();

    await saveK9({
      mode: "create",
      photoFile: null,
      profile: {} as never,
      values: formValues(),
    });

    // Apenas o upsert cadastral: nenhum writer clínico é acionado aqui.
    expect(callAdminUpsertK9).toHaveBeenCalledTimes(1);
    expect(callAdminArchiveK9).not.toHaveBeenCalled();
  });
});
