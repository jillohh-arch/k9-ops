# K9 Ops Web — Auditoria do Estado Atual do Módulo Saúde

**Programa:** Health Web Evolution Program  
**Documento:** `HEALTH_WEB_CURRENT_STATE_AUDIT.md`  
**Data da auditoria:** 2026-07-30  
**Repositório auditado:** `github.com/jillohh-arch/k9-ops`  
**Branch principal observada:** `master`  
**HEAD principal observado:** `68be9bac2ef8d2b5b8bc105f8bfc4181802c0214`  
**Branch funcional de Nutrição observada:** `feature/health-web-nutrition`  
**HEAD de Nutrição observado:** `be9f0887e2b1f9c3789ef527e103911ad8f44e81`  
**Modo:** auditoria estática e somente leitura  
**Status:** primeira versão para revisão humana  
**Autoridade documental:** ADRs e contratos aprovados do Health v1.0 Mobile/Backend

---

## 1. Declaração de contexto operacional

Esta auditoria parte de uma decisão de produto fornecida pelo responsável pelo K9 Ops:

> A gestão Web de Plano Alimentar foi a única funcionalidade de Saúde desenvolvida após o início do Health v1 Foundation Mobile. O restante da Saúde Web foi criado anteriormente, sem planejamento canônico, não possui adoção operacional atual e não deve ser considerado baseline funcional do Health v1.0.

Essa declaração altera a interpretação do código existente.

A implementação atual não será tratada como um produto em produção que precise manter sua navegação, seus fluxos ou sua semântica visual. Ela será tratada como um inventário técnico pré-Foundation do qual alguns componentes, padrões ou consultas poderão ser reaproveitados seletivamente.

A exceção é a gestão canônica de Plano Alimentar, que será tratada como capacidade válida, intencional e alinhada ao Health v1.0.

### 1.1 Classificação oficial

| Grupo | Classificação | Tratamento no Health Web v1 |
|---|---|---|
| Gestão de Plano Alimentar | Pós-Foundation, canônica e intencional | Preservar, reconciliar e integrar |
| Dashboard geral de Saúde atual | Pré-Foundation, experimental e sem adoção operacional | Substituição livre |
| Prontuário Web atual | Pré-Foundation, experimental e sem adoção operacional | Reavaliar do zero |
| Formulários genéricos de eventos | Pré-Foundation e semanticamente incompatíveis com parte do domínio aprovado | Não assumir continuidade |
| Leitores e agregadores existentes | Inventário técnico | Reaproveitar apenas mediante aderência ao contrato canônico |
| Dados legados eventualmente existentes | Estado ainda não auditado | Preservar até auditoria de dados e decisão de migração |
| Regras, índices e contratos antigos | Estado potencialmente divergente | Não considerar autoridade sem reconciliação |

### 1.2 Consequência arquitetural

O objetivo do programa não é modernizar a interface antiga.

O objetivo é:

> Construir a versão Web oficial do Health v1.0 como Centro de Gestão e Prontidão K9, preservando a gestão canônica de Plano Alimentar e reaproveitando somente elementos legados comprovadamente compatíveis.

---

## 2. Resumo executivo

O repositório Web já contém uma área de Saúde tecnicamente relevante, composta por dashboard, indicadores, prontuário individual, registro genérico de eventos, documentos, relatórios e permissões genéricas. Também existe uma branch separada com uma implementação muito mais madura de gestão de Plano Alimentar.

Apesar da quantidade de código existente, a área presente em `master` não implementa o domínio canônico do Health v1.0.

Os principais desalinhamentos são:

- o chamado índice ou estado de prontidão é calculado no cliente por heurísticas próprias baseadas principalmente em vacinação, peso e exames;
- não há consumo do resumo canônico `health_summary` nem do lifecycle oficial de prontidão;
- não há representação adequada das cinco classificações operacionais aprovadas;
- restrições clínicas não participam da decisão operacional exibida;
- eventos clínicos genéricos podem ser tratados como registros editáveis, divergindo da política de imutabilidade e amendment;
- a Web atual registra fatos operacionais que, no modelo alvo, pertencem prioritariamente ao Mobile ou a fluxos administrativos especificamente autorizados;
- a agregação é feita majoritariamente no cliente a partir de coleções heterogêneas e campos denormalizados antigos;
- as permissões de `master` são genéricas por módulo e ação, insuficientes para os domínios clínicos e gerenciais aprovados;
- a arquitetura de navegação reduz toda a Saúde a uma única rota principal e a abas dentro do perfil do K9;
- não existe uma separação clara entre prontidão, agenda preventiva, casos clínicos, tratamentos, exames, restrições, timeline, nutrição, auditoria e relatórios.

A branch `feature/health-web-nutrition` constitui a exceção positiva. Ela implementa a responsabilidade canônica da Web de definir e administrar planos alimentares, utiliza capabilities dedicadas, callables, idempotência por `operationId`, coexistência fail-closed e estados explícitos de leitura.

### 2.1 Conclusão principal

A Saúde Web pode ser redesenhada com liberdade funcional e visual porque a interface pré-Foundation não possui adoção operacional atual.

Essa liberdade não autoriza apagar dados ou contratos sem auditoria. A distinção obrigatória é:

```text
interface antiga sem uso
≠
código sem dependências
≠
coleção vazia
≠
dado descartável
```

A migração deverá ser conservadora com dados e livre com experiência de usuário.

---

## 3. Objetivos da auditoria

Esta auditoria busca responder:

