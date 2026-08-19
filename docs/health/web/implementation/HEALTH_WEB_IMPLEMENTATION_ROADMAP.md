# K9 Ops Web — Health Web v1 Implementation Roadmap

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Roadmap oficial de implementação, validação e ativação |
| Repositório Web | `github.com/jillohh-arch/k9-ops` |
| Branch principal auditada | `master` |
| Branch funcional de Nutrição | `feature/health-web-nutrition` |
| Baseline documental | `HEALTH_WEB_BASELINE.md` |
| Arquitetura-alvo | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Arquitetura da informação | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` |
| Matriz de fontes | `HEALTH_WEB_DATA_SOURCE_MATRIX.md` |
| Matriz de responsabilidades | `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md` |
| Inventário de capabilities | `HEALTH_WEB_CAPABILITIES_INVENTORY.md` |
| Permission Matrix | `HEALTH_WEB_PERMISSION_MATRIX.md` |
| Política de prontidão | `HEALTH_WEB_READINESS_POLICY.md` |
| Fora de escopo deste documento | Executar código, criar branch, alterar produção, definir grants ou realizar deploy |

---

## 1. Objetivo

Este roadmap organiza a construção do **Health Web v1** do K9 Ops em fases pequenas, auditáveis e reversíveis.

O programa deverá transformar o estado atual em um módulo Web oficial de Saúde e Prontidão, preservando:

- dados existentes;
- contratos canônicos do Health v1;
- separação entre Web, Mobile e Backend;
- imutabilidade clínica;
- rastreabilidade;
- autorização granular;
- integração já concluída do Plano Alimentar;
- operação atual do restante do sistema K9 Ops.

A implementação não será conduzida como uma única refatoração ampla.

Ela será executada por gates independentes, com revisão humana entre as fases.

---

## 2. Declaração central do programa

> O Health Web v1 será construído a partir do domínio canônico, não a partir das telas legadas.

A única capacidade Web criada após o início do Health Foundation Mobile é:

```text
Gestão de Plano Alimentar
```

Ela deverá ser preservada e integrada.

O restante da Saúde Web atual:

- foi criado antes do planejamento canônico;
- não possui uso operacional atual;
- não cria obrigação de compatibilidade visual;
- poderá ser substituído;
- deverá ter seus dados e dependências auditados antes de qualquer remoção.

---

## 3. Baselines do programa

O programa possui três baselines distintas.

### 3.1 Baseline documental

Define:

- decisões;
- arquitetura;
- domínio;
- dados;
- capacidades;
- permissões;
- prontidão;
- roadmap.

Estado atual:

```text
EM CONSTRUÇÃO / PENDENTE DE APROVAÇÃO HUMANA
```

### 3.2 Baseline executável

Será criada no Git após:

- preflight;
- auditoria do branch state;
- reconciliação de `master`;
- reconciliação da branch de Nutrição;
- inventário de arquivos;
- testes do estado de partida;
- aprovação documental.

Estado atual:

```text
NÃO CRIADA
```

### 3.3 Baseline operacional

Representará:

- código implantado;
- Rules ativas;
- Functions ativas;
- indexes;
- profiles;
- dados reais;
- comportamento em produção.

Estado atual:

```text
NÃO AUDITADA NESTE PROGRAMA DOCUMENTAL
```

### 3.4 Regra

Nenhuma baseline poderá ser tratada como equivalente às outras.

---

## 4. Princípios de execução

1. Nenhuma implementação antes da aprovação documental da fase.
2. Nenhuma remoção antes da auditoria de dados e dependências.
3. Nenhum write novo antes da capability e callable correspondentes.
4. Nenhum mockup definitivo antes do contrato de página.
5. Nenhuma projection calculada no cliente.
6. Nenhum merge cego da branch de Nutrição.
7. Nenhuma ação genérica `create/edit/archive` como autorização canônica.
8. Nenhum score legado na nova experiência.
9. Nenhum evento clínico final editável.
10. Nenhuma decisão clínica atribuída ao usuário interno.
11. Nenhum deploy sem Emulator, testes e auditoria.
12. Nenhuma ativação global sem rollout controlado.
13. Nenhuma fase é concluída apenas porque o código compila.
14. Toda fase produz evidência verificável.
15. Toda fase termina com revisão humana.

---

## 5. Ordem obrigatória de trabalho

```text
Documentação
↓
Aprovação humana
↓
Preflight
↓
Mockup ou contrato visual
↓
Implementação mínima
↓
Testes locais
↓
Firestore Emulator
↓
Auditoria técnica
↓
Auditoria visual/UX
↓
Revisão humana
↓
Commit
↓
Sincronização
↓
Próxima fase
```

### 5.1 Relatórios de auditoria

Durante execução com Claude Code:

- não gerar ou atualizar arquivo Markdown de relatório;
- apresentar o relatório final diretamente na resposta/tela;
- somente criar arquivo MD quando solicitado explicitamente pelo usuário.

### 5.2 Commits

Cada commit deverá:

- ter escopo único;
- corresponder a uma fase ou subfase;
- passar por `git diff --check`;
- possuir testes relacionados;
- não misturar refatoração oportunista;
- não incluir secrets;
- não incluir artefatos temporários.

---

## 6. Visão geral das fases

| Fase | Nome | Resultado principal |
|---|---|---|
| HW-0 | Fundação documental | verdade de partida e contratos |
| HW-1 | Preflight e baseline executável | estado seguro do repositório e ambiente |
| HW-2 | Shell e read foundation | módulo novo navegável, sem writes clínicos |
| HW-3 | Visão Geral e Prontidão | projections canônicas e cockpit read-only |
| HW-4 | Agenda Preventiva Web | planejamento e gestão temporal |
| HW-5 | Integração de Nutrição | branch canônica incorporada ao novo shell |
| HW-6 | Casos Clínicos e Documentos | núcleo clínico longitudinal |
| HW-7 | Exames, Tratamentos e Monitoramento | workflows clínicos estruturados |
| HW-8 | Restrições e enforcement | restrições canônicas e impacto operacional |
| HW-9 | Histórico, Relatórios, Auditoria e Legado | leitura longitudinal e governança |
| HW-10 | Hardening, homologação e ativação | produção controlada e encerramento do v1 |

---

## 7. Dependências globais

### 7.1 Dependências de domínio

- ADRs Health v1 aprovadas;
- schemas reconciliados;
- lifecycles estáveis;
- cinco estados de prontidão;
- política de restrições;
- temporalidade;
- imutabilidade.

### 7.2 Dependências Backend

- callables por comando;
- idempotência;
- receipts;
- projections;
- audit logs;
- índices;
- Rules;
- Emulator;
- error codes.

### 7.3 Dependências de autorização

- capabilities finais;
- profiles reais inventariados;
- scope;
- `canAccessDogRecord`;
- admin bypass;
- claims;
- strategy de compatibilidade.

### 7.4 Dependências visuais

- mockups aprovados;
- estados técnicos;
- desktop;
- tablet;
- acessibilidade;
- design system.

### 7.5 Dependências cross-platform

- contratos Mobile;
- contrato de Nutrição;
- parsers;
- enums;
- operationId;
- source-of-truth;
- regras offline.

---

# FASE HW-0 — Fundação Documental

## 8. Objetivo

Criar o pacote documental completo antes da implementação.

### 8.1 Entregas já produzidas

| Documento | Pasta | Estado |
|---|---|---|
| `HEALTH_WEB_CURRENT_STATE_AUDIT.md` | `audits/` | criado; revisão humana pendente |
| `HEALTH_WEB_BASELINE.md` | `foundation/` | criado; revisão humana pendente |
| `HEALTH_WEB_TARGET_ARCHITECTURE.md` | `architecture/` | criado; revisão humana pendente |
| `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` | `architecture/` | criado; revisão humana pendente |
| `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md` | `architecture/` | criado; revisão humana pendente |
| `HEALTH_WEB_DATA_SOURCE_MATRIX.md` | `architecture/` | criado; revisão humana pendente |
| `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md` | `architecture/` | criado; revisão humana pendente |
| `HEALTH_WEB_CAPABILITIES_INVENTORY.md` | `foundation/` | criado; revisão humana pendente |
| `HEALTH_WEB_PERMISSION_MATRIX.md` | `foundation/` | criado; revisão humana pendente |
| `HEALTH_WEB_READINESS_POLICY.md` | `foundation/` | criado; revisão humana pendente |
| `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md` | `implementation/` | documento atual |

### 8.2 Entregas documentais restantes

- `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`;
- `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md`;
- `HEALTH_WEB_TEST_STRATEGY.md`;
- `HEALTH_WEB_MOCKUP_PLAN.md`;
- ADRs Web;
- handoff documental para implementação.

### 8.3 Critério de saída

- pacote revisado;
- inconsistências corrigidas;
- decisões pendentes classificadas;
- não necessariamente todas resolvidas;
- escopo de HW-1 aprovado.

### 8.4 Gate HW-0

```text
GATE HW-0 — DOCUMENTATION FOUNDATION APPROVED
```

### 8.5 Status atual

```text
EM ANDAMENTO
```

A criação dos documentos não equivale à aprovação do gate.

---

# FASE HW-1 — Preflight e Baseline Executável

## 9. Objetivo

Transformar a baseline documental em um ponto de partida verificável no repositório e nos ambientes.

## 9.1 Escopo

Somente auditoria e preparação.

Nenhuma feature nova.

## 9.2 Preflight Git

Confirmar:

- repositório correto;
- branch atual;
- HEAD;
- remote;
- divergência com origin;
- worktree limpa;
- staged files;
- untracked files;
- commits recentes;
- branches Health;
- tags;
- merge-base;
- status da branch de Nutrição;
- diferenças entre `master` e a branch funcional.

### 9.2.1 Evidências mínimas

```text
git branch --show-current
git rev-parse HEAD
git status --short
git branch -vv
git fetch origin --prune
git rev-list --left-right --count
git diff --stat
git diff --cached --stat
git diff --check
```

## 9.3 Preflight técnico

Executar no estado inicial:

- instalação reproduzível;
- lint;
- typecheck;
- testes;
- build;
- análise de bundle quando disponível;
- smoke das rotas existentes;
- validação de Firebase config;
- validação de Environment Variables sem expor secrets.

## 9.4 Inventário de autorização real

Read-only:

- `access_profiles`;
- grants Health;
- quantidade de usuários;
- claims;
- scopes;
- aliases;
- fallback;
- admin bypass.

Não publicar nomes pessoais no relatório.

## 9.5 Inventário de dados

Read-only:

- collections Health antigas;
- documentos por collection;
- documentos de testes;
- registros reais possíveis;
- campos;
- timestamps;
- K9s afetados;
- duplicações;
- documentos órfãos;
- Storage;
- índices;
- Rules implantadas;
- Functions implantadas.

## 9.6 Inventário de uso

Confirmar:

- ausência de uso operacional das telas antigas;
- eventuais acessos registrados;
- rotas referenciadas;
- links internos;
- bookmarks;
- relatórios dependentes;
- integrações.

## 9.7 Branch strategy

Criar branch de trabalho somente após aprovação:

```text
feature/health-web-v1-foundation
```

ou nome equivalente aprovado.

### 9.7.1 Regra

A branch deve partir do branch principal atualizado.

### 9.7.2 Nutrição

Não usar a branch de Nutrição como base global automaticamente.

Ela será integrada em HW-5 por cherry-pick, merge seletivo ou reaplicação controlada, conforme auditoria.

## 9.8 Baseline executável

Registrar:

- branch;
- SHA;
- testes;
- build;
- data;
- dependências;
- ambiente;
- limitações;
- findings.

## 9.9 Fora de escopo

- criar shell;
- alterar menu;
- alterar Rules;
- integrar Nutrição;
- remover telas;
- migrar dados.

## 9.10 Critério de saída

- baseline técnica reproduzível;
- worktree limpa;
- branch sincronizada;
- inventário real concluído;
- riscos críticos conhecidos;
- decisão de branch aprovada;
- plano de rollback inicial.

## 9.11 Gate HW-1

```text
GATE HW-1 — EXECUTABLE BASELINE VERIFIED
```

---

# FASE HW-2 — Shell e Read Foundation

## 10. Objetivo

Criar a fundação navegável do novo Health Web sem introduzir writes clínicos.

## 10.1 Entregas

- `HealthModuleShell`;
- rota `/health`;
- navegação secundária;
- route guards;
- `health.read`;
- types de estados técnicos;
- adapters de leitura;
- error boundary;
- skeletons;
- empty states;
- conflict banner;
- legacy badge;
- projection freshness;
- URL filters;
- breadcrumbs;
- feature folder.

## 10.2 Estrutura interna candidata

```text
src/features/health/
├── application/
├── domain/
├── infrastructure/
├── presentation/
├── permissions/
├── readers/
├── commands/
├── projections/
├── legacy/
└── testing/
```

## 10.3 Rotas iniciais

Criar shells, inicialmente sem conteúdo completo:

```text
/health
/health/readiness
/health/schedule
/health/clinical
/health/nutrition
/health/history
/health/reports
```

Auditoria pode permanecer condicionada.

## 10.4 Navegação

- um item Saúde na Sidebar;
- subnavegação interna;
- item ativo para todas as rotas;
- tablet;
- teclado;
- deep link.

## 10.5 Capability foundation

Implementar catálogo central tipado.

### 10.5.1 Leitura

Candidato:

```text
health.read
```

### 10.5.2 Compatibilidade

Adapter temporário de `health.view` somente se aprovado no HW-1.

### 10.5.3 Writes

Nenhum fallback genérico.

## 10.6 Reader result contract

Padronizar:

```text
idle
loading
success
empty
partial
degraded
stale
legacy
conflict
forbidden
not_found
error
```

## 10.7 Componentes transversais

- `HealthPageHeader`;
- `HealthSecondaryNav`;
- `HealthStateBoundary`;
- `ProjectionFreshness`;
- `LegacySourceBadge`;
- `ConflictBanner`;
- `HealthEmptyState`;
- `PermissionBoundary`;
- `DogHealthHeader`.

## 10.8 Perfil do K9

Nesta fase:

- adicionar apenas atalho ou placeholder para o novo cockpit;
- não remover ainda o prontuário antigo;
- não duplicar readers novos e antigos.

## 10.9 Testes

- route guards;
- navigation;
- capability;
- deep links;
- estados;
- tablet;
- accessibility;
- fallback temporário;
- profile inactive;
- dog scope.

## 10.10 Critério de saída

- módulo acessível;
- nenhuma tela antiga quebrada;
- nenhum write novo;
- navigation aprovada;
- permission foundation aprovada;
- contratos de estado testados;
- lint/typecheck/build/test aprovados.

## 10.11 Gate HW-2

```text
GATE HW-2 — HEALTH WEB SHELL AND READ FOUNDATION
```

---

# FASE HW-3 — Visão Geral e Prontidão

## 11. Objetivo

Entregar o primeiro valor oficial do Health Web v1:

- visão global;
- prontidão;
- cockpit individual read-only;
- restrições em leitura;
- evidências;
- freshness;
- conflict.

## 11.1 Pré-condições

- `health_summary/current` disponível ou contrato implantável;
- `operational_restrictions` disponíveis;
- `health.read`;
- mockups aprovados;
- política de freshness;
- cinco estados;
- projection tests.

## 11.2 Backend

Implementar ou confirmar:

- summary projection;
- trigger sources;
- precedence;
- idempotency;
- rebuild;
- version;
- freshness;
- reason fields;
- active restriction summary;
- partial data behavior.

## 11.3 Visão Geral

Blocos:

- contagem por estado;
- prioridades;
- agenda próxima;
- casos ativos;
- tratamentos;
- Nutrição;
- atividade recente.

### 11.3.1 Estratégia incremental

A primeira entrega pode limitar a Visão Geral a:

- prontidão;
- restrições;
- pendências básicas;
- links.

Os demais blocos entram quando suas fontes estiverem prontas.

## 11.4 Lista de prontidão

- filtros;
- ordenação;
- tabela;
- search;
- URL state;
- freshness;
- data quality;
- conflict;
- no score.

## 11.5 Cockpit individual

Primeira versão read-only:

- cabeçalho;
- prontidão;
- razão;
- restrições;
- agenda resumida;
- último peso;
- vacinação;
- plano alimentar;
- casos;
- timeline recente.

## 11.6 Perfil institucional

Substituir o prontuário completo antigo por:

- resumo;
- atalho;
- transição controlada;

somente depois de validar dependências.

## 11.7 Score legado

- não renderizar no novo módulo;
- instrumentar dependência residual;
- remover do fluxo novo;
- preservar código antigo somente enquanto necessário.

## 11.8 Conflict cases

Obrigatórios:

- summary x restriction;
- summary stale;
- missing summary;
- unknown enum;
- projection version;
- partial readers.

## 11.9 Testes cross-platform

- Web lê o mesmo enum do Mobile;
- label correto;
- restriction absoluta bloqueia no Backend;
- summary não é autoridade crítica;
- freshness;
- not_evaluated;
- error ≠ not_evaluated.

## 11.10 Critério de saída

- lista e cockpit aprovados;
- nenhum cálculo client-side;
- score ausente;
- projections testadas;
- conflitos visíveis;
- accessibility;
- performance;
- visual audit;
- human review.

## 11.11 Gate HW-3

```text
GATE HW-3 — CANONICAL READINESS WEB
```

---

# FASE HW-4 — Agenda Preventiva Web

## 12. Objetivo

Disponibilizar a gestão Web da agenda canônica sem confundir planejamento e execução.

## 12.1 Pré-condições

- agenda canônica implantada;
- tipos e tolerâncias aprovados;
- timezone;
- capabilities;
- mockups;
- callables;
- Rules;
- indexes.

## 12.2 Escopo read-only inicial

- lista global;
- filtros;
- atrasados;
- próximos;
- concluídos;
- cancelados;
- detalhe;
- source entity;
- execution link.

## 12.3 Escopo de gestão

Após gate:

- criar item manual;
- reagendar;
- cancelar;
- editar campos administrativos permitidos.

## 12.4 Conclusão por tipo

Não implementar conclusão genérica.

Criar matriz real:

- consulta;
- exame;
- pesagem;
- vacinação;
- reavaliação;
- dose;
- refeição;
- suplemento.

## 12.5 Backend

- validate present/future;
- lifecycle;
- idempotency;
- audit;
- source references;
- auto-generated items;
- temporal read model.

## 12.6 Estado temporal

Derivado:

```text
scheduled
upcoming
today
pending
overdue
```

Nunca persistido como autoridade.

## 12.7 Testes

- timezone;
- DST/política local;
- due_until;
- tolerance;
- terminal states;
- schedule source;
- duplicate generation;
- cancel;
- conflict;
- Web/Mobile parity.

## 12.8 Critério de saída

- agenda global e individual;
- gestão autorizada;
- nenhum fato executado falso;
- conclusão separada;
- audit;
- projections;
- human review.

## 12.9 Gate HW-4

```text
GATE HW-4 — PREVENTIVE SCHEDULE MANAGEMENT
```

---

# FASE HW-5 — Integração da Nutrição

## 13. Objetivo

Integrar a única capacidade Web pós-Foundation ao novo Health Module Shell.

## 13.1 Princípio

```text
PRESERVAR CONTRATOS
RECONCILIAR CÓDIGO
ATUALIZAR EXPERIÊNCIA
NÃO REIMPLEMENTAR SEM MOTIVO
```

## 13.2 Pré-condições

- branch de Nutrição auditada;
- divergência com `master` conhecida;
- callables implantadas confirmadas;
- plano canônico ativo em produção confirmado;
- capability real confirmada;
- tests da branch aprovados;
- mockups existentes auditados.

## 13.3 Estratégias possíveis

### Opção A — Merge controlado

Usar quando:

- branch limpa;
- conflitos pequenos;
- arquitetura compatível.

### Opção B — Cherry-pick seletivo

Usar quando:

- commits têm escopo claro;
- shell antigo diverge;
- deseja preservar histórico.

### Opção C — Reaplicação guiada

Usar quando:

- branch divergiu muito;
- components precisam reorganização;
- contratos são preserváveis, implementação não.

### 13.3.1 Regra

A escolha será feita após auditoria.

## 13.4 Itens a preservar

- models e parsers canônicos;
- readers coordenados;
- canonical/legacy/empty/degraded/error/conflict;
- callables;
- operationId;
- receipts;
- create/update/replace/cancel;
- `health.manage_nutrition_plan`;
- fail-closed múltiplos ativos;
- cross-platform tests.

## 13.5 Itens a reconciliar

- route;
- shell;
- navigation;
- header;
- K9 selector;
- permissions evaluator;
- services location;
- tests;
- design system;
- mensagens;
- estado “features being prepared”;
- links para cockpit.

## 13.6 Itens proibidos

- fallback para `health.edit`;
- Mobile administrando plano;
- Web registrando refeição;
- seleção automática de plano em conflito;
- overwrite estrutural;
- perda de receipts;
- merge sem comparação.

## 13.7 Testes

- create;
- update;
- replace;
- cancel;
- replay;
- conflict;
- legacy;
- multiple active;
- Mobile parser;
- Mobile execution after replace;
- audit;
- permission;
- branch integration.

## 13.8 Critério de saída

- Nutrição dentro do shell;
- contratos intactos;
- UI aprovada;
- branch antiga com destino definido;
- plano canônico legível;
- Mobile integrado;
- tests completos.

## 13.9 Gate HW-5

```text
GATE HW-5 — NUTRITION CROSS-PLATFORM INTEGRATION
```

---

# FASE HW-6 — Casos Clínicos e Documentos

## 14. Objetivo

Criar o núcleo clínico longitudinal read-first e depois habilitar comandos essenciais.

## 14.1 Pré-condições

- ClinicalCase schema;
- ClinicalEvent schema;
- amendment;
- documents;
- ProfessionalIdentity;
- capabilities;
- mockups;
- callables;
- migration policy.

## 14.2 Subfase HW-6A — Lista read-only

- casos;
- filtros;
- status;
- K9;
- última atividade;
- restrições;
- tratamentos;
- próxima ação.

## 14.3 Subfase HW-6B — Detalhe read-only

- timeline do caso;
- eventos;
- amendments;
- documentos;
- exames;
- tratamentos;
- restrições;
- agenda.

## 14.4 Subfase HW-6C — Abertura de caso

Comandos:

- intercorrência;
- consulta externa;
- caso manual permitido.

## 14.5 Subfase HW-6D — Evento clínico

- draft, se aprovado;
- final;
- cancel;
- amendment;
- upload;
- ProfessionalIdentity;
- occurred_at.

## 14.6 Subfase HW-6E — Alta, reabertura e cancelamento

- discharge;
- reopen;
- cancel;
- evidence;
- audit;
- lifecycle.

## 14.7 Documentos

- `health_documents`;
- storage_path;
- temporary URL;
- metadata;
- references;
- upload compensation;
- no inline URLs.

## 14.8 Legado

- eventos antigos permanecem legacy;
- não editar por fluxo canônico;
- links para registro curado;
- normalized view;
- migration batch.

## 14.9 Testes

- lifecycle;
- immutability;
- amendments;
- professional identity;
- source document;
- upload failure;
- duplicate command;
- permissions;
- cancelled case;
- reopen;
- timeline projection.

## 14.10 Critério de saída

- caso longitudinal oficial;
- eventos finais imutáveis;
- documentos canônicos;
- writes autorizados;
- legado identificado;
- audit;
- human review.

## 14.11 Gate HW-6

```text
GATE HW-6 — CLINICAL CASE FOUNDATION
```

---

# FASE HW-7 — Exames, Tratamentos e Monitoramento

## 15. Objetivo

Completar os workflows clínicos estruturados que dependem do caso.

## 15.1 Subfase HW-7A — ExamProcess

- requested;
- collected;
- resulted;
- interpreted;
- impact_assessed;
- cancelled.

### 15.1.1 Ações

- solicitar;
- registrar coleta;
- anexar resultado;
- registrar interpretação;
- avaliar impacto;
- cancelar.

### 15.1.2 Gate de capability

Nomes ausentes devem ser aprovados antes do código.

## 15.2 Subfase HW-7B — TreatmentProtocol

- active;
- paused;
- completed;
- cancelled.

### 15.2.1 Ações Web

- criar;
- pausar;
- retomar;
- concluir;
- cancelar.

### 15.2.2 Evidências

- ProfessionalIdentity;
- source document;
- dose;
- schedule;
- instruções.

## 15.3 Subfase HW-7C — Dose monitoring

Web read-only:

- próxima dose;
- administradas;
- omitidas;
- executor;
- adesão;
- conflitos.

Mobile:

- execução;
- offline queue;
- idempotência.

## 15.4 Subfase HW-7D — Peso

Web:

- série;
- tendência;
- tabela;
- contexto;
- BCS;
- relação com caso.

Write Web:

- somente se aprovado em decisão específica.

## 15.5 Subfase HW-7E — Vacinação

- record canônico;
- validade;
- próxima agenda;
- lote;
- fabricante;
- profissional;
- documento;
- cancelamento.

Sem fallback de 365 dias.

## 15.6 Testes

- stage transitions;
- treatment lifecycle;
- dose dedupe;
- Mobile/Web parity;
- schedule generation;
- storage;
- weight trends;
- vaccination due;
- permissions;
- evidence.

## 15.7 Critério de saída

- processos clínicos estruturados;
- nenhum formulário genérico;
- dose Mobile integrada;
- agenda automática;
- weight/vaccination sources canônicas;
- human review.

## 15.8 Gate HW-7

```text
GATE HW-7 — CLINICAL WORKFLOWS AND MONITORING
```

---

# FASE HW-8 — Restrições e Enforcement Operacional

## 16. Objetivo

Conectar decisões clínicas ao impacto operacional real com segurança.

## 16.1 Escopo

- leitura detalhada;
- emissão;
- encerramento;
- cancelamento administrativo;
- reavaliação;
- summary;
- Mobile enforcement;
- offline policy;
- conflict detection.

## 16.2 Backend

- callable issue;
- callable release;
- callable cancel;
- evidence validation;
- active query;
- authorization endpoint;
- audit;
- idempotency;
- projection update.

## 16.3 Web

- detalhe;
- form de transcrição;
- source document;
- professional;
- activities;
- expected end;
- actual end;
- no override.

## 16.4 Mobile

- start shift validation;
- switch K9 validation;
- cached snapshot;
- absolute restriction fail-closed;
- operational acceptance;
- reconnect reconciliation.

## 16.5 Conflict

Casos obrigatórios:

- summary operational + absolute;
- expected_end passed;
- simultaneous restrictions;
- release without evidence;
- stale summary;
- offline changed restriction.

## 16.6 Testes físicos

Validar em dispositivo real quando o fluxo Mobile for afetado.

## 16.7 Critério de saída

- restrição canônica bloqueia operação;
- Web explica;
- Mobile respeita;
- Backend valida;
- offline auditado;
- no override;
- human review.

## 16.8 Gate HW-8

```text
GATE HW-8 — OPERATIONAL RESTRICTION ENFORCEMENT
```

---

# FASE HW-9 — Histórico, Relatórios, Auditoria e Legado

## 17. Objetivo

Fechar a governança e a leitura longitudinal do módulo.

## 17.1 Subfase HW-9A — Timeline

- projection;
- deterministic ID;
- pagination;
- filters;
- source links;
- occurred_at;
- recorded_at;
- amendments;
- legacy;
- status.

## 17.2 Subfase HW-9B — Relatórios

- prontidão;
- restrições;
- agenda;
- casos;
- tratamento;
- Nutrição;
- peso;
- vacinação;
- cobertura de dados.

## 17.3 Exportação

- capability;
- scope;
- filters;
- metadata;
- audit;
- secure file;
- expiry.

## 17.4 Subfase HW-9C — Auditoria

- domain audit;
- operationId;
- actor;
- channel;
- result;
- before/after permitido;
- support correlation;
- sensitive data minimization.

## 17.5 Subfase HW-9D — Coexistência e migração

- inventory;
- legacy records;
- normalized view;
- batches;
- checksums;
- idempotent migration;
- duplicate detection;
- rollback;
- no destructive delete.

## 17.6 Subfase HW-9E — Retirada das telas antigas

Somente após:

- zero uso;
- dados preservados;
- links atualizados;
- readers novos ativos;
- reports migrados;
- fallback removido;
- human approval.

## 17.7 Testes

- timeline pagination;
- projection rebuild;
- report reproducibility;
- export permission;
- audit access;
- legacy conflict;
- migration re-run;
- checksum;
- old route redirect.

## 17.8 Critério de saída

- histórico oficial;
- reports;
- audit;
- legado consultável;
- migração segura;
- telas antigas desativadas controladamente.

## 17.9 Gate HW-9

```text
GATE HW-9 — HEALTH GOVERNANCE AND LEGACY TRANSITION
```

---

# FASE HW-10 — Hardening, Homologação e Ativação

## 18. Objetivo

Preparar o Health Web v1 para uso operacional real.

## 18.1 Hardening funcional

- unknown enums;
- malformed docs;
- partial;
- stale;
- conflict;
- retries;
- concurrency;
- idempotency;
- revocation;
- session refresh;
- route guards;
- scope.

## 18.2 Hardening técnico

- performance;
- bundle;
- queries;
- indexes;
- listener cleanup;
- pagination;
- memory;
- Storage;
- logs;
- error boundaries;
- observability.

## 18.3 Segurança

- Rules tests;
- callable authorization;
- admin bypass;
- break-glass;
- PII;
- export;
- temporary URLs;
- audit integrity;
- direct write denial.

## 18.4 Acessibilidade

- teclado;
- leitor de tela;
- contraste;
- focus;
- live regions;
- tablet;
- zoom;
- reduced motion;
- tables.

## 18.5 Cross-platform

- Web → Mobile Nutrition;
- Mobile → Web MealLog;
- Web → Mobile Treatment;
- Mobile → Web Dose;
- Web → Mobile Restriction;
- Mobile → Web Incident;
- summary parity;
- enums;
- dates;
- timezone.

## 18.6 Homologação

Ambientes:

1. local;
2. Firestore Emulator;
3. ambiente de homologação;
4. produção com rollout controlado.

## 18.7 Dados de homologação

Criar dataset controlado:

- um K9 por estado;
- restrições simultâneas;
- caso aberto;
- tratamento;
- doses;
- plano ativo;
- conflito nutricional;
- agenda atrasada;
- legacy;
- partial;
- stale;
- documents.

Não usar dados pessoais reais onde fixtures bastam.

## 18.8 Rollout

### Etapa 1 — Staff técnico

- feature flag;
- admins técnicos autorizados;
- leitura.

### Etapa 2 — Gestores selecionados

- read-only;
- feedback;
- audit.

### Etapa 3 — Writes de baixo risco

- schedule;
- NutritionPlan já validado;
- documents.

### Etapa 4 — Clinical management

- cases;
- exams;
- treatment;
- restrictions.

### Etapa 5 — General availability

Somente após gates.

## 18.9 Rollback

Definir:

- feature flags;
- route rollback;
- callable versioning;
- projection rebuild;
- profile rollback;
- data compatibility;
- branch/tag;
- runbook.

## 18.10 Critério de saída

- todos os testes;
- auditoria;
- segurança;
- performance;
- UX;
- documentação;
- rollout;
- rollback;
- suporte;
- aprovação humana.

## 18.11 Gate HW-10

```text
GATE HW-10 — HEALTH WEB V1 OPERATIONAL READINESS
```

---

# Parte I — Gates transversais

## 19. Gate documental

Cada fase exige:

- documento de escopo;
- contrato;
- decisões pendentes;
- acceptance criteria;
- aprovação humana.

## 20. Gate de mockup

Antes de UI definitiva:

- desktop;
- tablet;
- normal;
- loading;
- empty;
- partial;
- stale;
- conflict;
- error;
- forbidden.

## 21. Gate de dados

- source matrix;
- query;
- index;
- version;
- schema;
- migration;
- legacy.

## 22. Gate de autorização

- capability;
- profile;
- scope;
- dog access;
- lifecycle;
- evidence;
- Backend;
- Rules.

## 23. Gate de mutação

- command;
- operationId;
- idempotency;
- transaction;
- audit;
- receipt;
- projection;
- error codes.

## 24. Gate de testes

- unit;
- component;
- integration;
- emulator;
- security;
- cross-platform;
- visual;
- accessibility;
- physical device quando aplicável.

## 25. Gate de revisão humana

O usuário revisa:

- resultado;
- screenshots;
- fluxo;
- audit report em tela;
- findings;
- próximos passos.

---

# Parte II — Definition of Ready

## 26. Uma fase só pode iniciar quando

- escopo está escrito;
- dependências estão prontas;
- branch está limpa;
- baseline está sincronizada;
- mockup está aprovado quando necessário;
- capability está definida;
- source está definida;
- Backend contract está definido;
- tests estão planejados;
- rollback está definido;
- decisões humanas críticas estão resolvidas ou explicitamente fora do escopo.

---

# Parte III — Definition of Done

## 27. Uma fase só pode encerrar quando

- código implementado;
- lint aprovado;
- typecheck aprovado;
- testes aprovados;
- build aprovado;
- Firestore Emulator aprovado;
- Rules aprovadas;
- callables aprovadas;
- audit log validado;
- visual audit aprovada;
- accessibility verificada;
- docs atualizadas;
- diff revisado;
- `git diff --check` aprovado;
- commit de escopo único;
- branch sincronizada;
- relatório final exibido em tela;
- revisão humana aprovada.

---

# Parte IV — Estratégia de commits

## 28. Tipos sugeridos

```text
docs(health-web):
feat(health-web):
fix(health-web):
refactor(health-web):
test(health-web):
chore(health-web):
```

## 29. Granularidade

Exemplos:

```text
docs(health-web): add target architecture
feat(health-web): add health module shell
feat(health-web): add readiness read models
test(health-web): cover readiness projection conflicts
feat(health-web): integrate nutrition plan management
```

## 30. Proibição

Não criar um único commit contendo:

- shell;
- NutritionPlan;
- Rules;
- migration;
- redesign;
- cleanup;
- tests de múltiplas fases.

---

# Parte V — Estratégia de branches

## 31. Branch principal do programa

Candidata:

```text
feature/health-web-v1-foundation
```

## 32. Subbranches

Usar somente se necessário:

```text
feature/health-web-readiness
feature/health-web-schedule
feature/health-web-clinical
```

### 32.1 Preferência

Evitar branch sprawl.

O fluxo atual do projeto favorece:

- branch temática;
- fases sequenciais;
- commits claros;
- auditoria;
- sincronização.

## 33. Nutrição

A branch existente não será apagada até:

- integração;
- comparação;
- testes;
- tag/backup;
- aprovação.

---

# Parte VI — Estratégia de mockups

## 34. Ordem

1. Visão Geral;
2. Prontidão;
3. Cockpit individual;
4. Restrições;
5. Agenda;
6. Clínico;
7. Caso;
8. Exame;
9. Tratamento;
10. Nutrição integrada;
11. Histórico;
12. Relatórios;
13. Auditoria;
14. states;
15. tablet.

## 35. Aprovação

Cada mockup recebe:

- auditoria funcional;
- auditoria de domínio;
- auditoria UX;
- auditoria visual;
- revisão humana.

## 36. Relação com código

Mockup é referência visual.

Não é autoridade de schema ou permissão.

---

# Parte VII — Estratégia de migração

## 37. Princípios

- não destrutiva;
- read-only primeiro;
- batch;
- checksum;
- idempotente;
- auditada;
- reexecutável;
- origem preservada;
- rollback;
- reconciliação.

## 38. Ordem

1. inventário;
2. classificação;
3. legacy normalization;
4. projections;
5. readers;
6. dual-read;
7. migration safe records;
8. conflict review;
9. cutover;
10. retire legacy.

## 39. Regra

A retirada da UI antiga pode ocorrer antes da exclusão física das collections.

---

# Parte VIII — Estratégia de testes

## 40. Pirâmide

```text
unit
→ component
→ integration
→ emulator
→ cross-platform
→ end-to-end
→ visual
→ homologation
```

## 41. Golden paths

- readiness;
- NutritionPlan;
- schedule;
- clinical case;
- restriction;
- treatment;
- timeline.

## 42. Failure paths

- forbidden;
- stale;
- conflict;
- partial;
- malformed;
- replay;
- offline;
- projection lag;
- migration duplicate.

---

# Parte IX — Estratégia de ativação

## 43. Feature flags

Possíveis:

```text
healthWebV1Shell
healthWebReadiness
healthWebSchedule
healthWebNutrition
healthWebClinical
healthWebRestrictions
healthWebReports
```

### 43.1 Regra

Feature flag não substitui autorização.

## 44. Shadow read

Antes do cutover:

- ler projections;
- comparar com fontes;
- registrar divergências;
- não mostrar ao usuário comum.

## 45. Read-only first

Toda área começa como leitura quando possível.

Writes são ativados depois.

## 46. Métricas de ativação

- erros;
- denied;
- projection lag;
- conflict;
- fallback;
- route usage;
- write success;
- replay;
- user feedback.

---

# Parte X — Backlog fora do v1

## 47. Health v1.1

- readiness history;
- relatórios temporais avançados;
- painel de reconciliação;
- configuração de thresholds;
- gestor de projection;
- notificações avançadas;
- exportações configuráveis;
- OCR documental;
- assinatura externa.

## 48. Health v2

- IPO;
- IA assistiva não clínica;
- integração com estoque;
- integração com clínicas;
- fisioterapia;
- cirurgia;
- internação;
- integração laboratorial;
- reconhecimento de exames;
- telemetria de wearables;
- análises preditivas aprovadas.

### 48.1 Regra

Nenhum item v2 deve contaminar a arquitetura v1 sem ADR.

---

# Parte XI — Riscos do programa

## 49. ROAD-RISK-001 — Implementar antes de aprovar documentação

**Mitigação:** Gate HW-0.

## 50. ROAD-RISK-002 — Branch de Nutrição divergir

**Mitigação:** HW-1 e integration plan.

## 51. ROAD-RISK-003 — Produção diferir do repositório

**Mitigação:** inventário read-only.

## 52. ROAD-RISK-004 — Grants genéricos permanecerem

**Mitigação:** capabilities e Permission Matrix.

## 53. ROAD-RISK-005 — Score legado reaparecer

**Mitigação:** policy e tests.

## 54. ROAD-RISK-006 — Timeline client-side

**Mitigação:** projection.

## 55. ROAD-RISK-007 — Clinical write sem evidence

**Mitigação:** Backend.

## 56. ROAD-RISK-008 — Admin bypass

**Mitigação:** policy e audit.

## 57. ROAD-RISK-009 — Migração destrutiva

**Mitigação:** legacy records e batches.

## 58. ROAD-RISK-010 — Scope excessivo

**Mitigação:** access inventory e tests.

## 59. ROAD-RISK-011 — Fase grande demais

**Mitigação:** subfases e commits.

## 60. ROAD-RISK-012 — Projection lag parecer erro de write

**Mitigação:** UX pending.

## 61. ROAD-RISK-013 — Mockup ditar domínio

**Mitigação:** source matrix.

## 62. ROAD-RISK-014 — Cross-platform drift

**Mitigação:** contract tests.

## 63. ROAD-RISK-015 — Remover legado cedo

**Mitigação:** telemetry e cutover gates.

---

# Parte XII — Decisões fixadas

## 64. Decisões

1. O programa será executado em fases HW-0 a HW-10.
2. Baseline documental não é baseline executável.
3. Baseline executável não é produção.
4. Nutrição será integrada em fase própria.
5. Prontidão será a primeira capability funcional read-only ampla.
6. Shell antecede telas completas.
7. Agenda antecede clínico completo.
8. Casos antecedem exame e tratamento.
9. Restrições recebem fase de enforcement própria.
10. Histórico e legado entram após fontes principais.
11. Rollout será read-only first.
12. Writes serão habilitados por domínio.
13. Score legado não entra no novo módulo.
14. Mockups seguem contratos.
15. Reports em arquivos MD de auditoria não serão gerados automaticamente pelo Claude Code.
16. Cada fase termina com revisão humana.
17. Produção será ativada gradualmente.
18. Feature flags não substituem permissions.
19. Migração será não destrutiva.
20. v2 não entra no v1 sem ADR.

---

# Parte XIII — Decisões humanas pendentes

## 65. Sequenciamento

- Agenda antes ou depois de Nutrição integrada?
- Restrições podem ser antecipadas para HW-3 read-only?
- Timeline mínima pode entrar no cockpit antes de HW-9?

## 66. Writes Web

- peso;
- vacinação;
- coleta de exame;
- resultado;
- dose transcrita;
- conclusão de agenda.

## 67. Permissões

- profiles;
- Instructor scope;
- admin bypass;
- export;
- audit;
- documents.

## 68. Produção

- ambiente de homologação;
- feature flag system;
- rollout users;
- rollback;
- monitoring.

## 69. Mockups

- ordem final;
- quantidade;
- reutilização dos 10 mockups de Nutrição;
- tablet.

---

# Parte XIV — Gates consolidados

## 70. Gate HW-0

Documentação aprovada.

## 71. Gate HW-1

Baseline executável verificada.

## 72. Gate HW-2

Shell e read foundation.

## 73. Gate HW-3

Prontidão canônica.

## 74. Gate HW-4

Agenda preventiva.

## 75. Gate HW-5

Nutrição integrada.

## 76. Gate HW-6

Casos clínicos.

## 77. Gate HW-7

Exames e tratamentos.

## 78. Gate HW-8

Restrições e enforcement.

## 79. Gate HW-9

Governança e legado.

## 80. Gate HW-10

Prontidão operacional do Health Web v1.

---

# Parte XV — Status atual do programa

## 81. Resumo

| Fase | Status |
|---|---|
| HW-0 | em andamento; documentos principais produzidos |
| HW-1 | não iniciada |
| HW-2 | não iniciada |
| HW-3 | não iniciada |
| HW-4 | não iniciada |
| HW-5 | implementação pré-existente em branch; integração não iniciada |
| HW-6 | não iniciada |
| HW-7 | não iniciada |
| HW-8 | não iniciada |
| HW-9 | não iniciada |
| HW-10 | não iniciada |

### 81.1 Observação

A existência da branch de Nutrição não significa que HW-5 está concluída.

Ela significa que existe uma implementação canônica a integrar.

---

## 82. Próximos documentos

Após este roadmap:

1. `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`;
2. `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md`;
3. `HEALTH_WEB_TEST_STRATEGY.md`;
4. `HEALTH_WEB_MOCKUP_PLAN.md`;
5. ADRs Web.

---

## 83. Próxima ação recomendada

Criar:

```text
docs/health/web/implementation/HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md
```

Esse documento deverá detalhar:

- inventário de collections;
- classificação;
- dual-read;
- legacy records;
- batches;
- checksums;
- cutover;
- rollback;
- retirada das telas antigas;
- integração com a branch de Nutrição;
- critérios para exclusão futura.

---

## 84. Critérios de aprovação deste roadmap

O roadmap estará aprovado quando:

- as fases estiverem na ordem correta;
- nenhuma fase esconder dependências;
- Nutrição estiver corretamente preservada;
- writes pendentes estiverem visíveis;
- gates estiverem claros;
- Definition of Ready e Done estiverem aceitas;
- rollout e rollback estiverem incluídos;
- sequência de mockups estiver aceita;
- o status atual estiver fiel;
- o usuário aprovar a passagem para HW-1 após os documentos restantes.

---

## 85. Conclusão

O Health Web v1 será construído como um programa controlado, não como uma reescrita improvisada.

A sequência oficial é:

```text
fundação documental
→ baseline executável
→ shell
→ prontidão
→ agenda
→ Nutrição
→ clínico
→ exames e tratamentos
→ restrições
→ governança
→ ativação
```

Cada fase produzirá uma capacidade verificável.

Cada write terá autoridade.

Cada projection terá fonte.

Cada permissão terá justificativa.

Cada migração terá rollback.

E nenhuma etapa avançará sem revisão humana.
