# K9 Ops — Health v1.0
## Web Nutrition Implementation Handoff · Web → Backend → Mobile

| Campo | Valor |
|---|---|
| Finalidade | Handoff técnico da fase Web e diagnóstico de compatibilidade Web → Backend → Mobile |
| Status documental | Pronto para revisão — alinhamento de integração pendente; sem commit nesta etapa |
| Web | `C:\Projetos\k9-ops` · `feature/health-web-nutrition` · `0d8423466f017e13e9330aef4b34036172020ffd` |
| Backend canônico + Mobile | `C:\Projetos\canil_gcm_mobile_chatgpt\canil-gcm` · `feature/health-v1-foundation` · `bdb26d233a2f5c65388a5af3cebd00214b8b01ad` |
| Snapshot de auditoria | 2026-07-21 |
| Princípio | **WEB DEFINE / ADMINISTRA · MOBILE EXECUTA / REGISTRA FATOS** |

---

# 1. Objetivo e autoridade

Este documento registra o estado real encontrado ao final da fase Web de gestão de `NutritionPlan`. Ele não é uma nova especificação de produto e não amplia o contrato Health v1.0.

Ele responde:

1. o que foi implementado no cliente Web;
2. qual contrato existe no backend canônico;
3. que documentos e estados o Mobile pode encontrar;
4. quais invariantes são seguras;
5. quais suposições são proibidas;
6. qual é o estado atual do Flutter;
7. qual é o ponto objetivo de retomada;
8. quais divergências de integração ainda precisam de correção.

Ordem de autoridade usada nesta auditoria:

1. código atual do backend canônico em `canil-gcm/functions/**`;
2. código atual do Mobile e da Web;
3. histórico Git confirmado em cada repositório;
4. documentos Health v1.0 vigentes;
5. especificação visual reconciliada e mockups.

O diretório `functions/` do repositório Web **não** é autoridade das mutations de `NutritionPlan`. Nenhuma arquitetura paralela deve ser criada ali.

---

# 2. Preflight auditado

## 2.1 Web

| Item | Resultado |
|---|---|
| Repo | `C:/Projetos/k9-ops` |
| Branch | `feature/health-web-nutrition` |
| HEAD | `0d8423466f017e13e9330aef4b34036172020ffd` |
| Worktree preexistente preservado | `.claude/`, `.playwright-mcp/`, `functions/smoke-test.js`, `functions/temp_audit.mjs` |

## 2.2 Backend canônico + Mobile

| Item | Resultado |
|---|---|
| Repo | `C:/Projetos/canil_gcm_mobile_chatgpt/canil-gcm` |
| Branch | `feature/health-v1-foundation` |
| HEAD auditado | `bdb26d233a2f5c65388a5af3cebd00214b8b01ad` |
| Tracking observado | `origin/feature/health-v1-foundation` no mesmo HEAD |
| Worktree | Limpo |

Nenhuma alteração foi feita no repositório backend/mobile.

---

# 3. Princípio operacional

## Web

- administra o planejamento nutricional;
- cria um plano canônico;
- altera apenas metadados administrativos in-place;
- substitui estruturalmente um plano por outro;
- cancela o plano ativo;
- consulta o estado nutricional para gestão.

## Mobile

- consulta o planejamento vigente;
- constrói a experiência `Nutrition Today`;
- executa refeições planejadas;
- registra `MealLog`;
- registra `SupplementLog` quando o fluxo correspondente estiver habilitado;
- preserva fatos históricos.

```text
NutritionPlan  = intenção / planejamento
MealLog        = fato de alimentação executada
SupplementLog  = fato de suplementação administrada
```

A Web não é fonte concorrente de execução operacional e não deve gravar `MealLog` ou `SupplementLog` como fluxo normal.

---

# 4. Escopo entregue no cliente Web

## 4.1 Implementado no codebase Web

- read foundation de `NutritionPlan`;
- resolução explícita do estado nutricional atual;
- coexistência de leitura canônica e legada;
- capability de UI `health.manage_nutrition_plan`;
- mutation client para três callables canônicas;
- hooks com intenção preparada e `operationId` estável;
- management UI em `/health/nutrition`;
- fluxo de CREATE;
- fluxo de UPDATE administrativo;
- fluxo de REPLACE estrutural, usando a operação canônica de criar/ativar;
- fluxo de CANCEL;
- estados loading, canonical, legacy, empty, degraded, error e conflict;
- bloqueio de mutations em conflict e em contexto não canônico;
- polimento visual;
- reconciliação documental dos 10 mockups.

## 4.2 Significado de “implementado” neste handoff

“Implementado no codebase Web” significa que componentes, contratos TypeScript, hooks e regressões automatizadas existem. Isso **não** significa, por si só, que cada payload tenha sido validado de ponta a ponta contra o backend atualmente implantado.

A auditoria cruzada deste handoff encontrou divergências reais de wire contract. Elas estão registradas na seção **Findings de integração** e devem ser corrigidas antes de declarar compatibilidade operacional completa.

## 4.3 Não implementado

