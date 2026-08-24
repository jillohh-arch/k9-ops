# K9 Ops Web — Health Web v1 Target Architecture

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Arquitetura-alvo lógica, funcional e técnica |
| Repositório | `github.com/jillohh-arch/k9-ops` |
| Baseline documental | `HEALTH_WEB_BASELINE.md` |
| Auditoria de origem | `HEALTH_WEB_CURRENT_STATE_AUDIT.md` |
| Autoridade de domínio | Health v1.0 Mobile/Backend aprovado |
| Fora de escopo | Implementação, merge, deploy, migração real e ativação em produção |

---

## 1. Propósito

Este documento define a arquitetura-alvo do **Health Web v1** do K9 Ops.

A arquitetura aqui descrita deverá orientar:

- a organização das rotas da Saúde Web;
- a separação dos subdomínios;
- a distribuição de responsabilidades entre Web, Mobile e Backend;
- o consumo de fontes canônicas e projeções;
- o tratamento de prontidão operacional;
- a gestão de agenda, casos clínicos, exames, tratamentos, Nutrição e documentos;
- a coexistência temporária com dados legados;
- a autorização por capability;
- os contratos de leitura e mutação;
- os estados técnicos das interfaces;
- a estratégia de testes;
- a evolução incremental sem reescrita global do K9 Ops Web.

Este documento responde:

> Como o Health Web v1 deverá ser estruturado para funcionar como Centro de Gestão e Prontidão K9, sem repetir o monólito legado e sem duplicar a execução operacional do Mobile?

---

## 2. Relação com os documentos anteriores

### 2.1 Auditoria

O documento:

```text
HEALTH_WEB_CURRENT_STATE_AUDIT.md
```

registra o que foi encontrado no repositório Web.

### 2.2 Baseline

O documento:

```text
HEALTH_WEB_BASELINE.md
```

fixa a interpretação oficial desse estado.

### 2.3 Arquitetura-alvo

Este documento estabelece o estado desejado.

A relação correta é:

```text
Auditoria
   ↓
Baseline
   ↓
Arquitetura-alvo
   ↓
Arquitetura da informação
   ↓
Contratos detalhados
   ↓
Roadmap
   ↓
Implementação por gates
```

### 2.4 Regra de precedência

Se este documento contradizer uma decisão canônica do Health v1.0 compartilhada com Mobile ou Backend, a decisão canônica prevalece.

Se uma seção deste documento estiver marcada como proposta ou decisão pendente, ela não poderá ser tratada como contrato implementável até aprovação humana.

---

## 3. Declaração arquitetural central

O Health Web v1 será construído como:

> uma aplicação gerencial modular, orientada a subdomínios, que consome fontes canônicas e projeções server-side, administra planos e decisões autorizadas, oferece visão longitudinal da saúde e da prontidão do efetivo K9 e preserva a execução operacional cotidiana no Mobile.

### 3.1 O Health Web não será

O Health Web v1 não será:

- uma simples modernização do dashboard pré-Foundation;
- um prontuário veterinário isolado da prontidão;
- uma réplica desktop do Mobile;
- um cliente que recalcula o estado clínico global localmente;
- um agregador de centenas de documentos sem paginação;
- uma interface que escreve diretamente em fontes canônicas sem contrato;
- um local onde qualquer usuário interno possa tomar decisão veterinária;
- um substituto para o profissional externo responsável;
- um repositório paralelo de verdade clínica;
- um módulo único com todos os fluxos em um único arquivo de página.

### 3.2 Centro de Gestão e Prontidão K9

A Web deverá responder, em níveis diferentes:

1. **Gestão do efetivo**  
   Quais K9s estão operacionais, em atenção, restritos, inaptos ou não avaliados?

2. **Gestão preventiva**  
   O que vence, está próximo, está pendente ou está atrasado?

3. **Gestão clínica**  
   Quais casos estão abertos, em investigação, em tratamento, monitoramento ou encerrados?

4. **Gestão de protocolos**  
   Quais tratamentos, exames, doses e reavaliações exigem acompanhamento?

5. **Gestão nutricional**  
   Quais K9s possuem plano ativo, conflito, ausência de plano ou necessidade de substituição?

6. **Gestão documental**  
   Quais evidências, receitas, laudos, resultados e atestados sustentam as decisões registradas?

7. **Gestão de conformidade**  
   Quem registrou, alterou, cancelou, encerrou, substituiu ou transcreveu cada decisão?

---

## 4. Drivers arquiteturais

A arquitetura é orientada pelos seguintes drivers.

### 4.1 Segurança operacional

Uma restrição clínica absoluta conhecida não pode ser ignorada por uma heurística visual ou falha de carregamento.

### 4.2 Rastreabilidade

Toda mutação relevante deve produzir evidência de:

- executor interno;
- profissional externo responsável, quando aplicável;
- instante;
- motivo;
- origem;
- operação idempotente;
- resultado;
- eventual documento de suporte.

### 4.3 Imutabilidade clínica

Eventos clínicos finalizados não devem ser editados em lugar.

Correções deverão usar:

- amendment;
- cancelamento auditado;
- novo evento correlacionado;
- transição de estado explícita.

### 4.4 Separação de decisão e execução

O profissional externo determina a decisão clínica.

O usuário interno autorizado registra ou transcreve essa decisão.

O sistema valida, persiste, projeta e audita.

### 4.5 Separação entre plataformas

A Web administra, planeja, revisa e monitora.

O Mobile executa rotinas e registra fatos no contexto operacional.

O Backend protege invariantes e materializa projeções.

### 4.6 Leitura eficiente

Dashboards e listagens gerenciais não devem reconstruir todo o domínio no navegador.

### 4.7 Evolução incremental

A arquitetura deverá coexistir temporariamente com fontes legadas sem dual-write indiscriminado.

### 4.8 Falha explícita

Ausência, conflito, degradação ou defasagem de dados não podem ser exibidos como normalidade.

### 4.9 Escalabilidade proporcional

O efetivo atual é pequeno, mas a arquitetura não deve depender de varredura ilimitada ou agregação global não paginada.

### 4.10 Reaproveitamento seletivo

Componentes existentes podem ser reutilizados, mas comportamento pré-Foundation não possui autoridade semântica.

---

## 5. Princípios obrigatórios

### 5.1 Fontes canônicas primeiro

Novas telas devem preferir:

1. projeções canônicas;
2. agregados canônicos;
3. adapters de legado explicitamente identificados;
4. nunca heurísticas locais silenciosas como fonte de verdade.

### 5.2 Projeções não são autoridade de mutação

`health_summary` e `health_timeline` são otimizadas para leitura.

Elas não devem receber writes diretos dos clientes.

### 5.3 Prontidão não é score

Os cinco estados oficiais de prontidão são categóricos.

Nenhum percentual, anel ou nota numérica poderá substituir:

- `operational`;
- `operational_attention`;
- `fit_with_restrictions`;
- `temporarily_unfit`;
- `not_evaluated`.

### 5.4 Restrições prevalecem

A autorização crítica deve consultar `operational_restrictions` ou contrato Backend equivalente.

O `health_summary` serve para display e navegação, não para autorizar sozinho ações críticas.

### 5.5 Web define; Mobile executa

Esse princípio já validado na Nutrição deverá orientar outros fluxos quando aplicável.

### 5.6 Comandos explícitos

Cada mutação deverá representar uma intenção de domínio, por exemplo:

- criar caso;
- registrar consulta;
- solicitar exame;
- registrar interpretação;
- iniciar tratamento;
- substituir plano alimentar;
- cancelar agenda;
- encerrar restrição.

