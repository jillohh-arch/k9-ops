# K9 Ops Web — Health Web v1 Data Source Matrix

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_DATA_SOURCE_MATRIX.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Autoridade de dados, readers, writers, fallbacks e estados |
| Repositório | `github.com/jillohh-arch/k9-ops` |
| Baseline | `HEALTH_WEB_BASELINE.md` |
| Arquitetura-alvo | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Arquitetura da informação | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` |
| Modelo domínio-telas | `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md` |
| Autoridade de schema | `HEALTH_V1_FIRESTORE_SCHEMA.md` e ADRs canônicas |
| Fora de escopo | Implementação, Rules, Functions, migração real, merge e deploy |

---

## 1. Propósito

Esta matriz define a autoridade de cada informação que poderá ser exibida ou manipulada pelo Health Web v1.

Ela responde:

- de onde o dado vem;
- qual entidade é sua autoridade;
- qual path Firestore é esperado;
- quem pode escrevê-lo;
- quem pode lê-lo;
- se é canônico, projeção, derivado, legado ou administrativo;
- qual fallback é permitido;
- quando a interface deve usar `empty`, `partial`, `degraded`, `stale`, `legacy` ou `conflict`;
- quais informações não podem ser calculadas no cliente;
- quais campos antigos não devem continuar como fonte;
- quais writes precisam passar por callable ou comando Backend;
- quais dados possuem sensibilidade especial.

A matriz é uma barreira de implementação.

Nenhum campo novo deverá ser adicionado a uma tela Health sem que sua autoridade seja registrada aqui ou em revisão posterior deste documento.

---

## 2. Regra cardinal

> A interface não escolhe a fonte mais conveniente. Ela lê a fonte autorizada pelo domínio.

Quando a fonte autorizada não estiver disponível, a interface deverá comunicar o estado técnico correto.

Ela não deverá:

- buscar um campo legado semelhante;
- usar um valor denormalizado antigo;
- calcular uma resposta clínica;
- interpretar ausência como normalidade;
- ocultar divergência;
- gravar projections;
- corrigir Firestore diretamente pelo cliente;
- usar uma URL de arquivo como identidade documental;
- converter erro em `not_evaluated`;
- converter múltiplos registros em uma seleção automática.

---

## 3. Classes de autoridade

| Classe | Significado | Pode receber write do cliente? |
|---|---|---:|
| Fonte canônica | agregado ou fato oficial do domínio | somente pelo comando autorizado |
| Projeção | visão materializada server-side | não |
| Derivado server-side | campo mantido por Function | não diretamente |
| Derivado de leitura | classificação determinística aprovada | não é persistido |
| Legado read-only | dado pré-canônico preservado | não |
| Administrativo | migração, receipt ou auditoria | somente Backend/Admin SDK |
| Cache | otimização reconstruível | nunca como autoridade |

---

## 4. Ordem de preferência

A ordem geral é:

```text
fonte canônica
→ projection oficial
→ derivação de leitura aprovada
→ legado explicitamente identificado
→ indisponível
```

Esta ordem não significa que toda tela pode usar qualquer nível.

Exemplos:

- prontidão para display usa projection;
- prontidão para autorização consulta restrição canônica;
- Histórico usa timeline projection;
- plano alimentar usa fonte canônica e só usa legado com badge;
- `storage_url` é cache e nunca substitui `storage_path`;
- `_last_weight_at` não é fallback autorizado para `weight_records`.

---

## 5. Política de fallback

### 5.1 Fallback permitido

Um fallback só é permitido quando:

1. está documentado nesta matriz;
2. não altera semântica;
3. é identificado;
4. não autoriza ação crítica;
5. possui teste;
6. não escreve de volta na fonte;
7. preserva rastreabilidade.

### 5.2 Fallback proibido

- score legado para prontidão;
- `_last_*` em `dogs`;
- `health_logs` raiz como Health v1;
- `health_events` antigo como ClinicalEvent;
- documento raiz sem classificação como canônico;
- validade universal de 365 dias para vacina;
- “último registro encontrado” quando há conflito;
- timeline montada no browser;
- múltiplos planos ativos reduzidos ao primeiro;
- absence → operational.

### 5.3 Sem fallback

Quando a matriz disser “Nenhum”, a tela deverá usar estado técnico adequado.

---

## 6. Política de erro e parcialidade

| Situação | Estado esperado |
|---|---|
| consulta bem-sucedida sem registros | `empty` |
| uma entre várias fontes falha | `partial` |
| fonte alternativa aprovada é usada | `degraded` |
| projection excede freshness | `stale` |
| dado vem de fonte pré-canônica | `legacy` |
| fontes incompatíveis coexistem | `conflict` |
| usuário não autenticado | `unauthorized` |
| autenticado sem capability | `forbidden` |
| entidade não existe | `not_found` |
| falha não recuperada | `error` |

---

## 7. Política de freshness

### 7.1 Projeções

`health_summary` e `health_timeline` devem expor metadados temporais suficientes para avaliar atualização.

### 7.2 Fonte canônica

Fonte canônica não recebe label stale apenas por ser antiga; o que importa é seu lifecycle e vigência.

### 7.3 Após mutação

A interface pode informar:

> Registro salvo. A visão consolidada está sendo atualizada.

Ela não deve simular o resultado da projection.

### 7.4 Ações críticas

Mesmo que o summary esteja atualizado, ações críticas validam restrições canônicas server-side.

---

## 8. Dados sensíveis

Campos que podem conter PII ou conteúdo clínico sensível incluem:

- `ProfessionalIdentity`;
- `RecordedBy`;
- documentos;
- observações clínicas;
- conteúdo de eventos;
- resultados;
- interpretação;
- motivo de restrição;
- histórico de auditoria.

A UI deverá aplicar:

- capability;
- minimização;
- mascaramento quando previsto;
- URLs temporárias;
- exportação controlada;
- logs sanitizados.

---

## 9. Matriz executiva de fontes

| Domínio | Fonte de leitura principal | Fonte de write | Classificação |
|---|---|---|---|
| Prontidão | `health_summary/current` | Function | projection |
| Autorização operacional | `operational_restrictions` ativas | Backend | canônico |
| Casos clínicos | `clinical_cases` | comandos Web/Mobile | canônico |
| Eventos clínicos | `clinical_cases/.../events` | comandos Web/Mobile | canônico |
| Amendments | subcollection de amendments | create-only | canônico append-only |
| Exames | `clinical_cases/.../exams` | comandos Web/Mobile | canônico |
| Tratamentos | `treatment_protocols` | Web via Backend | canônico |
| Doses | `treatment_protocols/.../doses` | Mobile via Backend | canônico |
| Peso | `weight_records` | Mobile; Web pendente | canônico |
| Plano alimentar | `nutrition_plans` | Web via callables | canônico |
| Refeições | `meal_logs` | Mobile via Backend | canônico |
| Suplementos | `supplement_logs` | Mobile via Backend | canônico |
| Documentos | `health_documents` | Web/Mobile via Backend | canônico |
| Vacinação | `vaccination_records` | Mobile/Web conforme contrato | canônico |
| Agenda | `health_schedule` | Function/Web/Mobile | canônico |
| Histórico | `health_timeline` | Function | projection |
| Legado | `legacy_health_records` | Admin SDK auditado | read-only |
| Migração | `_migrations/health_v1/batches` | Migration Function | administrativo |
| Auditoria/receipts | contrato Backend | Backend | administrativo |

---

## 10. Matriz campo de interface → autoridade

A tabela abaixo contém os campos de maior relevância funcional. Campos internos e todos os campos de schema aparecem no inventário detalhado posterior.
| Tela/Área | Informação | Entidade | Campo/path lógico | Write owner | Classe | Fallback permitido | Regra de UI |

|---|---|---|---|---|---|---|---|

| Visão Geral | Contagem por estado de prontidão | ReadinessSnapshot | health_summary/current.readiness_status | Function | Projeção | Nenhum | Se uma parte falhar: partial; nunca usar score legado |

| Visão Geral | K9s temporariamente inaptos | ReadinessSnapshot | health_summary/current.readiness_status | Function | Projeção | Nenhum | Filtrar enum temporarily_unfit |

| Visão Geral | Prioridade por restrição absoluta | OperationalRestriction | operational_restrictions.level + status | Backend/usuário autorizado | Canônico | Nenhum | Para ação crítica, consultar fonte canônica |

| Visão Geral | Agenda atrasada | HealthScheduleItem | health_schedule.lifecycle_status + scheduled_for + due_until + timezone + configuração | Backend/read model | Canônico + derivação | Nenhum | Derivar na leitura; nunca persistir overdue |

| Visão Geral | Casos clínicos ativos | ClinicalCase | clinical_cases.clinical_status | Web/Mobile via Backend | Canônico | Nenhum | Excluir discharged/cancelled conforme filtro |

| Visão Geral | Tratamentos ativos | TreatmentProtocol | treatment_protocols.status | Web via Backend | Canônico | Nenhum | Somente status active |

| Visão Geral | Plano alimentar ativo | NutritionPlan | nutrition_plans.status | Web via callable | Canônico | Leitura legada identificada | Múltiplos ativos => conflict |

| Visão Geral | Atividade recente | HealthTimelineItem | health_timeline | Function | Projeção | Nenhum | Paginar; drafts não entram |

| Prontidão | Estado oficial | ReadinessSnapshot | readiness_status | Function | Projeção | Nenhum | Somente cinco estados |

| Prontidão | Label de prontidão | ReadinessSnapshot | readiness_label | Function | Projeção | Mapeamento local apenas se enum válido | Não criar novo estado |

| Prontidão | Razão principal | ReadinessSnapshot | readiness_reason | Function | Projeção | Nenhum | Ausência => 'razão indisponível', não inferir |

| Prontidão | Última avaliação | ReadinessSnapshot | last_evaluated_at / readiness_updated_at | Function | Projeção | Nenhum | Usar label temporal explícito |

| Prontidão | Restrições ativas resumidas | ReadinessSnapshot | active_restrictions | Function | Projeção | Consulta canônica no drill-down | Summary para display, não autorização |

| Prontidão | Completude de dados | ReadinessSnapshot | data_completeness | Function | Projeção | Nenhum | Não chamar de score |

| Prontidão | Freshness | ReadinessSnapshot | updated_at / readiness_updated_at | Function | Projeção | Nenhum | Excedeu política => stale |

| Cockpit/Restrições | Nível | OperationalRestriction | level | Usuário autorizado via Backend | Canônico | Nenhum | absolute > partial > attention |

| Cockpit/Restrições | Categoria | OperationalRestriction | category | Usuário autorizado via Backend | Canônico | Nenhum | Enum do domínio |

| Cockpit/Restrições | Descrição | OperationalRestriction | description | Usuário autorizado via Backend | Canônico | Nenhum | Conteúdo profissional transcrito |

| Cockpit/Restrições | Atividades restringidas | OperationalRestriction | activities_restricted | Usuário autorizado via Backend | Canônico | Lista vazia | Não inferir lista |

| Cockpit/Restrições | Profissional emissor | OperationalRestriction | professional | Usuário autorizado via Backend | Canônico/PII | Nenhum | Separar de recorded_by |

| Cockpit/Restrições | Documento de origem | OperationalRestriction | source_document | Usuário autorizado via Backend | Canônico | Nenhum | Resolver por HealthDocument |

| Cockpit/Restrições | Fim previsto | OperationalRestriction | expected_end | Usuário autorizado via Backend | Canônico | Sem data | Passado não encerra restrição |

| Cockpit/Restrições | Fim real | OperationalRestriction | actual_end | Backend | Canônico | Nenhum | Somente ended |

| Cockpit/Restrições | Status | OperationalRestriction | status | Backend | Canônico | Nenhum | active/ended/cancelled |

| Agenda | Tipo | HealthScheduleItem | schedule_type | Function/Web/Mobile via Backend | Canônico | Nenhum | Enum aprovado |

| Agenda | Título | HealthScheduleItem | title | Function/Web/Mobile via Backend | Canônico | Nenhum | Não usar tipo como título quando título existe |

| Agenda | Programado para | HealthScheduleItem | scheduled_for | Function/Web/Mobile via Backend | Canônico | Nenhum | Converter no timezone do item |

| Agenda | Limite efetivo | HealthScheduleItem | due_until ?? resolveTolerance(...) | Backend/read contract | Derivado autorizado | Nenhum | Sem default universal |

| Agenda | Estado temporal | HealthScheduleItem | lifecycle_status + datas + timezone + config | Read model | Derivado | Nenhum | Primeira condição da precedência vence |

| Agenda | Lifecycle | HealthScheduleItem | lifecycle_status | Backend | Canônico | Nenhum | open/completed/cancelled |

| Agenda | Origem | HealthScheduleItem | source_type + source_id | Backend | Canônico | manual | Não perder vínculo |

| Agenda | Conclusão | HealthScheduleItem | completed_at + completed_by | Backend | Canônico | Nenhum | Somente completed |

| Clínico | Status do caso | ClinicalCase | clinical_status | Backend | Canônico | Nenhum | Lifecycle aprovado |

| Clínico | Título | ClinicalCase | title | Web/Mobile via Backend | Canônico | Nenhum | Não sintetizar de evento |

| Clínico | Abertura | ClinicalCase | opened_at + opened_by + opening_type | Backend | Canônico | Nenhum | Mostrar tipo de abertura |

| Clínico | Profissional principal | ClinicalCase | primary_professional | Web/Mobile via Backend | Canônico/PII | Nenhum | Separar de executor |

| Clínico | Última atividade | ClinicalCase | last_event_at | Function | Derivado server-side | opened_at | Fallback explícito apenas para ordenação |

| Clínico | Restrições ativas | ClinicalCase | has_active_restriction | Function | Derivado | Consultar restrictions | Flag é resumo |

| Clínico | Tratamentos ativos | ClinicalCase | active_treatments_count | Function | Derivado | Consulta protocols | Não calcular com listeners N+1 na lista |

| Caso clínico | Evento clínico | ClinicalEvent | event_type/status/occurred_at/content | Web/Mobile via Backend | Canônico | Nenhum | Finais são imutáveis |

| Caso clínico | Profissional do evento | ClinicalEvent | professional | Web/Mobile via Backend | Canônico/PII | Nenhum | Não substituir por recorded_by |

| Caso clínico | Impacto operacional | ClinicalEvent | operational_impact | Web/Mobile via Backend | Canônico | Nenhum | Não calcular prontidão no cliente |

| Caso clínico | Anexos | ClinicalEvent | attachment_refs | Web/Mobile via Backend | Canônico | [] | IDs, nunca URLs inline |

| Caso clínico | Amendments | ClinicalEventAmendment | amendments subcollection | Web/Mobile via Backend | Canônico append-only | Nenhum | Original sempre visível |

| Exame | Etapa atual | ExamProcess | current_stage | Backend | Canônico | Nenhum | Transições válidas |

| Exame | Tipo | ExamProcess | exam_type | Web/Mobile via Backend | Canônico | Nenhum | Enum aprovado |

| Exame | Solicitação | ExamProcess | requested_at/request_professional/request_reason/urgency | Web/Mobile via Backend | Canônico | Nenhum | Resultado não substitui solicitação |

| Exame | Coleta | ExamProcess | collected_at/collected_by/collection_site | Web/Mobile via Backend | Canônico | Nenhum | Somente após etapa válida |

| Exame | Resultado | ExamProcess | resulted_at/result_document_id/result_summary | Web/Mobile via Backend | Canônico | Nenhum | Documento por ID |

| Exame | Interpretação | ExamProcess | interpreted_at/interpretation_professional/interpretation_text | Web/Mobile via Backend | Canônico | Nenhum | Não inferir automaticamente |

| Exame | Impacto avaliado | ExamProcess | impact_assessed_at/operational_impact/restrictions_issued | Backend | Canônico | Nenhum | Restrições são agregados próprios |

| Tratamento | Status | TreatmentProtocol | status | Backend | Canônico | Nenhum | active/paused/completed/cancelled |

| Tratamento | Medicamento | TreatmentProtocol | medication_name | Web via Backend | Canônico | Nenhum | Prescrição externa transcrita |

| Tratamento | Dose | TreatmentProtocol | dose | Web via Backend | Canônico | dosage_display apenas apresentação | Não calcular dose clínica |

| Tratamento | Agenda do protocolo | TreatmentProtocol | schedule | Web via Backend | Canônico | frequency_display apenas apresentação | Timezone/tolerância estruturados |

| Tratamento | Profissional | TreatmentProtocol | professional | Web via Backend | Canônico/PII | Nenhum | Obrigatório |

| Tratamento | Receita | TreatmentProtocol | source_document | Web via Backend | Canônico | Nenhum | Obrigatório |

| Tratamento | Próxima dose | TreatmentProtocol | next_dose_at | Function | Derivado | HealthScheduleItem | Se divergente => conflict |

| Tratamento | Doses realizadas | TreatmentProtocol | doses_administered | Function | Derivado | Consulta doses | Lista não deve fazer N+1 |

| Dose | Status | DoseAdministration | status | Mobile via Backend | Canônico | Nenhum | administered/skipped/cancelled |

| Dose | Ocorrência planejada | DoseAdministration | planned_dose_id + schedule_item_id | Backend/Mobile | Canônico | Nenhum | Identidade determinística |

| Dose | Executor | DoseAdministration | recorded_by/administered_by | Mobile via Backend | Canônico | Nenhum | Separar digitador de executor |

| Peso | Peso em kg | WeightAssessment | weight_kg | Mobile via Backend | Canônico | Nenhum | >0 |

| Peso | Data de medição | WeightAssessment | measured_at | Mobile via Backend | Canônico | Nenhum | Data efetiva |

| Peso | Contexto | WeightAssessment | context | Mobile via Backend | Canônico | routine | Fallback apenas de apresentação; não persistir se ausente |

| Peso | BCS | WeightAssessment | bcs | Mobile via Backend | Canônico | Nenhum | 1-9 quando presente |

| Peso | Faixa ideal | WeightAssessment | ideal_weight_min/max | Mobile/Backend | Canônico | Nenhum | Não inventar pela raça |

| Peso | Tendência | WeightAssessment | série de weight_records | Reader Web | Derivado de leitura | Nenhum | Não é diagnóstico |

| Nutrição | Status do plano | NutritionPlan | status | Web via callable | Canônico | Leitura legada identificada | Múltiplos ativos => conflict |

| Nutrição | Tipo de alimento | NutritionPlan | food_type | Web via callable | Canônico | Nenhum | Plano ativo |

| Nutrição | Quantidade diária | NutritionPlan | amount_grams_per_day | Web via callable | Canônico | Nenhum | Não somar logs como prescrição |

| Nutrição | Refeições por dia | NutritionPlan | meals_per_day | Web via callable | Canônico | Nenhum | Contrato do plano |

| Nutrição | Vigência | NutritionPlan | vigent_from/vigent_until | Web via callable | Canônico | Nenhum | Nome de campo vigente no schema |

| Nutrição | Hidratação | NutritionPlan | hydration_ml | Web via callable | Canônico | Nenhum | Opcional |

| Nutrição | Profissional | NutritionPlan | professional | Web via callable | Canônico/PII | Nenhum | Opcional conforme origem |

| Nutrição | Documento | NutritionPlan | source_document/attachment_refs | Web via callable | Canônico | Nenhum | IDs/refs |

| Nutrição | Refeição executada | MealLog | fed_at/period/amount_grams | Mobile via Backend | Canônico | Nenhum | Web apenas lê |

| Nutrição | Divergência | MealLog | divergence_percent/divergence_reason | Backend/Mobile | Canônico | Nenhum | Não recalcular sem contrato |

| Nutrição | Suplemento executado | SupplementLog | supplement_name/dose/administered_at | Mobile via Backend | Canônico | Nenhum | Web apenas lê |

| Vacinação | Vacina | VaccinationRecord | vaccine_name/vaccine_type | Mobile/Web via Backend | Canônico | Nenhum | Registro de aplicação |

| Vacinação | Status do registro | VaccinationRecord | record_status | Backend | Canônico | Nenhum | final/cancelled |

| Vacinação | Aplicada em | VaccinationRecord | applied_at | Mobile/Web via Backend | Canônico | Nenhum | Obrigatório se final |

| Vacinação | Validade | VaccinationRecord | validity_until | Mobile/Web via Backend | Canônico | Nenhum | Sem fallback 365 dias |

| Vacinação | Próxima dose | VaccinationRecord | next_due_at | Mobile/Web via Backend | Canônico | HealthScheduleItem gerado | Não classificar record como overdue |

| Vacinação | Lote/fabricante | VaccinationRecord | batch_number/manufacturer | Mobile/Web via Backend | Canônico | Nenhum | Opcional |

| Vacinação | Profissional | VaccinationRecord | professional | Mobile/Web via Backend | Canônico/PII | Nenhum | Quando aplicável |

| Documentos | Tipo | HealthDocument | document_type | Web/Mobile via Backend | Canônico | Nenhum | Enum aprovado |

| Documentos | Título | HealthDocument | title | Web/Mobile via Backend | Canônico | Nenhum | Obrigatório |

| Documentos | Arquivo | HealthDocument | storage_path | Web/Mobile via Backend | Canônico | Nenhum | storage_url é cache, nunca fonte |

| Documentos | MIME | HealthDocument | mime_type | Web/Mobile via Backend | Canônico | Nenhum | Validar upload |

| Documentos | Emissor | HealthDocument | issuer | Web/Mobile via Backend | Canônico | Nenhum | Opcional |

| Documentos | Vínculo | HealthDocument | case_id/event_id/exam_id | Web/Mobile via Backend | Canônico | Nenhum | Relação por IDs |

| Histórico | Tipo da timeline | HealthTimelineItem | timeline_type | Function | Projeção | Nenhum | Enum do projection contract |

| Histórico | Fonte | HealthTimelineItem | source_collection/source_id | Function | Projeção | Nenhum | Obrigatório para drill-down |

| Histórico | Data efetiva | HealthTimelineItem | occurred_at | Function | Projeção | Nenhum | Ordenação principal |

| Histórico | Data de registro | HealthTimelineItem | recorded_at | Function | Projeção | Nenhum | Mostrar quando divergir |

| Histórico | Projetado em | HealthTimelineItem | projected_at | Function | Projeção | Nenhum | Freshness |

| Histórico | Status | HealthTimelineItem | status | Function | Projeção | Nenhum | final/cancelled; drafts não entram |

| Histórico | Amendments | HealthTimelineItem | has_amendments/amendment_count/last_amended_at | Function | Projeção | Nenhum | Não criar status amended |

| Histórico | Registro legado | LegacyHealthRecord | original_collection/original_id/original_payload | Admin SDK migration | Legado read-only | Nenhum | Original imutável |

| Histórico | Visão normalizada | LegacyHealthRecord | normalized_view | Admin SDK auditado | Legado normalizado | Payload original | Sempre indicar origem |

| Auditoria | Operation ID | Audit log/receipt | operationId | Backend | Auditoria | Nenhum | Não confundir com entity ID |

| Auditoria | Ator | Audit log | actor/recorded_by | Backend | Auditoria | Nenhum | PII mínima necessária |

| Auditoria | Resultado | Audit log | result/status | Backend | Auditoria | Nenhum | Sucesso/falha/idempotent replay |

---

# Parte I — Contratos por tela

## 11. Visão Geral

### 11.1 Reader recomendado

A página deverá consumir projeções agregadas ou readers server-side adequados.

Ela não deverá abrir listeners independentes para cada K9 e cada subcollection.

### 11.2 Fontes

| Bloco | Autoridade |
|---|---|
| contagens de prontidão | `health_summary/current` por K9 ou projection agregada |
| restrições prioritárias | `operational_restrictions` / resumo projetado |
| agenda próxima | `health_schedule` |
| casos abertos | `clinical_cases` |
| tratamentos ativos | `treatment_protocols` |
| Nutrição | `nutrition_plans` |
| atividade recente | `health_timeline` |

### 11.3 Falha

- falha de uma área não zera as demais;
- bloco indisponível recebe estado local;
- falha de summary não recalcula prontidão;
- conflito nutricional permanece visível;
- dados legados não entram silenciosamente em métricas canônicas.

### 11.4 Campos proibidos como autoridade

- `health_logs`;
- `_last_vaccine_at`;
- `_last_exam_at`;
- `_last_weight_kg`;
- `_last_weight_at`;
- índice client-side.

---

## 12. Prontidão

### 12.1 Display

Fonte:

```text
dogs/{dogId}/health_summary/current
```

### 12.2 Autorização

Fonte:

```text
dogs/{dogId}/operational_restrictions
where status == active
```

### 12.3 Regra dupla

| Uso | Fonte |
|---|---|
| badge/lista/dashboard | summary |
| bloquear início/troca/escala | restrições canônicas via Backend |

### 12.4 Falha de summary

A UI mostra indisponibilidade.

Não mostra `not_evaluated`.

### 12.5 Conflito

Se summary e restrições divergirem:

- status `conflict`;
- destaque;
- ação crítica fail-closed;
- tentativa de refresh/reprojeção;
- auditoria técnica.

---

## 13. Cockpit individual

O cockpit combina fontes, mas cada card mantém sua autoridade.

| Card | Fonte |
|---|---|
| prontidão | summary |
| restrições | restrictions |
| casos | clinical_cases |
| tratamentos | protocols |
| agenda | health_schedule |
| peso | weight_records |
| vacinação | vaccination_records |
| Nutrição | nutrition_plans |
| documentos | health_documents |
| histórico | health_timeline |

O cockpit não grava um documento próprio com a composição.

---

## 14. Agenda

### 14.1 Campos persistidos

Somente o lifecycle e dados de planejamento definidos no schema.

### 14.2 Campos derivados

```text
scheduled
upcoming
today
pending
overdue
```

são calculados na leitura.

### 14.3 Regra temporal

```text
effective_due_until =
  due_until
  ?? resolveTolerance(schedule_type, scheduled_for, timezone)
