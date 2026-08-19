# K9 Ops Web — Health Web v1 Readiness Policy

| Campo | Valor |
|---|---|
| Programa | Health Web Evolution Program |
| Documento | `HEALTH_WEB_READINESS_POLICY.md` |
| Versão | 1.0-draft |
| Data | 2026-07-30 |
| Status | Em revisão humana |
| Natureza | Política de apresentação, investigação e segurança da prontidão na Web |
| Repositório Web | `github.com/jillohh-arch/k9-ops` |
| Baseline Web | `HEALTH_WEB_BASELINE.md` |
| Arquitetura-alvo | `HEALTH_WEB_TARGET_ARCHITECTURE.md` |
| Arquitetura da informação | `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` |
| Matriz de fontes | `HEALTH_WEB_DATA_SOURCE_MATRIX.md` |
| Permission Matrix | `HEALTH_WEB_PERMISSION_MATRIX.md` |
| Autoridade canônica | `HEALTH_V1_READINESS_POLICY.md` e ADR-005 |
| Fora de escopo | Alterar algoritmo canônico, implementar Function, fixar thresholds operacionais, criar IPO ou realizar deploy |

---

## 1. Propósito

Este documento traduz para o Health Web v1 a política canônica de prontidão operacional já aprovada no Health v1.

Ele define:

- o vocabulário oficial;
- os cinco estados permitidos;
- a precedência entre restrições e lacunas de dados;
- a diferença entre display e autorização;
- as fontes de evidência;
- a apresentação na Visão Geral;
- a lista de prontidão do efetivo;
- o cockpit individual;
- o comportamento diante de projeção ausente, stale, parcial ou conflitante;
- a visualização de restrições;
- a relação com agenda, casos clínicos e Nutrição;
- a separação entre prontidão, alertas, cobertura de dados e futuro IPO;
- a política Web para o score legado;
- os limites de ação de usuários internos;
- os testes e gates necessários.

A pergunta central é:

> Como a Web apresenta e explica a prontidão sem recalculá-la, simplificá-la indevidamente ou substituir a autoridade clínica?

---

## 2. Fontes de autoridade

Esta política deriva de:

1. `HEALTH_V1_READINESS_POLICY.md`;
2. ADR-005 — Readiness and Restrictions;
3. `HEALTH_V1_DOMAIN_MODEL.md`;
4. `HEALTH_V1_FIRESTORE_SCHEMA.md`;
5. `HEALTH_V1_PERMISSION_MATRIX.md`;
6. `HEALTH_WEB_BASELINE.md`;
7. `HEALTH_WEB_TARGET_ARCHITECTURE.md`;
8. `HEALTH_WEB_DATA_SOURCE_MATRIX.md`;
9. `HEALTH_WEB_MOBILE_BACKEND_MATRIX.md`.

### 2.1 Regra de precedência documental

Em caso de divergência:

1. decisão humana aprovada;
2. política canônica de prontidão;
3. ADR-005;
4. modelo e schema canônicos;
5. esta política Web;
6. mockup;
7. implementação.

### 2.2 Limite deste documento

Este documento não altera:

- enums;
- precedência;
- autoridade da restrição;
- política offline Mobile;
- identidade profissional;
- lifecycles;
- schema.

Ele define a experiência Web sobre essas regras.

---

## 3. Declaração central

> **Prontidão operacional é um estado categórico server-side, explicado por evidências e restrições, nunca um score calculado pela Web.**

A Web:

- lê `health_summary/current`;
- mostra o estado oficial;
- mostra as razões;
- mostra as restrições;
- permite drill-down;
- permite ações administrativas autorizadas;
- comunica freshness;
- comunica conflito;
- não calcula;
- não sobrescreve;
- não cria override.

---

## 4. Vocabulário oficial

| Termo | Definição |
|---|---|
| Prontidão operacional | estado consolidado sobre aptidão do K9 para atividade operacional |
| Restrição clínica | limitação decorrente de decisão profissional externa, registrada no sistema |
| Restrição absoluta | bloqueio total da atividade operacional |
| Restrição parcial | bloqueio de atividades específicas |
| Atenção | condição de monitoramento que não bloqueia |
| ReadinessSnapshot | projeção server-side usada para exibição |
| Restrição canônica | documento ativo em `operational_restrictions` |
| Evidência | fonte canônica que explica o estado |
| Freshness | atualidade da projeção |
| Estado técnico | condição de carregamento, parcialidade, conflito ou erro |
| Cobertura de dados | completude das evidências de saúde |
| IPO | índice futuro, numérico e complementar |
| Score legado | heurística antiga client-side sem autoridade clínica |

---

## 5. Estados oficiais

Somente cinco estados podem ser apresentados como prontidão.

| Prioridade visual | Enum | Label PT-BR | Semântica | Operação |
|---:|---|---|---|---|
| 1 | `temporarily_unfit` | Temporariamente Inapto | existe restrição absoluta ativa | bloqueado |
| 2 | `fit_with_restrictions` | Apto com Restrições | existe restrição parcial ativa | permitido apenas fora do escopo restringido |
| 3 | `operational_attention` | Operacional com Atenção | atenção ativa ou dados incompletos significativos | permitido com alerta |
| 4 | `not_evaluated` | Não Avaliado | nenhuma avaliação registrada | permitido conforme política operacional, com alerta |
| 5 | `operational` | Operacional | nenhuma condição anterior | permitido |

### 5.1 Ordem da tabela

A ordem visual de prioridade não substitui a matriz de decisão server-side.

Ela serve para:

- ordenação;
- destaque;
- triagem.

### 5.2 Proibição

A Web não poderá criar estados como:

- Crítico;
- Regular;
- Bom;
- Excelente;
- Em risco;
- Saudável;
- Baixa prontidão;
- Alta prontidão;
- Indisponível por erro.

