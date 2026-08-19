# K9 Ops Web — Health Web v1 Baseline Oficial

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_BASELINE.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Baseline documental, arquitetural e de produto |
| Repositório Web | `github.com/jillohh-arch/k9-ops` |
| Autoridade de domínio | Health v1.0 Mobile/Backend aprovado |
| Auditoria de origem | `HEALTH_WEB_CURRENT_STATE_AUDIT.md` |

---

## 1. Propósito

Este documento estabelece o ponto de partida oficial para a construção do **Health Web v1** do K9 Ops.

A baseline existe para impedir que:

- código antigo seja promovido por inércia;
- telas experimentais sejam interpretadas como requisito de produto;
- heurísticas locais sejam confundidas com contratos canônicos;
- dados antigos sejam descartados sem auditoria;
- responsabilidades do Mobile sejam duplicadas na Web;
- a gestão de Plano Alimentar seja perdida durante a reorganização;
- decisões arquiteturais sejam tomadas diretamente no código;
- branches divergentes sejam integradas por merge improvisado.

A baseline responde:

> Qual é a verdade oficial a partir da qual o Health Web v1 será projetado, implementado, testado e homologado?

---

## 2. Natureza desta baseline

### 2.1 O que esta baseline é

Esta é uma baseline:

- documental;
- arquitetural;
- semântica;
- de responsabilidade entre plataformas;
- de classificação do legado;
- de proteção dos ativos canônicos;
- de restrição para futuras implementações.

Ela fixa as decisões já conhecidas e determina quais evidências podem ou não orientar o novo módulo.

### 2.2 O que esta baseline ainda não é

Esta baseline não constitui, por si só:

- tag Git;
- branch congelada;
- snapshot executável;
- aprovação do código atual de Saúde;
- aprovação das Firestore Rules versionadas no repositório Web;
- confirmação do estado real do Firestore de produção;
- confirmação do estado real das Cloud Functions;
- confirmação de índices implantados;
- confirmação de que testes, lint, typecheck ou build estão verdes;
- autorização para implementar telas ou mutações.

Uma baseline executável de repositório somente poderá ser criada após:

1. conclusão do pacote documental mínimo;
2. preflight técnico no repositório Web;
3. reconciliação das branches relevantes;
4. confirmação da autoridade de Rules e Functions;
5. validação humana do escopo;
6. commit documental intencional;
7. eventual tag de referência.

### 2.3 Regra de interpretação

Os SHAs registrados neste documento representam o estado observado durante a auditoria de 2026-07-30.

Eles são evidência histórica e não garantem que as branches permaneçam nesses commits.

---

## 3. Identificação do estado auditado

| Item | Referência observada |
|---|---|
| Repositório | `github.com/jillohh-arch/k9-ops` |
| Branch principal | `master` |
| HEAD principal observado | `68be9bac2ef8d2b5b8bc105f8bfc4181802c0214` |
| Branch de Nutrição | `feature/health-web-nutrition` |
| HEAD de Nutrição observado | `be9f0887e2b1f9c3789ef527e103911ad8f44e81` |
| Relação observada | branches divergentes |
| Auditoria | estática e somente leitura |
| Worktree local | não inspecionado |
| Firestore real | não inspecionado |
| Functions implantadas | não auditadas diretamente |
| Rules implantadas | não auditadas diretamente |
| Build/lint/typecheck/test | não executados nesta etapa |

### 3.1 Consequência

Nenhum comportamento encontrado no código Web deve ser promovido a contrato oficial apenas porque está presente em `master`.

Da mesma forma, nenhuma capacidade da branch de Nutrição deve ser considerada integrada ao produto principal apenas porque está implementada na branch funcional.

---

## 4. Declaração oficial de contexto

O responsável pelo produto declarou que:

> A criação e gestão do Plano Alimentar foi a única funcionalidade de Saúde Web desenvolvida após o início do Health Foundation Mobile. O restante da Saúde Web foi criado anteriormente, sem planejamento canônico, não está sendo utilizado atualmente e não deve limitar a nova arquitetura.

Esta declaração faz parte da baseline.

### 4.1 Efeito da declaração

A Saúde Web existente é dividida em duas naturezas diferentes:

1. **Plano Alimentar pós-Foundation**  
   Capacidade canônica, intencional e preservável.

2. **Saúde Web pré-Foundation**  
   Implementação experimental, sem adoção operacional e sem obrigação de compatibilidade funcional ou visual.

