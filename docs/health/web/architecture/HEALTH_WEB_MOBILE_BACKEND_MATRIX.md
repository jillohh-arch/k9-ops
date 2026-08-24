# K9 Ops Web — Health Web v1 Mobile × Web × Backend Responsibility Matrix

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Matriz de responsabilidades entre canais e serviços |
| Repositório Web | `github.com/jillohh-arch/k9-ops` |
| Baseline Web | `HEALTH_WEB_BASELINE.md` |
| Arquitetura Web | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Arquitetura da informação | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` |
| Modelo domínio-telas | `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md` |
| Matriz de fontes | `HEALTH_WEB_DATA_SOURCE_MATRIX.md` |
| Autoridade de domínio | Health v1.0 Mobile/Backend aprovado |
| Fora de escopo | Implementação, Rules, Functions, merge, deploy, migração e atribuição final de capabilities |

---

## 1. Propósito

Este documento define, operação por operação, a divisão de responsabilidade entre:

- Web;
- Mobile;
- Backend;
- Functions e serviços de projeção;
- Admin SDK e migração;
- usuário interno;
- profissional externo;
- sistema de auditoria.

A matriz responde, para cada ação:

1. quem pode iniciar a intenção;
2. quem executa o fato no mundo real;
3. quem registra ou transcreve;
4. quem valida autorização;
5. quem valida invariantes de domínio;
6. quem persiste a fonte canônica;
7. quem atualiza projeções;
8. quem cria agenda derivada;
9. quem registra auditoria;
10. qual capability é exigida;
11. qual evidência é obrigatória;
12. qual política de idempotência se aplica;
13. qual comportamento offline é permitido;
14. qual receipt ou referência deve ser retornado;
15. quais plataformas estão expressamente proibidas.

A pergunta central é:

> Quem possui autoridade em cada etapa, sem confundir decisão clínica, execução física, registro técnico e projeção de leitura?

---

## 2. Problema que este documento resolve

Sem uma matriz formal, o Health Web poderia repetir falhas do legado:

- Web executando rotinas que pertencem ao Mobile;
- Mobile administrando contratos que pertencem à Web;
- cliente calculando prontidão;
- write direto em Firestore;
- usuário interno apresentado como profissional veterinário;
- conclusão de agenda confundida com execução;
- alteração parcial sem transação;
- ausência de idempotência;
- auditoria inferida por `updated_at`;
- projections usadas como autoridade de write;
- fallback de capability;
- operação clínica sem evidência;
- múltiplos canais criando fatos duplicados.

Este documento não pressupõe que toda ação disponível no domínio estará disponível na primeira versão Web.

Ele registra:

- responsabilidades canônicas;
- canais já aprovados;
- canais candidatos;
- decisões ainda pendentes.

---

## 3. Fontes de autoridade utilizadas

Esta matriz preserva o conteúdo dos seguintes documentos:

- `HEALTH_V1_ARCHITECTURE`;
- `HEALTH_V1_DOMAIN_MODEL`;
- `HEALTH_V1_PERMISSION_MATRIX`;
- `HEALTH_V1_CAPABILITIES_INVENTORY`;
- `HEALTH_V1_READINESS_POLICY`;
- `HEALTH_V1_FIRESTORE_SCHEMA`;
- ADR-001 — Limites do Domínio;
- ADR-002 — Eventos Clínicos e Imutabilidade;
- ADR-003 — Workflow de Caso Clínico;
- ADR-004 — Timeline, Summary e Projeções;
- ADR-005 — Prontidão e Restrições;
- ADR-006 — Coexistência e Migração;
- ADR-007 — Organização Interna;
- contrato canônico da Nutrição pós-Foundation;
- documentos Web produzidos anteriormente.

Quando os documentos Mobile classificam uma atribuição como provisória, esta matriz mantém a mesma classificação.

---

## 4. Hierarquia de autoridade

Em caso de conflito:

1. decisão humana explicitamente aprovada;
2. ADR canônica;
3. modelo de domínio;
4. schema canônico;
5. permission matrix vigente;
6. contrato Backend implantado;
7. esta matriz;
8. arquitetura da informação;
9. mockup;
10. implementação.

Uma UI não pode ampliar responsabilidade porque um botão seria conveniente.

---

## 5. Vocabulário de responsabilidade

### 5.1 Decisor clínico

Profissional externo que toma uma decisão clínica.

É representado por:

```text
ProfessionalIdentity
```

Ele não é inferido a partir do usuário autenticado.

### 5.2 Executor físico

Pessoa que realizou a ação no mundo real.

Exemplos:

- aplicou vacina;
- administrou dose;
- realizou pesagem;
- forneceu refeição;
- coletou material;
- conduziu o K9 à consulta.

### 5.3 Registrador interno

Usuário autenticado que registra ou transcreve a informação.

É representado por:

```text
RecordedBy
```

### 5.4 Iniciador do comando

Canal ou usuário que solicita uma operação ao Backend.

### 5.5 Validador de acesso

Backend que verifica:

- autenticação;
- capability;
- escopo;
- propriedade;
- estado da entidade.

### 5.6 Validador de domínio

Backend que verifica:

- lifecycle;
- invariantes;
- datas;
- evidências;
- unicidade;
- idempotência;
- conflito.

### 5.7 Persistidor

Serviço Backend que grava a fonte canônica.

### 5.8 Projetor

Function que atualiza:

- `health_summary`;
- `health_timeline`;
- flags derivados;
- contagens;
- agenda automática.

### 5.9 Auditor

Backend que registra log imutável da operação.

### 5.10 Receipt

Comprovante durável de operação idempotente, quando o contrato exigir.

---

## 6. Princípios obrigatórios

1. Mobile prioriza rapidez operacional.
2. Web concentra gestão, planejamento e administração.
3. Backend é autoridade de validação e persistência.
4. Functions mantêm projections.
5. Cliente não escreve em projections.
6. Decisão clínica pertence ao profissional externo.
7. Usuário interno registra ou transcreve.
8. Fato de campo deve preservar executor real.
9. Ação de gestão não vira fato executado.
10. Agenda não é execução.
11. Summary não autoriza ação crítica sozinho.
12. Restrição canônica é consultada em ações críticas.
13. Eventos finais são imutáveis.
14. Correções usam amendment.
15. Legado é read-only para clientes.
16. Todo write relevante é auditado.
17. Operações críticas são idempotentes.
18. Capability é verificada no Backend.
19. A UI não usa fallback de capability.
20. Falha parcial não pode produzir sucesso aparente.

---

## 7. Classificação dos canais

| Canal | Responsabilidade principal |
|---|---|
| Mobile | execução operacional, rotina, registro em campo e consulta |
| Web | supervisão, gestão, planejamento, transcrição e administração |
| Backend callable/command | autorização, invariantes, persistência e receipts |
| Function | projeção, agenda derivada, agregados, reconciliação |
| Admin SDK | migração, backfill, correções controladas e ações administrativas excepcionais |
| Storage service | persistência de arquivos e geração de acesso temporário |
| Audit service | log imutável de operações |
| ProfessionalIdentity | origem da decisão profissional externa |

---

## 8. Significado dos símbolos

| Símbolo | Significado |
|---|---|
| ✅ | responsabilidade aprovada ou canônica |
| ◐ | responsabilidade candidata ou pendente |
| ❌ | responsabilidade proibida |
| R | leitura |
| C | inicia comando |
| X | execução física |
| V | valida |
| P | persiste |
| J | projeta |
| A | audita |
| M | migração/Admin SDK |

---

## 9. Baseline de capabilities canônicas

As capabilities abaixo estão registradas na Permission Matrix Mobile.

| Capability | Canal documentado | Responsabilidade |
|---|---|---|
| `health.read` | Mobile, Web | leitura Health |
| `health.record_routine` | Mobile | peso, refeição e suplemento |
| `health.record_preventive` | Mobile, Web | vacinação e prevenção |
| `health.record_incident` | Mobile, Web | intercorrência que abre caso |
| `health.record_clinical_document` | Mobile, Web | transcrição clínica |
| `health.request_exam` | Mobile, Web | solicitação de exame |
| `health.interpret_exam` | Web | interpretação externa |
| `health.create_treatment` | Web | protocolo externo |
| `health.administer_dose` | Mobile | administração de dose |
| `health.issue_restriction` | Mobile, Web | registrar restrição externa |
| `health.release_restriction` | Mobile, Web | registrar liberação externa |
| `health.discharge_case` | Web | alta clínica |
| `health.reopen_case` | Web | reabrir caso discharged |
| `health.cancel_case` | Web | cancelar caso |
| `health.complete_treatment` | Web | concluir protocolo |
| `health.schedule_item` | Mobile, Web | criar item manual |
| `health.manage_schedule` | Web | editar/cancelar agenda |
| `health.cancel_record` | Mobile, Web | cancelar registro |
| `health.amend_record` | Mobile, Web | adicionar amendment |
| `health.manage_nutrition_plan` | Web | criar, atualizar, substituir e cancelar plano |
| `health.audit` | Web | consultar auditoria |

### 9.1 Observação obrigatória

A atribuição capability → perfil real permanece provisória onde o pacote Mobile assim determina.

Esta matriz não transforma “executor candidato” em permissão aprovada.

---

## 10. Envelope mínimo de comando

Operações canônicas deverão utilizar um envelope equivalente a:

```text
operationId
actor
dogId
entityId?
commandType
payload
effectiveAt?
professional?
sourceDocument?
reason?
clientContext
schemaVersion
```

### 10.1 Campos de contexto

`clientContext` pode conter:

- canal;
- versão do app;
- versão Web;
- timezone;
- device/session identifier sanitizado;
- modo online/offline;
- correlation id.

### 10.2 Proibição

O cliente não deve fornecer campos server-managed como autoridade:

- `created_at`;
- `updated_at`;
- projection flags;
- audit actor final;
- readiness status;
- counters;
- receipt status.

---

## 11. Pipeline padrão de uma mutação

```text
Usuário
→ UI Web ou Mobile
→ validação local de UX
→ command client
→ Backend
→ autenticação
→ capability
→ leitura da fonte canônica
→ validação de lifecycle
→ validação de evidência
→ idempotência
→ transação
→ fonte canônica
→ audit log
→ receipt
→ resposta ao cliente
→ Function
→ timeline/summary/agenda
```

### 11.1 Validação local

Ajuda a experiência.

Não é autoridade.

### 11.2 Resposta ao cliente

Deve distinguir:

- sucesso;
- replay idempotente;
- conflito;
- forbidden;
- validation error;
- not found;
- transient failure.

### 11.3 Projeção eventual

O cliente não deve esperar que toda projection esteja atualizada dentro da mesma resposta, salvo contrato explícito.

---

# Parte I — Matriz executiva

## 12. Matriz geral por agregado

| Agregado/Fonte | Mobile lê | Mobile cria/executa | Web lê | Web cria/administra | Backend valida/persiste | Function projeta | Admin SDK |
|---|---:|---:|---:|---:|---:|---:|---:|
| ClinicalCase | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ |
| ClinicalEvent | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ |
| Amendment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ |
| ExamProcess | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ |
| TreatmentProtocol | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ◐ |
| DoseAdministration | ✅ | ✅ | ✅ | ❌ padrão | ✅ | ✅ | ◐ |
| WeightAssessment | ✅ | ✅ | ✅ | ◐ | ✅ | ✅ | ◐ |
| NutritionPlan | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ◐ |
| MealLog | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ◐ |
| SupplementLog | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ◐ |
| HealthDocument | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ |
| OperationalRestriction | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ |
| VaccinationRecord | ✅ | ✅ | ✅ | ✅ conforme contrato | ✅ | ✅ | ◐ |
| HealthScheduleItem | ✅ | ✅ manual | ✅ | ✅ | ✅ | ✅ automático | ◐ |
| LegacyHealthRecord | ✅ read-only | ❌ | ✅ read-only | ❌ | ❌ cliente | ✅ leitura/projeção | ✅ |
| ReadinessSnapshot | ✅ | ❌ | ✅ | ❌ | ❌ cliente | ✅ | reconstrução |
| HealthTimeline | ✅ | ❌ | ✅ | ❌ | ❌ cliente | ✅ | reconstrução |

---

## 13. Matriz de funções sistêmicas

| Função | Mobile | Web | Backend | Function | Admin SDK |
|---|---:|---:|---:|---:|---:|
| autenticar usuário | inicia | inicia | valida token | — | — |
| verificar capability | UX preliminar | UX preliminar | autoridade | — | — |
| validar ProfessionalIdentity | UX | UX | autoridade | — | correção excepcional |
| validar lifecycle | UX | UX | autoridade | — | excepcional |
| gerar operationId | cliente/SDK | cliente/SDK | valida | — | gera em migração |
| persistir agregado | ❌ direto | ❌ direto | ✅ | somente server-managed | ✅ migração |
| persistir projection | ❌ | ❌ | ❌ comando comum | ✅ | ✅ reconstrução |
| registrar audit log | ❌ | ❌ | ✅ | ✅ quando projeta | ✅ |
| criar receipt | ❌ | ❌ | ✅ | — | ✅ migração |
| gerar URL de documento | solicita | solicita | autoriza | — | — |
| migrar legado | ❌ | ❌ | Function dedicada | possível | ✅ |
| calcular prontidão | ❌ | ❌ | serviço/Fn | ✅ | reconstrução |
| autorizar operação K9 | solicita | consulta | consulta restrictions | — | — |

---

# Parte II — Leituras

## 14. Leitura da Visão Geral

| Etapa | Responsável |
|---|---|
| iniciar consulta | Web |
| autenticar | Backend/Firestore |
| verificar `health.read` ou capability reconciliada | Backend/Rules |
| ler projections agregadas | Web/Server component conforme arquitetura |
| ler summary por K9 | Reader autorizado |
| avaliar partial/stale/conflict | Reader/UI |
| recalcular prontidão | proibido |
| auditar leitura comum | conforme política; não obrigatório por item |
| auditar exportação | Backend obrigatório |

### 14.1 Mobile

Pode ler summary individual e dados necessários à operação.

### 14.2 Web

É o canal principal para visão agregada do efetivo.

---

## 15. Leitura de Prontidão

### 15.1 Display

| Responsabilidade | Canal |
|---|---|
| solicitar snapshot | Mobile/Web |
| ler `health_summary/current` | reader |
| mostrar cinco estados | Mobile/Web |
| avaliar freshness | Mobile/Web |
| solicitar refresh | Mobile/Web |
| recalcular snapshot | Function |
| persistir snapshot | Function |

### 15.2 Autorização crítica

| Responsabilidade | Canal |
|---|---|
| iniciar turno/seleção | Mobile |
| solicitar autorização | Mobile → Backend |
| consultar restrições canônicas | Backend |
| aplicar fail-closed para restrição absoluta conhecida | Backend/Mobile cache |
| registrar aceite operacional offline | Mobile/Backend pós-reconexão |
| alterar restrição | proibido por aceite |

### 15.3 Web

A Web pode explicar prontidão e investigar fontes.

Ela não autoriza execução operacional apenas pelo summary.

---

## 16. Leitura de Histórico

| Etapa | Responsável |
|---|---|
| solicitar página | Mobile/Web |
| consultar timeline projection | reader |
| paginar | Backend/query |
| filtrar | query autorizada |
| abrir fonte | Mobile/Web |
| montar timeline a partir de N collections | proibido |
| reprojetar item | Function/Admin |
| auditar exportação | Backend |

---

## 17. Leitura de Legado

| Etapa | Responsável |
|---|---|
| consultar registro | Mobile/Web |
| identificar label legacy | UI |
| resolver normalized_view | reader |
| alterar original | proibido |
| vincular caso curado | Admin SDK |
| migrar | Migration Function/Admin |
| registrar batch | Backend/Admin |

---

# Parte III — Prontidão e restrições

## 18. Emitir restrição operacional

| Campo | Responsabilidade |
|---|---|
| Decisão clínica | profissional externo |
| Executor do registro | usuário interno |
| Canal | Mobile ou Web |
| Capability | `health.issue_restriction` |
| Evidência | professional + source_document obrigatórios |
| Inicia comando | Mobile/Web |
| Valida acesso | Backend |
| Valida evidência | Backend |
| Valida conflito/lifecycle | Backend |
| Persiste | Backend em `operational_restrictions` |
| Cria evento relacionado | Backend conforme contrato |
| Cria agenda de reavaliação | Function/Backend quando aplicável |
| Atualiza summary | Function |
| Atualiza timeline | Function |
| Audita | Backend |
| Receipt | recomendado/obrigatório no contrato final |
| Offline | draft/local possível; emissão canônica depende de reconciliação |
| Web pode decidir clinicamente | não |

### 18.1 Proibições

- criar restriction sem profissional;
- escrever readiness status;
- marcar K9 inapto apenas na UI;
- usar usuário interno como veterinário;
- editar restrição emitida silenciosamente.

---

## 19. Encerrar restrição

| Campo | Responsabilidade |
|---|---|
| Decisão de liberação | profissional externo quando clínica |
| Canal | Mobile ou Web |
| Capability | `health.release_restriction` |
| Evidência clínica | end_professional + end_source_document + end_reason |
| Encerramento administrativo | somente conforme contrato e motivo |
| Valida status active | Backend |
| Persiste actual_end/status | Backend |
| Atualiza summary | Function |
| Atualiza timeline | Function |
| Audita | Backend |
| Reabre atividade automaticamente | não; operações futuras consultam estado |
| Offline | não encerrar canonicamente sem validação |

---

## 20. Cancelar restrição por erro administrativo

Esta operação é diferente de liberação clínica.

| Responsabilidade | Canal |
|---|---|
| detectar erro | usuário interno |
| capability | deverá ser reconciliada com `health.cancel_record` |
| motivo obrigatório | cliente/Backend |
| validar ausência de uso incompatível | Backend |
| preservar documento | Backend |
| marcar cancelled | Backend |
| reprojetar summary/timeline | Function |
| auditar | Backend |

---

## 21. Recalcular ReadinessSnapshot

| Campo | Responsabilidade |
|---|---|
| Gatilho | alteração em fontes canônicas |
| Executa | Function |
| Consulta | restrictions, cases, schedule e demais fontes aprovadas |
| Aplica precedência | Function |
| Persiste | `health_summary/current` |
| Actor | sistema |
| Audita | log técnico/projection metadata |
| Mobile/Web podem chamar cálculo local | não |
| Rebuild | Function/Admin controlado |

---

## 22. Aceite operacional offline

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile |
| Situação | snapshot ausente ou > janela configurada |
| Condição | último estado conhecido não é temporarily_unfit |
| Ação | registrar aceite operacional |
| Natureza | rastreabilidade de incerteza |
| Altera prontidão | não |
| Altera restrição | não |
| Persiste online | Backend |
| Persiste offline | fila local segura |
| Reconcilia | Mobile/Backend |
| Audita | Backend |
| Web | apenas consulta posterior |

---

# Parte IV — Agenda

## 23. Criar item manual

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile ou Web |
| Capability | `health.schedule_item` |
| Executor | usuário interno |
| Validação local | canal |
| Validação presente/futuro | Backend |
| Validação timezone/tipo | Backend |
| Persiste lifecycle open | Backend |
| Calcula estado temporal | reader |
| Timeline | normalmente não, conforme contrato |
| Audita | Backend |
| Receipt | recomendado |
| Offline Mobile | fila conforme contrato |
| Web offline | não prioritário |

---

## 24. Criar item automático

| Campo | Responsabilidade |
|---|---|
| Origem | protocolo, exame, vacina, caso ou prevenção |
| Inicia | Function/Backend |
| Usuário interno | não necessário |
| Source reference | obrigatória |
| Idempotência | determinística |
| Persiste | Function |
| Audita | sistema |
| Mobile/Web | somente leitura/gestão autorizada |

---

## 25. Reagendar item

| Campo | Responsabilidade |
|---|---|
| Canal principal | Web |
| Capability | `health.manage_schedule` |
| Item elegível | open |
| Valida origem automática | Backend |
| Preserva histórico | Backend/audit |
| Persiste nova data | Backend |
| Estado temporal | derivado |
| Atualiza timeline | conforme contrato |
| Mobile | possível apenas se capability/canal aprovados |
| Offline | não prioritário |

---

## 26. Cancelar item

| Campo | Responsabilidade |
|---|---|
| Canal principal | Web |
| Capability | `health.manage_schedule` |
| Motivo | obrigatório |
| Valida lifecycle | Backend |
| Persiste cancelled | Backend |
| Cancela fato executado | não |
| Altera prontidão diretamente | não |
| Audita | Backend |
| Projection | Function |

---

## 27. Concluir item

A conclusão deve ser definida por tipo.

| Tipo | Canal preferencial | Fato vinculado |
|---|---|---|
| dose | Mobile | DoseAdministration |
| vacinação | Mobile/Web conforme contrato | VaccinationRecord |
| pesagem | Mobile; Web pendente | WeightAssessment |
| consulta | Web/Mobile transcrição | ClinicalEvent |
| exame | Web/Mobile conforme etapa | ExamProcess |
| reavaliação | Web/Mobile conforme decisão | ClinicalEvent/Restriction |
| refeição | Mobile | MealLog |
| suplemento | Mobile | SupplementLog |

### 27.1 Regra

Um item não deve ser marcado completed antes de:

- persistir o fato;
- ou registrar conclusão administrativa permitida.

---

# Parte V — Casos clínicos

## 28. Abrir caso por intercorrência

| Campo | Responsabilidade |
|---|---|
| Observação | condutor/usuário interno |
| Canal | Mobile ou Web |
| Capability | `health.record_incident` |
| ProfessionalIdentity | não obrigatória para observação direta |
| Cria ClinicalCase | Backend |
| Cria ClinicalEvent incident | Backend |
| Transação única | recomendada/obrigatória |
| Persiste | Backend |
| Agenda | Function se houver ação futura |
| Timeline | Function |
| Summary | Function se impacto |
| Audita | Backend |
| Receipt | recomendado |
| Offline | Mobile pode enfileirar conforme contrato |

---

## 29. Abrir caso por consulta externa

| Campo | Responsabilidade |
|---|---|
| Decisão/atendimento | profissional externo |
| Registrador | usuário interno |
| Canal | Mobile ou Web |
| Capability | `health.record_clinical_document` |
| ProfessionalIdentity | obrigatória |
| Source document | recomendado/obrigatório conforme ação |
| Cria caso e evento | Backend |
| Data efetiva | informada e validada |
| Data de registro | server timestamp |
| Timeline | Function |
| Audita | Backend |

---

## 30. Registrar evento clínico draft

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile/Web |
| Capability | conforme tipo |
| Estado | draft |
| Pode editar | sim, dentro das regras |
| Timeline principal | não |
| Summary | não, salvo política explícita |
| Audita | Backend |
| Offline | possível localmente conforme contrato |

---

## 31. Finalizar evento clínico

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile/Web |
| Capability | conforme tipo |
| Valida payload versionado | Backend |
| Valida ProfessionalIdentity | Backend |
| Valida documentos | Backend |
| Transição | draft → final |
| Imutabilidade | começa após commit |
| Timeline | Function |
| Summary | Function quando relevante |
| Audita | Backend |
| Receipt | recomendado |

---

## 32. Cancelar registro clínico

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile/Web |
| Capability | `health.cancel_record` |
| Motivo | obrigatório |
| Próprio draft/admin | conforme Permission Matrix |
| Hard delete | proibido |
| Persiste cancelled | Backend |
| Timeline | Function |
| Audita | Backend |

---

## 33. Adicionar amendment

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile/Web |
| Capability | `health.amend_record` |
| Tipo | correction/addendum/complement |
| Motivo | obrigatório |
| Original | permanece imutável |
| Persiste | subcollection create-only |
| Atualiza metadados | Function |
| Timeline | Function marca has_amendments |
| Status original amended | proibido |
| Audita | Backend |

---

## 34. Registrar alta clínica

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.discharge_case` |
| Decisão externa | ProfessionalIdentity + source_document obrigatórios |
| Valida estado | Backend |
| Cria evento discharge | Backend |
| Atualiza caso | Backend em transação |
| Fecha restrição automaticamente | não, salvo comando relacionado explícito |
| Summary | Function |
| Timeline | Function |
| Audita | Backend |