Não deverá existir uma mutação genérica capaz de editar livremente qualquer documento Health.

### 5.7 Capabilities específicas

A autorização não deverá depender apenas de ações genéricas como `health.edit`.

### 5.8 Estados técnicos separados do domínio

`loading`, `error`, `empty`, `partial`, `degraded`, `stale`, `legacy` e `conflict` não são estados clínicos.

### 5.9 Identidade profissional externa

Não existe `role: vet` no v1.

O profissional externo é registrado como `ProfessionalIdentity`.

### 5.10 Auditoria por desenho

Auditoria não será um campo opcional adicionado no fim do fluxo.

Ela será parte do contrato de comando.

---

## 6. Visão de contexto

```text
┌───────────────────────────────────────────────────────────────┐
│                       K9 Ops Web                              │
│                                                               │
│  Health Overview · Readiness · Agenda · Clinical · Nutrition │
│  History · Reports · Audit                                   │
└───────────────────────────────┬───────────────────────────────┘
                                │
                         reads / commands
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                  Health Backend Authority                     │
│                                                               │
│  Authorization · Invariants · Idempotency · Audit · Storage  │
│  Projection workers · Migration adapters · Conflict control  │
└───────────────────────┬───────────────────────┬───────────────┘
                        │                       │
              canonical writes          projection writes
                        │                       │
┌───────────────────────▼──────────┐  ┌────────▼────────────────┐
│       Canonical Aggregates       │  │    Read Projections     │
│                                  │  │                         │
│ cases · events · exams           │  │ health_summary          │
│ treatments · doses               │  │ health_timeline         │
│ restrictions · schedule          │  │ reporting projections   │
│ weights · vaccinations           │  │                         │
│ nutrition · documents            │  │                         │
└───────────────────────┬──────────┘  └────────┬────────────────┘
                        │                       │
                        └───────────┬───────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────┐
│                        K9 Ops Mobile                          │
│                                                             │
│ Executes routines · records field facts · consults current  │
│ state · follows plans and protocols                         │
└─────────────────────────────────────────────────────────────┘
```

### 6.1 Interpretação

- Web e Mobile compartilham o mesmo domínio.
- Nenhum dos dois clientes possui autoridade para quebrar invariantes.
- Projeções são materializadas pelo Backend.
- O legado pode alimentar adapters e migração, mas não constitui o centro da arquitetura.

---

## 7. Fronteiras de responsabilidade

### 7.1 Web

A Web será responsável por:

- visão gerencial do efetivo;
- drill-down por K9;
- leitura da prontidão atual;
- leitura das restrições ativas;
- gestão da agenda preventiva;
- administração do plano alimentar;
- acompanhamento de execução nutricional;
- abertura e acompanhamento de casos clínicos, quando autorizado;
- transcrição de decisões externas, quando autorizado;
- gestão de protocolos, exames e reavaliações;
- associação e consulta de documentos;
- relatórios;
- auditoria;
- reconciliação assistida de conflitos;
- visualização de dados legados identificados.

### 7.2 Mobile

O Mobile permanecerá responsável por:

- uso operacional no turno;
- consulta rápida da prontidão;
- validação operacional de restrições;
- execução de refeições planejadas;
- registro de refeição e suplemento;
- registro de dose administrada;
- registro de pesagem operacional, conforme decisão de produto;
- observações e fatos de campo;
- evidências capturadas durante a execução;
- uso offline controlado;
- reconciliação após retorno de conectividade.

### 7.3 Backend

O Backend será responsável por:

- autorização real;
- validação de capabilities;
- invariantes de domínio;
- idempotência;
- receipts de operação;
- transições de estado;
- imutabilidade;
- amendments;
- auditoria;
- atualização de projeções;
- cálculo categórico de prontidão;
- validação canônica de restrições;
- prevenção de múltiplos ativos incompatíveis;
- migração e backfill;
- normalização temporal;
- proteção de Storage;
- emissão de erros estruturados.

### 7.4 Profissional externo

O profissional externo:

- determina a decisão clínica;
- fornece diagnóstico, prescrição, restrição, alta, interpretação ou recomendação;
- é identificado no registro;
- não precisa possuir conta no K9 Ops v1.

### 7.5 Regra de decisão

```text
Profissional externo decide
        ↓
Usuário interno autorizado registra
        ↓
Backend valida e persiste
        ↓
Projeções são atualizadas
        ↓
Web e Mobile exibem o mesmo estado
```

---

## 8. Decomposição por subdomínio

O Health Web v1 será dividido em módulos internos coesos.

### 8.1 Overview

Responsabilidade:

- fornecer visão executiva do efetivo;
- destacar exceções;
- resumir prontidão, agenda, casos e Nutrição;
- direcionar para drill-down.

Não será responsável por:

- recalcular prontidão;
- carregar toda a timeline;
- executar mutações clínicas complexas;
- substituir páginas especializadas.

### 8.2 Readiness

Responsabilidade:

- listar todos os K9s por estado oficial;
- exibir razões e evidências;
- mostrar restrições ativas;
- indicar defasagem do snapshot;
- permitir navegação para o contexto clínico correspondente.

### 8.3 Preventive Schedule

Responsabilidade:

- administrar itens de agenda;
- filtrar por K9, tipo, período e lifecycle;
- visualizar vencimentos e atrasos;
- criar, atualizar, concluir ou cancelar quando autorizado;
- distinguir evento planejado de fato executado.

### 8.4 Clinical Cases

Responsabilidade:

- listar casos;
- exibir lifecycle;
- abrir caso por comando explícito;
- acompanhar eventos, exames, tratamentos, documentos e restrições correlacionadas;
- suportar reabertura e encerramento dentro das regras.

### 8.5 Clinical Events

Responsabilidade:

- representar fatos clínicos imutáveis dentro de casos;
- suportar draft quando permitido;
- finalizar, cancelar ou receber amendment;
- nunca virar um editor genérico de documento.

### 8.6 Exams

Responsabilidade:

- separar solicitação, coleta, resultado técnico, interpretação e impacto operacional;
- permitir acompanhamento de pendências;
- associar documentos e profissionais;
- vincular ao caso clínico.

### 8.7 Treatments

Responsabilidade:

- administrar protocolos;
- definir medicamento, frequência, duração, responsáveis e reavaliação;
- acompanhar doses executadas pelo Mobile;
- evidenciar atrasos ou falhas;
- encerrar ou cancelar de forma auditada.

### 8.8 Nutrition

Responsabilidade:

- administrar planos alimentares;
- preservar o contrato pós-Foundation já implementado;
- acompanhar execução sem registrar refeições pela Web, salvo futura decisão explícita;
- tratar canonical, legacy, empty, degraded, error e conflict;
- impedir múltiplos planos ativos silenciosos.

### 8.9 Weight and Trends

Responsabilidade:

- exibir histórico e tendência de peso;
- associar peso ao contexto nutricional e clínico;
- destacar ausência ou defasagem;
- não diagnosticar automaticamente.

### 8.10 Vaccination

Responsabilidade:

- administrar e consultar registros preventivos de vacinação;
- exibir validade e agenda derivada;
- distinguir registro canônico de projeções antigas;
- associar profissional, lote, documento e evidência quando aplicável.

### 8.11 Documents

Responsabilidade:

- cadastrar metadados;
- associar anexos a entidades canônicas;
- controlar acesso;
- manter lineage;
- não se tornar uma collection ambígua universal.

### 8.12 Timeline

Responsabilidade:

- apresentar sequência longitudinal unificada;
- consumir `health_timeline`;
- permitir filtros e paginação;
- abrir a entidade de origem;
- exibir origem canônica ou legada.

