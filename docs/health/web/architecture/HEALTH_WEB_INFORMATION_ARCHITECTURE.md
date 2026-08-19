# K9 Ops Web — Health Web v1 Information Architecture

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Arquitetura da informação, navegação e contratos de página |
| Repositório | `github.com/jillohh-arch/k9-ops` |
| Baseline | `HEALTH_WEB_BASELINE.md` |
| Arquitetura-alvo | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Auditoria de origem | `HEALTH_WEB_CURRENT_STATE_AUDIT.md` |
| Autoridade de domínio | Health v1.0 Mobile/Backend aprovado |
| Fora de escopo | Implementação, mockup visual final, merge, deploy e migração real |

---

## 1. Propósito

Este documento define a arquitetura da informação do **Health Web v1** do K9 Ops.

Ele transforma a arquitetura-alvo em uma estrutura navegável e verificável, estabelecendo:

- quais páginas existirão;
- como serão organizadas;
- como o usuário chegará a cada página;
- quais informações cada página deverá apresentar;
- quais ações poderão existir em cada contexto;
- como funcionarão o cockpit global e o cockpit individual do K9;
- como filtros e parâmetros deverão aparecer na URL;
- como permissões afetarão navegação e ações;
- como estados de domínio serão separados de estados técnicos;
- como fontes canônicas, projeções e dados legados serão comunicados;
- como o módulo deverá responder em desktop e tablet;
- quais fluxos serão transformados em mockups;
- quais decisões ainda dependerão de aprovação humana.

A pergunta central deste documento é:

> Como o usuário compreende, navega e opera o Health Web v1 sem depender de conhecimento técnico sobre Firestore, projections ou contratos internos?

---

## 2. Relação com os documentos anteriores

### 2.1 Auditoria do estado atual

`HEALTH_WEB_CURRENT_STATE_AUDIT.md` registra:

- o que existe hoje em `master`;
- o que existe apenas na branch de Nutrição;
- o que é pré-Foundation;
- o que é canônico;
- os riscos e findings do estado atual.

### 2.2 Baseline

`HEALTH_WEB_BASELINE.md` define:

- a verdade oficial de partida;
- o Plano Alimentar como única capacidade Web pós-Foundation;
- o restante da Saúde Web como legado experimental sem adoção operacional;
- a necessidade de preservar dados sem preservar a experiência antiga;
- os gates antes da implementação.

### 2.3 Arquitetura-alvo

`HEALTH_WEB_TARGET_ARCHITECTURE.md` define:

- fronteiras entre Web, Mobile e Backend;
- subdomínios;
- projeções;
- mutações;
- capabilities;
- segurança;
- coexistência;
- arquitetura interna.

### 2.4 Papel deste documento

Este documento não redefine o domínio.

Ele define como o domínio aprovado será exposto ao usuário na Web.

### 2.5 Regra de precedência

Em caso de conflito:

1. decisão humana aprovada;
2. ADR canônica do Health v1;
3. contrato de domínio e schema aprovados;
4. `HEALTH_WEB_TARGET_ARCHITECTURE.md`;
5. este documento;
6. mockup aprovado;
7. implementação.

Nenhum mockup poderá alterar silenciosamente uma regra de domínio.

---

## 3. Declaração central de arquitetura da informação

O Health Web v1 será organizado como:

> **um Centro de Gestão e Prontidão K9 com visão global do efetivo e drill-down longitudinal por cão.**

A experiência não será estruturada como:

- formulário genérico de saúde;
- lista única de eventos;
- prontuário isolado dentro do perfil do K9;
- dashboard baseado em score;
- cópia ampliada da interface Mobile;
- conjunto de cards sem hierarquia;
- agrupamento por collection Firestore;
- espelho do código legado.

A arquitetura da informação seguirá o fluxo:

```text
Visão global
   ↓
Identificação de prioridade
   ↓
Filtragem e comparação
   ↓
Cockpit individual do K9
   ↓
Entidade ou fluxo específico
   ↓
Ação autorizada e auditável
```

---

## 4. Objetivos de experiência

A arquitetura deverá permitir que o usuário responda rapidamente:

1. Quais K9s estão operacionais?
2. Quais exigem atenção?
3. Quais possuem restrições?
4. Quais estão temporariamente inaptos?
5. Quais ainda não foram avaliados?
6. O que vence hoje ou está atrasado?
7. Quais casos clínicos estão abertos?
8. Quais tratamentos estão ativos?
9. Quais planos alimentares estão ativos?
10. Quais registros recentes alteraram a situação do efetivo?
11. Por que determinado K9 está naquele estado?
12. Quem registrou, alterou ou encerrou determinada informação?
13. A informação exibida é atual, parcial, legada ou conflitante?
14. Qual é a próxima ação operacional ou gerencial necessária?

---

## 5. Princípios obrigatórios de arquitetura da informação

### 5.1 Saúde é um módulo único

A Sidebar principal deverá possuir apenas um item:

```text
Saúde
```

Não deverão existir itens principais separados para:

- Vacinas;
- Peso;
- Nutrição;
- Agenda;
- Prontidão;
- Casos clínicos.

Essas áreas pertencem à navegação interna do módulo.

### 5.2 Rotas representam responsabilidades

Cada rota deve possuir uma responsabilidade principal clara.

Uma página não deverá tentar resolver simultaneamente:

- visão executiva;
- prontuário longitudinal;
- formulários;
- relatórios;
- auditoria;
- gestão operacional detalhada.

### 5.3 Global antes do individual

A entrada padrão em `/health` será global.

O usuário deverá conseguir localizar um K9 e abrir seu cockpit individual.

### 5.4 Contexto individual persistente

Ao entrar no cockpit de um K9, a interface deverá preservar claramente:

- nome;
- foto;
- identificação;
- status de prontidão;
- restrições ativas;
- atualização da projeção;
- área atual;
- forma de retornar à visão global.

### 5.5 Estado de domínio não é estado técnico

Exemplo:

```text
Não Avaliado
```

é estado de prontidão.

Exemplo:

```text
Falha ao carregar a prontidão
```

é estado técnico.

A interface nunca poderá converter o segundo no primeiro.

### 5.6 Projeção não será escondida como fato absoluto

Quando a página usar uma projeção, poderá indicar:

- horário da última atualização;
- estado stale;
- origem resumida;
- link para evidências.

### 5.7 Restrição prevalece visualmente

Restrições ativas deverão possuir destaque superior a indicadores preventivos comuns.

### 5.8 Planejamento não é execução

Agenda, prescrição, protocolo e plano alimentar não serão apresentados como fatos executados.

### 5.9 Ação depende de capability

A ausência de capability deverá:

- ocultar ou desabilitar a ação;
- preservar a leitura autorizada;
- nunca transformar falha de autorização em erro genérico;
- apresentar explicação adequada quando necessário.

### 5.10 Legado será identificado

Dado legado não poderá parecer canônico.

### 5.11 Conflito será explícito

Quando fontes divergirem, a interface não escolherá silenciosamente uma delas.

### 5.12 Navegação deverá ser previsível

A mesma entidade deverá abrir sempre no mesmo padrão de rota.

### 5.13 A URL deverá ser compartilhável

Filtros relevantes, cão selecionado, aba e período deverão ser refletidos na URL quando isso melhorar:

- retorno;
- auditoria;
- compartilhamento;
- suporte;
- investigação.

---

## 6. Modelo mental do módulo

O módulo será compreendido em três níveis.

### 6.1 Nível 1 — Efetivo

Pergunta principal:

> Como está o conjunto de K9s?

Rotas principais:

- `/health`;
- `/health/readiness`;
- `/health/schedule`;
- `/health/clinical`;
- `/health/nutrition`;
- `/health/history`;
- `/health/reports`;
- `/health/audit`.

### 6.2 Nível 2 — K9

Pergunta principal:

> Como está este K9 e quais fatos explicam sua condição?

Rota principal:

```text
/health/readiness/{dogId}
```

O cockpit individual poderá conter navegação contextual para:

- resumo;
- restrições;
- agenda;
- casos clínicos;
- tratamentos;
- nutrição;
- peso;
- vacinação;
- documentos;
- timeline.

### 6.3 Nível 3 — Entidade

Pergunta principal:

> Qual é o detalhe, lifecycle e histórico desta entidade?

Exemplos:

- caso clínico;
- restrição;
- item de agenda;
- tratamento;
- processo de exame;
- plano alimentar;
- documento;
- evento da timeline;
- registro de auditoria.

---

## 7. Navegação principal

### 7.1 Sidebar

A Sidebar deverá manter:

```text
Saúde
```

com destino:

```text
/health
```

### 7.2 Estado ativo

Todas as rotas iniciadas por `/health` deverão manter o item Saúde ativo.

### 7.3 Badge global

A Sidebar poderá futuramente apresentar badge agregado apenas se:

- a origem for canônica;
- a métrica for operacionalmente útil;
- houver regra aprovada;
- o badge não induzir interpretação clínica.