---

## 35. Reabrir caso

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.reopen_case` |
| Estado de origem | discharged |
| Destino | open/under_investigation/under_treatment/monitoring |
| Motivo | obrigatório |
| Evidência | profissional/documento quando aplicável |
| Cria evento reopen | Backend |
| Atualiza caso | Backend |
| Caso cancelled | não pode reabrir |
| Audita | Backend |
| Timeline | Function |

---

## 36. Cancelar caso

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.cancel_case` |
| Natureza | administrativa |
| Motivo | obrigatório |
| Preserva histórico | sim |
| Reabertura | proibida |
| Persiste | Backend |
| Timeline/Summary | Function |
| Audita | Backend |

---

# Parte VI — Exames

## 37. Solicitar exame

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile ou Web |
| Capability | `health.request_exam` |
| Profissional | recomendado conforme Permission Matrix |
| Caso | obrigatório |
| Cria ExamProcess | Backend |
| Cria evento exam_request | Backend |
| Agenda coleta | Function/Backend |
| Timeline | Function |
| Audita | Backend |

---

## 38. Registrar coleta

| Campo | Responsabilidade |
|---|---|
| Execução física | profissional/equipe responsável |
| Registrador | usuário interno |
| Canal | Mobile preferencial; Web transcrição possível |
| Capability | deverá ser reconciliada |
| Valida estágio requested | Backend |
| Persiste collected | Backend |
| Documento | opcional |
| Timeline | Function |
| Audita | Backend |