### 8.13 Reports

Responsabilidade:

- produzir visões agregadas;
- permitir exportação autorizada;
- respeitar sensibilidade;
- declarar período e fonte;
- evitar cálculos clínicos no navegador.

### 8.14 Audit

Responsabilidade:

- exibir operações e alterações;
- permitir rastrear executor, motivo, operationId e entidade;
- separar auditoria operacional de conteúdo clínico;
- restringir acesso por capability.

### 8.15 Legacy Bridge

Responsabilidade:

- ler fontes antigas de forma defensiva;
- identificar origem;
- evitar dual-write;
- apoiar backfill e reconciliação;
- desaparecer após critérios formais de desativação.

---

## 9. Arquitetura em camadas

A arquitetura interna da feature Health Web será organizada em camadas locais.

### 9.1 Route layer

Responsável por:

- definição de rotas;
- carregamento do shell;
- parâmetros de URL;
- boundaries de erro;
- composição inicial da página;
- metadados;
- proteção de acesso ao módulo.

### 9.2 Presentation layer

Responsável por:

- componentes visuais;
- tabelas;
- cards;
- filtros;
- formulários;
- diálogos;
- drawers;
- estados técnicos;
- acessibilidade;
- responsividade.

A presentation layer não deverá:

- conhecer nomes de campos legados;
- escrever diretamente em Firestore;
- calcular prontidão;
- decidir transições válidas;
- montar auditoria manualmente.

### 9.3 Application layer

Responsável por:

- orchestrators de leitura;
- view models;
- commands;
- query keys;
- paginação;
- composição de read models;
- transformação de erros técnicos em estados de aplicação;
- coordenação entre entidades sem violar domínio.

### 9.4 Domain contracts

Responsáveis por:

- enums oficiais;
- tipos canônicos;
- value objects;
- regras puras compartilháveis;
- contratos de estado;
- identidade de comando;
- invariantes que podem ser validadas localmente para UX.

Validação local melhora a experiência, mas não substitui validação Backend.

### 9.5 Data layer

Responsável por:

- readers Firestore;
- clients de callable;
- clients de Storage autorizados;
- parsers canônicos;
- adapters legados;
- normalização de Timestamp;
- mapeamento de erros;
- cancelamento de listeners;
- instrumentação.

### 9.6 Backend layer

Embora fora do repositório visual da Web, integra a arquitetura lógica:

- command handlers;
- projection handlers;
- migration workers;
- rules;
- índices;
- receipts;
- audit logs;
- validações cross-document.

### 9.7 Dependency rule

```text
routes
  ↓
presentation
  ↓
application
  ↓
domain contracts

application
  ↓
data ports
  ↓
data implementations
```

O domínio não deve importar:

- React;
- Next.js;
- Firebase;
- componentes;
- hooks;
- nomes de campos legados.

---

## 10. Organização interna proposta

A estrutura exata poderá ser ajustada durante HW-1, mas a direção recomendada é:

```text
src/
├── app/
│   └── (app)/
│       └── health/
│           ├── layout.tsx
│           ├── page.tsx
│           ├── readiness/
│           │   ├── page.tsx
│           │   └── [dogId]/page.tsx
│           ├── schedule/page.tsx
│           ├── clinical/
│           │   ├── page.tsx
│           │   └── [caseId]/page.tsx
│           ├── nutrition/page.tsx
│           ├── history/page.tsx
│           ├── reports/page.tsx
│           └── audit/page.tsx
│
└── features/
    └── health/
        ├── domain/
        │   ├── readiness/
        │   ├── clinical/
        │   ├── schedule/
        │   ├── nutrition/
        │   ├── treatments/
        │   ├── exams/
        │   ├── documents/
        │   └── shared/
        ├── application/
        │   ├── queries/
        │   ├── commands/
        │   ├── read-models/
        │   └── state/
        ├── data/
        │   ├── readers/
        │   ├── functions/
        │   ├── storage/
        │   ├── parsers/
        │   └── legacy/
        ├── presentation/
        │   ├── overview/
        │   ├── readiness/
        │   ├── schedule/
        │   ├── clinical/
        │   ├── nutrition/
        │   ├── history/
        │   ├── reports/
        │   ├── audit/
        │   └── shared/
        └── testing/
            ├── fixtures/
            ├── builders/
            └── contracts/
```

### 10.1 Regras da estrutura

- Não criar arquitetura genérica global para todo o K9 Ops.
- Não mover módulos não relacionados apenas para uniformizar pastas.
- Não duplicar tipos canônicos em cada tela.
- Não criar um único `health-service.ts` para todos os subdomínios.
- Não criar um único hook global que carregue todas as collections.
- Não acoplar componentes a queries Firestore concretas.
- Não importar adapters legados na presentation layer.

### 10.2 Compatibilidade com o repositório atual

A migração da estrutura existente deverá ser incremental.

Arquivos atuais poderão permanecer temporariamente até que:

- nova rota equivalente esteja homologada;
- dados necessários estejam disponíveis;
- testes estejam verdes;
- redirecionamento esteja definido;
- remoção seja aprovada.

---

## 11. Arquitetura da informação em alto nível

A decisão detalhada pertencerá ao documento `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`.

A arquitetura-alvo protege, inicialmente, as seguintes rotas:

| Rota | Responsabilidade principal |
|---|---|
| `/health` | visão geral do efetivo |
| `/health/readiness` | prontidão e restrições |
| `/health/readiness/{dogId}` | cockpit individual de prontidão |
| `/health/schedule` | agenda preventiva e operacional |
| `/health/clinical` | casos clínicos |
| `/health/clinical/{caseId}` | detalhe longitudinal do caso |
| `/health/nutrition` | gestão de planos alimentares |
| `/health/history` | timeline unificada |
| `/health/reports` | relatórios gerenciais |
| `/health/audit` | trilha de auditoria Health |

### 11.1 Navegação principal

A Sidebar deverá manter um único item principal:

```text
Saúde
```

### 11.2 Navegação secundária

Dentro do módulo, haverá navegação secundária persistente ou contextual.

### 11.3 Perfil individual do K9

O perfil geral do K9 poderá oferecer entrada para Saúde, mas a autoridade funcional ficará nas rotas Health.

A relação recomendada é:

```text
/k9/{dogId}
   └── resumo institucional do K9
         └── abrir cockpit de saúde
               └── /health/readiness/{dogId}
```

Não deverá existir duplicação completa de prontuário em duas árvores de rotas.

---

## 12. Arquitetura de dados

### 12.1 Classes de dados

O Health Web reconhecerá quatro classes.

| Classe | Natureza | Cliente pode escrever? |
|---|---|---:|
| Agregado canônico | fonte de verdade de domínio | somente por contrato autorizado |
| Projeção | leitura otimizada | não |
| Registro legado | preservação/migração | não por fluxos novos |
| Configuração | política operacional versionada | somente gestão autorizada |

### 12.2 Agregados canônicos

Conforme o domínio aprovado, incluem:

- `clinical_cases`;
- `clinical_events` dentro do caso;
- `exam processes`;
- `treatment_protocols`;
- `dose administrations`;
- `weight_records`;
- `nutrition_plans`;
- `meal_logs`;
- `supplement_logs`;
- `health_documents`;
- `operational_restrictions`;
- `health_schedule`;
- `vaccination_records`.

### 12.3 Projeções

As projeções mínimas são:

- `health_summary/current` por K9;
- `health_timeline` por K9.

Projeções adicionais para relatórios poderão ser criadas apenas quando justificadas por query, custo, segurança ou performance.

### 12.4 Legado