Exemplos potencialmente aceitáveis:

- quantidade de itens atrasados;
- quantidade de K9s temporariamente inaptos.

Exemplo proibido:

- score geral de saúde.

### 7.4 Regra de estabilidade

A Sidebar não deverá crescer conforme novos subdomínios forem adicionados.

---

## 8. Navegação secundária do módulo

### 8.1 Estrutura proposta

A navegação secundária principal será:

```text
Visão Geral
Prontidão
Agenda
Clínico
Nutrição
Histórico
Relatórios
```

`Auditoria` ficará disponível:

- como item secundário condicionado à capability;
- ou dentro de Relatórios;
- decisão final pendente de aprovação humana.

### 8.2 Ordem

A ordem reflete o fluxo:

```text
situação → prioridade → planejamento → investigação → gestão → histórico → análise
```

### 8.3 Persistência

Em desktop, a navegação secundária deverá permanecer visível no topo do módulo.

Em tablet, poderá:

- permitir rolagem horizontal;
- colapsar itens menos frequentes;
- usar menu “Mais”;
- preservar indicação clara da área ativa.

### 8.4 Não usar dropdown como única navegação

As áreas primárias não deverão depender exclusivamente de um seletor escondido.

### 8.5 Estado ativo

Deverá ser indicado por mais de um sinal visual:

- contraste;
- texto;
- borda ou underline;
- sem depender apenas de cor.

---

## 9. Mapa oficial de rotas

### 9.1 Rotas de primeiro nível

| Rota | Nome | Responsabilidade |
|---|---|---|
| `/health` | Visão Geral | panorama do efetivo e prioridades |
| `/health/readiness` | Prontidão | lista comparativa de prontidão e restrições |
| `/health/schedule` | Agenda | planejamento preventivo e operacional |
| `/health/clinical` | Clínico | casos clínicos e acompanhamento |
| `/health/nutrition` | Nutrição | gestão de planos alimentares |
| `/health/history` | Histórico | timeline global normalizada |
| `/health/reports` | Relatórios | análises e exportações autorizadas |
| `/health/audit` | Auditoria | trilha de ações do domínio Health |

### 9.2 Rotas individuais

| Rota | Responsabilidade |
|---|---|
| `/health/readiness/{dogId}` | cockpit individual de saúde e prontidão |
| `/health/dogs/{dogId}/schedule` | agenda do K9 |
| `/health/dogs/{dogId}/clinical` | casos clínicos do K9 |
| `/health/dogs/{dogId}/nutrition` | contexto nutricional do K9 |
| `/health/dogs/{dogId}/history` | timeline do K9 |
| `/health/dogs/{dogId}/documents` | documentos do K9 |

### 9.3 Rotas de entidade

| Rota | Responsabilidade |
|---|---|
| `/health/clinical/{caseId}` | detalhe longitudinal do caso clínico |
| `/health/restrictions/{restrictionId}` | detalhe da restrição |
| `/health/schedule/{scheduleItemId}` | detalhe do item de agenda |
| `/health/treatments/{protocolId}` | detalhe do protocolo |
| `/health/exams/{examProcessId}` | detalhe do processo de exame |
| `/health/nutrition/plans/{planId}` | detalhe do plano alimentar |
| `/health/documents/{documentId}` | detalhe e metadados do documento |
| `/health/audit/{auditEntryId}` | detalhe do evento de auditoria |

### 9.4 Rotas provisórias

As rotas individuais além de `/health/readiness/{dogId}` são propostas lógicas.

A forma final poderá ser:

- rotas próprias;
- query parameter;
- subrota;
- aba interna com URL.

A decisão deverá priorizar:

- deep link;
- previsibilidade;
- histórico do navegador;
- permissionamento;
- carregamento independente.

### 9.5 Regra contra duplicação

Não deverão coexistir duas árvores completas e equivalentes:

```text
/k9/{dogId}/health/...
```

e

```text
/health/dogs/{dogId}/...
```

O perfil institucional `/k9/{dogId}` deverá apontar para a autoridade funcional do módulo Health.

---

## 10. Integração com o perfil institucional do K9

### 10.1 Responsabilidade de `/k9/{dogId}`

O perfil institucional do K9 poderá apresentar resumo:

- prontidão atual;
- restrições ativas;
- último peso;
- próximo item preventivo;
- plano alimentar ativo;
- casos abertos;
- atalho “Abrir Saúde”.

### 10.2 Limite

O perfil institucional não deverá manter um prontuário completo paralelo.

### 10.3 Destino

O atalho deverá abrir:

```text
/health/readiness/{dogId}
```

### 10.4 Benefício

Essa decisão:

- elimina duplicação de readers;
- evita divergência de navegação;
- concentra regras de Health;
- melhora manutenção;
- preserva contexto institucional.

### 10.5 Migração da página atual

A aba antiga de “Prontuário clínico” em `/k9/{dogId}` poderá:

- ser substituída por resumo;
- apresentar aviso de transição;
- redirecionar para o cockpit;
- permanecer temporariamente somente para leitura legada, se necessário.

A decisão dependerá da auditoria de dados e do plano de migração.

---

## 11. Shell interno do Health Web

### 11.1 Estrutura geral

Cada página principal deverá utilizar:

```text
App Shell
  └── Health Module Shell
        ├── Cabeçalho do módulo
        ├── Navegação secundária
        ├── Contexto e ações da página
        ├── Estado técnico global
        └── Conteúdo da rota
```

### 11.2 Cabeçalho do módulo

Elementos possíveis:

- título “Saúde e Prontidão”;
- descrição curta;
- última atualização relevante;
- busca global por K9;
- ação primária contextual;
- indicador de degradação.

### 11.3 Cabeçalho da página

Cada rota deverá possuir:

- título específico;
- descrição operacional;
- filtros relevantes;
- ação primária autorizada;
- referência temporal;
- breadcrumbs quando aplicável.

### 11.4 Evitar cabeçalhos excessivos

Não deverão coexistir:

- título da Sidebar;
- título do módulo;
- título da página;
- título do card;
- subtítulo repetindo a mesma frase.

### 11.5 Hierarquia

Recomendação:

```text
Módulo: Saúde e Prontidão
Página: Agenda
Contexto: Efetivo inteiro ou K9 selecionado
```

---

## 12. Visão Geral — `/health`

### 12.1 Propósito

Apresentar o panorama executivo e operacional do efetivo.

### 12.2 Perguntas respondidas

- Quantos K9s estão em cada estado?
- Quais exigem atenção imediata?
- O que está atrasado?
- Quais casos clínicos estão abertos?
- Quais tratamentos estão ativos?
- Quais planos alimentares estão ausentes ou em conflito?
- Quais mudanças recentes impactam a prontidão?

### 12.3 Conteúdo obrigatório

#### Zona A — Resumo de prontidão

Mostrar contagem por estado oficial:

- Operacional;
- Operacional com Atenção;
- Apto com Restrições;
- Temporariamente Inapto;
- Não Avaliado.

Não mostrar score percentual de saúde.

#### Zona B — Prioridades

Lista ordenada de itens que demandam ação:

- restrições críticas;
- K9 temporariamente inapto;
- agenda atrasada;
- caso clínico com acompanhamento pendente;
- tratamento ativo sem evidência esperada;
- projeção stale;
- conflito de dados;
- ausência de avaliação relevante.

#### Zona C — Agenda próxima

Mostrar:

- hoje;
- próximos dias;
- atrasados;
- categorias;
- K9;
- ação de abrir detalhe.

#### Zona D — Casos e tratamentos

Resumo:

- casos abertos;
- casos em acompanhamento;
- tratamentos ativos;
- reavaliações próximas.

#### Zona E — Nutrição

Resumo:

- plano ativo;
- sem plano;
- conflito de múltiplos ativos;
- dado legado;
- necessidade de revisão.

A execução diária de refeição não será transformada em ação Web padrão.

#### Zona F — Atividade recente

Itens recentes da projeção de timeline:

- categoria;
- K9;
- data efetiva;
- data de registro;
- origem;
- impacto;
- link para entidade.

### 12.4 Ações

Ações possíveis:

- abrir lista de prontidão;
- abrir agenda;
- abrir casos clínicos;
- abrir gestão de Nutrição;
- abrir histórico;
- atualizar leitura;
- registrar ação gerencial autorizada.

### 12.5 Ação primária

A ação primária não deverá ser genericamente:

```text
Registrar evento
```

Ela deverá ser contextual ou inexistente.

Exemplos:

- “Criar item de agenda”;
- “Abrir caso clínico”;
- “Criar plano alimentar”;
- “Registrar decisão externa”.

### 12.6 Estado vazio

Se não houver K9s cadastrados:

- explicar que a visão depende do efetivo;
- oferecer acesso ao módulo responsável pelo cadastro, se autorizado;
- não exibir métricas zeradas como se o sistema estivesse configurado.

### 12.7 Estado parcial

Se parte das projeções falhar:

- manter áreas carregadas;
- identificar áreas indisponíveis;
- não recalcular no cliente;
- oferecer tentativa de atualização.

### 12.8 Drill-down

Cada número ou item deverá abrir a visão filtrada correspondente.

Exemplo:

```text
3 Temporariamente Inaptos
   → /health/readiness?status=temporarily_unfit
```

---

## 13. Prontidão — `/health/readiness`

### 13.1 Propósito

Permitir comparação segura do estado operacional de todos os K9s.

### 13.2 Visualização principal

Tabela ou lista densa com:

- K9;
- foto;
- identificação;
- prontidão;
- motivos principais;
- restrições ativas;
- casos abertos;
- agenda crítica;
- última avaliação;
- atualização da projeção;
- ação de abrir cockpit.

### 13.3 Estados oficiais

Somente:

| Enum | Label |
|---|---|
| `operational` | Operacional |
| `operational_attention` | Operacional com Atenção |
| `fit_with_restrictions` | Apto com Restrições |
| `temporarily_unfit` | Temporariamente Inapto |
| `not_evaluated` | Não Avaliado |

### 13.4 Filtros

Filtros mínimos:

- busca por nome ou identificação;
- status de prontidão;
- tipo de restrição;
- existência de caso aberto;
- existência de item atrasado;
- plano alimentar;
- atualização da projeção;
- dados legados;
- conflito.

### 13.5 Ordenação

Opções:

- prioridade operacional;
- nome;
- prontidão;
- última avaliação;
- próxima pendência;
- atualização mais antiga.

Ordenação padrão recomendada:

```text
temporarily_unfit
fit_with_restrictions
operational_attention
not_evaluated
operational
```

Dentro do mesmo grupo:

- criticidade;
- atraso;
- data;
- nome.

### 13.6 Razões de prontidão

A lista deverá mostrar uma síntese curta.

Exemplos:

- Restrição absoluta ativa;
- Retorno veterinário pendente;
- Vacina próxima;
- Dados relevantes incompletos;
- Sem avaliação registrada.

A interface não deverá inventar diagnóstico.

### 13.7 Coluna técnica

Informações como `projection_version` não precisam ser exibidas na tabela comum.

Poderão aparecer em:

- tooltip;
- painel de diagnóstico;
- auditoria;
- estado de conflito;
- suporte.

### 13.8 Ações em massa

Ações em massa não serão permitidas por padrão para:

- alterar prontidão;
- encerrar restrições;
- concluir agenda;
- finalizar casos.

Exportação ou seleção para relatório poderão existir mediante capability.

### 13.9 Métrica de cobertura

Caso a equipe deseje preservar um indicador sobre completude, ele deverá ser rotulado como:

```text
Cobertura de evidências de saúde
```

Nunca como prontidão ou índice de saúde.

---

## 14. Cockpit individual — `/health/readiness/{dogId}`

### 14.1 Propósito

Reunir a situação atual do K9 e as evidências que explicam sua prontidão.

### 14.2 Cabeçalho do K9

Deverá conter:

- foto;
- nome;
- identificação;
- raça, quando relevante;
- idade;
- status institucional;
- prontidão oficial;
- última avaliação;
- atualização da projeção;
- restrições ativas;
- botão de retorno.

### 14.3 Navegação contextual

Estrutura sugerida:

```text
Resumo
Restrições
Agenda
Clínico
Tratamentos
Nutrição
Peso
Vacinação
Documentos
Histórico
```

Nem todas precisam ser tabs visíveis simultaneamente.

Possíveis agrupamentos:

```text
Resumo
Prontidão
Cuidados
Nutrição
Histórico
```

A escolha visual será validada por mockup.

### 14.4 Resumo

Deverá mostrar:

- estado de prontidão;
- razões;
- restrições;
- casos abertos;
- tratamentos ativos;
- próximos itens;
- atrasados;
- último peso;
- tendência;
- plano alimentar;
- vacinação;
- documentos relevantes;
- eventos recentes.

### 14.5 Evidências de prontidão

Cada razão deverá oferecer:

- categoria;
- descrição;
- vigência;
- origem;
- entidade relacionada;
- link de detalhe.

### 14.6 Restrições

Mostrar:

- tipo;
- escopo;
- início;
- término previsto;
- profissional relacionado;
- motivo;
- status;
- entidade de origem;
- histórico de alterações.

### 14.7 Relação com ações operacionais

A interface Web poderá informar que uma restrição impacta:

- treinamento;
- atividade operacional;
- embarque;
- esforço;
- alimentação;
- medicação;
- outro escopo aprovado.

A Web não substituirá a validação backend em ação crítica.

### 14.8 Estado `not_evaluated`

Deverá explicar:

- ausência de avaliação;
- ausência de projeção;
- diferença entre “não avaliado” e “falha de carregamento”;
- ação administrativa disponível, se houver.

### 14.9 Falha de summary

Se `health_summary/current` falhar:

- exibir indisponibilidade;
- manter dados canônicos individuais que carregaram;
- não calcular prontidão localmente;
- não exibir “Não Avaliado” como fallback.

---

## 15. Agenda — `/health/schedule`

### 15.1 Propósito

Gerenciar planejamento preventivo e acompanhar execução sem confundir previsto com realizado.

### 15.2 Visualizações

A v1 deverá priorizar:

- lista operacional;
- agrupamento por data;
- filtros;
- visão de atrasados;
- visão de próximos.

Calendário mensal poderá existir como visualização secundária.

### 15.3 Categorias

Podem incluir:

- consulta;
- exame;
- vacina;
- pesagem;
- reavaliação;
- dose;
- refeição;
- suplemento;
- outro item aprovado.

### 15.4 Status visual

A UI deverá reconciliar enums canônicos com labels como:

- Programado;
- Próximo;
- Hoje;
- Pendente;
- Atrasado;
- Concluído;
- Cancelado.

O contrato final deverá vir do schema aprovado.

### 15.5 Colunas

- data e hora;
- K9;
- tipo;
- título;
- responsável;
- origem;
- status;
- vínculo;
- ação.

### 15.6 Filtros

- período;
- status;
- categoria;
- K9;
- responsável;
- atrasado;
- concluído;
- origem.

### 15.7 Ações Web

Possíveis:

- criar;
- reagendar;
- cancelar;
- editar campos administrativos;
- abrir detalhe;
- registrar resultado externo autorizado.

A conclusão de execução deverá respeitar a fronteira Web × Mobile.

### 15.8 Planejado versus executado

Cada item concluído deverá apontar, quando aplicável, para o fato canônico produzido.

### 15.9 Atraso

Um item atrasado deverá ser apresentado como atraso de agenda.

Não deverá automaticamente:

- alterar prontidão no cliente;
- criar diagnóstico;
- criar restrição;
- inferir não conformidade clínica.

### 15.10 Item de agenda

A página de detalhe deverá mostrar:

- lifecycle;
- histórico;
- horários;
- origem;
- executor esperado;
- execução vinculada;
- cancelamento;
- auditoria.

---

## 16. Clínico — `/health/clinical`

### 16.1 Propósito

Gerenciar casos clínicos como agregados longitudinais.

### 16.2 Não será

- lista solta de “consultas”;
- tabela única de medicamentos;
- feed de eventos sem contexto;
- prontuário editável como texto corrido.

### 16.3 Lista de casos

Campos:

- K9;
- título ou motivo;
- status;
- abertura;
- última atividade;
- profissional;
- restrições relacionadas;
- tratamentos;
- próxima ação;
- severidade operacional, se contratualmente definida.

### 16.4 Filtros

- status;
- K9;
- período;
- profissional;
- com restrição;
- com tratamento;
- sem acompanhamento;
- origem.

### 16.5 Ação primária

```text
Abrir caso clínico
```

somente para perfis autorizados e dentro das regras aprovadas.

### 16.6 Relação com consulta

Uma consulta poderá:

- iniciar caso;
- pertencer a caso existente;
- registrar avaliação;
- gerar documento;
- recomendar restrição;
- originar tratamento.

Ela não substitui o caso.

### 16.7 Caso encerrado

Deverá permanecer consultável.

Reabertura deverá ser:

- explícita;
- autorizada;
- auditada;
- compatível com contrato.

---

## 17. Detalhe do caso clínico — `/health/clinical/{caseId}`

### 17.1 Propósito

Exibir a história longitudinal de uma questão clínica.

### 17.2 Cabeçalho

- K9;
- status;
- data de abertura;
- motivo;
- profissional;
- última atividade;
- restrições relacionadas;
- tratamentos;
- próxima ação.

### 17.3 Timeline do caso

Pode reunir:

- abertura;
- consulta;
- avaliação;
- exame solicitado;
- resultado;
- documento;
- tratamento iniciado;
- dose registrada;
- restrição criada;
- reavaliação;
- amendment;
- encerramento;
- reabertura.

### 17.4 Imutabilidade

Eventos finalizados não deverão oferecer edição direta.

Correções deverão ocorrer por:

- amendment;
- retificação;
- novo evento relacionado;
- ação contratualmente aprovada.

### 17.5 Ações possíveis

- adicionar acompanhamento;
- registrar documento;
- iniciar tratamento;
- criar item de agenda;
- registrar decisão externa;
- criar restrição;
- encerrar;
- reabrir.

Cada ação dependerá de capability e estado do caso.

### 17.6 Painel lateral

Poderá apresentar:

- dados do K9;
- restrições;
- plano terapêutico;
- documentos;
- responsáveis;
- links relacionados.

### 17.7 Documentos

Documentos deverão ser entidades relacionadas, não anexos sem identidade.

---

## 18. Exames

### 18.1 Posicionamento

Exames poderão ser acessados:

- dentro de um caso;
- pelo cockpit individual;
- por filtro em Clínico;
- por rota própria futura.

### 18.2 Processo de exame

A UI deverá distinguir:

- solicitado;
- agendado;
- coletado;
- em processamento;
- resultado disponível;
- revisado;
- cancelado.

### 18.3 Resultado não é interpretação automática

A interface poderá exibir:

- documento;
- metadados;
- valores estruturados aprovados;
- observações registradas.

Ela não deverá produzir interpretação clínica automática não contratada.

### 18.4 Pendência

Atraso de resultado deverá aparecer como pendência do processo.

---

## 19. Tratamentos

### 19.1 Posicionamento

Tratamentos poderão ser acessados:

- dentro de um caso;
- no cockpit individual;
- por filtro clínico;
- em visão agregada futura.

### 19.2 Protocolo

O detalhe deverá mostrar:

- medicamento ou intervenção;
- objetivo registrado;
- período;
- frequência;
- dose;
- via;
- instruções;
- profissional;
- status;
- administradores permitidos;
- próximas administrações;
- administrações realizadas;
- omissões;
- interrupções;
- amendments.

### 19.3 Gestão versus execução

A Web poderá administrar o protocolo quando autorizada.

O Mobile deverá registrar execução de campo conforme contrato.

### 19.4 Substituição do formulário genérico

A área antiga “Medicação” não será preservada como write genérico se `TreatmentProtocol` for aprovado como autoridade.

---

## 20. Nutrição — `/health/nutrition`

### 20.1 Status especial

Nutrição é a única capacidade Web pós-Foundation existente.

### 20.2 Princípio preservado

```text
Web define e administra.
Mobile executa e registra fatos.
Backend valida, persiste e audita.
```

### 20.3 Escopo da página

- selecionar K9;
- consultar plano ativo;
- consultar legado identificado;
- criar e ativar plano;
- atualizar campos administrativos;
- substituir plano estruturalmente;
- cancelar;
- visualizar conflitos;
- visualizar histórico futuro quando implementado.

### 20.4 Estados de leitura já previstos

- loading;
- canonical;
- legacy;
- empty;
- degraded;
- error;
- conflict.

### 20.5 Navegação proposta

A página global poderá mostrar tabela de K9s:

- plano ativo;
- versão;
- vigência;
- origem;
- atualização;
- estado;
- ação.

Ao selecionar um K9:

```text
/health/dogs/{dogId}/nutrition
```

ou:

```text
/health/nutrition?dogId={dogId}
```

A escolha deverá ser feita durante o mockup e contrato de URL.

### 20.6 Ações

- Criar e ativar;
- Editar;
- Substituir;
- Cancelar;
- Abrir detalhe;
- Consultar histórico.

### 20.7 Ausências deliberadas

A Web não deverá oferecer como ação padrão:

- registrar refeição executada;
- registrar suplemento administrado;
- marcar execução diária;
- inventar consumo.

### 20.8 Integração da branch

A experiência existente deverá ser:

- preservada semanticamente;
- reconciliada com o novo Health Module Shell;
- atualizada visualmente;
- testada contra contratos atuais;
- integrada sem merge cego.

### 20.9 Conflito de múltiplos ativos

A página deverá falhar fechada:

- impedir decisão automática;
- exibir conflito;
- bloquear mutações incompatíveis;
- orientar investigação.

---

## 21. Peso e tendências

### 21.1 Posicionamento

Peso deverá aparecer:

- no cockpit individual;
- em Histórico;
- em relatórios;
- em fluxo de registro autorizado.

### 21.2 Visualização

- último peso;
- data efetiva;
- tendência;
- série temporal;
- origem;
- responsável;
- observações;
- contexto clínico ou nutricional relacionado.

### 21.3 Gráfico

O gráfico deverá:

- preservar escala compreensível;
- mostrar datas reais;
- permitir período;
- identificar gaps;
- não interpretar mudança como diagnóstico;
- possuir alternativa tabular acessível.

### 21.4 Registro Web

A possibilidade de registrar peso pela Web continua pendente de decisão humana.

Caso seja permitida, deverá distinguir:

- medição presencial;
- transcrição de medição externa;
- importação;
- correção por amendment.

### 21.5 Campos `_last_*`

A UI nova não deverá depender dos campos `_last_weight_*` escritos best-effort pelo cliente.

---

## 22. Vacinação

### 22.1 Posicionamento

Vacinação deverá aparecer:

- no cockpit individual;
- na Agenda;
- no Histórico;
- em relatórios preventivos.

### 22.2 Visualização

- vacina;
- aplicação;
- validade ou próxima dose;
- lote;
- fabricante;
- profissional;
- estabelecimento;
- documento;
- status preventivo;
- origem.

### 22.3 Não derivar prontidão localmente

Vacina vencida ou próxima poderá ser evidência.

A página não deverá calcular a prontidão final.

### 22.4 Registro Web

A decisão entre:

- execução Web;
- transcrição Web;
- execução exclusivamente Mobile;

continua pendente.

### 22.5 Histórico

Aplicações antigas deverão ser preservadas e identificadas conforme origem.

---

## 23. Documentos

### 23.1 Objetivo

Centralizar documentos Health com identidade, contexto e auditoria.

### 23.2 Tipos possíveis

- laudo;
- receita;
- atestado;
- resultado de exame;
- carteira de vacinação;
- termo;
- relatório;
- imagem;
- outro tipo aprovado.

### 23.3 Metadados mínimos

- K9;
- tipo;
- título;
- data efetiva;
- emissor;
- profissional;
- registro profissional;
- estabelecimento;
- entidade relacionada;
- arquivo;
- hash ou integridade quando disponível;
- origem;
- criado por;
- criado em.

### 23.4 Navegação

Documentos poderão ser encontrados:

- no cockpit;
- dentro de caso;
- dentro de exame;
- dentro de restrição;
- pelo Histórico.

### 23.5 Upload

Upload deverá possuir:

- validação de tipo;
- limite;
- progresso;
- estado de falha;
- confirmação da persistência;
- auditoria;
- remoção conforme política.

### 23.6 Dados sensíveis

A interface não deverá expor links permanentes ou metadados sensíveis indevidamente.

---

## 24. Histórico — `/health/history`

### 24.1 Propósito

Apresentar timeline global normalizada do domínio Health.

### 24.2 Fonte

A página deverá consumir projeção `health_timeline` ou contrato equivalente.

### 24.3 Não deverá

- ouvir N collections;
- concatenar tudo no navegador;
- ordenar todos os documentos localmente;
- supor o mesmo schema;
- mascarar conflitos.

### 24.4 Item da timeline

Deverá conter:

- categoria;
- K9;
- título;
- resumo;
- data efetiva;
- data de registro;
- ator;
- origem;
- entidade fonte;
- impacto;
- indicador canônico/legado;
- link.

### 24.5 Filtros

- período;
- K9;
- categoria;
- ator;
- origem;
- canônico/legado;
- entidade;
- impacto na prontidão;
- com documento;
- com amendment.

### 24.6 Paginação

Obrigatória.

Poderá utilizar:

- cursor;
- carregamento incremental;
- paginação tradicional.

A estratégia deve preservar:

- ordenação estável;
- deep link;
- custo controlado;
- acessibilidade.

### 24.7 Data efetiva e data de registro

Ambas deverão ser distinguíveis quando divergirem.

### 24.8 Legado

Itens legados deverão possuir label e explicação.

### 24.9 Conflito

Itens conflitantes poderão direcionar para painel de reconciliação futura.

---

## 25. Relatórios — `/health/reports`

### 25.1 Propósito

Oferecer análises gerenciais sem transformar relatórios em fonte de verdade.

### 25.2 Categorias iniciais

- prontidão do efetivo;
- restrições;
- agenda preventiva;
- vacinação;
- peso;
- casos clínicos;
- tratamentos;
- Nutrição;
- documentos;
- completude de dados;
- atividade e auditoria.

### 25.3 Relatório não decide

Um relatório poderá:

- resumir;
- comparar;
- exportar;
- apontar pendência.

Não poderá:

- alterar prontidão;
- encerrar restrição;
- concluir item;
- criar evento silenciosamente.

### 25.4 Filtros

