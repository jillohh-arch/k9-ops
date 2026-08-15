# K9 Ops Web — Especificação Oficial do Redesign do Efetivo K9

| Campo | Valor |
|---|---|
| Status | IMPLEMENTADO / VALIDADO / APROVADO VISUALMENTE |
| Data | 2026-08-14 |
| Referência visual canônica | `WEB_EFFECTIVE_K9_APPROVED_MOCKUP.png` |
| Escopo | Efetivo K9 Web |
| Fora do escopo | Redesign de Humanos, Binômios e Viaturas; alteração de backend; alteração do Dashboard |

---

# 1. Visão do produto

A tela deixa de comunicar:

> "lista de K9 cadastrados"

e passa a comunicar:

> **"visão operacional da força canina da unidade"**

A experiência deve parecer uma extensão natural do Dashboard K9 Ops, não uma página administrativa isolada.

---

# 2. Invariantes visuais

Preservar a linguagem atual do Dashboard:

- navy/azul petróleo profundo;
- cyan/teal como identidade principal;
- bordas finas translúcidas;
- glow discreto;
- cards compactos;
- tipografia forte;
- informação operacional acima de decoração;
- cores semânticas controladas;
- sem estética de videogame excessiva;
- sem reconstruir topbar ou sidebar fora do necessário para o submenu.

---

# 3. Layout desktop

Com drawer fechado:

```text
┌────────────────────────────────────────────────────────────┐
│ Efetivo K9                            + Cadastrar K9        │
│ Visão operacional da matilha da unidade                    │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│ Efetivo     │ Prontos     │ Formação    │ Indisponíveis     │
├────────────────────────────────────────────────────────────┤
│ Busca | Status | Emprego | Especialidade | Filtros | Grid │
├────────────────────────────────────────────────────────────┤
│ PRONTOS PARA EMPREGO                                       │
│ [K9] [K9] [K9] [K9]                                       │
│                                                            │
│ EM FORMAÇÃO                                                │
│ [K9] [K9]                                                  │
│                                                            │
│ INDISPONÍVEIS / RESTRIÇÕES                                 │
│ [K9]                                                       │
└────────────────────────────────────────────────────────────┘
```

Com K9 selecionado:

```text
┌───────────────────────────────┬────────────────────────────┐
│ roster                        │ drawer detalhes do K9      │
│ reduz sua largura             │ sticky / inline desktop   │
└───────────────────────────────┴────────────────────────────┘
```

---

# 4. Header

Conteúdo:

```text
[ícone K9] Efetivo K9
           Visão operacional da matilha da unidade

                                      + Cadastrar K9
```

## CTA

`Cadastrar K9` permanece condicionado à permissão existente de criação.

Não exibir CTA desabilitado para quem não possui permissão; manter o padrão atual de ocultação.

---

# 5. Cards de resumo

## 5.1 Efetivo total

Exibe todos os K9 visíveis no escopo atual, excluindo registros soft-deleted conforme a normalização existente.

## 5.2 Prontos para emprego

Não é sinônimo automático de "possui especialidade operacional".

Para composição definitiva, considerar:

- status administrativo do K9;
- qualificação/especialidade;
- prontidão/restrição Health quando disponível.

## 5.3 Em formação

K9 com especialidade explicitamente `in_formation`, desde que não classificado em estado de indisponibilidade com precedência maior.

## 5.4 Indisponíveis

K9:

- administrativamente inativo/fora de operação; ou
- clinicamente `temporarily_unfit`, quando a prontidão Health canônica estiver disponível.

Restrições parciais não devem ser automaticamente tratadas como indisponibilidade total.

---

# 6. Precedência visual para agrupamento

Para evitar duplicação de um mesmo K9 em vários grupos:

```text
1. indisponível administrativo / temporarily_unfit
2. em formação sem prontidão para emprego
3. pronto para emprego
4. ativo sem classificação operacional
```

## Atenção e restrições parciais

Estados como:

- Operacional com Atenção;
- Apto com Restrições;

podem permanecer na área de K9 aptos para algum emprego, mas devem carregar sinalização própria no card/drawer.

Não tratar restrição parcial como bloqueio absoluto.

---

# 7. Grupo fallback