1. O que existe hoje na Saúde Web?
2. O que foi criado antes do Health v1 Foundation?
3. O que possui valor técnico reaproveitável?
4. O que conflita com os contratos canônicos?
5. O que pertence à responsabilidade da Web?
6. O que deve permanecer no Mobile ou no Backend?
7. Qual parte já pode ser considerada implementação oficial?
8. Quais riscos precisam ser tratados antes de qualquer evolução funcional?
9. Que decisões devem alimentar a baseline, a arquitetura-alvo e o roadmap?

---

## 4. Escopo auditado

Foram considerados os seguintes grupos de evidências no repositório Web:

- rota principal de Saúde em `src/app/(app)/health/page.tsx`;
- hook agregador `src/features/health/hooks/use-health-data.ts`;
- hub e formulários de registro de eventos de Saúde;
- service administrativo de Saúde;
- wrappers de Firebase Functions;
- shell e navegação lateral;
- perfil individual do K9 e seu hook de dados;
- catálogo de relatórios e rotas relacionadas;
- modelo de controle de acesso em `master`;
- regras Firestore versionadas no repositório Web;
- branch `feature/health-web-nutrition`;
- componentes, hooks, services, testes e documentos de handoff da Nutrição Web;
- diferenças conhecidas entre `master` e a branch de Nutrição;
- documentos canônicos do Health v1.0 Mobile/Backend disponibilizados como autoridade de domínio.

### 4.1 Limites

Não foram executados:

- checkout local do repositório do usuário;
- alterações de arquivo no repositório;
- build;
- lint;
- typecheck;
- testes unitários ou de integração;
- Firebase Emulator Suite;
- leitura do Firestore real;
- leitura do Remote Config real;
- inspeção do Storage real;
- deploy;
- commit;
- push;
- merge;
- alteração de Rules ou índices.

Os SHAs registrados representam o estado observado durante a auditoria, não uma garantia de que as branches permaneçam nesses commits após esta data.

### 4.2 Regra de evidência

A auditoria distingue:

| Termo | Significado neste documento |
|---|---|
| Implementado | Código encontrado no estado auditado |
| Contratado | Definido por documento canônico aprovado |
| Planejado | Previsto em roadmap ou arquitetura, mas não comprovado no Web |
| Legado | Contrato ou coleção anterior ao modelo Health v1 |
| Experimental | Código sem adoção operacional e sem compromisso de compatibilidade |
| Canônico | Alinhado à autoridade de domínio vigente |
| Hipótese | Proposta ainda sujeita a decisão humana |

---

## 5. Visão arquitetural atual

### 5.1 Stack observada

| Camada | Tecnologia observada |
|---|---|
| Framework Web | Next.js 16.2.7 |
| UI | React 19.2.4 |
| Linguagem | TypeScript |
| Backend cliente | Firebase 12.14.0 |
| Persistência | Firestore |
| Mutações administrativas | Cloud Functions callable |
| Autenticação | Firebase Authentication |
| Controle de acesso | módulo + ação, com evolução parcial para capabilities |

### 5.2 Diagrama textual do estado em `master`

```text
App Shell
└── Sidebar
    └── Saúde -> /health
        └── HealthPage monolítica
            ├── métricas gerais
            ├── cards de atenção
            ├── índice de saúde/prontidão calculado no cliente
            ├── vencimentos próximos
            ├── eventos recentes
            ├── filtros e busca
            ├── tabela de prontidão por K9
            └── HealthEventHub para registrar evento

Perfil individual do K9
└── /k9/{dogId}
    └── Prontuário clínico
        ├── Resumo
        ├── Vacinas
        ├── Peso
        ├── Atendimentos
        ├── Documentos
        └── HealthEventHub

Fontes principais
├── dogs
├── health_logs [raiz]
├── documentos [raiz]
├── dogs/{dogId}/health_events
├── dogs/{dogId}/weight_records
└── dogs/{dogId}/documents

Mutações
├── adminCreateHealthEvent callable
├── adminCreateK9WeightRecord callable
├── adminCreateK9HealthDocument callable
├── upload de arquivo pelo cliente
└── atualização best-effort de campos _last_* em dogs
```

### 5.3 Característica dominante

A implementação atual é orientada a uma página agregadora central e a um prontuário individual com abas. O domínio de Saúde não possui uma arquitetura de informação própria que represente suas diferentes áreas gerenciais.

O resultado é uma interface que mistura:

- monitoramento;
- prontuário;
- execução;
- registro;
- indicadores;
- documentos;
- agenda implícita;
- relatórios;
- prontidão calculada;
- administração.

Essa mistura é incompatível com a complexidade já aprovada para o Health v1.0.

---

## 6. Inventário funcional atual

### 6.1 Dashboard `/health`

A rota principal contém, no mesmo arquivo e fluxo visual:

- cabeçalho da Saúde;
- métricas agregadas;
- ação para registrar evento;
- cards de estado;
- indicador circular denominado índice de saúde;
- lista de vencimentos próximos;
- lista de eventos recentes;
- cards de atenção;
- categorias;
- busca por K9;
- filtros;
- tabela resumida de prontidão.

O arquivo observado possui aproximadamente 1.186 linhas, sinal de concentração excessiva de responsabilidades de apresentação, agregação e interação.

#### Avaliação

| Critério | Resultado |
|---|---|
| Valor como referência visual | Parcial |
| Valor como arquitetura-alvo | Baixo |
| Aderência ao Health v1 | Baixa |
| Adoção operacional | Nenhuma informada |
| Obrigação de compatibilidade | Nenhuma |
| Possibilidade de substituição | Alta |

### 6.2 Prontuário individual `/k9/{dogId}`

O perfil individual contém uma seção denominada prontuário clínico com abas de resumo, vacinas, peso, atendimentos e documentos.

Esse arranjo possui valor como precedente de drill-down por K9, mas não representa o prontuário canônico aprovado porque:

- não organiza casos clínicos;
- não representa protocolos de tratamento;
- não representa solicitações, coletas, resultados e interpretações de exame como entidades distintas;
- não integra restrictions como lifecycle operacional;
- não aplica imutabilidade clínica por amendment;
- não apresenta timeline canônica;
- mistura fontes heterogêneas sem uma projeção autoritativa.

### 6.3 Hub de registros

O `HealthEventHub` observado permite registrar:

- vacina;
- peso;
- exame ou consulta;
- medicação;
- documento.

Também suporta metadados como profissional, CRMV, clínica, custo e anexos.

O hub demonstra preocupação válida com captura estruturada e documentação, porém seu contrato genérico não pode ser promovido automaticamente ao Health v1.

A arquitetura canônica separa fatos e workflows que possuem ciclos de vida diferentes. Por exemplo:

```text
consulta veterinária
≠
caso clínico
≠
restrição
≠
protocolo de tratamento
≠
administração de medicamento
≠
exame solicitado
≠
coleta
≠
resultado
≠
interpretação
```

O hub atual poderá servir como referência de componentes, não como autoridade de domínio.

### 6.4 Relatórios

O sistema de relatórios já reconhece Saúde como categoria e possui rota associada. Há também infraestrutura genérica de auditoria e exportação.

Isso é um ativo técnico útil, mas o catálogo Health v1 ainda precisará definir:

- relatórios de prontidão;
- cobertura preventiva;
- restrições ativas e encerradas;
- casos clínicos por status;
- adesão a tratamentos;
- evolução de peso;
- cobertura vacinal;
- execução nutricional;
- inconsistências e estados degradados;
- trilha de auditoria clínica e administrativa.

---

## 7. Fontes de dados observadas

### 7.1 Matriz de classificação

| Fonte | Uso atual | Classificação preliminar | Tratamento recomendado |
|---|---|---|---|
| `dogs` | identidade do K9 e campos denormalizados `_last_*` | Canônica para identidade; campos Health antigos são projeções legadas | Preservar identidade; retirar autoridade dos `_last_*` após projeções canônicas |
| `health_logs` | agregação geral no dashboard | Legado | Inventariar dados; não usar como base da nova arquitetura |
| `dogs/{dogId}/health_events` | eventos clínicos genéricos | Legado/pré-Foundation | Leitura de coexistência somente quando explicitamente contratada |
| `dogs/{dogId}/weight_records` | histórico de peso | Reutilizável e potencialmente canônico | Reconciliar com schema aprovado antes de promover |
| `documentos` | documentos por K9 | Legado e semanticamente ambíguo | Mapear conteúdo, autoria, Storage e vínculos antes de migrar |
| `dogs/{dogId}/documents` | documentos na subcoleção | Contrato concorrente/uso parcial | Definir destino canônico antes de manter |
| `_last_vaccine_at` | snapshot rápido no K9 | Projeção antiga | Substituir por projeção server-side canônica |
| `_last_vaccine_due_at` | vencimento projetado | Projeção antiga | Substituir por agenda/summary canônicos |
| `_last_exam_at` | último exame | Projeção antiga | Substituir por summary canônico |
| `_last_weight_kg` | último peso | Projeção antiga | Avaliar como projeção técnica, sem autoridade clínica |
| `_last_weight_at` | data do último peso | Projeção antiga | Avaliar como projeção técnica |
| `dogs/{dogId}/nutrition_plans` | planos alimentares | Canônica na branch de Nutrição | Preservar e integrar |
| `nutrition_operations` | receipts/idempotência | Canônica na implementação de Nutrição | Preservar |
| `auditLogs` | trilha de auditoria | Infraestrutura compartilhada | Reconciliar naming, autoridade e formato cross-platform |

### 7.2 Agregação no cliente

O hook `use-health-data.ts` carrega dados de múltiplas fontes e deriva métricas no navegador. Foram observadas consultas a:

- K9s via provider compartilhado;
- `health_logs` raiz, com limite de 500;
- `documentos` raiz;
- `health_events` por K9;
- `weight_records` por K9;
- documentos por K9.

A abordagem possui problemas estruturais para o modelo alvo:

- custo cresce com o número de cães e fontes;
- paginação e janelas temporais não são uniformes;
- ausência em uma coleção pode ser interpretada incorretamente;
- falhas parciais são difíceis de comunicar;
- múltiplos readers podem divergir semanticamente;
- a interface assume responsabilidade por síntese operacional;
- o cliente pode calcular um estado diferente do Mobile ou do Backend.

### 7.3 Projeções antigas no documento do K9

O service administrativo executa callables e depois tenta atualizar diretamente campos `_last_*` em `dogs` de forma best-effort.

Esse fluxo produz duas autoridades concorrentes:

```text
callable cria o fato
+
cliente tenta atualizar o snapshot
```

Se a segunda etapa falhar, o fato pode existir sem atualização do resumo. Se ocorrer concorrência ou mudança de schema, o snapshot pode ficar inconsistente.

No Health v1, projeções operacionais devem ser produzidas de maneira autoritativa e server-side, preferencialmente na mesma unidade lógica de mutação ou por mecanismo de projeção idempotente e auditável.

---

## 8. Auditoria da prontidão atual

### 8.1 Lógica observada

O dashboard atual deriva prontidão por regras locais relacionadas a:

- vacinação em dia;
- peso dentro de faixa;
- exames recentes;
- alertas de ausência, vencimento ou proximidade de vencimento.

Foi observada uma regra de fallback de aproximadamente 365 dias para vencimento vacinal, além de limiares de 180 e 365 dias para exames.

### 8.2 Problema central

Essa lógica não corresponde ao modelo canônico de prontidão.

