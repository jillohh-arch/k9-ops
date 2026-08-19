# K9 Ops Web — Health Web v1 Test Strategy

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_TEST_STRATEGY.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Estratégia de testes funcional, técnica, de segurança e cross-platform |
| Roadmap | `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md` |
| Autoridade de referência | `HEALTH_V1_TEST_STRATEGY.md` |
| Fora de escopo | Executar suíte, escolher definitivamente ferramentas ou alterar CI |

---

## 1. Propósito

Esta estratégia define como provar que o Health Web v1:

- respeita o domínio;
- lê fontes corretas;
- não calcula prontidão;
- não edita fatos finais;
- aplica capabilities;
- protege dados;
- integra Web, Mobile e Backend;
- lida com legado;
- funciona em desktop e tablet;
- pode ser ativado com segurança.

---

## 2. Princípio central

> Um fluxo Health não está testado apenas porque a interface renderiza e o happy path salva.

Cada mutação crítica deve ser provada em:

```text
domínio
→ command
→ authorization
→ persistence
→ audit
→ receipt
→ projection
→ Web
→ Mobile
```

---

## 3. Objetivos de qualidade

1. Correção de domínio.
2. Segurança fail-closed.
3. Imutabilidade.
4. Idempotência.
5. Rastreabilidade.
6. Consistência cross-platform.
7. Explicabilidade da prontidão.
8. Compatibilidade de schema.
9. Migração sem perda.
10. Acessibilidade.
11. Performance previsível.
12. Recuperação diante de falhas.

---

## 4. Pirâmide de testes

```text
unitários de domínio e contrato
→ services/readers/commands
→ componentes
→ integração com Emulator
→ Rules/Functions
→ cross-platform contract
→ E2E
→ visual/accessibility
→ homologação
```

### 4.1 Regra

E2E não substitui unit e integration.

Snapshot visual não substitui teste funcional.

---

## 5. Categorias obrigatórias

1. Domínio.
2. Lifecycles.
3. Schemas e parsers.
4. Readers.
5. Projections.
6. Commands.
7. Idempotência.
8. Concorrência.
9. Permissions.
10. Rules.
11. Functions.
12. Componentes.
13. Páginas.
14. Navegação.
15. Acessibilidade.
16. Visual regression.
17. Performance.
18. Segurança.
19. Migração.
20. Cross-platform.
21. Offline Mobile relacionado.
22. Observabilidade.
23. Regressão de módulos não Health.

---

## 6. Testes de domínio

Cobrir:

- cinco estados de prontidão;
- restriction precedence;
- case lifecycle;
- event lifecycle;
- amendment types;
- exam stages;
- treatment status;
- schedule lifecycle;
- schedule temporal states;
- NutritionPlan status;
- VaccinationRecord status;
- legacy classification.

### 6.1 Unknown enum

Todo parser deve retornar estado controlado ou erro de schema.

Nunca usar default permissivo.

---

## 7. Testes de transição

### 7.1 ClinicalCase

- open → under_investigation;
- open → under_treatment;
- under_treatment → monitoring;
- monitoring → discharged;
- discharged → reopen action;
- cancelled não reabre;
- transição inválida rejeitada.

### 7.2 ClinicalEvent

- draft editável;
- draft → final;
- final imutável;
- cancelamento preserva;
- amendment append-only.

### 7.3 Treatment

- active → paused;
- paused → active;
- active/paused → completed;
- cancel;
- dose após completed rejeitada.

### 7.4 Schedule

- open → completed;
- open → cancelled;
- terminal não reabre.

### 7.5 NutritionPlan

- create active;
- update mantém ID;
- replace supersedes e cria ID;
- cancel;
- multiple active conflict.

---

## 8. Testes de schema

Cada entidade deve ter fixtures para:

- documento válido mínimo;
- documento válido completo;
- campo opcional ausente;
- timestamp inválido;
- enum desconhecido;
- schema version antiga;
- schema version futura;
- campo extra;
- tipo errado;
- null inesperado.

### 8.1 Regra

A Web não deve quebrar a página inteira por um documento malformado quando puder isolar o erro.

---

## 9. Testes de readers

Resultado padrão:

- loading;
- success;
- empty;
- partial;
- degraded;
- stale;
- legacy;
- conflict;
- forbidden;
- not_found;
- error.

### 9.1 Casos

- unsubscribe;
- race entre dogIds;
- paginação;
- ordenação;
- filtro URL;
- retry;
- abort;
- cache;
- source metadata;
- malformed item isolado.

---

## 10. Testes de projections

### 10.1 Summary

- precedence;
- reason;
- restriction summary;
- data completeness;
- updated_at;
- version;
- rebuild;
- idempotency;
- lag;
- duplicate trigger.

### 10.2 Timeline