### 4.2 Regra cardinal

```text
Código existente
não equivale a
requisito aprovado.
```

### 4.3 Outra distinção obrigatória

```text
Interface sem uso
não equivale a
coleção vazia
não equivale a
código sem dependências
não equivale a
dado descartável.
```

A liberdade para redesenhar a experiência não autoriza exclusão de dados sem inventário e decisão explícita.

---

## 5. Hierarquia de autoridade

Quando houver conflito entre documentos, código, interface ou comportamento legado, a seguinte precedência deverá ser aplicada.

| Prioridade | Autoridade |
|---:|---|
| 1 | Decisões humanas expressamente aprovadas para o Health v1 |
| 2 | ADRs canônicas do Health v1.0 |
| 3 | Políticas, domain model, schema, capabilities e contratos aprovados do Mobile/Backend |
| 4 | Contratos cross-platform formalmente reconciliados |
| 5 | Implementação canônica de Plano Alimentar Web |
| 6 | Nova documentação específica do Health Web aprovada |
| 7 | Código pré-Foundation potencialmente reaproveitável |
| 8 | Comportamentos visuais ou heurísticas existentes no legado |

### 5.1 Regra de conflito

Se uma implementação Web antiga contradizer um contrato canônico, o contrato canônico prevalece.

Se a branch de Nutrição contradizer um contrato cross-platform posterior, a reconciliação mais recente prevalece.

Se o repositório Web possuir Rules divergentes da autoridade oficial de backend, as Rules do repositório Web não poderão ser usadas como verdade de produção sem verificação.

---

## 6. Conjunto documental de autoridade

A fundação do Health Web v1 deriva, entre outros, dos seguintes documentos do Health v1.0:

| Documento | Papel na baseline Web |
|---|---|
| `HEALTH_V1_ARCHITECTURE.md` | define o Centro de Prontidão K9 e os princípios gerais |
| `HEALTH_IMPLEMENTATION_ROADMAP.md` | fornece a decomposição original do domínio |
| `HEALTH_MODULE_AUDIT.md` | registra o estado histórico do módulo Mobile |
| `HEALTH_V1_DOMAIN_MODEL.md` | define entidades, agregados e vocabulário |
| `HEALTH_V1_FIRESTORE_SCHEMA.md` | define caminhos e contratos persistidos |
| `HEALTH_V1_PERMISSION_MATRIX.md` | define autorização por domínio e operação |
| `HEALTH_V1_CAPABILITIES_INVENTORY.md` | inventaria capabilities e limitações reais |
| `HEALTH_V1_READINESS_POLICY.md` | define a política oficial de prontidão |
| `HEALTH_V1_MIGRATION_PLAN.md` | define preservação, coexistência e backfill |
| `HEALTH_V1_TEST_STRATEGY.md` | define níveis de teste e gates |
| `HEALTH_V1_FOUNDATION_REVIEW.md` | consolida a revisão da fundação |
| `ADR-001-HEALTH-DOMAIN-BOUNDARIES.md` | delimita o domínio Health |
| `ADR-002-CLINICAL-EVENTS-AND-IMMUTABILITY.md` | fixa imutabilidade e amendment |
| `ADR-003-CLINICAL-CASE-WORKFLOW.md` | define casos clínicos e lifecycle |
| `ADR-004-TIMELINE-SUMMARY-AND-PROJECTIONS.md` | define timeline, summary e projections |
| `ADR-005-READINESS-AND-RESTRICTIONS.md` | fixa decisão operacional e restrições |
| `ADR-006-LEGACY-COEXISTENCE-AND-MIGRATION.md` | fixa coexistência e migração |
| `ADR-007-HEALTH-INTERNAL-ORGANIZATION.md` | orienta organização interna do módulo |

### 6.1 Documento Web de origem

O documento diretamente anterior a esta baseline é:

```text
HEALTH_WEB_CURRENT_STATE_AUDIT.md
```

A auditoria constitui a evidência do estado encontrado. Esta baseline transforma essa evidência em restrições oficiais de programa.

---

## 7. Classificação oficial dos ativos atuais

### 7.1 Matriz principal

