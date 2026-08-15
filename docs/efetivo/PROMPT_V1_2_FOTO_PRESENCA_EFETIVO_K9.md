# PROMPT — V1.2 FOTO COM MAIS PRESENÇA — EFETIVO K9 WEB

Estamos iniciando uma rodada **microvisual** sobre a implementação já funcional do novo Efetivo K9.

A V1.1 acertou grid, largura dos cards, drawer, filtros e responsividade. A única diferença visual relevante ainda aberta em relação ao mockup é:

> **a foto do K9 ainda parece thumbnail; no mockup ela funciona como elemento dominante de identidade do cão.**

Esta rodada existe exclusivamente para corrigir isso.

## 0. Escopo

Fazer apenas:
- aumentar a presença visual da foto no card;
- ajustar a proporção interna do card para acomodar a foto;
- aumentar a presença visual da foto no drawer;
- reduzir espaços mortos decorrentes da foto pequena;
- pequenos ajustes de padding/alinhamento diretamente ligados a isso.

NÃO alterar:
- grid global;
- classificação;
- filtros;
- KPIs;
- sidebar;
- navegação;
- rotas;
- permissões;
- Firestore;
- Rules;
- Functions;
- schema;
- readiness;
- lógica do drawer;
- fontes de dados;
- Dashboard;
- outros módulos.

NÃO fazer commit, push ou deploy.

## 1. Preflight

Antes de editar:

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
git diff --check
```

Confirmar nenhuma mudança inesperada e nenhum staged.

## 2. Referência visual

Comparar obrigatoriamente com:

```text
WEB_EFFECTIVE_K9_APPROVED_MOCKUP.png
```

e com os screenshots reais mais recentes.

Diagnóstico:
- largura do card está boa;
- grid está bom;
- layout está funcional;
- a imagem ainda é lida como miniatura;
- no mockup o K9 deve ser reconhecido primeiro pela foto e depois pelo nome/status.

## 3. Card K9 — alteração principal

Foto atual aproximada:

```text
90 × 96 px
```

Desejado: transformar a foto em um **painel visual vertical à esquerda**.

Faixa sugerida:

```text
largura: 112–124 px
altura: 126–142 px
```

Objetivos:
- ocupar grande parte da altura útil;
- mínimo de padding;
- `object-cover`;
- sem deformação;
- evitar corte agressivo de cabeça/orelhas;
- border radius consistente;
- borda sutil.

A foto deve representar visualmente cerca de **1/3 do card**.

## 4. Proporção do card

Pode aumentar levemente a altura para algo em torno de:

```text
170–185 px
```

Mas:
- NÃO aumentar a largura máxima;
- NÃO alterar o grid da V1.1;
- NÃO voltar a cards gigantes.

## 5. Hierarquia interna

Preferência:

```text
┌──────────────┬──────────────────────┐
│              │ Nome   [Status]      │
│   FOTO K9    │ Raça                 │
│              │ Op. Ragonha          │
│              │                      │
│              │ [chips...]           │
└──────────────┴──────────────────────┘
```

Nome alinhado ao topo da foto, status próximo, operador secundário.

## 6. Especialidades

Manter:
- até 3 chips;
- `+N` para excedentes.

Suavizar/remover separador horizontal se ele competir com a nova foto.

## 7. Card selecionado

Preservar borda cyan e glow discreto.

Não exagerar.

## 8. Drawer — foto

A foto do drawer também precisa de mais presença.

Refinar para algo próximo de:

```text
largura: 160–185 px
altura: 160–190 px
```

ou proporção equivalente adequada à imagem real.

Objetivos:
- foto dominante;
- menos sensação de formulário;
- metadados continuam legíveis.

Se necessário, mover parte dos metadados para baixo da foto em vez de apertá-los.

## 9. Drawer — preservar lógica

NÃO alterar:
- binômio;
- especialidades;
- prontidão não disponível;
- última atividade;
- ações;
- comportamento inline/overlay;
- Escape;
- foco;
- links.

## 10. Grid

NÃO alterar a solução atual:

```css
repeat(auto-fill, minmax(270px, 320px))
```

ou equivalente já implementado.

## 11. KPIs, filtros, sidebar e topbar

NÃO alterar.

Preservar labels atuais:

```text
Status: Todos
Situação: Todas
Especialidade: Todas
Operador: Todos
```

## 12. Responsividade

Revalidar:
- desktop;
- tablet;
- mobile.

No mobile, não manter largura fixa de imagem se isso quebrar a composição.

## 13. Object position

Auditar `object-position`.

Se `object-cover` cortar cabeça/orelhas de forma ruim, usar ajuste moderado, sem crop universal agressivo.

## 14. Arquivos preferenciais

Alterar preferencialmente apenas:

```text
src/features/effective/components/k9-roster/k9-roster-card.tsx
src/features/effective/components/k9-roster/k9-detail-drawer.tsx
```

Só tocar em outro arquivo se estritamente necessário ao layout.

## 15. Testes e validação

Executar testes direcionados de card/drawer/roster e depois:

```powershell
npm test
npm run typecheck
npx eslint src
npm run build
git diff --check
```

Tudo deve permanecer verde.

## 16. Inspeção visual obrigatória

Drawer fechado:
- foto claramente maior;
- K9 domina visualmente o card;
- card continua compacto;
- sem vazio morto relevante.

Drawer aberto:
- foto do K9 tem presença;
- drawer não vira formulário;
- metadados continuam legíveis.

Comparar lado a lado com o mockup.

## 17. Não commitar

NÃO executar:

```text
git add
git commit
git push
git stash
git reset
git clean
```

Nenhum deploy.

## 18. Entrega

Reportar:
1. baseline;
2. arquivos alterados;
3. dimensões finais da foto no card;
4. altura final aproximada do card;
5. object-fit/object-position;
6. comparação visual card antes/depois;
7. confirmação de grid inalterado;
8. dimensões finais da foto no drawer;
9. impacto nos metadados;
10. desktop;
11. tablet;
12. mobile;
13. testes direcionados;
14. `npm test`;
15. typecheck;
16. `eslint src`;
17. build;
18. `git diff --check`;
19. status final;
20. nenhum commit;
21. nenhum push;
22. nenhum deploy;
23. recomendação final: `APROVAR VISUALMENTE` ou `NOVO POLISH NECESSÁRIO`.

Pare com as alterações não commitadas para revisão humana.