- deterministic ID;
- final events only;
- cancelled represented;
- amendments metadata;
- legacy source;
- occurred vs recorded;
- pagination stable;
- rebuild.

### 10.3 Proibição

Nenhum teste deve validar cálculo equivalente no browser como feature oficial.

---

## 11. Testes de prontidão

1. absolute → temporarily_unfit.
2. partial → fit_with_restrictions.
3. attention → operational_attention.
4. no evaluation → not_evaluated.
5. incomplete → operational_attention.
6. none → operational.
7. error ≠ not_evaluated.
8. stale visibly marked.
9. conflict visible.
10. no score legacy.
11. summary operational + absolute canonical → Backend blocks.
12. expected_end past does not release.

---

## 12. Testes de commands

Cada command deve testar:

- valid request;
- unauthenticated;
- forbidden;
- scope denied;
- dog inaccessible;
- invalid lifecycle;
- missing evidence;
- missing operationId;
- duplicate operationId;
- same ID different payload;
- transaction conflict;
- audit failure behavior;
- projection pending;
- error code mapping.

---

## 13. Testes de idempotência

Obrigatórios para:

- NutritionPlan;
- MealLog;
- SupplementLog quando determinístico;
- DoseAdministration;
- case + event composite;
- schedule auto generation;
- document metadata;
- migration;
- projections.

### 13.1 Replay

Mesmo ID + mesmo hash retorna resultado anterior.

### 13.2 Conflito

Mesmo ID + payload diferente rejeita.

---

## 14. Testes de concorrência

- duas tabs;
- dois gestores;
- stale version;
- create simultâneo;
- update e cancel;
- replace e update;
- restriction issue/release;
- case discharge/reopen;
- dose dupla;
- meal occurrence dupla;
- schedule duplicate.

---

## 15. Testes de capabilities

Para cada capability:

- grant;
- no grant;
- profile inactive;
- scope;
- dog access;
- channel;
- admin bypass;
- specialty ignored;
- legacy fallback;
- revocation;
- stale claim;
- deep link;
- server-side guard.

### 15.1 Nutrição

Testar explicitamente que `health.edit` não autoriza.

---

## 16. Testes de Rules

### Leituras

- allowed scope;
- denied scope;
- projection read;
- audit read;
- document metadata;
- legacy read.

### Writes

- direct write denied;
- projection write denied;
- legacy write denied;
- migration docs denied;
- amendment create-only;
- unauthorized update denied.

---

## 17. Testes de Functions

- triggers;
- retries;
- duplicate delivery;
- transaction;
- audit;
- receipt;
- projection;
- error taxonomy;
- region;
- environment config;
- timeout;
- partial failure.

---

## 18. Testes de componentes

Componentes críticos:

- ReadinessBadge;
- RestrictionCard;
- ProjectionFreshness;
- ConflictBanner;
- LegacyBadge;
- HealthStateBoundary;
- PermissionBoundary;
- ScheduleState;
- ClinicalTimeline;
- NutritionPlanSummary;
- forms;
- confirmation dialogs.

### 18.1 Estados

Cada componente deve cobrir:

- normal;
- loading;
- empty;
- error;
- long text;
- unknown;
- narrow width;
- keyboard.

---

## 19. Testes de página

### Visão Geral

- counts;
- partial blocks;
- drill-down;
- no false zeros.

### Prontidão

- sorting;
- filters;
- URL;
- conflict;
- stale.

### Cockpit

- dog switch;
- no stale previous dog;
- source links;
- permission actions.

### Agenda

- timezone;
- filters;
- lifecycle.

### Clínico

- case list;
- event immutability;
- documents.

### Nutrição

- all read and command states.

---

## 20. Navegação

- Sidebar active;
- secondary nav;
- browser back;
- query params;
- breadcrumbs;
- direct URL;
- forbidden route;
- not found;
- redirect old route;
- profile K9 link.

---

## 21. Acessibilidade

Ferramentas e testes devem cobrir:

- semantic headings;
- landmarks;
- labels;
- focus order;
- focus trap;
- escape;
- keyboard tables;
- contrast;
- color independence;
- live regions;
- screen reader text;
- zoom 200%;
- reduced motion;
- touch targets.

### 21.1 Gate

Nenhuma página é Done apenas com auditoria automatizada.

Revisão manual é obrigatória.

---

## 22. Visual regression

Estados de referência:

- desktop 1440;
- notebook;
- tablet landscape;
- tablet portrait;
- loading;
- empty;
- partial;
- conflict;
- error;
- long Portuguese labels.

### 22.1 Identidade

Validar:

- dark navy;
- cyan/teal controlado;
- glow sutil;
- hierarquia;
- legibilidade;
- status sem depender de cor.

---

## 23. Performance

Métricas candidatas:

- route TTI;
- server response;
- Firestore reads;
- listener count;
- pagination;
- JS bundle;
- image size;
- projection lag;
- command latency.

### 23.1 Proibições

- collection-wide scan;
- N+1 por K9;
- listener por card;
- timeline client merge;
- unbounded query.

---

## 24. Segurança

Testar:

- IDOR;
- scope bypass;
- route guard bypass;
- callable direct invocation;
- malicious payload;
- document URL reuse;
- XSS em notes;
- file type;
- oversized upload;
- PII logs;
- admin bypass;
- export;
- audit tampering.

---

## 25. Documentos e Storage

- valid upload;
- invalid MIME;
- file too large;
- interrupted upload;
- orphan metadata;
- orphan file;
- temporary URL expiry;
- download forbidden;
- reference linking;
- legacy URL.

---

## 26. Migração

- dry-run;
- deterministic ID;
- checksum;
- classification;
- health_events always legacy;
- vaccine promotion conditional;
- duplicate meal;
- document missing;
- batch manifest;
- replay;
- rollback;
- modified target block;
- cutover;
- legacy write deny.

---

## 27. Cross-platform

| Origem | Destino | Prova |
|---|---|---|
| Web plan create | Mobile | parser e UI |
| Web plan replace | Mobile | novo planId usado |
| Mobile meal | Web | log exibido |
| Web treatment | Mobile | protocolo/agenda |
| Mobile dose | Web | monitoramento |
| Web restriction | Mobile | enforcement |
| Mobile incident | Web | case/event |
| Web amendment | Mobile | leitura corrigida |
| Function summary | ambos | mesmos enums |
| Legacy migration | ambos | mesma origem |

---

## 28. Offline relacionado

A Web não é canal offline prioritário.

Mesmo assim, testar efeitos cross-platform:

- Mobile queue;
- replay;
- conflict após reconnect;
- restriction alterada;
- plan replaced;
- protocol completed;
- stale summary;
- Web reflects reconciliation.

---

## 29. Regressão fora de Health

- login;
- profile;
- K9 list;
- K9 detail;
- Training;
- Shifts;
- occurrences;
- sidebar;
- loading;
- reports;
- permissions admin.

---

## 30. Dados de teste

Criar fixtures nomeadas e determinísticas:

- dogOperational;
- dogAttention;
- dogRestricted;
- dogUnfit;
- dogNotEvaluated;
- dogStale;
- dogConflict;
- activeCase;
- activeTreatment;
- activePlan;
- legacyOnly;
- malformedRecord.

### 30.1 Não usar

Dados reais em testes automatizados.

---

## 31. Ambientes

| Ambiente | Objetivo |
|---|---|
| unit/local | lógica pura |
| component | UI isolada |
| Firestore Emulator | Rules, Functions e integração |
| E2E local | browser completo |
| staging | homologação integrada |
| produção | smoke e observabilidade controlados |

---

## 32. Ferramentas

A escolha final depende da stack existente.

Categorias:

- test runner TypeScript;
- React component testing;
- Playwright ou equivalente;
- Firebase Emulator Suite;
- Rules Unit Testing;
- accessibility scanner;
- visual snapshots;
- performance audit;
- contract fixtures.

### 32.1 Regra

Não adicionar ferramenta nova sem justificar sobreposição.

---

## 33. CI

Pipeline candidato:

1. install locked;
2. format/diff check;
3. lint;
4. typecheck;
5. unit;
6. component;
7. Emulator;
8. build;
9. E2E critical;
10. accessibility;
11. artifacts/reports.

### 33.1 Secrets

CI não usa credenciais de produção para testes comuns.

---

## 34. Cobertura mínima

Cobertura percentual isolada não é Definition of Done.

Metas candidatas:

| Camada | Meta |
|---|---:|
| domain parsers/transitions | 95% branches |
| permission evaluator | 100% decision branches |
| command validation | 95% |
| readers | 90% |
| components críticos | 85% |
| pages | cenários por estado |
| Rules | matriz completa |
| Functions críticas | paths de sucesso e falha |

---

## 35. Matriz por fase

| Fase | Foco de teste | Critério de gate |
|---|---|---|
| HW-1 | baseline, build, auth inventory, data inventory | preflight report approved |
| HW-2 | routes, guards, states, accessibility | shell read-only stable |
| HW-3 | summary, restrictions, conflict, freshness | canonical readiness stable |
| HW-4 | schedule temporal states, commands, timezone | schedule management stable |
| HW-5 | nutrition commands and cross-platform | nutrition integrated |
| HW-6 | cases, events, amendments, documents | clinical foundation stable |
| HW-7 | exams, treatments, doses, weight, vaccination | clinical workflows stable |
| HW-8 | restriction enforcement and offline parity | operational enforcement stable |
| HW-9 | timeline, reports, audit, migration | governance stable |
| HW-10 | security, performance, E2E, rollout | operational readiness approved |