No Health v1, prontidão é um estado operacional derivado de evidências, restrições e autoridade clínica, não uma soma simples de cobertura preventiva.

Os cinco estados aprovados são:

```text
Operational
Operational with Attention
Fit with Restrictions
Temporarily Unfit
Not Evaluated
```

A interface Web em português deverá apresentar exatamente:

```text
Operacional
Operacional com Atenção
Apto com Restrições
Temporariamente Inapto
Não Avaliado
```

### 8.3 Ausências críticas

O indicador atual não considera adequadamente:

- restrição clínica ativa;
- severidade e efeito operacional da restrição;
- estado não avaliado por insuficiência de evidência;
- bloqueio absoluto determinado por autoridade clínica;
- conflito de projeção;
- stale data;
- source provenance;
- avaliação canônica vigente;
- regras versionadas de prontidão.

### 8.4 Decisão recomendada

O indicador atual não deve continuar sendo chamado de índice de prontidão ou índice de saúde na versão oficial.

Enquanto `health_summary` e a política canônica não estiverem integrados, eventual reaproveitamento visual deverá usar uma denominação sem autoridade operacional, como:

> Cobertura de evidências de saúde

Essa métrica, se mantida, deve permanecer separada do estado oficial de prontidão.

### 8.5 Estados técnicos separados

A UI não pode transformar falha técnica em estado clínico.

Devem permanecer separados:

```text
estado operacional:
- Operacional
- Operacional com Atenção
- Apto com Restrições
- Temporariamente Inapto
- Não Avaliado

estado técnico:
- loading
- empty
- error
- partial
- degraded
- stale
- legacy
- conflict
```

Exemplo proibido:

```text
falha ao carregar restrições
-> exibir Operacional
```

Exemplo correto:

```text
falha ao carregar restrições
-> exibir estado técnico degradado
-> não promover prontidão além da evidência disponível
```

---

## 9. Auditoria de mutações Web

### 9.1 Mutações observadas em `master`

A Web possui caminhos administrativos para criar:

- evento de Saúde;
- pesagem;
- documento.

O cliente também realiza upload e tenta atualizar campos agregados no documento do K9.

### 9.2 Conflito de responsabilidade

A divisão canônica estabelece:

```text
Mobile:
registro e execução operacional em campo

Web:
gestão, supervisão, consulta, aprovação, planejamento, análise, auditoria e relatórios
```

Isso não significa que a Web nunca possa criar um fato. Significa que cada mutação Web precisa ter uma justificativa explícita, capability própria e semântica administrativa.

Exemplos possíveis:

- transcrição autorizada de documento externo;
- criação de plano;
- abertura administrativa de agenda preventiva;
- revisão ou encerramento de restrição por autoridade competente;
- lançamento retroativo autorizado;
- amendment de registro clínico;
- gestão de protocolo;
- anexação documental;
- aprovação ou validação.

Exemplos que tendem a pertencer ao Mobile:

- registrar que a refeição foi servida;
- registrar administração operacional de medicação;
- concluir atividade realizada em campo;
- registrar pesagem executada no canil;
- registrar aplicação preventiva no momento da execução.

### 9.3 Decisões pendentes

Antes de implementar writes Health Web, será necessário decidir:

1. A Web poderá registrar pesagem ou apenas importar/transcrever?
2. A Web poderá registrar aplicação de vacina ou apenas gerenciar cobertura e documentos?
3. A Web poderá concluir agenda preventiva ou somente gerir a agenda?
4. Qual perfil pode abrir, revisar e encerrar restrições?
5. Qual perfil pode criar amendment clínico?
6. Profissionais externos poderão atuar diretamente ou apenas ser referenciados?
7. O registro genérico de medicação será substituído por protocolo e administrações?
8. Quais operações exigem justificativa obrigatória?
9. Quais operações exigem coautoria, aprovação ou dupla confirmação?

---

## 10. Auditoria de permissões

### 10.1 Modelo observado em `master`

O controle de acesso observado utiliza ações genéricas:

```text
archive
approve
audit
create
edit
export
view
```

aplicadas ao módulo `health`.

Perfis padrão concedem combinações dessas ações a operador, instrutor, gestor e administrador.

### 10.2 Limitação

Esse modelo não representa adequadamente domínios clínicos sensíveis.

A permissão genérica `health.edit`, por exemplo, não distingue:

- editar agenda;
- criar plano alimentar;
- substituir plano ativo;
- cancelar plano;
- abrir caso clínico;
- registrar evolução;
- criar amendment;
- emitir restrição;
- encerrar restrição;
- definir prontidão;
- gerenciar protocolo;
- visualizar documento restrito;
- exportar histórico clínico;
- auditar alteração.

### 10.3 Evolução comprovada na Nutrição

A branch de Nutrição introduz a capability:

```text
health.manage_nutrition_plan
```

Ela é verificada sem fallback para `health.edit`.

Esse padrão é mais compatível com o Health v1 e deve orientar os demais subdomínios.

### 10.4 Direção recomendada

A nova matriz deverá separar, no mínimo:

- visualização global;
- visualização clínica detalhada;
- visualização de documentos sensíveis;
- gestão de agenda;
- gestão de plano alimentar;
- gestão de caso clínico;
- gestão de tratamento;
- gestão de exames;
- gestão de restrições;
- amendment clínico;
- auditoria;
- exportação;
- relatórios agregados;
- acesso por K9 e escopo organizacional.

As capabilities finais devem ser definidas no documento específico e reconciliadas com o inventário canônico Mobile/Backend.

---

## 11. Auditoria de Rules e autoridade de backend

### 11.1 Evidência no repositório Web

