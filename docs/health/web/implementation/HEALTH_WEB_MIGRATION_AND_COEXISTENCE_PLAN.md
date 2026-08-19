# K9 Ops Web — Health Web v1 Migration and Coexistence Plan

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Plano de inventário, coexistência, backfill, cutover, rollback e aposentadoria |
| Repositório Web | `github.com/jillohh-arch/k9-ops` |
| Branch principal auditada | `master` |
| Branch funcional de Nutrição | `feature/health-web-nutrition` |
| Baseline | `HEALTH_WEB_BASELINE.md` |
| Auditoria atual | `HEALTH_WEB_CURRENT_STATE_AUDIT.md` |
| Matriz de fontes | `HEALTH_WEB_DATA_SOURCE_MATRIX.md` |
| Roadmap | `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md` |
| Autoridade canônica | ADR-006 e `HEALTH_V1_MIGRATION_PLAN.md` |
| Fora de escopo | Executar migração, excluir dados, criar scripts, alterar Rules, realizar cutover ou deploy |

---

## 1. Propósito

Este documento define como o Health Web v1 coexistirá com o legado e como os dados existentes serão:

- inventariados;
- classificados;
- preservados;
- normalizados;
- migrados;
- reconciliados;
- lidos durante a transição;
- retirados das interfaces antigas;
- protegidos contra novos writes;
- mantidos para auditoria histórica.

A pergunta central é:

> Como substituir a experiência Web antiga sem perder dados, sem criar fatos clínicos retroativos indevidos e sem permitir que fontes legadas permaneçam como autoridade?

---

## 2. Declaração central

> **A nova arquitetura não será compatível com a experiência antiga por obrigação, mas será responsável por preservar e explicar os dados antigos.**

O módulo Web antigo:

- é pré-Foundation;
- não é usado operacionalmente;
- não possui obrigação de continuidade visual;
- não será a base da arquitetura-alvo.

Os dados antigos:

- não serão descartados;
- não serão apagados durante a migração;
- não serão promovidos automaticamente;
- não serão reescritos silenciosamente;
- permanecerão rastreáveis.

---

## 3. Autoridades documentais

Este plano aplica:

1. ADR-006 — Coexistência com Legado e Migração;
2. `HEALTH_V1_MIGRATION_PLAN.md`;
3. ADR-002 — Imutabilidade;
4. ADR-003 — Casos Clínicos;
5. ADR-004 — Timeline e Projeções;
6. `HEALTH_V1_FIRESTORE_SCHEMA.md`;
7. `HEALTH_WEB_DATA_SOURCE_MATRIX.md`;
8. `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`.

### 3.1 Regra de conflito

Em caso de conflito:

1. decisão humana aprovada;
2. ADR canônica;
3. plano Mobile canônico;
4. schema;
5. este plano;
6. implementação.

---

## 4. Princípios obrigatórios

1. Nenhuma fonte legada será apagada durante o programa v1.
2. Nenhum `health_event` antigo será convertido automaticamente em `ClinicalEvent`.
3. Nenhum `ClinicalCase` retroativo será criado automaticamente a partir de `health_events`.
4. O payload original migrado será imutável.
5. Clientes Mobile e Web serão read-only sobre `legacy_health_records`.
6. Somente Admin SDK auditado poderá atualizar metadados administrativos permitidos.
7. Migração será idempotente.
8. IDs de destino serão determinísticos.
9. Todo documento migrado terá rastreabilidade.
10. Todo batch terá manifest.
11. Todo dry-run será revisado antes de writes reais.
12. Rollback será limitado ao manifest.
13. Rollback de batch será proibido após cutover.
14. Dual-read será temporário e mensurado.
15. Não haverá dual-write client-side.
16. Cutover ocorrerá por agregado.
17. Bloqueio de writes legados ocorrerá somente após estabilidade.
18. Adapters serão removidos somente quando não houver dependência.
19. Dados legados poderão permanecer indefinidamente no Firestore.
20. A retirada da tela antiga não implica exclusão física da fonte.

---

## 5. Estratégia escolhida

A estratégia aprovada é:

```text
adapter pattern
+ migração server-side progressiva
+ dual-read temporário
+ cutover por agregado
+ legado preservado
```

### 5.1 Opções rejeitadas

#### Big Bang

Rejeitado por:

- risco;
- dificuldade de rollback;
- dependências desconhecidas;
- impacto cross-platform.

#### Dual-write no cliente

Rejeitado por:

- divergência;
- falhas parciais;
- complexidade offline;
- duplicação;
- dificuldade de auditoria.

#### Manter legado indefinidamente como autoridade

Rejeitado por:

- perpetuar contratos inválidos;
- impedir domínio canônico;
- aumentar drift.

### 5.2 Projeções como ponte

Projeções serão usadas para:

- timeline;
- summary;
- leitura agregada.

Não substituem a migração dos agregados canônicos.

---

## 6. Conceitos de migração

### 6.1 Fonte legada

Collection ou campo anterior ao contrato canônico.

### 6.2 Fonte canônica

Collection oficial do Health v1.

### 6.3 Registro legado normalizado

Documento em:

```text
dogs/{dogId}/legacy_health_records/{recordId}
```

### 6.4 Adapter

Reader temporário que traduz uma fonte sem gravar no schema novo.

### 6.5 Backfill

Processo server-side que cria ou normaliza documentos no destino.

### 6.6 Dry-run

Execução sem write que produz plano detalhado.

### 6.7 Dual-read

Leitura primária do schema novo com fallback temporário documentado.

### 6.8 Shadow read

Comparação silenciosa entre fonte antiga e nova sem alterar a experiência.

### 6.9 Cutover

