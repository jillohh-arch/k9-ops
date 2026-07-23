import { describe, expect, it } from "vitest";

import {
  deriveK9LoadingStage,
  K9_LOADING_FOOTER,
  K9_LOADING_STEPS,
  K9_LOADING_TITLE,
  K9_STAGE_PROGRESS_CEILING,
  stageOrder,
} from "../k9-ops-loading-constants";

describe("K9_LOADING_STEPS — copy oficial", () => {
  it("expõe as 3 etapas oficiais da Web na ordem correta", () => {
    expect(K9_LOADING_STEPS.map((s) => s.label)).toEqual([
      "Validando acesso",
      "Carregando permissões",
      "Sincronizando módulos",
    ]);
  });

  it("expõe os subtextos oficiais", () => {
    expect(K9_LOADING_STEPS.map((s) => s.detail)).toEqual([
      "Conexão segura estabelecida",
      "Verificando níveis de autorização",
      "Inicializando componentes",
    ]);
  });

  it("mantém título e footer oficiais", () => {
    expect(K9_LOADING_TITLE).toBe("PREPARANDO PAINEL OPERACIONAL...");
    expect(K9_LOADING_FOOTER).toBe("K9 OPS • INTELLIGENCE IN MOTION");
  });
});

describe("deriveK9LoadingStage — estados reais", () => {
  it("auth carregando → validatingAccess", () => {
    expect(
      deriveK9LoadingStage({
        authStatus: "loading",
        accessStatus: "loading",
      }),
    ).toBe("validatingAccess");
  });

  it("autenticado + acesso carregando → loadingPermissions", () => {
    expect(
      deriveK9LoadingStage({
        authStatus: "authenticated",
        accessStatus: "loading",
      }),
    ).toBe("loadingPermissions");
  });

  it("autenticado + acesso ready → ready", () => {
    expect(
      deriveK9LoadingStage({
        authStatus: "authenticated",
        accessStatus: "ready",
      }),
    ).toBe("ready");
  });

  it("autenticado + acesso fallback → ready", () => {
    expect(
      deriveK9LoadingStage({
        authStatus: "authenticated",
        accessStatus: "fallback",
      }),
    ).toBe("ready");
  });

  it("não autenticado → validatingAccess (transitório)", () => {
    expect(
      deriveK9LoadingStage({
        authStatus: "unauthenticated",
        accessStatus: "loading",
      }),
    ).toBe("validatingAccess");
  });
});

describe("K9_STAGE_PROGRESS_CEILING — marcos", () => {
  it("nunca atinge 1.0 antes de ready", () => {
    expect(K9_STAGE_PROGRESS_CEILING.validatingAccess).toBeLessThan(1.0);
    expect(K9_STAGE_PROGRESS_CEILING.loadingPermissions).toBeLessThan(1.0);
    expect(K9_STAGE_PROGRESS_CEILING.syncingModules).toBeLessThan(1.0);
    expect(K9_STAGE_PROGRESS_CEILING.ready).toBe(1.0);
  });

  it("tetos crescem monotonicamente ao longo dos marcos", () => {
    expect(K9_STAGE_PROGRESS_CEILING.validatingAccess).toBeLessThan(
      K9_STAGE_PROGRESS_CEILING.loadingPermissions,
    );
    expect(K9_STAGE_PROGRESS_CEILING.loadingPermissions).toBeLessThan(
      K9_STAGE_PROGRESS_CEILING.syncingModules,
    );
    expect(K9_STAGE_PROGRESS_CEILING.syncingModules).toBeLessThan(
      K9_STAGE_PROGRESS_CEILING.ready,
    );
  });
});

describe("stageOrder — ordenação", () => {
  it("ordena os marcos sequencialmente", () => {
    expect(stageOrder("validatingAccess")).toBe(0);
    expect(stageOrder("loadingPermissions")).toBe(1);
    expect(stageOrder("syncingModules")).toBe(2);
    expect(stageOrder("ready")).toBe(3);
  });

  it("error fica fora da sequência", () => {
    expect(stageOrder("error")).toBe(-1);
  });
});