As Rules versionadas em `master` possuem matches para fontes legadas, incluindo `health_events` e `health_logs`, com autorização baseada no modelo genérico auditado.

Não foi comprovada, no espelho de `master`, cobertura equivalente para todas as collections canônicas da Nutrição.

### 11.2 Ressalva de autoridade

Os documentos do programa registram que o repositório Mobile/Backend é a autoridade canônica de Rules para o Health v1. O arquivo presente no repositório Web pode estar atrasado em relação ao estado real de produção.

Portanto:

- ausência no mirror Web não prova ausência em produção;
- presença no mirror Web não prova que a regra esteja publicada;
- nenhuma conclusão de autorização produtiva deve ser tomada apenas a partir desse arquivo;
- a integração futura precisará reconciliar Rules, Functions, índices e clients entre repositórios.

### 11.3 Regra para o novo programa

O Web não deverá introduzir writes diretos em collections protegidas para contornar gaps de Rules ou Functions.

Mutações compostas devem preservar:

- callable autoritativa;
- validação server-side;
- capability;
- dog access;
- `operationId`;
- receipt;
- timestamp server-side;
- ator;
- auditoria;
- revisão ou token de concorrência quando aplicável;
- idempotência;
- proteção contra replay semântico.

---

## 12. Auditoria da gestão Web de Plano Alimentar

### 12.1 Status

A gestão de Plano Alimentar é a única capacidade Web reconhecida como pós-Foundation e alinhada ao programa Health v1.

Ela está presente na branch:

```text
feature/health-web-nutrition
```

com head observado:

```text
be9f0887e2b1f9c3789ef527e103911ad8f44e81
```

### 12.2 Princípio implementado

A implementação segue:

```text
WEB DEFINE E ADMINISTRA
MOBILE EXECUTA E REGISTRA FATOS
```

### 12.3 Capacidades identificadas

A branch inclui:

- rota `/health/nutrition`;
- seleção de K9;
- leitura canônica de `nutrition_plans`;
- coexistência com fontes legadas;
- capability `health.manage_nutrition_plan`;
- criação de plano;
- atualização administrativa do plano ativo;
- substituição estrutural do plano;
- cancelamento;
- callables canônicas;
- `operationId` e receipts;
- revisão e controle de concorrência;
- estados de loading, canonical, legacy, empty, degraded, error e conflict;
- comportamento fail-closed quando múltiplos planos ativos são encontrados;
- testes de contratos e componentes;
- reconciliação cross-platform documentada.

### 12.4 Callables identificadas

```text
healthNutritionCreateAndActivatePlan
healthNutritionUpdateActivePlan
healthNutritionCancelPlan
```

### 12.5 Collections e estados

```text
dogs/{dogId}/nutrition_plans/{planId}
nutrition_operations
auditLogs
```

Estados de plano observados:

```text
active
superseded
cancelled
```

### 12.6 Semântica de mutação

A implementação distingue:

- campos administrativos alteráveis no mesmo plano, com nova revisão;
- campos estruturais que exigem substituição e novo `planId`;
- idempotência durável por `operationId`;
- múltiplos ativos como conflito, nunca como seleção arbitrária.

### 12.7 Pontos ainda não implementados nessa branch

Os próprios documentos de handoff registram que não estão concluídos:

- dashboard nutricional agregado;
- execução de refeições na Web;
- histórico completo com paginação;
- drafts;
- planos futuros ou agendados;
- integração definitiva ao novo shell Health Web.

A ausência de execução Web é coerente com a divisão canônica e não deve ser tratada como lacuna obrigatória.

### 12.8 Divergência de branches

No momento auditado, `master` e `feature/health-web-nutrition` estavam divergentes.

A branch de Nutrição continha commits funcionais não presentes em `master`, enquanto `master` continha commits posteriores relacionados ao loading animado e outros refinamentos.

Consequência:

> A integração da Nutrição não deve ser feita por merge cego nem por reconstrução manual sem auditoria diferencial.

Ela exigirá uma fase própria de reconciliação, preservando simultaneamente:

- contratos canônicos de Nutrição;
- testes;
- capabilities;
- callables;
- estados de leitura;
- evolução atual de `master`;
- novo shell e arquitetura do Health Web.

---

## 13. Navegação e arquitetura da informação atuais

### 13.1 Estado observado

A sidebar possui um único item:

```text
Saúde -> /health
```

O mapa central de paths em `master` não possui rotas dedicadas para:

- prontidão;
- agenda;
- casos clínicos;
- tratamentos;
- exames;
- restrições;
- nutrição;
- histórico clínico;
- relatórios de Saúde;
- auditoria de Saúde.

O detalhamento por K9 permanece dentro do perfil geral `/k9/{dogId}`.

### 13.2 Limitação

Uma única rota não consegue representar, com clareza e governança, todos os domínios do Health v1.

Também não é recomendável criar muitos itens independentes na sidebar global, pois isso fragmentaria a navegação principal do K9 Ops.

### 13.3 Direção preliminar

A alternativa recomendada é manter um único item global `Saúde` e criar navegação secundária interna:

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

Essa proposta ainda deverá ser formalizada no documento de arquitetura da informação.

---

## 14. Matriz preliminar Web × Mobile × Backend

