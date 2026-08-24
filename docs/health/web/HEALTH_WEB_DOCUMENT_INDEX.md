# K9 Ops Web — Health Web v1 Document Index

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_DOCUMENT_INDEX.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Índice do pacote documental |

---

## 1. Estrutura de pastas

```text
docs/health/web/
├── audits/
├── foundation/
├── architecture/
├── implementation/
├── testing/
├── mockups/
├── adr/
└── handoffs/
```

---

## 2. Ordem de leitura recomendada

1. Auditoria atual.
2. Baseline.
3. Arquitetura-alvo.
4. Arquitetura da informação.
5. Modelo domínio-telas.
6. Matriz de fontes.
7. Matriz Web/Mobile/Backend.
8. Capabilities.
9. Permission Matrix.
10. Readiness Policy.
11. Roadmap.
12. Migration Plan.
13. Nutrition Integration Plan.
14. Test Strategy.
15. Mockup Plan.
16. ADRs.
17. Foundation Review.
18. Implementation Handoff.

---

## 3. Auditoria

| Arquivo | Destino | Propósito |
|---|---|---|
| `HEALTH_WEB_CURRENT_STATE_AUDIT.md` | `docs/health/web/audits/` | inventário do estado atual |

---

## 4. Foundation

| Arquivo | Destino | Propósito |
|---|---|---|
| `HEALTH_WEB_BASELINE.md` | `foundation/` | verdade de partida |
| `HEALTH_WEB_CAPABILITIES_INVENTORY.md` | `foundation/` | catálogo de autorização |
| `HEALTH_WEB_PERMISSION_MATRIX.md` | `foundation/` | atribuições candidatas |
| `HEALTH_WEB_READINESS_POLICY.md` | `foundation/` | política Web de prontidão |
| `HEALTH_WEB_FOUNDATION_REVIEW.md` | `foundation/` | fechamento documental |

---

## 5. Architecture

| Arquivo | Destino | Propósito |
|---|---|---|
| `HEALTH_WEB_TARGET_ARCHITECTURE.md` | `architecture/` | arquitetura técnica alvo |
| `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` | `architecture/` | rotas e navegação |
| `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md` | `architecture/` | domínio × tela |
| `HEALTH_WEB_DATA_SOURCE_MATRIX.md` | `architecture/` | autoridade de campos |
| `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md` | `architecture/` | responsabilidades de plataforma |

---

## 6. Implementation

| Arquivo | Destino | Propósito |
|---|---|---|
| `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md` | `implementation/` | fases HW-0 a HW-10 |
| `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md` | `implementation/` | legado e cutover |
| `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md` | `implementation/` | integração da branch Nutrition |

---

## 7. Testing

| Arquivo | Destino | Propósito |
|---|---|---|
| `HEALTH_WEB_TEST_STRATEGY.md` | `testing/` | estratégia completa de testes |

---

## 8. Mockups

| Arquivo | Destino | Propósito |
|---|---|---|
| `HEALTH_WEB_MOCKUP_PLAN.md` | `mockups/` | sequência M-01 a M-17 |

---

## 9. ADRs

| Arquivo | Destino | Decisão |
|---|---|---|
| `ADR-WEB-001-HEALTH-INFORMATION-ARCHITECTURE.md` | `adr/` | módulo único, visão global e cockpit |
| `ADR-WEB-002-MOBILE-WEB-RESPONSIBILITY-BOUNDARIES.md` | `adr/` | gestão × execução × Backend |
| `ADR-WEB-003-READ-MODELS-PROJECTIONS-AND-FRESHNESS.md` | `adr/` | projections server-side |
| `ADR-WEB-004-CAPABILITY-DRIVEN-AUTHORIZATION.md` | `adr/` | capabilities de negócio |
| `ADR-WEB-005-LEGACY-COEXISTENCE-AND-CUTOVER.md` | `adr/` | migração progressiva |
| `ADR-WEB-006-NUTRITION-INTEGRATION-STRATEGY.md` | `adr/` | vertical slice canônica |

---

## 10. Handoff

| Arquivo | Destino | Propósito |
|---|---|---|
| `HEALTH_WEB_IMPLEMENTATION_HANDOFF.md` | `handoffs/` | início read-only da HW-1 |

---

## 11. Status geral

| Área | Status |
|---|---|
| Documentos produzidos | concluído em draft |
| Revisão humana | pendente |
| HW-0 | não aprovado |
| HW-1 | não iniciado |
| Código | não alterado |
| Produção | não alterada |

---

## 12. Regra de manutenção

Ao alterar uma decisão:

1. atualizar o documento de autoridade;
2. atualizar ADR se necessário;
3. atualizar matrices afetadas;
4. atualizar roadmap;
5. atualizar este índice se arquivo/pasta mudar;
6. revisar consistência.

---

## 13. Arquivos que não devem ser confundidos

### Mobile/Backend canônico

Permanecem em:

```text
docs/health/
```

### Web específico

Fica em:

```text
docs/health/web/
```

### ADR cross-platform

Permanecem na pasta canônica geral quando a decisão não é exclusiva da Web.

---

## 14. Próximo gate

```text
GATE HW-0 — DOCUMENTATION FOUNDATION APPROVED
```

Após aprovação:

```text
HW-1 — Preflight e Baseline Executável
```
