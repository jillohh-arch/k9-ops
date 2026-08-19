# K9 Ops Web — Health Web v1 Nutrition Integration Plan

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Plano de integração da capacidade canônica de NutritionPlan |
| Repositório | `github.com/jillohh-arch/k9-ops` |
| Branch principal histórica auditada | `master` |
| Branch funcional histórica auditada | `feature/health-web-nutrition` |
| Commit funcional observado | `be9f0887e2b1f9c3789ef527e103911ad8f44e81` |
| Capability | `health.manage_nutrition_plan` |
| Fora de escopo | Executar merge, alterar produção, criar plano real, fazer deploy ou mudar contratos |

---

## 1. Propósito

Este documento define como a gestão de Plano Alimentar já desenvolvida na Web será integrada ao novo Health Web v1.

A integração deverá preservar:

- contratos cross-platform;
- identidade do plano;
- lifecycle;
- operationId;
- receipts;
- idempotência;
- capability granular;
- callables canônicas;
- readers de coexistência;
- estados de canonical, legacy e conflict;
- compatibilidade com o Mobile.

A pergunta central é:

> Como incorporar a única capacidade Web pós-Foundation sem perder contratos, sem importar a arquitetura antiga e sem reimplementar o que já foi validado?

---

## 2. Classificação da capacidade

A gestão de NutritionPlan é classificada como:

```text
CANÔNICA
PÓS-FOUNDATION
CROSS-PLATFORM
A PRESERVAR
A INTEGRAR
```

Ela não é:

- legado experimental;
- tela descartável;
- formulário genérico;
- write direto;
- capacidade Mobile;
- autorização baseada em `health.edit`.

---

## 3. Evidência histórica disponível

A auditoria documental registrou:

- branch `feature/health-web-nutrition`;
- commit observado `be9f0887e2b1f9c3789ef527e103911ad8f44e81`;
- rota `/health/nutrition`;
- CREATE/UPDATE/REPLACE/CANCEL;
- capability `health.manage_nutrition_plan`;
- callables dedicadas;
- `operationId`;
- receipts;
- revisão/versionamento;
- fail-closed em múltiplos planos ativos;
- leitura coordenada canônico × legado;
- compatibilidade Mobile confirmada no handoff anterior.

### 3.1 Limite

Essas evidências são históricas.

Antes da integração real, o preflight deverá confirmar novamente:

- branch atual;
- SHA atual;
- divergência;
- arquivos;
- callables implantadas;
- Rules;
- indexes;
- capability em profiles;
- plano canônico ativo;
- testes.

---

## 4. Invariantes obrigatórias

1. Web cria e administra o plano.
2. Mobile não cria nem substitui plano.
3. Mobile consulta e executa o plano.
4. Backend valida e persiste.
5. Mudança estrutural gera novo planId.
6. Plano anterior torna-se superseded.
7. Mudança administrativa preserva planId.
8. Cancelamento preserva histórico.
9. Múltiplos planos ativos geram conflict.
10. Nenhum plano é escolhido silenciosamente.
11. OperationId é obrigatório nas mutações canônicas.
12. Replay não duplica efeitos.
13. Payload divergente com mesmo operationId gera conflito.
14. Receipts são duráveis.
15. Capability é `health.manage_nutrition_plan`.
16. Não existe fallback para `health.edit`.
17. Web não registra MealLog.
18. Web não registra SupplementLog.
19. Legacy pode ser lido, nunca escrito.
20. O novo Health Shell não altera o contrato do domínio.

---

## 5. Entidades envolvidas

| Entidade | Responsabilidade | Canal de write |
|---|---|---|
| `NutritionPlan` | prescrição/plano alimentar | Web via Backend |
| `MealLog` | refeição executada | Mobile via Backend |
| `SupplementLog` | suplemento executado | Mobile via Backend |
| Receipt | comprovante idempotente | Backend |
| Audit log | trilha de mutação | Backend |
| Summary | resumo nutricional/readiness | Function |
| Timeline | histórico normalizado | Function |
| Legacy prescription | leitura antiga | read-only |

---

## 6. Paths conceituais

```text
dogs/{dogId}/nutrition_plans/{planId}
dogs/{dogId}/meal_logs/{mealLogId}
dogs/{dogId}/supplement_logs/{supplementLogId}
```