Se existir K9 ativo sem especialidade operacional e sem formação explícita:

```text
ATIVOS SEM CLASSIFICAÇÃO OPERACIONAL
```

O grupo aparece somente quando necessário.

Nenhum registro pode ser escondido para manter fidelidade ao mockup.

---

# 8. Barra de filtros

Elementos aprovados:

- busca;
- status;
- emprego/situação;
- especialidade;
- operador;
- filtro adicional, se necessário;
- grid/lista.

A busca deve continuar cobrindo ao menos:

- nome;
- matrícula;
- raça;
- operador.

## Comportamento

Os filtros são aplicados primeiro.

Depois, os resultados filtrados são particionados nos grupos operacionais.

Contadores de grupo refletem o conjunto filtrado quando apresentados na seção.

Cards-resumo do topo refletem o conjunto base do efetivo, não a busca textual, salvo decisão posterior.

---

# 9. Paginação

A tela atual pagina 6 registros.

O mockup aprovado prioriza um roster agrupado de leitura contínua.

## Decisão de redesign

No Efetivo K9:

- remover paginação global de 6 cards;
- renderizar os K9 filtrados agrupados;
- permitir quebra de linha responsiva;
- não criar carrossel artificial se todos os itens couberem;
- controles laterais/setas só aparecem quando houver overflow ou ação real associada.

Para volumes futuros muito maiores, paginação/virtualização pode ser reavaliada sem alterar o contrato semântico.

---

# 10. Card K9

Conteúdo mínimo:

- foto;
- nome;
- status principal;
- raça;
- operador/condutor;
- até 2-3 especialidades visíveis;
- sinal de estado semântico.

Conteúdo que **não deve sobrecarregar o card**:

- histórico clínico;
- peso;
- agenda;
- prontidão detalhada;
- documentos;
- atividade recente detalhada.

Esses itens pertencem ao drawer ou perfil completo.

---

# 11. Cores semânticas

## Verde

Uso:

- operacional / pronto;
- status clínico operacional quando canônico;
- sem restrições bloqueantes.

## Amarelo

Uso:

- formação;
- atenção;
- pendência não bloqueante.

Não usar a mesma label para formação e atenção; apenas compartilham família cromática quando necessário.

## Vermelho

Uso:

- indisponibilidade real;
- restrição absoluta / temporariamente inapto;
- erro crítico.

## Cyan

Uso:

- seleção;
- identidade K9 Ops;
- interações;
- foco;
- navegação.

Cor não pode ser a única forma de transmitir status.

---

# 12. Seleção do card

Ao clicar ou acionar por teclado:

- `selectedDogId` é definido;
- card recebe borda/realce de seleção;
- drawer abre;
- dados detalhados são carregados on-demand.

O card deve ser navegável por teclado.

Não transformar o artigo inteiro em link se houver ações internas concorrentes sem tratamento acessível.

---

# 13. Drawer lateral

## Desktop grande

- inline/sticky;
- largura aproximada entre 380 e 430 px;
- ocupa coluna própria;
- roster reduz largura;
- não cobre a sidebar;
- começa abaixo da topbar.

## Tablet/mobile

- sheet/modal lateral;
- overlay;
- botão fechar;
- Escape fecha;
- foco controlado;
- rolagem interna.

---

# 14. Conteúdo do drawer

## 14.1 Identificação

- status;
- nome;
- raça;
- foto;
- matrícula;
- nascimento/idade;
- sexo;
- cor, se existir;
- microchip, se existir.

Campos inexistentes:

```text
Não informado
```

Não inventar placeholders realistas.

## 14.2 Binômio atual

Exibir somente quando houver vínculo real resolvido.

Conteúdo:

- foto do condutor;
- nome de guerra;
- RA/matrícula;
- função, se disponível;
- vínculo desde, se disponível;
- estado de turno, se houver evidência real.

Se não houver vínculo:

```text
Sem binômio ativo
```

## 14.3 Especialidades

Tags canônicas existentes do K9.

Não inferir especialidades a partir de treino isolado.

## 14.4 Resumo de prontidão

Fonte preferencial:

```text
dogs/{dogId}/health_summary/current
```

quando já disponível e autorizado na branch de implementação.

