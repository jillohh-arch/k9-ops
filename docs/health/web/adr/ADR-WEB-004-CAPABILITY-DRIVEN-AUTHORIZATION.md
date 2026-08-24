# ADR-WEB-004 — Autorização Orientada por Capabilities

| Campo | Valor |
|---|---|
| Status | Proposto — revisão humana pendente |
| Data | 2026-07-30 |
| Escopo | Health Web v1 authorization |
| Relacionados | `HEALTH_WEB_CAPABILITIES_INVENTORY.md`, `HEALTH_WEB_PERMISSION_MATRIX.md` |

---

## Contexto

A Web atual usa ações genéricas `view`, `create`, `edit`, `archive`, `export` e `audit`. O domínio Health possui comandos com riscos e evidências diferentes. `edit` contradiz imutabilidade e `archive` não representa lifecycles clínicos.

## Decisão

Adotar capabilities de negócio do Health v1.

Leitura comum:

```text
health.read
```

Writes específicos, por exemplo:

```text
health.record_incident
health.request_exam
health.create_treatment
health.issue_restriction
health.manage_nutrition_plan
health.amend_record
```

A decisão de acesso combina:

```text
authentication
+ active profile
+ channel access
+ dog access
+ scope
+ capability
+ lifecycle
+ evidence
+ Backend validation
```

## Compatibilidade

`health.view` pode ser aceito temporariamente apenas para leitura, mediante adapter aprovado e telemetria.

Não haverá fallback genérico para writes.

## Admin

Administração técnica não concede autoridade clínica. Admin bypass não elimina ProfessionalIdentity, source document, lifecycle, audit ou idempotência.

## Specialties

Specialty `Veterinário` é cadastral e não concede capability.

## Consequências positivas

- least privilege;
- comandos explicáveis;
- melhor audit;
- alinhamento Mobile/Web;
- imutabilidade preservada.

## Consequências negativas

- migração de profiles;
- catálogo maior;
- guards e tests adicionais;
- claims/profile reconciliation.

## Alternativas rejeitadas

### Role-based only

Rejeitado por rigidez e escopo insuficiente.

### Manter create/edit/archive

Rejeitado por amplitude e semântica errada.

### Capability por tela

Rejeitado por fragmentação artificial.

### Specialty como autorização

Rejeitado por confundir qualificação e grant.

## Critérios de conformidade

- catálogo central tipado;
- Backend revalida;
- no fallback para Nutrição;
- projection/legacy read-only;
- audit separado;
- export separado;
- revogação efetiva no Backend.

## Revisão futura

Revisar quando:

- profiles reais forem inventariados;
- houver veterinário autenticado;
- field-level privacy exigir novos paths;
- break-glass for implementado.