- dashboard nutricional agregado completo;
- execução operacional pela Web;
- histórico Web completo com paginação, filtros e ordenação;
- drafts persistidos;
- status `scheduled`;
- planos com ativação futura;
- autoativação por cron/job;
- fila de planos futuros;
- todos os campos adicionais sugeridos pelos mockups.

---

# 5. Cronologia real da fase Web

Git é a autoridade dos hashes abaixo.

| Etapa | Commit | Objetivo | Resultado e impacto |
|---|---|---|---|
| WEB-N1 | `7abc02f` | Read foundation | Parser defensivo, listeners canônico/legado e resolução fail-closed |
| WEB-N1.1 | `c75b11a` | Permission capability | Adiciona `health.manage_nutrition_plan` à matriz e à gestão de perfis |
| Gate 5B | `ed22dbe` | Mutation client foundation | Tipos, wire mapping, executores das três callables e normalização de erros |
| Gate 5C | `25f2d40` | Mutation hooks | Intenções preparadas, retry com mesmo `operationId` e estados de mutation |
| Gate 5D.1 | `6e84082` | Management UI foundation | Rota, seletor de K9, estados do read model e base de gestão |
| Gate 5D.2 | `2e5778d` | CREATE | Formulário de criação e ativação |
| Gate 5D.3 | `e274903` | UPDATE administrativo | Patch de campos administrativos com `expectedRevision` |
| Gate 5D.4 | `f0e61b9` | REPLACE estrutural | Nova identidade de plano por create/activate e supersession backend |
| Gate 5D.5 | `172a153` | CANCEL | Cancelamento com motivo e proteção de estado/permissão |
| Gate 5D.6 | `4afebd3` | Visual polish | Refinamento visual e de UX da gestão nutricional |
| Gate 5D.7 | `0d84234` | Reconciliation | Especificação reconciliada + 10 mockups versionados |

Commit completo de reconciliação:

```text
0d8423466f017e13e9330aef4b34036172020ffd
docs(health): reconcile nutrition web mockups with implemented contract
```

---

# 6. Backend canônico e estado de implantação

## 6.1 Autoridade de código

As mutations administrativas vivem no repositório Flutter/backend:

- `functions/src/health_nutrition_logic.ts`;
- `functions/src/health_nutrition_engine.ts`;
- `functions/src/health_nutrition_firestore_adapter.ts`;
- `functions/src/health_nutrition_callables.ts`;
- exports em `functions/src/index.ts`.

Paths canônicos:

| Entidade | Path |
|---|---|
| Plano | `dogs/{dogId}/nutrition_plans/{planId}` |
| Receipt | `dogs/{dogId}/nutrition_operations/{receiptId}` |
| Auditoria | `auditLogs/{auditId}` |

## 6.2 Callables confirmadas no código

| Callable | Finalidade | Mutation conceitual |
|---|---|---|
| `healthNutritionCreateAndActivatePlan` | Criar plano e ativá-lo atomicamente | CREATE ou REPLACE, conforme exista active |
| `healthNutritionUpdateActivePlan` | Alterar campos administrativos do active | UPDATE administrativo |
| `healthNutritionCancelPlan` | Cancelar o active com motivo | CANCEL |

As três exigem autenticação, acesso ao K9 e a capability backend `health.manage_nutrition_plan`.

## 6.3 Implantação comprovada versus HEAD atual

O relatório canônico de ativação registra as três callables como ACTIVE, Gen 2, Node.js 22, região `southamerica-east1`, com HEAD então implantado `dd020a29872d90d4b7d64c185532bacf21a2dc53`.

O HEAD atual auditado é posterior:

```text
bdb26d233a2f5c65388a5af3cebd00214b8b01ad
fix(health): align nutrition plan value objects with canonical contract
```

Uma reconciliação posterior, somente leitura, confirmou o deploy filtrado de `bdb26d2`:

| Evidência | Resultado |
|---|---|
| Metadados Gen 2 das três Functions | `ACTIVE`, revisão `00002`, atualização em 2026-07-20 entre `17:58:10Z` e `17:58:17Z` |
| Label Firebase das três Functions | mesmo `firebase-functions-hash`: `9372898028f82c2772c84767f36fe50a1d1513d6` |
| Source artifact auditado | generation `1784570288024703` de `healthNutritionUpdateActivePlan/function-source.zip` |
| Comparação do parser implantado | `health_nutrition_logic.ts` do source artifact e do HEAD limpo `bdb26d2` têm o mesmo SHA-256: `18435F81DD01E9349F3BB2839C507911735DDA737D4697D9379196EE00EFB54A` |

Portanto, a correção de value objects de `bdb26d2` está comprovadamente no artefato atualmente implantado. O relatório Gate 4C permanece correto como fotografia do deploy anterior; ele não representa o último deploy filtrado.

---

# 7. Lifecycle e integridade

Status persistidos:

```text
active
superseded
cancelled
```

Não existem no lifecycle de `NutritionPlan` v1:

```text
draft
scheduled
programmed
ended
```

Invariante por K9:

| Quantidade de `active` | Interpretação |
|---|---|
| 0 | Estado válido; não existe planejamento vigente |
| 1 | Estado válido; plano vigente único |
| >1 | Conflito de integridade; fail closed |