---

## 39. Registrar resultado

| Campo | Responsabilidade |
|---|---|
| Resultado produzido | laboratório/profissional externo |
| Upload/transcrição | Mobile/Web |
| HealthDocument | obrigatório conforme tipo |
| Valida estágio | Backend |
| Atualiza ExamProcess | Backend |
| Interpreta resultado | não |
| Timeline | Function |
| Audita | Backend |

---

## 40. Registrar interpretação

| Campo | Responsabilidade |
|---|---|
| Decisão | profissional externo |
| Canal | Web |
| Capability | `health.interpret_exam` |
| ProfessionalIdentity | obrigatória |
| Source document | obrigatório |
| Valida estágio resulted | Backend |
| Persiste interpretação | Backend |
| Atualiza prontidão diretamente | não |
| Pode gerar restriction separada | sim, comando próprio |
| Timeline | Function |
| Audita | Backend |

---

## 41. Avaliar impacto operacional

| Campo | Responsabilidade |
|---|---|
| Decisão | profissional externo |
| Registro | Web/Mobile conforme contrato |
| Valida exame interpreted | Backend |
| Persiste impact_assessed | Backend |
| Cria restrição | comando explícito |
| Summary | Function |
| Timeline | Function |
| Audita | Backend |

---

# Parte VII — Tratamentos e doses