Exibir labels oficiais de readiness, não percentual inventado.

Fallback:

```text
Prontidão não disponível
```

## 14.5 Última atividade

Carregar sob demanda.

Prioridade inicialmente proposta:

- última sessão de treinamento válida.

Se a regra "atividade" precisar incluir ocorrência/turno, documentar antes de ampliar o seletor.

Não juntar eventos heterogêneos sem critério explícito.

## 14.6 Próxima agenda / saúde

Fonte preferencial Health canônica quando disponível.

Exibir no máximo o próximo item relevante.

Se não disponível:

- ocultar o card; ou
- mostrar `Nenhum item disponível`.

## 14.7 Ações

Aprovadas:

- `Ver perfil`
- `Abrir prontuário`
- `Ver binômio`

### Ver perfil

Usa rota existente:

```text
/k9/{dogId}
```

### Abrir prontuário

Só usar deeplink existente e comprovado.

Não inventar rota nova apenas para o botão.

Se o perfil K9 continuar sendo a superfície canônica de prontuário, o botão pode levar ao perfil/área Health conforme suporte real implementado.

### Ver binômio

Só habilitar quando um binômio real puder ser resolvido.

Sem vínculo:

- ocultar; ou
- desabilitar com texto claro.

---

# 15. Loading

Aplicar skeletons/placeholder estrutural para:

- cards-resumo;
- roster;
- drawer.

Evitar substituir toda a tela por texto `Carregando...` quando já houver shell estável.

---

# 16. Empty states

## Nenhum K9 cadastrado

Mensagem institucional + CTA de cadastro somente se autorizado.

## Nenhum resultado por filtro

```text
Nenhum K9 corresponde aos filtros selecionados.
```

Oferecer limpar filtros.

## Grupo vazio

Não renderizar a seção vazia.

---

# 17. Error state

Falha de listagem:

- manter shell;
- informar falha;
- não exibir números falsos como 0 se o dado não carregou.

Falha apenas do drawer:

- roster permanece utilizável;
- drawer mostra erro localizado;
- fechamento continua possível.

---

# 18. Responsividade

## ≥ 1440px

- roster amplo;
- 4 cards por linha quando drawer fechado quando espaço permitir;
- drawer em coluna fixa quando aberto.

## 1024–1439px

- 2–3 cards por linha;
- drawer pode virar overlay se a coluna principal ficar estreita.

## < 1024px

- sidebar responsiva;
- cards 1–2 colunas;
- drawer como sheet.

## Mobile

- 1 coluna;
- filtros em wrap/stack;
- CTA ocupa largura adequada;
- sem hover obrigatório.

---

# 19. Acessibilidade

- `aria-expanded` no grupo Efetivo;
- foco visível;
- cards selecionáveis por teclado;
- drawer com semântica de dialog/sheet em modo overlay;
- Escape fecha;
- botão fechar com label;
- status com texto além de cor;
- imagens com alt;
- `prefers-reduced-motion` respeitado;
- animações curtas e não essenciais.

---

# 20. Animações

Permitidas:

- expansão do submenu;
- hover suave do card;
- seleção;
- entrada/saída do drawer;
- transições de filtros;
- skeleton loading.

Evitar:

- partículas;
- movimento permanente;
- parallax intenso;
- glow pulsante contínuo;
- animações que prejudiquem leitura operacional.

---

# 21. Fora do escopo desta implementação

- redesenhar Dashboard;
- redesenhar Efetivo Humano;
- redesenhar Binômios;
- redesenhar Viaturas;
- alterar cadastro K9;
- alterar schema Firestore;
- alterar Rules;
- alterar Functions;
- criar readiness alternativa;
- implementar IPO;
- criar dados fictícios;
- criar uma nova arquitetura global de UI.

---

# 22. Critério visual principal

A implementação deve ser reconhecível como o mockup aprovado **sem criar uma linguagem visual paralela ao Dashboard**.

Em caso de conflito entre:

1. mockup;
2. componentes reais do Dashboard;
3. acessibilidade;
4. disponibilidade real de dados;

a prioridade é:

```text
correção funcional e semântica
→ acessibilidade
→ identidade canônica do K9 Ops
→ fidelidade pixel-perfect
```