É proibido aplicar `latest wins`, maior `revision`, maior `validFrom` ou ordem de query para esconder múltiplos active.

Transições suportadas:

```text
CREATE sem active:       novo planId → active
REPLACE com active:      plano A active → superseded
                         plano B novo → active
CANCEL:                  active → cancelled
```

`superseded` e `cancelled` são terminais no contrato atual.

---

# 8. Identidade e versionamento

## `planId`

É a identidade do `NutritionPlan`.

## `revision`

É a versão concorrencial do mesmo documento/plano.

| Operação | `planId` | `revision` |
|---|---|---|
| CREATE | novo | começa em 1 |
| UPDATE administrativo | preservado | incrementa 1 |
| REPLACE estrutural | novo planId para o sucessor | novo começa em 1; anterior também é revisionado ao ser superseded |
| CANCEL | preservado | incrementa 1 |

Nova `revision` não significa nova identidade. Novo `planId` significa novo plano.

---

# 9. Regras temporais

Na criação/ativação:

```text
validFrom <= serverNow
validUntil == null OR validUntil > validFrom
```

O backend atual também rejeita:

- plano ativo já expirado;
- `validFrom` anterior ao início do dia civil atual no timezone do plano;
- replacement cujo `validFrom` não seja posterior ao `validFrom` do active anterior;
- retroatividade dentro da janela protegida quando já existem `MealLog` ou `SupplementLog` canônicos incompatíveis.

Não existe:

- plano future-active;
- status `scheduled`;
- cron de ativação;
- fila de planos futuros;
- coexistência `active + scheduled`.

---

# 10. Campos do `NutritionPlan`

## 10.1 Estruturais

Mudança exige REPLACE e novo `planId`:

- `foodType` ↔ `food_type`;
- `amountGramsPerDay` ↔ `amount_grams_per_day`;
- `mealsPerDay` ↔ `meals_per_day`;
- `mealSchedule` ↔ `meal_schedule`;
- `supplements`;
- `hydrationMl` ↔ `hydration_ml`;
- `timezone`;
- `validFrom` ↔ `valid_from`;
- `validUntil` ↔ `valid_until`.

## 10.2 Administrativos

Mutáveis in-place via UPDATE:

- `specialInstructions` ↔ `special_instructions`;
- `professional`;
- `sourceDocument` ↔ `source_document`;
- `attachmentRefs` ↔ `attachment_refs`.

Semântica do patch backend:

| Forma | Semântica |
|---|---|
| campo ausente | preservar valor atual |
| `null` explícito | limpar quando permitido |
| `attachment_refs: []` | substituir por lista vazia |
| valor | substituir valor do campo |

Campos server-authoritative não devem ser enviados pelo cliente: `status`, `revision`, `schema_version`, `recorded_by`, timestamps, actor, role, receipt/audit IDs ou fingerprints internos.

---

# 11. Meal schedule

Contrato persistido:

| Campo Web/domínio | Wire | Regra |
|---|---|---|
| `id` | `id` | estável e único dentro do plano |
| `period` | `period` | `morning`, `afternoon`, `evening`, `night`, `extra` |
| `scheduledTime` | `scheduled_time` | `HH:mm` no timezone do plano |
| `targetGrams` | `target_grams` | finito e positivo |

Invariantes de criação:

- `mealSchedule.length == mealsPerDay`;
- IDs não se repetem;
- períodos podem se repetir;
- soma de `targetGrams` equivale a `amountGramsPerDay`;
- índice do array não é identidade do slot.

O Mobile deve usar `slot.id` como `plannedMealId` e base da ocorrência planejada.

---

# 12. Supplements: regime versus fato

Conceitualmente, `NutritionPlan.supplements[]` contém:

```text
id
name
dose
unit
frequency
instructions?
validFrom?/valid_from?
validUntil?/valid_until?
```

No backend atual, `dose` é numérica e positiva. Units aceitas:

```text
mg | g | ml | scoop | tablet | drop | other
```

Separação obrigatória:

```text
NutritionPlan.supplements[] = regime prescrito
SupplementLog               = administração pontual executada
medicação clínica           = outro domínio
```

Um regime nutricional não é automaticamente medicação clínica. Um registro legado “em uso” não deve gerar `SupplementLog` retroativo.

Há drift de tipos entre backend, Web e parser Mobile; ver seção **Findings de integração**.

---

# 13. Professional Identity e autoria

## 13.1 Profissional externo

Wire canônico do HEAD backend atual:

```text
name
registration_type
registration_number
clinic?
specialty?
```

- `registration_type` representa o conselho/tipo, por exemplo `CRMV`;
- `register_state` representa UF e **não** pode ser convertido em `registration_type`;
- `registration_number` aceita `register_number` apenas como alias de entrada compatível;
- o backend emite o shape canônico.

Profissional externo não é necessariamente usuário K9 Ops.

## 13.2 Autoria interna

`recordedBy` / `recorded_by` é preenchido pelo backend na criação original.

- CREATE define autoria original;
- UPDATE preserva `recorded_by`;
- REPLACE cria nova autoria no novo plano;
- CANCEL preserva autoria do plano;
- ator de operações posteriores pertence à trilha `auditLogs`.

