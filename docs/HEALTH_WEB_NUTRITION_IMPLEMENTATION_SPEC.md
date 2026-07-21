# Health v1.0 — Nutrição Web · Especificação Visual e de Produto

| Campo | Valor |
|---|---|
| Status | Reconciliação documental concluída |
| Módulo | Health v1.0 · Nutrição Web |
| Escopo | Visão geral, planos alimentares, execução, histórico e wizard de criação |
| Fonte visual | Mockups Web 01–10 |
| Princípio | **Web define · Mobile executa** |
| Público principal | Gestores e usuários internos autorizados |
| Fora de escopo | Reimplementação do domínio Health, alteração de contratos canônicos, medicação clínica, protocolos terapêuticos |

---

## AVISO DE AUTORIDADE

> Este documento consolida a visão visual e de produto da Nutrição Web.
> Ele **não altera** o contrato canônico Health v1.0.
>
> Quando um mockup representar funcionalidade ainda inexistente no domínio,
> o elemento deve ser tratado como **evolução futura**.
>
> Em caso de conflito, ADRs, Domain Model, Firestore Schema,
> Permission Matrix e contratos implementados prevalecem.

---

# 1. Objetivo

Este documento consolida a especificação visual e de fluxo do submódulo **Nutrição Web** do K9 Ops a partir dos 10 mockups aprovados.

Seu objetivo é servir como referência visual para implementação, reduzindo ambiguidades entre telas, evitando divergências de nomenclatura e preservando as decisões arquiteturais já aprovadas para o Health v1.0.

A regra central permanece:

> **A Web planeja e administra. O Mobile consulta e executa.**

Na Nutrição:

- a Web cria, revisa e gerencia `NutritionPlan`;
- o Mobile recebe o planejamento vigente e registra a execução operacional;
- `MealLog` e `SupplementLog` representam fatos de execução;
- a Web acompanha execução, divergências e histórico, mas não simula o papel operacional do Mobile.

Este documento **não substitui** os contratos de domínio, Firestore, permissões, ADRs ou decisões canônicas anteriores. Em caso de conflito, os documentos arquiteturais aprovados prevalecem.

---

# 2. Contrato V1 Implementado

## 2.1 Status de Lifecycle

Os status **realmente implementados** no contrato atual são:

| Status | Descrição |
|---|---|
| `active` | Plano atualmente em vigor |
| `superseded` | Plano substituído por um novo |
| `cancelled` | Plano cancelado pelo usuário |

**IMPORTANTE:** Os status abaixo **NÃO existem** no contrato atual:

- `draft` (Rascunho)
- `scheduled` (Programado)
- `programmed` (Programado - sinônimo)
- `ended` (Encerrado)

## 2.2 Regras Temporais

**Regra crítica implementada:**

> `validFrom` deve ser `<= server_now`
>
> Planos com `validFrom` no futuro **NÃO são permitidos** no contrato atual.

**Implicações:**

- Não existe atualmente agendamento futuro de plano
- Não existe autoativação por data
- Não existe coexistência de `active` + `scheduled`
- Não existe cron/job de ativação futura

## 2.3 Mutações Implementadas

| Mutação | Descrição | Resultado |
|---|---|---|
| **CREATE** | Cria novo plano | Plano torna-se `active` se não houver outro |
| **UPDATE** (administrativo) | Altera campos administrativos | `revision` + 1 |
| **REPLACE** (estrutural) | Cria novo plano, supersede anterior | Novo plano `active`, anterior `superseded` |
| **CANCEL** | Cancela plano ativo | Plano torna-se `cancelled`, pode haver 0 planos ativos |

**Nomenclatura correta:**

- NÃO usar "UPDATE estrutural" — usar "REPLACE estrutural"
- NÃO usar "exclusão" — usar "CANCEL"

---

# 3. Campos Canônicos Atuais

Os campos **realmente persistidos** no contrato atual são:

| Campo | Tipo | Descrição |
|---|---|---|
| `foodType` | string | Tipo de alimento |
| `amountGramsPerDay` | number | Meta diária em gramas |
| `mealsPerDay` | number | Número de refeições |
| `mealSchedule` | MealScheduleSlot[] | Grade de refeições |
| `supplements` | SupplementRegimen[] | Suplementos |
| `hydrationMl` | number | Hidratação em ml |
| `timezone` | string | Timezone |
| `validFrom` | Date | Início de vigência |
| `validUntil` | Date (opcional) | Fim de vigência |
| `specialInstructions` | string (opcional) | Instruções especiais |
| `professional` | ProfessionalIdentity (opcional) | Profissional externo |
| `sourceDocument` | HealthDocumentRef (opcional) | Documento de referência |
| `attachmentRefs` | string[] (opcional) | Referências de anexos |

### MealScheduleSlot

| Campo | Tipo |
|---|---|
| `id` | string |
| `period` | "morning" \| "afternoon" \| "evening" \| "night" \| "extra" |
| `scheduledTime` | string |
| `targetGrams` | number |

### ProfessionalIdentity

| Campo | Tipo |
|---|---|
| `name` | string |
| `registration_type` | string |
| `registration_number` | string |
| `clinic` | string (opcional) |
| `specialty` | string (opcional) |

### HealthDocumentRef

| Campo | Tipo |
|---|---|
| `health_document_id` | string |
| `description` | string (opcional) |

---

# 4. Matriz de Status dos 10 Mockups

| Mockup | Área | Descrição | Status Funcional | Classificação |
|---|---|---|---|---|
| 01 | Visão Geral | Dashboard executivo com KPIs | Parcial | **REFERÊNCIA VISUAL + FUTURE FEATURE** |
| 02 | Planos Alimentares | Gestão administrativa | Implementado | **V1 + REFERÊNCIA VISUAL** |
| 03 | Execução | Acompanhamento operacional | Parcial | **FUTURE FEATURE + REFERÊNCIA VISUAL** |
| 04 | Histórico | Timeline nutricional | Parcial | **FUTURE FEATURE + REFERÊNCIA VISUAL** |
| 05 | Wizard — Identificação | Step 1 do wizard | Sem draft persistido | **REFERÊNCIA VISUAL + FUTURE FEATURE** |
| 06 | Wizard — Alimentação | Step 2 do wizard | Sem draft persistido | **REFERÊNCIA VISUAL + FUTURE FEATURE** |
| 07 | Wizard — Refeições | Step 3 do wizard | Sem draft persistido | **REFERÊNCIA VISUAL + FUTURE FEATURE** |
| 08 | Wizard — Suplementos | Step 4 do wizard | Sem draft persistido | **REFERÊNCIA VISUAL + FUTURE FEATURE** |
| 09 | Wizard — Vigência | Step 5 do wizard | Sem draft persistido | **REFERÊNCIA VISUAL + FUTURE FEATURE** |
| 10 | Wizard — Revisão | Step 6 do wizard | Sem draft persistido | **REFERÊNCIA VISUAL + FUTURE FEATURE** |

### Classificações

- **V1 IMPLEMENTADO**: Existe atualmente no contrato e/ou aplicação
- **REFERÊNCIA VISUAL**: Pode orientar layout, hierarquia, componentes, mas não representa comportamento disponível
- **EVOLUÇÃO FUTURA**: Exige novo contrato, nova mutation, nova collection ou novo gate arquitetural

---

# 5. Matriz de Capacidades

## 5.1 Capacidades Implementadas (V1)

| Capacidade | Status | Notas |
|---|---|---|
| CREATE | ✅ Implementado | Cria novo plano ativo |
| UPDATE administrativo | ✅ Implementado | Altera campos administrativos |
| REPLACE estrutural | ✅ Implementado | Cria novo, supersede anterior |
| CANCEL | ✅ Implementado | Cancela plano ativo |
| Read model / resolução do estado nutricional atual | ✅ Implementado | Resolve o estado nutricional atual sem prometer uma experiência completa de listagem |
| Visualização básica | ✅ Implementado | Via Mockup 02 |