| Ativo atual | Classificação | Tratamento |
|---|---|---|
| Gestão Web de Plano Alimentar | Canônico pós-Foundation | Preservar e integrar |
| Contratos cross-platform de NutritionPlan | Canônico | Preservar e reconciliar |
| Capabilidade `health.manage_nutrition_plan` | Canônica no escopo de Nutrição | Preservar |
| Callables canônicas de NutritionPlan | Canônicas | Preservar e validar |
| Testes da branch de Nutrição | Ativo técnico relevante | Preservar e executar após reconciliação |
| Dashboard `/health` de `master` | Pré-Foundation experimental | Substituição livre |
| Índice de saúde/prontidão atual | Heurística não canônica | Descontinuar como prontidão |
| Prontuário atual dentro de `/k9/{dogId}` | Pré-Foundation experimental | Reavaliar do zero |
| HealthEventHub genérico | Pré-Foundation | Não promover sem redesenho |
| Readers de `health_logs` e `health_events` | Legado/inventário técnico | Isolar e auditar |
| `weight_records` | Fonte potencialmente reutilizável | Reconciliar com schema canônico |
| `documentos` e documentos por K9 | Legado/ambíguo | Auditar dados e autoridade |
| Campos `_last_*` no documento `dogs` | Projeção antiga não autoritativa | Planejar retirada |
| Relatórios de Saúde atuais | Pré-Foundation | Reavaliar requisitos |
| Permissões genéricas `health.view/create/edit/...` | Fundação insuficiente | Evoluir para capabilities granulares |
| Rules do espelho Web | Evidência local potencialmente divergente | Não tratar como autoridade de produção |

### 7.2 Classes permitidas nos próximos documentos

Todo ativo deverá ser marcado como uma destas classes:

| Classe | Definição |
|---|---|
| Canônico | aderente aos contratos aprovados |
| Compatível | não canônico por origem, mas reutilizável sem alterar semântica |
| Adaptável | pode ser reaproveitado após refatoração controlada |
| Legado preservado | necessário para histórico ou coexistência |
| Experimental descartável | sem compromisso de continuidade |
| Planejado | ainda não implementado |
| Desconhecido | exige auditoria adicional |

---

## 8. Ativo canônico preservado: Plano Alimentar

### 8.1 Status na baseline

A gestão Web de Plano Alimentar é o primeiro submódulo oficial do Health Web v1.

Ela não deverá ser reimplementada do zero sem justificativa técnica aprovada.

### 8.2 Princípio preservado

```text
WEB DEFINE E ADMINISTRA
MOBILE CONSULTA, EXECUTA E REGISTRA FATOS
BACKEND VALIDA, TRANSA, PROJETA E AUDITA
```

### 8.3 Capacidades que devem sobreviver à integração

- leitura coordenada de plano canônico e fontes legadas;
- estado fail-closed quando houver conflito;
- capability dedicada;
- criação e ativação canônica;
- atualização administrativa permitida;
- substituição para mudanças estruturais;
- cancelamento explícito;
- revisionamento;
- idempotência por `operationId`;
- receipt durável;
- auditoria;
- estados de loading, empty, canonical, legacy, degraded, error e conflict;
- testes de contrato e componentes;
- reconciliação com o Mobile.

### 8.4 Itens que ainda precisam de reconciliação

- divergência entre `master` e `feature/health-web-nutrition`;
- integração com o novo shell Health;
- remoção de mensagens visuais desatualizadas;
- execução da suíte completa após atualização da branch;
- confirmação da versão de Functions implantada;
- confirmação das Rules e índices de produção;
- confirmação de que o plano canônico ativo permanece válido no ambiente-alvo;
- integração com readiness e summaries, quando contratada.

### 8.5 Regra de integração

A branch de Nutrição não será incorporada por merge cego.

A integração deverá ocorrer por plano próprio, com:

1. preflight;
2. atualização em relação à branch principal;
3. inventário de conflitos;
4. preservação explícita dos contratos canônicos;
5. adaptação ao novo shell;
6. execução de testes;
7. validação de backend;
8. homologação humana;
9. commit intencional.

---

## 9. Baseline do legado pré-Foundation

### 9.1 Status

O código anterior ao Health Foundation:

- não é baseline funcional;
- não é baseline de UX;
- não é baseline de navegação;
- não é baseline de prontidão;
- não é baseline de permissão;
- não é baseline de mutação clínica;
- não deve receber expansão funcional.

### 9.2 Uso permitido

Esse código poderá ser usado como:

- inventário de integrações;
- referência de componentes visuais;
- referência de padrões da aplicação Web;
- fonte para identificar queries existentes;
- fonte para localizar dados históricos;
- material para medir riscos de regressão;
- candidato a reaproveitamento técnico.