| Capacidade | Mobile | Web | Backend |
|---|---|---|---|
| Consultar prontidão do K9 | Sim | Sim, global e detalhada | Projeta e valida |
| Calcular prontidão | Não autoritativamente | Não autoritativamente | Sim |
| Registrar refeição executada | Sim | Não | Valida e persiste |
| Criar plano alimentar | Não | Sim | Valida, versiona e audita |
| Atualizar plano administrativamente | Não | Sim | Valida concorrência |
| Substituir plano estruturalmente | Não | Sim | Encerra anterior e ativa novo |
| Registrar pesagem operacional | Sim | Decisão pendente | Valida e projeta |
| Analisar tendência de peso | Consulta limitada | Sim | Pode fornecer projeções |
| Gerenciar agenda preventiva | Ações autorizadas | Sim | Valida lifecycle |
| Concluir ação em campo | Sim | Exceção administrativa somente | Valida execução |
| Abrir caso clínico | Possível conforme contrato | Sim para perfis autorizados | Autoritativo |
| Registrar evolução clínica | Sim/por profissional autorizado | Sim/por profissional autorizado | Imutável e auditado |
| Criar amendment | UI específica autorizada | Sim | Autoritativo |
| Criar restrição | Não para operador comum | Sim para autoridade autorizada | Autoritativo |
| Encerrar restrição | Não para operador comum | Sim para autoridade autorizada | Autoritativo |
| Administrar medicação | Sim | Não como execução ordinária | Valida protocolo e registro |
| Gerir protocolo de tratamento | Consulta | Sim | Autoritativo |
| Consultar timeline | Sim, operacional | Sim, analítica | Projeta ou fornece readers |
| Exportar histórico | Limitado | Sim, com capability | Gera ou autoriza exportação |
| Auditar mutações | Consulta restrita | Sim | Fonte autoritativa |

Esta matriz é preliminar e não substitui o documento específico de responsabilidades cross-platform.

---

## 15. Reaproveitamento técnico

### 15.1 Candidatos a reaproveitamento

Podem ser avaliados:

- componentes visuais de cards e tabelas;
- shell institucional existente;
- padrões de filtros e busca;
- infraestrutura de relatórios;
- infraestrutura de exportação;
- componentes de anexos;
- wrappers de Functions, quando reconciliados;
- padrões de estados de leitura da Nutrição;
- capability gate da Nutrição;
- testes e fixtures de Nutrição;
- K9 selector da Nutrição;
- componentes de diálogo de Create/Update/Replace/Cancel;
- integração com `EntitiesProvider` para identidade dos cães;
- elementos do perfil individual do K9 como ponto de entrada para drill-down.

### 15.2 Elementos que não devem ser promovidos sem revisão

- índice atual de prontidão;
- regras locais de 180/365 dias;
- fallback vacinal genérico de 365 dias;
- atualização client-side dos campos `_last_*`;
- registro genérico de medicação;
- edição genérica de evento clínico;
- agregação de todo o canil por múltiplas consultas client-side;
- uso de `health_logs` como fonte principal;
- uso de `health_events` como entidade clínica universal;
- permissões genéricas como autoridade suficiente;
- mistura de documentos raiz e subcoleção sem contrato comum;
- tratamento de ausência de dados como estado positivo;
- seleção arbitrária de documento quando há conflito.

### 15.3 Elementos de substituição livre

Como não há adoção operacional informada, podem ser substituídos sem obrigação de continuidade de UX:

- layout do dashboard;
- hierarquia dos cards;
- indicador circular;
- nomes atuais das seções;
- filtros atuais;
- tabela atual de prontidão;
- organização das abas do prontuário;
- fluxo do hub genérico;
- navegação baseada em uma única página;
- linguagem de “índice de saúde”.

---

## 16. Riscos identificados

### R-WEB-001 — Prontidão não canônica

**Severidade:** crítica  
**Descrição:** a UI pode apresentar uma conclusão operacional baseada em heurísticas incompletas.  
**Tratamento:** remover autoridade do cálculo client-side e integrar `health_summary` e restrictions.

### R-WEB-002 — Ausência interpretada como normalidade

**Severidade:** crítica  
**Descrição:** falta de dados, falha de leitura ou coleção não migrada pode produzir aparência de regularidade.  
**Tratamento:** estados técnicos explícitos e fail-closed.

### R-WEB-003 — Eventos clínicos mutáveis

**Severidade:** alta  
**Descrição:** modelo genérico de edição conflita com imutabilidade clínica e amendment.  
**Tratamento:** separar eventos, casos e amendments por contrato.

### R-WEB-004 — Writes fora da fronteira Web

**Severidade:** alta  
**Descrição:** a Web atual pode registrar fatos operacionais sem justificativa administrativa específica.  
**Tratamento:** matriz de responsabilidades e capability por operação.

### R-WEB-005 — Projeções client-side

**Severidade:** alta  
**Descrição:** campos `_last_*` podem divergir do fato autoritativo.  
**Tratamento:** projeções server-side idempotentes.

### R-WEB-006 — Agregação não escalável

**Severidade:** média/alta  
**Descrição:** consultas por cão e merge no navegador aumentam custo, latência e risco de inconsistência.  
**Tratamento:** readers agregados e summaries canônicos.

### R-WEB-007 — Permissões excessivamente amplas

**Severidade:** alta  
**Descrição:** `health.edit` não representa autoridade clínica granular.  
**Tratamento:** capabilities específicas e deny-by-default.

### R-WEB-008 — Contratos concorrentes de documentos

**Severidade:** média/alta  
**Descrição:** `documentos`, `dogs/{dogId}/documents` e anexos de evento competem semanticamente.  
**Tratamento:** inventário de dados, contrato documental e migração.

### R-WEB-009 — Divergência entre repositórios e branches

**Severidade:** alta  
**Descrição:** Web, Mobile, Functions e Rules podem representar versões diferentes do contrato.  
**Tratamento:** handoff versionado e gates cross-platform.

### R-WEB-010 — Perda de dados durante substituição visual

**Severidade:** alta  
**Descrição:** ausência de uso da interface pode levar à conclusão incorreta de que collections estão vazias.  
**Tratamento:** auditoria de dados antes de desativar readers, rules ou migrations.