### 5.3 Labels

Os labels deverão seguir o contrato.

Não abreviar para:

- Inapto;
- Restrito;
- Atenção;
- Sem dados;

quando isso eliminar significado.

---

## 6. Matriz de decisão canônica

A Function avalia sequencialmente.

A primeira condição verdadeira determina o estado.

| Prioridade | Condição | Resultado |
|---:|---|---|
| 1 | restrição `absolute` ativa | `temporarily_unfit` |
| 2 | restrição `partial` ativa | `fit_with_restrictions` |
| 3 | restrição `attention` ativa | `operational_attention` |
| 4 | nenhuma avaliação registrada | `not_evaluated` |
| 5 | dados incompletos significativos | `operational_attention` |
| 6 | nenhuma condição anterior | `operational` |

### 6.1 Múltiplas restrições

A de maior prioridade determina o estado:

```text
absolute > partial > attention
```

As demais continuam visíveis.

### 6.2 Regra Web

A Web não implementará essa sequência como calculadora de fallback.

Ela poderá:

- documentar a razão;
- exibir a precedência;
- validar visualmente inconsistências;
- solicitar refresh;
- marcar conflict.

---

## 7. Fonte para display

Path canônico:

```text
dogs/{dogId}/health_summary/current
```

### 7.1 Uso permitido

- badge;
- lista;
- dashboard;
- cockpit;
- relatórios;
- contagens;
- filtros;
- ordenação;
- razões resumidas.

### 7.2 Write

Somente Backend/Function.

### 7.3 Consistência

Eventual consistency é aceita para display.

A política canônica estima atualização em segundos após mudança das fontes.

### 7.4 Web

A Web deverá mostrar:

- estado;
- razão;
- última avaliação;
- atualização da projection;
- restrições resumidas;
- completude;
- alertas;
- link para fontes.

---

## 8. Fonte para autorização crítica

Fonte:

```text
dogs/{dogId}/operational_restrictions
where status == active
```

### 8.1 Ações críticas

- iniciar turno;
- trocar K9 durante turno;
- escalar K9 para atividade;
- verificar atividade restringida.

### 8.2 Autoridade

Backend.

### 8.3 Web

A Web não é o canal primário dessas ações.

Quando exibir impacto operacional, deverá declarar que:

- o summary é a visão;
- a restrição canônica é a autoridade.

### 8.4 Invariante

Um badge `operational` não libera ação crítica se existe restrição absoluta canônica.

---

## 9. Separação display × autorização

| Aspecto | Display | Autorização |
|---|---|---|
| Fonte | `health_summary/current` | `operational_restrictions` |
| Canal principal | Web e Mobile | Backend |
| Objetivo | leitura e triagem | permitir ou bloquear |
| Consistência | eventual | canônica |
| Cliente decide | não | não |
| Pode ser stale | sim | consulta atual |
| Falha | estado técnico | fail-closed conforme ação |
| Auditoria | atualização da projection | decisão operacional |

### 9.1 Mensagem de suporte

A Web poderá mostrar em área técnica:

> A prontidão exibida é uma projeção. Ações operacionais críticas validam as restrições ativas diretamente no Backend.

Não é necessário repetir essa mensagem em todos os cards.

---

## 10. Evidências canônicas

| Evidência | Fonte |
|---|---|
| restrição ativa | `operational_restrictions` |
| última pesagem | `weight_records` |
| vacinação vigente | `vaccination_records` |
| plano alimentar ativo | `nutrition_plans` |
| última consulta | eventos `consultation` dentro de casos |
| caso ativo | `clinical_cases` |
| tratamento ativo | `treatment_protocols` |
| agenda pendente | `health_schedule` |
| documento | `health_documents` |

### 10.1 Vacinação

A prontidão não lê vacinação vigente de `clinical_cases/events`.

Evento clínico de vacinação existe quando há relevância clínica e referencia o `VaccinationRecord`.

### 10.2 Campos antigos

Não são fontes:

- `_last_vaccine_at`;
- `_last_exam_at`;
- `_last_weight_kg`;
- `_last_weight_at`;
- root `health_logs`;
- score client-side.

---

## 11. Dados incompletos

A política canônica propõe, sem fixar como constantes:

| Condição | Threshold proposto |
|---|---|
| sem pesagem recente | mais de 90 dias |
| vacinação vencida | `next_due` ultrapassada |
| sem consulta | mais de 180 dias |
| sem plano alimentar | nenhum plano ativo |

### 11.1 Natureza

Esses thresholds são:

- configuráveis;
- pendentes de validação operacional;
- não aprovados como constantes de código.

### 11.2 Consequência

Dados incompletos significativos geram:

```text
operational_attention
```

Não geram:

```text
temporarily_unfit
```

### 11.3 Web

A Web deverá exibir a razão específica:

- Pesagem em atraso;
- Vacinação pendente;
- Consulta desatualizada;
- Plano alimentar ausente.

### 11.4 Configuração

A interface Web futura poderá administrar configuração somente quando:

- houver modelo canônico;
- capability aprovada;
- versionamento;
- auditoria;
- valores validados.

Não criar settings locais ou constants.

---

## 12. `not_evaluated`

### 12.1 Significado

Nenhuma avaliação de saúde foi registrada no sistema.

### 12.2 Não significa

- erro;
- projection ausente por falha;
- reader sem permissão;
- K9 saudável;
- K9 inapto;
- dados parcialmente carregados.

### 12.3 Snapshot inexistente

A política canônica admite `not_evaluated` para K9 sem snapshot nunca gerado.

A Web somente mostrará esse estado quando a resposta de leitura permitir distinguir com segurança:

- consulta bem-sucedida;
- K9 válido;
- nenhuma avaliação;
- nenhuma falha de projection.

### 12.4 Falha ambígua

