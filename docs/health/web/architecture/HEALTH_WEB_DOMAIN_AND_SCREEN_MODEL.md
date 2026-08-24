# K9 Ops Web — Health Web v1 Domain and Screen Model

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Modelo de domínio aplicado às telas Web |
| Repositório | `github.com/jillohh-arch/k9-ops` |
| Baseline | `HEALTH_WEB_BASELINE.md` |
| Arquitetura-alvo | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Arquitetura da informação | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` |
| Autoridade de domínio | Health v1.0 Mobile/Backend aprovado |
| Fora de escopo | Implementação, alteração de schema, merge, deploy e migração real |

---

## 1. Propósito

Este documento formaliza a relação entre:

```text
domínio
→ agregado
→ lifecycle
→ fato
→ projeção
→ tela
→ ação
→ plataforma
→ capability
```

Ele existe para impedir que o Health Web v1 seja construído a partir de:

- telas antigas;
- collections descobertas durante a implementação;
- formulários genéricos;
- conveniência visual;
- regras calculadas no cliente;
- duplicação do Mobile;
- inferências não aprovadas;
- nomes de componentes;
- necessidades momentâneas de mockup.

O objetivo é definir, para cada parte do domínio Health:

1. qual entidade possui autoridade;
2. qual é seu ciclo de vida;
3. quais fatos são imutáveis;
4. quais dados são derivados;
5. quais telas podem exibi-la;
6. quais telas podem iniciar comandos;
7. qual plataforma executa cada responsabilidade;
8. quais ações dependem de decisão humana;
9. quais capabilities deverão ser avaliadas;
10. quais estados técnicos precisam ser suportados.

---

## 2. Relação com o pacote documental

### 2.1 `HEALTH_WEB_CURRENT_STATE_AUDIT.md`

Registra o inventário técnico atual e classifica:

- Plano Alimentar como capacidade canônica pós-Foundation;
- restante da Saúde Web como implementação pré-Foundation, experimental e sem uso operacional atual.

### 2.2 `HEALTH_WEB_BASELINE.md`

Define a verdade de partida:

- preservar dados;
- não preservar obrigatoriamente a experiência antiga;
- não usar o legado como arquitetura;
- construir read-first;
- integrar Nutrição de forma controlada.

### 2.3 `HEALTH_WEB_TARGET_ARCHITECTURE.md`

Define:

- subdomínios;
- camadas;
- projections;
- comandos;
- autorização;
- separação Web × Mobile × Backend.

### 2.4 `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`

Define:

- rotas;
- navegação;
- cockpit global;
- cockpit individual;
- estados de interface;
- jornadas.

### 2.5 Papel deste documento

Este documento verifica se cada tela proposta possui uma base legítima no domínio.

Ele não cria novas entidades.

---

## 3. Hierarquia de autoridade

Em caso de conflito, prevalece:

1. decisão humana explicitamente aprovada;
2. ADR canônica do Health v1;
3. `HEALTH_V1_DOMAIN_MODEL`;
4. `HEALTH_V1_FIRESTORE_SCHEMA`;
5. política de prontidão e restrições;
6. contratos Backend vigentes;
7. arquitetura-alvo Web;
8. arquitetura da informação Web;
9. este documento;
10. mockup;
11. implementação.

Uma tela não poderá redefinir:

- enum;
- lifecycle;
- imutabilidade;
- precedência de prontidão;
- autoridade profissional;
- responsabilidade de plataforma.

---

## 4. Princípios de modelagem aplicados à Web

### 4.1 Tela não é agregado

Uma tela pode exibir vários agregados.

Exemplo:

```text
Cockpit individual
├── ReadinessSnapshot
├── OperationalRestriction
├── ClinicalCase
├── HealthScheduleItem
├── NutritionPlan
├── WeightAssessment
├── VaccinationRecord
└── HealthTimeline
```

O cockpit não se torna um agregado.

### 4.2 Projeção não é fonte canônica

`health_summary` e `health_timeline` são projeções server-side.

Elas servem para:

- leitura;
- síntese;
- comparação;
- navegação.

Não servem para:

- alterar prontidão manualmente;
- autorizar ação crítica sozinhas;
- substituir restrições;
- receber writes do cliente.

### 4.3 Fato finalizado é imutável

Eventos clínicos finalizados não são editados.

Correções usam:

- amendment;
- addendum;
- complement;
- cancelamento auditado;
- novo evento relacionado.

### 4.4 Planejamento não é execução

`HealthScheduleItem` representa planejamento.

A execução deverá produzir ou vincular o fato canônico correspondente.

### 4.5 Gestão não é prática profissional

Usuário interno registra ou transcreve uma decisão externa autorizada.

A UI deverá separar:

```text
Profissional responsável
Registrado no sistema por
```

### 4.6 Web não replica execução Mobile

A Web é prioritariamente:

- leitura;
- supervisão;
- administração;
- planejamento;
- transcrição autorizada;
- relatório;
- auditoria.

### 4.7 Capability não é role fixa

As telas e ações devem consultar capabilities.

Roles podem receber capabilities, mas a UI não deve codificar:

```text
if role == manager
```

como única autoridade.

### 4.8 Legado é fonte separada

`LegacyHealthRecord` é read-only para clientes.

Dados antigos não devem ser escritos por fluxos novos.

### 4.9 Ausência não é negação

Ausência de registro não significa:

- ausência de doença;
- ausência de restrição;
- vacinação válida;
- prontidão operacional.

### 4.10 Estado técnico não é estado de domínio

`error`, `stale`, `legacy` e `conflict` não são enums clínicos.

---

## 5. Tipos de elemento no modelo

### 5.1 Agregado canônico

Entidade com:

- identidade;
- invariantes;
- lifecycle;
- autoridade de write;
- auditoria.

### 5.2 Evento canônico

Fato ocorrido em determinado momento.

### 5.3 Projeção

Visão derivada e materializada pelo Backend.

### 5.4 Registro legado

Preservação imutável ou controlada de fonte pré-canônica.

### 5.5 Tela de índice

Lista ou comparação entre entidades.

### 5.6 Tela de detalhe

Exposição de uma entidade e seu lifecycle.

### 5.7 Cockpit

Composição de múltiplas fontes para decisão e navegação.

### 5.8 Comando

Intenção explícita enviada ao Backend.

### 5.9 Ação de execução

Registro de fato ocorrido em campo.

### 5.10 Ação de gestão

Criação, configuração ou transição administrativa.

---

## 6. Catálogo canônico de entidades

| Nº | Entidade | Tipo | Autoridade principal |
|---:|---|---|---|
| 1 | `ClinicalCase` | agregado | caso clínico longitudinal |
| 2 | `ClinicalEvent` | evento imutável | acontecimento clínico |
| 3 | `ClinicalEventAmendment` | adendo imutável | correção/complemento |
| 4 | `ExamProcess` | agregado | ciclo de exame |
| 5 | `TreatmentProtocol` | agregado | protocolo terapêutico |
| 6 | `DoseAdministration` | fato de execução | dose administrada/omitida |
| 7 | `WeightAssessment` | fato estruturado | pesagem |
| 8 | `NutritionPlan` | agregado | plano alimentar |
| 9 | `MealLog` | fato de execução | refeição |
| 10 | `SupplementLog` | fato de execução | suplemento |
| 11 | `HealthDocument` | agregado documental | documento |
| 12 | `OperationalRestriction` | agregado | restrição operacional |
| 13 | `HealthScheduleItem` | agregado | planejamento |
| 14 | `VaccinationRecord` | fato canônico | aplicação de vacina |
| 15 | `LegacyHealthRecord` | legado read-only | preservação histórica |
| 16 | `ReadinessSnapshot` | projeção | estado consolidado |
| 17 | `HealthTimelineItem` | projeção | histórico normalizado |

---

## 7. Catálogo de telas

| Código | Tela | Rota conceitual |
|---|---|---|
| SCR-01 | Visão Geral | `/health` |
| SCR-02 | Prontidão do Efetivo | `/health/readiness` |
| SCR-03 | Cockpit Individual | `/health/readiness/{dogId}` |
| SCR-04 | Restrições do K9 | cockpit/subrota |
| SCR-05 | Agenda Global | `/health/schedule` |
| SCR-06 | Detalhe da Agenda | `/health/schedule/{scheduleId}` |
| SCR-07 | Casos Clínicos | `/health/clinical` |
| SCR-08 | Detalhe do Caso | `/health/clinical/{caseId}` |
| SCR-09 | Processo de Exame | `/health/exams/{examId}` |
| SCR-10 | Protocolo de Tratamento | `/health/treatments/{protocolId}` |
| SCR-11 | Nutrição Global | `/health/nutrition` |
| SCR-12 | Plano Alimentar | `/health/nutrition/plans/{planId}` |
| SCR-13 | Peso e Tendência | cockpit/subrota |
| SCR-14 | Vacinação | cockpit/subrota |
| SCR-15 | Documentos | cockpit/subrota |
| SCR-16 | Histórico Global | `/health/history` |
| SCR-17 | Histórico do K9 | `/health/dogs/{dogId}/history` |
| SCR-18 | Relatórios | `/health/reports` |
| SCR-19 | Auditoria | `/health/audit` |
| SCR-20 | Registro Legado | detalhe contextual |
| SCR-21 | Perfil K9 — Resumo Health | `/k9/{dogId}` |

As rotas ainda marcadas como conceituais dependem da aprovação final da arquitetura da informação.

---

## 8. Matriz geral entidade × tela

Legenda:

- **P** — fonte principal da tela;
- **S** — fonte secundária;
- **L** — link/drill-down;
- **W** — tela pode iniciar comando de gestão;
- **E** — tela pode iniciar execução, se aprovada;
- **—** — não pertence ao escopo.

| Entidade | Geral | Prontidão | Cockpit | Agenda | Clínico | Caso | Nutrição | Histórico | Relatórios | Auditoria |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ClinicalCase | S | S | S | S | P/W | P/W | — | S | S | L |
| ClinicalEvent | S | S | S | — | S | P/W | — | S | S | L |
| Amendment | — | — | S | — | — | P/W | — | S | S | L |
| ExamProcess | S | S | S | S | S | S/W | — | S | S | L |
| TreatmentProtocol | S | S | S | S | S | S/W | — | S | S | L |
| DoseAdministration | S | S | S | S | S | S | — | S | S | L |
| WeightAssessment | S | S | P | S | S | S | S | S | P | L |
| NutritionPlan | S | S | S | — | — | — | P/W | S | S | L |
| MealLog | S | — | S | S | — | — | S | S | S | L |
| SupplementLog | S | — | S | S | — | — | S | S | S | L |
| HealthDocument | S | S | S/W | — | S | S/W | S | S | S | L |
| OperationalRestriction | P | P | P/W | S | S | S/W | — | S | P | L |
| HealthScheduleItem | P | S | P/W | P/W | S | S/W | S | S | P | L |
| VaccinationRecord | S | S | P | S | S | S | — | S | P | L |
| LegacyHealthRecord | S | S | S | — | S | S | S | P | S | L |
| ReadinessSnapshot | P | P | P | — | — | — | — | S | P | — |
| HealthTimelineItem | S | S | S | S | S | S | S | P | S | — |

---

## 9. Plataforma e responsabilidade

| Entidade/Ação | Web | Mobile | Backend |
|---|---|---|---|
| Consultar summary | principal | principal | projeta |
| Alterar prontidão | proibido | proibido | deriva |
| Consultar restrições | principal | principal | autoriza/enforce |
| Criar restrição | transcrição autorizada possível | fluxo autorizado possível | valida/persiste |
| Encerrar restrição | gestão autorizada possível | fluxo autorizado possível | valida/persiste |
| Criar item de agenda | principal | possível conforme contrato | valida/persiste |
| Reagendar/cancelar | principal | possível | valida/persiste |
| Registrar execução preventiva | pendente | preferencial | valida/persiste |
| Abrir caso clínico | possível | possível | valida/persiste |
| Registrar evento clínico | transcrição autorizada | execução/registro | valida/persiste |
| Finalizar evento | possível conforme fluxo | possível | imutabiliza |
| Criar amendment | gestão autorizada | possível | valida/persiste |
| Criar protocolo | transcrição/gestão | leitura/consulta | valida/persiste |
| Registrar dose | exceção pendente | preferencial | deduplica/persiste |
| Criar plano alimentar | principal | proibido | valida/persiste |
| Atualizar/substituir plano | principal | proibido | valida/persiste |
| Registrar refeição | proibido como padrão | principal | deduplica/persiste |
| Registrar suplemento | proibido como padrão | principal | deduplica/persiste |
| Registrar peso | decisão pendente | principal possível | valida/persiste |
| Registrar vacina | decisão pendente | principal possível | valida/persiste |
| Gerar timeline | proibido | proibido | projeta |
| Gerar summary | proibido | proibido | projeta |
| Exportar relatório | autorizado | não prioritário | fornece dados/controla |
| Auditar | consulta | consulta limitada | registra |

---

# Parte I — Modelo por domínio

## 10. Domínio de Prontidão

### 10.1 Entidade de leitura

`ReadinessSnapshot`

Path canônico conceitual:

```text
dogs/{dogId}/health_summary/current
```

### 10.2 Natureza

Projeção read-only.

### 10.3 Autoridade

Backend.

### 10.4 Estados oficiais

| Enum | Label Web |
|---|---|
| `operational` | Operacional |
| `operational_attention` | Operacional com Atenção |
| `fit_with_restrictions` | Apto com Restrições |
| `temporarily_unfit` | Temporariamente Inapto |
| `not_evaluated` | Não Avaliado |

### 10.5 Invariantes de UI

1. A Web não calcula o status.
2. A Web não oferece override manual.
3. A Web não converte erro em `not_evaluated`.
4. A Web exibe freshness.
5. A Web fornece razões e evidências.
6. A Web segue para fontes canônicas.
7. A Web não usa score percentual como prontidão.

### 10.6 Telas

- SCR-01 Visão Geral;
- SCR-02 Prontidão;
- SCR-03 Cockpit;
- SCR-18 Relatórios.

### 10.7 Campos conceituais da tela

- `dog_id`;
- `readiness_status`;
- `readiness_updated_at`;
- `evaluated_by`;
- razões resumidas;
- restrições ativas resumidas;
- pendências relevantes;
- `schema_version`;
- projection version, quando disponível;
- freshness.

A lista final de campos virá da Data Source Matrix.

### 10.8 Ações

A tela de Prontidão não inicia comando para “mudar prontidão”.

Pode iniciar:

- abrir K9;
- abrir restrição;
- abrir caso;
- abrir item de agenda;
- atualizar leitura;
- exportar, mediante capability.

### 10.9 Capability conceitual

- `health.view_readiness`;
- `health.export_readiness`.

Esses nomes ainda não são contratos aprovados.

### 10.10 Estados técnicos obrigatórios

- loading;
- empty;
- partial;
- stale;
- conflict;
- forbidden;
- error.

### 10.11 Critérios de conflito

Exemplos:

- summary indica operacional, mas existe restrição absoluta ativa;
- summary anterior à última alteração canônica;
- projection version incompatível;
- fontes necessárias indisponíveis.

A UI deverá falhar fechada para ações críticas.

---

## 11. Domínio de Restrições Operacionais

### 11.1 Agregado

`OperationalRestriction`

Path conceitual:

```text
dogs/{dogId}/operational_restrictions/{restrictionId}
```

### 11.2 Responsabilidade

Representar uma decisão profissional que limita a atuação do K9.

### 11.3 Lifecycle

| Estado | Significado |
|---|---|
| `active` | restrição vigente |
| `ended` | encerrada com justificativa |
| `cancelled` | cancelada por erro administrativo |

### 11.4 Níveis

| Enum | Impacto |
|---|---|
| `absolute` | impede prontidão operacional |
| `partial` | permite atuação dentro de limites |
| `attention` | exige atenção sem restrição formal equivalente |

### 11.5 Categorias canônicas

- `injury`;
- `post_surgical`;
- `medication_effect`;
- `behavioral`;
- `infectious`;
- `chronic`;
- `preventive_pending`;
- `other`.

### 11.6 Invariantes

1. Requer evidência profissional para emissão.
2. Restrição absoluta ativa implica `temporarily_unfit`.
3. Encerramento exige justificativa.
4. Não há hard delete.
5. Usuário interno não se apresenta como profissional emissor.
6. Source document é parte do contrato quando exigido.
7. Ação crítica valida fonte canônica, não apenas summary.

### 11.7 Telas

- SCR-01;
- SCR-02;
- SCR-03;
- SCR-04;
- SCR-08;
- SCR-16;
- SCR-18;
- SCR-19.

### 11.8 Tela de detalhe

Deverá mostrar:

- nível;
- categoria;
- descrição;
- atividades restringidas;
- emissão;
- vigência;
- término esperado;
- profissional;
- documento;
- caso/evento/exame relacionado;
- usuário que registrou;
- lifecycle;
- auditoria.

### 11.9 Ações Web possíveis

- registrar restrição externa;
- encerrar;
- cancelar por erro administrativo;
- abrir fonte;
- criar item de reavaliação;
- consultar histórico.

### 11.10 Ações proibidas

- alterar diretamente nível de restrição finalizada;
- apagar;
- criar sem evidência quando o contrato exigir;
- “liberar K9” sem comando formal;
- encerrar automaticamente porque a data esperada passou.

### 11.11 Capabilities conceituais

- `health.view_restrictions`;
- `health.create_restriction`;
- `health.end_restriction`;
- `health.cancel_restriction`;
- `health.view_restriction_sensitive_data`.

### 11.12 Relações

```text
ClinicalCase
   └── ClinicalEvent restriction_issued
        └── OperationalRestriction
             └── ReadinessSnapshot