Momento em que um agregado passa a usar exclusivamente o schema novo.

### 6.10 Go-live boundary

Data/hora que separa:

- fatos anteriores tratados como legado;
- novos fatos criados exclusivamente pelo contrato canônico.

### 6.11 Rollback

Reversão controlada de operações registradas no manifest.

### 6.12 Paridade

Correspondência comprovada entre fontes, destinos e rejeições documentadas.

---

# Parte I — Inventário de fontes

## 7. Inventário canônico de fontes legadas

| Nº | Fonte | Caminho | Classificação | Destino/Tratamento |
|---:|---|---|---|---|
| 1 | `health_events` | `dogs/{dogId}/health_events/{id}` | legado clínico genérico | todos os anteriores ao go-live → `legacy_health_records` |
| 2 | `weight_records` | `dogs/{dogId}/weight_records/{id}` | canônico existente | manter e normalizar |
| 3 | `weight_history` | `dogs/{dogId}/weight_history/{id}` | espelho/duplicata | preservar read-only |
| 4 | `feeding_events` | `dogs/{dogId}/feeding_events/{id}` | fonte antiga de execução | normalizar para `meal_logs` |
| 5 | `feedings` | `dogs/{dogId}/feedings/{id}` | espelho/duplicata | preservar read-only |
| 6 | `nutritional_prescriptions` | `dogs/{dogId}/nutritional_prescriptions/{id}` | plano antigo principal | normalizar para `nutrition_plans` |
| 7 | `nutrition_prescriptions` | `dogs/{dogId}/nutrition_prescriptions/{id}` | fallback/duplicata | preservar read-only |
| 8 | `nutrition_supplements` | `dogs/{dogId}/nutrition_supplements/{id}` | execução antiga | normalizar para `supplement_logs` |
| 9 | `vacinas` | `vacinas/{id}` | vacinação raiz | promover quando suficiente; senão legacy |
| 10 | `documentos` | `documentos/{id}` | documentos raiz | migrar metadata para `health_documents` |
| 11 | `documents` | `dogs/{dogId}/documents/{id}` | desconhecido | inventariar; migrar ou preservar |
| 12 | `health_logs` | `health_logs/{id}` | legado Web genérico | inventariar; classificar; nunca assumir canônico |
| 13 | `alertas` | `alertas/{id}` | alertas antigos | substituir por schedule/summary; preservar origem |
| 14 | `_last_*` | campos em `dogs/{dogId}` | denormalização | aposentar como fonte |
| 15 | attachments | múltiplos paths Storage | arquivos dispersos | consolidar referências e paths canônicos |

---

## 8. Fontes específicas observadas na Web atual

A auditoria Web identificou readers sobre:

- root `health_logs`;
- root `documentos`;
- `dogs/{dogId}/health_events`;
- `dogs/{dogId}/weight_records`;
- `dogs/{dogId}/documents`;
- campos `_last_*`;
- dados nutricionais de branch própria;
- agregações client-side.

### 8.1 Regra

A existência de reader na Web não prova que a fonte é canônica.

### 8.2 Obrigação

Antes de retirar uma rota, mapear:

- componente;
- hook;
- service;
- query;
- export;
- relatório;
- link;
- teste;
- Function relacionada.

---

## 9. Classes de tratamento

| Classe | Descrição | Exemplo |
|---|---|---|
| A | manter canônico | `weight_records` |
| B | renomear/normalizar | `feeding_events` → `meal_logs` |
| C | promover condicionalmente | `vacinas` |
| D | preservar como legado | `health_events` |
| E | preservar como duplicata | `weight_history`, `feedings` |
| F | substituir por projection | `alertas`, `_last_*` |
| G | inventário obrigatório | `health_logs`, per-dog `documents` |
| H | consolidar Storage | attachments |
| I | integrar implementação canônica | NutritionPlan da branch |

---

## 10. Classificação de risco

| Risco | Critério |
|---|---|
| Baixo | schema compatível e identidade clara |
| Médio | transformação determinística |
| Alto | campos ambíguos, duplicatas ou autoria incerta |
| Crítico | possível conteúdo clínico sem contexto ou K9 |
| Bloqueado | não migrar sem decisão humana |

---

# Parte II — Destino conservador de health_events

## 11. Regra absoluta

Todos os `health_events` anteriores ao go-live serão destinados a:

```text
dogs/{dogId}/legacy_health_records/{recordId}
```

Independentemente de:

- parecer consulta;
- parecer vacina;
- possuir título;
- possuir documento;
- ser agrupável;
- possuir tipo semelhante a ClinicalEvent;
- estar próximo de outro registro.

### 11.1 Proibições

Não criar automaticamente:

- ClinicalCase;
- ClinicalEvent;
- ExamProcess;
- TreatmentProtocol;
- OperationalRestriction;
- VaccinationRecord.

### 11.2 Motivo

Os registros antigos podem não possuir:

- identidade profissional;
- evidence;
- lifecycle;
- case ownership;
- payload versionado;
- autoria confiável;
- distinção entre fato e planejamento.

### 11.3 Curadoria futura

Uma operação administrativa futura poderá:

- preencher `case_id`;
- melhorar `normalized_view`;
- criar entidade curada separada;
- relacionar documentos;
- registrar decisão de reconciliação.

O original permanece intacto.

---

## 12. Estrutura de LegacyHealthRecord

Campos conceituais:

```text
record_id
dog_id
legacy_source
legacy_id
legacy_collection
original_payload
normalized_view
case_id?
schema_version
migration_version
migration_checksum
migration_batch_id
migrated_at
reconciled_at?
reconciled_by?
reconciliation_notes?
```

### 12.1 `original_payload`

