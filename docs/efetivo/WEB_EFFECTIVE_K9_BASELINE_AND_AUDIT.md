# K9 Ops Web — Efetivo K9

## Auditoria do estado atual e baseline para redesign

| Campo | Valor |
|---|---|
| Status | IMPLEMENTADO / VALIDADO / APROVADO VISUALMENTE |
| Data | 2026-08-14 |
| Escopo | Navegação do módulo Efetivo + tela Efetivo K9 |
| Repositório auditado | `jillohh-arch/k9-ops` |
| Baseline GitHub read-only | `master@68be9bac2ef8d2b5b8bc105f8bfc4181802c0214` |
| Corroboração | `feature/health-web-nutrition` possui a mesma composição de `effective/page.tsx` auditada |
| Mockup aprovado | `WEB_EFFECTIVE_K9_APPROVED_MOCKUP.png` |
| Regra | Nenhuma implementação antes da aprovação desta documentação |

> **Importante:** a baseline GitHub é uma fotografia read-only. Antes de qualquer implementação no workspace local, o HEAD/branch real deve ser novamente auditado e comparado com estes arquivos. Nenhuma conclusão abaixo autoriza alteração de código, Rules, índices, Functions ou dados.

---

# 1. Objetivo da auditoria

Documentar o estado atual do módulo Efetivo Web antes do redesign aprovado, garantindo que a implementação futura:

- preserve comportamentos válidos;
- não perca registros;
- não confunda status de especialidade com prontidão clínica;
- preserve permissões e rotas;
- mantenha Dashboard, topbar e identidade visual intactos;
- substitua a navegação interna por cards pelos subitens do menu lateral;
- implemente o mockup aprovado sem inventar dados inexistentes.

---

# 2. Arquivos diretamente envolvidos

## Shell e navegação

- `src/components/layout/app-shell.tsx`
- `src/lib/routes/paths.ts`
- `src/app/(app)/effective/page.tsx`

## Efetivo K9

- `src/app/(app)/k9/page.tsx`
- `src/app/(app)/k9/[dogId]/page.tsx`
- `src/features/effective/components/effective-ui.tsx`
- `src/features/effective/hooks/use-effective-data.ts`
- `src/features/effective/hooks/use-k9-profile-data.ts`
- `src/features/effective/providers/entities-provider.tsx` (dependência indireta; confirmar no preflight local)
- `src/features/effective/lib/k9-modalities.ts`

## Permissões

- `src/features/access/providers/access-control-provider.tsx`
- `src/lib/permissions/access-control.ts`
- route access rules declaradas no `app-shell.tsx`

---

# 3. Navegação atual

A sidebar possui um único item `Efetivo`, apontando para `/effective`.

Esse item é considerado ativo também quando o pathname pertence a:

- `/effective`
- `/k9`
- `/humans`
- `/binomials`
- `/vehicles`

O shell já reconhece as quatro áreas como módulos de permissão independentes.

As rotas filhas já existem:

```text
/effective
/k9
/humans
/binomials
/vehicles
```

Portanto, o redesign **não precisa criar quatro novas rotas**. O principal trabalho de navegação é promover as rotas já existentes a subitens visíveis da sidebar e transformar `/effective` em entrada/redirect de compatibilidade.

---

# 4. Composição atual de `/effective`

A tela atual:

1. renderiza o header `Gestão do efetivo operacional`;
2. exibe quatro cards de navegação:
   - K9;
   - Humanos;
   - Viaturas;
   - Binômios;
3. mantém `activeTab` local;
4. importa e renderiza diretamente `K9Page`, `HumansPage`, `VehiclesPage` e `BinomialsPage`;
5. faz contagens em tempo real das quatro coleções.

Esse desenho cria uma segunda camada de navegação depois que o usuário já entrou em `Efetivo`.

## Decisão aprovada de redesign

Remover os quatro cards de navegação do conteúdo principal.

A seleção do núcleo passará para a sidebar:

```text
Efetivo
├── Efetivo K9
├── Efetivo Humano
├── Binômios
└── Viaturas
```

Cada tela renderiza apenas o seu próprio domínio.

---

# 5. Estado atual de `Efetivo K9`

A tela atual contém:

- header com descrição;
- CTA `Cadastrar K9`, condicionado a `can("k9", "create")`;
- quatro métricas;
- busca;
- filtros por status, especialidade e operador;
- alternância grid/lista;
- paginação local de 6 itens;
- cards com foto, nome, matrícula, raça, sexo, idade, operador e especialidades;
- link `Ver perfil`.

## Métricas atuais

- `K9 cadastrados`
- `Operacionais`
- `Em formação`
- `Fora de operação`

## Métricas aprovadas para o redesign

- `Efetivo total`
- `Prontos para emprego`
- `Em formação`
- `Indisponíveis`

A semântica dessas métricas deve ser definida pelo contrato deste pacote. O nome visual **não autoriza** simplificar ou misturar estados de domínios diferentes.

---

# 6. Como o status atual é derivado

Hoje `dogStage()` usa:

1. `dog.status` para identificar K9 fora de operação;
2. existência de especialidade `operational`;
3. existência de especialidade `in_formation`;
4. fallback `active`.

Isso significa que **"Operacional" hoje é derivado da formação/especialidade do K9**, não de uma fonte clínica de prontidão.