### 9.3 Uso proibido

Não será permitido:

- copiar suas regras de prontidão para a nova UI;
- manter um score como decisor operacional;
- assumir que ausência de dado significa normalidade;
- promover eventos genéricos mutáveis a eventos clínicos canônicos;
- manter writes diretos apenas porque já existem;
- modelar novas capabilities a partir das permissões genéricas atuais;
- preservar uma rota ou tela somente por compatibilidade visual;
- excluir dados porque a interface não é usada.

### 9.4 Regra de substituição

A experiência pré-Foundation possui **substituição livre**, desde que:

- dados sejam preservados;
- dependências sejam auditadas;
- nenhuma integração externa seja quebrada sem plano;
- readers antigos sejam removidos apenas após ausência comprovada de consumidores;
- rollback seja definido quando houver alteração operacional.

---

## 10. Baseline de dados

### 10.1 Estado conhecido

O código Web observado acessa, entre outras, as seguintes fontes:

```text
dogs
health_logs
documentos
dogs/{dogId}/health_events
dogs/{dogId}/weight_records
dogs/{dogId}/documents
dogs/{dogId}/nutrition_plans
dogs/{dogId}/nutritional_prescriptions
dogs/{dogId}/nutrition_prescriptions
```

Também utiliza campos denormalizados no documento do K9, incluindo projeções `_last_*`.

### 10.2 Estado desconhecido

A baseline não afirma:

- quantos documentos existem em cada fonte;
- quais coleções contêm dados reais;
- quais contêm somente testes;
- quais schemas divergentes estão presentes;
- quais readers externos ainda dependem dessas fontes;
- se existem documentos duplicados;
- se arquivos de Storage continuam referenciados;
- se algum dado possui valor probatório ou administrativo.

### 10.3 Política de preservação

Até a auditoria real de dados:

- nenhuma coleção será apagada;
- nenhuma subcoleção será renomeada destrutivamente;
- nenhum documento será atualizado em massa;
- nenhum arquivo será excluído do Storage;
- nenhum campo legado será removido de `dogs`;
- nenhuma Rule será fechada sem análise de consumidores;
- nenhuma migração será executada.

### 10.4 Regra de autoridade

Coleções legadas podem ser fontes históricas, mas não devem decidir prontidão, restrições ou autorização operacional no novo sistema.

### 10.5 Próxima evidência necessária

Deverá existir uma fase somente leitura para produzir:

```text
HEALTH_WEB_DATA_INVENTORY_REPORT.md
```

O inventário deverá conter:

- contagem por collection e por K9;
- amostra de schemas;
- documentos fora do padrão;
- duplicidades;
- referências a Storage;
- presença de dados reais;
- dependências identificadas;
- proposta de destino para cada fonte.

---

## 11. Baseline de prontidão operacional

### 11.1 Fonte oficial

A prontidão exibida pela Web deverá derivar do contrato canônico de readiness e de suas fontes autoritativas.

A Web não calculará prontidão decisória por heurísticas próprias.

### 11.2 Estados oficiais

Somente os seguintes estados clínico-operacionais poderão ser exibidos como prontidão:

| Enum | Label oficial | Semântica resumida |
|---|---|---|
| `operational` | Operacional | apto sem ressalvas |
| `operational_attention` | Operacional com Atenção | apto, com ponto de atenção |
| `fit_with_restrictions` | Apto com Restrições | apto apenas fora das atividades restritas |
| `temporarily_unfit` | Temporariamente Inapto | bloqueio operacional total temporário |
| `not_evaluated` | Não Avaliado | ausência de avaliação suficiente |

### 11.3 Regras fixas

- nenhum sexto estado será criado;
- nenhum score numérico substituirá esses estados;
- ausência de dados não produzirá estado positivo;
- restrição absoluta prevalece sobre qualquer indicador;
- restrição parcial prevalece sobre atenção;
- atenção não equivale a bloqueio;
- dados incompletos são tratados segundo política configurável;
- decisão operacional deverá ser produzida no Backend;
- a Web exibirá origem, atualização e motivo quando disponíveis.

### 11.4 Tratamento do indicador atual

O indicador atual denominado índice de saúde/prontidão:

- não é canônico;
- não poderá conservar esse nome no novo módulo;
- não poderá autorizar operação;
- não poderá ocultar restrições;
- poderá, se houver valor aprovado, ser transformado em métrica não decisória de cobertura de evidências.