- imutável;
- preservado integralmente conforme política;
- não editável por cliente;
- protegido contra exposição excessiva.

### 12.2 `normalized_view`

Pode conter:

- type;
- title;
- description;
- occurred_at;
- recorded_at;
- actor summary;
- attachment refs;
- source metadata.

### 12.3 Writes administrativos permitidos

Somente Admin SDK auditado:

- `normalized_view`;
- `case_id`;
- metadados de batch;
- metadados de reconciliação;
- correções administrativas fora do payload original.

---

# Parte III — Estratégia por fonte

## 13. `weight_records`

### 13.1 Tratamento

Manter no mesmo path canônico.

### 13.2 Ações

- inventariar schema versions;
- normalizar unidade;
- validar timestamps;
- preservar IDs;
- adicionar metadados de migração somente quando necessário.

### 13.3 Conflito

Comparar com:

- `weight_history`;
- `_last_weight_*`.

### 13.4 Autoridade

`weight_records` prevalece.

### 13.5 `_last_weight_*`

Nunca preencher a fonte canônica a partir desses campos sem evidência adicional.

---

## 14. `weight_history`

### 14.1 Tratamento

Preservar read-only.

### 14.2 Uso

- auditoria;
- comparação;
- detecção de duplicata.

### 14.3 Não fazer

- promover todos;
- misturar na série canônica;
- usar como fallback silencioso.

### 14.4 Reconciliação

Se um registro existir apenas no espelho:

- classificar;
- verificar origem;
- promover somente por regra aprovada;
- ou manter legacy.

---

## 15. `feeding_events`

### 15.1 Destino

```text
dogs/{dogId}/meal_logs/{id}
```

### 15.2 Pré-condições

- K9 válido;
- data efetiva;
- quantidade;
- período;
- identidade da ocorrência ou estratégia determinística;
- ausência de conflito.

### 15.3 Dedupe

Comparar:

- `feeding_events`;
- `feedings`;
- MealLogs já existentes;
- occurrence identity.

### 15.4 Rejeição

Registros insuficientes ou contraditórios vão para legado, não são inventados.

---

## 16. `feedings`

### 16.1 Tratamento

Preservar read-only como possível espelho.

### 16.2 Regra

Não migrar como segunda fonte canônica.

### 16.3 Métrica

Registrar:

- duplicatas exatas;
- divergências;
- registros exclusivos;
- timestamps inconsistentes.

---

## 17. `nutritional_prescriptions`

### 17.1 Destino

```text
dogs/{dogId}/nutrition_plans/{planId}
```

### 17.2 Risco

Planos antigos podem não possuir:

- lifecycle;
- revision;
- operationId;
- professional;
- vigência clara;
- distinção active/superseded.

### 17.3 Estratégia

- dry-run;
- classificar ativo provável;
- detectar múltiplos;
- não escolher silenciosamente;
- promover somente planos determinísticos;
- preservar demais como legacy.

### 17.4 Branch pós-Foundation

Planos canônicos já criados pela branch têm precedência.

### 17.5 Proibição

Não sobrescrever o plano canônico ativo com plano antigo.

---

## 18. `nutrition_prescriptions`

### 18.1 Tratamento

Preservar como fallback/duplicata.

### 18.2 Comparação

- identidade;
- datas;
- quantidade;
- alimento;
- status;
- K9.

### 18.3 Conflito

Se divergir do plano canônico:

```text
conflict
```

Não promover automaticamente.

---

## 19. `nutrition_supplements`

### 19.1 Destino

```text
dogs/{dogId}/supplement_logs/{id}
```

### 19.2 Pré-condições

- K9;
- suplemento;
- dose;
- data;
- executor/origem suficiente.

### 19.3 Sem dados suficientes

Migrar como legacy.

---

## 20. `vacinas`

### 20.1 Destinos possíveis

#### Dados suficientes

```text
dogs/{dogId}/vaccination_records/{vaccinationId}
```

#### Dados insuficientes

```text
dogs/{dogId}/legacy_health_records/{recordId}
```

### 20.2 Nunca criar

- caso preventivo;
- ClinicalEvent retroativo;
- validade de 365 dias inventada.

### 20.3 Critérios mínimos candidatos

- K9 resolvido;
- vacina identificada;
- data de aplicação;
- status;
- origem;
- consistência temporal.

### 20.4 Campos faltantes

Não preencher com defaults clínicos.

---

## 21. `documentos`

### 21.1 Destino

```text
dogs/{dogId}/health_documents/{id}
```

### 21.2 Condições

- dogId resolvido;
- storage object existente;
- type classificável;
- metadata suficiente;
- acesso autorizado.

### 21.3 Storage

O destino canônico usa:

```text
storage_path
```

### 21.4 URLs antigas

Preservadas apenas em:

- original payload;
- migration metadata;
- legacy reference.

### 21.5 Arquivo ausente

Metadata não deverá fingir arquivo disponível.

Marcar:

- missing;
- orphan;
- degraded;
- rejected.

---

## 22. `dogs/{dogId}/documents`

### 22.1 Estado

Desconhecido até inventário real.

### 22.2 Ações

- contar;
- classificar tipos;
- localizar Storage;
- identificar consumidor;
- comparar com root `documentos`;
- detectar duplicatas.

### 22.3 Decisão

Por documento:

- migrar para `health_documents`;
- preservar legacy;
- rejeitar com motivo;
- vincular a registro já migrado.

---

## 23. `health_logs`

### 23.1 Estado

Fonte Web antiga sem autoridade canônica.

### 23.2 Inventário obrigatório

- quantidade;
- tipos;
- K9;
- autoria;
- datas;
- anexos;
- campos;
- consumidores;
- overlap com `health_events`.

### 23.3 Regra

