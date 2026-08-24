# K9 Ops Web — Health Web v1 Implementation Handoff

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_IMPLEMENTATION_HANDOFF.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Pronto para uso após aprovação HW-0 |
| Natureza | Handoff documental para o preflight de implementação |
| Primeira fase | HW-1 — Preflight e Baseline Executável |
| Alterações permitidas na primeira execução | Nenhuma; read-only |

---

## 1. Objetivo

Este handoff prepara a primeira sessão de Claude Code ou agente de desenvolvimento depois da aprovação da Foundation.

A primeira sessão não implementará features.

Ela executará somente:

- preflight Git;
- auditoria de código;
- baseline de testes/build;
- inventário de autorização;
- inventário de dados e deploys;
- confirmação da branch de Nutrição;
- relatório final em tela.

---

## 2. Instrução obrigatória sobre relatórios

> NÃO criar, atualizar ou sobrescrever arquivo Markdown de relatório durante a auditoria.

O relatório final deve ser exibido diretamente na resposta/tela para revisão humana.

Somente criar MD se o usuário pedir explicitamente depois.

---

## 3. Contexto obrigatório

O agente deve ler antes de qualquer ação:

1. `docs/health/web/audits/HEALTH_WEB_CURRENT_STATE_AUDIT.md`;
2. `docs/health/web/foundation/HEALTH_WEB_BASELINE.md`;
3. `docs/health/web/architecture/HEALTH_WEB_TARGET_ARCHITECTURE.md`;
4. `docs/health/web/architecture/HEALTH_WEB_INFORMATION_ARCHITECTURE.md`;
5. `docs/health/web/architecture/HEALTH_WEB_DATA_SOURCE_MATRIX.md`;
6. `docs/health/web/architecture/HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`;
7. `docs/health/web/foundation/HEALTH_WEB_CAPABILITIES_INVENTORY.md`;
8. `docs/health/web/foundation/HEALTH_WEB_PERMISSION_MATRIX.md`;
9. `docs/health/web/foundation/HEALTH_WEB_READINESS_POLICY.md`;
10. `docs/health/web/implementation/HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`;
11. `docs/health/web/implementation/HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`;
12. `docs/health/web/implementation/HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md`;
13. ADRs Web.

Também deve respeitar os documentos canônicos Mobile/Backend em `docs/health/`.

---

## 4. Escopo da primeira execução

```text
READ-ONLY
NO CODE CHANGES
NO DOC CHANGES
NO FIREBASE WRITES
NO DEPLOY
NO BRANCH CREATION UNLESS EXPLICITLY APPROVED AFTER REPORT
```

---

## 5. Preflight Git

Executar e reportar:

```text
git branch --show-current
git rev-parse HEAD
git status --short
git branch -vv
git fetch origin --prune
git rev-parse origin/master
git rev-list --left-right --count HEAD...origin/master
git diff --stat
git diff --cached --stat
git diff --check
git log -n 20 --oneline --decorate
```

Também:

- localizar branch `feature/health-web-nutrition`;
- HEAD;
- ahead/behind;
- merge-base;
- commits exclusivos;
- changed files;
- conflicts potenciais.

---

## 6. Baseline técnica

Sem corrigir falhas, executar o que existir no projeto:

- package manager detection;
- install locked;
- lint;
- typecheck;
- unit tests;
- integration tests;
- build;
- route smoke;
- Firebase Emulator config inspection;
- environment variable names inspection, sem valores.

### 6.1 Regra

Se um comando falhar:

- preservar output;
- identificar causa provável;
- não corrigir;
- continuar com passos independentes.

---

## 7. Auditoria de código Health atual

Mapear:

- routes;
- pages;
- components;
- hooks;
- services;
- models;
- forms;
- queries;
- writes;
- permissions;
- tests;
- Firestore paths;
- Storage paths;
- exports;
- links.

### 7.1 Findings prioritários

- score client-side;
- `_last_*` writes;
- root `health_logs`;
- `health_events`;
- documents;
- generic permissions;
- N listeners;
- direct writes;
- timeline aggregation.

---

## 8. Auditoria da Nutrição

Confirmar:

- branch;
- files;
- callables;
- capability;
- readers;
- operationId;
- receipts;
- tests;
- active plan handling;
- conflict handling;
- Mobile contract references.

Não integrar.

---

## 9. Inventário de autorização

Read-only e minimizado:

- access profile IDs;
- status;
- permissions.health;
- user count por profile;
- roles/claims shapes;
- access scopes;
- fallback behavior;
- admin aliases;
- Nutrition capability presence.

### 9.1 Privacidade

