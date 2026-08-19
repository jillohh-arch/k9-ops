# ADR-WEB-005 — Coexistência com Legado e Cutover por Agregado

| Campo | Valor |
|---|---|
| Status | Proposto — revisão humana pendente |
| Data | 2026-07-30 |
| Escopo | Migração do Health Web v1 |
| Relacionados | ADR-006 canônica, `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md` |

---

## Contexto

Existem collections e telas pré-canônicas, com dependências e dados ainda não inventariados integralmente. Uma migração big bang poderia perder dados, criar casos clínicos retroativos ou quebrar versões Mobile.

## Decisão

Adotar:

```text
adapters read-only
+ backfill server-side idempotente
+ dual-read temporário
+ shadow comparison
+ cutover por agregado
+ bloqueio posterior de writes legados
```

Regra especial:

> Todos os `health_events` anteriores ao go-live serão preservados como `legacy_health_records`; nenhum ClinicalCase ou ClinicalEvent canônico será criado automaticamente.

Outras regras:

- fontes antigas não são apagadas no v1;
- payload original é imutável;
- clientes não escrevem legacy;
- IDs e checksums são determinísticos/versionados;
- batch possui manifest;
- rollback só antes do cutover;
- target modificado bloqueia rollback;
- dual-write client-side é proibido.

## Consequências positivas

- preservação;
- rastreabilidade;
- rollback;
- menor risco;
- compatibilidade gradual.

## Consequências negativas

- período de coexistência;
- adapters temporários;
- custo de backfill;
- conflitos manuais;
- maior observabilidade.

## Alternativas rejeitadas

### Big bang

Rejeitado por risco.

### Conversão heurística de health_events

Rejeitado por falta de contexto clínico.

### Dual-write

Rejeitado por divergência.

### Excluir fontes após copiar

Rejeitado por auditoria e rollback.

## Critérios de cutover

- 100% contabilizado;
- rejections documentados;
- fallback abaixo do threshold aprovado;
- estabilidade;
- consumidores e produtores atualizados;
- Rules/indexes;
- rollback.

## Revisão futura

Somente política de retenção específica poderá autorizar exclusão física.