Nenhum registro é promovido automaticamente.

### 23.4 Destino provável

- legacy record;
- rejeição documentada;
- curadoria futura.

### 23.5 Proibição

Não usar `health_logs` como origem de ClinicalCase em lote.

---

## 24. `alertas`

### 24.1 Substituição

- `health_schedule`;
- `health_summary`;
- alertas projetados.

### 24.2 Migração

Alertas antigos podem ser preservados em legacy se tiverem valor histórico.

### 24.3 Não promover

Não criar schedule futuro a partir de alerta expirado sem regra explícita.

---

## 25. Campos `_last_*`

### 25.1 Exemplos

- `_last_weight_kg`;
- `_last_weight_at`;
- `_last_vaccine_at`;
- `_last_exam_at`.

### 25.2 Tratamento

- remover dos readers Health v1;
- manter temporariamente por compatibilidade;
- não atualizar pelos novos clients;
- instrumentar uso;
- retirar após cutover.

### 25.3 Dados

Não são migrados como fatos.

Podem ser usados apenas em reconciliação investigativa.

---

## 26. Attachments e Storage

### 26.1 Inventário

- buckets;
- prefixes;
- nomes;
- content type;
- size;
- owner;
- referência;
- órfãos;
- duplicatas;
- URLs públicas.

### 26.2 Destino

Path canônico definido pelo domínio Health.

### 26.3 Migração de arquivo

Pode usar:

- copy;
- metadata normalization;
- hash;
- reference update.

### 26.4 Rollback

Não apagar o arquivo original durante v1.

### 26.5 Segurança

Revogar URLs públicas inadequadas somente após garantir acesso canônico.

---

# Parte IV — Integração da Nutrição

## 27. Natureza

A Nutrição pós-Foundation não é legado.

É uma implementação canônica ainda não integrada ao shell principal.

### 27.1 Fontes

- branch `feature/health-web-nutrition`;
- callables;
- `nutrition_plans`;
- receipts;
- capability;
- readers coordenados.

### 27.2 Classificação

```text
CANÔNICO A INTEGRAR
```

### 27.3 Não migrar como legado

O código pode ser reconciliado.

Os dados canônicos permanecem canônicos.

### 27.4 Convivência com prescrições antigas

Ordem:

1. plano canônico ativo;
2. readers de legado identificados;
3. conflict se múltiplas fontes incompatíveis;
4. sem seleção automática.

### 27.5 Documento específico

A integração detalhada será tratada em:

```text
HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md
```

---

# Parte V — Rastreamento de migração

## 28. Campos obrigatórios

Todo documento criado ou normalizado pela migração deve carregar:

```text
legacy_source
legacy_id
legacy_collection
schema_version
migration_version
migrated_at
migration_checksum
migration_batch_id
```

### 28.1 Campos condicionais

```text
normalized_from
reconciliation_status
reconciliation_notes
source_checksum
target_checksum
```

### 28.2 Server-managed

Todos os metadados são escritos por Backend/Admin SDK.

---

## 29. ID determinístico

Opções:

```text
{legacy_source}_{legacy_id}
```

ou hash previsível do path.

### 29.1 Requisitos

- estável;
- sem colisão;
- reproduzível;
- independente da ordem;
- seguro para Firestore path.

### 29.2 Colisão

Em caso de colisão:

- rejeitar;
- registrar;
- não gerar ID aleatório silencioso.

---

## 30. Checksum

### 30.1 Objetivo

Detectar:

- alteração de fonte;
- divergência;
- replay;
- corrupção;
- transformação inesperada.

### 30.2 Canonicalização

Definir:

- ordenação de chaves;
- timestamps;
- nulls;
- arrays;
- números;
- strings;
- campos ignorados.

### 30.3 Tipos

- checksum do payload fonte;
- checksum do alvo;
- checksum before;
- checksum after.

### 30.4 Algoritmo

Deve ser versionado.

---

# Parte VI — Documento de batch

## 31. Path

```text
_migrations/health_v1/batches/{batchId}
```

### 31.1 Campos mínimos

```text
batch_id
started_at
completed_at
source_collection
dog_id | all
total_source
total_migrable
total_migrated
total_rejected
total_skipped
total_conflict
rejections
conflicts
manifest
dry_run
migration_version
status
created_by
approved_by?
```

### 31.2 Status

- planned;
- dry_running;
- dry_run_completed;
- approved;
- running;
- completed;
- failed;
- rollback_pending;
- rolled_back;
- cutover_locked.

### 31.3 Manifest

Cada operação:

```text
operation_type: create | update
target_path
target_id
before_image
changed_fields
migrated_at
checksum_before
checksum_after
source_path
source_id
```

### 31.4 Limite

Se o manifest exceder limites Firestore:

- usar subcollection de entries;
- manter summary no batch;
- preservar atomicidade lógica.

A estrutura final deve considerar tamanho real.

---

# Parte VII — Rollback

## 32. Regras canônicas

1. Somente antes do cutover do agregado.
2. Somente se alvos não foram modificados por usuário.
3. `create`: apagar apenas o documento criado pelo batch.
4. `update`: restaurar `before_image` nos `changed_fields`.
5. Nunca apagar documento preexistente por operação update.
6. Rollback é por batch completo.
7. Atualizar status para `rolled_back`.
8. Fontes legadas permanecem intactas.
9. Após cutover, batch rollback é proibido.
10. Rollback de aplicação é diferente de rollback de dados.

---

## 33. Proteção contra modificação posterior

Antes do rollback:

- comparar update timestamp;
- comparar checksum;
- verificar audit log;
- verificar version;
- verificar writes posteriores.

### 33.1 Divergência

Se um alvo foi modificado:

```text
ROLLBACK BLOCKED
```

A recuperação será manual e auditada.

---

## 34. Rollback de aplicação

Pode ocorrer mesmo quando rollback de batch é proibido:

- reativar adapter;
- reativar rota antiga;
- desativar feature flag;
- redeployar versão anterior.

### 34.1 Limite

Aplicação antiga pode não compreender novos writes.

A janela deve ser curta e documentada.

---

# Parte VIII — Fases da migração

## 35. MW-0 — Aprovação documental

### Entrada

- pacote Web documental;
- ADR-006;
- plano Mobile.

### Execução

- revisar este plano;
- resolver inconsistências;
- aprovar escopo.

### Saída

```text
GATE MW-0 — MIGRATION PLAN APPROVED
```

---

## 36. MW-1 — Inventário real

### Pré-condições

- acesso read-only;
- ambiente identificado;
- sem writes.

### Execução

1. contar documentos;
2. capturar schema samples;
3. mapear K9s;
4. mapear Storage;
5. mapear producers/consumers;
6. mapear Rules;
7. mapear Functions;
8. mapear indexes;
9. mapear profiles;
10. identificar dados de teste.

### Validação

- contagens reproduzíveis;
- nenhum write;
- relatório em tela;
- dados pessoais minimizados.

### Rollback

Não aplicável.

### Saída

```text
GATE MW-1 — REAL INVENTORY VERIFIED
```

---

## 37. MW-2 — Classificação e dependências

### Execução

Classificar cada fonte/documento:

- migrável;
- legacy;
- duplicata;
- conflito;
- rejeitado;
- desconhecido.

Mapear:

```text
producer → collection → reader → route → report → target
```

### Saída

- matriz de dependências;
- decisões por fonte;
- blockers.

```text
GATE MW-2 — SOURCE CLASSIFICATION APPROVED
```

---

## 38. MW-3 — Adapters read-only pré-backfill

### Adapters

- `RawHealthEventsAdapter`;
- `LegacyWeightAdapter`;
- `LegacyNutritionAdapter`;
- `LegacyDocumentAdapter`;
- `LegacyVaccineAdapter`;
- readers específicos Web.

### Regra

O adapter:

- não escreve;
- não cria entidade canônica;
- retorna origem;
- retorna warnings;
- suporta unknown;
- possui testes.

### `RawHealthEventsAdapter`

Lê:

```text
dogs/{dogId}/health_events
```

Retorna:

- LegacyHealthRecordView;
- timeline DTO.

Nunca ClinicalEvent.

### Saída

```text
GATE MW-3 — READ-ONLY ADAPTERS VERIFIED
```

---

## 39. MW-4 — Schema novo e infraestrutura

### Execução

- criar collections;
- Rules;
- indexes;
- projection contracts;
- batch control;
- feature flags;
- audit;
- migration service;
- dry-run service.

### Rules

- clients read conforme capability;
- clients não escrevem legacy;
- clients não escrevem migration docs;
- projections read-only;
- sources antigas permanecem.

### Saída

```text
GATE MW-4 — MIGRATION INFRASTRUCTURE READY
```

---

## 40. MW-5 — Dry-run

### Pré-condições

- inventário aprovado;
- script versionado;
- checksum;
- IDs;
- sem writes.

### Execução

Para cada fonte:

- ler;
- classificar;
- transformar em memória;
- validar schema;
- detectar duplicata;
- detectar conflito;
- estimar writes;
- gerar manifest simulado.

### Outputs

- source count;
- migrable;
- legacy;
- rejected;
- conflict;
- estimated cost;
- estimated duration;
- sample diffs.

### Regra health_events

Todos classificados como legacy destination.

### Go/no-go

Revisão humana obrigatória.

```text
GATE MW-5 — DRY-RUN APPROVED
```

---

## 41. MW-6 — Backfill real

### Pré-condições

- dry-run aprovado;
- Rules/indexes;
- janela;
- backup lógico;
- rollback.

### Execução

- batches de até 500 writes;
- IDs determinísticos;
- retries;
- manifest;
- checksums;
- audit;
- progress;
- no source delete.

### Validação

- contagens;
- amostra mínima;
- checksum;
- segunda execução sem duplicata;
- legacy payload;
- rejects.

### Saída

```text
GATE MW-6 — BACKFILL VERIFIED
```

---

## 42. MW-7 — Dual-read e shadow read

### Leitura

```text
new source
→ if missing and fallback approved
→ legacy adapter
```

### Resultado tipado

- canonical;
- legacy;
- degraded;
- conflict;
- empty;
- error.

### Telemetria

- source used;
- fallback rate;
- latency;
- error;
- conflict;
- path;
- version.

Sem conteúdo clínico.

### Shadow

Comparar respostas sem exibir diferença ao usuário comum.

### Período

Referência canônica:

```text
mínimo de 30 dias
```

Pode ser ajustado por agregado mediante decisão.

### Saída

```text
GATE MW-7 — DUAL-READ STABLE
```

---

## 43. MW-8 — Paridade e backfill incremental

### Execução

- comparar contagens;
- comparar hashes;
- identificar novos registros legados;
- executar incremental;
- investigar extras;
- investigar faltantes.

### Critérios canônicos

```text
source = destination + documented rejections
```

Amostra de 100 documentos por coleção quando volume permitir.

### Saída

```text
GATE MW-8 — PARITY VERIFIED
```

---

## 44. MW-9 — Cutover por agregado

### Pré-condições

- paridade;
- dual-read estável;
- Mobile atualizado;
- Web atualizada;
- Functions;
- Rules;
- indexes;
- version minimum;
- suporte.

### Execução