Paths de receipts, auditoria e operation tracking deverão ser confirmados no contrato implantado.

---

## 7. Lifecycle do NutritionPlan

| Estado | Significado | Próximas ações |
|---|---|---|
| `active` | plano vigente | update administrativo, replace, cancel |
| `superseded` | substituído por novo plano | leitura histórica |
| `cancelled` | encerrado sem substituição ativa | leitura histórica |

### 7.1 Proibição

Não criar estados visuais que não existam no domínio.

Estados técnicos como `legacy` e `conflict` não são lifecycle do plano.

---

## 8. Tipos de mutação

### 8.1 CREATE + ACTIVATE

Cria um novo plano ativo quando não há plano canônico ativo incompatível.

### 8.2 UPDATE

Atualiza campos administrativos permitidos sem mudança estrutural.

### 8.3 REPLACE

Cria novo planId e marca o anterior como superseded.

### 8.4 CANCEL

Marca o plano ativo como cancelled.

### 8.5 Critério estrutural

A lista final de campos estruturais deverá permanecer centralizada no domínio/backend.

A UI não deverá decidir sozinha que uma alteração é UPDATE ou REPLACE.

---

## 9. Callables históricas registradas

```text
healthNutritionCreateAndActivatePlan
healthNutritionUpdateActivePlan
healthNutritionCancelPlan
```

A auditoria também registrou fluxo de replace no conjunto funcional.

### 9.1 Gate obrigatório

Antes da implementação, confirmar:

- nomes atuais;
- region;
- versões;
- auth;
- capability;
- schema;
- error codes;
- receipts;
- replace callable;
- deployment status.

### 9.2 Proibição

Não criar callables paralelas com nomes diferentes sem necessidade.

---

## 10. Estados de leitura

O reader coordenado deverá suportar:

| Estado | Significado |
|---|---|
| `loading` | consulta inicial |
| `canonical` | plano canônico resolvido |
| `legacy` | somente fonte antiga disponível |
| `empty` | nenhuma fonte válida |
| `degraded` | fonte secundária aprovada foi usada |
| `error` | falha não recuperada |
| `conflict` | fontes incompatíveis ou múltiplos ativos |

### 10.1 Estado `partial`

Pode ser adotado no novo shell para consistência transversal quando parte dos dados auxiliares falhar.

Isso não altera os estados já usados pelo fluxo funcional.

---

## 11. Precedência de leitura

```text
canonical active
→ canonical historical context
→ legacy identified
→ empty
```

Conflitos interrompem a precedência.

### 11.1 Múltiplos canônicos ativos

Resultado:

```text
conflict
```

### 11.2 Canônico ativo e legado divergente

O canônico permanece autoridade.

O legado pode ser exibido apenas como histórico/origem, sem substituir o plano.

---

## 12. Integração de navegação

### 12.1 Rota global

```text
/health/nutrition
```

### 12.2 Contexto individual

Candidatos:

```text
/health/dogs/{dogId}/nutrition
```

ou:

```text
/health/nutrition?dogId={dogId}
```

A escolha final depende dos mockups e da navegação do cockpit.

### 12.3 Sidebar

Nutrição não terá item principal independente.

Ela ficará dentro de Saúde.

### 12.4 Perfil K9

O perfil institucional poderá mostrar:

- plano ativo;
- vigência;
- quantidade diária;
- link “Abrir Nutrição”.

Não terá gestão paralela.

---

## 13. Integração com o Health Module Shell

Reconciliar:

- page header;
- secondary navigation;
- breadcrumbs;
- dog selector;
- URL state;
- permissions boundary;
- loading;
- empty;
- conflict;
- error;
- tablet;
- accessibility.

### 13.1 Preservar

- domain forms;
- mutation semantics;
- readers;
- error mapping;
- operationId;
- receipts;
- tests.

### 13.2 Substituir quando necessário

- layout acoplado ao shell antigo;
- headers duplicados;
- estilos não aderentes ao novo design system;
- navegação própria concorrente;
- helpers duplicados.

---

## 14. Permission integration

### 14.1 Capability

```text
health.manage_nutrition_plan
```

### 14.2 Leitura

```text
health.read
```

ou adapter temporário aprovado de `health.view` durante coexistência.

### 14.3 Regra

Writes usam somente a capability granular.

### 14.4 Profiles