Essa transformação exige decisão humana específica.

### 11.5 Estados técnicos

Estados técnicos da UI serão separados da prontidão:

```text
loading
empty
error
partial
degraded
stale
legacy
conflict
```

Um estado técnico nunca será convertido silenciosamente em `operational`.

---

## 12. Baseline de responsabilidades entre plataformas

### 12.1 Web

A Web será orientada a:

- gestão;
- planejamento;
- supervisão;
- consulta ampliada;
- análise;
- auditoria;
- relatórios;
- configuração autorizada;
- administração de planos e protocolos quando contratada;
- transcrição administrativa somente quando expressamente aprovada.

### 12.2 Mobile

O Mobile será orientado a:

- execução em campo;
- registro rápido de fatos operacionais;
- consulta operacional;
- registro contextual no momento da ação;
- operação com conectividade limitada quando suportado;
- experiência adequada ao condutor.

### 12.3 Backend

O Backend será autoridade para:

- validações invariantes;
- mutações compostas;
- idempotência;
- revisão;
- projections;
- summaries;
- cálculo de prontidão;
- lifecycle de restrições;
- auditoria;
- bloqueios;
- reconciliação de concorrência;
- receipts operacionais.

### 12.4 Regra de fronteira

Nenhuma operação será atribuída à Web somente porque é tecnicamente possível executá-la no navegador.

A atribuição dependerá de:

- responsabilidade operacional;
- risco;
- autoria;
- necessidade de contexto de campo;
- necessidade de profissional habilitado;
- política de auditoria;
- contrato de domínio;
- capability aprovada.

---

## 13. Baseline de mutações

### 13.1 Princípio

O Health Web v1 nascerá **read-first**.

A fundação inicial deverá priorizar readers, summaries, projections, estados técnicos e drill-down antes de adicionar novas mutações.

### 13.2 Condições mínimas para uma mutação Web

Nenhuma nova mutação poderá ser conectada antes de existir:

1. decisão de responsabilidade Web;
2. contrato de domínio aprovado;
3. capability dedicada ou mapeamento autorizado;
4. callable ou backend autoritativo;
5. validação server-side;
6. trilha de auditoria;
7. política de idempotência;
8. política de concorrência/revisionamento;
9. Rules reconciliadas;
10. testes unitários;
11. testes de integração;
12. testes de Rules;
13. validação por emuladores;
14. homologação humana.

### 13.3 Eventos clínicos

Eventos clínicos canônicos deverão respeitar:

- imutabilidade;
- correção por amendment;
- autoria rastreável;
- caso clínico quando aplicável;
- separação entre fato, interpretação e impacto operacional;
- anexos com provenance;
- auditoria completa.

### 13.4 Writes existentes

Os writes genéricos encontrados em `master` não estão aprovados como modelo futuro.

Eles deverão ser:

- congelados quanto à expansão;
- inventariados;
- classificados por responsabilidade;
- mantidos somente enquanto necessários;
- substituídos por domínio e capability;
- removidos apenas após migração ou encerramento controlado.

---

## 14. Baseline de permissões

### 14.1 Estado atual

O modelo genérico observado em `master` utiliza ações como:

```text
view
create
edit
archive
approve
export
audit
```

Esse modelo é insuficiente para representar todo o Health v1.

### 14.2 Direção oficial

O Health Web v1 adotará capabilities granulares por intenção e domínio.

Exemplos conceituais:

```text
health.view_summary
health.view_readiness
health.view_clinical_cases
health.view_sensitive_documents
health.manage_preventive_schedule
health.manage_nutrition_plan
health.manage_clinical_case
health.record_clinical_amendment
health.manage_restrictions
health.export_health_reports
health.audit_health
```

Os nomes finais dependerão do inventário e da matriz oficial.

### 14.3 Regra de segurança

Não haverá fallback automático de uma capability sensível para uma permissão genérica como `health.edit`.

### 14.4 Estado preservado

A capability já utilizada pela gestão de Plano Alimentar deverá ser preservada, salvo renomeação formal e migração de claims autorizada.

---

## 15. Baseline de navegação e arquitetura da informação

### 15.1 Princípio

A Web não replicará a navegação do Mobile.

Ela deverá representar a visão gerencial global do canil e oferecer drill-down individual por K9.

### 15.2 Estrutura preliminar protegida