Se a ausência puder significar falha ou migração pendente:

```text
Estado indisponível
```

como estado técnico, sem badge de prontidão.

---

## 13. `operational`

### 13.1 Significado

Nenhuma condição anterior da matriz foi encontrada.

### 13.2 Não significa

- saúde perfeita;
- ausência absoluta de risco;
- alta performance;
- vacinação completa fora do contrato;
- ausência de doença não registrada;
- garantia clínica.

### 13.3 Texto recomendado

> Nenhuma restrição ativa ou pendência significativa identificada pelas fontes canônicas atuais.

Evitar:

> Tudo certo.

---

## 14. `operational_attention`

### 14.1 Origens

- restrição level `attention`;
- dados incompletos significativos.

### 14.2 UI

Mostrar:

- razão;
- itens de atenção;
- CTA de resolução;
- data;
- origem.

### 14.3 Ação

Permite operação com alerta, conforme política canônica.

### 14.4 Não exagerar

A cor ou hierarquia não deve sugerir bloqueio total.

---

## 15. `fit_with_restrictions`

### 15.1 Origem

Restrição parcial ativa.

### 15.2 UI

Mostrar:

- atividades restringidas;
- atividades não afetadas, quando possível;
- início;
- profissional;
- fim previsto;
- reavaliação;
- documento;
- aceite operacional quando relevante.

### 15.3 Operação

Pode operar apenas fora das atividades restringidas.

### 15.4 Lista

A tabela deverá mostrar pelo menos uma síntese:

```text
Restrição parcial: sem faro e sem esforço intenso
```

### 15.5 Drill-down

Sempre disponível para a fonte canônica.

---

## 16. `temporarily_unfit`

### 16.1 Origem

Restrição absoluta ativa.

### 16.2 UI

Destaque máximo do módulo.

Mostrar:

- bloqueio operacional;
- razão;
- início;
- profissional;
- documento;
- reavaliação;
- fim previsto;
- status de atraso;
- caso relacionado.

### 16.3 Proibição

A Web não exibirá:

- botão Liberar K9;
- override;
- ignorar;
- marcar como operacional;
- editar summary.

### 16.4 Ação permitida

Quando autorizado:

```text
Registrar encerramento da restrição
```

Essa ação exige:

- capability;
- end ProfessionalIdentity;
- end source document;
- end reason;
- actual end;
- audit.

---

## 17. Restrição `attention`

### 17.1 Semântica

Atenção profissional ativa sem bloqueio.

### 17.2 Relação com dados incompletos

Ambos podem resultar em `operational_attention`.

A UI deverá distinguir a razão:

- atenção clínica;
- lacuna de informação.

### 17.3 Razão agrupada

Se coexistirem:

- exibir ambas;
- não reduzir a “atenção geral”.

---

## 18. Vigência das restrições

| Campo | Regra |
|---|---|
| `issued_at` | início |
| `expected_end` | previsão opcional |
| `actual_end` | encerramento real |
| `status` | active/ended/cancelled |

### 18.1 Sem fim previsto

Permanece ativa.

### 18.2 `expected_end` ultrapassado

Não encerra automaticamente.

### 18.3 UI

Label:

```text
Reavaliação vencida
```

ou:

```text
Vencida, aguardando reavaliação
```

Não usar:

```text
Restrição expirada
```

se isso sugerir fim automático.

---

## 19. Encerramento da restrição

### 19.1 Responsabilidade

Profissional externo decide.

Usuário interno autorizado registra.

### 19.2 Campos obrigatórios

- `actual_end`;
- `ended_by`;
- `end_reason`;
- `end_professional` quando liberação clínica;
- `end_source_document` quando liberação clínica.

### 19.3 Web

O formulário deve apresentar claramente:

```text
Profissional que autorizou a liberação
Registrado no sistema por
```

### 19.4 Pós-comando

- restrição torna-se ended;
- Function recalcula summary;
- timeline é atualizada;
- UI mostra projection pendente;
- não simula `operational`.

---

## 20. Cancelamento administrativo

### 20.1 Diferença

Cancelamento significa erro administrativo.

Não significa alta ou liberação.

### 20.2 UI

Ação:

```text
Cancelar registro por erro
```

### 20.3 Requisitos

- capability;
- motivo;
- confirmação;
- auditoria;
- lifecycle permitido.

### 20.4 Histórico

A restrição cancelada permanece consultável.

---

# Parte I — Experiência Web

## 21. Visão Geral

### 21.1 Bloco de prontidão

Mostrar contagens por estado:

- Operacional;
- Operacional com Atenção;
- Apto com Restrições;
- Temporariamente Inapto;
- Não Avaliado.

### 21.2 Ordem

Recomendada para triagem:

1. Temporariamente Inapto;
2. Apto com Restrições;
3. Operacional com Atenção;
4. Não Avaliado;
5. Operacional.

### 21.3 Interação

Cada contagem abre `/health/readiness` filtrada.

### 21.4 Sem score

Não mostrar:

- anel percentual;
- média de prontidão;
- índice de saúde;
- nota geral;
- semáforo baseado em cálculo local.

### 21.5 Total

A soma dos cinco estados deve reconciliar com o conjunto carregado.

Se houver K9s com projection indisponível, exibir contagem separada técnica:

```text
Estado indisponível: N
```

Essa contagem não é sexto estado de prontidão.

---

## 22. Lista de Prontidão

### 22.1 Colunas mínimas

- K9;
- prontidão;
- razão;
- restrições;
- pendência principal;
- última avaliação;
- atualização;
- ação.

### 22.2 Colunas opcionais

- casos ativos;
- tratamentos;
- agenda;
- plano alimentar;
- cobertura de dados;
- indicador legacy;
- conflict.

### 22.3 Ordenação padrão

