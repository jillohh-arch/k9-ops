# ADR-WEB-006 — Estratégia de Integração da Nutrição

| Campo | Valor |
|---|---|
| Status | Proposto — revisão humana pendente |
| Data | 2026-07-30 |
| Escopo | NutritionPlan Web pós-Foundation |
| Relacionados | `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md` |

---

## Contexto

A gestão de Plano Alimentar foi desenvolvida em branch própria após o início do Health Foundation. Ela possui contratos canônicos, capability granular, callables, idempotência e integração Mobile. Ao mesmo tempo, a branch divergiu do branch principal e utiliza o shell anterior.

## Decisão

Tratar Nutrição como **vertical slice canônica a integrar**, não como legado e não como merge automático.

Preservar:

- NutritionPlan schema;
- CREATE/UPDATE/REPLACE/CANCEL;
- operationId;
- receipts;
- `health.manage_nutrition_plan`;
- fail-closed;
- readers canonical/legacy/conflict;
- cross-platform contract.

Reconciliar:

- route;
- shell;
- navigation;
- permission evaluator;
- design system;
- components;
- tests.

A estratégia Git será escolhida após preflight entre:

- merge controlado;
- cherry-pick seletivo;
- reaplicação guiada.

## Invariantes

- Web administra;
- Mobile executa;
- replace cria novo planId;
- update não muda identidade;
- cancel preserva histórico;
- no fallback para `health.edit`;
- Web não cria MealLog/SupplementLog.

## Consequências positivas

- preserva trabalho validado;
- reduz reimplementação;
- mantém cross-platform;
- permite novo shell.

## Consequências negativas

- integração Git dedicada;
- contract lock;
- regressão cross-platform obrigatória;
- branch antiga precisa de encerramento controlado.

## Alternativas rejeitadas

### Reescrever do zero

Rejeitado por perder contracts testados.

### Merge cego

Rejeitado por importar arquitetura divergente.

### Tratar como legado

Rejeitado porque a capacidade é pós-Foundation.

### Permitir edit genérico

Rejeitado por segurança.

## Critérios de conformidade

- callables preservadas;
- tests Web/Backend/Mobile;
- capability exata;
- multiple active conflict;
- plan ativo confirmado;
- human review.

## Revisão futura

Revisar se o contrato de NutritionPlan mudar de forma cross-platform por nova ADR.