- período;
- K9;
- status;
- categoria;
- origem;
- unidade;
- responsável.

### 25.5 Exportação

Deverá exigir capability específica quando houver:

- dados sensíveis;
- informações clínicas;
- dados pessoais;
- arquivos;
- grande volume.

### 25.6 Reprodutibilidade

Exportações deverão registrar:

- filtros;
- período;
- horário;
- solicitante;
- versão;
- origem;
- escopo.

### 25.7 Dados incompletos

Relatório deverá indicar:

- cobertura;
- parcialidade;
- atraso da projeção;
- fontes ausentes;
- legado incluído ou excluído.

---

## 26. Auditoria — `/health/audit`

### 26.1 Propósito

Permitir investigação de mutações e decisões do domínio Health.

### 26.2 Público

Somente perfis com capability apropriada.

### 26.3 Conteúdo

- ação;
- domínio;
- entidade;
- K9;
- ator;
- horário;
- operationId;
- resultado;
- origem;
- campos administrativos relevantes;
- correlação;
- motivo;
- estado anterior e posterior quando permitido.

### 26.4 Proteção

A auditoria não deverá exibir:

- segredo;
- token;
- URL temporária;
- dado sensível desnecessário;
- conteúdo clínico integral quando metadado basta.

### 26.5 Relação com Histórico

Histórico responde:

> O que aconteceu com a saúde do K9?

Auditoria responde:

> Quem realizou qual operação no sistema, quando e com qual resultado?

### 26.6 Decisão pendente

A Auditoria poderá ser:

- rota própria;
- subárea de Relatórios;
- integração com auditoria geral do K9 Ops.

A autoridade de domínio e os filtros Health deverão ser preservados em qualquer opção.

---

## 27. Busca global do módulo

### 27.1 Escopo inicial

A busca deverá localizar K9s por:

- nome;
- identificação;
- matrícula ou código institucional, quando aplicável.

### 27.2 Escopo futuro

Poderá localizar:

- caso clínico;
- documento;
- profissional;
- protocolo;
- item de agenda.

### 27.3 Regra

A busca não deverá enviar consulta ampla não indexada ao Firestore.

### 27.4 Resultado

Cada resultado deverá indicar:

- tipo;
- identificação;
- contexto;
- rota;
- permissão.

### 27.5 Dados sensíveis

Resultados não autorizados não deverão aparecer apenas para depois falhar ao abrir.

---

## 28. Filtros e estado da URL

### 28.1 Filtros compartilháveis

Filtros relevantes deverão aparecer como query params.

Exemplo:

```text
/health/readiness?status=temporarily_unfit&hasRestriction=true
```

### 28.2 Parâmetros conceituais

Possíveis:

- `dogId`;
- `status`;
- `category`;
- `from`;
- `to`;
- `source`;
- `q`;
- `sort`;
- `view`;
- `page`;
- `cursor`;
- `legacy`;
- `conflict`.

### 28.3 Regras

- valores inválidos devem ser ignorados ou corrigidos;
- a URL deve permanecer legível;
- filtros padrão não precisam ser serializados;
- mudança de filtro deve preservar contexto compatível;
- parâmetros sensíveis não devem entrar na URL.

### 28.4 Botão voltar

A navegação deverá respeitar histórico do navegador.

### 28.5 Reset

Cada conjunto de filtros deverá possuir ação clara de limpar.

### 28.6 Contagem

A interface deverá informar quantos filtros estão ativos.

---

## 29. Breadcrumbs

### 29.1 Uso

Breadcrumbs serão obrigatórios em entidades profundas.

Exemplo:

```text
Saúde
› Clínico
› Bono
› Caso clínico 2026-014
```

### 29.2 Não substituir título

Breadcrumb não substitui cabeçalho.

### 29.3 Itens clicáveis

Itens ancestrais deverão ser navegáveis conforme permissão.

### 29.4 Contexto individual

Em cockpit com tabs, o breadcrumb poderá ser:

```text
Saúde › Prontidão › Bono
```

---

## 30. Padrão de ações

### 30.1 Hierarquia

Cada página deverá possuir no máximo:

- uma ação primária destacada;
- poucas ações secundárias visíveis;
- demais ações em menu contextual.

### 30.2 Nomenclatura

Usar verbos específicos:

- Abrir caso clínico;
- Criar item de agenda;
- Criar plano alimentar;
- Substituir plano;
- Cancelar item;
- Registrar decisão externa;
- Exportar relatório.

Evitar:

- Novo;
- Adicionar;
- Registrar evento;
- Ação;
- Gerenciar.

### 30.3 Ação destrutiva

Deverá:

- ter label explícito;
- exigir confirmação;
- explicar consequência;
- solicitar motivo quando necessário;
- usar callable auditável;
- nunca depender apenas da cor.

### 30.4 Desabilitada versus oculta

Ocultar quando:

- o usuário não deve conhecer a capacidade;
- a ação não pertence ao contexto.

Desabilitar com explicação quando:

- o usuário possui a capability, mas o estado impede;
- há conflito;
- dados estão stale;
- pré-condição não foi atendida.

### 30.5 Repetição de envio

A interface deverá proteger contra duplo envio e usar `operationId`.

---

## 31. Formulários

### 31.1 Princípio

Cada formulário corresponderá a um comando de domínio.

### 31.2 Não usar formulário genérico

Não haverá formulário universal “Registrar saúde”.

### 31.3 Estrutura

- contexto;
- campos obrigatórios;
- campos condicionais;
- anexos;
- identidade profissional;
- data efetiva;
- motivo;
- resumo de consequência;
- confirmação.

### 31.4 Validação

Validação client-side melhora UX.

Autoridade continua no Backend.

### 31.5 Persistência parcial

Drafts não serão assumidos na v1 sem decisão explícita.

### 31.6 Fechamento acidental

Formulários longos deverão alertar sobre perda de dados locais.

### 31.7 Sucesso

A confirmação deverá indicar:

- operação concluída;
- entidade;
- operationId ou referência quando útil;
- próxima ação;
- eventual atualização da projeção.

### 31.8 Consistência eventual

Após mutação, a UI poderá:

- atualizar entidade canônica;
- mostrar projeção “em atualização”;
- não simular prontidão final antes do backend.

---

## 32. Modais, drawers e páginas

### 32.1 Modal

Usar para:

- confirmação;
- ação curta;
- escolha simples;
- consequência claramente delimitada.

### 32.2 Drawer

Usar para:

- leitura rápida;
- filtros;
- resumo de entidade;
- ação de complexidade média sem perda do contexto.

### 32.3 Página dedicada

Obrigatória para:

- caso clínico;
- cockpit individual;
- plano alimentar complexo;
- tratamento;
- exame;
- entidade com timeline;
- formulário longo;
- auditoria detalhada.

### 32.4 Regra de deep link

Conteúdo operacional importante não poderá existir apenas em modal sem URL.

### 32.5 Mobile browser

Embora o foco seja desktop/tablet, drawers não deverão bloquear acesso em viewport menor.

---

## 33. Tabelas e listas

### 33.1 Uso de tabela

Tabela é indicada para:

- comparação;
- ordenação;
- filtros;
- grandes conjuntos;
- dados estruturados.

### 33.2 Uso de cards

Cards são indicados para:

- resumo;
- prioridade;
- poucos itens;
- visão executiva;
- conteúdo com contexto visual.

### 33.3 Não transformar tudo em cards

Listas extensas de K9s, agenda, casos e auditoria devem priorizar tabela/lista densa.

### 33.4 Colunas responsivas

Colunas menos críticas poderão:

- ocultar;
- mover para detalhe;
- aparecer em tooltip;
- virar linha expandida.

### 33.5 Cabeçalho fixo

Tabelas longas poderão usar cabeçalho fixo.

### 33.6 Acessibilidade

- cabeçalhos semânticos;
- foco;
- ordenação anunciada;
- labels;
- alternativa a hover;
- navegação por teclado.

---

## 34. Timeline

### 34.1 Hierarquia do item

1. categoria;
2. título;
3. K9;
4. data efetiva;
5. resumo;
6. origem;
7. metadados;
8. ação.

### 34.2 Agrupamento temporal

Pode ser por:

- dia;
- mês;
- caso;
- categoria.

### 34.3 Densidade

A timeline deverá permitir leitura rápida sem esconder metadados críticos.

### 34.4 Expansão

Detalhes poderão expandir inline ou abrir entidade.

### 34.5 Eventos correlacionados

Quando aplicável, mostrar relação:

```text
Item de agenda → Consulta → Restrição → Tratamento
```

### 34.6 Amendments

Correções deverão ser visíveis e ligadas ao evento original.

---

## 35. Taxonomia de estados de domínio

### 35.1 Prontidão

- Operacional;
- Operacional com Atenção;
- Apto com Restrições;
- Temporariamente Inapto;
- Não Avaliado.

### 35.2 Restrição

A nomenclatura final virá do contrato, preservando conceitos:

- absoluta;
- parcial;
- atenção;
- ativa;
- encerrada;
- expirada ou concluída conforme modelo.

### 35.3 Agenda

- programado;
- próximo;
- hoje;
- pendente;
- atrasado;
- concluído;
- cancelado.

### 35.4 Caso clínico

A lista final virá do schema canônico.

Conceitos esperados:

- aberto;
- em acompanhamento;
- encerrado;
- reaberto.

### 35.5 Tratamento

Conceitos esperados:

- planejado;
- ativo;
- pausado;
- concluído;
- cancelado.

### 35.6 Plano alimentar

- ativo;
- substituído;
- cancelado;
- legado;
- conflito.

### 35.7 Proibição

A UI não deverá inventar enum apenas por conveniência visual.

---

## 36. Taxonomia de estados técnicos

### 36.1 Estados mínimos

- `idle`;
- `loading`;
- `refreshing`;
- `success`;
- `empty`;
- `partial`;
- `degraded`;
- `stale`;
- `legacy`;
- `conflict`;
- `unauthorized`;
- `forbidden`;
- `not_found`;
- `error`.

### 36.2 `empty`

A consulta funcionou e não encontrou entidades.

### 36.3 `not_found`

Uma entidade específica não existe ou não está disponível.

### 36.4 `partial`

Parte das fontes carregou.

### 36.5 `degraded`

A experiência funciona com fonte alternativa ou capacidade reduzida.

### 36.6 `stale`

A projeção excedeu a política de atualização.

### 36.7 `legacy`

O dado exibido vem de fonte pré-canônica.

### 36.8 `conflict`

Fontes incompatíveis impedem decisão segura.

### 36.9 `unauthorized`

Não há autenticação válida.

### 36.10 `forbidden`

Há autenticação, mas falta autorização.

### 36.11 `error`

Falha não recuperada.

### 36.12 Regra

Nenhum estado técnico poderá ser convertido silenciosamente em estado de domínio.

---

## 37. Padrões para estados técnicos

### 37.1 Loading inicial

- skeleton coerente com layout;
- sem métricas falsas;
- sem zeros;
- sem flashes de estado anterior de outro K9.

### 37.2 Refresh

- manter conteúdo existente;
- indicar atualização;
- evitar bloquear toda a página.

### 37.3 Empty state

Deverá responder:

- o que está vazio;
- por que pode estar vazio;
- qual ação existe;
- se filtros estão ativos.

### 37.4 Error state

Deverá oferecer:

- mensagem compreensível;
- tentar novamente;
- referência de suporte quando existente;
- preservação de conteúdo seguro.

### 37.5 Partial/degraded

Deverá identificar:

- o que carregou;
- o que falhou;
- impacto;
- próxima ação.

### 37.6 Stale

Deverá indicar:

- última atualização;
- política esperada;
- opção de atualizar;
- limite para ações críticas.

### 37.7 Conflict

Deverá:

- bloquear ação incompatível;
- explicar fontes;
- oferecer investigação;
- não selecionar automaticamente uma verdade.

---

## 38. Dados legados na interface

### 38.1 Identificação

Usar label como:

```text
Registro legado
```

### 38.2 Explicação

Tooltip ou painel:

> Este registro foi criado antes da adoção do contrato canônico Health v1 e está sendo preservado para consulta.

### 38.3 Não alterar por fluxo novo

Registros legados não deverão ser editados por formulários canônicos sem migração explícita.

### 38.4 Relação com timeline

A timeline poderá incluí-los com origem identificada.

### 38.5 Conflito

Se legado e canônico representarem o mesmo fato com divergência:

- estado conflict;
- correlação;
- investigação;
- sem dedupe destrutivo no cliente.

### 38.6 Remoção visual

Uma tela legada poderá ser removida mesmo que seus dados continuem preservados.

---

## 39. Permissões e visibilidade

### 39.1 Princípio

A arquitetura da informação será capability-driven.

### 39.2 Leitura

Capabilities conceituais poderão incluir:

- `health.view_overview`;
- `health.view_readiness`;
- `health.view_schedule`;
- `health.view_clinical`;
- `health.view_nutrition`;
- `health.view_history`;
- `health.view_reports`;
- `health.view_audit`.

### 39.3 Gestão

Possíveis:

- `health.manage_schedule`;
- `health.manage_clinical_case`;
- `health.manage_restriction`;
- `health.manage_treatment`;
- `health.manage_nutrition_plan`;
- `health.manage_documents`;
- `health.transcribe_external_record`;
- `health.export_reports`.

### 39.4 Status

A lista final pertence ao Inventário de Capabilities e à Permission Matrix.

### 39.5 Navegação

Se o usuário não puder visualizar uma área:

- o item poderá ser omitido;
- deep link deverá responder forbidden;
- não poderá carregar dados antes da autorização.

### 39.6 Ação sem permissão

Não deverá aparecer como erro depois do envio.

### 39.7 Gestor versus Operador

A Web é prioritariamente gerencial.

A matriz final deverá definir quais leituras um Operador poderá acessar sem ampliar writes indevidamente.

---

## 40. Contexto de identidade profissional externa

### 40.1 Quando exibir

Em:

- consulta;
- exame;
- documento;
- restrição;
- tratamento;
- vacinação;
- decisão externa.

### 40.2 Campos

- nome;
- conselho;
- número;
- UF;
- especialidade quando aplicável;
- clínica ou estabelecimento;
- contato apenas se permitido;
- origem do dado.

### 40.3 Separação

Profissional externo não deverá ser confundido com usuário autenticado executor.

### 40.4 Interface

Mostrar separadamente:

```text
Profissional responsável
Registrado no sistema por
```

---

## 41. Datas e temporalidade

### 41.1 Tipos de data

A interface poderá lidar com:

- data efetiva;
- criado em;
- atualizado em;
- início de vigência;
- término previsto;
- concluído em;
- cancelado em;
- registrado em;
- computado em.

### 41.2 Labels explícitos

Evitar “Data” sem qualificação.

### 41.3 Fuso

A interface usará política temporal aprovada.

### 41.4 Retroatividade

Registro tardio deverá distinguir:

- fato ocorrido;
- momento do registro.

### 41.5 Ordenação

Timeline usa data efetiva com critérios estáveis de desempate.

Auditoria usa horário da operação.

### 41.6 Formatação

Mostrar:

- formato local;
- horário quando relevante;
- data completa em tooltip quando abreviada.

---

## 42. Freshness e atualização

### 42.1 Projeções

Páginas baseadas em projeções deverão conhecer:

- `computed_at`;
- versão;
- política de stale.

### 42.2 Indicador

Não precisa dominar a interface quando atualizado.

Deve ficar evidente quando stale.

### 42.3 Atualização manual

Pode existir botão:

```text
Atualizar
```

Ele deverá atualizar leitura, não disparar cálculo client-side.

### 42.4 Após mutação

Mostrar:

```text
Registro salvo. A visão consolidada está sendo atualizada.
```

quando aplicável.

### 42.5 Ações críticas

A interface deverá consultar fonte canônica ou callable de validação, conforme arquitetura.

---

## 43. Responsividade

### 43.1 Prioridade

- desktop;
- notebook;
- tablet horizontal;
- tablet vertical.

### 43.2 Navegador móvel

Deverá permanecer utilizável para consulta emergencial, mas não é o principal ambiente de gestão.

### 43.3 Breakpoints

A implementação seguirá o design system existente, sem definir pixels rígidos neste documento.

### 43.4 Comportamentos

Em larguras menores:

- navegação secundária rola;
- cards empilham;
- tabelas reduzem colunas;
- filtros abrem em drawer;
- ações secundárias entram em menu;
- cockpit preserva identidade do K9.

### 43.5 Não ocultar criticidade

Status de prontidão e restrições não poderão desaparecer em layout compacto.

---

## 44. Acessibilidade

### 44.1 Objetivo

WCAG compatível com o padrão institucional do projeto.

### 44.2 Cor

Estados não dependerão apenas de cor.

### 44.3 Ícones

Ícones possuirão label acessível.

### 44.4 Teclado

- tabs navegáveis;
- menus acessíveis;
- dialogs com foco;
- tabelas operáveis;
- ações alcançáveis.

### 44.5 Leitores de tela

Alterações importantes deverão ser anunciadas.

### 44.6 Gráficos

Possuir alternativa textual ou tabular.

### 44.7 Movimento

Respeitar `prefers-reduced-motion`.

### 44.8 Contraste

Badges, linhas, textos secundários e alertas deverão manter contraste adequado.

---

## 45. Nomenclatura oficial

### 45.1 Módulo

Preferência:

```text
Saúde e Prontidão
```

### 45.2 Termos aprovados

- Prontidão;
- Restrição operacional;
- Agenda;
- Caso clínico;
- Tratamento;
- Plano alimentar;
- Histórico;
- Auditoria;
- Documento;
- Registro legado;
- Dados incompletos;
- Projeção desatualizada.

### 45.3 Termos a evitar