1. `temporarily_unfit`;
2. `fit_with_restrictions`;
3. `operational_attention`;
4. `not_evaluated`;
5. `operational`.

Dentro do grupo:

1. restrição vencida;
2. pendência atrasada;
3. projection stale;
4. atualização mais antiga;
5. nome.

### 22.4 Filtros

- estado;
- nível de restrição;
- categoria;
- atividade restringida;
- dados incompletos;
- reavaliação vencida;
- stale;
- conflict;
- K9;
- unidade/escopo.

### 22.5 Filtro técnico

Filtros técnicos devem ficar em área “Qualidade dos dados” ou equivalente.

Não misturar `stale` com os cinco estados.

---

## 23. Badge de prontidão

### 23.1 Conteúdo

- label completo;
- ícone;
- token semântico;
- texto acessível.

### 23.2 Não depender de cor

O badge deve ser compreensível em:

- escala de cinza;
- leitor de tela;
- daltonismo;
- impressão.

### 23.3 Tooltip

Pode mostrar:

- razão;
- atualização;
- fonte.

### 23.4 Não mostrar enum técnico

Não exibir `temporarily_unfit` ao usuário comum.

---

## 24. Cores semânticas

Este documento não fixa hexadecimais.

Categorias conceituais:

| Estado | Token semântico |
|---|---|
| operational | success |
| operational_attention | warning |
| fit_with_restrictions | restricted/caution |
| temporarily_unfit | critical |
| not_evaluated | neutral |

### 24.1 Atenção

`fit_with_restrictions` e `operational_attention` devem ser distinguíveis além da cor.

### 24.2 Identidade visual

O design tático dark/cyan do K9 Ops permanece.

Cyan não deve ser usado sozinho para comunicar segurança clínica.

---

## 25. Razões de prontidão

### 25.1 Fonte

`readiness_reason` e evidências relacionadas.

### 25.2 Formato

Razão curta na lista.

Explicação completa no cockpit.

### 25.3 Exemplos aceitáveis

- Restrição absoluta ativa;
- Restrição parcial de esforço;
- Monitoramento pós-consulta;
- Pesagem em atraso;
- Sem plano alimentar ativo;
- Nenhuma avaliação registrada.

### 25.4 Proibição

- gerar texto com IA sem contrato;
- sintetizar diagnóstico;
- ocultar múltiplas razões;
- usar termos vagos como “atenção necessária”.

---

## 26. Cockpit individual

### 26.1 Cabeçalho

Mostrar:

- K9;
- estado;
- razão;
- atualização;
- última avaliação;
- status técnico;
- CTA contextual.

### 26.2 Zona de restrições

Mostrar todas as restrições ativas, ordenadas por:

```text
absolute > partial > attention
```

### 26.3 Zona de evidências

- peso;
- vacinação;
- consulta;
- plano alimentar;
- casos;
- tratamentos;
- agenda.

### 26.4 Zona de temporalidade

- projection atualizada em;
- restrição emitida em;
- fim previsto;
- reavaliação;
- data efetiva;
- data de registro.

### 26.5 Zona de ação

Ações somente por capability.

Não mostrar ação para mudar prontidão.

---

## 27. Painel “Por que este estado?”

### 27.1 Objetivo

Explicar precedência e fontes.

### 27.2 Conteúdo

- condição determinante;
- outras condições coexistentes;
- evidências;
- source entity;
- data;
- link;
- regra de precedência.

### 27.3 Exemplo

```text
Temporariamente Inapto
Condição determinante: restrição absoluta ativa.
Outras condições: pesagem em atraso.
```

### 27.4 Transparência

A Web pode mostrar:

```text
A restrição absoluta prevalece sobre as demais condições.
```

---

## 28. Histórico de prontidão

### 28.1 Status canônico

Histórico de snapshots é desejável, mas baixa prioridade/v1.1 na política de origem.

### 28.2 V1 Web

Não depender de:

```text
readiness_history
```

até existir contrato implantado.

### 28.3 Alternativa

A timeline pode mostrar eventos que explicam mudanças:

- restrição emitida;
- restrição encerrada;
- avaliação;
- correção de dados;
- plano ativado;
- vacinação;
- pesagem.

### 28.4 Proibição

Não reconstruir retroativamente estados oficiais no browser sem projection aprovada.

---

## 29. Agenda e prontidão

### 29.1 Agenda atrasada

Pode gerar atenção se a política Backend assim determinar.

### 29.2 Web

Mostra:

- item;
- atraso;
- relação com razão;
- ação de resolver.

### 29.3 Não fazer

- alterar status localmente;
- criar restrição;
- marcar inapto;
- concluir automaticamente.

### 29.4 Reavaliação

Restrição com fim previsto pode gerar item automático de reavaliação.

---

## 30. Casos clínicos e prontidão

### 30.1 Caso aberto

Não muda prontidão automaticamente apenas por estar aberto.

### 30.2 Restrição vinculada

A restrição, não o caso, determina o bloqueio.

### 30.3 Web

Mostrar relação:

```text
Caso clínico
→ evento
→ restrição
→ prontidão
```

### 30.4 Tratamento

Tratamento ativo não implica estado específico sem regra canônica.

---

## 31. Nutrição e prontidão

### 31.1 Plano ausente

Pode ser dado incompleto significativo, configurável.

### 31.2 Conflito

Múltiplos planos ativos:

- `conflict` técnico;
- não escolher primeiro;
- impedir gestão incompatível;
- informar possível impacto na projection.

### 31.3 Plano legado

Mostrar `legacy`.

Não usá-lo como ativo canônico sem reader de coexistência aprovado.

### 31.4 Execução de refeição

Não deve alterar prontidão diretamente no cliente.

---

## 32. Peso e prontidão

### 32.1 Peso desatualizado

Pode gerar attention conforme threshold configurado.