Essa distinção deve ser preservada.

## Invariante

> Status de qualificação/especialidade e prontidão clínica são conceitos diferentes.

Nunca declarar um K9 clinicamente `Operacional` apenas porque possui especialidade operacional.

---

# 7. Fontes atuais de dados do Efetivo

O hook `useEffectiveData()` normaliza formatos legados e atuais.

## K9

Fonte base:

```text
dogs
```

Campos normalizados encontrados:

- `name` / `nome`
- `matricula` / `registrationNumber` / `registration_number` / `rga`
- `breed` / `raça`
- `sex` / `sexo`
- `dateOfBirth` / `date_of_birth`
- `profileImageUrl` / aliases de foto
- `conductorRa` / aliases de handler
- `status` / `situação`

## Especialidades

Fonte:

```text
dogs/{dogId}/specialties
```

Status relevantes:

- `operational`
- `in_formation`
- `not_started` (ignorado na listagem atual)

## Humanos

Fonte principal via provider de entidades:

```text
users
```

## Binômios

Fonte:

```text
binomials
```

## Turnos

Fonte:

```text
active_shifts
```

## Perfil detalhado do K9

`useK9ProfileData(dogId)` já possui leituras de:

- documento do K9;
- especialidades;
- saúde legada;
- peso;
- treino;
- ocorrências;
- documentos.

Esse hook é candidato natural para alimentar detalhes **on-demand** do drawer, mas deve ser revisado antes de reutilização porque carrega muito mais fontes do que o drawer necessita.

---

# 8. Finding técnico preexistente

Em `subscribeCollection()` de `use-effective-data.ts`, é montada uma variável `ref` com constraints, porém o `onSnapshot` observado usa `collection(db, path)` em vez de `ref`.

Impacto potencial:

- constraints passadas ao helper podem não ser aplicadas;
- o caso auditado inclui a tentativa de filtrar `binomials` por `active == true`.

## Regra para o redesign

Não corrigir silenciosamente esse finding no mesmo commit visual sem:

1. teste de regressão;
2. confirmação de impacto;
3. delimitação explícita do escopo.

Caso o drawer dependa de binômios ativos, filtrar de forma segura no seletor/mapper ou abrir correção técnica separada.

---

# 9. Lacuna: K9 ativo sem especialidade

O estágio atual possui fallback `active`.

No mockup aprovado, os grupos principais são:

- Prontos para emprego;
- Em formação;
- Indisponíveis / com restrições.

Um K9 `active` sem especialidade operacional e sem especialidade em formação não pode desaparecer da interface.

## Regra aprovada

Criar fallback visual condicional:

```text
Ativos sem classificação operacional
```

Esse grupo só aparece se houver registros nesse estado.

Ele não precisa aparecer no mockup nominal quando a contagem for zero.

---

# 10. Drawer lateral — disponibilidade real de dados

O mockup aprovado exibe:

- identificação;
- foto;
- matrícula;
- nascimento/idade;
- sexo;
- raça;
- microchip quando existir;
- binômio atual;
- especialidades;
- prontidão resumida;
- última atividade;
- próxima agenda/saúde;
- atalhos.

Nem todos esses campos estão no modelo enxuto `EffectiveDog`.

## Estratégia

- cards usam apenas `useEffectiveData()`;
- drawer carrega dados adicionais **somente quando um K9 é selecionado**;
- nenhuma lista deve abrir N assinaturas de Health/Training por K9 só para preencher cards;
- dados ausentes exibem `Não informado`, `Não disponível` ou ocultam o bloco conforme o contrato;
- nunca preencher com dados fictícios.

---

# 11. Readiness / prontidão

O drawer aprovado utiliza um bloco `Resumo de prontidão`.

A fonte correta deve ser a projeção Health canônica quando disponível e autorizada.

## Proibido

- usar `readinessScore` de binômio como substituto;
- calcular percentual ad hoc;
- usar `dogStage()` como prontidão clínica;
- inferir ausência de restrição apenas porque a leitura falhou;
- transformar "especialidade operacional" em "prontidão operacional".

## Degradação segura

Se a fonte canônica de prontidão não estiver disponível:

```text
Prontidão
Não disponível
```

ou ocultar o bloco, conforme decisão de implementação visual.

---

# 12. O que deve permanecer intacto

- Dashboard;
- topbar;
- período global do dashboard;
- notificações;
- perfil do operador;
- identidade visual da sidebar;
- permissões atuais;
- criação/edição existente do K9;
- rota de perfil completo;
- regras de Firestore;
- índices;
- Cloud Functions;
- schema de dados;
- fluxos de Humanos, Binômios e Viaturas até as respectivas fases de redesign.

---

# 13. Conclusão

A implementação visual é tecnicamente viável com a arquitetura existente.

A maior mudança estrutural é de **navegação e composição**, não de backend:

- `/effective` deixa de ser um hub visual com quatro cards;
- a sidebar vira o hub;
- `/k9` passa a ser a experiência principal do Efetivo K9;
- o roster passa de listagem administrativa paginada para visão operacional agrupada;
- detalhes avançados migram para um drawer carregado sob demanda.

Nenhum novo schema é necessário para implementar a maior parte do mockup.

A prontidão e agenda de saúde devem respeitar os contratos Health existentes e nunca ser simuladas a partir dos dados de especialidade.