1. remover fallback do agregado;
2. usar schema novo;
3. confirmar zero write legado;
4. manter dados antigos.

### Validação

- smoke;
- E2E;
- error rate;
- usage;
- cross-platform;
- audit.

### Rollback de aplicação

Até janela aprovada, com fontes antigas intactas.

### Saída

```text
GATE MW-9 — AGGREGATE CUTOVER
```

---

## 45. MW-10 — Bloqueio de writes legados

### Pré-condições

- cutover estável ≥14 dias;
- zero producers;
- zero write legado ≥7 dias.

### Execução

- bloquear create/update;
- manter read;
- deploy Rules;
- monitorar denies.

### Rollback

Reverter Rules.

### Saída

```text
GATE MW-10 — LEGACY WRITES BLOCKED
```

---

## 46. MW-11 — Retirada de adapters e telas antigas

### Pré-condições

- bloqueio estável ≥30 dias;
- versões antigas fora de uso;
- routes novas estáveis;
- dados preservados.

### Execução

- remover adapters;
- remover models;
- remover tests antigos;
- redirecionar rotas;
- remover UI antiga;
- remover `_last_*` readers;
- remover permissões genéricas do Health v1.

### Dados

Nunca delete como consequência automática.

### Saída

```text
GATE MW-11 — LEGACY CODE RETIRED
```

---

# Parte IX — Cutover por agregado

## 47. Ordem recomendada

| Ordem | Agregado | Risco |
|---:|---|---|
| 1 | Weight | baixo/médio |
| 2 | NutritionPlan canônico | integração, não migração simples |
| 3 | MealLog/SupplementLog | médio |
| 4 | VaccinationRecord | médio/alto |
| 5 | HealthDocument | alto |
| 6 | HealthSchedule | médio |
| 7 | LegacyHealthRecord/timeline | alto |
| 8 | ClinicalCase/Event novos | não migrar health_events |
| 9 | Restrictions | novos canônicos |
| 10 | Summary | projection |

### 47.1 Ajuste

A ordem final depende do inventário real.

---

## 48. Go-live por agregado

Cada agregado terá:

- go-live timestamp;
- versão mínima;
- source antiga;
- source nova;
- producers;
- consumers;
- fallback;
- feature flag;
- cutover owner;
- rollback window.

### 48.1 Registros anteriores

Tratados conforme plano.

### 48.2 Registros posteriores

Devem nascer exclusivamente no schema novo.

---

# Parte X — Coexistência Web

## 49. Rotas antigas

Possíveis estratégias:

- manter temporariamente;
- read-only banner;
- redirecionar;
- ocultar menu;
- feature flag;
- remover.

### 49.1 Regra

Não manter duas experiências completas por tempo indefinido.

---

## 50. Novo `/health`

Durante coexistência:

- novo shell;
- áreas liberadas por flag;
- legado identificado;
- links para telas antigas apenas quando necessário;
- sem score;
- sem writes genéricos.

---

## 51. Perfil `/k9/{dogId}`

Transição:

1. resumo Health v1;
2. link para cockpit;
3. aba antiga read-only;
4. telemetria;
5. redirect;
6. remoção.

### 51.1 Gate

Confirmar que nenhum fluxo depende da aba antiga.

---

## 52. Permissions durante coexistência

### Read

Pode usar adapter temporário:

```text
health.read OR legacy health.view
```

se aprovado.

### Write

Somente capability granular.

### Regra

Não migrar grants genéricos automaticamente.

---

## 53. Feature flags candidatas

```text
healthWebV1Shell
healthWebReadiness
healthWebSchedule
healthWebNutrition
healthWebClinical
healthWebTimeline
healthLegacyFallback
healthLegacyRoutes
```

### 53.1 Flags não substituem

- capability;
- scope;
- Rules;
- Backend validation.

---

# Parte XI — Coexistência Mobile

## 54. Pré-backfill

Adapters leem fontes antigas diretamente.

### 54.1 health_events

Raw adapter retorna legacy view.

### 54.2 Nunca

ClinicalEvent.

---

## 55. Pós-backfill

Fonte primária:

```text
legacy_health_records
```

Fallback temporário:

```text
health_events
```

### 55.1 Merge

Quando ambos existem:

- dedupe determinístico;
- origem;
- conflict;
- sem promoção.

---

## 56. Fase final

Somente NewSchemaSource.

Dados antigos permanecem no Firestore.

---

# Parte XII — Relatórios de migração

## 57. Dashboard administrativo

A ADR canônica prevê que a Web possa mostrar:

- percentual migrado;
- rejeições;
- divergências;
- batches;
- status;
- cutovers.

### 57.1 Escopo v1

Ferramenta administrativa não deve entrar no módulo Health comum automaticamente.

### 57.2 Acesso

Capability futura:

```text
health.reconcile_legacy
```

ou ferramenta técnica equivalente.

### 57.3 Segurança

- sem payload completo na lista;
- audit;
- scope;
- PII minimizada.

---

## 58. Relatório de dry-run

Deve conter:

- versão;
- ambiente;
- fontes;
- contagens;
- decisões;
- rejects;
- conflicts;
- samples;
- estimated writes;
- estimated cost;
- duration;
- go/no-go.

### 58.1 Claude Code

Apresentar em tela.

Não criar MD automaticamente, salvo solicitação.

---

## 59. Relatório de execução

- batch IDs;
- totals;
- migrated;
- skipped;
- rejected;
- failed;
- retries;
- checksums;
- timing;
- cost;
- idempotency;
- rollback eligibility.

---

## 60. Relatório de paridade

- source count;
- destination count;
- rejection count;
- sample hash;
- missing;
- extra;
- conflicts;
- incremental;
- approval.

---