## 5.2 Capacidades Futuras (Não Implementadas)

| Capacidade | Status | Notas |
|---|---|---|
| SAVE DRAFT | ❌ Não implementado | Requer persistência de rascunho |
| RESUME DRAFT | ❌ Não implementado | Requer estado de rascunho |
| SCHEDULE | ❌ Não implementado | Requer `validFrom` futuro |
| AUTO ACTIVATE | ❌ Não implementado | Requer cron/job |
| EXECUTION WEB WRITE | ❌ Não implementado | Web não registra execução |
| FUTURE PLAN QUEUE | ❌ Não implementado | Requer estado `scheduled` |
| Visão Geral completa | ❌ Não implementado | Dashboards agregados |
| Execução completa | ❌ Não implementado | Página completa |
| Histórico completo | ❌ Não implementado | Página completa |

---

# 6. Campos dos Mockups Exigindo Reconciliação

Os mockups apresentam campos/conceitos que **não existem** no contrato atual:

| Conceito (Mockup) | Classificação | Ação Recomendada |
|---|---|---|
| Nome do plano | REFERÊNCIA VISUAL / FUTURE FEATURE | Não existe campo canônico nem regra de derivação implementada — requer nova regra explícita de derivação ou novo campo no contrato |
| Objetivo nutricional | FUTURE FEATURE | Requer campo no contrato |
| Estratégia alimentar | FUTURE FEATURE | Requer campo no contrato |
| Marca | FUTURE FEATURE | Requer campo no contrato |
| Linha/apresentação | FUTURE FEATURE | Requer campo no contrato |
| Condição corporal alvo | FUTURE FEATURE | Requer campo no contrato |
| Tolerância por refeição | FUTURE FEATURE | Requer campo no contrato |
| Percentual da meta | FUTURE FEATURE | Requer campo no contrato |
| Rotina/contexto | FUTURE FEATURE | Requer campo no contrato |
| Categoria do suplemento | FUTURE FEATURE | Requer campo no contrato |
| Vínculo suplemento/refeição | FUTURE FEATURE | Requer nova estrutura |
| Forma de administração | FUTURE FEATURE | Requer campo no contrato |
| Observações administrativas | DERIVÁVEL | Mapear para `specialInstructions` |
| Estado "Rascunho" | FUTURE FEATURE | Requer mutation e lifecycle |
| Estado "Programado" | FUTURE FEATURE | Requer mutation e lifecycle |

**Regra:** Não mapear silenciosamente campos novos para `specialInstructions` apenas para fazer o mockup "caber".

---

# 7. Escopo do Módulo Nutrição Web

## 7.1 Áreas Principais

1. **Planos Alimentares** — gestão administrativa (Mockup 02) — **IMPLEMENTADO**
2. **Visão Geral** — visão executiva (Mockup 01) — **REFERÊNCIA VISUAL + EVOLUÇÃO FUTURA**
3. **Execução** — acompanhamento (Mockup 03) — **EVOLUÇÃO FUTURA**
4. **Histórico** — rastreabilidade (Mockup 04) — **EVOLUÇÃO FUTURA**

## 7.2 Fluxo de Criação (Wizard)

O wizard (Mockups 05–10) apresenta 6 etapas:

1. Identificação
2. Alimentação
3. Refeições
4. Suplementos
5. Vigência e responsabilidade
6. Revisão e ativação

**Status atual:** O wizard existe como **REFERÊNCIA VISUAL** para formulários. O lifecycle de rascunho ainda não está implementado.

---

# 8. Navegação Canônica

## 8.1 Sidebar Principal

```
Dashboard
Efetivo
Central
Treinamento K9
Saúde
  ├── Visão Geral
  ├── Histórico Clínico
  ├── Agenda Preventiva
  └── Nutrição
Estoque
Relatórios
Acessos
Plantões
```

