# K9 Ops Web — Health Web v1 Foundation Review

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_FOUNDATION_REVIEW.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Revisão humana pendente |
| Natureza | Revisão consolidada da fundação documental |
| Escopo | Documentação Web Health v1 |
| Implementação de código | Não realizada por este pacote |

---

## 1. Propósito

Este documento consolida o estado final da fundação documental do Health Web v1.

Ele responde:

- quais decisões já foram fixadas;
- quais decisões continuam pendentes;
- quais riscos bloqueiam implementação;
- se os documentos são coerentes;
- qual é o próximo gate;
- o que não foi implementado.

---

## 2. Estado do pacote

O pacote define:

- auditoria do estado atual;
- baseline;
- arquitetura-alvo;
- arquitetura da informação;
- modelo domínio-telas;
- fontes de dados;
- fronteiras Web/Mobile/Backend;
- capabilities;
- Permission Matrix;
- prontidão;
- roadmap;
- migração;
- integração de Nutrição;
- testes;
- mockups;
- ADRs;
- handoff.

### 2.1 Natureza

A fundação é:

```text
documental
não executável
não implantada
não aprovada para produção
```

---

## 3. Decisões humanas já registradas no programa

1. O Health Web antigo não é usado operacionalmente.
2. Ele foi criado antes da Foundation.
3. Não há obrigação de compatibilidade visual.
4. Dados antigos devem ser preservados.
5. NutritionPlan é a única capacidade Web pós-Foundation.
6. NutritionPlan deve ser preservado e integrado.
7. O novo módulo deve ser planejado antes dos mockups e código.
8. Documentos ficam em `docs/health/web/`.
9. Auditorias e desenvolvimento seguem fases e revisão humana.
10. Relatórios Claude Code devem aparecer em tela, não em MD automático.

---

## 4. Decisões arquiteturais fixadas

### 4.1 Estrutura

- um item Saúde na Sidebar;
- navegação secundária;
- visão global;
- cockpit individual;
- páginas de entidade;
- perfil K9 como resumo e link.

### 4.2 Domínio

- caso clínico como agregado;
- evento final imutável;
- amendment append-only;
- exame com lifecycle;
- tratamento como protocolo;
- agenda como planejamento;
- execução como fato separado.

### 4.3 Prontidão

- cinco estados;
- summary server-side;
- restriction canônica para autorização;
- no score legado;
- no override;
- error ≠ not_evaluated;
- freshness e conflict visíveis.

### 4.4 Plataformas

- Web administra;
- Mobile executa;
- Backend valida/persiste;
- Functions projetam;
- Admin SDK migra;
- profissional externo decide;
- usuário interno registra.

### 4.5 Autorização

- capability-driven;
- `health.read` como leitura comum candidata;
- writes granulares;
- no `create/edit/archive` como autoridade;
- no specialty grant;
- admin não é clínico;
- NutritionPlan sem fallback.

### 4.6 Legado

- adapters;
- backfill idempotente;
- dual-read temporário;
- cutover por agregado;
- health_events sempre legacy;
- sem exclusão no v1.

---

## 5. Documentos produzidos

### Auditoria

- `HEALTH_WEB_CURRENT_STATE_AUDIT.md`.

### Foundation

- `HEALTH_WEB_BASELINE.md`;
- `HEALTH_WEB_CAPABILITIES_INVENTORY.md`;
- `HEALTH_WEB_PERMISSION_MATRIX.md`;
- `HEALTH_WEB_READINESS_POLICY.md`;
- `HEALTH_WEB_FOUNDATION_REVIEW.md`.

### Architecture

- `HEALTH_WEB_TARGET_ARCHITECTURE.md`;
- `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`;
- `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md`;
- `HEALTH_WEB_DATA_SOURCE_MATRIX.md`;
- `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`.

### Implementation

- `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`;
- `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`;
- `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md`;
- `HEALTH_WEB_IMPLEMENTATION_HANDOFF.md`.

### Testing

- `HEALTH_WEB_TEST_STRATEGY.md`.

### Mockups

- `HEALTH_WEB_MOCKUP_PLAN.md`.

### ADRs

- ADR-WEB-001 a ADR-WEB-006.

### Index

- `HEALTH_WEB_DOCUMENT_INDEX.md`.

---

## 6. Matriz de consistência

| Tema | Baseline | Architecture | IA | Domain | Data | Platform | Permissions | Roadmap | Resultado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Nutrição canônica | sim | sim | sim | sim | sim | sim | sim | sim | consistente |
| Web gestão/Mobile execução | sim | sim | sim | sim | sim | sim | sim | sim | consistente |
| cinco estados | sim | sim | sim | sim | sim | sim | sim | sim | consistente |
| no score Web | sim | sim | sim | sim | sim | n/a | n/a | sim | consistente |
| event immutability | sim | sim | sim | sim | sim | sim | sim | sim | consistente |
| legacy preservation | sim | sim | sim | sim | sim | sim | n/a | sim | consistente |
| capabilities | sim | sim | sim | sim | sim | sim | sim | sim | consistente |
| no code yet | sim | sim | sim | sim | sim | sim | sim | sim | consistente |