```

Sem default universal.

### 14.4 Fallback proibido

- gravar `overdue: true`;
- usar tolerância única;
- classificar em UTC ignorando timezone;
- concluir automaticamente.

---

## 15. Clínico

### 15.1 Lista

Usa `clinical_cases`.

Flags como:

- `has_active_restriction`;
- `active_treatments_count`;
- `last_event_at`;

são server-managed.

### 15.2 Detalhe

Lê subcoleções e agregados relacionados pelo ID.

Não usa timeline como substituto do caso.

### 15.3 Eventos

- draft pode mudar;
- final é imutável;
- correction/addendum/complement são amendments;
- drafts não aparecem na timeline principal.

---

## 16. Exames

Cada etapa lê e escreve o `ExamProcess`.

O documento de resultado é uma referência a `HealthDocument`.

A interface não deverá usar:

- arquivo anexado como estado “resulted” sem comando;
- texto de interpretação como resultado bruto;
- resultado como decisão automática de prontidão.

---

## 17. Tratamentos e doses

### 17.1 Protocolo

Fonte canônica:

```text
dogs/{dogId}/treatment_protocols/{protocolId}
```

### 17.2 Doses

Fonte:

```text
dogs/{dogId}/treatment_protocols/{protocolId}/doses/{doseId}
```

### 17.3 Derivados

`doses_administered`, `doses_remaining` e `next_dose_at` são server-managed.

### 17.4 Conflito

Se `next_dose_at` divergir do item de agenda ou protocolo:

- não corrigir no cliente;
- mostrar conflict;
- investigar projection/reconciliation.

---

## 18. Peso

A série vem exclusivamente de `weight_records`.

Campos `_last_weight_*` no documento `dogs` não são fonte do Health Web v1.

### 18.1 Tendência

A tendência pode ser calculada para apresentação com os registros canônicos carregados, desde que:

- não produza diagnóstico;
- não seja persistida como verdade clínica;
- o período esteja explícito;
- a tabela original esteja disponível.

### 18.2 Ausência

Sem registros = empty.

Falha na consulta = error.

---

## 19. Nutrição

### 19.1 Canônico

```text
dogs/{dogId}/nutrition_plans/{planId}
```

### 19.2 Legado coordenado

Readers legados podem existir durante coexistência, mas:

- são identificados;
- não recebem write;
- não substituem plano canônico;
- múltiplos ativos não são resolvidos no browser.

### 19.3 Execução

`meal_logs` e `supplement_logs` são fatos Mobile.

A Web não cria esses registros como fluxo padrão.

---

## 20. Vacinação

Fonte canônica:

```text
dogs/{dogId}/vaccination_records/{vaccinationId}
```

### 20.1 Separação

| Conceito | Fonte |
|---|---|
| aplicação realizada | VaccinationRecord |
| próxima dose planejada | HealthScheduleItem |
| prontidão consolidada | ReadinessSnapshot |
| reação adversa | ClinicalCase/ClinicalEvent relacionado |

### 20.2 Proibição

Eventos clínicos de vacinação não são fonte de vacinação vigente.

---

## 21. Documentos

### 21.1 Identidade

`storage_path` é a identidade canônica.

`storage_url` é derivado/cache.

### 21.2 Reader

O reader deve:

1. validar acesso ao metadata;
2. obter URL temporária quando necessário;
3. não armazenar URL temporária como autoridade;
4. tratar arquivo ausente separadamente do metadata ausente.

### 21.3 Legado

URLs antigas permanecem no payload legado ou metadado de migração.

---

## 22. Histórico

Fonte:

```text
health_timeline
```

### 22.1 Proibição

Não montar histórico com listeners de:

- cases;
- events;
- exams;
- doses;
- refeições;
- documentos;
- schedule;
- legado;

no cliente.

### 22.2 Drill-down

Todo item deve preservar `source_collection` e `source_id`.

### 22.3 Amendments

Amendment altera metadados projetados, não o status para `amended`.

---

## 23. Auditoria e receipts

A fonte definitiva deverá ser especificada no contrato Backend.

A UI não deverá inferir auditoria a partir de `updated_at`.

Elementos mínimos:

- ator;
- ação;
- entidade;
- horário;
- resultado;
- operationId;
- request/correlation id;
- motivo;
- origem;
- replay idempotente, quando aplicável.

---

# Parte II — Fontes atuais e tratamento

## 24. Collections antigas identificadas

| Fonte atual/legada | Tratamento |
|---|---|
| root `health_logs` | não canônica; inventariar e migrar/preservar |
| `dogs/{dogId}/health_events` | migrar conservadoramente para legacy records |
| root `documentos` | migrar para health_documents ou preservar legado |
| `dogs/{dogId}/documents` | consolidar em health_documents |
| `dogs/{dogId}/weight_history` | read-only durante v1 |
| `dogs/{dogId}/feeding_events` | normalizar para meal_logs |
| `dogs/{dogId}/feedings` | read-only durante v1 |
| `nutritional_prescriptions` | normalizar para nutrition_plans |
| `nutrition_supplements` | normalizar para supplement_logs |
| root `vacinas` | migrar records completos; incompletos para legado |
| `_last_*` em dogs | aposentar como fonte |
| score/readiness client-side | apenas legado informativo, não decisor |

---

## 25. Política para readers de coexistência

Todo reader de coexistência deverá retornar um tipo explícito, por exemplo:

```text
canonical
legacy
empty
partial
degraded
conflict
error
```

Ele não deverá retornar apenas uma lista sem origem.

### 25.1 Metadados mínimos

- source;
- schema version;
- canonical id;
- legacy id;
- migration batch;
- warning;
- conflict reason;
- freshness.

---

## 26. Política para writes

### 26.1 Regra

Todo write canônico deve passar por:

- callable;
- command service;
- transação Backend;
- ou contrato explicitamente aprovado.

### 26.2 Proibido

- `setDoc` direto em projection;
- write best-effort em `dogs._last_*`;
- write em legacy;
- write em root collections antigas;
- fallback de capability;
- múltiplos writes independentes sem operação auditável.

### 26.3 Idempotência

Operações mutáveis devem usar `operationId` quando previsto.

Receipts devem permitir distinguir:

- primeira execução;
- replay idempotente;
- conflito;
- falha.

---

# Parte III — Inventário detalhado do schema canônico


## 2.1 — `clinical_cases/{caseId}`


**Path completo:** `dogs/{dogId}/clinical_cases/{caseId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile (abertura por intercorrência), Web (abertura por consulta/admin), Function (flags derivados).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `clinical_status` | string (enum) | ✅ | open, under_investigation, under_treatment, monitoring, discharged, cancelled | canônico |

| `title` | string | ✅ | Ex: "Lesao MPD", "Otite bilateral" | canônico |

| `opened_at` | timestamp | ✅ |  | canônico |

| `opened_by` | RecordedBy | ✅ | Ref ao criador original | canônico |

| `opening_event_id` | string | ✅ | Ref ao primeiro evento | canônico |

| `opening_type` | string (enum) | ✅ | incident, consultation, preventive, administrative | canônico |

| `recorded_by` | RecordedBy | ✅ | Executor que registrou (geralmente = opened_by) | canônico |

| `closed_at` | timestamp | ❌ |  | canônico |

| `closed_by` | RecordedBy | ❌ |  | canônico |

| `closure_type` | string (enum) | ❌ | discharge, cancelled, administrative | canônico |

| `closure_reason` | string | ❌ |  | canônico |

| `primary_professional` | ProfessionalIdentity | ❌ |  | canônico |

| `reopen_reason` | string | ❌ | Obrigatório em reabertura | canônico |

| `reopened_at` | timestamp | ❌ | Última reabertura | canônico |

| `reopened_by` | RecordedBy | ❌ | Quem reabriu | canônico |

| `previous_status` | string | ❌ | Status anterior ao reopen (= discharged) | canônico |

| `reopened_count` | number | ❌ | Default 0 | canônico |

| `recurrence_of_case_id` | string | ❌ | Ref a caso anterior | canônico |

| `related_case_ids` | array of string | ❌ | Refs a casos relacionados | canônico |

| `has_active_restriction` | bool | ❌ | Derivado por Function | canônico |

| `has_pending_schedule` | bool | ❌ | Derivado por Function | canônico |

| `active_treatments_count` | number | ❌ | Derivado por Function | canônico |

| `last_event_at` | timestamp | ❌ | Derivado | canônico |

| `event_count` | number | ❌ | Derivado | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ | Se migrado | canônico |

| `schema_version` | number | ✅ | Atual: 1 | canônico |



## 2.2 — `clinical_cases/{caseId}/events/{eventId}`


**Path completo:** `dogs/{dogId}/clinical_cases/{caseId}/events/{eventId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile/Web (create, update draft). Function (gerencia metadados has_amendments).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `event_type` | string (enum) | ✅ | Ver Domain Model §6 | canônico |

| `status` | string (enum) | ✅ | draft, final, cancelled (sem "amended") | canônico |

| `occurred_at` | timestamp | ✅ | Quando aconteceu | canônico |

| `recorded_at` | timestamp | ✅ | Server timestamp | canônico |

| `updated_at` | timestamp | ❌ | Só em draft | canônico |

| `finalized_at` | timestamp | ❌ |  | canônico |

| `cancelled_at` | timestamp | ❌ |  | canônico |

| `cancel_reason` | string | ❌ | Obrigatório se cancelled | canônico |

| `recorded_by` | RecordedBy | ✅ | Quem registrou no sistema | canônico |

| `professional` | ProfessionalIdentity | ❌ | Quem decidiu clinicamente (externo) | canônico |

| `payload_type` | string (enum) | ✅ | Ver Domain Model §6 | canônico |

| `payload_version` | number | ✅ | Versão do contrato | canônico |

| `content` | map | ✅ | Campos específicos por payload_type | canônico |

| `operational_impact` | map | ❌ | Ver OperationalImpact | canônico |

| `attachment_refs` | array of string | ❌ | IDs de HealthDocument (não URLs); tratado como `[]` quando ausente | canônico |

| `source_document` | HealthDocumentRef | ❌ | Evidência documental | canônico |

| `has_amendments` | bool | ✅ | Server-managed, default false | canônico |

| `amendment_count` | number | ✅ | Server-managed, default 0 | canônico |

| `last_amended_at` | timestamp | ❌ | Server-managed | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ | Se migrado | canônico |

| `legacy_source` | string | ❌ |  | canônico |

| `legacy_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.3 — `events/{eventId}/amendments/{amendId}`


**Path completo:** `dogs/{dogId}/clinical_cases/{caseId}/events/{eventId}/amendments/{amendId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile/Web (create-only; imutável após criação).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `type` | string (enum) | ✅ | correction, addendum, complement | canônico |

| `reason` | string | ✅ |  | canônico |

| `payload_type` | string | ✅ | Mesmo do evento pai | canônico |

| `payload_version` | number | ✅ | Mesmo do evento pai | canônico |

| `content` | map | ✅ | Apenas campos alterados/adicionados | canônico |

| `recorded_by` | RecordedBy | ✅ |  | canônico |

| `recorded_at` | timestamp | ✅ | Server timestamp | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.4 — `clinical_cases/{caseId}/exams/{examId}`


**Path completo:** `dogs/{dogId}/clinical_cases/{caseId}/exams/{examId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile/Web (criar, atualizar estágios). Function (gera schedule, valida transições).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `exam_id` | string | ✅ | UUID ou `legacy_{legacy_id}` | canônico |

| `case_id` | string | ✅ | Ref ao caso | canônico |

| `exam_type` | string (enum) | ✅ | blood_work, imaging, biopsy, etc. | canônico |

| `current_stage` | string (enum) | ✅ | requested, collected, resulted, interpreted, impact_assessed, cancelled | canônico |

| `title` | string | ✅ | Ex: "Hemograma completo" | canônico |

| `created_at` | timestamp | ✅ |  | canônico |

| `recorded_by` | RecordedBy | ✅ | Executor da criação | canônico |

| `requested_at` | timestamp | ❌ | Estágio requested | canônico |

| `requested_by` | RecordedBy | ❌ |  | canônico |

| `request_professional` | ProfessionalIdentity | ❌ |  | canônico |

| `request_reason` | string | ❌ | Indicação clínica | canônico |

| `urgency` | string (enum) | ❌ | routine, urgent, stat | canônico |

| `lab_name` | string | ❌ |  | canônico |

| `collected_at` | timestamp | ❌ | Estágio collected | canônico |

| `collected_by` | RecordedBy | ❌ |  | canônico |

| `collection_site` | string | ❌ |  | canônico |

| `collection_notes` | string | ❌ |  | canônico |

| `resulted_at` | timestamp | ❌ | Estágio resulted | canônico |

| `result_received_by` | RecordedBy | ❌ |  | canônico |

| `result_document_id` | string | ❌ | Ref a HealthDocument | canônico |

| `result_summary` | string | ❌ |  | canônico |

| `interpreted_at` | timestamp | ❌ | Estágio interpreted | canônico |

| `interpreted_by` | RecordedBy | ❌ |  | canônico |

| `interpretation_professional` | ProfessionalIdentity | ❌ |  | canônico |

| `interpretation_text` | string | ❌ |  | canônico |

| `interpretation_document_id` | string | ❌ | Ref a HealthDocument | canônico |

| `impact_assessed_at` | timestamp | ❌ | Estágio impact_assessed | canônico |

| `impact_assessed_by` | RecordedBy | ❌ |  | canônico |

| `operational_impact` | OperationalImpact | ❌ |  | canônico |

| `restrictions_issued` | array of string | ❌ | IDs de OperationalRestrictions criadas | canônico |

| `cancelled_at` | timestamp | ❌ |  | canônico |

| `cancelled_by` | RecordedBy | ❌ |  | canônico |

| `cancel_reason` | string | ❌ |  | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `legacy_source` | string | ❌ |  | canônico |

| `legacy_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.5 — `treatment_protocols/{protocolId}`


**Path completo:** `dogs/{dogId}/treatment_protocols/{protocolId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Web (admin transcreve prescrição externa), Function (derivados).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `case_id` | string | ✅ | Ref ao caso | canônico |

| `status` | string (enum) | ✅ | active, paused, completed, cancelled | canônico |

| `medication_name` | string | ✅ |  | canônico |

| `dose` | DoseBlock | ✅ | Estruturado: { value, unit, per_kg, route } | canônico |

| `schedule` | ScheduleBlock | ✅ | Estruturado: { type, interval_minutes, times_of_day, timezone, tolerance_minutes } | canônico |

| `dosage_display` | string | ❌ | Para apresentação: "10mg/kg" | canônico |

| `frequency_display` | string | ❌ | Para apresentação: "BID" | canônico |

| `start_date` | timestamp | ✅ |  | canônico |

| `end_date` | timestamp | ❌ |  | canônico |

| `duration_days` | number | ❌ |  | canônico |

| `instructions` | string | ❌ |  | canônico |

| `recorded_by` | RecordedBy | ✅ | Executor que transcreveu | canônico |

| `professional` | ProfessionalIdentity | ✅ | Quem prescreveu (externo) | canônico |

| `source_document` | HealthDocumentRef | ✅ | Receita original | canônico |

| `paused_at` | timestamp | ❌ |  | canônico |

| `pause_reason` | string | ❌ |  | canônico |

| `completed_at` | timestamp | ❌ |  | canônico |

| `cancelled_at` | timestamp | ❌ |  | canônico |

| `cancel_reason` | string | ❌ |  | canônico |

| `doses_administered` | number | ❌ | Derivado | canônico |

| `doses_remaining` | number | ❌ | Derivado | canônico |

| `next_dose_at` | timestamp | ❌ | Derivado | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.6 — `treatment_protocols/{protocolId}/doses/{doseId}`


**Path completo:** `dogs/{dogId}/treatment_protocols/{protocolId}/doses/{doseId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile (administração de dose).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `planned_dose_id` | string | ✅ | ID da dose planejada no schedule | canônico |

| `schedule_item_id` | string | ✅ | Ref ao HealthScheduleItem | canônico |

| `idempotency_key` | string | ✅ | Rastreabilidade — mesmo valor determinístico de `doseId`. Não inclui data, `YYYYMMDD` ou timestamp de relógio. | canônico |

| `scheduled_for` | timestamp | ✅ |  | canônico |

| `status` | string (enum) | ✅ | administered, skipped, cancelled | canônico |

| `administered_at` | timestamp | ❌ | Se administered | canônico |

| `recorded_by` | RecordedBy | ✅ | Quem digitou no sistema | canônico |

| `administered_by` | RecordedBy | ❌ | Quem deu a dose (se diferente) | canônico |

| `recorded_at` | timestamp | ✅ | Server | canônico |

| `skip_reason` | string | ❌ | Se skipped | canônico |

| `observations` | string | ❌ |  | canônico |

| `side_effects` | string | ❌ |  | canônico |

| `attachment_refs` | array of health_document_id | ❌ | Referências a HealthDocument (substitui photo_url) | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.7 — `weight_records/{id}`


**Path completo:** `dogs/{dogId}/weight_records/{id}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile.  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `weight_kg` | number | ✅ | > 0 | canônico |

| `measured_at` | timestamp | ✅ |  | canônico |

| `recorded_by` | RecordedBy | ✅ |  | canônico |

| `context` | string (enum) | ❌ | routine, clinical, pre_op, post_op | canônico |

| `bcs` | number | ❌ | 1-9 body condition score | canônico |

| `notes` | string | ❌ |  | canônico |

| `attachment_refs` | array of health_document_id | ❌ | Referências a HealthDocument (substitui photo_url) | canônico |

| `case_id` | string | ❌ |  | canônico |

| `ideal_weight_min` | number | ❌ |  | canônico |

| `ideal_weight_max` | number | ❌ |  | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `legacy_source` | string | ❌ |  | canônico |

| `legacy_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.8 — `nutrition_plans/{id}`


**Path completo:** `dogs/{dogId}/nutrition_plans/{id}`  

**Classificação:** canônico  

**Escritor segundo schema:** Web exclusivamente (admin).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `status` | string (enum) | ✅ | active, superseded, cancelled | canônico |

| `food_type` | string | ✅ |  | canônico |

| `amount_grams_per_day` | number | ✅ |  | canônico |

| `meals_per_day` | number | ✅ |  | canônico |

| `vigent_from` | timestamp | ✅ |  | canônico |

| `vigent_until` | timestamp | ❌ |  | canônico |

| `hydration_ml` | number | ❌ |  | canônico |

| `special_instructions` | string | ❌ |  | canônico |

| `professional` | ProfessionalIdentity | ❌ | Se definido por nutricionista | canônico |

| `source_document` | HealthDocumentRef | ❌ |  | canônico |

| `attachment_refs` | array of health_document_id | ❌ | Referências a HealthDocument (substitui report_url) | canônico |

| `recorded_by` | RecordedBy | ✅ | Quem registrou | canônico |

| `created_at` | timestamp | ✅ |  | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.9 — `meal_logs/{id}`


**Path completo:** `dogs/{dogId}/meal_logs/{id}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile.  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `period` | string (enum) | ✅ | morning, afternoon, evening, night, extra | canônico |

| `amount_grams` | number | ✅ |  | canônico |

| `fed_at` | timestamp | ✅ |  | canônico |

| `recorded_by` | RecordedBy | ✅ |  | canônico |

| `plan_id` | string | ❌ | Ref ao plano vigente | canônico |

| `prescription_amount_at_time` | number | ❌ | Snapshot do plano | canônico |

| `divergence_percent` | number | ❌ |  | canônico |

| `divergence_reason` | string | ❌ |  | canônico |

| `attachment_refs` | array of health_document_id | ❌ | Referências a HealthDocument (substitui photo_url) | canônico |

| `observations` | string | ❌ |  | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.10 — `supplement_logs/{id}`


**Path completo:** `dogs/{dogId}/supplement_logs/{id}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile.  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `supplement_name` | string | ✅ |  | canônico |

| `dose` | string | ✅ | Texto descritivo da dose | canônico |

| `administered_at` | timestamp | ✅ |  | canônico |

| `recorded_by` | RecordedBy | ✅ |  | canônico |

| `notes` | string | ❌ |  | canônico |

| `batch_number` | string | ❌ |  | canônico |

| `protocol_id` | string | ❌ |  | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.11 — `health_documents/{id}`


**Path completo:** `dogs/{dogId}/health_documents/{id}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile, Web.  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `document_type` | string (enum) | ✅ | Ver Domain Model | canônico |

| `title` | string | ✅ |  | canônico |

| `storage_path` | string | ✅ | Identidade canonica no Cloud Storage | canônico |

| `storage_url` | string | ❌ | Derivado/cache - nunca fonte | canônico |

| `mime_type` | string | ✅ |  | canônico |

| `file_size_bytes` | number | ❌ |  | canônico |

| `uploaded_at` | timestamp | ✅ |  | canônico |

| `recorded_by` | RecordedBy | ✅ | Quem fez upload | canônico |

| `case_id` | string | ❌ |  | canônico |

| `event_id` | string | ❌ |  | canônico |

| `exam_id` | string | ❌ |  | canônico |

| `description` | string | ❌ |  | canônico |

| `issuer` | string | ❌ |  | canônico |

| `issue_date` | timestamp | ❌ |  | canônico |

| `expiry_date` | timestamp | ❌ |  | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `legacy_source` | string | ❌ |  | canônico |

| `legacy_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.12 — `operational_restrictions/{id}`


**Path completo:** `dogs/{dogId}/operational_restrictions/{id}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile/Web (admin ou condutor com evidence profissional).  

**Leitor segundo schema:** Mobile, Web, Function (para snapshot).  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `level` | string (enum) | ✅ | absolute, partial, attention | canônico |

| `category` | string (enum) | ✅ | Ver Domain Model | canônico |

| `description` | string | ✅ |  | canônico |

| `activities_restricted` | array of string | ❌ |  | canônico |

| `issued_at` | timestamp | ✅ |  | canônico |

| `recorded_by` | RecordedBy | ✅ | Executor que transcreveu | canônico |

| `professional` | ProfessionalIdentity | ✅ | Quem emitiu (externo) | canônico |

| `source_document` | HealthDocumentRef | ✅ | Laudo/atestado | canônico |

| `expected_end` | timestamp | ❌ |  | canônico |

| `actual_end` | timestamp | ❌ |  | canônico |

| `ended_by` | RecordedBy | ❌ | Usuário interno que encerra | canônico |

| `end_professional` | ProfessionalIdentity | ❌ | Profissional externo que autorizou encerramento (obrigatório quando encerramento representa decisão clínica externa) | canônico |

| `end_source_document` | HealthDocumentRef | ❌ | Laudo/atestado de liberação (obrigatório quando encerramento representa decisão clínica externa) | canônico |

| `end_reason` | string | ❌ | Obrigatório quando status=ended | canônico |

| `evidence` | map | ❌ | Ver Evidence | canônico |

| `status` | string (enum) | ✅ | active, ended, cancelled | canônico |

| `case_id` | string | ❌ |  | canônico |

| `event_id` | string | ❌ |  | canônico |

| `exam_id` | string | ❌ | Origem em ExamProcess.impact_assessed | canônico |

| `deleted_at` | timestamp | ❌ | Soft delete | canônico |

| `deleted_by` | RecordedBy | ❌ |  | canônico |

| `delete_reason` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.13 — `vaccination_records/{vaccinationId}`


**Path completo:** `dogs/{dogId}/vaccination_records/{vaccinationId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Mobile (aplicação em campo), Web (registro administrativo), Function (criação automática de próxima dose via `health_schedule`).  

**Leitor segundo schema:** Mobile, Web, Function (prontidão e timeline).  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `vaccine_name` | string | ✅ |  | canônico |

| `vaccine_type` | string | ❌ | ex: V10, antirrábica, giárdia | canônico |

| `manufacturer` | string | ❌ |  | canônico |

| `batch_number` | string | ❌ |  | canônico |

| `dose` | string | ❌ | Apresentação da dose aplicada | canônico |

| `record_status` | string (enum) | ✅ | **final** \ | canônico |

| `applied_at` | timestamp | ❌ | Obrigatório quando `record_status == final` | canônico |

| `validity_until` | timestamp | ❌ |  | canônico |

| `next_due_at` | timestamp | ❌ | Deriva geração de item em `health_schedule` (schedule_type: vaccination); nunca classifica `VaccinationRecord` como overdue. | canônico |

| `recorded_by` | RecordedBy | ✅ | Usuário interno que registrou | canônico |

| `administered_by` | RecordedBy | ❌ | Quem efetivamente aplicou (se diferente de recorded_by) | canônico |

| `professional` | ProfessionalIdentity | ❌ | Profissional externo responsável pela aplicação (somente quando aplicável) | canônico |

| `source_document` | HealthDocumentRef | ❌ | Cartão vacinal / atestado | canônico |

| `case_id` | string | ❌ | **Somente** quando há reação adversa ou vínculo terapêutico dentro de um caso | canônico |

| `notes` | string | ❌ |  | canônico |

| `legacy_source` | string | ❌ |  | canônico |

| `legacy_id` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `cancelled_at` | timestamp | ❌ | Obrigatório quando `record_status == cancelled` | canônico |

| `cancelled_by` | RecordedBy | ❌ |  | canônico |

| `cancel_reason` | string | ❌ | Obrigatório quando `record_status == cancelled` | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.14 — `health_schedule/{scheduleId}`


**Path completo:** `dogs/{dogId}/health_schedule/{scheduleId}`  

**Classificação:** canônico  

**Escritor segundo schema:** Function (automático), Mobile/Web (manual).  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `schedule_type` | string (enum) | ✅ | dose, vaccination, exam, consultation, weighing, reevaluation, deworming, bath, general | canônico |

| `title` | string | ✅ |  | canônico |

| `scheduled_for` | timestamp | ✅ |  | canônico |

| `due_until` | timestamp | ❌ | Opcional — quando ausente, tolerância é definida por configuração por `schedule_type`, **sem default universal**. | canônico |

| `timezone` | string | ✅ | Ex: "America/Sao_Paulo"; usado em toda derivação temporal | canônico |

| `lifecycle_status` | string (enum) | ✅ | **open, completed, cancelled** — único campo de estado persistido | canônico |

| `source_type` | string (enum) | ✅ | treatment_protocol, clinical_case, exam_process, preventive, manual | canônico |

| `source_id` | string | ❌ |  | canônico |

| `case_id` | string | ❌ |  | canônico |

| `completed_at` | timestamp | ❌ |  | canônico |

| `completed_by` | RecordedBy | ❌ |  | canônico |

| `cancelled_at` | timestamp | ❌ |  | canônico |

| `cancelled_by` | RecordedBy | ❌ |  | canônico |

| `cancel_reason` | string | ❌ |  | canônico |

| `created_at` | timestamp | ✅ |  | canônico |

| `recorded_by` | RecordedBy | ✅ | Ou "system" para Function | canônico |

| `notes` | string | ❌ |  | canônico |

| `migration_batch_id` | string | ❌ |  | canônico |

| `schema_version` | number | ✅ |  | canônico |



## 2.15 — `legacy_health_records/{recordId}`


**Path completo:** `dogs/{dogId}/legacy_health_records/{recordId}`  

**Classificação:** legado normalizado/read-only  

**Escritor segundo schema:** Admin SDK (auditável) — apenas para correções de normalização e linkagem de caso.  

**Leitor segundo schema:** Mobile, Web (read-only).  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `original_collection` | string | ✅ | Nome da coleção original | legado normalizado/read-only |

| `original_id` | string | ✅ | ID original no schema legado | legado normalizado/read-only |

| `original_payload` | map | ✅ | Payload bruto preservado | legado normalizado/read-only |

| `migration_batch_id` | string | ✅ | Ref ao batch que migrou | legado normalizado/read-only |

| `migrated_at` | timestamp | ✅ | Quando foi migrado | legado normalizado/read-only |

| `normalized_view` | map | ❌ | Tentativa de mapeamento para novos modelos | legado normalizado/read-only |

| `case_id` | string | ❌ | Linkagem manual ou automatica | legado normalizado/read-only |

| `dog_id` | string | ✅ |  | legado normalizado/read-only |

| `occurred_at` | timestamp | ❌ | Extraído quando possivel | legado normalizado/read-only |

| `recorded_by` | RecordedBy | ❌ | Extraído quando possivel | legado normalizado/read-only |

| `schema_version` | number | ✅ |  | legado normalizado/read-only |



## 2.16 — `_migrations/health_v1/batches/{batchId}`


**Path completo:** `_migrations/health_v1/batches/{batchId}`  

**Classificação:** administrativo  

**Escritor segundo schema:** Migration Function exclusivamente.  

**Leitor segundo schema:** Admin (Web), para auditoria de migracao.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `started_at` | timestamp | ✅ |  | administrativo |

| `completed_at` | timestamp | ❌ |  | administrativo |

| `status` | string (enum) | ✅ | running, completed, failed, rolled_back | administrativo |

| `source_collection` | string | ✅ |  | administrativo |

| `dry_run` | bool | ✅ | `true` não grava destinos | administrativo |

| `total_source` | number | ✅ | Total lido da origem | administrativo |

| `total_migrated` | number | ✅ | Default 0 | administrativo |

| `total_rejected` | number | ✅ | Default 0 | administrativo |

| `total_skipped` | number | ✅ | Default 0; inclui itens já migrados | administrativo |

| `rejections` | array of map | ❌ | `{source_id, reason}` | administrativo |

| `manifest` | array of map | ✅ | Cada item: `operation_type`, `target_path`, `target_id`, `before_image` para update, `changed_fields`, `migrated_at`, `checksum_before`, `checksum_after` | administrativo |

| `migration_version` | string | ✅ | Ex: "health_v1_2026_07" | administrativo |

| `triggered_by` | string | ✅ | UID do admin ou "system" | administrativo |

| `schema_version` | number | ✅ |  | administrativo |



## 3.1 — `health_timeline/{timelineId}`


**Path completo:** `dogs/{dogId}/health_timeline/{timelineId}`  

**Classificação:** projeção read-only  

**Escritor segundo schema:** Function exclusivamente.  

**Leitor segundo schema:** Mobile, Web.  


| Campo | Tipo | Obrigatório | Notas do schema | Autoridade Web |

|---|---|---:|---|---|

| `timeline_type` | string (enum) | ✅ | Ver Domain Model | projeção read-only |

| `source_collection` | string | ✅ | Caminho da fonte | projeção read-only |

| `source_id` | string | ✅ | ID do doc fonte | projeção read-only |

| `occurred_at` | timestamp | ✅ |  | projeção read-only |

| `recorded_at` | timestamp | ✅ |  | projeção read-only |

| `projected_at` | timestamp | ✅ | Quando Function projetou | projeção read-only |

| `title` | string | ✅ |  | projeção read-only |

| `subtitle` | string | ❌ |  | projeção read-only |

| `case_id` | string | ❌ |  | projeção read-only |

| `case_title` | string | ❌ | Snapshot | projeção read-only |

| `dog_id` | string | ✅ |  | projeção read-only |

| `recorded_by` | RecordedBy | ✅ |  | projeção read-only |

| `professional` | ProfessionalIdentity | ❌ |  | projeção read-only |

| `payload_type` | string | ❌ |  | projeção read-only |

| `operational_impact` | map | ❌ |  | projeção read-only |

| `status` | string | ✅ | `final` ou `cancelled`. Fontes factuais sem lifecycle próprio projetam `final`; fonte cancelada/invalidada projeta `cancelled`; drafts nunca entram. | projeção read-only |

| `attachment_count` | number | ❌ |  | projeção read-only |

| `has_amendments` | bool | ❌ | Server-managed | projeção read-only |

| `amendment_count` | number | ❌ | Server-managed | projeção read-only |

| `last_amended_at` | timestamp | ❌ | Server-managed | projeção read-only |

| `migration_batch_id` | string | ❌ |  | projeção read-only |

| `schema_version` | number | ✅ |  | projeção read-only |



## 3.2 — `health_summary/current`


**Path completo:** `dogs/{dogId}/health_summary/current`  

**Classificação:** projeção read-only  

**Escritor segundo schema:** Function exclusivamente.  

**Leitor segundo schema:** Mobile, Web (stream).  


Os campos detalhados são definidos nas ADRs relacionadas e deverão ser reconciliados antes da implementação.

---

# Parte IV — Projeções especiais

## 44. `health_summary/current`

O schema principal referencia ADR-004 e ADR-005.

Campos consolidados esperados incluem:

| Campo | Autoridade | Uso |
|---|---|---|
| `readiness_status` | Function | estado oficial |
| `readiness_label` | Function ou mapping aprovado | apresentação |
| `readiness_reason` | Function | síntese |
| `readiness_updated_at` | Function | freshness |
| `active_restrictions` | Function | display resumido |
| `restriction_count` | Function | contagem |
| `last_evaluated_at` | Function | contexto |
| `evaluated_by` | Function | origem |
| `data_completeness` | Function | indicadores |
| `active_cases_count` | Function | resumo |
| `active_treatments_count` | Function | resumo |
| `last_weight` | Function | resumo |
| `last_vaccination` | Function | resumo |
| `last_exam` | Function | resumo |
| `last_consultation` | Function | resumo |
| `nutrition_plan` | Function | resumo |
| `pending_schedule_count` | Function | resumo |
| `overdue_schedule_count` | Function | resumo |
| `open_alerts` | Function | alertas |
| `updated_at` | Function | freshness |
| `schema_version` | Function | compatibilidade |

### 44.1 Regra

Todos são read-only para clientes.

### 44.2 Ausência

Ausência do documento não deve ser interpretada automaticamente como `not_evaluated` sem contrato Backend que diferencie:

- K9 nunca avaliado;
- projection ainda não criada;
- erro;
- K9 fora do escopo;
- migração pendente.

---

## 45. `health_timeline`

### 45.1 Autoridade

Function exclusivamente.

### 45.2 Idempotência

O ID deverá ser determinístico a partir da fonte.

### 45.3 Conteúdo

A projection deve possuir referência suficiente para reconstrução e drill-down.

### 45.4 Reconstrução

A timeline é descartável e reconstruível a partir das fontes canônicas e legado preservado.

---

# Parte V — Matriz de propriedade de write

## 46. Write owners

| Domínio | Web | Mobile | Function/Admin |
|---|---|---|---|
| ClinicalCase | abertura/admin conforme capability | intercorrência | flags derivados |
| ClinicalEvent | transcrição/draft conforme capability | registro operacional | metadados |
| Amendment | create-only autorizado | create-only autorizado | contagens |
| ExamProcess | gestão/transcrição | registro de campo | valida transições/schedule |
| TreatmentProtocol | principal | leitura | derivados |
| DoseAdministration | exceção pendente | principal | idempotência |
| WeightAssessment | pendente | principal | validação |
| NutritionPlan | exclusivo Web | não | callables/receipts |
| MealLog | não | principal | dedupe |
| SupplementLog | não | principal | validação |
| HealthDocument | sim | sim | Storage/URLs |
| OperationalRestriction | transcrição autorizada | possível | summary/enforcement |
| VaccinationRecord | administrativo pendente | aplicação | schedule/timeline |
| HealthScheduleItem | manual/gestão | possível | automático |
| LegacyHealthRecord | não | não | Admin SDK auditado |
| Timeline/Summary | não | não | exclusivo |

---

# Parte VI — Segurança por fonte

## 47. Regras mínimas

1. A listagem só consulta dados autorizados.
2. Capability é verificada antes do write.
3. Backend repete a autorização.
4. PII não entra em logs client-side.
5. Documento usa URL temporária.
6. Projection é read-only.
7. Legacy é read-only.
8. Exportação possui capability própria.
9. Auditoria não expõe conteúdo excessivo.
10. Falha de permission não ativa fallback legado.

---

# Parte VII — Testes derivados

## 48. Testes de reader

Cada reader deverá testar:

- canonical success;
- empty;
- permission denied;
- network error;
- malformed document;
- unknown enum;
- schema version incompatível;
- partial;
- legacy;
- conflict;
- stale;
- retry;
- unsubscribe;
- paginação;
- ordenação.

---

## 49. Testes de source authority

Casos obrigatórios:

1. summary falha e score legado existe → não usar score;
2. restriction absoluta existe e summary diz operational → conflict/fail-closed;
3. dois planos ativos → conflict;
4. vacinação sem `next_due_at` → não aplicar 365 dias;
5. schedule sem `due_until` → resolver configuração por tipo;
6. arquivo possui `storage_url` mas não `storage_path` → legado/degraded;
7. health_event antigo parece consulta → permanece legado;
8. `_last_weight_kg` existe sem weight_records → não usar como canônico;
9. timeline projection falha → não concatenar collections no browser;
10. event final recebe tentativa de edição → rejeitar/usar amendment.

---

## 50. Testes de write

- capability ausente;
- operationId ausente;
- replay;
- conflito de versão;
- lifecycle inválido;
- documento obrigatório ausente;
- identidade profissional ausente;
- data futura proibida;
- write em projection;
- write em legacy;
- write direto best-effort;
- falha parcial;
- receipt;
- auditoria.

---

# Parte VIII — Decisões

## 51. Decisões fixadas

1. `health_summary` é projection.
2. `health_timeline` é projection.
3. `operational_restrictions` é autoridade para bloqueio.
4. `health_schedule` persiste apenas lifecycle.
5. estados temporais da agenda são derivados.
6. `weight_records` é fonte de peso.
7. `vaccination_records` é fonte de aplicação.
8. ClinicalEvent de vacinação não é fonte preventiva.
9. `nutrition_plans` é fonte do plano.
10. `meal_logs` e `supplement_logs` são execução Mobile.
11. `storage_path` é identidade documental.
12. eventos finais são imutáveis.
13. legacy é read-only.
14. `_last_*` não é fonte Health v1.
15. score legado não decide prontidão.
16. timeline não é montada no cliente.
17. fallback exige autorização documental.
18. conflito não é resolvido silenciosamente.
19. erro não é empty.
20. ausência não é normalidade.

---

## 52. Decisões humanas pendentes

- write Web de peso;
- write Web de vacinação;
- conclusão Web de agenda por tipo;
- transcrição Web de dose;
- nomes finais de capabilities;
- thresholds configuráveis;
- política de freshness;
- formato de projection agregada global;
- localização da auditoria;
- política de exportação;
- campos sensíveis por perfil;
- tratamento visual do legado;
- plano de cutover de cada collection.

---

# Parte IX — Gates

## 53. Gate DSMX-1 — Paths

Validar paths contra o schema implementado.

## 54. Gate DSMX-2 — Writers

Confirmar owners com Functions e Rules.

## 55. Gate DSMX-3 — Readers

Definir contratos TypeScript por entidade.

## 56. Gate DSMX-4 — Fallbacks

Aprovar cada fallback existente.

## 57. Gate DSMX-5 — Freshness

Definir thresholds de stale por projection.

## 58. Gate DSMX-6 — Legado

Auditar collections reais e volume.

## 59. Gate DSMX-7 — Capabilities

Reconciliar com inventário e permission matrix.

## 60. Gate DSMX-8 — Aprovação humana

Nenhuma implementação deverá usar esta matriz como aprovada antes da revisão humana.

---

## 61. Critérios de aprovação

O documento estará aprovado quando:

- cada campo visível tiver autoridade;
- paths estiverem reconciliados;
- writers forem confirmados;
- projections forem read-only;
- legacy estiver isolado;
- fallbacks estiverem explícitos;
- prontidão não usar score;
- vacinação não usar 365 dias universal;
- schedule não persistir estado temporal;
- documentos usarem storage_path;
- Nutrição preservar o contrato pós-Foundation;
- writes pendentes permanecerem marcados;
- testes derivados estiverem aceitos.

---

## 62. Próximo documento recomendado

O próximo documento deverá ser:

```text
docs/health/web/architecture/HEALTH_WEB_MOBILE_BACKEND_MATRIX.md
```

Ele consolidará, ação por ação:

- quem inicia;
- quem executa;
- quem valida;
- quem persiste;
- quem projeta;
- quem audita;
- qual plataforma pode operar offline;
- qual capability é exigida;
- qual fonte é consultada;
- qual receipt é produzido.

Depois dele, o pacote estará pronto para entrar em:

- capabilities;
- permission matrix;
- readiness policy Web;
- roadmap.

---

## 63. Status

| Item | Estado |
|---|---|
| Matriz de fontes principais | Concluída |
| Matriz de campos de UI | Concluída |
| Inventário do schema | Incorporado |
| Projeções | Documentadas |
| Legado | Classificado |
| Fallbacks | Definidos conceitualmente |
| Writers Web pendentes | Identificados |
| Validação com implementação Backend | Pendente |
| Aprovação humana | Pendente |
| Aprovação para implementação | Não concedida |

---

## 64. Conclusão

O Health Web v1 passa a ter uma regra objetiva para cada informação:

```text
campo
→ entidade
→ path
→ autoridade
→ writer
→ reader
→ fallback
→ estado de erro
```

A matriz impede que a nova Web repita os principais problemas do legado:

- cálculos client-side de prontidão;
- uso de fields denormalizados;
- mistura de fontes;
- writes best-effort;
- timeline concatenada no navegador;
- formulário genérico;
- fallback clínico silencioso;
- dado legado apresentado como canônico.

O próximo passo é fechar definitivamente as fronteiras de responsabilidade entre Web, Mobile e Backend.