Atribuição candidata:

- Gestor: candidata forte;
- Administrador: pendente;
- Operador: não recomendada;
- Instrutor: não recomendada.

Nenhum grant é criado por este plano.

---

## 15. OperationId

### 15.1 Geração

Deve ocorrer no command client ou SDK aprovado.

### 15.2 Persistência

O mesmo operationId deve sobreviver a:

- retry;
- timeout;
- reload controlado;
- resposta perdida.

### 15.3 Novo envio voluntário

Uma nova intenção gera novo operationId.

### 15.4 Conflito

Mesmo ID + payload diferente:

```text
IDEMPOTENCY_CONFLICT
```

---

## 16. Receipts

O receipt deverá permitir confirmar:

- command type;
- entity id;
- dog id;
- status;
- replay;
- version;
- correlation;
- timestamp.

### 16.1 UI

A UI não precisa exibir todos os campos.

Ela deve conseguir diferenciar:

- operação concluída;
- replay seguro;
- conflito;
- falha.

---

## 17. Concorrência

Casos obrigatórios:

1. dois gestores criam plano ao mesmo tempo;
2. update concorrente;
3. replace concorrente;
4. cancel após replace;
5. tela stale tenta update;
6. operação repetida;
7. plano já superseded;
8. múltiplos ativos pré-existentes.

### 17.1 Estratégia

Backend deve usar:

- transaction;
- revision/version;
- active plan query;
- operation receipt;
- conflict error.

---

## 18. Cross-platform contract

### 18.1 Web → Mobile

O Mobile deve entender:

- campos;
- enums;
- status;
- revision;
- meals;
- supplements;
- vigência;
- hydration;
- source.

### 18.2 Mobile → Web

A Web deve exibir:

- MealLogs;
- SupplementLogs;
- execução recente;
- divergências;
- origem;
- vínculo com o plano.

### 18.3 Regra

Nenhuma alteração Web poderá ser aprovada apenas com testes Web.

---

## 19. Plano canônico em produção

Antes da integração:

- identificar o K9 alvo;
- confirmar um plano canônico ativo;
- confirmar ausência de múltiplos ativos;
- confirmar parser Mobile;
- confirmar execution path;
- confirmar callables;
- confirmar capability.

### 19.1 Privacidade

O relatório pode usar IDs técnicos e dados minimizados.

---

## 20. Auditoria da branch

### 20.1 Git

- fetch;
- branch HEAD;
- merge-base;
- ahead/behind;
- changed files;
- commits;
- conflicts;
- deleted files;
- generated files.

### 20.2 Código

- routes;
- components;
- models;
- readers;
- services;
- command clients;
- tests;
- permissions;
- error mapping;
- UI states.

### 20.3 Backend

- Functions source;
- deploy state;
- regions;
- receipts;
- Rules;
- indexes;
- audit.

---

## 21. Estratégia de integração

### 21.1 Opção A — Merge controlado

Escolher quando:

- branch está limpa;
- divergência pequena;
- conflitos compreensíveis;
- shell é adaptável.

### 21.2 Opção B — Cherry-pick seletivo

Escolher quando:

- commits têm escopo claro;
- deseja preservar histórico;
- layout antigo conflita.

### 21.3 Opção C — Reaplicação guiada

Escolher quando:

- divergência grande;
- arquitetura de pastas mudou;
- domínio é preservável;
- UI precisa ser reconstruída.

### 21.4 Critério de decisão

| Critério | Peso |
|---|---:|
| preservação de contratos | crítico |
| risco de regressão | crítico |
| clareza do diff | alto |
| histórico Git | médio |
| quantidade de conflitos | alto |
| compatibilidade do shell | alto |
| tempo | médio |

---

# Parte I — Fases de integração

## 22. NUT-WEB-0 — Aprovação documental

Entregas:

- plano atual;
- decisão de escopo;
- invariantes.

Gate:

```text
NUT-WEB-0 — INTEGRATION PLAN APPROVED
```

---

## 23. NUT-WEB-1 — Preflight

- branch;
- SHA;
- worktree;
- tests;
- build;
- Functions;
- data;
- capability.

Sem código.

Gate:

```text
NUT-WEB-1 — NUTRITION BASELINE VERIFIED
```

---

## 24. NUT-WEB-2 — Contract lock

Comparar:

- Web model;
- Backend payload;
- Firestore document;
- Mobile parser;
- tests.

Produzir uma tabela de contrato, sem alteração.

Gate:

```text
NUT-WEB-2 — CROSS-PLATFORM CONTRACT LOCKED
```

---

## 25. NUT-WEB-3 — Estratégia Git

Escolher merge, cherry-pick ou reaplicação.

Registrar:

- commits;
- arquivos;
- exclusões;
- riscos;
- rollback.

Gate:

```text
NUT-WEB-3 — INTEGRATION STRATEGY APPROVED
```

---

## 26. NUT-WEB-4 — Extração da vertical slice

Isolar:

- domain;
- application;
- infrastructure;
- presentation;
- tests.

Evitar alteração funcional.

Gate:

```text
NUT-WEB-4 — NUTRITION SLICE ISOLATED
```

---

## 27. NUT-WEB-5 — Shell integration

- rota;
- nav;
- header;
- selector;
- cockpit link;
- states;
- responsive.

Gate:

```text
NUT-WEB-5 — HEALTH SHELL INTEGRATED
```

---

## 28. NUT-WEB-6 — Permission integration

- health.read;
- manage capability;
- no fallback;
- route guard;
- command guard;
- Backend verification.

Gate:

```text
NUT-WEB-6 — NUTRITION AUTHORIZATION VERIFIED
```

---

## 29. NUT-WEB-7 — Readers and coexistence

- canonical;
- legacy;
- empty;
- degraded;
- error;
- conflict;
- stale/partial if applicable.

Gate:

```text
NUT-WEB-7 — NUTRITION READ MODEL VERIFIED
```

---

## 30. NUT-WEB-8 — Commands

- create;
- update;
- replace;
- cancel;
- operationId;
- receipt;
- errors;
- concurrency.

Gate:

```text
NUT-WEB-8 — NUTRITION COMMANDS VERIFIED
```

---

## 31. NUT-WEB-9 — Cross-platform

- Web create → Mobile parse;
- Web replace → Mobile uses new plan;
- Mobile meal → Web display;
- Mobile supplement → Web display;
- cancel → Mobile no active plan.

Gate:

```text
NUT-WEB-9 — CROSS-PLATFORM PIPELINE VERIFIED
```

---

## 32. NUT-WEB-10 — Homologação

- mockups;
- visual audit;
- accessibility;
- tablet;
- production-safe read;
- rollback;
- human review.

Gate:

```text
NUT-WEB-10 — NUTRITION INTEGRATION APPROVED
```

---

## 33. Mockups existentes

Os dez mockups de gestão de Plano Alimentar deverão ser:

- localizados;
- versionados como referências;
- auditados contra o novo shell;
- classificados em preservar/adaptar/substituir;
- revisados para desktop e tablet.

### 33.1 Não refazer automaticamente

Mockup existente não deve ser descartado por mudança de pasta.

### 33.2 Não preservar automaticamente

Mockup existente não supera:

- IA;
- domain model;
- capability;
- lifecycle.

---

## 34. Estados obrigatórios para mockup

- lista com planos;
- canonical active;
- empty;
- legacy;
- degraded;
- conflict;
- create;
- update;
- replace confirmation;
- cancel confirmation;
- command pending;
- command success;
- command error;
- forbidden;
- tablet.

---

## 35. Testes unitários

- parser;
- enum;
- lifecycle;
- update vs replace;
- operation hash;
- error mapping;
- reader classification;
- conflict detection.

---

## 36. Testes de componente

- plan summary;
- list;
- form;
- confirmation;
- state banners;
- permissions;
- freshness;
- responsive;
- keyboard.

---

## 37. Testes de integração

- callable emulator;
- transaction;
- receipt;
- replay;
- stale version;
- multiple active;
- Rules;
- audit;
- projection.

---

## 38. Testes E2E

1. sem plano → criar;
2. plano ativo → update administrativo;
3. plano ativo → replace estrutural;
4. plano ativo → cancel;
5. replay;
6. forbidden;
7. conflict;
8. legacy;
9. Mobile reads;
10. meal appears.

---

## 39. Testes de regressão

- Health shell;
- profile K9;
- sidebar;
- existing modules;
- Mobile nutrition today;
- meal execution;
- supplements;
- summaries;
- reports.

---

## 40. Rollback