### R-WEB-011 — Merge inadequado da Nutrição

**Severidade:** alta  
**Descrição:** integração cega pode perder contratos canônicos ou alterações posteriores de `master`.  
**Tratamento:** fase própria de reconciliação e testes.

### R-WEB-012 — Monólito de apresentação

**Severidade:** média  
**Descrição:** a página principal concentra múltiplas responsabilidades e dificulta evolução por domínio.  
**Tratamento:** arquitetura modular por subdomínio e rotas secundárias.

---

## 17. Findings formais

### F-WEB-001 — A implementação pré-Foundation não é baseline funcional

**Status:** confirmado por decisão do produto.  
**Impacto:** elimina obrigação de manter UX e fluxos antigos.  
**Ação:** registrar na baseline e no plano de migração.

### F-WEB-002 — Plano Alimentar é a única capacidade Web canônica existente

**Status:** confirmado.  
**Impacto:** deve ser preservado e integrado, não reescrito sem justificativa.  
**Ação:** criar plano específico de integração da branch.

### F-WEB-003 — Dashboard atual não consome prontidão canônica

**Status:** confirmado por análise estática.  
**Impacto:** não pode ser usado como cockpit oficial.  
**Ação:** substituir a origem de prontidão.

### F-WEB-004 — Restrictions não governam o estado exibido

**Status:** confirmado no escopo auditado.  
**Impacto:** risco operacional.  
**Ação:** integrar lifecycle e projeção canônicos.

### F-WEB-005 — Health Web mistura gestão e execução

**Status:** confirmado.  
**Impacto:** fronteira cross-platform inconsistente.  
**Ação:** formalizar matriz de responsabilidades.

### F-WEB-006 — Modelo de permissões é insuficientemente granular

**Status:** confirmado em `master`.  
**Impacto:** não suporta governança clínica.  
**Ação:** definir capabilities por domínio e operação.

### F-WEB-007 — Projeções `_last_*` possuem atualização client-side best-effort

**Status:** confirmado.  
**Impacto:** risco de divergência.  
**Ação:** migrar para projeções autoritativas.

### F-WEB-008 — Collections legadas precisam de auditoria de dados

**Status:** pendente.  
**Impacto:** impede exclusão segura.  
**Ação:** auditoria read-only de cardinalidade, schema e dependências em fase futura autorizada.

### F-WEB-009 — Nutrição está fora de `master` e divergente

**Status:** confirmado no estado observado.  
**Impacto:** integração exige reconciliação.  
**Ação:** gate específico após fechamento técnico da Fase 5.

### F-WEB-010 — Arquitetura da informação atual é insuficiente

**Status:** confirmado.  
**Impacto:** domínio não pode crescer com clareza.  
**Ação:** aprovar mapa de rotas e inventário de telas antes de mockups definitivos.

---

## 18. Decisões já estabelecidas

As seguintes decisões podem ser tratadas como aprovadas para os próximos documentos:

1. A Saúde Web será um **Centro de Gestão e Prontidão K9**.
2. A interface pré-Foundation não possui adoção operacional atual.
3. A interface pré-Foundation não cria obrigação de compatibilidade visual ou funcional.
4. Dados antigos não serão descartados sem auditoria própria.
5. O Plano Alimentar Web é canônico e deve ser preservado.
6. A Web não copiará o Mobile.
7. O Mobile executa e registra fatos operacionais em campo.
8. A Web gerencia, supervisiona, consulta, planeja, analisa, audita e relata.
9. O Backend é autoridade para mutações compostas, projeções e decisão operacional.
10. Prontidão não será calculada por heurística visual no cliente.
11. Ausência de dados não será convertida em estado positivo.
12. Estados técnicos serão separados de estados clínico-operacionais.
13. Mutações clínicas respeitarão imutabilidade e amendment.
14. Capabilities granulares substituirão dependência exclusiva de ações genéricas.
15. A Nutrição será integrada por fase própria, não por merge improvisado.

---

## 19. Decisões humanas ainda necessárias

Os documentos seguintes deverão obter decisão explícita sobre:

1. A Web poderá registrar pesagens?
2. A Web poderá transcrever aplicações preventivas realizadas fora do Mobile?
3. A Web poderá concluir eventos de agenda ou apenas gerenciá-los?
4. Quais perfis visualizam dados clínicos completos?
5. Quais perfis visualizam documentos sensíveis?
6. Quem pode criar e encerrar restrições?
7. Quem pode criar amendment?
8. Profissionais veterinários externos terão conta própria no sistema?
9. O prontuário individual continuará também dentro de `/k9/{dogId}` ou apontará para `/health/dogs/{dogId}`?
10. Relatórios e auditoria ficarão dentro de Saúde ou na central global com filtros?
11. A métrica “cobertura de evidências” terá valor de produto ou será descartada?
12. Quais thresholds operacionais serão aprovados e versionados?
13. Qual estratégia será usada para documentos legados?
14. Quando a branch de Nutrição poderá entrar na reconciliação oficial?

---

## 20. Implicações para a arquitetura-alvo

A futura arquitetura deverá:

- usar o modelo de domínio Health v1 como fonte de verdade;
- separar visão global do canil e cockpit individual do K9;
- possuir rotas dedicadas por subdomínio;
- consumir summaries e projections autoritativos;
- suportar estados parciais e degradados;
- exibir provenance e freshness quando relevante;
- aplicar capabilities granulares;
- impedir writes diretos em coleções protegidas;
- preservar operação idempotente;
- integrar auditoria à mutação;
- suportar coexistência legada explícita e temporária;
- evitar duplicar execução Mobile;
- permitir drill-down gerencial;
- preparar relatórios e exportações auditáveis;
- incorporar Plano Alimentar sem perda de contratos.

