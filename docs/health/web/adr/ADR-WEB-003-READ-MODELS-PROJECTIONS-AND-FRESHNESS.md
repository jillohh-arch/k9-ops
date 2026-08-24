# ADR-WEB-003 — Read Models, Projeções e Freshness

| Campo | Valor |
|---|---|
| Status | Proposto — revisão humana pendente |
| Data | 2026-07-30 |
| Escopo | Leitura agregada do Health Web v1 |
| Relacionados | ADR-004 canônica, `HEALTH_WEB_DATA_SOURCE_MATRIX.md`, `HEALTH_WEB_READINESS_POLICY.md` |

---

## Contexto

A página antiga agregava múltiplas collections no cliente, calculava indicadores e dependia de campos denormalizados `_last_*`. Isso cria N+1, drift, falhas parciais mal representadas e decisões inconsistentes.

## Decisão

Adotar projections server-side e read models explícitos.

Fontes principais:

```text
dogs/{dogId}/health_summary/current
dogs/{dogId}/health_timeline/{timelineId}
```

Princípios:

1. projections são read-only;
2. summary serve para display;
3. restrições canônicas servem para autorização crítica;
4. timeline é projetada no Backend;
5. IDs são determinísticos;
6. projections são reconstruíveis;
7. freshness é explícita;
8. partial, stale e conflict são estados oficiais de UI;
9. o browser não recalcula prontidão;
10. o browser não concatena timeline.

## Freshness

A política Web utilizará metadados server-side e refresh quando a projeção ultrapassar a janela aprovada. A referência documental atual é cinco minutos para display online, sujeita a confirmação do SLA.

Após mutação:

```text
fonte canônica salva
→ projection pending
→ projection atualizada
```

## Consequências positivas

- performance;
- consistência;
- explicabilidade;
- paginação;
- reconstrução;
- parity Web/Mobile.

## Consequências negativas

- Functions adicionais;
- eventual consistency;
- necessidade de rebuild;
- monitoramento de lag;
- schema de projection.

## Alternativas rejeitadas

### Agregar no browser

Rejeitado por custo e divergência.

### Usar `_last_*`

Rejeitado por write best-effort e falta de autoridade.

### Bloquear UI até toda projection atualizar

Rejeitado por latência e UX.

### Summary como única autorização

Rejeitado por eventual consistency.

## Critérios de conformidade

- nenhum write client em projection;
- freshness visível quando stale;
- conflict não oculto;
- action crítica consulta fonte canônica;
- timeline paginada;
- rebuild testado.

## Revisão futura

Revisar para:

- readiness history;
- projections globais do efetivo;
- streaming server-side;
- novos SLAs.