## 42. Criar protocolo de tratamento

| Campo | Responsabilidade |
|---|---|
| Prescrição | profissional externo |
| Canal | Web |
| Capability | `health.create_treatment` |
| ProfessionalIdentity | obrigatória |
| Source document | obrigatório |
| Dose/schedule estruturados | Web envia; Backend valida |
| Caso | obrigatório |
| Persiste protocolo | Backend |
| Cria itens de dose | Function |
| Cria evento treatment_start | Backend/Function conforme contrato |
| Timeline | Function |
| Summary | Function |
| Audita | Backend |
| Mobile | leitura e execução |

---

## 43. Pausar tratamento

| Campo | Responsabilidade |
|---|---|
| Decisão | profissional externo quando clínica |
| Canal | Web |
| Capability | deverá ser reconciliada com gestão de tratamento |
| Motivo | obrigatório |
| Evidência | conforme natureza |
| Valida active | Backend |
| Cancela agenda futura | Function/Backend |
| Persiste paused | Backend |
| Timeline | Function |
| Audita | Backend |

---

## 44. Retomar tratamento

| Campo | Responsabilidade |
|---|---|
| Decisão | profissional externo quando clínica |
| Canal | Web |
| Capability | gestão de tratamento |
| Valida paused | Backend |
| Recria agenda | Function |
| Persiste active | Backend |
| Timeline | Function |
| Audita | Backend |