### 32.2 Peso fora de faixa

A política canônica deve definir o impacto.

A Web não inventará classificação.

### 32.3 Tendência

É informativa.

Não altera prontidão localmente.

### 32.4 Fonte

`weight_records`.

Não `_last_weight_*`.

---

## 33. Vacinação e prontidão

### 33.1 Fonte

`vaccination_records`.

### 33.2 Vencimento

Segue `next_due` ou contrato preventivo.

### 33.3 Proibição

Não usar fallback universal de 365 dias.

### 33.4 Evento clínico

Reação adversa pode criar caso e restrição.

O evento não substitui o record preventivo.

---

# Parte II — Estados técnicos

## 34. Estados técnicos suportados

- loading;
- refreshing;
- empty;
- partial;
- degraded;
- stale;
- legacy;
- conflict;
- unauthorized;
- forbidden;
- not_found;
- error.

### 34.1 Separação

Nenhum deles é estado de prontidão.

---

## 35. Loading

### 35.1 Lista

Usar skeleton.

Não mostrar contagens zero.

### 35.2 Cockpit

Não reutilizar badge do K9 anterior.

### 35.3 Ação

Writes não devem ser liberados até capability e fontes necessárias carregarem.

---

## 36. Empty

### 36.1 Efetivo vazio

Não existem K9s no escopo.

### 36.2 Filtro vazio

Nenhum K9 corresponde aos filtros.

### 36.3 Restrição vazia

Não existem restrições no conjunto consultado.

### 36.4 Não confundir

Empty da lista de restrições não é automaticamente `operational`.

O summary continua autoridade de display.

---

## 37. Partial

### 37.1 Exemplo

Summary carregou, mas restrições detalhadas falharam.

### 37.2 UI

- manter badge;
- indicar detalhe indisponível;
- não permitir ação dependente;
- tentar novamente.

### 37.3 Lista global

Contagens podem ser parciais.

Informar cobertura:

```text
9 de 10 K9s com prontidão carregada
```

---

## 38. Degraded

### 38.1 Web

A Web não é canal offline operacional prioritário.

`degraded` pode ocorrer quando:

- projection canônica indisponível;
- reader de coexistência aprovado retorna legacy;
- serviço secundário falha;
- cache seguro é usado para leitura.

### 38.2 Regra

Modo degradado Web não autoriza ações críticas.

---

## 39. Stale

### 39.1 Política canônica online

Display deve disparar refresh quando o snapshot ultrapassa 5 minutos.

### 39.2 Natureza

A idade de 5 minutos vem da política aprovada.

A implementação final deve confirmar:

- campo temporal;
- mecanismo de refresh;
- timezone;
- projection SLA.

### 39.3 UI

Mostrar:

- Atualizado há X;
- Atualizando;
- Dados podem estar desatualizados.

### 39.4 Ação

A Web pode solicitar refresh.

Não recalcula.

### 39.5 Após write

Pode mostrar:

```text
A prontidão está sendo atualizada.
```

---

## 40. Legacy

### 40.1 Score

Não será exibido no novo Health Web v1.

### 40.2 Registros

Registros legados podem aparecer como evidência histórica com badge.

### 40.3 Motivo da decisão Web

A política canônica permite que o score legado coexistisse durante transição.

A baseline Web registra que:

- a interface antiga não é usada;
- não há obrigação de continuidade;
- o novo módulo pode ser criado sem esse indicador.

Portanto, a política Web é mais restritiva:

```text
score legado não entra no novo Health Web v1
```

### 40.4 Preservação

O dado pode continuar existindo tecnicamente durante migração.

Não aparece como indicador de prontidão.

---

## 41. Conflict

### 41.1 Casos

- summary operational + restriction absoluta ativa;
- summary mais antigo que restrição;
- múltiplos planos ativos;
- razões incompatíveis;
- projection version incompatível;
- dados canônicos duplicados;
- restrições contraditórias em conteúdo, embora a mais restritiva prevaleça.

### 41.2 UI

- banner;
- origem;
- impacto;
- refresh;
- abrir fontes;
- bloquear ações incompatíveis.

### 41.3 Lista

Um K9 com conflict pode manter o badge projetado, mas deve exibir indicador técnico crítico.

### 41.4 Ação crítica

Backend fail-closed com fonte canônica.

---

## 42. Error

### 42.1 Sem cache confiável

Mostrar:

```text
Estado de prontidão indisponível
```

### 42.2 Com último valor

Pode mostrar último valor com:

- horário;
- erro;
- stale;
- sem sugerir atualidade.

### 42.3 Não mostrar

- Não Avaliado;
- Operacional;
- zero;
- badge cinza sem explicação.

---

## 43. Unauthorized e forbidden

### 43.1 Unauthorized

Sessão ausente/inválida.

### 43.2 Forbidden

Usuário autenticado sem `health.read` ou scope.

### 43.3 Segurança

Não carregar dados antes do guard.

---

# Parte III — Freshness

## 44. Metadados mínimos

A projection deverá fornecer ou permitir derivar:

- computed/updated at;
- version;
- last evaluated at;
- evaluator;
- source freshness;
- schema version.

### 44.1 Campo final

O nome exato será reconciliado com o contrato implantado.

### 44.2 UI comum

Não mostrar version técnica em todo card.

### 44.3 Painel técnico

Pode mostrar em:

- conflict;
- suporte;
- auditoria;
- diagnóstico.

---

## 45. Refresh

### 45.1 Automático

Ao abrir:

- Visão Geral;
- Prontidão;
- cockpit;
- depois de write relevante;
- quando idade > 5 min.

### 45.2 Manual

Botão Atualizar.

### 45.3 Proteção

Evitar refresh storm.

### 45.4 Resposta

Atualizar leitura.

Não chamar função de cálculo indiscriminadamente, salvo endpoint administrativo aprovado.