---

## 36. Smoke suite

Executar em todo deploy:

- login;
- /health;
- readiness list;
- cockpit;
- nutrition read;
- permission denial;
- one callable no-op/test-safe if available;
- old routes;
- logout.

---

## 37. Golden E2E suite

1. gestor lê prontidão;
2. gestor cria plano alimentar;
3. Mobile executa refeição;
4. gestor abre caso;
5. gestor registra documento externo;
6. gestor cria tratamento;
7. Mobile administra dose;
8. gestor registra restrição;
9. Mobile recebe bloqueio;
10. gestor registra liberação;
11. timeline e audit refletem.

A suite pode ser entregue em etapas conforme o roadmap.

---

## 38. Failure E2E suite

- forbidden;
- missing evidence;
- stale version;
- idempotency conflict;
- projection lag;
- multiple active plan;
- malformed legacy;
- document upload failure;
- network loss;
- session revoke.

---

## 39. Defeitos bloqueadores

P0:

- data loss;
- unauthorized read/write;
- restriction bypass;
- event mutation;
- duplicate dose/meal;
- wrong K9;
- plan overwrite;
- false operational status.

P1:

- conflict hidden;
- stale hidden;
- audit missing;
- broken cross-platform;
- inaccessible critical flow;
- migration mismatch.

---

## 40. Evidência de teste

A fase deve produzir:

- command output;
- test counts;
- failed/skipped;
- emulator evidence;
- screenshots quando visual;
- device evidence quando Mobile;
- diff summary;
- known limitations.

### 40.1 Claude Code

O relatório final deve ser exibido na tela.

Não gerar arquivo Markdown automaticamente.

---

## 41. Flaky tests

- identificar;
- não repetir até passar sem investigação;
- registrar causa;
- corrigir ou quarentenar com prazo;
- não ignorar teste crítico.

---

## 42. Testes manuais

Obrigatórios para:

- UX;
- accessibility;
- tablet;
- complex forms;
- document preview;
- conflict comprehension;
- operational wording;
- physical Mobile enforcement.

---

## 43. Testes em produção

Somente:

- smoke não destrutivo;
- feature flag;
- usuários autorizados;
- dados de teste aprovados;
- monitoramento;
- cleanup.

Não executar mutações clínicas fictícias em K9 operacional real.

---

## 44. Gates de qualidade

### TST-1

Unit/domain pass.

### TST-2

Reader/component pass.

### TST-3

Rules/Functions Emulator pass.

### TST-4

Cross-platform pass.

### TST-5

E2E critical pass.

### TST-6

Accessibility/visual approved.

### TST-7

Security approved.

### TST-8

Human review approved.

---

## 45. Decisões fixadas

1. Emulator é obrigatório.
2. Cross-platform é obrigatório.
3. E2E não substitui unit.
4. UI test não substitui Rules.
5. Prontidão não é calculada no client test.
6. No score legacy.
7. Unknown enum fail-closed.
8. Capabilities são testadas no Backend.
9. Admin bypass recebe teste próprio.
10. Specialty não concede acesso.
11. Events finais são imutáveis.
12. Idempotência é provada.
13. Migração é reexecutável.
14. Accessibility manual é obrigatória.
15. Tablet é obrigatório.
16. N+1 é considerado defeito.
17. Production test é não destrutivo.
18. Evidence é parte do gate.
19. Relatório do Claude Code fica em tela.
20. Human review fecha a fase.

---

## 46. Decisões pendentes

- ferramentas exatas;
- coverage thresholds finais;
- CI provider steps;
- staging environment;
- visual snapshot policy;
- performance budgets;
- browser matrix;
- device matrix;
- retention de artifacts;
- test data reset.

---

## 47. Critérios de aprovação

A estratégia estará aprovada quando:

- categorias cobrem o roadmap;
- security e migration estão incluídas;
- cross-platform está obrigatório;
- fixtures estão definidas;
- gates estão claros;
- ferramentas podem ser escolhidas sem alterar a política;
- evidência e revisão humana estão previstas.

---

## 48. Status

| Item | Estado |
|---|---|
| Estratégia | criada |
| Ferramentas finais | pendentes |
| CI | pendente |
| Fixtures | propostas |
| Suítes | especificadas |
| Execução | não iniciada |
| Aprovação humana | pendente |

---

## 49. Conclusão

O Health Web v1 será testado como um sistema distribuído de domínio sensível.

A prova completa não termina na tela:

```text
UI correta
+ autorização correta
+ dado correto
+ histórico correto
+ outro canal correto
```

Qualquer uma dessas partes ausente mantém a fase aberta.