Fontes legadas identificadas incluem, entre outras:

- `health_logs`;
- `health_events` pré-canônicos;
- `documentos`;
- `documents` em formatos antigos;
- campos `_last_*` no documento do K9;
- prescriptions nutricionais anteriores;
- score ou heurísticas antigas.

### 12.5 Regra de leitura

```text
Canônico disponível e válido
   → usar canônico

Canônico ausente, legado conhecido e reader autorizado
   → exibir legado identificado

Canônico e legado em conflito
   → estado conflict; não escolher silenciosamente

Falha parcial
   → estado partial/degraded; não exibir como completo
```

---

## 13. Projeções de leitura

### 13.1 `health_summary/current`

Deverá servir como resumo atual por K9.

Campos conceituais de interesse Web:

- `readiness_status`;
- `readiness_reasons`;
- `readiness_updated_at`;
- `last_evaluated_at`;
- `active_restrictions_count`;
- `absolute_restriction_active`;
- `partial_restriction_active`;
- `attention_restriction_active`;
- `open_cases_count`;
- `active_treatments_count`;
- `pending_schedule_count`;
- `overdue_schedule_count`;
- `last_weight`;
- `last_weight_at`;
- `next_preventive_item_at`;
- `active_nutrition_plan_id`;
- `source_version`;
- `projection_version`;
- `computed_at`.

A lista final de campos dependerá da Data Source Matrix.

### 13.2 `health_timeline`

Deverá materializar itens normalizados de múltiplas fontes.

Cada item deverá permitir:

- ordenação temporal;
- paginação;
- filtro por categoria;
- identificação de origem;
- navegação para a entidade fonte;
- indicação canônico/legado;
- visibilidade conforme permissão;
- suporte a correlação por caseId, protocolId ou scheduleId.

### 13.3 Proibição

A Web não deverá montar a timeline global por:

- N listeners de collections diferentes;
- concatenação ilimitada;
- ordenação local de todos os documentos;
- suposição de formatos temporais homogêneos.

### 13.4 Consistência eventual

Projeções podem possuir pequena defasagem.

A interface deverá:

- mostrar `computed_at` quando relevante;
- suportar atualização;
- exibir estado `stale` quando exceder política;
- abrir a fonte canônica para validação crítica.

---

## 14. Arquitetura de prontidão

### 14.1 Estados oficiais

| Enum | Label oficial |
|---|---|
| `operational` | Operacional |
| `operational_attention` | Operacional com Atenção |
| `fit_with_restrictions` | Apto com Restrições |
| `temporarily_unfit` | Temporariamente Inapto |
| `not_evaluated` | Não Avaliado |

### 14.2 Precedência

```text
1. Restrição absoluta ativa
   → temporarily_unfit

2. Restrição parcial ativa
   → fit_with_restrictions

3. Restrição de atenção ativa
   → operational_attention

4. Nenhuma avaliação registrada
   → not_evaluated

5. Dados relevantes incompletos
   → operational_attention

6. Sem restrições e dados adequados
   → operational
```

### 14.3 Fonte para display

A Web deverá ler o estado categórico de:

```text
health_summary/current.readiness_status
```

ou contrato equivalente aprovado.

### 14.4 Fonte para autorização crítica

A autorização deverá consultar restrições canônicas ou callable que as valide.

### 14.5 Proibição de cálculo local

A Web não poderá derivar prontidão a partir de:

- validade de vacina isoladamente;
- peso em faixa isoladamente;
- exame recente isoladamente;
- campos `_last_*`;
- score percentual;
- ausência de alertas no cliente.

### 14.6 Evidências

A UI deverá mostrar por que o estado existe.

Exemplos:

- restrição absoluta ativa até determinada data;
- restrição parcial para atividade específica;
- vacina próxima do vencimento;
- ausência de avaliação registrada;
- snapshot desatualizado;
- dados incompletos significativos.

### 14.7 Estado técnico

Se o summary falhar, a UI deverá exibir falha de carregamento.

Ela não deverá converter a falha em `not_evaluated`.

---

## 15. Arquitetura de restrições

### 15.1 Fonte canônica

As restrições vivem em:

```text
operational_restrictions/{restrictionId}
```

sob o K9 conforme schema aprovado.

### 15.2 Tipos conceituais

- absoluta;
- parcial;
- atenção.

### 15.3 Lifecycle

Uma restrição deverá possuir:

- início de vigência;
- eventual término previsto;
- status;
- motivo;
- escopo;
- origem profissional;
- executor interno;
- documento de suporte quando existente;
- encerramento auditado.

### 15.4 Sem override por score

Nenhuma projeção, score ou indicador futuro poderá sobrescrever uma restrição absoluta ativa.

### 15.5 Ações Web

A Web poderá:

- visualizar restrições;
- registrar decisão externa quando autorizada;
- encerrar conforme evidência e capability;
- consultar histórico;
- abrir entidade relacionada.

A Web não poderá:

- inventar decisão clínica;
- encerrar por conveniência operacional;
- apagar restrição;
- alterar conteúdo finalizado sem amendment.

---

## 16. Arquitetura da agenda

### 16.1 Agregado canônico

A agenda será baseada em `HealthScheduleItem`.

### 16.2 Tipos de item

Pode reunir:

- refeições;
- suplementos;
- doses;
- consultas;
- exames;
- vacinas;
- pesagens;
- reavaliações;
- outros itens preventivos aprovados.

### 16.3 Lifecycle oficial

A representação visual deverá reconciliar o lifecycle canônico com labels como:

- Programado;
- Próximo;
- Hoje;
- Pendente;
- Atrasado;
- Concluído;
- Cancelado.

A lista final de enums deve vir do contrato aprovado, não ser reinventada na interface.

### 16.4 Planejado não é executado

Criar um item de agenda não produz automaticamente um evento executado.

### 16.5 Conclusão

A conclusão deverá referenciar o fato canônico produzido quando aplicável.

### 16.6 Web e Mobile

A Web poderá planejar e administrar.

O Mobile poderá executar e registrar o fato no contexto operacional.

### 16.7 Idempotência

Concluir, cancelar ou reagendar exige `operationId` e proteção contra repetição.

---

## 17. Arquitetura clínica

### 17.1 ClinicalCase como agregado raiz

Um caso clínico organiza o ciclo de cuidado.

Estados:

- `open`;
- `under_investigation`;
- `under_treatment`;
- `monitoring`;
- `discharged`;
- `cancelled`.

### 17.2 Eventos dentro do caso

Eventos pertencem a exatamente um caso quando clínicos.

### 17.3 Imutabilidade

Após finalização:

- conteúdo não é editado;
- amendment é separado;
- cancelamento não apaga;
- auditoria permanece.

### 17.4 Reabertura

Reabertura:

- é uma ação auditada;
- exige motivo;
- exige capability;
- não se aplica a caso cancelado;
- pode exigir identificação profissional e documento.

### 17.5 Múltiplos casos

Um K9 pode possuir múltiplos casos abertos.

A UI não deverá presumir caso único.

### 17.6 Visão Web

A página do caso deverá compor:

- resumo;
- status;
- timeline do caso;
- exames;
- tratamentos;
- restrições;
- agenda correlacionada;
- documentos;
- profissionais;
- auditoria;
- ações permitidas.

---

## 18. Arquitetura de exames

### 18.1 Separação obrigatória

```text
Solicitação
   ↓
Coleta
   ↓
Resultado técnico
   ↓
Interpretação profissional
   ↓
Impacto operacional
```

### 18.2 ExamProcess

O exame é agregado próprio dentro do caso.

### 18.3 Documentos

Resultado técnico pode possuir documento anexado.