---

## 45. Administrar dose

| Campo | Responsabilidade |
|---|---|
| Execução física | condutor/usuário autorizado |
| Canal | Mobile |
| Capability | `health.administer_dose` |
| Protocolo ativo | Backend valida |
| Ocorrência | identificada |
| Idempotência | obrigatória |
| Persiste DoseAdministration | Backend |
| Atualiza próxima dose | Function |
| Atualiza contagens | Function |
| Timeline | Function |
| Audita | Backend |
| Web | somente leitura |
| Offline | fila idempotente Mobile |

---

## 46. Marcar dose omitida

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile |
| Capability | `health.administer_dose` ou contrato específico |
| Motivo | recomendado/obrigatório conforme política |
| Valida occurrence | Backend |
| Persiste skipped | Backend |
| Reagenda | somente se regra explícita |
| Timeline | Function |
| Audita | Backend |

---

## 47. Concluir tratamento

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.complete_treatment` |
| ProfessionalIdentity | recomendada; obrigatória quando decisão externa exigir |
| Valida active/paused | Backend |
| Persiste completed | Backend |
| Cancela agenda aberta | Function/Backend |
| Transição do caso | monitoring conforme contrato |
| Timeline | Function |
| Summary | Function |
| Audita | Backend |

---

## 48. Cancelar tratamento

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | gestão/cancel_record reconciliada |
| Motivo | obrigatório |
| Evidência | conforme natureza |
| Persiste cancelled | Backend |
| Agenda futura | cancela |
| Doses passadas | preserva |
| Timeline/Summary | Function |
| Audita | Backend |

---

# Parte VIII — Peso

## 49. Registrar pesagem no Mobile

| Campo | Responsabilidade |
|---|---|
| Execução física | usuário interno |
| Canal | Mobile |
| Capability | `health.record_routine` |
| Data efetiva | Mobile envia |
| Validação | Backend |
| Persiste WeightAssessment | Backend |
| Timeline | Function |
| Summary | Function |
| Agenda próxima | Function conforme regra |
| Audita | Backend |
| Offline | fila possível |

---

## 50. Registrar pesagem na Web

| Campo | Estado |
|---|---|
| Canal | pendente de decisão humana |
| Modalidade possível | medição presencial ou transcrição |
| Capability | não definida definitivamente |
| Evidência | depende da modalidade |
| Persistência direta | proibida |
| Decisão necessária | sim |

### 50.1 Regra enquanto pendente

A Web lê peso, mas não deve receber formulário definitivo.

---

## 51. Corrigir pesagem

| Campo | Responsabilidade |
|---|---|
| Edição direta | proibida |
| Correção | amendment ou comando específico |
| Canal | Mobile/Web conforme capability |
| Motivo | obrigatório |
| Backend | preserva original |
| Timeline | mostra correção |
| Summary | reprojeta |
| Audita | Backend |

---

# Parte IX — Nutrição

## 52. Criar e ativar plano alimentar

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.manage_nutrition_plan` |
| Mobile | proibido |
| operationId | obrigatório no contrato implementado |
| ProfessionalIdentity | recomendada/conforme origem |
| Valida plano ativo | Backend |
| Persiste NutritionPlan | callable |
| Receipt | durável |
| Timeline | Function |
| Summary | Function |
| Audita | Backend |
| Conflito múltiplos ativos | fail-closed |

---

## 53. Atualizar plano ativo

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.manage_nutrition_plan` |
| Tipo de mudança | administrativa |
| Mantém planId | sim |
| Revision/version | Backend |
| operationId | obrigatório |
| Persiste | callable |
| Receipt | durável |
| Mobile | recebe atualização |
| Audita | Backend |

---

## 54. Substituir plano

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.manage_nutrition_plan` |
| Tipo de mudança | estrutural |
| Novo planId | obrigatório |
| Plano anterior | superseded |
| Transação | Backend |
| operationId | obrigatório |
| Receipt | durável |
| Timeline/Summary | Function |
| Audita | Backend |

---

