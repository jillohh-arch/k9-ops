# K9 Ops Web — Health Web v1 Mockup Plan

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_MOCKUP_PLAN.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Plano de produção, auditoria e aprovação dos mockups Web |
| Arquitetura da informação | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` |
| Roadmap | `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md` |
| Fora de escopo | Gerar as imagens finais neste documento ou implementar UI |

---

## 1. Propósito

Este documento define a sequência, o conteúdo e os critérios de aprovação dos mockups do Health Web v1.

Os mockups serão a tradução visual de decisões já tomadas.

Eles não poderão inventar:

- entidade;
- lifecycle;
- capability;
- source;
- estado de prontidão;
- write;
- regra de migração.

---

## 2. Objetivos

1. Validar a arquitetura da informação.
2. Validar hierarquia operacional.
3. Validar densidade para desktop.
4. Validar tablet.
5. Validar estados técnicos.
6. Validar permissões.
7. Validar drill-down.
8. Validar a integração da Nutrição existente.
9. Criar referência visual antes do código.
10. Reduzir retrabalho.

---

## 3. Identidade visual

Preservar a identidade K9 Ops:

- dark navy/azul petróleo;
- cyan/teal;
- glow sutil;
- HUD discreto;
- linguagem institucional tática;
- contraste forte;
- alta legibilidade;
- sem estética de pet app.

### 3.1 Saúde

A experiência deve comunicar:

```text
centro de prontidão
+ gestão operacional
+ prontuário institucional
```

Não:

```text
aplicativo veterinário doméstico
```

---

## 4. Princípios visuais

1. Criticidade não depende de cor.
2. Restrição tem prioridade sobre decoração.
3. Ação primária é única.
4. Tabelas para comparação.
5. Cards para síntese.
6. Formulários por comando.
7. Origem e freshness são visíveis.
8. Legado é identificado.
9. Conflito não é escondido.
10. Empty state explica.
11. Loading não mostra zero falso.
12. Tablet não perde informação crítica.

---

## 5. Processo por mockup

```text
brief funcional
→ prompt visual
→ primeira imagem
→ auditoria de domínio
→ auditoria UX
→ auditoria visual
→ ajustes
→ aprovação humana
→ registro como referência
```

### 5.1 Auditorias

Cada mockup receberá:

- auditoria de domínio Health;
- auditoria de segurança/permission;
- auditoria UX;
- auditoria visual/marketing institucional;
- revisão de português;
- revisão humana do usuário.

---

## 6. Pacote de referências

Usar como referência:

- Web K9 Ops atual;
- dez mockups de Plano Alimentar já produzidos;
- screenshots Mobile Health aprovadas;
- identidade tática do sistema;
- arquitetura da informação atual.

### 6.1 Limite

Referência visual não é autoridade funcional.

---

## 7. Formatos

### Desktop principal

- proporção 16:9;
- viewport de referência próxima a 1440 × 900;
- Sidebar e topbar reais do K9 Ops.

### Notebook

- validar largura intermediária.

### Tablet landscape

- navegação secundária;
- tabelas;
- drawers.

### Tablet portrait

- cards empilhados;
- colunas reduzidas;
- filtro em drawer.

---

## 8. Estados transversais a representar

- normal;
- loading;
- refreshing;
- empty;
- partial;
- degraded;
- stale;
- legacy;
- conflict;
- forbidden;
- not_found;
- error;
- command pending;
- command success;
- validation error.

---

# Parte I — Sequência oficial

## 9. M-01 — Visão Geral de Saúde

### Objetivo

Responder:

- como está o efetivo;
- quem exige prioridade;
- o que vence;
- quais casos estão abertos.

### Conteúdo

- distribuição por cinco estados;
- prioridades;
- agenda próxima;
- casos/tratamentos;
- Nutrição;
- atividade recente.

### Estado principal

Dados completos, vários K9s.

### Estados adicionais

- partial;
- empty do efetivo;
- projection stale.

### Ação primária

Contextual ou nenhuma.

### Proibição

Score percentual.

---

## 10. M-02 — Prontidão do Efetivo

### Objetivo

Comparar K9s.

### Conteúdo

- tabela;
- foto;
- status;
- razão;
- restrições;
- pendência;
- atualização;
- filtros.

### Estado especial

Conflict em um K9.

### Auditoria

Verificar ordenação e densidade.

---

## 11. M-03 — Cockpit Individual: Resumo

### Objetivo

Explicar a condição de um K9.

### Contexto sugerido

K9 com `fit_with_restrictions`.

### Conteúdo

- header;
- readiness;
- razões;
- restrições;
- agenda;
- caso;
- tratamento;
- peso;
- vacinação;
- plano;
- histórico.

### Ação

Abrir detalhe de restrição.

---

## 12. M-04 — Cockpit: Restrições

### Objetivo

Mostrar lifecycle e evidência.

### Conteúdo

- restrições ativas;
- encerradas;
- nível;
- atividades;
- professional;
- documento;
- expected_end;
- reavaliação.

### Estado especial

Expected_end ultrapassado, ainda active.

### Ação

Registrar encerramento, se autorizado.

---

## 13. M-05 — Agenda Global

### Objetivo

Planejar e priorizar.

### Conteúdo

- lista/tabela;
- hoje;
- atrasados;
- próximos;
- tipos;
- K9;
- source;
- lifecycle.

### Ação

Criar item.

### Estado especial

Item automático e item manual.

---

## 14. M-06 — Detalhe e Gestão da Agenda

### Objetivo

Explicar planejamento × execução.

### Conteúdo

- data;
- timezone;
- tolerância;
- origem;
- histórico;
- fato vinculado.

### Ações

- reagendar;
- cancelar;
- concluir somente conforme tipo.

---

## 15. M-07 — Casos Clínicos

### Objetivo

Listar agregados clínicos.

### Conteúdo

- K9;
- título;
- status;
- profissional;
- última atividade;
- tratamento;
- restrição;
- próxima ação.

### Ação

Abrir caso clínico.

---

## 16. M-08 — Detalhe do Caso Clínico

### Objetivo

Mostrar história longitudinal.

### Conteúdo

- header;
- timeline;
- events;
- amendments;
- exams;
- treatments;
- restrictions;
- documents;
- schedule.

### Ações

Contextuais por capability.

### Estado especial

Evento final com amendment.

---

## 17. M-09 — Processo de Exame

### Objetivo

Mostrar lifecycle.

### Conteúdo

- stepper;
- request;
- collection;
- result;
- interpretation;
- impact;
- documents.

### Estado

Resulted aguardando interpretação.

---

## 18. M-10 — Tratamento e Monitoramento

### Objetivo

Mostrar protocolo e execução.

### Conteúdo

- medication;
- dose;
- schedule;
- professional;
- document;
- next dose;
- administered/skipped;
- adherence.

### Ações Web

- pause;
- resume;
- complete;
- cancel, conforme contrato.

---

## 19. M-11 — Nutrição Global Integrada

### Objetivo

Integrar os mockups existentes ao shell.

### Conteúdo

- lista de K9s;
- plano ativo;
- status;
- vigência;
- versão;
- source;
- action.

### Ação

Novo plano alimentar.

### Estados

- canonical;
- legacy;
- empty;
- conflict.

---

## 20. M-12 — Plano Alimentar: Detalhe e Commands

### Reusar

Auditar os mockups 1–10 existentes.

### Demonstrar

- create;
- update;
- replace;
- cancel;
- operation pending;
- receipt success;
- conflict.

### Proibição

Registrar refeição.

---

## 21. M-13 — Histórico Global

### Objetivo

Timeline normalizada.

### Conteúdo

- filtros;
- pagination;
- category;
- K9;
- occurred;
- recorded;
- source;
- legacy;
- amendment.

### Estado especial

Partial e legacy.

---

## 22. M-14 — Relatórios

### Objetivo

Análise gerencial.

### Conteúdo

- categorias;
- filtros;
- coverage;
- freshness;
- charts com tabela;
- export.

### Proibição

Ranking de saúde.

---

## 23. M-15 — Auditoria

### Objetivo

Investigar operações.

### Conteúdo

- actor;
- action;
- entity;
- result;
- operationId;
- channel;
- timestamp;
- filters.

### Acesso

Restrito.

---

## 24. M-16 — Estados Técnicos

Criar prancha comparativa com:

- loading;
- empty;
- partial;
- stale;
- legacy;
- conflict;
- forbidden;
- error.

### Objetivo

Padronizar mensagens e banners.

---

## 25. M-17 — Tablet

Selecionar telas críticas:

- readiness list;
- cockpit;
- agenda;
- clinical case;
- NutritionPlan.

### Validar

- secondary nav;
- filter drawer;
- tables;
- actions;
- long text;
- touch.

---

# Parte II — Conteúdo e nomenclatura

## 26. Labels oficiais

- Saúde e Prontidão;
- Visão Geral;
- Prontidão;
- Agenda;
- Clínico;
- Nutrição;
- Histórico;
- Relatórios;
- Auditoria;
- Operacional;
- Operacional com Atenção;
- Apto com Restrições;
- Temporariamente Inapto;
- Não Avaliado.

---

## 27. Ações

Usar verbos específicos:

- Abrir caso clínico;
- Criar item de agenda;
- Registrar restrição operacional;
- Registrar encerramento da restrição;
- Criar plano alimentar;
- Substituir plano;
- Cancelar plano;
- Exportar relatório.

Evitar:

- Novo;
- Adicionar;
- Gerenciar;
- Registrar evento;
- Liberar K9;
- Editar prontidão.

---

## 28. Dados fictícios

Mockups devem usar dados fictícios consistentes.

Podem usar nomes conhecidos do projeto como referência somente se o usuário aprovar.

Não inserir:

- dados clínicos reais;
- números profissionais reais;
- laudos reais;
- documentos reais.

---

## 29. Realismo de domínio

Cada tela deve mostrar combinações plausíveis.

Exemplo proibido:

```text
K9 operational com restriction absolute ativa sem conflict
```

Exemplo correto:

```text
summary antigo + restriction absolute → conflict técnico visível
```

---

# Parte III — Componentes visuais

## 30. Health Module Shell

- título;
- descrição;
- nav;
- dog search;
- action;
- freshness;
- degraded banner.

---

## 31. Status components

- ReadinessBadge;
- RestrictionBadge;
- ScheduleState;
- ClinicalCaseStatus;
- NutritionPlanStatus;
- LegacyBadge;
- ConflictIndicator.

### Regra

Mesma altura, typography e semântica consistentes.

---

## 32. Tabelas

Validar:

- header contrast;
- row divider;
- hover/focus;
- sorting;
- filters;
- pagination;
- actions;
- expanded row;
- empty.

---

## 33. Cards

Cards de resumo devem:

- ter uma pergunta/resposta clara;
- evitar múltiplas ações;
- permitir drill-down;
- não competir com status crítico.

---

## 34. Forms

Mostrar:

- context header;
- required fields;
- evidence;
- professional;
- recorded by;
- consequences;
- validation;
- confirmation.

### Regra

Form não deve reproduzir nomes de campos técnicos.

---

## 35. Timeline

- date grouping;
- type;
- title;
- actor;
- origin;
- source link;
- amendment;
- legacy.

---

## 36. Documents

- type icon;
- title;
- issuer;
- date;
- related entity;
- preview/download;
- missing file state.

---

# Parte IV — Auditoria por mockup

## 37. Auditoria de domínio

Perguntas:

1. O estado existe?
2. A entidade existe?
3. A ação é permitida?
4. A source é correta?
5. O lifecycle permite?
6. O profissional está representado corretamente?
7. Planejamento foi confundido com execução?
8. Projection foi tratada como source?

---

## 38. Auditoria de permission

1. Qual capability?
2. Qual profile candidato?
3. A ação deveria estar oculta?
4. É Web ou Mobile?
5. Há evidence?
6. Há scope?

---

## 39. Auditoria UX

1. A prioridade é compreensível?
2. A ação primária está clara?
3. O usuário sabe voltar?
4. O filtro está visível?
5. O estado vazio ajuda?
6. O conflito explica?
7. A densidade é adequada?

---

## 40. Auditoria visual

1. Identidade K9 Ops?
2. Contraste?
3. Hierarquia?
4. Status consistentes?
5. Glow discreto?
6. Tabela legível?
7. Espaçamento?
8. Tablet?

---

## 41. Auditoria de acessibilidade

1. Não depende de cor?
2. Focus visível?
3. Labels completos?
4. Touch target?
5. Texto mínimo?
6. Tabela semântica possível?
7. Dialog com escape?
8. Reduced motion?

---

# Parte V — Aprovação

## 42. Estados do mockup

- Draft;
- Em auditoria;
- Ajustes solicitados;
- Aprovado visualmente;
- Aprovado funcionalmente;
- Referência oficial;
- Substituído.

### 42.1 Regra

“Aprovado visualmente” não libera implementação se a função não foi aprovada.

---

## 43. Registro de referência

Cada mockup aprovado deve possuir:

- ID;
- título;
- rota;
- versão;
- data;
- status;
- documento funcional;
- states;
- arquivo;
- observações.

---

## 44. Pasta recomendada

```text
docs/health/web/mockups/
├── references/
├── approved/
├── drafts/
├── audits/
└── prompts/
```

### 44.1 Arquivos finais

Nomes:

```text
HW-M01-OVERVIEW-v1.png
HW-M02-READINESS-v1.png
```

---

## 45. Ordem de produção recomendada

### Ciclo A — Prontidão

M-01 a M-04.

### Ciclo B — Agenda

M-05 e M-06.

### Ciclo C — Clínico

M-07 a M-10.

### Ciclo D — Nutrição

M-11 e M-12.

### Ciclo E — Governança

M-13 a M-15.

### Ciclo F — States e tablet

M-16 e M-17.

---

## 46. Dependências

| Mockup | Dependência |
|---|---|
| M-01 | readiness policy |
| M-02 | summary contract |
| M-03 | cockpit IA |
| M-04 | restriction model |
| M-05 | schedule contract |
| M-07 | case lifecycle |
| M-09 | exam lifecycle |
| M-10 | treatment protocol |
| M-11 | nutrition integration plan |
| M-13 | timeline projection |
| M-14 | report capability |
| M-15 | audit contract |

---

## 47. Critérios de gate visual

```text
route clear
+ domain valid
+ permission valid
+ state valid
+ desktop approved
+ tablet approved
+ accessibility reviewed
+ human approved
```

---

## 48. Riscos

### MOCK-RISK-001 — Mockup inventa write

Mitigação: domain audit.

### MOCK-RISK-002 — Score reaparece

Mitigação: readiness policy.

### MOCK-RISK-003 — Cards demais

Mitigação: tables.

### MOCK-RISK-004 — Mobile copiado para Web

Mitigação: management-first IA.

### MOCK-RISK-005 — Nutrição perdida

Mitigação: reuse audit.

### MOCK-RISK-006 — Estado técnico oculto

Mitigação: M-16.

### MOCK-RISK-007 — Tablet tardio

Mitigação: validate each cycle.

### MOCK-RISK-008 — Professional confundido

Mitigação: explicit labels.

### MOCK-RISK-009 — Dados reais expostos

Mitigação: fixtures.

### MOCK-RISK-010 — Imagem aprovada virar contrato

Mitigação: document hierarchy.

---

## 49. Decisões fixadas

1. Haverá um único item Saúde.
2. Mockups seguem IA.
3. Sequência M-01 a M-17.
4. Desktop e tablet.
5. Estados técnicos obrigatórios.
6. No score.
7. Restrição é prioritária.
8. Cards para síntese.
9. Tabelas para comparação.
10. Forms por command.
11. Dez mockups de Nutrição serão auditados.
12. Mockups usam dados fictícios.
13. Acessibilidade é revisada.
14. Cada mockup tem rota.
15. Approval visual ≠ approval funcional.
16. Domain document prevalece.
17. Prompt será arquivado.
18. Audits podem ser relatadas em tela durante trabalho.
19. Mockup final vira referência.
20. Implementação só após gate.

---

## 50. Decisões pendentes

- ferramenta de geração;
- tamanho exato;
- tokens de cor;
- ícones;
- route individual de Nutrição;
- navigation tabs;
- quantidade de detalhes no cockpit;
- formato de reports;
- posição da Auditoria;
- uso de fotos reais de K9s.

---

## 51. Critérios de aprovação

O plano estará aprovado quando:

- sequência estiver aceita;
- estados estiverem completos;
- identidade estiver correta;
- Nutrição estiver preservada;
- auditorias estiverem definidas;
- pasta e naming estiverem aceitos;
- a produção puder começar sem inventar requisito.

---

## 52. Status

| Item | Estado |
|---|---|
| Plano | criado |
| Mockups novos | não iniciados |
| Mockups de Nutrição | existentes, integração pendente |
| Prompts | pendentes |
| Auditoria | pendente |
| Aprovação humana | pendente |

---

## 53. Conclusão

Os mockups do Health Web v1 não serão uma exploração sem limites.

Serão uma validação visual de um sistema já definido:

```text
domínio correto
→ informação correta
→ hierarquia correta
→ ação correta
→ experiência correta
```

A imagem final deverá tornar o contrato mais compreensível, nunca substituí-lo.