# Parte XIII — Observabilidade

## 61. Métricas

- total por fonte;
- migrable;
- migrated;
- legacy;
- rejected;
- conflict;
- fallback rate;
- latency;
- read source;
- residual writes;
- orphan files;
- checksum mismatch;
- batch failures;
- rollback blocks.

---

## 62. Alertas

- batch failed;
- checksum mismatch;
- source changed during run;
- target modified;
- fallback above threshold;
- legacy write detected;
- projection lag;
- duplicate target;
- orphan attachment;
- cutover error.

---

## 63. Logs

Incluir:

- batchId;
- source path;
- target path;
- result;
- reason;
- correlation;
- duration.

Não incluir:

- payload clínico integral;
- documento;
- token;
- PII excessiva.

---

# Parte XIV — Segurança

## 64. Admin SDK

Ignora Rules.

Portanto, segurança vem de:

- serviço controlado;
- credencial restrita;
- ambiente;
- approval;
- audit;
- allowlist;
- dry-run;
- version.

---

## 65. Rules

### Antes do cutover

- legado mantém comportamento necessário;
- destino protegido;
- migration docs protegidos.

### Depois

- write legado bloqueado;
- read preservado;
- Admin SDK continua controlado.

---

## 66. Storage

- inventory read-only;
- copy controlado;
- hash;
- metadata;
- access;
- orphan policy;
- no public links.

---

# Parte XV — Testes

## 67. Unit

- transforms;
- ID;
- checksum;
- type parsing;
- rejection;
- conflict;
- manifest;
- canonicalization.

---

## 68. Emulator

- dry-run;
- backfill;
- replay;
- Rules;
- rollback;
- target modified;
- cutover;
- write deny;
- readers.

---

## 69. Integration

- Web old reader;
- Web new reader;
- Mobile adapter;
- Function projection;
- Storage;
- permissions;
- audit.

---

## 70. Cross-platform

1. registro legado aparece igual na Web e Mobile;
2. origem é legacy;
3. nenhum ClinicalEvent retroativo;
4. plano canônico prevalece;
5. MealLog dedupe;
6. weight parity;
7. vaccine conditional;
8. documents resolve;
9. fallback telemetry;
10. cutover não quebra versões suportadas.

---

## 71. Rollback tests

- create removed;
- update restored;
- modified target blocks;
- post-cutover blocks;
- batch whole;
- status changed;
- legacy source intact.

---

## 72. UI tests

- legacy badge;
- conflict;
- degraded;
- source;
- missing file;
- old route redirect;
- fallback banner;
- no score;
- no generic edit.

---

# Parte XVI — Critérios de rejeição

## 73. Rejeitar migração canônica quando

- dogId não resolvido;
- data inválida;
- identidade ambígua;
- conflito;
- duplicate sem regra;
- arquivo ausente necessário;
- payload incompatível;
- professional inventado;
- lifecycle impossível;
- source modified;
- checksum mismatch.

### 73.1 Destino

Dependendo da fonte:

- legacy record;
- rejection report;
- manual review.

### 73.2 Nunca

Inventar dados para aumentar taxa de migração.

---

# Parte XVII — Critérios de cutover

## 74. Go

- 100% contabilizado;
- rejects documentados;
- fallback <1%;
- ≥30 dias estável;
- zero critical conflict;
- consumers atualizados;
- producers atualizados;
- Rules/indexes;
- rollback;
- suporte.

---

## 75. No-go

- fonte desconhecida;
- data loss;
- checksum mismatch;
- write residual;
- app antigo dependente;
- permission gap;
- projection gap;
- Storage orphan crítico;
- conflito ativo;
- dry-run divergente.

---

# Parte XVIII — Aposentadoria

## 76. Código

Pode ser removido após gates:

- adapters;
- legacy models;
- hooks antigos;
- score;
- `_last_*` writers;
- old routes;
- generic forms.

---

## 77. Dados

Permanecem:

- collections legadas;
- legacy records;
- batch manifests;
- audit;
- original files, conforme retenção.

### 77.1 Exclusão futura

Exige:

- política de retenção;
- base legal;
- ADR;
- backup;
- aprovação;
- auditoria.

Não faz parte do v1.

---

## 78. Branch de Nutrição

Após integração:

- manter referência/tag;
- comparar commits;
- fechar branch conforme política Git;
- não apagar evidência antes da aprovação;
- documentar estratégia usada.

---

# Parte XIX — Runbook conceitual

## 79. Antes

- confirmar ambiente;
- branch;
- version;
- backups;
- Rules;
- indexes;
- feature flags;
- users;
- support;
- time window.

---

## 80. Durante

- monitorar batch;
- rate limit;
- retry;
- cost;
- logs;
- source changes;
- errors;
- no manual edit.

---

## 81. Depois

- counts;
- samples;
- checksum;
- replay;
- projections;
- UI;
- cross-platform;
- audit;
- approval.

---

## 82. Incidente

Se houver:

1. pausar batch;
2. preservar logs;
3. identificar scope;
4. bloquear próxima execução;
5. avaliar rollback;
6. não apagar fonte;
7. comunicar;
8. registrar decisão;
9. corrigir script;
10. novo dry-run.

---

# Parte XX — Riscos

## 83. MIG-RISK-001 — promoção clínica indevida

**Mitigação:** health_events sempre legacy.

## 84. MIG-RISK-002 — duplicação de nutrição

**Mitigação:** canônico prevalece; conflict.

## 85. MIG-RISK-003 — vacina incompleta promovida

**Mitigação:** promoção condicional.

## 86. MIG-RISK-004 — documento sem arquivo

**Mitigação:** metadata/file states separados.

## 87. MIG-RISK-005 — IDs colidem