O cliente não envia `actorUid`, `profileId`, `role`, capability, `recordedBy` ou campos de auditoria.

---

# 14. Health Document Reference

Wire canônico atual:

```text
health_document_id
description?
```

`attachment_refs` é `string[]` e cada string é semanticamente um ID de `HealthDocument`, não URL arbitrária.

O backend atual aceita `id` como alias de entrada para `health_document_id`. Esse alias existe para compatibilidade e não deve ser produzido por código Mobile novo. URLs devem ser derivadas do `HealthDocument` real.

---

# 15. Permissões

Capability canônica da gestão:

```text
health.manage_nutrition_plan
```

Não existe fallback autorizado para `health.edit`.

```text
UI capability → controla disponibilidade e comunicação da UX
Backend       → decide autorização real
```

O Mobile deve obedecer à matriz canônica Health e não copiar heurísticas de visibilidade do Web.

---

# 16. Semântica das mutations

## 16.1 CREATE e REPLACE

A mesma callable canônica executa ambos:

```text
healthNutritionCreateAndActivatePlan
```

Sem active:

```text
novo plano → active
supersededPlanId = null
```

Com um active:

```text
plano A active
    ↓ transação
A → superseded, valid_until = B.valid_from
B → active, novo planId, revision = 1
```

Não existe substituição silenciosa via UPDATE. REPLACE preserva logs históricos vinculados ao plano A; fatos antigos não são reatribuídos ao plano B.

## 16.2 UPDATE administrativo

Callable:

```text
healthNutritionUpdateActivePlan
```

Requer:

- `dogId`;
- `planId`;
- `operationId`;
- `expectedRevision` inteiro positivo;
- `planData` com pelo menos um campo administrativo.

Resultado: mesmo `planId`, active preservado, `revision + 1`, autoria original preservada.

Mudança estrutural é rejeitada. Revision stale falha; cliente deve recarregar e permitir revisão humana, sem merge/overwrite automático.

## 16.3 CANCEL

Callable:

```text
healthNutritionCancelPlan
```

Requer `dogId`, `planId`, `operationId`, `expectedRevision` e motivo não vazio.

Resultado:

```text
mesmo planId
active → cancelled
revision + 1
valid_until = serverNow
nenhum plano sucessor criado
```

Após CANCEL, zero active é um estado normal.

---

# 17. Idempotência e receipts

`operationId` representa uma intenção lógica:

- gerar uma vez;
- preservar em retries da mesma intenção;
- não gerar outro ID a cada retry;
- nova intenção recebe novo ID.

O backend cria receipt durável em `nutrition_operations` e valida ator, tipo de operação e fingerprint.

| Situação | Resultado |
|---|---|
| mesmo ID + mesma intenção/payload | replay seguro; `wasNoOp: true`; sem novo audit |
| mesmo ID + payload/tipo/ator divergente | conflito de idempotência |

O Web já preserva o `operationId` nas intenções preparadas. O Mobile já usa o mesmo princípio nas mutations operacionais implementadas.

---

# 18. Conflitos e erros

Famílias relevantes:

- validation / `invalid-argument`;
- `invalid_timezone`;
- revision conflict;
- integrity conflict;
- idempotency conflict;
- `permission-denied`;
- `unauthenticated`;
- `not-found`;
- transport `unavailable` / `deadline-exceeded`.

Comportamento obrigatório:

| Erro | Cliente |
|---|---|
| revision stale | recarregar, mostrar conflito, não sobrescrever |
| integrity | fail closed, bloquear mutation, não latest-wins |
| idempotency conflict | não gerar novo ID para “forçar” a operação |
| transport incerto | preservar intenção e permitir retry seguro |
| permission/auth | não tratar como empty |

O backend atual emite detalhes como `revision-conflict`, `integrity-conflict` e `idempotency-conflict`; o Web tipa principalmente `nutrition_plan_conflict`, `integrity` e `idempotency_conflict`. Essa diferença está registrada como finding.

---

# 19. Read model Web

Estados reais:

```text
loading
canonical
legacy
empty
degraded
error
conflict
```

| Estado | Significado |
|---|---|
| `canonical` | exatamente um active canônico válido |
| `legacy` | zero active canônico e fallback legado utilizável |
| `empty` | zero canônico e zero legado utilizável |
| `degraded` | dado parcial utilizável com falha/parsing parcial |
| `error` | leitura não segura ou inválida |
| `conflict` | mais de um active canônico |

Fontes lidas em tempo real:

1. `dogs/{dogId}/nutrition_plans`;
2. `dogs/{dogId}/nutritional_prescriptions`;
3. `dogs/{dogId}/nutrition_prescriptions`.

Prioridade:

- um active canônico válido vence o fallback legado;
- documento canônico active malformado bloqueia fallback inseguro;
- múltiplos active bloqueiam mutations;
- legado é somente leitura e não deve ser mutado como canônico;
- CREATE em contexto legado cria o primeiro documento canônico, não reescreve o legado.

O Web não possui estado explícito `offline`; falhas Firestore entram em `error` ou `degraded` conforme haja dado utilizável.