A baseline reserva, para detalhamento posterior, as seguintes áreas:

```text
Saúde
├── Visão Geral
├── Prontidão
├── Agenda Preventiva
├── Clínico
├── Nutrição
├── Histórico
└── Relatórios
```

### 15.3 Rotas preliminares

```text
/health
/health/readiness
/health/schedule
/health/clinical
/health/nutrition
/health/history
/health/reports
/health/dogs/{dogId}
```

Essas rotas ainda não constituem contrato final. O documento `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` deverá confirmar ou alterar a estrutura.

### 15.4 Restrições

Antes da aprovação da arquitetura da informação:

- não serão criadas novas rotas funcionais;
- não serão produzidos mockups definitivos;
- não será adaptada a Nutrição ao shell antigo;
- não serão adicionadas abas por conveniência;
- não será duplicado o prontuário em dois locais sem decisão explícita.

---

## 16. Baseline de arquitetura interna

A implementação futura deverá:

- usar organização feature-first coerente com o repositório Web;
- separar apresentação, leitura, mutação e contratos;
- evitar páginas monolíticas;
- evitar acesso Firestore espalhado em componentes;
- usar readers por subdomínio;
- distinguir modelos persistidos de view models;
- tratar projections como contratos próprios;
- centralizar capabilities;
- centralizar estados de carregamento e erro;
- suportar cancelamento e cleanup de listeners;
- limitar agregação client-side;
- permitir paginação;
- suportar testes sem Firebase real;
- preservar acessibilidade e responsividade;
- preparar desktop e tablet;
- evitar dependência circular entre Health e perfil K9.

A forma exata será definida em ADR própria.

---

## 17. Baseline de Rules, Functions e autoridade operacional

### 17.1 Rules

As Rules versionadas no repositório Web não serão consideradas autoridade de produção até reconciliação com o repositório e pipeline responsáveis pelo backend.

### 17.2 Functions

A existência de wrapper cliente não comprova:

- deploy atual;
- versão implantada;
- região correta;
- contrato atual;
- compatibilidade com Rules;
- compatibilidade com o Mobile.

### 17.3 Regra de ativação

Nenhuma tela mutável será ativada em produção apenas porque a callable existe no cliente.

A ativação exige evidência end-to-end.

### 17.4 Projections

Campos `_last_*` atualizados pelo cliente em modo best-effort não poderão permanecer como projeção autoritativa no Health Web v1.

Projections oficiais deverão ser produzidas e versionadas pelo Backend.

---

## 18. Baseline de coexistência e migração

### 18.1 Estratégia

A migração será:

```text
livre na experiência;
conservadora com dados;
gradual nas mutações;
explícita na coexistência;
fail-closed em conflitos;
auditável no cutover.
```

### 18.2 Ordem mínima

1. congelar a autoridade do legado;
2. inventariar dados reais;
3. aprovar arquitetura e contratos Web;
4. criar readers canônicos;
5. construir nova fundação read-only;
6. integrar a Nutrição;
7. adicionar mutações por domínio;
8. migrar ou arquivar dados antigos;
9. desativar readers legados;
10. remover código sem consumidores.

### 18.3 Proibição de rewrite destrutivo

Não será permitido substituir a interface e apagar simultaneamente as fontes antigas.

A substituição visual e a migração de dados são decisões separadas.

### 18.4 Fail-closed

Quando houver conflito entre fontes canônicas e legadas, a interface deverá:

- tornar o conflito visível;
- bloquear ação dependente quando necessário;
- não escolher silenciosamente uma fonte;
- fornecer caminho de resolução autorizado;
- registrar telemetry/auditoria quando aplicável.

---

## 19. Riscos aceitos como parte da baseline

| ID | Risco | Tratamento obrigatório |
|---|---|---|
| `R-WEB-001` | prontidão atual não canônica | substituir por projection autoritativa |
| `R-WEB-002` | ausência interpretada como normalidade | estados explícitos e fail-closed |
| `R-WEB-003` | eventos clínicos mutáveis | imutabilidade e amendment |
| `R-WEB-004` | writes fora da fronteira Web | matriz Web × Mobile × Backend |
| `R-WEB-005` | projections client-side | mover autoridade ao Backend |
| `R-WEB-006` | agregação não escalável | summaries, readers e paginação |
| `R-WEB-007` | permissões amplas | capabilities granulares |
| `R-WEB-008` | contratos concorrentes de documentos | inventário e unificação |
| `R-WEB-009` | divergência entre branches/repositórios | plano de reconciliação |
| `R-WEB-010` | perda de dados no redesenho | inventário e migração conservadora |
| `R-WEB-011` | merge inadequado da Nutrição | integração por gate próprio |
| `R-WEB-012` | monólito de apresentação | nova arquitetura interna |