**Mitigação:** deterministic scheme testado.

## 88. MIG-RISK-006 — source muda durante batch

**Mitigação:** checksum e janela.

## 89. MIG-RISK-007 — rollback apaga dado novo

**Mitigação:** manifest e modified check.

## 90. MIG-RISK-008 — dual-read eterno

**Mitigação:** métricas, prazo e cutover.

## 91. MIG-RISK-009 — write residual

**Mitigação:** telemetry e Rules.

## 92. MIG-RISK-010 — UI antiga permanece

**Mitigação:** retirement gate.

## 93. MIG-RISK-011 — `_last_*` continua autoridade

**Mitigação:** source matrix e tests.

## 94. MIG-RISK-012 — health_logs vira caso

**Mitigação:** inventário e legacy.

## 95. MIG-RISK-013 — Storage órfão

**Mitigação:** inventory/hash/references.

## 96. MIG-RISK-014 — profile impede leitura nova

**Mitigação:** permission migration.

## 97. MIG-RISK-015 — branch Nutrition perde contratos

**Mitigação:** integration plan.

---

# Parte XXI — Decisões fixadas

## 98. Decisões

1. Estratégia progressiva com adapters.
2. Sem dual-write client-side.
3. Cutover por agregado.
4. Nenhuma exclusão no v1.
5. Todos health_events antigos vão para legacy.
6. Nenhum caso retroativo automático.
7. Original payload é imutável.
8. Clientes não escrevem legacy.
9. Admin SDK pode atualizar metadados auditados.
10. IDs determinísticos.
11. Checksums versionados.
12. Manifest por batch.
13. Rollback apenas antes do cutover.
14. Target modificado bloqueia rollback.
15. Weight records permanecem canônicos.
16. Espelhos permanecem read-only.
17. Vacinas são promoção condicional.
18. Documentos usam storage_path.
19. `_last_*` será aposentado.
20. Alertas serão substituídos.
21. Health logs exigem inventário.
22. Nutrição pós-Foundation é canônica.
23. Dual-read será mensurado.
24. Referência de estabilidade é 30 dias.
25. Fallback alvo <1%.
26. Write legado será bloqueado após estabilidade.
27. Adapters serão removidos no futuro.
28. Dados permanecem para auditoria.
29. Rotas antigas podem ser retiradas antes das collections.
30. Toda fase exige revisão humana.

---

# Parte XXII — Decisões pendentes

## 99. Inventário

- volumes reais;
- tipos em health_logs;
- per-dog documents;
- attachments;
- test data;
- producers.

## 100. Migração

- ID scheme final;
- checksum algorithm;
- batch manifest storage;
- batch size operacional;
- rate limit;
- cost limit;
- go-live timestamp.

## 101. Cutover

- ordem por agregado;
- feature flags;
- versão mínima Mobile;
- janela de rollback;
- owners;
- support.

## 102. Dados

- critérios de vacina suficiente;
- promoção de weight_history exclusivo;
- prescrição antiga;
- documentos órfãos;
- alertas históricos.

## 103. Retenção

- duração;
- Storage;
- batches;
- rejected payload;
- audit.

---

# Parte XXIII — Gates

## 104. Gate MIG-1

Inventário real aprovado.

## 105. Gate MIG-2

Classificação por fonte aprovada.

## 106. Gate MIG-3

Adapters read-only testados.

## 107. Gate MIG-4

Infraestrutura implantada.

## 108. Gate MIG-5

Dry-run aprovado.

## 109. Gate MIG-6

Backfill validado.

## 110. Gate MIG-7

Dual-read estável.

## 111. Gate MIG-8

Paridade comprovada.

## 112. Gate MIG-9

Cutover do agregado.

## 113. Gate MIG-10

Writes legados bloqueados.

## 114. Gate MIG-11

Código legado retirado.

## 115. Gate MIG-12

Migração encerrada documentalmente.

---

## 116. Critérios de aprovação

Este plano estará aprovado quando:

- fontes estiverem corretamente classificadas;
- health_events estiverem protegidos contra promoção;
- rollback estiver claro;
- manifests estiverem definidos;
- fases estiverem alinhadas ao roadmap;
- Nutrição estiver separada de legado;
- Storage estiver contemplado;
- permissions estiverem contempladas;
- cutover por agregado estiver aceito;
- não houver exclusão automática;
- decisões pendentes estiverem visíveis.

---

## 117. Próximo documento recomendado

O próximo documento será:

```text
docs/health/web/implementation/HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md
```

Ele detalhará especificamente:

- auditoria da branch;
- estratégia de integração;
- preservação dos callables;
- reconciliação do shell;
- permissions;
- mockups existentes;
- testes cross-platform;
- plano ativo em produção;
- rollback da integração.

---

## 118. Status

| Item | Estado |
|---|---|
| Estratégia canônica | Incorporada |
| Fontes legadas | Catalogadas documentalmente |
| Política health_events | Fixada |
| Backfill | Planejado |
| Manifest/rollback | Especificados |
| Dual-read | Especificado |
| Cutover | Especificado |
| Retirada do legado | Especificada |
| Inventário real | Pendente |
| Scripts | Não criados |
| Migração real | Não iniciada |
| Aprovação humana | Pendente |

---

## 119. Conclusão

A migração do Health Web v1 não buscará transformar todo registro antigo em uma entidade nova.

Ela buscará preservar a verdade histórica e criar uma fronteira clara:

```text
passado preservado
→ legado identificado
→ presente canônico
→ novos writes controlados
```

Os dados antigos continuarão disponíveis.

Os novos fluxos não dependerão deles como autoridade.

A transição será gradual, mensurada, reversível antes do cutover e permanentemente auditável.