---

## 46. Projection lag

### 46.1 Estado esperado

Após mutação:

1. fonte canônica salva;
2. audit registrado;
3. comando retorna;
4. projection atualiza;
5. UI recebe novo estado.

### 46.2 UX

Mostrar progressão:

```text
Restrição registrada
→ Atualizando prontidão
→ Prontidão atualizada
```

### 46.3 Timeout

Se exceder SLA:

- stale/pending;
- retry;
- suporte;
- não desfazer o write canônico.

---

# Parte IV — Responsabilidade e ações

## 47. Emitir restrição

### 47.1 Capability

```text
health.issue_restriction
```

### 47.2 Perfil

Conforme Permission Matrix candidata e aprovação futura.

### 47.3 Evidência

- ProfessionalIdentity;
- source document;
- nível;
- categoria;
- descrição;
- atividades;
- vigência;
- RecordedBy.

### 47.4 Web

A ação não é:

```text
Definir prontidão
```

É:

```text
Registrar restrição operacional
```

---

## 48. Encerrar restrição

### 48.1 Capability

```text
health.release_restriction
```

### 48.2 Ação

```text
Registrar encerramento da restrição
```

### 48.3 Não usar

- Marcar como apto;
- Liberar sem documento;
- Alterar badge;
- Resolver atenção.

---

## 49. Cancelar restrição

### 49.1 Capability

A reconciliar com:

```text
health.cancel_record
```

### 49.2 Ação

Administrativa.

### 49.3 Não substitui

Encerramento clínico.

---

## 50. Reavaliação

A Web pode:

- criar agenda;
- abrir caso;
- registrar documento;
- registrar encerramento;
- registrar nova restrição.

A Web não renova automaticamente uma restrição.

Nova decisão pode exigir novo agregado, conforme contrato.

---

## 51. Override

Não existe override de prontidão no Health v1.

### 51.1 Admin

Admin não pode:

- editar summary;
- ignorar absolute;
- trocar enum;
- liberar K9.

### 51.2 Necessidade futura

Qualquer necessidade deverá ser tratada como:

- encerramento;
- cancelamento administrativo;
- nova decisão;
- correção por amendment;
- reconciliação.

---

# Parte V — Política operacional exibida na Web

## 52. Impacto no turno

| Estado | Mensagem Web |
|---|---|
| operational | disponível para operação |
| operational_attention | disponível com atenção |
| fit_with_restrictions | disponibilidade condicionada às atividades |
| temporarily_unfit | bloqueio operacional |
| not_evaluated | avaliação pendente; operação conforme política |

### 52.1 Limite

A Web informa.

O Backend do turno autoriza.

---

## 53. Impacto por atividade

Para `fit_with_restrictions`, a Web deve mostrar:

- atividades restringidas;
- escopo;
- vigência;
- fonte.

### 53.1 Não inferir

Atividade ausente da lista não é garantia absoluta se o contrato possui categorias mais amplas.

A modelagem de atividades deve ser validada.

---

## 54. Aceite operacional

### 54.1 Política Mobile

A política canônica prevê aceite para:

- `fit_with_restrictions`;
- certos cenários offline.

### 54.2 Web

A Web pode consultar registros de aceite.

Não é o canal primário para iniciar turno.

### 54.3 Natureza

Aceite:

- registra ciência;
- não muda prontidão;
- não encerra restrição;
- não é override.

---

# Parte VI — Score legado e IPO

## 55. Score legado

### 55.1 Fonte

`Dog.calculateReadiness()` ou equivalente client-side antigo.

### 55.2 Autoridade

Nenhuma sobre a prontidão Health v1.

### 55.3 Política canônica de origem

Poderia coexistir como indicador secundário durante transição.

### 55.4 Decisão Web

Não exibir no novo módulo.

### 55.5 Justificativa

- experiência antiga sem uso operacional;
- ausência de obrigação de continuidade;
- risco de confusão;
- score mistura conceitos;
- novo módulo nasce canônico;
- futuro IPO será outra entidade.

### 55.6 Código

Pode ser removido do fluxo Health após auditoria de dependências.

---

## 56. Cobertura de evidências

### 56.1 Uso permitido

A Web pode mostrar:

```text
Cobertura de evidências de saúde
```

### 56.2 Natureza

Completude, não prontidão.

### 56.3 Conteúdo

- peso recente;
- vacinação vigente;
- consulta recente;
- plano ativo;
- outros indicadores aprovados.

### 56.4 Não fazer

- converter em score de saúde;
- usar como bloqueio;
- chamar “índice”;
- ocultar quais evidências faltam.

---

## 57. IPO futuro

### 57.1 Fora do v1

O IPO não será implementado neste programa inicial.

### 57.2 Invariante

Nunca sobrescreve restrição absoluta.

### 57.3 Web futura

Pode ser configurado ou analisado quando houver:

- ADR;
- pesos;
- fontes;
- testes;
- governança;
- explicabilidade.

### 57.4 Reserva visual

Não criar card vazio de IPO no v1.

---

# Parte VII — Relatórios

## 58. Relatório de prontidão

Pode conter:

- distribuição por estado;
- K9s por estado;
- restrições por nível;
- duração;
- reavaliações;
- dados incompletos;
- freshness;
- conflitos;
- evolução por eventos.

### 58.1 Não conter

- média de score legado;
- ranking de saúde;
- previsão clínica;
- comparação sem contexto;
- classificação inventada.

### 58.2 Snapshot histórico

Relatório temporal de estados oficiais depende de histórico projetado confiável.

Sem ele, usar eventos e declarar a limitação.

---

## 59. Exportação

Requer:

- capability;
- escopo;
- filtros;
- timestamp;
- autor;
- cobertura;
- freshness;
- auditoria.

### 59.1 PII