---

# 20. Coexistência canônico × legado

Regras compartilhadas relevantes:

- canônico tem prioridade quando íntegro;
- não reintroduzir escrita em `nutritional_prescriptions`, `nutrition_prescriptions`, `feeding_events`, `feedings` ou `nutrition_supplements`;
- não inventar vínculo canônico para dados legados;
- dedupe de refeições no Mobile exige proveniência inequívoca `legacySource + legacyId`;
- `legacyId` sozinho não é suficiente;
- `nutrition_supplements` legado representa regime/estado, não administração pontual;
- a existência de canônico não autoriza apagar fatos legados.

---

# 21. MealLog, SupplementLog e ocorrência

## 21.1 Vínculo histórico

Um log já persistido não deve ser reescrito porque o plano foi atualizado, substituído ou cancelado.

```text
UPDATE administrativo → mesmo planId; fatos continuam na mesma identidade
REPLACE               → novo planId para fatos novos; fatos antigos ficam no anterior
CANCEL                → não gerar novas ocorrências; fatos existentes permanecem
```

## 21.2 `mealOccurrenceId`

Identidade semântica confirmada:

```text
dogId
+ planId
+ plannedMealId (slot.id)
+ localServiceDate no timezone do plano
```

O valor físico persistido é opaco para o cliente. O Mobile não deve inventar algoritmo de hash próprio.

Impacto do REPLACE:

- novo `planId` produz novas identidades de ocorrência;
- logs do plano superseded continuam ligados ao `planId` e slot originais;
- nenhuma migração automática de fatos históricos para o sucessor.

---

# 22. Estado atual do Mobile

O Flutter atual já possui:

- `CoexistenceNutritionReadSource`;
- readers canônicos e legados;
- `HealthNutritionReadController` com proteção contra resposta stale;
- `HealthNutritionTodayScreen`;
- estados loading, data, empty, degraded, offline e error;
- representação explícita de conflito de múltiplos active;
- fallback legado quando não existe active canônico;
- UI “Sem meta ativa” para ausência de plano;
- CTA planejado somente para plano canônico único, saudável e vigente;
- bloqueio do CTA em legacy, degraded e integrity conflict;
- execução de refeição planejada via `healthNutritionCreateMealLog`;
- pending intent com `operationId` estável;
- read-after-write;
- vínculo `planId + slot.id + localServiceDate` na intenção planejada.

O Mobile atual não é um consumidor vazio aguardando implementação. A retomada deve preservar essas capacidades e alinhá-las ao contrato produzido pela fase Web.

---

# 23. Impacto em Nutrition Today

| Cenário | Comportamento esperado |
|---|---|
| 1 active | construir o dia pelo plano canônico vigente |
| 0 active | mostrar estado seguro sem plano/meta ativa; não gerar ocorrências planejadas |
| >1 active | integrity conflict; manter leitura diagnóstica e bloquear execução planejada |
| replacement | usar o novo active para novas ocorrências e preservar histórico do superseded |
| cancelled | parar de gerar novas ocorrências; preservar logs existentes |
| UPDATE administrativo | não recriar ocorrência nem mudar `planId` |
| legacy only | manter leitura compatível; não tratar o legado como documento canônico mutável |

---

# 24. O que o Mobile pode assumir

- ✅ zero ou um plano `active` é estado íntegro;
- ✅ mais de um `active` é conflito de integridade;
- ✅ replacement cria nova identidade de plano;
- ✅ plano anterior permanece `superseded` e histórico;
- ✅ cancelamento pode deixar zero active;
- ✅ UPDATE administrativo mantém `planId`;
- ✅ UPDATE e CANCEL incrementam `revision`;
- ✅ campos estruturais não mudam via UPDATE;
- ✅ `recorded_by` original é preservado em UPDATE/CANCEL;
- ✅ cada slot possui `id` estável dentro da versão do plano;
- ✅ `slot.id`, e não o índice, identifica a refeição planejada;
- ✅ Web não registra execução operacional normal;
- ✅ logs existentes preservam sua identidade histórica;
- ✅ `attachment_refs` referencia HealthDocument por ID.

---

# 25. O que o Mobile não pode assumir

- ❌ sempre existe plano active;
- ❌ o plano “mais novo” é automaticamente o vigente;
- ❌ nova `revision` significa novo `planId`;
- ❌ mudança estrutural mantém `planId`;
- ❌ plano `cancelled` ou `superseded` volta a active;
- ❌ existe `draft` de NutritionPlan;
- ❌ existe `scheduled`;
- ❌ `validFrom` futuro é permitido;
- ❌ existe autoativação futura;
- ❌ Web cria `MealLog` ou `SupplementLog` no fluxo normal;
- ❌ mockup define contrato de domínio;
- ❌ índice do array é identidade do slot;
- ❌ `meal_occurrence_id` pode ser recalculado livremente pelo cliente;
- ❌ regime de suplemento é uma administração já realizada;
- ❌ toda versão do backend em Git já está implantada em produção.

---

# 26. Mockups

Fontes versionadas:

- `docs/HEALTH_WEB_NUTRITION_IMPLEMENTATION_SPEC.md`;
- `docs/mockups/`.

