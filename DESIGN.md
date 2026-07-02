# K9 Ops — Identidade de Design e Motion

## Identidade Visual

### Paleta
| Token | Valor | Uso |
|---|---|---|
| `--background` | `#050d10` | Fundo principal (dark navy) |
| `--foreground` | `#f8fafc` | Texto primário |
| `--primary` | `#4dd0e1` | Cyan — cor de sistema, interações, foco |
| `--success` | `#2ecc71` | Verde — status OK, confirmação |
| `--warning` | `#f1c40f` | Âmbar — atenção, pendências |
| `--danger` | `#e74c3c` | Vermelho — erro, crítico |
| `--card` | `#0e1a1f` | Fundo de cards e painéis |
| `--muted` | `#102027` | Fundos sutis |
| `--border` | `rgba(77,208,225,0.12)` | Bordas semânticas |

### Estética
- **HUD militar tático**: fundo escuro, elementos com brilho sutil (`box-shadow`), glow discreto em cyan
- **Brackets e cantos cortados**: clip-path em cards principais (polygon com chanfros)
- **Tipografia uppercase tracking largo**: labels em caps com `tracking-[0.2em]`, `font-bold`
- **Monospace para números**: `font-mono` em contadores e valores
- **Radial gradients sutis**: gradiente radial de cyan nos backgrounds de cards

## Filosofia de Motion

Animação no K9 Ops é **feedback operacional**, não decoração. Cada movimento comunica algo:

- **Entrada de elemento**: "equipamento ligando" — rápido, seco, de baixo pra cima
- **Hover/press**: "resposta tátil" — confirmação instantânea
- **Stagger**: hierarquia visual — o que entra primeiro é mais importante
- **Pulso de status**: "radar ativo" — comunicação contínua de estado

### Princípios
1. **Rápido**: durações entre 80–300ms (exceto loops decorativos)
2. **Seco**: curvas sem bounce, sem elastic, sem overshoot
3. **Direcional**: translateY de baixo pra cima na entrada
4. **Escalonado**: stagger de 60ms entre elementos do mesmo nível
5. **Uma vez**: entradas animam na montagem, não em re-renders

### Anti-referências (PROIBIDO)

- ❌ Bounce / elastic / spring com overshoot
- ❌ Glassmorphism (blur pesado em backgrounds)
- ❌ Gradientes lúdicos (cores malucas, stops não-semânticos)
- ❌ Animações acima de 600ms fora de loops decorativos
- ❌ Confetti, neve, partículas decorativas
- ❌ Emoji em UI
- ❌ Animação por animação — sem propósito, só "ficar bonito"

## Motion Tokens

Valores espelhados do app mobile (HudDurations / HudCurves). Manter sincronizados.

### Durações

```css
--hud-micro:   80ms;   /* stagger step */
--hud-tap:    120ms;   /* press feedback */
--hud-fast:   160ms;   /* chips, selções, hovers */
--hud-normal: 220ms;   /* switches de conteúdo */
--hud-entry:  300ms;   /* entrada de elementos */
--hud-pulse: 1600ms;   /* ciclo de pulso de status */
```

### Curvas

```css
--hud-enter:  cubic-bezier(0.215, 0.61, 0.355, 1);   /* easeOutCubic — entrada */
--hud-exit:   cubic-bezier(0.55, 0.055, 0.675, 0.19);  /* easeInCubic — saída */
--hud-move:   cubic-bezier(0.645, 0.045, 0.355, 1);    /* easeInOutCubic — transição */
--hud-snappy: cubic-bezier(0.165, 0.84, 0.44, 1);      /* easeOutQuart — hover rápido */
```

## Componentes com Animação

### HudStatusDot
Dot de status com pulso de radar. 3 variantes: `cyan`, `emerald`, `amber`, `red`.

### Dashboard Entry
Entrada escalonada na montagem:
1. `DashboardHeader` — delay 0
2. `DashboardMetrics` — delay 60ms, cards com stagger interno 60ms
3. `DashboardOccurrences` — delay 120ms
4. `PlantaoCard` / `EquipeCard` — delay 180ms
5. `DashboardPending` — delay 240ms
6. `DashboardHealth` — delay 300ms
7. `DashboardDrugs` — delay 360ms
8. `DashboardCharts` — delay 420ms

## Status

- [x] Fase 1: Fundação (tokens + HudStatusDot + dashboard entry)
- [ ] Fase 2: Hover/press states nos componentes
- [ ] Fase 3: Transições entre rotas
- [ ] Fase 4: Contadores animados