Minimizar ProfessionalIdentity conforme finalidade.

---

# Parte VIII — Acessibilidade e linguagem

## 60. Linguagem

### 60.1 Evitar

- cão doente;
- saúde ruim;
- score baixo;
- reprovado;
- liberado pelo sistema;
- expiração automática;
- sem problemas.

### 60.2 Preferir

- restrição ativa;
- avaliação pendente;
- atenção;
- dados incompletos;
- estado indisponível;
- aguardando reavaliação;
- operação condicionada.

---

## 61. Acessibilidade

- label textual;
- ícone;
- contraste;
- sem dependência exclusiva de cor;
- descrição em leitor de tela;
- tabela semântica;
- foco;
- banners anunciados;
- estados dinâmicos com live region moderada;
- gráfico com alternativa tabular.

---

# Parte IX — Observabilidade e auditoria

## 62. Eventos técnicos

- summary loaded;
- summary missing;
- summary stale;
- summary conflict;
- projection pending;
- refresh requested;
- refresh failed;
- restrictions mismatch;
- score legacy rendered — deve permanecer zero;
- unauthorized;
- forbidden.

### 62.1 Privacidade

Não registrar:

- descrição clínica integral;
- documento;
- CRMV desnecessário;
- PII;
- conteúdo de laudo.

---

## 63. Auditoria de domínio

Registrar:

- restrição emitida;
- restrição encerrada;
- cancelamento;
- ProfessionalIdentity referenciada;
- RecordedBy;
- evidence refs;
- operationId;
- resultado;
- projection update;
- conflito/reconciliação.

---

# Parte X — Testes

## 64. Estados oficiais

- cada enum mapeia ao label correto;
- enum desconhecido não vira operational;
- nenhum sexto estado;
- ordenação;
- filtros;
- acessibilidade.

---

## 65. Precedência

1. absolute + partial + attention → temporarily_unfit;
2. partial + attention → fit_with_restrictions;
3. attention → operational_attention;
4. nunca avaliado → not_evaluated;
5. histórico + dado incompleto → operational_attention;
6. sem condições → operational.

### 65.1 Web

Testa renderização com fixtures server-derived.

Não testa cálculo local como feature.

---

## 66. Display × autorização

- summary operational + absolute active;
- Web mostra conflict;
- Backend bloqueia ação;
- summary stale;
- restriction recente;
- projection atualiza;
- nenhuma ação usa summary como única barreira.

---

## 67. Ausência e erro

- snapshot confirmado inexistente para nunca avaliado;
- query permission denied;
- K9 not found;
- network error;
- Function lag;
- cache presente;
- cache ausente;
- ausência ambígua;
- not_evaluated não aparece em erro.

---

## 68. Freshness

- menos de 5 min;
- mais de 5 min;
- refresh;
- refresh concorrente;
- projection pending;
- timezone;
- relógio do cliente incorreto;
- server timestamp;
- stale persisted across navigation.

---

## 69. Restrições

- expected_end passado continua ativa;
- sem expected_end;
- ended;
- cancelled;
- duas simultâneas;
- partial activities;
- attention clínica;
- professional;
- document;
- end evidence;
- cancelamento administrativo.

---

## 70. Dados incompletos

- threshold configurado;
- threshold alterado;
- sem peso;
- vacina vencida;
- consulta antiga;
- plano ausente;
- combinação;
- não gerar temporarily_unfit;
- não hardcode 90/180 no componente.

---

## 71. Score legado

- não renderizado;
- não entra em filtro;
- não entra em relatório;
- não entra em export;
- não altera badge;
- código antigo não alimenta summary;
- analytics confirma zero uso.

---

## 72. Conflict

- mismatch summary/restriction;
- múltiplos planos;
- projection version;
- duplicate sources;
- refresh resolve;
- refresh não resolve;
- action blocked;
- banner acessível.

---

## 73. Permissions

- health.read;
- sem health.read;
- issue restriction;
- release restriction;
- cancel record;
- admin sem evidence;
- specialty Veterinário;
- scope;
- dog access;
- deep link;
- Backend denial.

---

# Parte XI — Riscos

## 74. RDY-RISK-001 — Score reaparecer

**Mitigação:** proibição documental e teste.

## 75. RDY-RISK-002 — Error virar not_evaluated

**Mitigação:** estados técnicos separados.

## 76. RDY-RISK-003 — Summary autorizar ação

**Mitigação:** Backend consulta restrictions.

## 77. RDY-RISK-004 — expected_end encerrar

**Mitigação:** lifecycle explícito.

## 78. RDY-RISK-005 — Threshold hardcoded

**Mitigação:** configuração server-side.

## 79. RDY-RISK-006 — Cor como único sinal

**Mitigação:** label/ícone/texto.

## 80. RDY-RISK-007 — Dados incompletos bloquearem

**Mitigação:** attention, não unfit.

## 81. RDY-RISK-008 — Ausência significar operational

**Mitigação:** source authority.

## 82. RDY-RISK-009 — Conflict oculto

**Mitigação:** banner e fail-closed.

## 83. RDY-RISK-010 — Admin fazer override

**Mitigação:** nenhum comando de override.

## 84. RDY-RISK-011 — Lista N+1

**Mitigação:** projections agregadas.

## 85. RDY-RISK-012 — Histórico inventado

**Mitigação:** não reconstruir estados sem projection.

## 86. RDY-RISK-013 — ProfessionalIdentity excessiva na lista

**Mitigação:** projection mínima.

## 87. RDY-RISK-014 — Snapshot stale parecer atual

**Mitigação:** freshness explícita.

---

# Parte XII — Decisões fixadas

## 88. Decisões