## 8.2 Rota Atual

A rota **realmente implementada** é:

```
/health/nutrition
```

**Rotas futuras propostas** (NÃO implementadas):

- `/health/nutrition/execution`
- `/health/nutrition/history`
- `/health/nutrition/plans/new`
- `/saude/nutricao/*` (rota em português não existe)

---

# 9. Separação Web × Mobile

## Web (Implementado)

- Cria planos
- Edita planos
- Substitui planos
- Cancela planos
- Visualiza histórico administrativo

## Mobile (Implementado)

- Executa refeições planejadas
- Registra suplementações
- Gera MealLog e SupplementLog

## NÃO Implementado

A Web **não** deve criar uma segunda fonte concorrente de:

- MealLog
- SupplementLog

Salvo contrato futuro explicitamente aprovado.

---

# 10. Dados Demonstrativos

Para testes visuais e fixtures, usar o cenário:

```
K9: Bono (MAT 113122)
Plano ativo: Performance Operacional
Vigência: 01/07/2026 → 30/09/2026
Meta: 600g/dia, 2 refeições
```

---

# 11. Regras de Consistência Visual

- Fundo navy quase preto
- Cards em azul-marinho profundo
- Cyan como cor primária
- Bordas arredondadas
- Contornos finos
- Tipografia consistente com o K9 Ops Web

---

# 12. Status da Implementação

| Componente | Status | Notas |
|---|---|---|
| Management foundation | ✅ | CREATE, UPDATE, REPLACE, CANCEL |
| Read model | ✅ | Visualização de planos |
| CREATE | ✅ | Funcional |
| UPDATE administrativo | ✅ | Funcional |
| REPLACE estrutural | ✅ | Funcional |
| CANCEL | ✅ | Funcional |
| Visual polish | ✅ | UI polida |
| Automated regression | ✅ | 850 testes |
| CREATE/EMPTY browser review | ✅ | Homologado |
| Full browser E2E | ⏳ | **Pendente** — ambiente seguro não disponível |

---

# 13. Estado do E2E

## Browser visual validation

| Cenário | Status | Notas |
|---|---|---|
| EMPTY | ✅ | Homologado em browser local |
| CREATE | ✅ | Homologado em browser local |
| UPDATE | ⏳ | Validação visual em browser pendente |
| REPLACE | ⏳ | Validação visual em browser pendente |
| CANCEL | ⏳ | Validação visual em browser pendente |

## Automated regression

| Cenário | Status | Notas |
|---|---|---|
| CREATE | ✅ | 850 testes |
| UPDATE | ✅ | 850 testes |
| REPLACE | ✅ | 850 testes |
| CANCEL | ✅ | 850 testes |
| **Total** | ✅ | **850 testes** |

## Full isolated browser E2E

| Cenário | Status | Notas |
|---|---|---|
| Full browser E2E | ⏳ | **Pendente** — ambiente seguro não disponível |

> **Pendente controlado:** Full browser E2E validation pending safe isolated environment.

---

# 14. Referências Documentais

Este documento deve ser usado em conjunto com:

- ADRs Health
- Domain Model Health v1.0
- Firestore Schema
- Permission Matrix
- Contratos canônicos de mutation

---

# 15. Histórico de Versões

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-07-xx | Reconciliação inicial — documento visual e de produto |

---

# 16. Conclusão

Este documento reconcilia a visão visual (mockups) com o contrato realmente implementado.

**O que existe:**
- Contrato real e funcional ✅
- Mockups como referência visual ✅

**O que precisa ficar claro:**
- O que é V1 implementado
- O que é apenas referência visual
- O que é evolução futura

O documento anterior mixava conceitos futuros como se fossem atuais. Esta versão corrige isso com classificações explícitas.

---

*Documento reconciliado conforme Gate 5D.7 — Reconciliação Documental da Nutrição Web*