Nenhum desses riscos será tratado como justificativa para iniciar implementação sem documentação.

---

## 20. Decisões fixadas por esta baseline

As seguintes decisões passam a ser restrições oficiais para os próximos documentos:

1. O Health Web v1 será um **Centro de Gestão e Prontidão K9**.
2. A Saúde Web pré-Foundation não é baseline funcional.
3. A experiência antiga não possui obrigação de compatibilidade.
4. Dados antigos serão preservados até auditoria e decisão de migração.
5. O Plano Alimentar é o primeiro submódulo Web canônico.
6. A branch de Nutrição será integrada por fase própria.
7. A Web não copiará o Mobile.
8. O Mobile continuará orientado à execução e ao registro em campo.
9. A Web será orientada à gestão, supervisão, planejamento, análise, auditoria e relatórios.
10. O Backend decidirá prontidão e manterá projections autoritativas.
11. A prontidão terá exatamente cinco estados oficiais.
12. Nenhum score numérico será decisor operacional.
13. Estados técnicos serão separados de estados operacionais.
14. Eventos clínicos canônicos serão imutáveis.
15. Correções clínicas ocorrerão por amendment.
16. Permissões sensíveis usarão capabilities granulares.
17. A nova fundação será read-first.
18. Writes serão introduzidos por domínio e por gate.
19. Mockups definitivos dependerão de arquitetura da informação aprovada.
20. Nenhuma implementação funcional começará antes do pacote documental mínimo.

---

## 21. Decisões ainda não fixadas

Permanecem pendentes de decisão humana:

1. A Web poderá registrar pesagens?
2. A Web poderá transcrever procedimentos preventivos realizados fora do Mobile?
3. A Web poderá concluir itens da Agenda Preventiva?
4. Quais perfis verão conteúdo clínico completo?
5. Quais perfis verão documentos sensíveis?
6. Quem poderá criar, revisar e encerrar restrições?
7. Quem poderá criar amendments?
8. Haverá identidade própria para profissionais veterinários externos?
9. Qual será a relação entre `/k9/{dogId}` e `/health/dogs/{dogId}`?
10. Relatórios de Saúde ficarão dentro do módulo ou na central global?
11. A métrica de cobertura de evidências terá valor de produto?
12. Quais thresholds preventivos e de completude serão aprovados?
13. Qual será o destino de cada fonte documental legada?
14. Em qual gate ocorrerá a reconciliação final da branch de Nutrição?
15. Quais mutações administrativas serão permitidas na primeira versão Web?

Essas questões deverão ser resolvidas nos documentos e ADRs apropriados, não diretamente durante a codificação.

---

## 22. Escopos explicitamente fora desta baseline

Não fazem parte desta etapa:

- implementação de rotas;
- refatoração de componentes;
- alteração do App Shell;
- criação de mockups;
- merge da branch de Nutrição;
- alteração de Firestore Rules;
- alteração de índices;
- alteração de Functions;
- deploy;
- migração de dados;
- limpeza de Storage;
- criação de capabilities;
- alteração de claims;
- criação de dashboards em produção;
- definição do IPO numérico;
- uso de IA clínica;
- OCR de documentos;
- integração com clínicas externas;
- integração com estoque veterinário;
- Health v2.

---

## 23. Gates antes da primeira implementação funcional

### Gate D1 — Fundação documental mínima

Devem estar aprovados:

- `HEALTH_WEB_CURRENT_STATE_AUDIT.md`;
- `HEALTH_WEB_BASELINE.md`;
- `HEALTH_WEB_TARGET_ARCHITECTURE.md`;
- `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`;
- `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`;
- `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`.

### Gate D2 — Contratos e segurança

Devem estar aprovados:

- data source matrix;
- capabilities inventory;
- permission matrix;
- readiness policy Web;
- write boundaries;
- coexistence/migration plan;
- test strategy.

### Gate T1 — Preflight técnico

Deverá confirmar:

- branch e HEAD;
- divergência com origin;
- working tree;
- estado de dependências;
- build;
- lint;
- typecheck;
- testes;
- branches relacionadas;
- autoridade de Rules/Functions;
- baseline de performance relevante.

