# Polish visual — React + Angular (design)

**Data:** 2026-09-17
**Status:** aprovado

## Contexto

Projeto demo educacional comparando padrões de tempo real (Polling, Long
Polling, SSE, WebSocket) implementados em paralelo em React e Angular. Os
dois frontends têm componentes espelhados (`ConnectionBadge`, `MetricsBar`,
`EventLog`, `StatusTimeline`, `ChatPanel`) e CSS quase idêntico — a única
diferença estrutural hoje é a cor `--accent` (azul no React, vermelho no
Angular), usada como identidade visual de cada stack.

Visual atual é funcional mas plano: sem sombra/elevação, sem transição de
estado, hierarquia tipográfica fraca, badge de conexão é só texto com fundo
sutil.

Tentativa inicial era usar Mobbin MCP para trazer referências reais de
componentes, mas a conta é free e o MCP exige plano pago para busca
(`search_screens`/`search_flows`/`search_sections` retornam erro de upgrade).
Seguindo sem essa referência, com boas práticas de UI conhecidas.

## Objetivo

Polish visual geral nos dois frontends, mantendo estrutura, navegação e
lógica intactas. Prioridade: consistência, hierarquia, feedback de estado
sutil (motion). Não é redesign — sem componente novo, sem mudança de
layout/navegação, sem light mode.

## Escopo

Aplicado em paralelo em `frontend-react/src/styles.css` e
`frontend-angular/src/styles.css` (arquivos hoje quase idênticos), mais
pequenos ajustes de markup nos componentes que precisam de elemento extra
(badge dot, classe de fade-in no event log).

### 1. Tokens novos (`:root`)

- `--radius-sm: 6px`, `--radius: 10px`, `--radius-lg: 14px` — substituem
  valores hardcoded (8px/12px) espalhados pelo CSS.
- `--shadow-panel: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px -8px rgba(0,0,0,.4)`
  — aplicado em `.panel`-like containers: metrics-bar item, event-log,
  finish-banner, socket-half, chat-panel.
- `--transition: 160ms ease` — timing padrão para hover e mudança de estado.
- Escala de espaçamento `--space-1: 4px` até `--space-6: 32px`, usada onde
  fizer sentido substituir valor solto sem alterar layout resultante.

### 2. `ConnectionBadge`

Markup ganha `<span class="badge__dot" />` antes do label (React e Angular).
Dot de 6px, `border-radius: 50%`, cor herda do estado via CSS (mesma lógica
de `--accent`/`--text-secondary`/`--accent-warm` já usada no badge):

- `conectando` / `reconectando`: `animation: pulse 1.2s infinite`.
- `conectado`: dot sólido, sem animação.
- `desconectado`: dot opaco (`opacity: .5`), sem animação.

`@keyframes pulse` definido uma vez no CSS global.

### 3. `MetricsBar`

- `.metrics-bar__value` sobe para `1.25rem` → `1.5rem`, ganha
  `font-variant-numeric: tabular-nums` (evita reflow visual quando o número
  muda de dígitos).
- `.metrics-bar__item` recebe `--shadow-panel` e `transition: var(--transition)`
  em hover (leve `translateY(-1px)`).

### 4. `EventLog`

- Nova linha (a mais recente adicionada ao array/lista) recebe classe
  `event-log__row--enter`, com `@keyframes fade-in` (opacity 0→1,
  `translateY(4px)→0`, ~200ms). Comparação simples de "é a última chave"
  tanto no React (`rows[rows.length - 1]?.key`) quanto no template Angular
  equivalente — sem estado novo, só cálculo derivado no render.
- `.event-log__row--unchanged` sobe opacidade de `.45` para `.55` (melhora
  legibilidade sem perder a distinção visual "sem mudança").

### 5. `StatusTimeline`

- `.status-timeline__step--current` ganha `box-shadow` pulsante sutil
  (reforça "em processamento").
- Transições de cor/background em `--done`/`--current` usam
  `transition: var(--transition)` em vez de instantâneo.

### 6. Tipografia global

- `h1`: `letter-spacing: -0.01em`.
- `h3`: `letter-spacing: 0.04em` (já é uppercase; falta abertura pra
  legibilidade).
- `body`: `line-height: 1.5`.

### 7. Painéis genéricos (`chat-panel`, `finish-banner`, `socket-half`)

Recebem `--shadow-panel` e `--radius-lg`. Sem mudança estrutural.

## Fora de escopo

- Componente `Card` reutilizável novo (seria abordagem B, não escolhida).
- Mudança de layout, navegação ou agrupamento de painéis.
- Light mode / toggle de tema.
- Qualquer alteração em hooks, services, lógica de conexão/polling.
- Upgrade do plano Mobbin — segue sem referência externa por decisão do
  usuário.

## Arquivos afetados

- `frontend-react/src/styles.css`
- `frontend-angular/src/styles.css`
- `frontend-react/src/components/ConnectionBadge.tsx` (markup do dot)
- `frontend-angular/src/app/components/connection-badge/*` (markup do dot)
- `frontend-react/src/components/EventLog.tsx` (classe de fade-in na última linha)
- `frontend-angular/src/app/components/event-log/*` (idem)

## Verificação

- `npm run dev` nos dois frontends.
- Checagem visual manual nas 4 abas (Polling, Long Polling, SSE, WebSocket)
  e no chat, nos dois frontends.
- Confirmar sem regressão de contraste/acessibilidade e sem quebra de
  layout (scroll, overflow, alinhamento).
- Sem teste automatizado novo — mudança é puramente visual/CSS, sem lógica
  nova além do cálculo derivado de "última linha" no event log.