Não imprimir nomes, e-mails ou dados pessoais salvo necessidade explícita.

---

## 10. Inventário de dados

Por ambiente disponível:

- project ID;
- collection names;
- document counts aproximados/seguros;
- schema samples sanitizados;
- dog IDs técnicos;
- duplicates;
- Storage references;
- indexes;
- Rules;
- Functions;
- deployment versions.

### 10.1 Sem writes

Não criar fixtures, indexes ou export.

---

## 11. Inventário de uso

Verificar evidências de uso das telas antigas:

- analytics se disponíveis;
- links;
- navigation;
- recent logs sanitizados;
- reports;
- bookmarks não são verificáveis sem usuário;
- code references.

Confirmar ou corrigir a premissa de não uso operacional.

---

## 12. Relatório final na tela

Estrutura obrigatória:

### 12.1 Preflight

- repo;
- branch;
- HEAD;
- clean/dirty;
- origin divergence.

### 12.2 Baseline de qualidade

- install;
- lint;
- typecheck;
- tests;
- build.

### 12.3 Estado da Saúde Web atual

- routes;
- architecture;
- data sources;
- writes;
- permissions.

### 12.4 Estado da branch Nutrition

- SHA;
- divergence;
- contracts;
- tests;
- integration risks.

### 12.5 Produção/Firebase

- Rules;
- Functions;
- indexes;
- collections;
- profiles;
- limitations.

### 12.6 Findings

Classificar:

- P0;
- P1;
- P2;
- informational.

### 12.7 Decisão recomendada

- ready for branch creation;
- blocked;
- needs follow-up.

### 12.8 Nenhuma alteração

Confirmar arquivos não alterados.

---

## 13. Proibições

O agente não deve:

- criar MD de report;
- implementar shell;
- corrigir código;
- criar branch;
- commit;
- push;
- merge;
- deploy;
- alterar profiles;
- alterar Firestore;
- alterar Rules;
- gerar mockups;
- excluir dados.

---

## 14. Critérios de saída HW-1

- baseline reproduzível;
- production reality conhecida;
- branch strategy possível;
- profiles conhecidos;
- data sources conhecidas;
- blockers classificados;
- worktree inalterada;
- human review.

---

## 15. Prompt operacional sugerido

O conteúdo abaixo pode ser usado como base no Claude Code após aprovação humana:

```text
Você está iniciando a Fase HW-1 — Preflight e Baseline Executável do Health Web v1 do K9 Ops.

Leia primeiro todos os documentos em docs/health/web, priorizando baseline, arquitetura, data source matrix, permission matrix, readiness policy, roadmap, migration plan, nutrition integration plan e ADRs. Leia também os documentos canônicos do Health v1 em docs/health.

ESCOPO ESTRITAMENTE READ-ONLY.

NÃO altere nenhum arquivo.
NÃO crie branch.
NÃO faça commit, push, merge ou deploy.
NÃO escreva no Firebase, Firestore, Storage, Auth ou profiles.
NÃO gere ou atualize arquivo Markdown de relatório. O relatório final deve ser escrito diretamente na tela/resposta.

Execute:
1. preflight Git completo;
2. baseline install/lint/typecheck/tests/build;
3. inventário do código Health atual;
4. auditoria da branch feature/health-web-nutrition;
5. inventário read-only de permissions/profiles/claims, com dados pessoais minimizados;
6. inventário read-only de collections, Rules, Functions, indexes e Storage relacionados a Health;
7. mapeamento de dependências das telas antigas;
8. classificação de findings P0/P1/P2.

Não corrija achados nesta rodada. Se um comando falhar, registre a falha e continue com verificações independentes.

Ao final, apresente diretamente na tela:
- Preflight;
- Baseline de qualidade;
- Estado atual do Health Web;
- Estado da branch de Nutrição;
- Estado Firebase/produção;
- Perfis e capabilities;
- Dados legados;
- Findings;
- Recomendação de go/no-go para criar a branch de implementação;
- Confirmação de que nenhum arquivo ou ambiente foi alterado.
```

---

## 16. Próximo prompt

Somente depois do relatório e aprovação humana será criado o prompt de:

```text
HW-1B — criação da baseline executável/branch
```

---

## 17. Status

| Item | Estado |
|---|---|
| Foundation docs | produzidas |
| Handoff | produzido |
| HW-0 approval | pendente |
| HW-1 execution | não iniciada |
| Code changes | nenhuma |
| Firebase changes | nenhuma |

---

## 18. Conclusão

O handoff impede que o desenvolvimento comece com implementação prematura.

A primeira entrega técnica será conhecimento verificável, não código.
