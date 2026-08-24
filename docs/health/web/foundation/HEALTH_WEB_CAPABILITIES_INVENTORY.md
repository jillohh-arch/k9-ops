# K9 Ops Web — Health Web v1 Capabilities Inventory

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_CAPABILITIES_INVENTORY.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Inventário, classificação e catálogo-alvo de autorização |
| Repositório Web | `github.com/jillohh-arch/k9-ops` |
| Branch principal auditada | `master` |
| Branch funcional auditada | `feature/health-web-nutrition` |
| Baseline Web | `HEALTH_WEB_BASELINE.md` |
| Arquitetura-alvo | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Matriz de responsabilidades | `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md` |
| Autoridade conceitual | `HEALTH_V1_PERMISSION_MATRIX.md` |
| Inventário Mobile de origem | `HEALTH_V1_CAPABILITIES_INVENTORY.md` |
| Fora de escopo | Atribuir grants reais, alterar Rules, criar claims, implementar UI ou realizar deploy |

---

## 1. Propósito

Este documento inventaria e classifica todas as formas de autorização relacionadas ao Health Web v1.

Ele diferencia:

1. ações genéricas que existem hoje na Web;
2. permissões encontradas no modelo real de `access_profiles`;
3. capabilities Health documentadas no pacote Mobile;
4. capability granular de Nutrição já implementada;
5. capabilities propostas apenas nos documentos Web;
6. lacunas que precisam ser resolvidas antes de qualquer write;
7. compatibilidade entre o modelo atual e o modelo-alvo;
8. riscos de fallback, bypass e ampliação acidental de privilégio.

A pergunta central é:

> Qual capacidade de negócio autoriza cada leitura ou comando, e qual dessas capacidades realmente existe hoje?

---

## 2. Resultado executivo

O estado atual possui quatro camadas coexistentes.

### 2.1 Camada A — autorização genérica da Web

O Web atual trabalha com permissões organizadas por:

```text
permissions[moduleId][action]
```

No módulo `health`, a auditoria encontrou ações genéricas como:

- `view`;
- `create`;
- `edit`;
- `archive`;
- `export`;
- `audit`;
- `approve`, disponível no catálogo genérico, sem responsabilidade Health canônica demonstrada.

Esse modelo é amplo demais para o Health v1.

### 2.2 Camada B — capabilities canônicas documentadas no Mobile

O pacote Health v1 define capabilities como:

```text
health.read
health.record_routine
health.record_preventive
health.record_incident
health.record_clinical_document
health.request_exam
health.interpret_exam
health.create_treatment
health.administer_dose
health.issue_restriction
health.release_restriction
health.discharge_case
health.reopen_case
health.cancel_case
health.complete_treatment
health.schedule_item
health.manage_schedule
health.cancel_record
health.amend_record
health.manage_nutrition_plan
health.audit
```

Esses nomes formam o catálogo conceitual mais autoritativo disponível.

A atribuição a perfis permanece provisória.

### 2.3 Camada C — capability de Nutrição implementada

A branch `feature/health-web-nutrition` introduziu e utilizou:

```text
health.manage_nutrition_plan
```

Características confirmadas na auditoria:

- uso exclusivo na Web;
- sem fallback para `health.edit`;
- proteção de CREATE, UPDATE, REPLACE e CANCEL;
- integração com callables;
- contrato pós-Foundation;
- primeiro precedente válido de autorização granular Health na Web.

### 2.4 Camada D — propostas Web ainda não aprovadas

Documentos anteriores propuseram nomes como:

```text
health.view_overview
health.view_readiness
health.view_schedule
health.view_clinical_cases
health.view_nutrition
health.view_history
health.view_reports
health.view_documents
health.view_sensitive_documents
health.export_reports
```

Esses nomes são úteis como análise de tela, mas não são capabilities canônicas implantadas.

Não devem ser implementados automaticamente.

### 2.5 Conclusão

O catálogo-alvo deve partir das capabilities canônicas do Health v1, preservando `health.manage_nutrition_plan`.

As permissões genéricas atuais serão tratadas como compatibilidade temporária, não como autoridade para writes canônicos.

---

## 3. Relação com o inventário Mobile

O documento `HEALTH_V1_CAPABILITIES_INVENTORY.md` constatou que o aplicativo possuía quatro mecanismos coexistentes:

1. `UserModel.accessLevel`;
2. `UserModel.specialties`;
3. claims de autenticação;
4. `access_profiles/{profileId}.permissions[moduleId][action]`.

Também constatou:

- ausência de uma classe Dart central de capabilities de negócio;
- fallback de profile para `operador_k9`;
- bypass administrativo em Rules;
- Health legado sem checagem granular completa;
- ações Health canônicas ainda documentais naquele marco;
- specialties sem autoridade de autorização;
- conteúdo real dos `access_profiles` fora do repositório;
- necessidade de fail-closed antes de novos writes.

Este documento mantém essas conclusões.

---

## 4. Relação com a Permission Matrix Mobile

`HEALTH_V1_PERMISSION_MATRIX.md` estabelece:

> Administração técnica não equivale a autorização clínica.

Portanto:

- `admin` não é veterinário;
- specialty `Veterinário` não concede decisão clínica;
- não existe papel autenticado `vet` no Health v1;
- profissional externo é registrado em `ProfessionalIdentity`;
- usuário interno é registrado em `RecordedBy`;
- evidência documental é exigida quando a operação representa decisão externa;
- capability autoriza o registro técnico, não a prática clínica.

---

## 5. Hierarquia de autoridade

Em caso de conflito:

1. decisão humana aprovada;
2. ADR canônica;
3. Permission Matrix Mobile;
4. Capability Inventory Mobile;
5. contrato Backend implantado;
6. Rules implantadas;
7. este documento;
8. arquitetura da informação;
9. UI;
10. implementação.

Uma ação visível na interface não prova que a capability existe.

---

## 6. Estados de uma capability

Toda capability deste inventário recebe um dos estados:

| Estado | Significado |
|---|---|
| `VERIFIED_MASTER` | verificada na branch principal da Web |
| `VERIFIED_FEATURE_BRANCH` | verificada em branch funcional ainda não integrada |
| `VERIFIED_BACKEND` | verificada em contrato Backend implantado |
| `DOCUMENTED_CANONICAL` | aprovada documentalmente no Health v1 |
| `DOCUMENTED_PROVISIONAL` | documentada, mas com atribuição ou contrato pendente |
| `PROPOSED_WEB` | proposta apenas para organização Web |
| `LEGACY_GENERIC` | ação genérica atual, insuficiente para o alvo |
| `RUNTIME_UNKNOWN` | existência em profiles/claims reais não verificada |
| `TARGET_DEPRECATED` | não deve autorizar o Health v1 futuro |
| `BLOCKED` | não deve ser usada antes de decisão/implementação |
| `NOT_APPLICABLE` | não pertence ao canal |

---

## 7. Modelo de autorização atual da Web

### 7.1 Estrutura observada

A Web utiliza conceito equivalente a:

```text
module = health
action = view | create | edit | archive | export | audit | approve
```

### 7.2 Perfis padrão observados

A auditoria do código Web identificou uma configuração conceitual semelhante a:

| Perfil | Grants Health genéricos observados |
|---|---|
| Operador K9 | `view`, `create`, `edit` |
| Instrutor K9 | `view`, `create`, `edit` |
| Gestor | `view`, `edit`, `archive`, `export`, `audit` |
| Administrador | catálogo amplo/all |

### 7.3 Limite da evidência

Essa tabela descreve defaults versionados no código.

Ela não prova:

- quais documentos `access_profiles` existem em produção;
- quais foram personalizados;
- quais claims estão emitidas;
- quais usuários possuem cada profile;
- quais escopos estão vigentes;
- se o fallback `operador_k9` altera o resultado;
- se o admin bypass é usado operacionalmente.

### 7.4 Consequência

Nenhuma atribuição real poderá ser decidida apenas com os defaults do repositório.

---

## 8. Mecanismos de identidade e acesso

| Mecanismo | Uso atual | Uso-alvo |
|---|---|---|
| `accessLevel` | comportamento legado/local | não usar como capability |
| `specialties` | qualificação cadastral | não usar como grant |
| `role`/`roles` claims | aliases e bypass | compatibilidade controlada |
| `access_profile_id` | seleção de profile | preservar |
| `permissions[module][action]` | autorização configurável | preservar como armazenamento possível |
| `access_scope` | escopo de acesso | preservar e testar |
| `canAccessDogRecord` | acesso ao K9 | obrigatório |
| `admin` bypass | acesso técnico amplo | auditar e limitar impacto clínico |
| capability Health | autorização de negócio | modelo-alvo |

---

## 9. Regra de avaliação proposta

A autorização de uma operação Health deverá seguir:

```text
1. usuário autenticado?
2. profile ativo?
3. acesso Web permitido?
4. acesso ao K9 permitido?
5. escopo permite a entidade?
6. capability específica existe?
7. estado da entidade permite?
8. evidência profissional existe?
9. comando é válido?
10. Backend confirma tudo?
```

### 9.1 UI

A UI pode ocultar ou desabilitar a ação.

### 9.2 Backend

O Backend é autoridade final.

### 9.3 Rules

Rules impedem leitura e write diretos incompatíveis.

### 9.4 Proibição

O resultado não poderá depender apenas de:

```text
role == "admin"
```

quando a operação exige evidência clínica.

---

## 10. Admin bypass

### 10.1 Estado atual

O inventário Mobile identificou `isAdmin()` com bypass quando existem aliases administrativos em claims.

### 10.2 Risco

Um bypass técnico pode:

- ignorar profiles;
- ampliar leitura;
- permitir write direto se as Rules forem amplas;
- confundir administração com capacidade clínica;
- mascarar falhas de permissionamento.

### 10.3 Regra-alvo

Mesmo quando houver bypass técnico:

- `ProfessionalIdentity` continua obrigatória;
- `source_document` continua obrigatória quando exigida;
- lifecycle continua válido;
- audit continua obrigatório;
- idempotência continua obrigatória;
- usuário interno não se torna profissional externo.

### 10.4 Decisão pendente

Definir se o admin bypass:

1. continuará global;
2. será limitado a suporte/break-glass;
3. será removido dos caminhos Health;
4. exigirá capability Health mesmo para admin;
5. produzirá audit especial.

---

# Parte I — Catálogo canônico

## 11. Leitura

### 11.1 `health.read`

| Campo | Valor |
|---|---|
| Propósito | visualizar registros Health do K9 |
| Canal | Mobile e Web |
| Origem | Permission Matrix Mobile |
| Estado | `DOCUMENTED_CANONICAL` |
| Implementação Web master | não verificada como nome granular |
| Compatibilidade atual | `health.view`, a ser reconciliada |
| Escopo | exige acesso ao K9 |
| PII | inclui `ProfessionalIdentity` no v1, conforme matriz |
| Fallback | nenhum |
| Observação | melhor candidato a capability comum de leitura |

### 11.2 Recomendação

Usar `health.read` como leitura comum do Health v1.

Não fragmentar prematuramente a leitura em uma capability por tela.

### 11.3 Motivos