Resumo:

| Mockup | Classificação |
|---|---|
| 01 | REFERÊNCIA VISUAL + FUTURE FEATURE |
| 02 | V1 + REFERÊNCIA VISUAL |
| 03 | FUTURE FEATURE + REFERÊNCIA VISUAL |
| 04 | FUTURE FEATURE + REFERÊNCIA VISUAL |
| 05–10 | REFERÊNCIA VISUAL + FUTURE FEATURE |

Os mockups são North Star visual. Código e contrato backend são autoridade funcional.

---

# 27. Testes e validação da fase Web

Estado documental da última validação reportada:

## Automated regression

| Fluxo | Estado |
|---|---|
| CREATE | ✅ |
| UPDATE | ✅ |
| REPLACE | ✅ |
| CANCEL | ✅ |
| Total | 850 testes |

## Browser visual validation

| Fluxo | Estado |
|---|---|
| EMPTY | ✅ |
| CREATE | ✅ |
| UPDATE | ⏳ |
| REPLACE | ⏳ |
| CANCEL | ⏳ |

## Full isolated browser E2E

```text
⏳ pending safe environment
```

Os 850 testes são regressão automatizada do codebase Web e **não** equivalem a browser E2E. Eles não substituem a validação real dos wire contracts cruzados identificados neste handoff. Nenhuma suíte foi reexecutada nesta tarefa documental.

---

# 28. Pendências controladas

## 28.1 Pendências de validação

- browser E2E isolado de UPDATE;
- browser E2E isolado de REPLACE;
- browser E2E isolado de CANCEL;
- validação integrada dos payloads Web contra o backend canônico atual.

## 28.2 Features futuras

- dashboard nutricional agregado;
- execução operacional na Web;
- histórico Web completo;
- drafts;
- scheduled plans;
- future activation;
- fila de planos futuros;
- campos nutricionais adicionais dos mockups.

Pendência de validação e feature futura são categorias diferentes. Nenhuma delas deve ser usada para esconder incompatibilidade de contrato já existente.

---

# 29. Findings de integração

## 29.1 Matriz de evidências

As linhas abaixo apontam para o snapshot auditado de cada repositório. Os números de linha são evidência de localização, não parte permanente do contrato; nomes de arquivo, símbolo e comportamento têm precedência se o código se mover.

| Finding | Evidência Web | Evidência backend | Evidência Mobile | Teste existente | Teste/prova ausente | Conclusão |
|---|---|---|---|---|---|---|
| F-01 | `nutrition-plan-mutation-service.ts:168-208`, `buildUpdateNutritionPlanRequest`, produz `changes`; `:312`, `executeUpdateNutritionPlan`, envia o request sem adaptação posterior | `health_nutrition_callables.ts:410-415`, `runHealthNutritionUpdateActivePlan`, repassa `data`; `health_nutrition_logic.ts:1767`, `parseUpdateActiveNutritionPlan`, lê apenas `planData/plan_data` | Não aplicável: o Mobile não chama a mutation administrativa Web | Web: `nutrition-plan-mutation-service.test.ts:339-412` afirma o envelope `changes`; backend: `health_nutrition_callables_test.ts:711` usa `planData` | Integração Web request → Functions Emulator | **CONFIRMADO — MAJOR** |
| F-02 | `types.ts:106-110,314-318` tipa `dose/unit` como string; `nutrition-plan-mutation-service.ts:94-108` copia sem conversão; `nutrition-plan-service.ts:194-202` rejeita dose não textual | `health_nutrition_logic.ts:38-46,1365-1369,1656-1660` exige dose numérica e unit canônica | `nutrition_plan_regimen.dart:9-24` mantém dose textual; `nutrition_document_parser.dart:258-292`, especialmente `:272`, exige string | Backend: `health_nutrition_logic_test.ts:720` rejeita dose textual e `:1001-1011` rejeita unit inválida | Round-trip CREATE/READ com suplemento atravessando Web → Emulator → Mobile | **CONFIRMADO — MAJOR** |
| F-03 | `nutrition-mutation-errors.ts:43-57` reconhece códigos underscore/genéricos; testes em `nutrition-plan-mutation-service.test.ts:623-654` simulam `nutrition_plan_conflict` | `health_nutrition_engine.ts:1063-1064,1088,1122,1130` emite códigos hifenizados; `health_nutrition_callables.ts:94-128` preserva `detailCode` em `HttpsError.details.code` | Não aplicável ao reader Mobile atual | Há testes isolados dos dois lados, mas com taxonomias diferentes | Teste de normalização usando o erro real da callable/Emulator | **CONFIRMADO — MAJOR DE UX/CONTRATO** |
| F-04 | Não aplicável ao cliente Web | Metadados Gen 2 + source artifact implantado; SHA-256 de `health_nutrition_logic.ts` igual ao HEAD `bdb26d2` | Não aplicável | `health_nutrition_logic_test.ts:1230-1437` cobre os value objects canônicos | Nenhuma prova adicional necessária para afirmar que a correção está no artefato implantado; E2E funcional continua separado | **RECONCILIADO — NÃO É FINDING ABERTO** |
| F-05 | Web produz os value objects administrativos opcionais | Backend persiste `professional` e `source_document` no contrato canônico | `nutrition_plan.dart:54-55,130-131` declara os campos; `nutrition_document_parser.dart:181-203` constrói `NutritionPlan` sem repassá-los | A suíte do parser cobre outros campos, mas não contém asserções focadas em `professional/sourceDocument` | Unit tests do parser com os dois value objects e round-trip do documento canônico | **CONFIRMADO — MAJOR PARA LEITURA COMPLETA; NÃO BLOQUEIA MEAL EXECUTION** |

