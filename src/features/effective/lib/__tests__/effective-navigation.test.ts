import { describe, expect, it } from "vitest";

import {
  allowedEffectiveChildren,
  effectiveChildren,
  effectiveModuleIds,
  isEffectivePath,
  resolveEffectiveRedirect,
} from "@/features/effective/lib/effective-navigation";
import type { AccessModuleId } from "@/lib/permissions/access-control";

function allowOnly(...modules: AccessModuleId[]) {
  return (moduleId: AccessModuleId) => modules.includes(moduleId);
}

describe("estrutura dos núcleos", () => {
  it("expõe os quatro núcleos nas rotas canônicas", () => {
    expect(effectiveChildren.map((child) => [child.label, child.href])).toEqual([
      ["Efetivo K9", "/k9"],
      ["Efetivo Humano", "/humans"],
      ["Binômios", "/binomials"],
      ["Viaturas", "/vehicles"],
    ]);
  });

  it("não cria rotas aninhadas sob /effective", () => {
    for (const child of effectiveChildren) {
      expect(child.href.startsWith("/effective")).toBe(false);
    }
  });

  it("cada núcleo declara o módulo de permissão correspondente", () => {
    expect(effectiveModuleIds).toEqual([
      "k9",
      "humans",
      "binomials",
      "vehicles",
    ]);
  });
});

describe("permissão por filho", () => {
  it("mostra apenas os núcleos visíveis ao perfil", () => {
    expect(
      allowedEffectiveChildren(allowOnly("k9")).map((child) => child.href),
    ).toEqual(["/k9"]);
    expect(
      allowedEffectiveChildren(allowOnly("humans", "vehicles")).map(
        (child) => child.href,
      ),
    ).toEqual(["/humans", "/vehicles"]);
  });

  it("esconde todos quando nenhum módulo é visível", () => {
    expect(allowedEffectiveChildren(() => false)).toEqual([]);
  });

  it("mostra todos quando o perfil vê tudo", () => {
    expect(allowedEffectiveChildren(() => true)).toHaveLength(4);
  });
});

describe("resolução de /effective", () => {
  it("prefere /k9 quando k9/view está liberado", () => {
    expect(resolveEffectiveRedirect(() => true)).toBe("/k9");
    expect(resolveEffectiveRedirect(allowOnly("k9", "vehicles"))).toBe("/k9");
  });

  it("cai no primeiro núcleo permitido quando k9 está bloqueado", () => {
    expect(resolveEffectiveRedirect(allowOnly("humans", "vehicles"))).toBe(
      "/humans",
    );
    expect(resolveEffectiveRedirect(allowOnly("vehicles"))).toBe("/vehicles");
    expect(resolveEffectiveRedirect(allowOnly("binomials"))).toBe("/binomials");
  });

  it("não resolve destino quando nenhum núcleo está liberado (fail-closed)", () => {
    expect(resolveEffectiveRedirect(() => false)).toBeNull();
  });

  it("nunca resolve para /effective — o que evitaria laço de redirecionamento", () => {
    const destinations = [
      resolveEffectiveRedirect(() => true),
      resolveEffectiveRedirect(allowOnly("humans")),
      resolveEffectiveRedirect(allowOnly("binomials")),
      resolveEffectiveRedirect(allowOnly("vehicles")),
    ];
    for (const destination of destinations) {
      expect(destination).not.toBe("/effective");
    }
  });
});

describe("autoexpansão do grupo", () => {
  it("reconhece as rotas dos filhos como pertencentes ao Efetivo", () => {
    expect(isEffectivePath("/k9")).toBe(true);
    expect(isEffectivePath("/humans")).toBe(true);
    expect(isEffectivePath("/binomials")).toBe(true);
    expect(isEffectivePath("/vehicles")).toBe(true);
    expect(isEffectivePath("/effective")).toBe(true);
  });

  it("reconhece subrotas de cadastro e perfil", () => {
    expect(isEffectivePath("/k9/new")).toBe(true);
    expect(isEffectivePath("/k9/bono")).toBe(true);
    expect(isEffectivePath("/k9/bono/edit")).toBe(true);
    expect(isEffectivePath("/humans/691755/history")).toBe(true);
    expect(isEffectivePath("/vehicles/vtr-1/edit")).toBe(true);
  });

  it("não reconhece rotas de outros módulos", () => {
    expect(isEffectivePath("/dashboard")).toBe(false);
    expect(isEffectivePath("/health")).toBe(false);
    expect(isEffectivePath("/training")).toBe(false);
    expect(isEffectivePath("/shifts")).toBe(false);
  });

  it("não confunde prefixo parcial com rota do grupo", () => {
    expect(isEffectivePath("/k9x")).toBe(false);
    expect(isEffectivePath("/humansx")).toBe(false);
  });
});