## 55. Cancelar plano

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.manage_nutrition_plan` |
| Motivo | conforme contrato |
| Status | cancelled |
| Histórico | preservado |
| operationId | obrigatório |
| Receipt | durável |
| Mobile | deixa de executar plano |
| Timeline/Summary | Function |
| Audita | Backend |

---

## 56. Registrar refeição

| Campo | Responsabilidade |
|---|---|
| Execução física | condutor |
| Canal | Mobile |
| Capability | `health.record_routine` |
| Web | proibido como fluxo padrão |
| meal_occurrence_id | obrigatório |
| Dedupe | Backend |
| Persiste MealLog | Backend |
| Plano relacionado | validado |
| Timeline | Function |
| Audita | Backend |
| Offline | fila idempotente |

---

## 57. Registrar suplemento

| Campo | Responsabilidade |
|---|---|
| Execução física | condutor |
| Canal | Mobile |
| Capability | `health.record_routine` |
| Web | proibido como fluxo padrão |
| Persiste SupplementLog | Backend |
| Valida plano/protocolo quando aplicável | Backend |
| Timeline | Function |
| Audita | Backend |
| Offline | fila conforme contrato |

---

# Parte X — Vacinação e prevenção

## 58. Registrar aplicação interna

| Campo | Responsabilidade |
|---|---|
| Execução física | usuário autorizado |
| Canal | Mobile ou Web conforme Permission Matrix |
| Capability | `health.record_preventive` |
| ProfessionalIdentity externa | null quando não houve profissional externo |
| Source document externo | null quando não houve |
| recorded_by | obrigatório |
| Persiste VaccinationRecord | Backend |
| Cria próxima agenda | Function |
| Timeline | Function |
| Summary | Function |
| Audita | Backend |

---

## 59. Transcrever aplicação externa

| Campo | Responsabilidade |
|---|---|
| Aplicação | profissional externo |
| Registrador | usuário interno |
| Canal | Mobile ou Web |
| Capability | `health.record_preventive` |
| ProfessionalIdentity | obrigatória |
| Source document | obrigatório conforme contrato |
| Persiste | Backend |
| Agenda próxima | Function |
| Timeline/Summary | Function |
| Audita | Backend |

---

## 60. Cancelar VaccinationRecord

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile/Web |
| Capability | `health.cancel_record` |
| Motivo | obrigatório |
| Hard delete | proibido |
| Próxima agenda | reconciliada |
| Summary | reprojeta |
| Timeline | mantém cancelamento |
| Audita | Backend |

---

## 61. Registrar vermifugação

A Permission Matrix inclui vermifugação em `health.record_preventive`.

O agregado canônico específico deverá ser confirmado no schema/roadmap antes de implementação Web.

Enquanto não houver agregado aprovado:

- não criar collection improvisada;
- não usar generic health event como autoridade;
- manter ação fora do mockup definitivo;
- registrar a lacuna documental.

---

# Parte XI — Documentos

## 62. Upload de documento

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile ou Web |
| Capability | `health.record_clinical_document` ou gestão documental reconciliada |
| Valida tipo/tamanho | cliente + Backend |
| Gera destino | Backend |
| Faz upload | cliente para Storage autorizado |
| Confirma metadata | Backend |
| Persiste HealthDocument | Backend |
| storage_path | autoridade |
| storage_url | temporária/cache |
| Timeline | Function quando relevante |
| Audita | Backend |
| Falha após upload | rotina de compensação/reconciliação |

---

## 63. Vincular documento

| Campo | Responsabilidade |
|---|---|
| Canal | Mobile/Web |
| Entidade alvo | caso/evento/exame/tratamento/restrição/vacina |
| Valida acesso a ambos | Backend |
| Persiste referência por ID | Backend |
| Copiar URL inline | proibido |
| Audita | Backend |

---

## 64. Gerar acesso temporário

| Campo | Responsabilidade |
|---|---|
| Solicita | Mobile/Web |
| Verifica capability | Backend |
| Gera URL | Backend/Storage |
| Validade | curta/configurada |
| Persiste como identidade | não |
| Loga conteúdo sensível | não |
| Audita download sensível | conforme política |

---

# Parte XII — Timeline, summary, relatórios e auditoria

## 65. Projetar timeline

| Campo | Responsabilidade |
|---|---|
| Gatilho | alteração canônica |
| Executa | Function |
| ID | determinístico |
| Fonte | source collection/id |
| Drafts | excluídos |
| Amendments | metadados |
| Persiste | health_timeline |
| Cliente escreve | não |
| Rebuild | Admin/Function |
| Audita | metadado técnico |

---

## 66. Projetar summary

| Campo | Responsabilidade |
|---|---|
| Gatilho | alteração relevante |
| Executa | Function |
| Precedência | política canônica |
| Restrições | fonte primária |
| Dados incompletos | regra canônica |
| Persiste | health_summary/current |
| Cliente escreve | não |
| Web calcula | não |
| Mobile calcula | não |
| Rebuild | Admin/Function |

---

## 67. Gerar relatório

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | a reconciliar; `health.audit` não deve ser usado automaticamente para todo relatório |
| Filtros | Web envia |
| Valida escopo | Backend |
| Consulta | projections/read models |
| Gera arquivo | Backend quando sensível/volumoso |
| Registra filtros | Backend |
| Audita exportação | Backend |
| Mobile | não prioritário |
| Relatório altera domínio | não |

---

## 68. Consultar auditoria

| Campo | Responsabilidade |
|---|---|
| Canal | Web |
| Capability | `health.audit` |
| Fonte | audit log server-side |
| Filtra | Backend/query |
| Exibe PII mínima | Web |
| Alterar log | proibido |
| Exportar | capability adicional futura |
| Mobile | não prioritário |

---

# Parte XIII — Migração e reconciliação

## 69. Migrar registro legado

| Campo | Responsabilidade |
|---|---|
| Canal | Migration Function/Admin SDK |
| Mobile/Web | não |
| Lê origem | migração |
| Calcula checksum | migração |
| Cria LegacyHealthRecord | migração |
| Cria agregado canônico | apenas quando classificação segura |
| Preserva original_payload | sim |
| Registra batch | sim |
| Audita | sim |
| Reexecutável | sim/idempotente |
| Excluir origem | não durante coexistência |

---

## 70. Reconciliar conflito

| Campo | Responsabilidade |
|---|---|
| Detecta | reader/Function |
| Exibe | Web |
| Resolve automaticamente | somente regra aprovada |
| Resolve manualmente | ferramenta administrativa futura |
| Persiste decisão | Backend/Admin |
| Preserva fontes | sim |
| Audita | obrigatório |
| Mobile | leitura de resultado |

---

## 71. Reconstruir projections

| Campo | Responsabilidade |
|---|---|
| Inicia | operação administrativa |
| Canal | Function/Admin |
| Mobile/Web comuns | não |
| Fonte | agregados canônicos |
| Apaga e recria | somente projection |
| Preserva source | sim |
| Registra versão | sim |
| Audita | sim |

---

# Parte XIV — Offline

## 72. Classificação offline por operação

| Operação | Mobile offline | Web offline |
|---|---|---|
| leitura cached summary | ✅ | não prioritário |
| início de turno | ✅ conforme política | não aplicável |
| aceite operacional | ✅ | não |
| registrar incidente | ◐ fila | não |
| registrar peso | ◐ fila | não |
| registrar refeição | ✅ fila idempotente | não |
| registrar suplemento | ◐ fila | não |
| administrar dose | ✅ fila idempotente | não |
| upload de documento | ◐ fila/retomada | não |
| criar agenda | ◐ | não |
| emitir restrição | ◐ draft; validação online necessária | não |
| encerrar restrição | não recomendado | não |
| criar tratamento | não | não |
| criar plano alimentar | não | não |
| substituir plano | não | não |
| discharge/reopen case | não | não |
| relatório/auditoria | não | não |

### 72.1 Regra

Operação offline não reduz validações Backend.

Ela apenas posterga a confirmação canônica.

### 72.2 Conflito pós-reconexão

O Backend pode rejeitar a fila por:

- entidade alterada;
- protocolo encerrado;
- occurrence já registrada;
- capability removida;
- restriction criada;
- data inválida.

O Mobile deverá exibir reconciliação, não sucesso falso.

---

# Parte XV — Idempotência e receipts

## 73. Operações que exigem idempotência forte

- criar/substituir/cancelar NutritionPlan;
- MealLog por ocorrência;
- DoseAdministration por ocorrência;
- SupplementLog quando houver ocorrência determinística;
- conclusão de agenda ligada a fato;
- abertura composta caso + evento;
- upload metadata;
- migração;
- criação automática de agenda;
- projection;
- replay offline.

---

## 74. Estrutura conceitual do receipt

```text
operation_id
command_type
entity_type
entity_id
dog_id
actor_uid
status
created_at
completed_at
request_hash
result_version
replayed
error_code?
correlation_id
```

### 74.1 Status possíveis

O contrato final pode usar nomenclatura própria, mas deve distinguir:

- accepted;
- completed;
- replayed;
- rejected;
- conflicted;
- failed.

### 74.2 Segurança

Receipt não deve armazenar payload clínico integral desnecessário.

---

## 75. Replay

Quando o mesmo `operationId` e mesmo request hash chegam novamente:

- retornar o resultado existente;
- não duplicar fatos;
- marcar replay;
- não repetir efeitos.

Quando o `operationId` é igual e o payload diverge:

- conflict;
- não executar;
- auditar tentativa.

---

# Parte XVI — Erros e respostas

## 76. Taxonomia mínima

| Código conceitual | Significado |
|---|---|
| `UNAUTHENTICATED` | sessão inválida |
| `FORBIDDEN` | capability ausente |
| `NOT_FOUND` | entidade inexistente |
| `VALIDATION_ERROR` | payload inválido |
| `INVALID_TRANSITION` | lifecycle incompatível |
| `EVIDENCE_REQUIRED` | profissional/documento ausente |
| `CONFLICT` | estado concorrente |
| `IDEMPOTENCY_CONFLICT` | operationId reutilizado com payload diferente |
| `STALE_VERSION` | revisão antiga |
| `SOURCE_UNAVAILABLE` | dependência indisponível |
| `PROJECTION_PENDING` | fonte salva, projection ainda atualizando |
| `LEGACY_READ_ONLY` | tentativa de alterar legado |
| `INTERNAL` | falha inesperada |

### 76.1 UI

Web e Mobile deverão mapear códigos para mensagens específicas.

Não deverão mostrar somente:

```text
Algo deu errado
```

quando o Backend forneceu causa segura.

---

# Parte XVII — Auditoria

## 77. Operações obrigatoriamente auditadas

- criação e mudança de caso;
- evento clínico;
- amendment;
- exame;
- tratamento;
- dose;
- restrição;
- agenda;
- plano alimentar;
- refeição e suplemento;
- vacinação;
- documento;
- cancelamentos;
- reabertura;
- exportação;
- acesso sensível conforme política;
- migração;
- reconciliação;
- aceite operacional offline;
- replay idempotente relevante.

---

## 78. Conteúdo mínimo do log

- action;
- domain;
- entity type;
- entity id;
- dog id;
- actor;
- channel;
- timestamp server-side;
- operationId;
- correlation id;
- result;
- reason;
- evidence references;
- before/after permitido;
- client version;
- migration batch quando aplicável.

### 78.1 Conteúdo proibido

- token;
- senha;
- arquivo;
- URL temporária;
- payload clínico integral sem necessidade;
- dados pessoais excessivos;
- secrets de infraestrutura.

---

# Parte XVIII — Observabilidade

## 79. Correlação

Toda cadeia crítica deverá permitir correlação:

```text
client command
→ callable
→ transaction
→ audit
→ receipt
→ projection
```

### 79.1 Identificadores

- operationId;
- correlationId;
- entityId;
- sourceId;
- projectionId;
- auditId.

### 79.2 Métricas

- taxa de sucesso;
- rejeição por capability;
- invalid transition;
- replay;
- conflict;
- latency;
- projection lag;
- stale summaries;
- failed migrations;
- upload orphan.

---

# Parte XIX — Segurança

## 80. Regras transversais

1. UI verifica capability para experiência.
2. Backend verifica capability para autoridade.
3. Rules impedem acesso direto incompatível.
4. Callable não confia em role enviada pelo cliente.
5. ProfessionalIdentity é validada como dado, não como usuário autenticado.
6. Source document é validado por ID e acesso.
7. Cliente não define `recorded_by` livremente.
8. Server timestamp é autoridade.
9. Write em projection é negado.
10. Write em legacy é negado.
11. Exportação é autorizada separadamente.
12. Auditoria é read-only.
13. Admin SDK não é exposto ao cliente.
14. Storage path segue escopo do K9.
15. URLs temporárias expiram.

---

# Parte XX — Matriz de proibições

## 81. Mobile não deve

- criar NutritionPlan;
- substituir NutritionPlan;
- calcular readiness oficial;
- editar ClinicalEvent final;
- escrever summary/timeline;
- migrar legado;
- criar protocolo clínico como decisão própria;
- encerrar restrição sem evidência;
- usar aceite offline como liberação.

---

## 82. Web não deve

- registrar MealLog como fluxo padrão;
- registrar SupplementLog como fluxo padrão;
- administrar DoseAdministration como fluxo padrão;
- calcular readiness;
- escrever `_last_*`;
- montar timeline com N listeners;
- editar evento final;
- escolher plano ativo em conflito;
- usar health_logs como fonte canônica;
- executar migração no browser;
- inventar ProfessionalIdentity;
- aplicar fallback de capability.

---

## 83. Backend comum não deve

- aceitar payload sem capability;
- aceitar lifecycle inválido;
- escrever sem audit;
- sobrescrever fato final;
- confiar em projection para ação crítica;
- executar replay duplicado;
- apagar histórico;
- converter legado silenciosamente;
- devolver sucesso antes do commit canônico.

---

## 84. Function não deve

- tomar decisão clínica;
- criar restrição sem fonte;
- alterar evento original;
- usar regra diferente da política canônica;
- projetar draft na timeline principal;
- esconder conflito;
- usar timestamp local inconsistente.

---

# Parte XXI — Testes derivados

## 85. Testes de canal

Para cada comando:

- canal permitido;
- canal proibido;
- capability presente;
- capability ausente;
- executor candidato não tratado como aprovado;
- profissional externo separado;
- registered_by server-managed.

---

## 86. Testes de pipeline

- autenticação;
- leitura canônica;
- validação;
- transação;
- auditoria;
- receipt;
- projection;
- resposta;
- retry;
- replay;
- conflito.

---

## 87. Testes Web × Mobile

1. Web cria plano → Mobile lê.
2. Web substitui plano → Mobile deixa de usar anterior.
3. Mobile registra refeição → Web exibe.
4. Mobile registra dose → Web atualiza tratamento.
5. Web cria tratamento → Mobile recebe agenda.
6. Mobile registra peso → Web atualiza tendência.
7. Web emite restrição → Mobile bloqueia ação crítica.
8. Mobile registra incidente → Web exibe caso.
9. Web adiciona amendment → Mobile vê correção.
10. Mobile envia offline → Backend deduplica após reconexão.

---

## 88. Testes de prontidão

- restriction absoluta ativa + summary antigo;
- summary missing;
- summary stale;
- offline ≤ janela;
- offline > janela;
- temporarily_unfit em cache;
- aceite operacional;
- reconciliação;
- alteração durante offline;
- projection lag.

---

## 89. Testes de evidência

- professional ausente;
- registration inválido;
- source document ausente;
- documento sem acesso;
- ação interna sem profissional externo;
- usuário interno tentando se declarar profissional;
- liberação clínica sem end evidence;
- cancelamento administrativo sem inventar laudo.

---

## 90. Testes de imutabilidade

- editar evento final;
- editar dose;
- editar MealLog;
- editar VaccinationRecord final;
- amendment válido;
- amendment inválido;
- cancelamento;
- original preservado;
- timeline refletindo amendment.

---

# Parte XXII — Decisões fixadas

## 91. Decisões

1. Web é gestão e administração.
2. Mobile é execução operacional prioritária.
3. Backend valida e persiste.
4. Functions projetam.
5. Admin SDK migra.
6. Profissional externo decide clinicamente.
7. Usuário interno registra.
8. ProfessionalIdentity e RecordedBy são distintos.
9. Prontidão é calculada server-side.
10. Restrição canônica autoriza ação crítica.
11. Summary serve para display.
12. Agenda é planejamento.
13. Execução produz fato próprio.
14. ClinicalEvent final é imutável.
15. Amendments são append-only.
16. TreatmentProtocol é criado pela Web.
17. Dose é executada pelo Mobile.
18. NutritionPlan é gerido pela Web.
19. MealLog e SupplementLog são Mobile.
20. WeightAssessment é Mobile no contrato atual; Web permanece pendente.
21. Vacinação pode ser Mobile/Web conforme Permission Matrix e modalidade.
22. Documents podem ser Mobile/Web.
23. Legacy é read-only para clientes.
24. Timeline e summary não recebem write de cliente.
25. Toda mutação relevante é auditada.
26. Idempotência é obrigatória nas operações críticas.
27. UI não amplia capability.
28. Offline posterga confirmação, não reduz regra.
29. Receipt não substitui entidade canônica.
30. Projection lag é comunicado.

---

# Parte XXIII — Decisões humanas pendentes

## 92. Canais Web

- registrar peso;
- registrar coleta de exame;
- registrar resultado;
- registrar aplicação preventiva por tipo;
- concluir agenda por tipo;
- transcrever dose;
- registrar observação de rotina.

## 93. Capabilities

- atribuição final a perfis;
- capabilities adicionais de relatório/exportação;
- gestão de documentos;
- pause/resume/cancel treatment;
- coleta/resultado de exame;
- registro Web de peso;
- dados sensíveis;
- reconciliação.

## 94. Offline

- quais comandos entram na fila;
- limite de tentativas;
- retenção local;
- conflito manual;
- threshold final de snapshot;
- responsável pelo aceite.

## 95. Receipts

- collections;
- retenção;
- campos;
- exposição ao cliente;
- limpeza;
- políticas por comando.

## 96. Auditoria

- collection/path;
- integração com auditoria geral;
- retenção;
- exportação;
- acesso por perfil;
- conteúdo before/after.

---

# Parte XXIV — Gates

## 97. Gate MMB-1 — Capabilities

Reconciliar capabilities documentadas com implementação real.

## 98. Gate MMB-2 — Command catalog

Criar catálogo definitivo de callables/comandos.

## 99. Gate MMB-3 — Write channels

Aprovar canais pendentes.

## 100. Gate MMB-4 — Evidence

Definir evidência por operação.

## 101. Gate MMB-5 — Idempotency

Definir operationId e receipts.

## 102. Gate MMB-6 — Offline

Aprovar fila e reconciliação.

## 103. Gate MMB-7 — Projection SLA

Definir freshness e lag.

## 104. Gate MMB-8 — Audit

Aprovar contrato de auditoria.

## 105. Gate MMB-9 — Rules

Confirmar que Rules impedem writes diretos.

## 106. Gate MMB-10 — Aprovação humana

Nenhuma responsabilidade pendente deve virar botão definitivo antes da aprovação.

---

## 107. Critérios de aprovação

Este documento estará aprovado quando:

- cada operação tiver um canal principal;
- o executor físico estiver identificado;
- ProfessionalIdentity estiver separado de RecordedBy;
- Backend for autoridade de write;
- projections forem read-only;
- actions críticas consultarem restrictions;
- agenda e execução estiverem separadas;
- Nutrição preservar o contrato pós-Foundation;
- Mobile não administrar planos;
- Web não registrar rotina de campo indevidamente;
- idempotência estiver definida;
- auditoria estiver definida;
- offline não reduzir segurança;
- capabilities provisórias continuarem marcadas;
- writes Web pendentes estiverem resolvidos ou explicitamente adiados.

---

## 108. Documentos derivados

Esta matriz alimenta:

- `HEALTH_WEB_CAPABILITIES_INVENTORY.md`;
- `HEALTH_WEB_PERMISSION_MATRIX.md`;
- `HEALTH_WEB_READINESS_POLICY.md`;
- `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`;
- `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`;
- `HEALTH_WEB_TEST_STRATEGY.md`;
- ADR de fronteiras Web × Mobile;
- catálogo de comandos Backend.

---

## 109. Próximo documento recomendado

O próximo documento deverá ser:

```text
docs/health/web/foundation/HEALTH_WEB_CAPABILITIES_INVENTORY.md
```

Ele deverá:

- inventariar as capabilities já existentes no Web;
- comparar com a Permission Matrix Mobile;
- identificar capabilities implantadas, documentadas e ausentes;
- classificar fallbacks indevidos;
- definir o catálogo-alvo;
- separar leitura, gestão, execução, exportação e auditoria;
- preparar a Permission Matrix Web.

---

## 110. Status

| Item | Estado |
|---|---|
| Responsabilidades Mobile | Documentadas |
| Responsabilidades Web | Documentadas e pendências marcadas |
| Responsabilidades Backend | Documentadas |
| Projections | Documentadas |
| Admin/migração | Documentados |
| Capabilities canônicas | Incorporadas |
| Idempotência | Política definida; contrato detalhado pendente |
| Offline | Política incorporada |
| Auditoria | Requisitos definidos |
| Atribuição por perfil | Pendente |
| Aprovação humana | Pendente |
| Aprovação para implementação | Não concedida |

---

## 111. Conclusão

A fronteira Health v1 passa a ser explícita:

```text
profissional externo decide
→ usuário interno registra
→ Web ou Mobile inicia
→ Backend valida e persiste
→ Function projeta
→ sistema audita
```

A divisão não é determinada pelo tamanho da tela nem pela facilidade de implementação.

Ela é determinada pela natureza da ação:

- gestão;
- execução;
- transcrição;
- validação;
- projeção;
- auditoria.

A Web poderá concentrar o controle gerencial sem se transformar em um terminal genérico de execução.

O Mobile poderá continuar rápido no campo sem assumir administração de contratos.

O Backend permanecerá como autoridade capaz de impedir divergências entre os canais.