## 29.2 Análise individual

## F-01 · MAJOR — UPDATE Web envia envelope diferente do backend

Web atual:

```text
{ dogId, planId, operationId, expectedRevision, changes: {...} }
```

Backend atual e snapshot implantado:

```text
{ dogId, planId, operationId, expectedRevision, planData: {...} }
```

O parser backend lê somente `planData` / `plan_data`. Portanto, o UPDATE Web atual tende a falhar com validation antes de chegar à lógica de revisão. Os testes Web exercitam mocks do callable e não provam esse envelope real.

Impacto: UPDATE administrativo não deve ser declarado integrado até o wire mapping ser reconciliado e validado contra Emulator/backend real.

## F-02 · MAJOR — regime de suplemento diverge entre produtor e consumidores

Backend atual persiste/aceita:

```text
dose: number
unit: mg|g|ml|scoop|tablet|drop|other
```

Web atual modela e envia:

```text
dose: string
unit: string livre
```

A UI Web usa valores como `cápsulas`. O backend rejeita dose textual e unit fora do enum. Além disso:

- parser Web de plano canônico espera `dose` textual;
- `NutritionPlanSupplementRegimen` no Mobile espera `dose` textual;
- parser Mobile de plano canônico usa `nonEmptyString` para `dose`.

Consequência: um plano com suplemento produzido conforme o backend atual pode degradar/falhar na leitura Web e Mobile; a UI Web atual também pode falhar ao criá-lo.

## F-03 · MAJOR — taxonomia de conflito não está alinhada ponta a ponta

Backend atual usa details como:

```text
revision-conflict
integrity-conflict
idempotency-conflict
```

O normalizador Web reconhece principalmente:

```text
nutrition_plan_conflict
integrity
idempotency_conflict
```

O transporte ainda falha fechado, mas `domainCode` pode ficar indefinido e a UX específica de conflito pode não ser acionada.

## F-04 · RECONCILIADO — value objects canônicos estão no artefato implantado

O relatório Gate 4C registra corretamente o deploy anterior em `dd020a2`. A auditoria posterior dos metadados Gen 2 e do source artifact atualmente implantado confirmou que o parser de `bdb26d2` está em produção: o arquivo `health_nutrition_logic.ts` extraído do bundle tem SHA-256 idêntico ao HEAD auditado.

Conclusão: F-04 não permanece como incompatibilidade aberta. Essa prova de conteúdo implantado não substitui o E2E funcional dos contratos F-01 a F-03.

## F-05 · MAJOR para retomada — parser Mobile não materializa todos os metadados administrativos

O modelo Dart possui `professional` e `sourceDocument`, mas `NutritionPlanDocumentParser.parse` auditado não os repassa ao construtor. Ele materializa `specialInstructions`, `attachmentRefs` e supplements, mas descarta os dois value objects.

Impacto: Nutrition Today não depende desses campos para execução, porém o Mobile não pode alegar leitura completa do plano produzido pela Web até alinhar o parser e testes.

## Avaliação

Os findings abertos F-01, F-02, F-03 e F-05 não invalidam a existência da fundação Web, dos fluxos de UI, do backend transacional ou do `Nutrition Today`. Eles invalidam uma afirmação mais forte: **compatibilidade operacional integral Web ↔ backend atual ↔ Mobile já comprovada**.

---

# 30. Mobile — Ponto Oficial de Retomada

## A. Estado do backend existente

- collection canônica `nutrition_plans`;
- lifecycle active/superseded/cancelled;
- três callables administrativas;
- receipts e auditLogs;
- idempotência e revisão otimista;
- integridade fail-closed;
- proteção contra retroatividade conflitante;
- capability `health.manage_nutrition_plan`.

## B. Estado que a Web pretende produzir

- zero ou um plano canônico active;
- novo `planId` em replacement;
- mesmo `planId` em update/cancel;
- meal schedule explícito;
- metadados administrativos opcionais;
- nenhum fato operacional.

Os findings abertos F-01 a F-03 precisam ser resolvidos para que essa intenção corresponda de forma comprovada ao wire/backend real. F-04 foi reconciliado por inspeção direta do artefato implantado.

## C. O que o Mobile já lê/executa

- plano canônico e fallback legado;
- zero-active;
- conflito de múltiplos active;
- meals canônicos e legados com dedupe por proveniência;
- supplement logs canônicos e regimes legados;
- Nutrition Today;
- criação de MealLog planejado e read-after-write.

## D. O que precisa ser revisado no Mobile