- segue o contrato Mobile;
- reduz drift entre canais;
- simplifica Rules;
- evita dezenas de grants;
- telas compartilham agregados;
- Firestore não oferece field-level access dentro do documento;
- a separação real de sensibilidade deve ocorrer por entidade/path ou subcoleção.

### 11.4 Exceções justificáveis

Capabilities separadas podem ser criadas para:

- auditoria;
- exportação;
- download de documentos sensíveis;
- reconciliação;
- administração de sistema.

---

## 12. Rotina

### 12.1 `health.record_routine`

| Campo | Valor |
|---|---|
| Propósito | registrar peso, refeição e suplemento |
| Canal canônico | Mobile |
| Origem | Permission Matrix Mobile |
| Estado | `DOCUMENTED_CANONICAL` |
| Web | `NOT_APPLICABLE` para refeição/suplemento; peso pendente |
| Evidência externa | não exigida para execução direta |
| Auditoria | `recorded_by` |
| Offline | candidato a fila Mobile |
| Fallback genérico Web | proibido |

### 12.2 Regra Web

A existência de `health.create` ou `health.edit` não autoriza rotina.

---

## 13. Prevenção

### 13.1 `health.record_preventive`

| Campo | Valor |
|---|---|
| Propósito | registrar vacinação e prevenção |
| Canal | Mobile e Web |
| Origem | Permission Matrix Mobile |
| Estado | `DOCUMENTED_PROVISIONAL` quanto aos fluxos Web finais |
| Evidência externa | obrigatória quando veio de profissional externo |
| Aplicação interna | `professional: null`, sem inventar profissional |
| Web master | ação granular não verificada |
| Compatibilidade genérica | não mapear automaticamente de `create` |
| Decisão pendente | quais tipos podem ser registrados pela Web |

---

## 14. Intercorrência

### 14.1 `health.record_incident`

| Campo | Valor |
|---|---|
| Propósito | registrar intercorrência observada e abrir caso |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_CANONICAL` |
| Evidência externa | não obrigatória para observação direta |
| Persistência | comando composto caso + evento |
| Web master | não verificada como capability granular |
| Compatibilidade genérica | `create` não é suficiente |
| Offline | Mobile candidato |

---

## 15. Documento clínico

### 15.1 `health.record_clinical_document`

| Campo | Valor |
|---|---|
| Propósito | transcrever consulta, laudo ou evolução |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_CANONICAL` |
| ProfessionalIdentity | obrigatória |
| Source document | recomendado/obrigatório conforme ação |
| RecordedBy | obrigatório |
| Web master | não verificada como capability granular |
| Observação | não equivale a upload documental genérico |

---

## 16. Exames

### 16.1 `health.request_exam`

| Campo | Valor |
|---|---|
| Propósito | registrar solicitação externa de exame |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_CANONICAL` |
| ProfessionalIdentity | recomendada |
| Caso clínico | obrigatório |
| Web master | não verificada |

### 16.2 `health.interpret_exam`

| Campo | Valor |
|---|---|
| Propósito | registrar interpretação externa |
| Canal | Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| ProfessionalIdentity | obrigatória |
| Source document | obrigatório |
| Atribuição a perfil | provisória |
| Web master | não verificada |

### 16.3 Lacunas

O lifecycle de exame pode exigir capabilities adicionais para:

- registrar coleta;
- registrar resultado;
- avaliar impacto;
- cancelar processo.

Esses nomes não devem ser inventados na implementação.

Devem ser decididos no catálogo de comandos.

---

## 17. Tratamento

### 17.1 `health.create_treatment`

| Campo | Valor |
|---|---|
| Propósito | registrar prescrição externa |
| Canal | Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| ProfessionalIdentity | obrigatória |
| Source document | obrigatório |
| Mobile | leitura/execução |
| Compatibilidade genérica | `health.create` não autoriza |

### 17.2 `health.complete_treatment`

| Campo | Valor |
|---|---|
| Propósito | concluir protocolo |
| Canal | Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Evidência | profissional recomendado ou obrigatório conforme natureza |
| Atribuição | provisória |
| Web master | não verificada |

### 17.3 Lacunas

Pausar, retomar e cancelar tratamento precisam ser reconciliados com:

- `health.complete_treatment`;
- `health.cancel_record`;
- eventual capability de gestão de protocolo.

Não criar aliases sem decisão.

---

## 18. Dose

### 18.1 `health.administer_dose`

| Campo | Valor |
|---|---|
| Propósito | registrar execução de dose prescrita |
| Canal | Mobile |
| Estado | `DOCUMENTED_CANONICAL` |
| Web | `NOT_APPLICABLE` como fluxo padrão |
| Idempotência | obrigatória |
| Executor | `administered_by` |
| Compatibilidade genérica Web | proibida |

---

## 19. Restrições

### 19.1 `health.issue_restriction`

| Campo | Valor |
|---|---|
| Propósito | registrar restrição externa |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_CANONICAL` |
| ProfessionalIdentity | obrigatória |
| Source document | obrigatório |
| Backend | valida e persiste |
| Prontidão | Function reprojeta |
| Admin técnico | não dispensa evidência |

### 19.2 `health.release_restriction`

