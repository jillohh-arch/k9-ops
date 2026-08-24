# ADR-WEB-002 — Fronteiras de Responsabilidade entre Web, Mobile e Backend

| Campo | Valor |
|---|---|
| Status | Proposto — revisão humana pendente |
| Data | 2026-07-30 |
| Escopo | Health v1 cross-platform |
| Relacionados | `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`, ADR-001 canônica |

---

## Contexto

O domínio Health é acessado por Web e Mobile. Sem fronteiras explícitas, os canais poderiam duplicar writes, divergir contratos ou confundir gestão com execução física.

## Decisão

Adotar a cadeia:

```text
profissional externo decide clinicamente
→ usuário interno registra/transcreve
→ Web ou Mobile inicia o comando permitido
→ Backend valida e persiste
→ Function projeta
→ sistema audita
```

Responsabilidades:

### Web

- gestão;
- planejamento;
- supervisão;
- transcrição autorizada;
- relatórios;
- auditoria;
- NutritionPlan.

### Mobile

- execução operacional;
- rotina em campo;
- MealLog;
- SupplementLog;
- DoseAdministration;
- registro rápido;
- offline controlado.

### Backend

- autenticação;
- capability;
- lifecycle;
- evidência;
- transação;
- idempotência;
- persistência;
- receipt;
- audit.

### Functions

- summary;
- timeline;
- agenda automática;
- contagens;
- reconciliação server-side.

## Consequências positivas

- menos duplicação;
- contratos claros;
- segurança;
- melhor offline;
- audit consistente;
- Web gerencial sem virar terminal genérico.

## Consequências negativas

- mais callables;
- maior esforço cross-platform;
- operações candidatas precisam de decisão por canal;
- projection lag precisa de UX.

## Alternativas rejeitadas

### Ambos os canais fazem tudo

Rejeitado por duplicação e inconsistência.

### Write direto em Firestore

Rejeitado por invariantes e audit.

### Web somente leitura permanente

Rejeitado porque gestão de planos, agenda e casos pertence à Web.

### Backend confiar no cliente

Rejeitado por segurança.

## Invariantes

- Mobile não administra NutritionPlan;
- Web não registra refeição/suplemento por padrão;
- Web não administra dose por padrão;
- clientes não escrevem projections;
- ProfessionalIdentity ≠ RecordedBy;
- offline não reduz validação.

## Critérios para revisão

Revisar se houver:

- terminal Web operacional no canil;
- perfil veterinário autenticado;
- app tablet híbrido;
- nova política offline.