```

---

## 12. Domínio de Agenda

### 12.1 Agregado

`HealthScheduleItem`

Path:

```text
dogs/{dogId}/health_schedule/{scheduleId}
```

### 12.2 Responsabilidade

Representar item planejado preventivo ou terapêutico.

### 12.3 Lifecycle persistido

- `open`;
- `completed`;
- `cancelled`.

### 12.4 Estados temporais derivados

- `scheduled`;
- `upcoming`;
- `today`;
- `pending`;
- `overdue`;
- `completed`;
- `cancelled`.

### 12.5 Precedência de leitura

1. completed;
2. cancelled;
3. overdue;
4. pending;
5. today;
6. upcoming;
7. scheduled.

### 12.6 Tipos

- `dose`;
- `vaccination`;
- `exam`;
- `consultation`;
- `weighing`;
- `reevaluation`;
- `deworming`;
- `bath`;
- `general`.

### 12.7 Fontes

- `treatment_protocol`;
- `clinical_case`;
- `exam_process`;
- `preventive`;
- `manual`.

### 12.8 Invariantes

1. Criação somente presente/futuro.
2. Completed e cancelled são terminais.
3. Estado temporal não é persistido.
4. Timezone é obrigatório.
5. Tolerância depende do tipo.
6. Agenda não é fato executado.
7. Conclusão deve relacionar execução quando aplicável.

### 12.9 Telas

- SCR-01;
- SCR-03;
- SCR-05;
- SCR-06;
- SCR-08;
- SCR-10;
- SCR-16;
- SCR-18.

### 12.10 Ações Web

- criar;
- editar campos permitidos;
- reagendar;
- cancelar;
- consultar;
- vincular entidade;
- registrar conclusão conforme fronteira aprovada.

### 12.11 Decisão pendente

A conclusão Web deve ser definida por tipo:

| Tipo | Web conclui? | Estado |
|---|---:|---|
| consulta | possível transcrição | pendente |
| exame | possível após resultado | pendente |
| pesagem | depende do registro Web | pendente |
| vacinação | depende da transcrição | pendente |
| dose | preferencialmente Mobile | pendente |
| refeição | Mobile | não |
| reavaliação | gestão possível | pendente |

### 12.12 Capability conceitual

- `health.view_schedule`;
- `health.create_schedule`;
- `health.update_schedule`;
- `health.cancel_schedule`;
- `health.complete_schedule`.

### 12.13 Tela de detalhe

Mostra:

- data;
- timezone;
- tolerância;
- estado temporal;
- lifecycle;
- origem;
- entidade;
- responsável;
- execução;
- auditoria.

---

## 13. Domínio de Caso Clínico

### 13.1 Agregado

`ClinicalCase`

Path:

```text
dogs/{dogId}/clinical_cases/{caseId}
```

### 13.2 Responsabilidade

Agrupar o ciclo clínico completo.

### 13.3 Estados

- `open`;
- `under_investigation`;
- `under_treatment`;
- `monitoring`;
- `discharged`;
- `cancelled`.

### 13.4 Transições

```text
open
├── under_investigation
├── under_treatment
└── cancelled