### 20.1 Inventário inicial de áreas

```text
Visão Geral
Prontidão
Agenda Preventiva
Casos Clínicos
Exames
Tratamentos
Restrições
Nutrição
Peso e Tendências
Vacinação e Cobertura
Histórico/Timeline
Relatórios
Auditoria
Configurações autorizadas
```

Esse inventário será refinado no documento de arquitetura da informação.

---

## 21. Estratégia preliminar de migração

A migração não deverá ser um rewrite destrutivo.

### Etapa 1 — Congelar autoridade

- declarar o legado como não autoritativo;
- impedir expansão de fluxos antigos;
- preservar a branch de Nutrição;
- documentar fontes e dependências.

### Etapa 2 — Criar readers canônicos

- summaries;
- readiness;
- restrictions;
- schedule;
- clinical cases;
- timeline;
- nutrition.

### Etapa 3 — Implementar nova IA read-only

- shell Health;
- navegação secundária;
- visão geral;
- prontidão;
- agenda;
- drill-down por K9.

### Etapa 4 — Integrar Plano Alimentar

- reconciliar branch;
- preservar tests e capabilities;
- adaptar ao novo shell;
- validar cross-platform.

### Etapa 5 — Introduzir writes por domínio

Somente após:

- contrato aprovado;
- capability aprovada;
- callable implementada;
- Rules reconciliadas;
- testes locais;
- emuladores;
- auditoria;
- homologação humana.

### Etapa 6 — Desativar legado

Somente após:

- auditoria de dados;
- migração ou arquivamento;
- ausência de readers dependentes;
- telemetria ou evidência de não uso;
- rollback definido;
- decisão humana explícita.

---

## 22. Recomendação de arquitetura da informação

A auditoria recomenda, para formalização posterior:

```text
Sidebar global
└── Saúde
    ├── Visão Geral
    ├── Prontidão
    ├── Agenda
    ├── Clínico
    ├── Nutrição
    ├── Histórico
    └── Relatórios
```

Rotas preliminares:

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

Subrotas poderão ser usadas para casos, protocolos, exames, restrições e documentos sem poluir a sidebar.

---

## 23. Roadmap documental derivado

Esta auditoria alimenta os seguintes documentos:

1. `HEALTH_WEB_BASELINE.md`
2. `HEALTH_WEB_TARGET_ARCHITECTURE.md`
3. `HEALTH_WEB_INFORMATION_ARCHITECTURE.md`
4. `HEALTH_WEB_DOMAIN_AND_SCREEN_MODEL.md`
5. `HEALTH_WEB_DATA_SOURCE_MATRIX.md`
6. `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`
7. `HEALTH_WEB_CAPABILITIES_INVENTORY.md`
8. `HEALTH_WEB_PERMISSION_MATRIX.md`
9. `HEALTH_WEB_READINESS_POLICY.md`
10. `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`
11. `HEALTH_WEB_MIGRATION_AND_COEXISTENCE_PLAN.md`
12. `HEALTH_WEB_NUTRITION_INTEGRATION_PLAN.md`
13. `HEALTH_WEB_TEST_STRATEGY.md`
14. `HEALTH_WEB_MOCKUP_PLAN.md`

ADRs derivadas:

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

## 24. Critérios de aprovação deste documento

A auditoria poderá ser considerada aprovada quando houver concordância humana de que:

- o Plano Alimentar é a única capacidade Health Web pós-Foundation existente;
- o restante da interface atual não possui adoção operacional;
- a ausência de adoção elimina obrigação de compatibilidade de UX;
- collections e documentos antigos ainda exigem auditoria antes de exclusão;
- o indicador atual não representa prontidão canônica;
- a Web deverá ser redesenhada segundo o domínio Health v1;
- a divisão Mobile × Web × Backend está corretamente interpretada;
- a Nutrição deverá ser preservada e integrada por fase própria;
- nenhum código será implementado antes da fundação documental e aprovação humana.

---

## 25. Conclusão

A área Saúde Web existente demonstra esforço técnico e oferece peças reaproveitáveis, mas não deve ser confundida com a implementação oficial do Health v1.0.

O código pré-Foundation foi criado sem a arquitetura canônica atual, não está sendo utilizado operacionalmente e não deve restringir o novo desenho. Seu valor é principalmente investigativo: permite identificar componentes, padrões, integrações e dados que podem ser preservados seletivamente.

A gestão de Plano Alimentar possui natureza diferente. Ela foi construída já sob as decisões do Health Foundation, utiliza contratos cross-platform, capabilities específicas, callables, idempotência, receipts e coexistência controlada. Por isso, constitui o primeiro submódulo oficial do Health Web v1 e deverá entrar na nova arquitetura como ativo preservado.

A direção recomendada é construir uma nova fundação Web orientada ao domínio, começando por readers canônicos e visão gerencial read-only. Prontidão, restrições, agenda, casos clínicos, timeline e relatórios devem ser tratados como áreas próprias, com estados técnicos explícitos e autoridade no Backend.

A migração deverá ser:

```text
livre na experiência;
conservadora com dados;
rigorosa com contratos;
gradual nas mutações;
fail-closed na prontidão;
auditável em todas as decisões.
```

---

## 26. Próximo documento recomendado

```text
HEALTH_WEB_BASELINE.md
```

Objetivo:

- registrar a referência oficial do programa;
- fixar branches, autoridade documental e restrições;
- separar canônico, legado, experimental e planejado;
- declarar explicitamente o que deve ser preservado;
- definir o ponto de partida para a arquitetura e o roadmap;
- impedir que código pré-Foundation seja promovido por inércia.