- parser de supplements conforme o contrato canônico final;
- parser de `ProfessionalIdentity`;
- parser de `HealthDocumentRef`;
- regressão explícita de replacement, cancel e update administrativo;
- ocorrência nova após mudança de `planId`;
- preservação de fatos do superseded;
- zero-active após cancel;
- conflito fail-closed com documentos realmente produzidos pelo backend;
- dedupe legado após entrada do primeiro plano canônico.

## E. Próximo gate recomendado

Não abrir nova feature visual primeiro.

Nome funcional recomendado:

```text
NutritionPlan Cross-Platform Contract Alignment & Lifecycle Regression Gate
```

Escopo obrigatório: **Web + backend canônico + Mobile + Emulator E2E**.

Objetivos:

1. decidir e congelar um único contrato de supplement regimen;
2. alinhar backend, wire Web e parser Mobile;
3. alinhar envelope UPDATE e taxonomia de erros;
4. provar em Emulator a cadeia Web payload → callable → Firestore → Mobile read;
5. cobrir CREATE, UPDATE, REPLACE, CANCEL, zero-active e conflict;
6. somente depois retomar evolução funcional de Nutrition Today/suplementação.

Esse gate deriva do estado real auditado e não substitui o planejamento oficial que venha a ser aprovado.

---

# 31. Checklist operacional de retomada Mobile

- [x] Confirmar que a correção backend `bdb26d2` está no source artifact implantado.
- [ ] Alinhar o envelope UPDATE (`planData` versus `changes`).
- [ ] Congelar `NutritionPlan.supplements[].dose` e `unit` em um único contrato.
- [ ] Atualizar/testar parser Mobile para o contrato de supplement regimen aprovado.
- [ ] Materializar `professional` no parser Mobile.
- [ ] Materializar `source_document` no parser Mobile.
- [ ] Confirmar resolução de exatamente um active.
- [ ] Confirmar UI de zero-active após CANCEL.
- [ ] Confirmar conflict fail-closed com >1 active.
- [ ] Confirmar troca de `planId` após REPLACE.
- [ ] Confirmar `mealOccurrenceId`/ocorrência com o novo `planId`.
- [ ] Confirmar que logs históricos permanecem no superseded.
- [ ] Confirmar que cancelled não gera novas ocorrências.
- [ ] Confirmar que UPDATE administrativo não recria ocorrências.
- [ ] Confirmar preservação de autoria original e audit do ator posterior.
- [ ] Confirmar legacy dedupe sem heurísticas temporais.
- [ ] Executar teste integrado Web payload → Functions Emulator → Firestore → Flutter reader.
- [ ] Separar regressão automatizada, browser E2E e device/Emulator E2E no relatório final.

---

# 32. Fontes auditadas

## Web

- `src/features/health/nutrition/**`;
- `src/lib/permissions/**` e provider de access control;
- `docs/HEALTH_WEB_NUTRITION_IMPLEMENTATION_SPEC.md`;
- `docs/mockups/**`;
- Git range `7abc02f..0d84234`.

## Backend canônico

- `functions/src/health_nutrition_logic.ts`;
- `functions/src/health_nutrition_engine.ts`;
- `functions/src/health_nutrition_firestore_adapter.ts`;
- `functions/src/health_nutrition_callables.ts`;
- testes Nutrition do backend;
- relatório de ativação de produção Gate 4C;
- metadados Gen 2 das três Functions e source artifact implantado, auditados em modo somente leitura.

## Mobile

- domínio `lib/features/health/domain/**nutrition**`;
- coexistência `lib/features/health/data/coexistence/nutrition/**`;
- `HealthNutritionReadController`;
- `HealthNutritionTodayScreen`;
- fluxo de refeição planejada;
- relatórios Gate 5B e Gate 5C.2A;
- testes Health/Nutrition relacionados.

## Documentação Health v1

- `HEALTH_V1_DOMAIN_MODEL.md`;
- `HEALTH_V1_FIRESTORE_SCHEMA.md`;
- `HEALTH_V1_PERMISSION_MATRIX.md`;
- `HEALTH_V1_PHASE_5B_NUTRITION_CANONICAL_DECISIONS.md`;
- relatórios de ativação/read/execution relevantes.

---

# 33. Veredito documental

```text
HANDOFF_DOCUMENT_APPROVED_IN_PRINCIPLE
CONTRACT_FINDINGS_EVIDENCE_RECONCILED
WEB_UI_PHASE_COMPLETE
WEB_BACKEND_MOBILE_INTEGRATION_NOT_YET_PROVEN
```

O documento está pronto para revisão porque distingue:

- implementação existente;
- contrato canônico;
- implantação comprovada;
- estado Mobile já entregue;
- features futuras;
- validações pendentes;
- incompatibilidades de integração que exigem correção.

Ele não autoriza commit, deploy ou alteração de código. A evidência documental de F-01 a F-05 foi reconciliada nesta revisão, com F-04 encerrado e F-01, F-02, F-03 e F-05 confirmados. Os findings abertos devem ser corrigidos e validados no gate cross-platform antes de declarar a fase Web integralmente compatível com o backend atual ou usar este handoff como autorização de release.