1. A Web usa somente os cinco estados oficiais.
2. A Web não calcula prontidão.
3. `health_summary/current` é fonte de display.
4. `operational_restrictions` é fonte de autorização.
5. Restrição absolute prevalece.
6. Restrição partial prevalece sobre attention.
7. Nunca avaliado é diferente de dados incompletos.
8. Dados incompletos geram attention, não unfit.
9. Thresholds 90/180 não são constants aprovadas.
10. Vacinação vem de `vaccination_records`.
11. expected_end não encerra restrição.
12. Encerramento é explícito e auditado.
13. ProfessionalIdentity é externa.
14. RecordedBy é interno.
15. Não existe role vet.
16. UI não oferece override.
17. Erro não vira not_evaluated.
18. Conflict é explícito.
19. Freshness é exibida.
20. Refresh online é esperado acima de 5 min.
21. Web não é canal operacional offline prioritário.
22. Score legado não será exibido no novo Health Web.
23. Cobertura de dados não é prontidão.
24. IPO fica fora do v1.
25. Histórico de snapshots não é dependência do v1.
26. Lista prioriza estados mais restritivos.
27. Restrição parcial exibe atividades afetadas.
28. Restrição absoluta recebe destaque máximo.
29. Ação crítica valida fonte canônica.
30. Após write, a UI aguarda projection.

---

# Parte XIII — Decisões humanas pendentes

## 89. Thresholds

- validar peso;
- validar consulta;
- validar vacinação;
- validar plano;
- definir configuração;
- definir owner.

## 90. Freshness

- confirmar 5 min para Web;
- SLA de projection;
- timeout de pending;
- refresh automático;
- reconciliação.

## 91. Instrutor

- profundidade da leitura;
- PII;
- restrições;
- casos;
- documentos.

## 92. Profissional

- campos exibidos em listas;
- campos do cockpit;
- policy de PII;
- exportação.

## 93. Histórico

- readiness_history v1.1;
- retenção;
- reconstrução;
- relatório temporal.

## 94. UI

- tokens semânticos;
- ícones;
- texto dos banners;
- tabela versus cards;
- densidade do cockpit.

## 95. Operação

- aceite para fit_with_restrictions;
- visualização dos aceites na Web;
- investigação pós-offline;
- incident automation.

---

# Parte XIV — Gates

## 96. Gate RDY-1 — Contrato de summary

Confirmar campos reais e versionamento.

## 97. Gate RDY-2 — Restriction queries

Confirmar índices e callable de autorização.

## 98. Gate RDY-3 — Threshold config

Definir onde vivem os thresholds.

## 99. Gate RDY-4 — Freshness

Aprovar SLA e refresh.

## 100. Gate RDY-5 — Conflict

Definir detection/reconciliation.

## 101. Gate RDY-6 — Permission

Aprovar health.read, issue e release.

## 102. Gate RDY-7 — Mockups

Produzir:

- overview;
- list;
- cockpit;
- restrictions;
- stale;
- conflict;
- error;
- not evaluated.

## 103. Gate RDY-8 — Testes

Executar unit, integration, emulator e cross-platform.

## 104. Gate RDY-9 — Score legado

Confirmar zero dependência antes da remoção.

## 105. Gate RDY-10 — Aprovação humana

Aprovar política visual e operacional.

---

## 106. Critérios de aprovação

Este documento estará aprovado quando:

- os cinco estados estiverem aceitos;
- labels estiverem reconciliados;
- precedência estiver preservada;
- display e autorização estiverem separados;
- absence/error estiverem separados;
- freshness estiver definida;
- conflict estiver definido;
- score legado estiver formalmente excluído;
- thresholds continuarem configuráveis;
- ProfessionalIdentity estiver protegida;
- ações de restrição estiverem alinhadas às capabilities;
- mockups puderem ser produzidos sem inventar regra.

---

## 107. Documentos derivados

Esta política alimenta:

- `HEALTH_WEB_IMPLEMENTATION_ROADMAP.md`;
- `HEALTH_WEB_MOCKUP_PLAN.md`;
- `HEALTH_WEB_TEST_STRATEGY.md`;
- ADR de source of truth da prontidão;
- contratos de `health_summary`;
- contratos de restrições;
- componentes ReadinessBadge e ConflictBanner.

---

## 108. Próximo documento recomendado

Com a fundação de domínio, dados, plataformas, capabilities, permissões e prontidão concluída, o próximo documento deverá ser:

```text
docs/health/web/implementation/HEALTH_WEB_IMPLEMENTATION_ROADMAP.md
```

Ele organizará:

- fases;
- gates;
- dependências;
- entregas;
- ordem de mockups;
- readers;
- projections;
- permissões;
- migração;
- integração de Nutrição;
- testes;
- ativação.

---

## 109. Status

| Item | Estado |
|---|---|
| Estados oficiais | Incorporados |
| Precedência | Incorporada |
| Display × autorização | Formalizado |
| Lista Web | Especificada |
| Cockpit | Especificado |
| Estados técnicos | Especificados |
| Freshness | Política incorporada; validação pendente |
| Thresholds | Mantidos configuráveis |
| Score legado | Excluído do novo Web |
| IPO | Fora do v1 |
| Aprovação humana | Pendente |
| Aprovação para implementação | Não concedida |

---

## 110. Conclusão

O Health Web v1 passa a possuir uma política inequívoca de prontidão.

A Web mostrará:

```text
estado oficial
+ razão
+ evidências
+ restrições
+ freshness
+ qualidade dos dados
```

Ela não mostrará:

```text
score legado
+ cálculo client-side
+ override
+ estado inventado
+ falsa certeza
```

Quando houver restrição, a Web explicará.

Quando houver lacuna, a Web identificará.

Quando houver conflito, a Web não esconderá.

Quando houver erro, a Web não chamará o K9 de “Não Avaliado”.

E quando uma ação operacional crítica for realizada, a autoridade continuará sendo a restrição canônica validada pelo Backend.