### Gate T2 — Plano de integração

Deverá existir plano aprovado para:

- shell Health;
- readers canônicos;
- prontidão;
- agenda;
- Nutrição;
- legado;
- rollback.

### Gate H1 — Aprovação humana

A implementação somente poderá iniciar após decisão explícita do responsável pelo produto.

---

## 24. Critérios de aprovação desta baseline

Este documento poderá ser marcado como aprovado quando houver concordância humana de que:

- a natureza documental da baseline está correta;
- os SHAs são apenas referências observadas;
- Plano Alimentar é o único submódulo Web pós-Foundation;
- o restante do código de Saúde é experimental e sem uso operacional;
- a experiência antiga pode ser substituída livremente;
- dados antigos não podem ser descartados sem auditoria;
- prontidão será autoritativa e server-side;
- os cinco estados oficiais estão preservados;
- a divisão Web × Mobile × Backend está correta;
- a branch de Nutrição exige integração controlada;
- capabilities granulares serão necessárias;
- a estratégia read-first está aprovada;
- nenhum código funcional deve ser escrito antes da fundação documental.

---

## 25. Controle de mudança

Após aprovação, qualquer alteração em uma decisão fixada nesta baseline deverá:

1. indicar a decisão afetada;
2. apresentar justificativa;
3. identificar documentos dependentes;
4. avaliar impacto em Mobile, Web e Backend;
5. avaliar impacto em dados e migração;
6. avaliar impacto em permissões;
7. registrar a mudança em ADR quando arquitetural;
8. receber aprovação humana;
9. atualizar a versão deste documento.

Mudanças silenciosas no código não alteram a baseline.

---

## 26. Pacote documental derivado

Após esta baseline, o programa deverá produzir:

1. `HEALTH_WEB_TARGET_ARCHITECTURE.md`
2. `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`
3. `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md`
4. `HEALTH_WEB_DATA_SOURCE_MATRIX.md`
5. `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`
6. `HEALTH_WEB_CAPABILITIES_INVENTORY.md`
7. `HEALTH_WEB_PERMISSION_MATRIX.md`
8. `HEALTH_WEB_READINESS_POLICY.md`
9. `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`
10. `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`
11. `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md`
12. `HEALTH_WEB_TEST_STRATEGY.md`
13. `HEALTH_WEB_MOCKUP_PLAN.md`

ADRs previstas:

```text
ADR-WEB-001-HEALTH-INFORMATION-ARCHITECTURE.md
ADR-WEB-002-MOBILE-WEB-RESPONSIBILITY-BOUNDARIES.md
ADR-WEB-003-READINESS-SOURCE-OF-TRUTH.md
ADR-WEB-004-LEGACY-COEXISTENCE.md
ADR-WEB-005-HEALTH-WEB-WRITE-BOUNDARIES.md
ADR-WEB-006-NUTRITION-BRANCH-INTEGRATION.md
ADR-WEB-007-HEALTH-WEB-INTERNAL-ORGANIZATION.md
```

---

## 27. Próximo documento

O próximo documento recomendado é:

```text
HEALTH_WEB_TARGET_ARCHITECTURE.md
```

Ele deverá definir:

- objetivos arquiteturais;
- contextos e subdomínios;
- fronteiras Web × Mobile × Backend;
- camadas da aplicação Web;
- readers, commands, projections e summaries;
- arquitetura de prontidão;
- arquitetura de agenda;
- arquitetura clínica;
- integração da Nutrição;
- tratamento do legado;
- segurança, auditoria, performance e observabilidade;
- princípios de organização interna;
- restrições para a arquitetura da informação.

---

## 28. Conclusão

O ponto de partida oficial do Health Web v1 não é a interface atualmente presente em `master`.

O ponto de partida é o domínio canônico do Health v1.0, acrescido da gestão Web de Plano Alimentar já desenvolvida após o Foundation.

A implementação antiga permanece relevante como inventário técnico e possível fonte de dados históricos, mas não governa o novo produto.

A baseline pode ser resumida em seis regras:

```text
1. O domínio aprovado governa o código.
2. Plano Alimentar é preservado.
3. O restante da UI pode ser substituído.
4. Dados antigos não são descartados sem auditoria.
5. Prontidão é autoritativa, não heurística.
6. A implementação começa somente após a fundação documental.
```