- Índice de saúde;
- Score de prontidão;
- Saúde boa/ruim;
- Apto sem fonte;
- Tudo certo;
- Sem problemas;
- Evento de saúde genérico;
- Medicamento como registro solto quando protocolo é autoridade.

### 45.4 Labels de ação

Devem descrever consequência real.

---

## 46. Hierarquia visual conceitual

### 46.1 Prioridade 1

- Temporariamente Inapto;
- restrição absoluta;
- conflito;
- erro crítico;
- caso urgente conforme domínio.

### 46.2 Prioridade 2

- Apto com Restrições;
- agenda atrasada;
- tratamento pendente;
- caso sem acompanhamento;
- projeção stale.

### 46.3 Prioridade 3

- Operacional com Atenção;
- próximos vencimentos;
- dados incompletos;
- documentos pendentes.

### 46.4 Prioridade 4

- Operacional;
- concluídos;
- histórico estável.

### 46.5 Não usar glow como criticidade isolada

A identidade tática poderá usar glow sutil, mas criticidade deverá ser comunicada por:

- label;
- ícone;
- texto;
- hierarquia;
- contraste.

---

## 47. Densidade e progressão de informação

### 47.1 Visão Geral

Baixa a média densidade.

### 47.2 Listas operacionais

Média a alta densidade.

### 47.3 Cockpit individual

Densidade progressiva:

```text
resumo → evidência → entidade → auditoria
```

### 47.4 Formulários

Agrupados por significado, não por estrutura do schema.

### 47.5 Progressive disclosure

Detalhes técnicos aparecem quando necessários.

### 47.6 Não esconder origem

Origem canônica/legada e freshness são detalhes operacionais, não meramente técnicos.

---

## 48. Jornadas principais

### 48.1 Jornada A — Identificar K9 temporariamente inapto

```text
Saúde
→ Visão Geral
→ card Temporariamente Inaptos
→ Prontidão filtrada
→ selecionar K9
→ cockpit
→ visualizar restrição absoluta
→ abrir restrição
→ consultar origem e vigência
```

### 48.2 Jornada B — Investigar atenção

```text
Saúde
→ Prontidão
→ Operacional com Atenção
→ cockpit
→ razões
→ agenda atrasada ou dado incompleto
→ abrir entidade
```

### 48.3 Jornada C — Criar plano alimentar

```text
Saúde
→ Nutrição
→ selecionar K9
→ estado sem plano
→ Criar e ativar plano
→ revisar
→ enviar comando
→ confirmação
→ aguardar atualização da leitura
```

### 48.4 Jornada D — Substituir plano

```text
Nutrição
→ plano ativo
→ Substituir
→ explicar consequência estrutural
→ preencher novo plano
→ confirmar
→ novo planId ativo
→ anterior superseded
```

### 48.5 Jornada E — Abrir caso clínico

```text
Saúde
→ Clínico
→ Abrir caso clínico
→ selecionar K9
→ registrar motivo e contexto
→ confirmar
→ detalhe do caso
```

### 48.6 Jornada F — Acompanhar exame

```text
Caso clínico
→ exame solicitado
→ abrir processo
→ visualizar lifecycle
→ anexar ou registrar resultado autorizado
→ revisão
```

### 48.7 Jornada G — Planejar prevenção

```text
Saúde
→ Agenda
→ Criar item
→ selecionar tipo e K9
→ definir data
→ salvar
→ item programado
```

### 48.8 Jornada H — Verificar execução

```text
Agenda
→ item concluído
→ abrir detalhe
→ acessar fato canônico vinculado
→ consultar executor e horário
```

### 48.9 Jornada I — Investigar mudança histórica

```text
Cockpit
→ Histórico
→ filtrar período
→ abrir evento
→ seguir para entidade fonte
```

### 48.10 Jornada J — Auditar operação

```text
Saúde
→ Auditoria
→ filtrar K9/ator/período
→ abrir operação
→ verificar operationId e resultado
```

---

## 49. Entradas externas e deep links

### 49.1 Notificações

Uma notificação futura deverá abrir a entidade correta.

### 49.2 Relatórios

Um item de relatório deverá abrir lista filtrada ou cockpit.

### 49.3 Perfil do K9

Abrirá cockpit.

### 49.4 Agenda

Abrirá item específico.

### 49.5 Permissão insuficiente

Deep link deverá preservar rota e explicar acesso negado.

### 49.6 Entidade removida ou indisponível

Mostrar not found sem redirecionamento silencioso para a home.

---

## 50. Observabilidade da experiência

### 50.1 Eventos úteis

Poderão ser observados:

- carregamento de rota;
- falha de reader;
- estado degraded;
- conflict;
- tentativa de ação;
- sucesso/falha de callable;
- atualização de projection;
- exportação;
- deep link inválido.

### 50.2 Proteção

Não registrar:

- conteúdo clínico integral;
- segredo;
- documento;
- dado pessoal desnecessário.

### 50.3 Correlação

Usar:

- requestId;
- operationId;
- entityId;
- route;
- domínio;
- resultado.

### 50.4 UX

Erros de observabilidade não deverão bloquear o usuário.

---

## 51. Performance percebida

### 51.1 Entrada em `/health`

Priorizar:

1. shell;
2. resumo de prontidão;
3. prioridades;
4. conteúdo secundário.

### 51.2 Lazy loading

Áreas secundárias poderão carregar depois.

### 51.3 Prefetch

Pode ser usado para rotas prováveis sem buscar dados não autorizados.

### 51.4 Listas

Devem paginar ou limitar.

### 51.5 Imagens

Fotos de K9 deverão possuir tamanho otimizado e fallback.

### 51.6 Evitar N+1

Listas globais devem consumir projeções adequadas.

---

## 52. Contrato conceitual de cada página

Cada página deverá documentar:

| Campo | Descrição |
|---|---|
| Responsabilidade | problema único resolvido |
| Público | perfis/capabilities |
| Fonte primária | agregado ou projection |
| Fontes auxiliares | relações necessárias |
| Filtros | estado da URL |
| Ação primária | comando principal |
| Ações secundárias | comandos auxiliares |
| Estados de domínio | enums exibidos |
| Estados técnicos | loading/partial/etc. |
| Empty state | significado |
| Erro | recuperação |
| Deep links | entradas e saídas |
| Auditoria | operações relevantes |
| Responsividade | comportamento |
| Testes | cenários obrigatórios |

A implementação não deverá iniciar uma página sem esse contrato mínimo.

---

## 53. Matriz resumida de páginas

| Página | Fonte principal | Ação central | Natureza |
|---|---|---|---|
| Visão Geral | projections agregadas | navegar/priorizar | read-first |
| Prontidão | `health_summary` | investigar | read-only inicial |
| Cockpit | summary + fontes canônicas | gerenciar contexto | read-first |
| Agenda | `health_schedule` | planejar | gestão |
| Clínico | `clinical_cases` | abrir/acompanhar caso | gestão |
| Caso clínico | case + events | acompanhar/encerrar | gestão |
| Nutrição | `nutrition_plans` | criar/alterar/substituir/cancelar | gestão canônica |
| Histórico | `health_timeline` | investigar | read-only |
| Relatórios | projections/report contracts | analisar/exportar | read-only |
| Auditoria | audit logs | investigar | read-only restrito |

---

## 54. Mockups derivados

### 54.1 Sequência recomendada

1. Visão Geral;
2. Prontidão;
3. Cockpit individual — Resumo;
4. Cockpit individual — Restrições;
5. Agenda;
6. Casos clínicos;
7. Detalhe do caso;
8. Tratamento e monitoramento;
9. Nutrição integrada;
10. Histórico;
11. Relatórios;
12. Auditoria;
13. Estados técnicos transversais;
14. Tablet.

### 54.2 Cada mockup deverá demonstrar

- rota;
- responsabilidade;
- estado de domínio;
- estado técnico;
- fonte conceitual;
- ação primária;
- capability;
- drill-down;
- responsividade relevante.

### 54.3 Não criar apenas happy path

Conjunto mínimo de estados:

- normal;
- empty;
- loading;
- partial;
- degraded;
- stale;
- legacy;
- conflict;
- forbidden;
- error.

### 54.4 Nutrição

Os dez mockups existentes deverão ser auditados e adaptados ao novo shell, não descartados.

---

## 55. Decisões fixadas por este documento

1. A Sidebar terá um único item Saúde.
2. `/health` será a entrada global.
3. O módulo terá navegação secundária.
4. O Health Web possuirá visão global e cockpit individual.
5. `/k9/{dogId}` não manterá prontuário completo concorrente.
6. Prontidão usará somente os cinco estados oficiais.
7. Score percentual não representará prontidão.
8. Ações serão específicas por domínio.
9. Histórico e Auditoria terão propósitos diferentes.
10. Dados legados serão identificados.
11. Conflitos serão explícitos.
12. Filtros relevantes serão compartilháveis na URL.
13. Entidades profundas terão deep links.
14. Estados técnicos não serão convertidos em estados de domínio.
15. O Plano Alimentar será integrado ao novo shell sem perder seus contratos.
16. A arquitetura priorizará desktop e tablet.
17. Tabelas serão usadas para comparação e escala.
18. Cards serão usados para síntese, não como substituto universal.
19. Formulários corresponderão a comandos de domínio.
20. Projeções stale ou parciais serão comunicadas.