### 40.1 Código

- feature flag;
- revert integration commit;
- branch reference;
- old route fallback if safe.

### 40.2 Dados

Não reverter planos criados por usuários apenas porque a UI foi revertida.

### 40.3 Backend

Callables devem permanecer compatíveis com clientes suportados.

### 40.4 Permissions

Reverter grants somente com audit e análise de operações em andamento.

---

## 41. Critérios de go-live

- branch reconciliada;
- plano ativo confirmado;
- callables confirmadas;
- capability confirmada;
- tests Web;
- tests Backend;
- tests Mobile;
- emulator;
- visual audit;
- accessibility;
- no conflict crítico;
- rollback;
- human approval.

---

## 42. Critérios de no-go

- múltiplos planos ativos;
- callable ausente;
- parser divergente;
- permission fallback;
- receipt inconsistente;
- branch sem baseline;
- tests falhando;
- plan data desconhecida;
- Mobile incompatível;
- rollback indefinido.

---

## 43. Observabilidade

Métricas:

- read state;
- command success;
- validation error;
- forbidden;
- replay;
- idempotency conflict;
- multiple active;
- legacy usage;
- projection lag;
- Mobile parse error.

Sem conteúdo alimentar sensível desnecessário nos logs.

---

## 44. Riscos

### NUT-RISK-001 — Merge importar shell antigo

Mitigação: vertical slice e estratégia seletiva.

### NUT-RISK-002 — Contrato Web divergir do Mobile

Mitigação: contract lock e cross-platform tests.

### NUT-RISK-003 — Fallback para edit

Mitigação: teste negativo e Backend guard.

### NUT-RISK-004 — Múltiplos ativos

Mitigação: fail-closed.

### NUT-RISK-005 — Replace virar overwrite

Mitigação: novo planId e test.

### NUT-RISK-006 — Receipt perdido

Mitigação: preservar application/infra layer.

### NUT-RISK-007 — Mockups ditarem contrato

Mitigação: domínio prevalece.

### NUT-RISK-008 — Plano legado substituir canônico

Mitigação: precedência.

### NUT-RISK-009 — Web executar refeição

Mitigação: channel guard.

### NUT-RISK-010 — Branch ser apagada cedo

Mitigação: tag/referência e aprovação.

---

## 45. Decisões fixadas

1. NutritionPlan é canônico.
2. Branch será auditada antes da integração.
3. Contratos serão preservados.
4. Novo shell pode substituir layout.
5. Capability será preservada.
6. Não haverá fallback para edit.
7. Web não registra MealLog.
8. Web não registra SupplementLog.
9. Update e replace permanecem distintos.
10. Replace cria novo planId.
11. Receipts permanecem.
12. OperationId permanece.
13. Conflict é fail-closed.
14. Integração terá fase própria.
15. Cross-platform test é obrigatório.
16. Mockups existentes serão auditados.
17. Produção será verificada antes do go-live.
18. Dados canônicos não são revertidos por rollback de UI.
19. Branch antiga terá destino documentado.
20. Aprovação humana encerra a integração.

---

## 46. Decisões pendentes

- estratégia Git;
- path final da vertical slice;
- route individual;
- conteúdo da tabela global;
- profiles reais;
- localização dos receipts;
- projection fields;
- histórico de planos na v1;
- visual final;
- rollout.

---

## 47. Próximo passo após este plano

Executar somente depois da aprovação documental:

```text
NUT-WEB-1 — Preflight read-only
```

Nenhum merge deve ocorrer durante a revisão deste documento.

---

## 48. Status

| Item | Estado |
|---|---|
| Contrato histórico | documentado |
| Branch | identificada historicamente |
| Capability | identificada |
| Callables | identificadas historicamente |
| Plano ativo | precisa ser reconfirmado |
| Estratégia Git | pendente |
| Integração | não iniciada |
| Deploy | não autorizado |
| Aprovação humana | pendente |

---

## 49. Conclusão

A integração da Nutrição não será uma reescrita cega nem um merge automático.

Ela será uma operação de preservação de uma vertical slice já validada:

```text
contrato canônico
+ capability granular
+ comandos idempotentes
+ leitores coordenados
+ execução Mobile
```

O novo Health Web fornecerá a casa arquitetural correta.

A Nutrição manterá a identidade funcional que já conquistou.