---

## 7. Questões realmente restantes

### 7.1 Produção e repositório

- estado atual de `master`;
- estado da branch Nutrition;
- profiles reais;
- claims reais;
- Rules/Functions implantadas;
- collections e volumes;
- uso real das telas.

### 7.2 Permissões

- grants aprovados por perfil;
- escopo do Instrutor;
- admin bypass;
- exportação;
- documentos sensíveis;
- audit.

### 7.3 Writes Web

- peso;
- vacinação;
- coleta de exame;
- resultado;
- conclusão de agenda;
- dose transcrita.

### 7.4 Prontidão

- thresholds;
- SLA de projection;
- configuração;
- conflict reconciliation;
- readiness history.

### 7.5 UI

- mockups;
- route individual;
- tabs;
- tokens;
- Auditoria no módulo ou global.

---

## 8. Riscos bloqueadores P0

### P0-01 — Profiles reais desconhecidos

Não criar grants sem inventário.

### P0-02 — Produção pode divergir do repositório

Preflight real obrigatório.

### P0-03 — Backend contracts podem ter mudado

Reconfirmar callables, Rules e Functions.

### P0-04 — Dados legados não inventariados

Nenhuma remoção/migração antes do inventory.

### P0-05 — Branch Nutrition divergente

Não executar merge cego.

### P0-06 — Summary/restrictions não confirmados

Readiness implementation depende do contrato real.

---

## 9. Riscos P1

- admin bypass;
- generic permissions;
- Storage órfão;
- timeline client-side antiga;
- `_last_*` ainda usado;
- mockups sem states;
- migration conflict;
- Mobile versions antigas.

---

## 10. Riscos P2

- densidade visual;
- nomenclatura;
- route shape;
- tool selection;
- coverage thresholds;
- feature flag implementation.

---

## 11. Itens adiados

### v1.1

- readiness history;
- projection admin;
- legacy reconciliation UI;
- threshold management;
- advanced reports.

### v2+

- IPO;
- AI clínica;
- external vet portal;
- laboratory integration;
- wearables;
- predictive analytics.

---

## 12. Confirmação de ausência de implementação

Este pacote não:

- alterou o repositório;
- criou branch;
- executou merge;
- alterou Firestore;
- alterou Rules;
- alterou Functions;
- alterou profiles;
- alterou claims;
- criou mockups finais;
- realizou deploy;
- migrou dados.

Os arquivos Markdown são artefatos documentais locais para revisão e inclusão no repositório pelo usuário.

---

## 13. Gate atual

O programa permanece em:

```text
HW-0 — FOUNDATION DOCUMENTATION
```

### 13.1 Gate de saída

```text
GATE HW-0 — DOCUMENTATION FOUNDATION APPROVED
```

Ainda não aprovado.

---

## 14. Revisão humana recomendada

A revisão pode ser feita em quatro rodadas.

### Rodada A — decisões de produto

- IA;
- rotas;
- writes Web;
- profiles.

### Rodada B — arquitetura

- projections;
- sources;
- platform boundaries;
- migration.

### Rodada C — operação

- readiness;
- restrictions;
- evidence;
- workflow.

### Rodada D — execução

- roadmap;
- tests;
- mockups;
- handoff.

---

## 15. Próximo passo após aprovação

Iniciar:

```text
HW-1 — Preflight e Baseline Executável
```

Somente read-only.

### 15.1 Entregas HW-1

- Git preflight;
- build/test baseline;
- branch audit;
- authorization inventory;
- data inventory;
- deployment inventory;
- risk update;
- strategy decision.

---

## 16. Critérios de aprovação da Foundation

- documentos salvos nas pastas corretas;
- nenhuma inconsistência crítica;
- decisões pendentes visíveis;
- ADRs aceitas;
- roadmap aceito;
- migration conservadora aceita;
- Nutrition preservation aceita;
- human sign-off.

---

## 17. Recomendação final

A fundação documental está suficientemente completa para impedir que a implementação comece às cegas.

Ela não elimina a necessidade de auditoria real.

Pelo contrário, define exatamente o que deve ser verificado antes do primeiro commit.

---

## 18. Status

| Área | Estado |
|---|---|
| Auditoria documental | concluída |
| Arquitetura | documentada |
| IA | documentada |
| Domínio/telas | documentado |
| Data sources | documentadas |
| Platform boundaries | documentadas |
| Capabilities | inventariadas documentalmente |
| Permission candidates | documentadas |
| Readiness | documentada |
| Roadmap | documentado |
| Migration | documentada |
| Nutrition integration | documentada |
| Testing | documentado |
| Mockups | planejados |
| ADRs | propostas |
| Produção | não auditada |
| Código | não iniciado |
| Aprovação humana | pendente |

---

## 19. Conclusão

A Foundation do Health Web v1 está documentalmente fechada em versão draft.

O próximo movimento correto não é implementar uma tela.

É verificar a realidade:

```text
Git
+ código
+ Firebase
+ profiles
+ dados
+ produção
```

Somente depois dessa verificação a baseline executável poderá ser criada.