---

## 56. Decisões humanas pendentes

### 56.1 Navegação

- Auditoria será rota própria ou parte de Relatórios?
- A navegação secundária terá sete ou oito itens?
- Cockpit usará tabs, subrotas ou modelo híbrido?
- Rotas individuais usarão `/health/dogs/{dogId}` ou query param em algumas áreas?

### 56.2 Writes

- A Web poderá registrar peso?
- A Web poderá registrar aplicação de vacina?
- A Web poderá concluir item preventivo ou apenas transcrever?
- Quem poderá abrir caso clínico?
- Quem poderá criar ou encerrar restrição?
- A Web poderá registrar administração de dose em situação administrativa?

### 56.3 Permissões

- Quais capabilities serão atribuídas a Operador?
- Quais serão exclusivas de Gestor?
- Instrutor terá leitura clínica completa?
- Quem poderá exportar dados?
- Quem poderá acessar Auditoria?

### 56.4 Conteúdo

- Qual nomenclatura final para módulo: “Saúde” ou “Saúde e Prontidão”?
- “Apto com Restrições” será o label final aprovado ou seguirá exatamente o contrato Mobile vigente?
- Quais campos deverão aparecer no cabeçalho do cockpit?

### 56.5 Migração

- A aba antiga no perfil K9 será removida, redirecionada ou mantida temporariamente?
- Quais dados legados serão exibidos?
- Haverá painel de reconciliação?
- Quando o indicador antigo será retirado?

### 56.6 Relatórios

- Relatórios Health permanecem no módulo Health ou no catálogo geral?
- Auditoria Health integra o Log de Registros geral?
- Quais exportações serão permitidas na v1?

---

## 57. Itens explicitamente fora de escopo

Este documento não aprova:

- implementação;
- merge da branch de Nutrição;
- exclusão de código;
- exclusão de dados;
- deploy;
- alteração de Rules;
- alteração de Functions;
- capability final;
- design visual final;
- paleta;
- componentes definitivos;
- schema novo;
- cálculo de prontidão;
- algoritmo de alertas;
- automação clínica;
- diagnóstico por IA;
- integração veterinária externa;
- assinatura digital;
- agenda de escala;
- execução Mobile;
- geração de APK.

---

## 58. Riscos de arquitetura da informação

### IA-RISK-001 — Recriar página monolítica

**Risco:** concentrar tudo em `/health`.

**Mitigação:** responsabilidade clara por rota.

### IA-RISK-002 — Duplicar prontuário

**Risco:** manter fluxos completos em `/k9/{dogId}` e `/health`.

**Mitigação:** perfil institucional como resumo e link.

### IA-RISK-003 — Score reaparecer

**Risco:** representar prontidão por percentual.

**Mitigação:** cinco estados oficiais e razões.

### IA-RISK-004 — Tabs sem URL

**Risco:** impedir deep link e histórico.

**Mitigação:** tabs com rotas ou parâmetros.

### IA-RISK-005 — Cards demais

**Risco:** baixa comparabilidade e rolagem excessiva.

**Mitigação:** tabelas nas visões operacionais.

### IA-RISK-006 — Ações genéricas

**Risco:** misturar domínios e contratos.

**Mitigação:** verbos e comandos específicos.

### IA-RISK-007 — Legado parecer canônico

**Risco:** decisão baseada em fonte antiga.

**Mitigação:** labels, readers e estado legacy.

### IA-RISK-008 — Falha parecer “Não Avaliado”

**Risco:** falsa informação operacional.

**Mitigação:** taxonomias separadas.

### IA-RISK-009 — Ocultar freshness

**Risco:** decisão sobre projeção stale.

**Mitigação:** computed_at e estado stale.

### IA-RISK-010 — Ações sem capability

**Risco:** descoberta tardia de acesso negado.

**Mitigação:** navegação e ações capability-driven.

### IA-RISK-011 — Modal profundo

**Risco:** entidade importante sem URL.

**Mitigação:** página dedicada.

### IA-RISK-012 — UI ditar schema

**Risco:** criar enums para facilitar mockup.

**Mitigação:** contrato canônico como autoridade.

---

## 59. Gates antes dos mockups definitivos

### Gate IA-1 — Aprovação do mapa de rotas

Confirmar:

- rotas principais;
- cockpit;
- perfil K9;
- Auditoria;
- Relatórios.

### Gate IA-2 — Aprovação da navegação

Confirmar:

- item único na Sidebar;
- navegação secundária;
- ordem;
- responsividade.

### Gate IA-3 — Aprovação dos contratos de página

Ao menos:

- Visão Geral;
- Prontidão;
- Cockpit;
- Agenda;
- Clínico;
- Nutrição;
- Histórico.

### Gate IA-4 — Permissionamento conceitual

Definir quais áreas e ações existem por capability.

### Gate IA-5 — Fronteira de writes

Resolver peso, vacina, agenda, restrições e conclusão.

### Gate IA-6 — Estados transversais

Aprovar:

- loading;
- partial;
- degraded;
- stale;
- legacy;
- conflict;
- error.

### Gate IA-7 — Aprovação humana

Nenhum mockup será considerado referência oficial antes da revisão humana.

---

## 60. Critérios de aprovação

Este documento estará aprovado quando houver concordância de que:

- a arquitetura não é guiada pelo legado;
- o Plano Alimentar foi corretamente preservado;
- existe um único ponto de entrada na Sidebar;
- o mapa de rotas é compreensível;
- visão global e cockpit individual estão separados;
- prontidão usa os estados oficiais;
- restrições possuem prioridade;
- agenda não confunde planejamento e execução;
- clínico é organizado por casos;
- timeline e auditoria possuem papéis diferentes;
- dados legados e conflitos são visíveis;
- permissions e capabilities governam ações;
- estados técnicos estão separados;
- os mockups derivados estão claramente definidos.

---

## 61. Controle de mudança

Após aprovação:

- alterações de navegação deverão atualizar este documento;
- mudanças de responsabilidade de rota deverão ser justificadas;
- novos subdomínios não deverão criar item na Sidebar automaticamente;
- alteração de labels de domínio deverá referenciar contrato ou ADR;
- mudança de fronteira Web × Mobile deverá atualizar arquitetura e matriz;
- mockup divergente deverá ser reconciliado antes da implementação;
- implementação não será autoridade para corrigir este documento silenciosamente.

---

## 62. Documentos derivados

Este documento alimenta:

- `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md`;
- `HEALTH_WEB_CAPABILITIES_INVENTORY.md`;
- `HEALTH_WEB_PERMISSION_MATRIX.md`;
- `HEALTH_WEB_DATA_SOURCE_MATRIX.md`;
- `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`;
- `HEALTH_WEB_READINESS_POLICY.md`;
- `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`;
- `HEALTH_WEB_MOCKUP_PLAN.md`;
- ADRs de arquitetura da informação.

---

## 63. Próximo documento recomendado

O próximo documento deverá ser:

```text
docs/health/web/architecture/HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md
```

Ele deverá mapear:

- cada domínio canônico;
- entidades;
- lifecycles;
- telas;
- componentes;
- ações;
- fontes;
- outputs;
- relações entre telas.

Após ele, será possível criar:

```text
HEALTH_WEB_DATA_SOURCE_MATRIX.md
```

com menor risco de duplicação ou campo sem autoridade.

---

## 64. Status de aprovação

| Item | Estado |
|---|---|
| Estrutura inicial | Concluída |
| Consistência com a baseline | Revisada |
| Consistência com a arquitetura-alvo | Revisada |
| Validação de domínio | Pendente de revisão humana |
| Validação de rotas | Pendente |
| Validação de permissions | Pendente |
| Aprovação para mockups | Pendente |
| Aprovação para implementação | Não concedida |

---

## 65. Conclusão

A arquitetura da informação proposta transforma a Saúde Web de uma experiência antiga, monolítica e não adotada em uma estrutura de gestão orientada por:

- prontidão categórica;
- restrições;
- prioridades;
- planejamento;
- casos clínicos;
- contratos específicos;
- visão longitudinal;
- rastreabilidade;
- fontes canônicas;
- separação entre gestão e execução.

O módulo terá um único ponto de entrada, múltiplas áreas internas e um cockpit individual que explica a condição de cada K9 sem duplicar o perfil institucional.

O próximo passo não é implementar.

O próximo passo é transformar esta arquitetura em um modelo formal de relação entre:

```text
domínio
→ entidade
→ lifecycle
→ tela
→ ação
→ fonte de dados
→ capability
```

Essa relação será documentada em `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md`.