Documento não substitui campos estruturados mínimos.

### 18.4 Pendências

A Web deverá permitir identificar:

- solicitado sem coleta;
- coletado sem resultado;
- resultado sem interpretação;
- interpretação que exige ação;
- exame cancelado;
- exame vencido ou reprogramado.

### 18.5 Sem inferência clínica

A Web não interpretará automaticamente valores laboratoriais como diagnóstico no v1.

---

## 19. Arquitetura de tratamentos

### 19.1 TreatmentProtocol

Todo tratamento estruturado deverá gerar protocolo.

### 19.2 Conteúdo

O protocolo pode conter:

- medicamento;
- apresentação;
- dose;
- unidade;
- via;
- frequência;
- duração;
- data inicial;
- data final prevista;
- profissional responsável;
- instruções;
- responsáveis pela execução;
- reavaliação;
- restrição relacionada;
- documentos.

### 19.3 Doses

As administrações são registros próprios e idempotentes.

### 19.4 Divisão de plataforma

A Web administra o protocolo e acompanha aderência.

O Mobile executa e registra doses.

### 19.5 Falhas e atrasos

A UI pode destacar atraso, omissão ou conflito, mas não alterar o fato histórico.

### 19.6 Encerramento

Encerrar um protocolo exige comando, motivo e auditoria.

---

## 20. Arquitetura de Nutrição

### 20.1 Status especial

Nutrição é o primeiro submódulo Web pós-Foundation já implementado.

### 20.2 Contrato preservado

```text
WEB DEFINE E ADMINISTRA
        ↓
MOBILE EXECUTA E REGISTRA FATOS
```

### 20.3 Fontes

Fonte canônica:

```text
dogs/{dogId}/nutrition_plans/{planId}
```

Fontes legadas podem ser lidas por adapter durante coexistência.

### 20.4 Mutações existentes a preservar

- CREATE e ativação;
- UPDATE administrativo permitido;
- REPLACE estrutural;
- CANCEL;
- operationId;
- receipts;
- conflict fail-closed;
- capability `health.manage_nutrition_plan`.

### 20.5 Integração

A integração não será merge cego da branch.

Deverá:

1. reconciliar branch com a base atual;
2. preservar contratos cross-platform;
3. mover componentes para a arquitetura interna aprovada;
4. manter testes;
5. ajustar navegação;
6. remover mensagens de placeholder inconsistentes;
7. validar Rules e Functions reais;
8. homologar novamente com Mobile.

### 20.6 Read model

Estados mínimos:

- loading;
- canonical;
- legacy;
- empty;
- degraded;
- error;
- conflict.

### 20.7 Execução

A Web v1 não deverá registrar refeição ou suplemento, salvo decisão humana futura expressa.

---

## 21. Arquitetura de peso e vacinação

### 21.1 WeightRecord

Peso é agregado de rotina canônico.

### 21.2 VaccinationRecord

Vacinação preventiva é agregado canônico independente.

### 21.3 Writes Web pendentes

Ainda precisa ser decidido:

- se a Web pode registrar peso;
- se a Web pode transcrever aplicação de vacina;
- se essas ações ficam somente no Mobile;
- quais capabilities se aplicam.

### 21.4 Regra provisória

Até decisão:

- leitura e gestão poderão ser especificadas;
- writes novos não serão ativados;
- código legado não será usado como precedente.

### 21.5 Tendências

Gráficos de peso deverão:

- declarar intervalo;
- indicar lacunas;
- não interpolar fato inexistente como dado real;
- permitir associação a plano ou caso;
- respeitar timezone e occurred_at.

---

## 22. Arquitetura documental

### 22.1 HealthDocument

Documentos de Saúde serão entidade canônica com metadados.

### 22.2 Tipos

Exemplos:

- receita;
- laudo;
- resultado de exame;
- atestado;
- imagem;
- PDF;
- comprovante;
- documento de suporte à restrição.

### 22.3 Associação

Um documento poderá se associar a:

- K9;
- caso;
- evento;
- exame;
- tratamento;
- vacinação;
- restrição;
- outro agregado aprovado.

### 22.4 Storage

O path deverá preservar identidade canônica e impedir colisão.

### 22.5 Segurança

A URL ou referência de Storage não deverá ser tratada como autorização.

### 22.6 Legado

As collections `documentos` e `documents` deverão passar por inventário e adapter.

---

## 23. Arquitetura de comandos

### 23.1 Command envelope

Cada comando deverá incluir, conforme necessidade:

```text
operationId
actorContext
entity identifiers
expected version/revision
occurredAt
recordedAt
reason
professionalIdentity
sourceDocument
payload
clientContext
```

### 23.2 Idempotência

`operationId` deverá:

- ser único por intenção;
- ser reutilizado em retry da mesma intenção;
- não ser reutilizado em operação diferente;
- produzir receipt durável;
- evitar duplicidade.

### 23.3 Concorrência

Comandos sensíveis deverão usar:

- revision esperada;
- precondition;
- transaction;
- conflito estruturado.

### 23.4 Erros estruturados

Exemplos conceituais:

- `permission_denied`;
- `capability_missing`;
- `conflict`;
- `invalid_transition`;
- `active_restriction_conflict`;
- `duplicate_operation`;
- `validation_failed`;
- `source_document_required`;
- `professional_identity_required`;
- `not_found`;
- `projection_stale`.

### 23.5 Proibição

Não usar mensagens livres como único contrato de erro.

---

## 24. Arquitetura de autorização

### 24.1 Princípio

A interface esconde ações indisponíveis, mas o Backend decide.

### 24.2 Capabilities

O inventário final será definido em documento próprio.

Famílias esperadas:

- leitura Health;
- gestão de plano alimentar;
- gestão de agenda;
- abertura e transição de casos;
- transcrição clínica;
- gestão de exames;
- gestão de tratamentos;
- gestão de restrições;
- amendments;
- reabertura;
- exportação;
- auditoria;
- migração/reconciliação.

### 24.3 Sem herança silenciosa

Uma capability específica não deverá cair automaticamente para `health.edit` sem decisão formal.

### 24.4 Profissional externo

Identidade profissional não concede acesso ao sistema.

### 24.5 Dados sensíveis

A leitura pode variar por:

- módulo;
- entidade;
- campo;
- exportação;
- auditoria;
- documento.

### 24.6 Ações destrutivas

Exclusão física não será fluxo normal do Health v1.

Cancelamento, soft delete controlado ou amendment deverão ser preferidos.

---

## 25. Arquitetura de estados técnicos

Toda tela deverá implementar estados explícitos.

### 25.1 Loading

Dados ainda não disponíveis.

### 25.2 Empty

Consulta válida sem registros.

### 25.3 Error

Falha que impede resultado confiável.

### 25.4 Partial

Parte das fontes carregou e parte falhou.

### 25.5 Degraded

A experiência opera com contrato reduzido conhecido.

### 25.6 Stale

Dados disponíveis, mas além da idade aceitável.

### 25.7 Legacy

Resultado proveniente de fonte antiga identificada.

### 25.8 Conflict

Mais de uma fonte ou entidade apresenta incompatibilidade que exige resolução.

### 25.9 Forbidden

Usuário autenticado sem capability.

### 25.10 Not found

Entidade não existe ou não está visível.

### 25.11 Regra de comunicação

Cada estado deve informar:

- o que ocorreu;
- o que está disponível;
- o que não é confiável;
- qual ação é possível;
- se há risco operacional.

---

## 26. Arquitetura temporal

### 26.1 Instantes distintos

O sistema deverá distinguir:

- `occurred_at`;
- `recorded_at`;
- `effective_from`;
- `effective_until`;
- `scheduled_for`;
- `completed_at`;
- `cancelled_at`;
- `computed_at`.

### 26.2 Timezone

A apresentação deverá respeitar timezone institucional definido.

### 26.3 Ordenação

Timeline usa o instante de ocorrência com tie-breaker estável.

### 26.4 Datas futuras

Eventos clínicos ocorridos não podem ter `occurred_at` futuro.

Agenda pode ter data futura.

### 26.5 Defasagem

Snapshot e projeções devem expor idade.

### 26.6 Interface

A UI não deve exibir apenas “há 2 dias” quando a data absoluta for importante para auditoria.

---

## 27. Arquitetura de leitura

### 27.1 Query por tela

Cada tela terá query própria e limitada.

### 27.2 Paginação

Obrigatória para:

- timeline extensa;
- casos históricos;
- auditoria;
- documentos;
- relatórios detalhados.

### 27.3 Listeners

Listeners em tempo real serão usados apenas quando agregarem valor operacional.

### 27.4 Cancelamento

Toda subscription deverá ser corretamente encerrada.

### 27.5 Cache

O cache não pode esconder stale ou conflito.

### 27.6 Read models

A presentation layer deverá receber modelos já preparados, por exemplo:

- `HealthOverviewReadModel`;
- `ReadinessRosterReadModel`;
- `DogReadinessCockpitReadModel`;
- `ScheduleBoardReadModel`;
- `ClinicalCaseListReadModel`;
- `ClinicalCaseDetailReadModel`;
- `NutritionManagementReadModel`;
- `HealthTimelineReadModel`.

### 27.7 Sem N+1 silencioso

Queries por K9 devem ser planejadas para não gerar listeners ou reads desnecessários.

---

## 28. Arquitetura de mutação

### 28.1 Default

Novas mutações Health serão mediadas por Backend.

### 28.2 Exceção

Write direto só poderá existir se:

- houver justificativa formal;
- Rules garantirem invariantes;
- não houver coordenação cross-document;
- idempotência não for necessária;
- auditoria permanecer completa;
- decisão estiver documentada.

### 28.3 Upload

Upload poderá ser dividido em:

1. preparar destino autorizado;
2. enviar arquivo;
3. finalizar comando com metadados;
4. remover órfão em falha.

### 28.4 Optimistic UI

Só poderá ser usada quando:

- rollback for claro;
- domínio tolerar;
- estado não for crítico;
- receipt reconciliar resultado.

### 28.5 Ações críticas

Prontidão, restrições, casos, tratamentos e substituição de plano não devem depender de optimistic state como verdade.

---

## 29. Arquitetura de auditoria

### 29.1 Conteúdo mínimo

- operationId;
- action;
- entity type;
- entity id;
- actor uid;
- actor display name;
- internal role;
- timestamp;
- reason;
- before/after permitido;
- source;
- device/client context quando relevante;
- professional identity quando aplicável;
- receipt status.

### 29.2 Redação e privacidade

Logs não devem duplicar conteúdo clínico sensível sem necessidade.

### 29.3 Imutabilidade

A trilha de auditoria deve ser append-only ou protegida por autoridade equivalente.

### 29.4 Correlação

`operationId` deverá permitir correlacionar:

- comando;
- alteração canônica;
- projection update;
- audit entry;
- erro ou retry.

### 29.5 UI

A Web poderá apresentar auditoria contextual na entidade e auditoria global no módulo.

---

## 30. Arquitetura de observabilidade

### 30.1 Objetivos

Detectar:

- falhas de callable;
- projeção atrasada;
- conflitos de plano ativo;
- erros de parsing;
- listeners excessivos;
- falhas de permissão;
- upload órfão;
- operationId duplicado;
- inconsistência canônico × legado.

### 30.2 Logs

Logs técnicos não deverão conter dados clínicos completos.

### 30.3 Métricas

Métricas possíveis:

- latência de comandos;
- taxa de erro por comando;
- idade de projeção;
- quantidade de conflitos;
- leituras por tela;
- falhas de migração;
- itens de agenda atrasados;
- operações bloqueadas por capability.

### 30.4 Alertas

Alertas operacionais de infraestrutura não são o mesmo que alertas clínicos mostrados ao usuário.

---

## 31. Arquitetura de coexistência com legado

### 31.1 Estratégia

Adapter pattern com migração server-side progressiva.

### 31.2 Princípio

```text
Preservar primeiro
Entender depois
Migrar com manifesto
Validar
Só então desativar
```

### 31.3 Dual-read

Dual-read pode existir temporariamente.

### 31.4 Dual-write

Dual-write client-side não é estratégia padrão.

### 31.5 Origem identificada

Todo registro legado exibido deve ser identificável internamente como legado.

### 31.6 Conflitos

Quando houver duas fontes conflitantes:

- não selecionar silenciosamente;
- não duplicar sem indicação;
- emitir estado conflict;
- permitir reconciliação autorizada.

### 31.7 Migração

Backfill deverá registrar:

- source collection;
- source id;
- target entity;
- target id;
- batch id;
- migration version;
- migrated at;
- checksum ou fingerprint;
- status;
- rollback reference.

### 31.8 Desativação

Uma fonte legada só poderá ser retirada após:

- inventário;
- backfill;
- comparação;
- aprovação;
- janela de observação;
- rollback definido;
- confirmação de ausência de consumidores.

---

## 32. Integração da branch de Nutrição

### 32.1 Estado conhecido

A branch funcional está divergente de `master`.

### 32.2 Risco

Merge direto pode:

- reintroduzir código antigo;
- perder ajustes recentes;
- criar conflito de navegação;
- duplicar capabilities;
- quebrar testes;
- alterar contratos cross-platform.

### 32.3 Estratégia recomendada

1. criar branch de integração a partir da base aprovada;
2. executar preflight;
3. inventariar commits de Nutrição;
4. classificar por código, teste, docs e mockups;
5. portar commits intencionalmente;
6. reconciliar paths e capabilities;
7. executar testes unitários e de integração;
8. validar Functions/Rules;
9. homologar com plano real controlado;
10. somente então integrar.

### 32.4 Autoridade

A implementação da branch é um ativo preservável, mas não supera contratos cross-platform posteriores.

---

## 33. Arquitetura de experiência e componentes

### 33.1 Shell Health

Deverá conter:

- título e contexto;
- navegação secundária;
- seletor ou contexto de K9 quando aplicável;
- estado de sincronização;
- ações condicionadas por capability;
- área de conteúdo;
- boundaries de erro.

### 33.2 Componentes compartilhados conceituais

- `HealthModuleHeader`;
- `HealthSecondaryNavigation`;
- `DogContextCard`;
- `ReadinessStatusBadge`;
- `ReadinessReasonList`;
- `RestrictionSummaryCard`;
- `ScheduleStatusBadge`;
- `ProfessionalIdentityCard`;
- `AuditMetadataCard`;
- `HealthDocumentLink`;
- `CanonicalSourceBadge`;
- `LegacySourceBadge`;
- `ProjectionFreshnessIndicator`;
- `HealthTechnicalState`;
- `CommandFeedbackPanel`;
- `OperationReceiptDetails`.

### 33.3 Acessibilidade

- não depender apenas de cor;
- foco visível;
- labels claros;
- tabelas navegáveis;
- dialogs com foco gerenciado;
- status anunciados;
- contraste adequado;
- suporte a zoom;
- responsividade em desktop e tablet.

### 33.4 Design tático institucional

A identidade visual poderá usar o padrão K9 Ops, mas sem comprometer:

- leitura clínica;
- contraste;
- densidade adequada;
- semântica de risco;
- acessibilidade.

---

## 34. Performance e escalabilidade

### 34.1 Dashboard

Deve ler projeções resumidas, não 500 eventos globais.

### 34.2 Listagens

Devem usar:

- filtros indexáveis;
- limites;
- cursores;
- paginação;
- queries por escopo.

### 34.3 Relatórios

Relatórios pesados poderão exigir:

- export assíncrono futuro;
- projection dedicada;
- callable agregadora;
- processamento server-side.

No v1, nenhuma promessa de processamento em background será feita sem infraestrutura real.

### 34.4 Imagens e documentos

Listagens não deverão baixar arquivos completos para apresentar metadados.

### 34.5 Realtime

Tempo real não será usado por padrão em telas históricas.

---

## 35. Segurança

### 35.1 Defense in depth

- UI por capability;
- Rules;
- callable auth;
- invariantes server-side;
- Storage rules;
- audit;
- validação de payload;
- princípio do menor privilégio.

### 35.2 Dados clínicos

Devem ser tratados como dados sensíveis institucionais.

### 35.3 Exportação

Exportar exige capability própria e trilha de auditoria.

### 35.4 URLs

Links diretos não substituem autorização.

### 35.5 Input

Payloads devem ter:

- limites;
- enums fechados;
- sanitização;
- tipos;
- validação temporal;
- validação de referências.

### 35.6 Client trust

Nenhum campo de ator recebido do cliente deve ser aceito sem reconciliação com a identidade autenticada.

---

## 36. Testabilidade

### 36.1 Domínio

Testes puros para:

- enums;
- transições;
- precedência;
- parsing;
- temporalidade;
- conflito;
- read-state mapping.

### 36.2 Application

Testes para:

- composição de read models;
- paginação;
- filtros;
- capability gating;
- command lifecycle;
- retry e receipt.

### 36.3 Data

Testes para:

- parsers canônicos;
- adapters legados;
- clients de Functions;
- timestamps;
- erros estruturados;
- cancelamento de listeners.

### 36.4 UI

Testes para:

- loading;
- empty;
- error;
- partial;
- degraded;
- stale;
- legacy;
- conflict;
- forbidden;
- ações por capability.

### 36.5 Emulator

Testes integrados para:

- Firestore Rules;
- Functions;
- Storage;
- receipts;
- idempotência;
- transições;
- projections;
- autorização.

### 36.6 Cross-platform

Fluxos críticos deverão provar:

```text
Web administra
   ↓
Backend persiste
   ↓
Mobile lê/executa
   ↓
Backend registra fato
   ↓
Web acompanha
```

---

## 37. Estratégia de entrega incremental

### 37.1 Foundation first

Nenhum write novo deverá anteceder os contratos.

### 37.2 Read-first

A nova experiência começará consumindo dados canônicos e projeções.

### 37.3 Ordem arquitetural recomendada

1. contratos e estrutura interna;
2. shell e navegação;
3. Overview read-only;
4. Readiness read-only;
5. cockpit individual;
6. agenda read-only;
7. integração de Nutrição;
8. casos clínicos read-only;
9. timeline;
10. writes específicos por domínio;
11. relatórios e auditoria;
12. desativação do legado.

### 37.4 Gate por subdomínio

Cada subdomínio deve possuir:

- contrato;
- source matrix;
- capability matrix;
- estados técnicos;
- mockup aprovado;
- testes;
- plano de migração;
- homologação.

---

## 38. Fluxos arquiteturais exemplificativos

### 38.1 Abrir cockpit de prontidão

```text
Usuário acessa /health/readiness
   ↓
Readiness query busca summaries paginados
   ↓
UI apresenta estado + freshness
   ↓
Usuário abre um K9
   ↓
Cockpit lê summary, restrictions e próximos itens
   ↓
Ações são condicionadas por capability
```

### 38.2 Criar plano alimentar

```text
Usuário autorizado abre Nutrição
   ↓
Reader verifica canônico + legado
   ↓
Estado empty permite CREATE
   ↓
UI envia command com operationId
   ↓
Callable valida capability e invariantes
   ↓
Plano é criado e ativado
   ↓
Receipt e audit são gravados
   ↓
Mobile passa a visualizar o plano ativo
```

### 38.3 Registrar restrição externa

```text
Decisão veterinária existe
   ↓
Usuário interno autorizado informa ProfessionalIdentity
   ↓
Anexa ou referencia documento quando necessário
   ↓
Envia command de criação de restrição
   ↓
Backend valida capability, vigência e evidências
   ↓
Restriction canônica é criada
   ↓
Readiness projection é recalculada
   ↓
Web e Mobile exibem novo estado
```

### 38.4 Dose de tratamento

```text
Web cria/acompanha TreatmentProtocol
   ↓
Agenda projeta doses
   ↓
Mobile mostra dose a executar
   ↓
Condutor registra administração com operationId
   ↓
Backend cria DoseAdministration
   ↓
Agenda e timeline são atualizadas
   ↓
Web acompanha aderência
```

### 38.5 Amendment clínico

```text
Evento finalizado contém informação incorreta
   ↓
Usuário autorizado solicita amendment
   ↓
Original permanece imutável
   ↓
Novo amendment registra correção, razão e autoria
   ↓
Timeline indica correção sem apagar histórico
```

---

## 39. Decisões arquiteturais fixadas

Este documento fixa, sujeito à aprovação humana final:

1. Health Web será modular por subdomínio.
2. O dashboard antigo não será base funcional obrigatória.
3. Plano Alimentar será preservado e integrado.
4. Prontidão será categórica e server-derived.
5. Restrições canônicas governam ações críticas.
6. Timeline será projeção server-side.
7. Summary será projeção server-side.
8. Novos writes usarão comandos explícitos.
9. Backend protegerá invariantes.
10. ClinicalEvents finalizados serão imutáveis.
11. Correções usarão amendment ou novo evento.
12. Capabilities serão granulares.
13. Web e Mobile não duplicarão responsabilidades sem decisão.
14. Legado será lido por adapters e migrado progressivamente.
15. Nenhum dado será excluído por simples substituição de UI.
16. Estados técnicos serão separados dos estados de domínio.
17. A integração de Nutrição não será merge cego.
18. O perfil do K9 não manterá um segundo prontuário completo concorrente.
19. A nova arquitetura será introduzida incrementalmente.
20. Não haverá reestruturação global do K9 Ops para viabilizar o Health.

---

## 40. Decisões pendentes

Ainda exigem aprovação específica:

### 40.1 Writes de rotina na Web

- registrar peso;
- registrar vacinação aplicada;
- transcrever evento preventivo;
- criar observação diária.

### 40.2 Fronteira clínica

- quem pode abrir caso;
- quem pode registrar consulta;
- quem pode iniciar tratamento;
- quem pode criar ou encerrar restrição;
- quais evidências são obrigatórias.

### 40.3 Capabilities por perfil

- Operador K9;
- Instrutor K9;
- Gestor;
- Administrador.

### 40.4 Navegação detalhada

- nomenclatura final das abas;
- presença de Audit na navegação principal ou contextual;
- integração com Relatórios globais;
- estratégia de rota individual do K9.

### 40.5 Configurações

- thresholds preventivos;
- janelas de stale Web;
- políticas de exportação;
- retenção de documentos;
- visibilidade de dados sensíveis.

### 40.6 Migração

- collections reais com dados;
- volume;
- qualidade;
- destino de cada formato;
- ordem de backfill;
- data de corte.

---

## 41. Escopos fora desta arquitetura v1