| Campo | Valor |
|---|---|
| Propósito | registrar encerramento/liberação |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_CANONICAL` |
| End professional | obrigatório quando liberação clínica |
| End source document | obrigatório quando liberação clínica |
| End reason | obrigatório |
| Proibição | `archive` não pode ser mapeado automaticamente |

---

## 20. Caso clínico

### 20.1 `health.discharge_case`

| Campo | Valor |
|---|---|
| Propósito | registrar alta clínica |
| Canal | Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Evidência | obrigatória quando alta externa |
| Cancelamento administrativo | usa `health.cancel_case` |
| Atribuição | provisória |

### 20.2 `health.reopen_case`

| Campo | Valor |
|---|---|
| Propósito | reabrir caso `discharged` |
| Canal | Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Motivo | obrigatório |
| Evidência | quando aplicável |
| Caso cancelled | não pode reabrir |

### 20.3 `health.cancel_case`

| Campo | Valor |
|---|---|
| Propósito | cancelar caso preservando histórico |
| Canal | Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Motivo | obrigatório |
| Natureza | administrativa |
| Proibição | não mapear de `archive` sem decisão |

---

## 21. Agenda

### 21.1 `health.schedule_item`

| Campo | Valor |
|---|---|
| Propósito | criar item manual |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Write automático | Function, sem capability humana |
| Web master | não verificada granularmente |
| Compatibilidade | `create` não é suficiente |

### 21.2 `health.manage_schedule`

| Campo | Valor |
|---|---|
| Propósito | editar/cancelar itens de agenda |
| Canal | Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Limite | não altera prontidão, restrição ou caso |
| Motivo | obrigatório ao cancelar |
| Atribuição | provisória |

---

## 22. Correções

### 22.1 `health.cancel_record`

| Campo | Valor |
|---|---|
| Propósito | cancelar registro com justificativa |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Escopo | varia por autoria/perfil |
| Hard delete | proibido |
| Compatibilidade | `archive` não equivale automaticamente |

### 22.2 `health.amend_record`

| Campo | Valor |
|---|---|
| Propósito | adicionar correction/addendum/complement |
| Canal | Mobile e Web |
| Estado | `DOCUMENTED_PROVISIONAL` |
| Fato original | imutável |
| Motivo | obrigatório |
| Compatibilidade | `edit` não equivale a amendment |

---

## 23. Nutrição

### 23.1 `health.manage_nutrition_plan`

| Campo | Valor |
|---|---|
| Propósito | criar, atualizar, substituir e cancelar plano |
| Canal | Web |
| Estado documental | `DOCUMENTED_CANONICAL` |
| Estado na branch | `VERIFIED_FEATURE_BRANCH` |
| Backend | callables canônicas |
| Mobile | não administra |
| Fallback para `health.edit` | expressamente proibido |
| Idempotência | `operationId` + receipt |
| Status | primeiro precedente granular Web válido |

### 23.2 Decisão de preservação

Essa capability deverá ser mantida sem renomeação durante a integração, salvo decisão cross-platform explícita.

---

## 24. Auditoria

### 24.1 `health.audit`

| Campo | Valor |
|---|---|
| Propósito | visualizar trilha completa |
| Canal | Web |
| Estado | `DOCUMENTED_CANONICAL` |
| Master Web | existe ação genérica `audit`, compatibilidade a confirmar |
| Acesso | restrito |
| Alteração de logs | proibida |
| Exportação | não automaticamente incluída |

---

# Parte II — Inventário resumido

## 25. Matriz canônica

| Capability | Canal | Estado Web atual | Decisão |
|---|---|---|---|
| `health.read` | Mobile/Web | não verificada como granular | adotar como leitura comum |
| `health.record_routine` | Mobile | ausente na Web-alvo | não conceder à Web por padrão |
| `health.record_preventive` | Mobile/Web | genérica/pendente | definir tipos Web |
| `health.record_incident` | Mobile/Web | pendente | implementar por comando |
| `health.record_clinical_document` | Mobile/Web | pendente | implementar com evidência |
| `health.request_exam` | Mobile/Web | pendente | implementar com lifecycle |
| `health.interpret_exam` | Web | pendente | manter restrita |
| `health.create_treatment` | Web | pendente | manter restrita |
| `health.administer_dose` | Mobile | não aplicável | Web read-only |
| `health.issue_restriction` | Mobile/Web | pendente | evidência obrigatória |
| `health.release_restriction` | Mobile/Web | pendente | evidência/fail-closed |
| `health.discharge_case` | Web | pendente | atribuição provisória |
| `health.reopen_case` | Web | pendente | atribuição provisória |
| `health.cancel_case` | Web | pendente | administrativa |
| `health.complete_treatment` | Web | pendente | atribuição provisória |
| `health.schedule_item` | Mobile/Web | pendente | comando específico |
| `health.manage_schedule` | Web | pendente | não amplia domínio |
| `health.cancel_record` | Mobile/Web | pendente | sem hard delete |
| `health.amend_record` | Mobile/Web | pendente | append-only |
| `health.manage_nutrition_plan` | Web | verificada em branch | preservar/integrar |
| `health.audit` | Web | ação genérica compatível | reconciliar |

---

# Parte III — Ações genéricas atuais

## 26. `health.view`

| Campo | Valor |
|---|---|
| Estado | `LEGACY_GENERIC` |
| Uso atual | leitura do módulo |
| Destino recomendado | migração explícita para `health.read` |
| Migração automática | somente após inventário de profiles |
| Risco | grants atuais podem ser diferentes dos esperados |

### 26.1 Regra

Durante coexistência, um adapter temporário pode aceitar:

```text
health.read OR legacy health.view
```

somente para leitura, se aprovado.

Esse adapter:

- deve ser temporário;
- deve gerar telemetria;
- não deve ser usado em writes;
- deve possuir data de remoção;
- não deve existir dentro de callables canônicas sem plano.

---

## 27. `health.create`

| Campo | Valor |
|---|---|
| Estado | `TARGET_DEPRECATED` como autorização Health ampla |
| Problema | permite múltiplos domínios sem evidência |
| Mapeamento automático | proibido |
| Possíveis substitutos | capabilities específicas |
| Uso legado | somente fluxos antigos durante coexistência |

### 27.1 Proibição

Não autoriza automaticamente:

- incidente;
- vacinação;
- caso;
- exame;
- tratamento;
- restrição;
- plano alimentar;
- documento clínico.

---

## 28. `health.edit`

| Campo | Valor |
|---|---|
| Estado | `TARGET_DEPRECATED` |
| Problema | contradiz imutabilidade |
| Mapeamento automático | proibido |
| Substitutos | manage, cancel, amend, lifecycle commands |
| Nutrição | fallback expressamente proibido |

---

## 29. `health.archive`

| Campo | Valor |
|---|---|
| Estado | `TARGET_DEPRECATED` para domínio Health |
| Problema | “arquivar” não representa lifecycle |
| Não equivale | cancelar caso, encerrar restrição, concluir tratamento |
| Destino | comandos explícitos |
| Uso possível | somente entidade não clínica com contrato próprio |

---

## 30. `health.export`

| Campo | Valor |
|---|---|
| Estado | `LEGACY_GENERIC` |
| Uso atual | exportação ampla de módulo |
| Catálogo canônico | ainda não define capability específica |
| Decisão | criar capability própria ou reconciliar |
| Risco | dados clínicos e PII |
| Requisito | filtros e operação auditados |

### 30.1 Candidato

```text
health.export_reports
```

continua `PROPOSED_WEB`.

Não implementar antes da Permission Matrix.

---

## 31. `health.audit`

A string coincide com a capability canônica.

É necessário confirmar:

- representação persistida;
- semantics do action;
- profiles reais;
- route guard;
- Rules;
- Backend;
- exportação.

A coincidência de nome não prova equivalência completa.

---

## 32. `health.approve`

| Campo | Valor |
|---|---|
| Estado | `NOT_APPLICABLE` sem contrato Health |
| Origem | catálogo genérico da Web |
| Responsabilidade Health | não demonstrada |
| Regra | não usar |
| Possível confusão | aprovação de treino não se aplica ao clínico |

---

# Parte IV — Propostas Web anteriores

## 33. Capabilities `health.view_*`

Foram propostas para:

- overview;
- readiness;
- restrictions;
- schedule;
- clinical;
- treatments;
- nutrition;
- weight;
- vaccination;
- documents;
- history;
- reports;
- audit.

### 33.1 Estado

`PROPOSED_WEB`.

### 33.2 Recomendação

Não adotar na primeira implementação, salvo necessidade comprovada.

### 33.3 Motivos

1. o Mobile já utiliza `health.read`;
2. as telas compartilham os mesmos agregados;
3. split excessivo gera profiles difíceis de manter;
4. Firestore não protege campos individuais;
5. route visibility não é motivo suficiente para nova capability;
6. o objetivo é autorização de negócio, não menu customization.

### 33.4 Possível uso futuro

Um split pode ser justificado para:

- auditoria;
- documentos especialmente sensíveis;
- exportação;
- reconciliação;
- suporte administrativo;
- relatórios agregados interunidades.

---

## 34. `health.view_sensitive_documents`

| Campo | Valor |
|---|---|
| Estado | `PROPOSED_WEB` |
| Necessidade | possível |
| Dependência | arquitetura de dados separada |
| Limite Firestore | sem field-level protection |
| Decisão | somente se documentos sensíveis tiverem path/control próprio |

---

## 35. `health.download_documents`

| Campo | Valor |
|---|---|
| Estado | `PROPOSED_WEB` |
| Necessidade | separar metadata de download |
| Implementação | URL temporária via Backend |
| Decisão | avaliar com política documental |

---

## 36. `health.export_reports`

| Campo | Valor |
|---|---|
| Estado | `PROPOSED_WEB` |
| Necessidade | forte |
| Motivo | exportação é mais sensível que leitura |
| Requisito | auditoria e escopo |
| Decisão | provável capability futura |

---

## 37. `health.reconcile_legacy`

| Campo | Valor |
|---|---|
| Estado | `PROPOSED_WEB` |
| Canal | ferramenta administrativa futura |
| Uso | resolver conflitos de migração |
| Usuário comum | não |
| Admin SDK | persiste decisão |
| Requisito | auditoria reforçada |

---

## 38. `health.rebuild_projections`

| Campo | Valor |
|---|---|
| Estado | `BLOCKED` para UI comum |
| Canal | operação administrativa |
| Executor | Function/Admin SDK |
| Capability humana | se existir, deve ser break-glass |
| UI Health normal | não mostrar |

---

# Parte V — Storage e representação

## 39. Representação possível em `access_profiles`

O modelo atual sugere:

```text
permissions: {
  health: {
    read: true,
    record_preventive: true,
    manage_nutrition_plan: true
  }
}
```

### 39.1 Strings de domínio

A capability lógica:

```text
health.manage_nutrition_plan
```

pode ser representada internamente como:

```text
module = "health"
action = "manage_nutrition_plan"
```

### 39.2 Gate obrigatório

A representação real deve ser confirmada no código e nos documentos de produção antes da migração.

### 39.3 Regra

Não manter dois grants independentes com o mesmo significado:

```text
health.manage_nutrition_plan
permissions.health.manage_nutrition_plan
```

O primeiro é o nome lógico.

O segundo pode ser a forma persistida.

---

## 40. Custom claims

### 40.1 Uso recomendado

Claims devem carregar apenas dados necessários à autorização rápida e estável.

### 40.2 Risco

Um catálogo Health completo em claims:

- cresce;
- exige refresh;
- pode ficar stale;
- duplica access_profiles;
- dificulta revogação.

### 40.3 Recomendação

Manter `access_profile_id`, escopo e flags essenciais em claims, usando profile como autoridade quando compatível com o modelo existente.

A decisão final pertence à arquitetura de autenticação geral.

---

## 41. Escopo

A capability não basta.

Exemplos:

```text
health.read + access_scope
health.record_incident + canAccessDogRecord(dogId)
health.audit + unit scope
```

### 41.1 Escopos possíveis

- próprio K9;
- próprios registros;
- unidade;
- efetivo inteiro;
- administrativo;
- suporte.

### 41.2 `own_records`

Não pode ser aplicado indiscriminadamente a leituras longitudinais do K9.

### 41.3 Gate

Inventariar o uso real de `access_scope`.

---

# Parte VI — Perfis

## 42. Perfis atuais

Os perfis reais vivem fora do inventário completo versionado.

Portanto:

- não atribuir capabilities neste documento;
- não assumir que defaults equivalem à produção;
- não converter `Operador K9`, `Instrutor K9`, `Gestor` e `Administrador` automaticamente;
- não usar specialty.

---

## 43. Perfis candidatos

A futura Permission Matrix Web poderá avaliar:

- Operador K9;
- Instrutor K9;
- Gestor;
- Administrador;
- perfil administrativo Health;
- perfil de auditoria;
- suporte técnico break-glass.

A criação de novos perfis não está aprovada.

---

## 44. Specialty `Veterinário`

| Campo | Regra |
|---|---|
| Natureza | qualificação cadastral |
| Capability | nenhuma automaticamente |
| Papel clínico externo | não representa |
| Login veterinário | não existe no v1 |
| isVet() | não deve ser criado |
| ProfessionalIdentity | continua necessária |

---

## 45. Condutor e admin na Permission Matrix

A matriz Mobile traz atribuições candidatas.

Ela mesma registra que são provisórias.

### 45.1 Regra

Não transformar as listas candidatas em seeds de produção sem decisão humana.

### 45.2 Admin

Admin pode ter mais capabilities administrativas.

Isso não elimina evidência profissional.

---

# Parte VII — Compatibilidade e migração

## 46. Objetivo

Migrar de:

```text
health.view/create/edit/archive/export/audit
```

para:

```text
health.read
+ capabilities específicas por comando
```

sem ampliar nem remover acesso silenciosamente.

---

## 47. Etapas recomendadas

### Etapa 1 — Inventário read-only de produção

Coletar anonimamente:

- profile IDs;
- status;
- grants Health;
- quantidade de usuários por profile;
- claims emitidas;
- escopos;
- uso de aliases;
- grants customizados.

### Etapa 2 — Tabela de equivalência

Para cada profile:

- grants atuais;
- ações realmente usadas;
- capabilities candidatas;
- diferenças;
- risco.

### Etapa 3 — Dual-read controlado

Somente onde necessário:

```text
hasCapability("health.read")
OR temporaryLegacyGrant("health", "view")
```

### Etapa 4 — Writes granulares

Todo write novo exige capability específica.

Não usar dual-read para write.

### Etapa 5 — Telemetria

Registrar:

- uso de fallback legado;
- profile;
- rota;
- ação;
- frequência;
- bloqueios.

Sem registrar conteúdo clínico.

### Etapa 6 — Migração de profiles

Adicionar grants canônicos após aprovação.

### Etapa 7 — Remoção de fallback

Remover compatibilidade genérica.

### Etapa 8 — Aposentar ações genéricas Health

Manter catálogo genérico para outros módulos, se necessário.

---

## 48. Tabela de equivalência preliminar

| Ação atual | Capability-alvo | Migração automática? |
|---|---|---:|
| `health.view` | `health.read` | possível após inventário |
| `health.create` | nenhuma única | não |
| `health.edit` | nenhuma única | não |
| `health.archive` | nenhuma única | não |
| `health.export` | futura export capability | não |
| `health.audit` | `health.audit` | confirmar semantics |
| `health.approve` | nenhuma | não |
| `health.manage_nutrition_plan` | mesma capability | preservar |

---

## 49. Coexistência com telas antigas

Durante a transição:

- telas antigas podem continuar sob grants genéricos;
- telas Health v1 read-only podem usar adapter temporário aprovado;
- writes Health v1 usam apenas capabilities granulares;
- NutritionPlan mantém capability granular;
- nenhum fluxo antigo recebe upgrade automático;
- o usuário deve perceber quando uma ação foi descontinuada.

---

# Parte VIII — Fail-closed

## 50. Situações de bloqueio obrigatório

- capability ausente;
- profile inativo;
- scope incompatível;
- dog access ausente;
- ProfessionalIdentity ausente;
- source document ausente;
- lifecycle inválido;
- projection em conflito para ação dependente;
- restriction ativa;
- operationId inválido;
- legacy record;
- admin bypass sem evidência;
- capability desconhecida;
- action genérica usada em callable granular.

---

## 51. UX de acesso negado

### 51.1 Ocultar

Quando a ação não pertence ao usuário.

### 51.2 Desabilitar com explicação

Quando o usuário possui capability, mas:

- lifecycle impede;
- conflito impede;
- evidência falta;
- projection está pendente.

### 51.3 Forbidden

Deep link sem capability deve retornar acesso negado.

### 51.4 Não fazer

- mostrar formulário e falhar somente no final;
- usar erro genérico;
- tentar action genérica;
- trocar o comando por write direto.

---

# Parte IX — Inventário por tela

## 52. Visão Geral

Capability recomendada:

```text
health.read
```

Ações de drill-down usam leitura.

Exportação exige capability separada futura.

---

## 53. Prontidão

Leitura:

```text
health.read
```

Alterar prontidão:

```text
nenhuma capability de usuário
```

Prontidão é projection.

---

## 54. Restrições

- leitura: `health.read`;
- emitir: `health.issue_restriction`;
- encerrar: `health.release_restriction`;
- cancelamento administrativo: reconciliar com `health.cancel_record`.

---

## 55. Agenda

- leitura: `health.read`;
- criar manual: `health.schedule_item`;
- editar/cancelar: `health.manage_schedule`;
- concluir: capability do fato executado ou contrato específico.

---

## 56. Clínico

- leitura: `health.read`;
- incidente: `health.record_incident`;
- documento clínico: `health.record_clinical_document`;
- cancelar registro: `health.cancel_record`;
- amendment: `health.amend_record`;
- alta: `health.discharge_case`;
- reabrir: `health.reopen_case`;
- cancelar caso: `health.cancel_case`.

---

## 57. Exames

- leitura: `health.read`;
- solicitar: `health.request_exam`;
- interpretar: `health.interpret_exam`;
- outras transições: pendentes.

---

## 58. Tratamentos

- leitura: `health.read`;
- criar: `health.create_treatment`;
- concluir: `health.complete_treatment`;
- dose: `health.administer_dose`, Mobile;
- pausar/retomar/cancelar: pendentes.

---

## 59. Nutrição

- leitura: `health.read`;
- gestão: `health.manage_nutrition_plan`;
- refeição/suplemento: `health.record_routine`, Mobile.

---

## 60. Peso

- leitura: `health.read`;
- registro Mobile: `health.record_routine`;
- registro Web: pendente;
- amendment/cancelamento: contrato específico.

---

## 61. Vacinação

- leitura: `health.read`;
- registro: `health.record_preventive`;
- cancelamento: `health.cancel_record`.

---

## 62. Documentos

- leitura metadata: `health.read`;
- upload clínico: `health.record_clinical_document`;
- upload preventivo: `health.record_preventive`;
- gestão documental genérica: pendente;
- download sensível: proposta futura.

---

## 63. Histórico

Leitura:

```text
health.read
```

Timeline não possui write de usuário.

---

## 64. Relatórios

- leitura na tela: `health.read`;
- exportação: capability pendente;
- relatório sensível: escopo adicional.

---

## 65. Auditoria

```text
health.audit
```

Não presumir que `health.read` inclui audit log completo.

---

# Parte X — Implementação-alvo

## 66. Catálogo central

A Web deverá possuir um catálogo central tipado.

Exemplo conceitual:

```text
HealthCapability.read
HealthCapability.recordPreventive
HealthCapability.recordIncident
HealthCapability.recordClinicalDocument
HealthCapability.requestExam
HealthCapability.interpretExam
HealthCapability.createTreatment
HealthCapability.issueRestriction
HealthCapability.releaseRestriction
HealthCapability.dischargeCase
HealthCapability.reopenCase
HealthCapability.cancelCase
HealthCapability.completeTreatment
HealthCapability.scheduleItem
HealthCapability.manageSchedule
HealthCapability.cancelRecord
HealthCapability.amendRecord
HealthCapability.manageNutritionPlan
HealthCapability.audit
```

### 66.1 Fonte única

Não duplicar strings em:

- componentes;
- hooks;
- route guards;
- services;
- tests.

### 66.2 Mobile

O catálogo deve preservar os mesmos nomes lógicos cross-platform.

---

## 67. Permission evaluator

Responsabilidades:

- ler profile;
- validar status;
- avaliar action;
- considerar escopo;
- expor reason code;
- diferenciar unknown;
- suportar coexistência temporária;
- não fazer network call por componente;
- invalidar cache em mudança de profile.

---

## 68. API conceitual

```text
can("health.read", context)
can("health.manage_nutrition_plan", { dogId })
explainDenial(...)
```

### 68.1 Resultado

Não retornar apenas boolean.

Idealmente:

```text
allowed
reason
source
legacyFallbackUsed
profileId
scope
```

Sem expor dados indevidos na UI.

---

## 69. Route guard

Deve proteger:

- carregamento;
- Server Components;
- client navigation;
- deep links;
- APIs;
- exports.

A proteção client-side não é suficiente.

---

## 70. Command guard

Cada command client deve declarar a capability esperada.

O Backend verifica novamente.

---

## 71. Testes do catálogo

- string exata;
- action ausente;
- profile inativo;
- fallback;
- admin bypass;
- scope;
- dog access;
- capability removida;
- claims stale;
- unknown capability;
- NutritionPlan sem fallback;
- audit separado;
- specialty ignorada.

---

# Parte XI — Auditoria do permissionamento

## 72. Eventos de auditoria

Devem ser auditados:

- mudança de profile;
- grant/revoke;
- uso de break-glass;
- exportação;
- acesso a audit;
- write clínico;
- forbidden relevante;
- fallback legado durante migração;
- idempotency conflict.

### 72.1 Não logar

- conteúdo clínico;
- token;
- documento;
- PII excessiva.

---

# Parte XII — Riscos

## 73. CAP-RISK-001 — Grant genérico amplia writes

**Mitigação:** writes exigem capability específica.

## 74. CAP-RISK-002 — Admin bypass vira autorização clínica

**Mitigação:** evidência e lifecycle independem do bypass.

## 75. CAP-RISK-003 — Specialty vira role

**Mitigação:** specialty nunca concede capability.

## 76. CAP-RISK-004 — Fragmentação excessiva de leitura

**Mitigação:** usar `health.read` como baseline.

## 77. CAP-RISK-005 — Profiles reais desconhecidos

**Mitigação:** inventário read-only antes da migração.

## 78. CAP-RISK-006 — Claims stale

**Mitigação:** política de refresh e profile authority.

## 79. CAP-RISK-007 — Fallback permanente

**Mitigação:** telemetria, prazo e remoção.

## 80. CAP-RISK-008 — `edit` viola imutabilidade

**Mitigação:** cancel/amend/lifecycle commands.

## 81. CAP-RISK-009 — Audit incluído em read

**Mitigação:** `health.audit` separado.

## 82. CAP-RISK-010 — Export incluído em view

**Mitigação:** capability separada.

## 83. CAP-RISK-011 — Nome igual, semantics diferente

**Mitigação:** verificar action, Rules e Backend.

## 84. CAP-RISK-012 — UI como autoridade

**Mitigação:** Backend verifica sempre.

---

# Parte XIII — Decisões fixadas

## 85. Decisões

1. `health.read` é a baseline de leitura comum.
2. Capabilities `health.view_*` não serão adotadas automaticamente.
3. `health.manage_nutrition_plan` será preservada.
4. `health.edit` não é fallback de Nutrição.
5. Ações genéricas não autorizam writes canônicos.
6. `health.create` não mapeia para um único comando.
7. `health.archive` não equivale a lifecycle.
8. `health.edit` não equivale a amendment.
9. `health.audit` permanece separada de leitura comum.
10. Exportação precisa de decisão própria.
11. Specialty não concede autorização.
12. Admin técnico não se torna profissional.
13. ProfessionalIdentity continua obrigatória.
14. Profiles reais precisam ser inventariados.
15. Atribuições Mobile continuam provisórias onde marcadas.
16. UI e Backend usam o mesmo nome lógico.
17. Backend é autoridade.
18. Capability sempre combina com dog access e scope.
19. Writes novos são fail-closed.
20. Projections e legado não recebem write de cliente.

---

# Parte XIV — Decisões humanas pendentes

## 86. Catálogo

- confirmar `health.read` como leitura comum;
- decidir capabilities de exportação;
- decidir download sensível;
- decidir reconciliação;
- decidir pause/resume/cancel treatment;
- decidir transições de exame;
- decidir write Web de peso.

## 87. Perfis

- grants por perfil;
- necessidade de novo profile Health;
- uso do Instrutor;
- limites do Gestor;
- papel do Administrador;
- break-glass.

## 88. Compatibilidade

- dual-read de `view`;
- prazo de remoção;
- telemetria;
- migração de profiles;
- aliases.

## 89. Claims

- fonte de autoridade;
- refresh;
- revogação;
- escopo;
- payload.

## 90. Auditoria

- grant changes;
- acesso sensível;
- forbidden;
- exportação;
- break-glass.

---

# Parte XV — Gates

## 91. Gate CAP-1 — Inventário de produção

Ler de forma anonimizada:

- profiles;
- grants;
- users count;
- claims;
- scopes.

## 92. Gate CAP-2 — Catálogo final

Aprovar a lista de capabilities.

## 93. Gate CAP-3 — Mapeamento persistido

Confirmar:

```text
logical capability → permissions[module][action]
```

## 94. Gate CAP-4 — Profile matrix

Criar `HEALTH_WEB_PERMISSION_MATRIX.md`.

## 95. Gate CAP-5 — Rules

Implementar e testar paths explícitos.

## 96. Gate CAP-6 — Callables

Verificar capability em cada comando.

## 97. Gate CAP-7 — Compatibilidade

Aprovar adapter temporário.

## 98. Gate CAP-8 — Admin bypass

Definir política.

## 99. Gate CAP-9 — Claims

Validar emissão e refresh.

## 100. Gate CAP-10 — Aprovação humana

Nenhum grant será criado antes da aprovação.

---

## 101. Critérios de aprovação

O documento estará aprovado quando:

- o catálogo canônico estiver aceito;
- `health.read` estiver reconciliado;
- propostas `view_*` tiverem destino;
- actions genéricas estiverem classificadas;
- Nutrição estiver preservada;
- profiles reais tiverem plano de inventário;
- specialty estiver excluída da autorização;
- admin bypass tiver política;
- capabilities pendentes estiverem explícitas;
- a Permission Matrix puder ser criada sem suposições ocultas.

---

## 102. Próximo documento recomendado

O próximo documento será:

```text
docs/health/web/foundation/HEALTH_WEB_PERMISSION_MATRIX.md
```

Ele deverá cruzar:

```text
perfil
× capability
× canal
× escopo
× evidência
× entidade
× lifecycle
```

A matriz deverá preservar duas classificações separadas:

- proposta candidata;
- atribuição aprovada.

Nenhum grant real deverá ser tratado como aprovado sem inventário de produção e decisão humana.

---

## 103. Status

| Item | Estado |
|---|---|
| Modelo Web atual | Inventariado |
| Catálogo Mobile | Incorporado |
| Capability de Nutrição | Preservada |
| Actions genéricas | Classificadas |
| Propostas Web | Classificadas |
| Catálogo-alvo | Proposto |
| Profiles reais | Não inventariados |
| Claims reais | Não inventariadas |
| Admin bypass | Pendente |
| Permission Matrix Web | Próximo documento |
| Aprovação para implementação | Não concedida |

---

## 104. Conclusão

O Health Web v1 não será protegido por permissões vagas como:

```text
create
edit
archive
```

Ele será protegido por capacidades que descrevem a operação real:

```text
record_incident
request_exam
create_treatment
issue_restriction
manage_nutrition_plan
amend_record
```

Ao mesmo tempo, o catálogo não será fragmentado artificialmente apenas para refletir cada tela.

A leitura comum permanece representada por:

```text
health.read
```

Capacidades adicionais serão criadas quando houver uma diferença real de:

- risco;
- dado;
- comando;
- evidência;
- exportação;
- auditoria;
- administração.

O próximo passo é definir quais perfis poderão receber cada capability — ainda como proposta controlada, nunca como grant automático.