under_investigation
├── under_treatment
└── cancelled

under_treatment
├── monitoring
└── cancelled

monitoring
├── discharged
└── cancelled

discharged
└── reopen action → open | under_investigation | under_treatment | monitoring
```

### 13.5 Reabertura

Reabertura é ação, não estado.

Requer:

- caso `discharged`;
- `reopen_reason`;
- capability;
- identidade profissional quando decisão externa;
- documento quando aplicável;
- auditoria.

Caso `cancelled` não é reaberto.

### 13.6 Telas

- SCR-01;
- SCR-03;
- SCR-07;
- SCR-08;
- SCR-16;
- SCR-18;
- SCR-19.

### 13.7 Tela de lista

Campos:

- K9;
- título;
- status;
- abertura;
- tipo de abertura;
- profissional;
- última atividade;
- tratamentos ativos;
- restrição;
- próxima ação.

### 13.8 Tela de detalhe

É a autoridade de navegação longitudinal do caso.

Combina:

- ClinicalCase;
- ClinicalEvent;
- Amendment;
- ExamProcess;
- TreatmentProtocol;
- OperationalRestriction;
- HealthDocument;
- HealthScheduleItem.

### 13.9 Ações Web possíveis

- abrir caso;
- registrar evento autorizado;
- registrar acompanhamento;
- criar exame;
- criar tratamento;
- criar restrição;
- criar agenda;
- finalizar caso;
- reabrir;
- cancelar;
- relacionar recorrência.

### 13.10 Ações proibidas

- editar fato final;
- reabrir cancelado;
- mudar status sem evento/auditoria;
- apagar caso;
- fundir casos silenciosamente;
- alterar profissional externo para usuário interno.

### 13.11 Capabilities conceituais

- `health.view_clinical_cases`;
- `health.open_clinical_case`;
- `health.manage_clinical_case`;
- `health.discharge_clinical_case`;
- `health.cancel_clinical_case`;
- `health.reopen_case`.

`health.reopen_case` já existe como nome canônico no modelo de domínio.

---

## 14. Domínio de Evento Clínico

### 14.1 Entidade

`ClinicalEvent`

Path:

```text
dogs/{dogId}/clinical_cases/{caseId}/events/{eventId}
```

### 14.2 Natureza

Fato clínico dentro de um caso.

### 14.3 Estados

- `draft`;
- `final`;
- `cancelled`.

### 14.4 Tipos

- `consultation`;
- `incident`;
- `vaccination`;
- `exam_request`;
- `exam_collection`;
- `exam_result`;
- `exam_interpretation`;
- `treatment_start`;
- `treatment_note`;
- `dose_note`;
- `reevaluation`;
- `discharge`;
- `reopen`;
- `restriction_issued`;
- `restriction_ended`;
- `surgical_note`;
- `general_note`;
- `observation`.

### 14.5 Invariantes

1. Pertence a exatamente um caso.
2. `occurred_at` não pode ser futuro.
3. Payload é tipado e versionado.
4. `content` final é imutável.
5. Amendments são documentos separados.
6. Status permanece `final` mesmo com amendments.
7. Cancelamento preserva conteúdo.
8. Attachments referenciam `HealthDocument`.

### 14.6 Tela

Principalmente SCR-08.

Também aparece em:

- cockpit;
- histórico;
- relatórios;
- auditoria.

### 14.7 Formulário

Não haverá formulário universal de evento.

Cada tipo deverá possuir:

- contrato;
- campos;
- validações;
- label;
- consequência;
- capability.

### 14.8 Eventos e agregados próprios

Alguns eventos iniciam ou registram mudanças em agregados:

| Evento | Agregado relacionado |
|---|---|
| exam_request | ExamProcess |
| treatment_start | TreatmentProtocol |
| restriction_issued | OperationalRestriction |
| vaccination | VaccinationRecord |
| discharge | ClinicalCase |
| reopen | ClinicalCase |

### 14.9 Ações Web

- criar draft, se drafts forem habilitados;
- finalizar;
- cancelar;
- adicionar amendment;
- vincular documento.

### 14.10 Capabilities conceituais

- `health.create_clinical_event`;
- `health.finalize_clinical_event`;
- `health.cancel_clinical_event`;
- `health.amend_clinical_event`.

---

## 15. Domínio de Amendments

### 15.1 Entidade

`ClinicalEventAmendment`

Path conceitual:

```text
.../events/{eventId}/amendments/{amendId}
```

### 15.2 Tipos

- `correction`;
- `addendum`;
- `complement`.

### 15.3 Responsabilidade

Corrigir ou complementar sem modificar o original.

### 15.4 Telas

- detalhe do caso;
- detalhe do evento;
- histórico;
- auditoria.

### 15.5 Invariantes

- append-only;
- autor e horário obrigatórios;
- motivo;
- vínculo com original;
- sem substituição silenciosa;
- original sempre acessível.

### 15.6 UI

Deverá mostrar:

```text
Evento original
Amendments
Versão de leitura consolidada, se aprovada
```

A versão consolidada nunca poderá ocultar o original.

### 15.7 Capability conceitual

- `health.amend_clinical_event`.

---

## 16. Domínio de Exames

### 16.1 Agregado

`ExamProcess`

Path:

```text
dogs/{dogId}/clinical_cases/{caseId}/exams/{examId}
```

### 16.2 Estágios

- `requested`;
- `collected`;
- `resulted`;
- `interpreted`;
- `impact_assessed`;
- `cancelled`.

### 16.3 Tipos

- `blood_work`;
- `imaging`;
- `biopsy`;
- `culture`;
- `parasitology`;
- `urinalysis`;
- `cardiology`;
- `dermatology`;
- `ophthalmology`;
- `other`.

### 16.4 Responsabilidade

Representar o ciclo completo de um exame.

### 16.5 Telas

- caso clínico;
- detalhe de exame;
- cockpit;
- agenda;
- histórico;
- relatórios.

### 16.6 Ações Web possíveis

- solicitar/transcrever solicitação;
- agendar coleta;
- registrar coleta externa;
- anexar resultado;
- registrar interpretação externa;
- registrar avaliação de impacto;
- cancelar.

### 16.7 Invariantes de UI

- resultado não é interpretação;
- interpretação não é prontidão;
- documento não é processo;
- estado não avança sem comando;
- cancelamento é explícito;
- data efetiva e registro são separados.

### 16.8 Relações

```text
ClinicalCase
├── ClinicalEvent exam_request
├── ExamProcess
├── HealthDocument result
├── ClinicalEvent exam_interpretation
├── OperationalRestriction, se aplicável
└── ReadinessSnapshot atualizado pelo Backend
```

### 16.9 Capability conceitual

- `health.manage_exam_process`;
- `health.record_exam_result`;
- `health.record_exam_interpretation`.

---

## 17. Domínio de Tratamentos

### 17.1 Agregado

`TreatmentProtocol`

Path:

```text
dogs/{dogId}/treatment_protocols/{protocolId}
```

### 17.2 Estados

- `active`;
- `paused`;
- `completed`;
- `cancelled`.

### 17.3 Responsabilidade

Representar protocolo estruturado, não anotação solta de medicação.

### 17.4 Conteúdo estruturado

- medicamento;
- dose;
- unidade;
- via;
- `per_kg`;
- agenda;
- início;
- fim;
- instruções;
- profissional;
- documento;
- caso.

### 17.5 Telas

- detalhe do caso;
- detalhe do protocolo;
- cockpit;
- agenda;
- histórico;
- relatórios.

### 17.6 Ações Web possíveis

- criar/transcrever;
- pausar;
- retomar;
- concluir;
- cancelar;
- adicionar nota;
- criar agenda derivada;
- consultar adesão.

### 17.7 Ações proibidas

- editar protocolo finalizado silenciosamente;
- criar sem profissional/documento quando obrigatório;
- registrar medicamento como evento genérico sem protocolo;
- recalcular dose clínica no cliente.

### 17.8 Capability conceitual

- `health.manage_treatment_protocol`;
- `health.pause_treatment_protocol`;
- `health.complete_treatment_protocol`;
- `health.cancel_treatment_protocol`.

---

## 18. Domínio de Doses

### 18.1 Entidade

`DoseAdministration`

Path:

```text
dogs/{dogId}/treatment_protocols/{protocolId}/doses/{doseId}
```

### 18.2 Estados

- `administered`;
- `skipped`;
- `cancelled`.

### 18.3 Natureza

Fato de execução.

### 18.4 Plataforma principal

Mobile.

### 18.5 Presença na Web

A Web exibe:

- previstas;
- realizadas;
- omitidas;
- canceladas;
- próxima dose;
- adesão;
- executor;
- horário;
- observações.

### 18.6 Write Web

Não faz parte do padrão.

Exceção futura poderá ser avaliada para:

- transcrição administrativa;
- correção via amendment;
- operação interna de canil com terminal Web.

### 18.7 Invariantes

- idempotência;
- dose ligada a protocolo;
- ocorrência identificável;
- horário efetivo;
- executor;
- sem overwrite;
- status terminal.

### 18.8 Capability conceitual

- `health.view_dose_administrations`;
- eventual `health.transcribe_dose_administration`.

---

## 19. Domínio de Peso

### 19.1 Entidade

`WeightAssessment`

Coleção canônica:

```text
dogs/{dogId}/weight_records/{id}
```

### 19.2 Contextos

- `routine`;
- `clinical`;
- `pre_op`;
- `post_op`.

### 19.3 Natureza

Fato estruturado.

### 19.4 Telas

- cockpit;
- peso e tendência;
- caso clínico;
- histórico;
- relatórios;
- agenda.

### 19.5 Conteúdo Web

- peso;
- unidade;
- data efetiva;
- contexto;
- autoria;
- origem;
- observação;
- relação com caso;
- tendência.

### 19.6 Ações

Registro Web está pendente de aprovação.

Possíveis modalidades:

- medição presencial;
- transcrição externa;
- importação;
- amendment.

### 19.7 Invariantes de UI

- tendência não é diagnóstico;
- outlier não muda prontidão localmente;
- ausência de peso não significa inaptidão;
- `_last_weight_*` legado não é autoridade;
- gráfico possui tabela alternativa.

### 19.8 Capability conceitual

- `health.view_weight`;
- `health.record_weight`;
- `health.transcribe_weight`;
- `health.amend_weight`.

---

## 20. Domínio de Nutrição

### 20.1 Agregado

`NutritionPlan`

Path canônico vigente na implementação pós-Foundation:

```text
dogs/{dogId}/nutrition_plans/{planId}
```

### 20.2 Estados

- `active`;
- `superseded`;
- `cancelled`.

### 20.3 Responsabilidade

Definir plano alimentar.

### 20.4 Plataforma

Web define/administra.

Mobile consulta/executa.

Backend valida/persiste/audita.

### 20.5 Operações já implementadas

- CREATE + ACTIVATE;
- UPDATE administrativo;
- REPLACE estrutural;
- CANCEL.

### 20.6 Regra de identidade

Mudança estrutural exige novo `planId`.

Plano anterior vira `superseded`.

### 20.7 Idempotência

`operationId` com receipt durável.

### 20.8 Conflito

Múltiplos planos ativos:

- estado `conflict`;
- fail-closed;
- nenhuma seleção automática.

### 20.9 Telas

- Visão Geral;
- cockpit;
- Nutrição global;
- plano alimentar;
- histórico;
- relatórios;
- auditoria.

### 20.10 Ações Web

- criar e ativar;
- atualizar;
- substituir;
- cancelar;
- consultar histórico.

### 20.11 Capability canônica existente

```text
health.manage_nutrition_plan
```

Sem fallback para `health.edit`.

### 20.12 Estados técnicos já previstos

- loading;
- canonical;
- legacy;
- empty;
- degraded;
- error;
- conflict.

### 20.13 Integração

A UI existente será reconciliada com:

- Health Module Shell;
- navegação secundária;
- cockpit;
- design system;
- matriz de fontes;
- permissions oficiais.

---

## 21. Domínio de Refeições

### 21.1 Entidade

`MealLog`

Path:

```text
dogs/{dogId}/meal_logs/{id}
```

### 21.2 Natureza

Fato de execução.

### 21.3 Plataforma principal

Mobile.

### 21.4 Identidade

`meal_occurrence_id` identifica a ocorrência.

### 21.5 Invariantes

- um log por ocorrência;
- dedupe canônico × legado;
- planejado ou avulso;
- auditoria;
- tolerâncias;
- fato imutável conforme contrato.

### 21.6 Presença Web

A Web poderá exibir:

- execução recente;
- conformidade;
- refeições omitidas;
- fonte;
- relação com plano;
- histórico.

### 21.7 Ações Web

Não registrar refeição por padrão.

### 21.8 Tela

- cockpit nutricional;
- histórico;
- relatórios;
- detalhe futuro.

### 21.9 Capability conceitual

- `health.view_meal_logs`.

---

## 22. Domínio de Suplementos

### 22.1 Entidade

`SupplementLog`

Path:

```text
dogs/{dogId}/supplement_logs/{id}
```

### 22.2 Natureza

Fato de execução.

### 22.3 Plataforma principal

Mobile.

### 22.4 Presença Web

- execução;
- produto;
- quantidade;
- horário;
- origem;
- executor;
- plano relacionado;
- observações.

### 22.5 Ações Web

Não registrar como padrão.

### 22.6 Capability conceitual

- `health.view_supplement_logs`.

---

## 23. Domínio de Documentos

### 23.1 Agregado

`HealthDocument`

Path:

```text
dogs/{dogId}/health_documents/{id}
```

### 23.2 Tipos

- `prescription`;
- `report`;
- `certificate`;
- `exam_image`;
- `exam_pdf`;
- `photo`;
- `vaccination_card`;
- `surgical_report`;
- `other`.

### 23.3 Responsabilidade

Identidade e metadados de documento Health.

### 23.4 Invariantes

- arquivo não é URL inline em evento;
- Storage path canônico;
- vínculo por ID;
- metadados;
- autoria;
- origem;
- acesso controlado;
- auditoria.

### 23.5 Telas

- cockpit;
- caso;
- exame;
- tratamento;
- restrição;
- vacinação;
- Nutrição, quando aplicável;
- histórico;
- auditoria.

### 23.6 Ações Web

- enviar;
- classificar;
- vincular;
- consultar;
- baixar mediante autorização;
- cancelar/remover conforme política;
- retificar metadados conforme contrato.

### 23.7 Capability conceitual

- `health.view_documents`;
- `health.manage_documents`;
- `health.download_documents`;
- `health.view_sensitive_documents`.

### 23.8 Transição do legado

Root `documentos` e subcoleções antigas serão tratadas pela Migration Matrix.

---

## 24. Domínio de Vacinação

### 24.1 Agregado

`VaccinationRecord`

Path:

```text
dogs/{dogId}/vaccination_records/{vaccinationId}
```

### 24.2 Estados persistidos

- `final`;
- `cancelled`.

### 24.3 Responsabilidade

Registrar aplicação canônica de vacina.

### 24.4 Estados temporais

Próxima dose e vencimento pertencem à Agenda e às projeções.

Não são lifecycle de `VaccinationRecord`.

### 24.5 Telas

- cockpit;
- vacinação;
- agenda;
- caso clínico, quando relevante;
- histórico;
- relatórios.

### 24.6 Ações Web

Pendente de decisão:

- registrar aplicação;
- transcrever aplicação externa;
- cancelar por erro;
- adicionar documento;
- criar próxima agenda.

### 24.7 Invariantes de UI

- não usar fallback universal de 365 dias;
- validade segue contrato;
- aplicação é fato;
- próxima dose é planejamento;
- vacinação dentro de caso referencia record canônico;
- documento não substitui record.

### 24.8 Capability conceitual

- `health.view_vaccination`;
- `health.record_vaccination`;
- `health.transcribe_vaccination`;
- `health.cancel_vaccination`.

---

## 25. Domínio Legado

### 25.1 Entidade

`LegacyHealthRecord`

Path:

```text
dogs/{dogId}/legacy_health_records/{recordId}
```

### 25.2 Natureza

Read-only para clientes.

### 25.3 Campos fundamentais

- `original_collection`;
- `original_id`;
- `original_payload`;
- `migration_batch_id`;
- `migrated_at`;
- `schema_version`;
- `normalized_view`;
- `case_id`;
- `occurred_at`;
- `recorded_by`.

### 25.4 Telas

- histórico;
- cockpit;
- caso relacionado;
- Nutrição;
- auditoria de migração;
- detalhe legado.

### 25.5 Ações do cliente

- consultar;
- abrir payload permitido;
- seguir para registro curado;
- reportar conflito.

### 25.6 Ações proibidas

- editar original;
- finalizar por fluxo canônico;
- transformar silenciosamente em entidade;
- apagar;
- ocultar origem.

### 25.7 Ações Backend/Admin SDK

Limitadas e auditadas:

- `normalized_view`;
- `case_id`;
- metadados de reconciliação;
- batch.

### 25.8 Badge

```text
Registro legado
```

ou label final aprovado.

### 25.9 Estado técnico

`legacy` pode coexistir com:

- success;
- partial;
- conflict.

---

## 26. Domínio de Timeline

### 26.1 Entidade

`HealthTimelineItem`

Path conceitual:

```text
dogs/{dogId}/health_timeline/{timelineId}
```

ou organização final definida no schema.

### 26.2 Natureza

Projeção read-only.

### 26.3 Responsabilidade

Normalizar fatos de múltiplos agregados para leitura cronológica.

### 26.4 Fontes

- casos;
- eventos;
- exames;
- tratamentos;
- doses;
- peso;
- Nutrição;
- documentos;
- restrições;
- agenda;
- vacinação;
- legado.

### 26.5 Telas

- Visão Geral;
- cockpit;
- Histórico Global;
- Histórico do K9;
- caso;
- relatórios.

### 26.6 Campos conceituais

- tipo;
- categoria;
- título;
- resumo;
- `occurred_at`;
- `recorded_at`;
- K9;
- ator;
- origem;
- source collection;
- source id;
- impacto;
- canonical/legacy;
- amendment;
- links.

### 26.7 Ações

Apenas leitura e navegação.

### 26.8 Invariantes

- Backend projeta;
- cliente não concatena N collections;
- paginação;
- ordenação estável;
- origem visível;
- datas distintas;
- sem mutação pela timeline.

---

# Parte II — Modelo por tela

## 27. SCR-01 — Visão Geral

### 27.1 Responsabilidade

Priorizar o efetivo.

### 27.2 Entidades principais

- ReadinessSnapshot;
- OperationalRestriction;
- HealthScheduleItem;
- ClinicalCase;
- TreatmentProtocol;
- NutritionPlan;
- HealthTimelineItem.

### 27.3 Não é autoridade de write

A tela pode abrir fluxos, mas não contém lógica de domínio própria.

### 27.4 Widgets conceituais

| Bloco | Fonte |
|---|---|
| contagem por prontidão | summaries |
| prioridades | projection agregada |
| agenda próxima | schedule |
| casos abertos | cases |
| tratamentos ativos | protocols |
| Nutrição | plans |
| atividade recente | timeline |

### 27.5 Ação primária

Contextual ou ausente.

### 27.6 Proibições

- score;
- cálculo local;
- botão genérico;
- lista ilimitada;
- zero falso em falha.

---

## 28. SCR-02 — Prontidão do Efetivo

### 28.1 Fonte principal

ReadinessSnapshot.

### 28.2 Fontes auxiliares

- restrições;
- casos;
- agenda;
- freshness.

### 28.3 Ação

Investigar.

### 28.4 Filtros

- status;
- restrição;
- caso aberto;
- atraso;
- conflito;
- legacy;
- stale.

### 28.5 Write

Nenhum write de prontidão.

### 28.6 Resultado esperado

Abrir SCR-03.

---

## 29. SCR-03 — Cockpit Individual

### 29.1 Natureza

Composição longitudinal.

### 29.2 Entidades

Todas as entidades relevantes ao K9.

### 29.3 Prioridade visual

1. prontidão;
2. restrições;
3. pendências;
4. casos/tratamentos;
5. agenda;
6. prevenção;
7. Nutrição;
8. histórico.

### 29.4 Ações

Ações específicas por domínio e capability.

### 29.5 Falha de summary

Não calcular localmente.

### 29.6 Relação com perfil institucional

SCR-21 aponta para SCR-03.

---

## 30. SCR-04 — Restrições do K9

### 30.1 Fonte

OperationalRestriction.

### 30.2 Visualizações

- ativas;
- encerradas;
- canceladas;
- vencimento esperado;
- atividades afetadas.

### 30.3 Ações

- criar;
- encerrar;
- cancelar;
- agendar reavaliação.

### 30.4 Dependência

Capability e evidência profissional.

---

## 31. SCR-05 — Agenda Global

### 31.1 Fonte

HealthScheduleItem.

### 31.2 Natureza

Gestão temporal.

### 31.3 Visualizações

- lista;
- agrupamento;
- calendário opcional;
- atrasados;
- próximos;
- concluídos.

### 31.4 Ações

- criar;
- reagendar;
- cancelar;
- abrir.

### 31.5 Regra

Temporal state derivado no read-time.

---

## 32. SCR-06 — Detalhe da Agenda

### 32.1 Fonte

HealthScheduleItem.

### 32.2 Relações

- source entity;
- execution entity;
- K9;
- responsável.

### 32.3 Ações

Conforme lifecycle e capability.

### 32.4 Estado terminal

Completed/cancelled não retornam a open.

---

## 33. SCR-07 — Casos Clínicos

### 33.1 Fonte

ClinicalCase.

### 33.2 Natureza

Lista operacional de agregados.

### 33.3 Ações

- abrir caso;
- filtrar;
- exportar autorizado;
- abrir detalhe.

### 33.4 Não exibir

Eventos soltos como substituto de casos.

---

## 34. SCR-08 — Detalhe do Caso

### 34.1 Fonte principal

ClinicalCase.

### 34.2 Fontes relacionadas

- events;
- amendments;
- exams;
- treatments;
- restrictions;
- documents;
- schedule.

### 34.3 Comandos

- evento;
- exame;
- tratamento;
- restrição;
- agenda;
- discharge;
- reopen;
- cancel.

### 34.4 Regra

Cada comando possui contrato próprio.

---

## 35. SCR-09 — Processo de Exame

### 35.1 Fonte

ExamProcess.

### 35.2 Visual

Stepper de lifecycle pode ser usado.

### 35.3 Ações

Somente transições válidas.

### 35.4 Documento

Resultado é relacionado por HealthDocument.

---

## 36. SCR-10 — Protocolo de Tratamento

### 36.1 Fonte

TreatmentProtocol.

### 36.2 Fontes auxiliares

- doses;
- schedule;
- case;
- document;
- professional.

### 36.3 Ações

- pausar;
- retomar;
- concluir;
- cancelar.

### 36.4 Execução

Doses são preferencialmente Mobile.

---

## 37. SCR-11 — Nutrição Global

### 37.1 Fonte

NutritionPlan canônico + readers legados coordenados.

### 37.2 Estados

- canonical;
- legacy;
- empty;
- degraded;
- conflict;
- error.

### 37.3 Ações

Capability `health.manage_nutrition_plan`.

### 37.4 Relação

Abre SCR-12 ou contexto do K9.

---

## 38. SCR-12 — Plano Alimentar

### 38.1 Fonte

NutritionPlan.

### 38.2 Comandos

- create and activate;
- update active;
- replace;
- cancel.

### 38.3 Identidade

Replace gera novo planId.

### 38.4 Histórico

Não deve ser inferido por overwrite.

---

## 39. SCR-13 — Peso e Tendência

### 39.1 Fonte

WeightAssessment.

### 39.2 Natureza

Leitura longitudinal.

### 39.3 Ação de registro

Pendente.

### 39.4 Gráfico

Sem diagnóstico automático.

---

## 40. SCR-14 — Vacinação

### 40.1 Fonte

VaccinationRecord + HealthScheduleItem.

### 40.2 Separação

- aplicação passada;
- próxima aplicação planejada.

### 40.3 Ação de registro

Pendente.

### 40.4 Proibição

Fallback universal de validade.

---

## 41. SCR-15 — Documentos

### 41.1 Fonte

HealthDocument.

### 41.2 Organização

Por tipo, entidade e data.

### 41.3 Ações

- upload;
- vínculo;
- consulta;
- download;
- cancelamento/removal policy.

### 41.4 Segurança

URLs temporárias e autorização.

---

## 42. SCR-16 — Histórico Global

### 42.1 Fonte

HealthTimelineItem.

### 42.2 Natureza

Leitura paginada.

### 42.3 Filtros

- K9;
- período;
- categoria;
- origem;
- ator;
- legacy;
- amendment.

### 42.4 Ação

Abrir fonte.

---

## 43. SCR-17 — Histórico do K9

### 43.1 Fonte

Timeline filtrada por dogId.

### 43.2 Contexto persistente

Cabeçalho do K9.

### 43.3 Relação

Parte do cockpit.

---

## 44. SCR-18 — Relatórios

### 44.1 Fontes

Projeções e contratos de relatório.

### 44.2 Natureza

Análise, não autoridade.

### 44.3 Ações

- filtrar;
- gerar;
- exportar.

### 44.4 Requisitos

- cobertura;
- freshness;
- filtros registrados;
- auditoria da exportação.

---

## 45. SCR-19 — Auditoria

### 45.1 Fonte

Audit logs.

### 45.2 Natureza

Investigação sistêmica.

### 45.3 Diferença da timeline

Timeline = fato de saúde.

Auditoria = operação no sistema.

### 45.4 Acesso

Restrito.

---

## 46. SCR-20 — Registro Legado

### 46.1 Fonte

LegacyHealthRecord.

### 46.2 Natureza

Consulta preservada.

### 46.3 Ações

- ver origem;
- ver payload permitido;
- abrir registro curado;
- reportar conflito.

### 46.4 Proibição

Editar.

---

## 47. SCR-21 — Perfil K9: resumo Health

### 47.1 Fonte

ReadinessSnapshot e resumos.

### 47.2 Conteúdo

- prontidão;
- restrições;
- último peso;
- agenda;
- plano alimentar;
- casos.

### 47.3 Ação

```text
Abrir Saúde
```

### 47.4 Limite

Não manter prontuário paralelo.

---

# Parte III — Lifecycles e ações

## 48. Matriz de lifecycle

| Entidade | Inicial | Intermediários | Terminais |
|---|---|---|---|
| ClinicalCase | open | under_investigation, under_treatment, monitoring | discharged, cancelled |
| ClinicalEvent | draft | — | final, cancelled |
| ExamProcess | requested | collected, resulted, interpreted | impact_assessed, cancelled |
| TreatmentProtocol | active | paused | completed, cancelled |
| DoseAdministration | — | — | administered, skipped, cancelled |
| NutritionPlan | active | — | superseded, cancelled |
| OperationalRestriction | active | — | ended, cancelled |
| HealthScheduleItem | open | — | completed, cancelled |
| VaccinationRecord | final | — | cancelled |
| WeightAssessment | fato | — | imutável/correção contratual |
| MealLog | fato | — | imutável/cancelamento contratual |
| SupplementLog | fato | — | imutável/cancelamento contratual |
| HealthDocument | ativo | — | estado conforme política |
| LegacyHealthRecord | read-only | — | não aplicável |
| ReadinessSnapshot | projeção | — | não aplicável |
| TimelineItem | projeção | — | não aplicável |

---

## 49. Matriz de criação

| Entidade | Web | Mobile | Backend direto |
|---|---|---|---|
| ClinicalCase | possível | possível | valida |
| ClinicalEvent | transcrição possível | principal operacional | valida |
| Amendment | possível | possível | valida |
| ExamProcess | possível | possível | valida |
| TreatmentProtocol | principal gerencial | consulta | valida |
| DoseAdministration | exceção | principal | valida/deduplica |
| WeightAssessment | pendente | possível | valida |
| NutritionPlan | principal | não | valida |
| MealLog | não | principal | valida/deduplica |
| SupplementLog | não | principal | valida/deduplica |
| HealthDocument | principal possível | possível | valida/storage |
| OperationalRestriction | transcrição possível | possível | valida |
| HealthScheduleItem | principal | possível | valida |
| VaccinationRecord | pendente | possível | valida |
| LegacyHealthRecord | não | não | migração Admin |
| ReadinessSnapshot | não | não | Function |
| TimelineItem | não | não | Function |

---

## 50. Matriz de alteração

| Entidade | Alteração permitida |
|---|---|
| ClinicalCase | transições auditadas e campos administrativos permitidos |
| ClinicalEvent draft | edição antes de finalizar |
| ClinicalEvent final | não; usar amendment |
| ExamProcess | transições válidas |
| TreatmentProtocol | transições e campos permitidos |
| DoseAdministration | não sobrescrever; correção contratual |
| WeightAssessment | não sobrescrever silenciosamente |
| NutritionPlan | update administrativo ou replace estrutural |
| MealLog | sem overwrite |
| SupplementLog | sem overwrite |
| HealthDocument | metadados limitados |
| OperationalRestriction | encerrar/cancelar; não editar decisão final silenciosamente |
| HealthScheduleItem | open pode reagendar; terminal não reabre |
| VaccinationRecord | cancelamento/retificação contratual |
| LegacyHealthRecord | cliente não altera |
| Projeções | cliente não altera |

---

## 51. Ações críticas e fonte de validação

| Ação | Fonte mínima |
|---|---|
| iniciar turno com K9 | restrições canônicas + política offline |
| selecionar K9 para ocorrência | restrições canônicas |
| encerrar restrição | restriction atual + evidence |
| reabrir caso | ClinicalCase canônico |
| concluir agenda | item canônico + execução, quando aplicável |
| substituir plano | NutritionPlan ativo canônico |
| registrar dose | protocolo ativo + ocorrência |
| registrar refeição planejada | plano/occurrence canônicos |
| alterar tratamento | protocolo canônico |
| exportar clínico | capability + escopo |

Summary nunca é a única autoridade para ação crítica.

---

# Parte IV — Capabilities conceituais

## 52. Classificação

As capabilities abaixo são propostas de modelagem Web.

Somente `health.manage_nutrition_plan` está explicitamente validada no trabalho pós-Foundation já auditado.

As demais deverão ser reconciliadas com:

- inventário atual;
- roles;
- Rules;
- Functions;
- permission matrix;
- decisão humana.

---

## 53. Leitura

- `health.view_overview`;
- `health.view_readiness`;
- `health.view_restrictions`;
- `health.view_schedule`;
- `health.view_clinical_cases`;
- `health.view_treatments`;
- `health.view_nutrition`;
- `health.view_weight`;
- `health.view_vaccination`;
- `health.view_documents`;
- `health.view_history`;
- `health.view_reports`;
- `health.view_audit`.

---

## 54. Gestão

- `health.manage_schedule`;
- `health.open_clinical_case`;
- `health.manage_clinical_case`;
- `health.reopen_case`;
- `health.manage_exam_process`;
- `health.manage_treatment_protocol`;
- `health.create_restriction`;
- `health.end_restriction`;
- `health.manage_nutrition_plan`;
- `health.manage_documents`;
- `health.transcribe_external_record`.

---

## 55. Execução

Possíveis capabilities separadas:

- `health.record_weight`;
- `health.record_vaccination`;
- `health.record_dose`;
- `health.record_meal`;
- `health.record_supplement`;
- `health.complete_schedule`.

A existência Web dessas ações não está aprovada.

---

## 56. Auditoria e exportação

- `health.export_reports`;
- `health.export_clinical_data`;
- `health.view_audit`;
- `health.view_sensitive_data`;
- `health.download_documents`.

---

# Parte V — Estados técnicos por domínio

## 57. Matriz de suporte

| Domínio | empty | partial | degraded | stale | legacy | conflict |
|---|---:|---:|---:|---:|---:|---:|
| Prontidão | sim | sim | sim | sim | sim | sim |
| Restrições | sim | sim | sim | possível | sim | sim |
| Agenda | sim | sim | possível | possível | sim | sim |
| Clínico | sim | sim | possível | possível | sim | sim |
| Exames | sim | sim | possível | possível | sim | sim |
| Tratamentos | sim | sim | possível | possível | sim | sim |
| Nutrição | sim | sim | sim | possível | sim | sim |
| Peso | sim | sim | possível | possível | sim | sim |
| Vacinação | sim | sim | possível | possível | sim | sim |
| Documentos | sim | sim | possível | possível | sim | sim |
| Timeline | sim | sim | sim | sim | sim | sim |
| Relatórios | sim | sim | sim | sim | sim | sim |
| Auditoria | sim | sim | possível | possível | não | possível |

---

## 58. Regras transversais

1. `empty` pressupõe consulta bem-sucedida.
2. `error` não equivale a empty.
3. `legacy` descreve origem.
4. `stale` descreve freshness.
5. `conflict` bloqueia decisão incompatível.
6. `partial` preserva o que carregou.
7. `degraded` explica fallback.
8. `forbidden` não expõe dados.
9. `not_found` não redireciona silenciosamente.
10. loading não exibe zeros falsos.

---

# Parte VI — Dados e relações

## 59. Grafo conceitual

```text
Dog
├── health_summary/current
├── operational_restrictions
├── health_schedule
├── clinical_cases
│   ├── events
│   │   └── amendments
│   └── exams
├── treatment_protocols
│   └── doses
├── weight_records
├── nutrition_plans
├── meal_logs
├── supplement_logs
├── vaccination_records
├── health_documents
├── legacy_health_records
└── health_timeline
```

---

## 60. Relações obrigatórias

### 60.1 Caso e evento

Um ClinicalEvent pertence a um ClinicalCase.

### 60.2 Caso e exame

ExamProcess pertence ao contexto de um caso.

### 60.3 Caso e tratamento

TreatmentProtocol referencia caso.

### 60.4 Tratamento e dose

DoseAdministration pertence a protocolo.

### 60.5 Restrição e evidência

OperationalRestriction referencia profissional e documento.

### 60.6 Agenda e origem

HealthScheduleItem pode referenciar:

- protocolo;
- caso;
- exame;
- prevenção;
- criação manual.

### 60.7 Documento e entidades

HealthDocument é referenciado por IDs.

### 60.8 Nutrição e execução

MealLog/SupplementLog referenciam plano e ocorrência quando aplicável.

### 60.9 Projeções e fontes

Summary e timeline guardam referências suficientes para drill-down.

---

## 61. Relações não permitidas

- evento clínico sem caso;
- dose sem protocolo;
- restrição sem evidência exigida;
- URL inline substituindo HealthDocument;
- plano ativo sobrescrito por mudança estrutural;
- timeline como fonte de write;
- summary como fonte canônica;
- agenda concluída sem lifecycle;
- fato legado editado por fluxo canônico;
- profissional externo representado pelo usuário interno.

---

# Parte VII — Contratos de componentes

## 62. Componentes de domínio

Componentes deverão ser organizados por conceito.

Exemplos:

- `ReadinessBadge`;
- `ReadinessReasons`;
- `RestrictionSummary`;
- `RestrictionLifecycle`;
- `ScheduleTemporalState`;
- `ClinicalCaseStatus`;
- `ClinicalEventCard`;
- `ExamStageStepper`;
- `TreatmentProtocolSummary`;
- `DoseHistory`;
- `NutritionPlanState`;
- `WeightTrend`;
- `VaccinationHistory`;
- `HealthDocumentLink`;
- `LegacySourceBadge`;
- `ProjectionFreshness`;
- `ConflictBanner`.

---

## 63. Componentes que não devem existir como autoridade

Evitar:

- `HealthScore`;
- `GenericHealthEventForm`;
- `UniversalHealthStatus`;
- `EditableClinicalTimeline`;
- `ClientReadinessCalculator`;
- `LegacyCanonicalMerger`;
- `LastHealthFieldsWriter`.

---

## 64. Formulários por comando

| Comando | Formulário |
|---|---|
| abrir caso | `OpenClinicalCaseForm` |
| registrar consulta | `RecordConsultationForm` |
| solicitar exame | `RequestExamForm` |
| registrar resultado | `RecordExamResultForm` |
| criar tratamento | `CreateTreatmentProtocolForm` |
| emitir restrição | `IssueRestrictionForm` |
| encerrar restrição | `EndRestrictionForm` |
| criar agenda | `CreateHealthScheduleForm` |
| criar plano | `CreateNutritionPlanForm` |
| substituir plano | `ReplaceNutritionPlanForm` |
| registrar documento | `UploadHealthDocumentForm` |
| adicionar amendment | `CreateClinicalAmendmentForm` |

Nomes são conceituais.

---

# Parte VIII — Reutilização do legado

## 65. Classificação de componentes antigos

### 65.1 Reutilização provável

- elementos de design system;
- tabela;
- cards;
- upload;
- filtros;
- layout;
- formatadores;
- skeletons;
- componentes acessíveis.

### 65.2 Reutilização condicionada

- HealthEventHub;
- formulários de vacina/peso;
- readers de documentos;
- gráficos;
- tabs do prontuário.

### 65.3 Substituição recomendada

- índice de saúde;
- readiness calculada no cliente;
- formulário genérico;
- listeners agregando N fontes;
- writes `_last_*`;
- estrutura monolítica;
- permissões genéricas como autoridade.

### 65.4 Única implementação funcional preservada como capacidade

- gestão de NutritionPlan na branch pós-Foundation.

---

## 66. Regra de reaproveitamento

Código antigo só será reaproveitado se:

1. não contrariar o domínio;
2. não introduzir write direto;
3. não usar coleção legada como canônica;
4. não depender de enum inventado;
5. respeitar capability;
6. passar por testes;
7. possuir custo menor que reescrita;
8. não duplicar rota;
9. não preservar UX inválida;
10. receber aprovação no plano de migração.

---

# Parte IX — Decisões e pendências

## 67. Decisões fixadas

1. Tela não é agregado.
2. Projeção não é fonte canônica.
3. Prontidão não é calculada na Web.
4. Restrição canônica prevalece em ação crítica.
5. Caso clínico é agregado longitudinal.
6. Evento final é imutável.
7. Amendment não substitui o original.
8. ExamProcess possui lifecycle próprio.
9. Tratamento usa protocolo estruturado.
10. Dose é fato de execução.
11. NutritionPlan é gerido pela Web.
12. MealLog e SupplementLog são executados prioritariamente no Mobile.
13. Agenda é planejamento.
14. VaccinationRecord é fato; vencimento é agenda/projeção.
15. LegacyHealthRecord é read-only para clientes.
16. Timeline é projection.
17. Cockpit combina entidades sem criar nova autoridade.
18. Perfil K9 apenas resume e direciona.
19. Capability governa ações.
20. Formulários são específicos por comando.

---

## 68. Decisões humanas pendentes

### 68.1 Writes Web

- peso;
- vacinação;
- conclusão preventiva;
- doses;
- consulta;
- transcrição de fatos externos.

### 68.2 Profissionais

- quais ações exigem documento;
- quais registros profissionais são obrigatórios;
- quem valida identidade externa.

### 68.3 Permissões

- capabilities finais;
- atribuição por perfil;
- dados sensíveis;
- exportações;
- auditoria.

### 68.4 Rotas

- subrotas do cockpit;
- Auditoria separada;
- detalhe de documento;
- detalhe legado.

### 68.5 Lifecycles

Este documento não altera lifecycles canônicos.

Divergências deverão ser resolvidas nos documentos de autoridade.

### 68.6 Legado

- quais collections possuem dados reais;
- como deduplicar;
- quais registros serão migrados;
- quais permanecerão apenas consultáveis.

---

## 69. Itens fora de escopo

- schema definitivo novo;
- callable definitiva;
- Rules;
- código;
- mockup;
- design visual;
- algoritmo;
- IA clínica;
- recomendação veterinária;
- interpretação de exames;
- automação de prontidão fora da política;
- migração;
- exclusão;
- merge;
- deploy.

---

# Parte X — Gates

## 70. Gate DSM-1 — Catálogo de entidades

Confirmar que todas as entidades canônicas relevantes estão representadas.

## 71. Gate DSM-2 — Lifecycles

Validar estados e transições com ADRs.

## 72. Gate DSM-3 — Matriz de plataforma

Aprovar Web × Mobile × Backend.

## 73. Gate DSM-4 — Telas

Validar que nenhuma tela duplica autoridade.

## 74. Gate DSM-5 — Writes

Resolver ações pendentes antes de formulários definitivos.

## 75. Gate DSM-6 — Capabilities

Reconciliar nomes conceituais com contratos reais.

## 76. Gate DSM-7 — Fontes

Criar `HEALTH_WEB_DATA_SOURCE_MATRIX.md`.

## 77. Gate DSM-8 — Aprovação humana

Aprovar o modelo antes dos mockups definitivos.

---

## 78. Critérios de aprovação

Este documento estará aprovado quando:

- cada tela possuir fontes identificadas;
- cada ação possuir entidade-alvo;
- cada lifecycle respeitar o domínio;
- nenhuma projection receber write;
- nenhum fato final for editável;
- Nutrição preservar contratos;
- agenda e execução estiverem separadas;
- legado estiver isolado;
- fronteiras de plataforma estiverem claras;
- capabilities pendentes estiverem visíveis;
- decisões não aprovadas não forem tratadas como concluídas.

---

## 79. Documentos derivados

A partir deste modelo, deverão ser produzidos:

1. `HEALTH_WEB_DATA_SOURCE_MATRIX.md`;
2. `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`;
3. `HEALTH_WEB_CAPABILITIES_INVENTORY.md`;
4. `HEALTH_WEB_PERMISSION_MATRIX.md`;
5. `HEALTH_WEB_READINESS_POLICY.md`;
6. `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`;
7. `HEALTH_WEB_TEST_STRATEGY.md`;
8. `HEALTH_WEB_MOCKUP_PLAN.md`.

---

## 80. Próximo documento recomendado

O próximo documento será:

```text
docs/health/web/architecture/HEALTH_WEB_DATA_SOURCE_MATRIX.md
```

Ele deverá responder, para cada campo exibido:

- nome do campo;
- significado;
- tela;
- entidade;
- path;
- autoridade;
- canônico ou legado;
- write owner;
- reader;
- fallback;
- freshness;
- sensibilidade;
- comportamento de erro;
- estado de migração.

Esse documento será a barreira direta contra:

- leitura da collection errada;
- fallback silencioso;
- duplicação;
- cálculo client-side;
- field drift;
- integração acidental com o legado.

---

## 81. Status

| Item | Estado |
|---|---|
| Catálogo de entidades | Concluído |
| Catálogo de telas | Concluído |
| Matriz entidade × tela | Concluída |
| Lifecycles | Reconciliados documentalmente |
| Fronteiras de plataforma | Propostas |
| Capabilities | Conceituais, pendentes |
| Writes Web | Parcialmente pendentes |
| Auditoria humana | Pendente |
| Aprovação para mockups | Não concedida |
| Aprovação para implementação | Não concedida |

---

## 82. Conclusão

O Health Web v1 passa a possuir um modelo explícito que conecta o domínio canônico à experiência Web.

A nova interface não será construída a partir de telas.

Ela será construída a partir de:

```text
entidades com autoridade
+ lifecycles aprovados
+ projections server-side
+ comandos auditáveis
+ fronteiras de plataforma
+ capabilities
```

A única capacidade Web já desenvolvida dentro dessa lógica é a gestão de Plano Alimentar.

Todo o restante poderá ser reconstruído sem obrigação de compatibilidade visual com o legado, mas com obrigação de:

- preservar dados;
- respeitar o domínio;
- impedir writes indevidos;
- explicar origem;
- manter rastreabilidade;
- separar gestão de execução.

O próximo passo documental é definir a autoridade de cada dado exibido, campo por campo.