- IPO numérico;
- inteligência artificial clínica;
- diagnóstico automatizado;
- integração direta com clínicas;
- login de veterinário externo;
- telemedicina;
- faturamento veterinário completo;
- estoque farmacêutico integrado;
- internação;
- centro cirúrgico;
- fisioterapia;
- prontuário compartilhado externo;
- notificações multicanal avançadas;
- substituição global da arquitetura do K9 Ops Web.

---

## 42. Riscos arquiteturais

### AR-WEB-001 — Projeções ainda não disponíveis

Mitigação:

- contracts first;
- readers com estado unavailable;
- não recriar heurística como fallback silencioso.

### AR-WEB-002 — Rules e Functions sem autoridade reconciliada

Mitigação:

- gate técnico;
- inventário de deploy;
- validação no repositório autoritativo.

### AR-WEB-003 — Branch de Nutrição divergente

Mitigação:

- integração por portabilidade intencional;
- testes cross-platform.

### AR-WEB-004 — Dados legados desconhecidos

Mitigação:

- inventário read-only;
- manifest;
- adapters;
- rollback.

### AR-WEB-005 — Capabilities genéricas atuais

Mitigação:

- inventário;
- matriz;
- backend enforcement.

### AR-WEB-006 — Monólito reaparecer

Mitigação:

- subdomínios;
- limites de dependência;
- code review.

### AR-WEB-007 — Duplicação Web × Mobile

Mitigação:

- matriz de responsabilidade por ação;
- ADR específica.

### AR-WEB-008 — Display confundido com autorização

Mitigação:

- summary para display;
- restrictions para enforcement.

### AR-WEB-009 — Excesso de realtime

Mitigação:

- query strategy por tela;
- paginação;
- realtime apenas quando necessário.

### AR-WEB-010 — Dados sensíveis em logs

Mitigação:

- redaction;
- logs estruturados mínimos;
- revisão de segurança.

### AR-WEB-011 — UI esconder degradação

Mitigação:

- estado técnico obrigatório;
- testes de failure mode.

### AR-WEB-012 — Abstração prematura

Mitigação:

- arquitetura local à feature;
- ports somente com consumidor real;
- evitar framework interno genérico.

---

## 43. Critérios de conformidade para implementação

Uma implementação só estará conforme se:

- [ ] usar os estados oficiais de prontidão;
- [ ] não recalcular prontidão no cliente;
- [ ] distinguir summary de restrictions;
- [ ] não escrever em projeções;
- [ ] usar commands explícitos para mutações;
- [ ] validar capability no Backend;
- [ ] manter operationId e receipt quando exigido;
- [ ] preservar imutabilidade clínica;
- [ ] exibir estados técnicos;
- [ ] identificar legado;
- [ ] paginar histórico e auditoria;
- [ ] não carregar collections globais ilimitadas;
- [ ] respeitar Web × Mobile × Backend;
- [ ] possuir testes mínimos;
- [ ] possuir mockup aprovado;
- [ ] possuir source matrix;
- [ ] possuir plano de rollback quando migratório;
- [ ] não remover legado sem gate;
- [ ] preservar Nutrição canônica;
- [ ] passar por revisão humana.

---

## 44. Gates derivados

### Gate A — Aprovação arquitetural

- arquitetura-alvo revisada;
- pendências marcadas;
- sem implementação.

### Gate B — Arquitetura da informação

- rotas;
- navegação;
- páginas;
- drill-down;
- estados.

### Gate C — Contratos de dados

- source matrix;
- query contracts;
- projection contracts;
- command contracts.

### Gate D — Segurança

- capability inventory;
- permission matrix;
- Rules/Functions authority.

### Gate E — Mockups

- Overview;
- Readiness;
- cockpit individual;
- Agenda;
- Clinical;
- estados técnicos.

### Gate F — Preflight técnico

- branch;
- HEAD;
- divergência;
- worktree;
- build;
- lint;
- typecheck;
- testes;
- deploy authority.

### Gate G — Implementação read-only

- shell;
- readers;
- estados;
- testes.

### Gate H — Mutations

- commands;
- capabilities;
- emulator;
- idempotência;
- auditoria.

### Gate I — Migração

- inventory;
- manifest;
- backfill;
- comparison;
- rollback.

### Gate J — Homologação

- Web;
- Backend;
- Mobile;
- produção controlada;
- aprovação humana.

---

## 45. Próximos documentos derivados

A arquitetura deverá ser detalhada por:

1. `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`
2. `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md`
3. `HEALTH_WEB_DATA_SOURCE_MATRIX.md`
4. `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`
5. `HEALTH_WEB_CAPABILITIES_INVENTORY.md`
6. `HEALTH_WEB_PERMISSION_MATRIX.md`
7. `HEALTH_WEB_READINESS_POLICY.md`
8. `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`
9. `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md`
10. `HEALTH_WEB_TEST_STRATEGY.md`
11. `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`
12. `HEALTH_WEB_MOCKUP_PLAN.md`

ADRs específicas deverão formalizar decisões exclusivas da Web.

---

## 46. Critérios de aprovação deste documento

- [ ] A arquitetura não promove o legado pré-Foundation a requisito.
- [ ] O Plano Alimentar foi preservado como capacidade canônica.
- [ ] As responsabilidades Web, Mobile e Backend estão separadas.
- [ ] Os subdomínios estão definidos.
- [ ] Summary e Timeline são projeções.
- [ ] Restrictions são autoridade para enforcement.
- [ ] Os cinco estados de prontidão estão corretos.
- [ ] Eventos clínicos finalizados são imutáveis.
- [ ] A coexistência com legado é não destrutiva.
- [ ] Capabilities granulares são exigidas.
- [ ] Estados técnicos estão separados do domínio.
- [ ] A arquitetura interna não exige reescrita global.
- [ ] A integração de Nutrição é controlada.
- [ ] Decisões pendentes estão claramente identificadas.
- [ ] Nenhuma implementação ou deploy foi implicitamente autorizado.

---

## 47. Status de aprovação

| Papel | Status |
|---|---|
| Responsável pelo produto | Pendente |
| Revisão de arquitetura | Pendente |
| Revisão Mobile/Backend | Pendente |
| Revisão de segurança | Pendente |
| Autorização para HW-1 | Pendente |

---

## 48. Próximo passo recomendado

Após aprovação humana deste documento, produzir:

```text
HEALTH_WEB_INFORMATION_ARCHITECTURE.md
```

Esse documento deverá definir:

- mapa de navegação;
- rotas finais;
- hierarquia de páginas;
- navegação global e secundária;
- cockpit global e individual;
- inventário de telas;
- ações por tela;
- filtros;
- drill-down;
- estados técnicos;
- comportamento desktop e tablet;
- relação entre Saúde e perfil do K9.

Nenhum mockup definitivo deverá ser iniciado antes da aprovação dessa arquitetura da informação.

---

## 49. Conclusão

O Health Web v1 será uma nova construção oficial sobre a fundação canônica do Health v1.0.

A arquitetura preserva o único ativo Web pós-Foundation — a gestão de Plano Alimentar — e impede que o restante da implementação experimental determine o futuro do módulo.

O desenho proposto estabelece:

- fontes canônicas;
- projeções de leitura;
- prontidão categórica;
- restrições como autoridade;
- subdomínios claros;
- comandos explícitos;
- autorização granular;
- auditoria estrutural;
- coexistência segura;
- integração incremental;
- separação entre gestão Web e execução Mobile.

A arquitetura não autoriza implementação imediata.

Ela cria o contrato necessário para que a implementação futura seja intencional, testável, auditável e alinhada ao Centro de Prontidão Operacional K9.
