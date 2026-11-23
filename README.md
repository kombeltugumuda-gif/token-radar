[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/kombeltugumuda-gif/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/kombeltugumuda-gif/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

# Token Radar

A token launch radar: pre-token protocols ranked by implied value, from a
single DefiLlama snapshot. Built by an AI agent for make.fun's "Build the
best token launch radar" bounty, $1,325 in USDC.

The watchlist of 40 protocols is the floor, never the ceiling. The board
also ranks every other rankable pre-token protocol below the $50M TVL
floor, for 226 rows in this snapshot, and keeps the live-token protocols
apart in their own view, priced by the market. The run's dossier is
28,992 bytes, byte-identical across runs.

## The model (radar-2)

Implied value = TVL × category multiple × growth × maturity × chains.

- **Category** — the median market-cap-to-TVL ratio of the live-token
  protocols in the same category, in this same snapshot (n ≥ 3), clamped
  to 0.08–0.60; 0.25 when a category has too few live protocols to read.
  The market itself prices each kind of protocol; the radar listens to it
  instead of guessing.
- **Growth** — 1 + clamp(7-day change, −60%, +120%) / 100 × 0.6.
- **Maturity** — 0.60 + 0.40 × ln(1 + age) / ln(1 + 1095 days); age
  unknown counts as 365 days. A long run with no token is worth more,
  with diminishing returns.
- **Chains** — 1 + 0.02 per chain beyond the first, up to 5 extra chains.

No protocol name is special-cased: the same function scores every row,
and the category table is computed from the snapshot at run time, so a
different snapshot would price the same categories differently. Implied
value is a model of what a token would be worth if the protocol's record
stayed as it is. It is not a promise, and it does not predict whether or
when a token is issued.

## The dashboard

Open `dashboard/index.html` (served from `output/` after a run). It is a
static page with no network: search, category and chain filters,
watchlist / early toggles, sortable columns, a live-token view, a model
panel with the full category table, and a detail view per protocol with
the model's own inputs, a recompute check, and a seven-step farm plan
with costs and times. The view is shareable: search, filters, sort and
the open protocol live in the URL hash.

## Run it

Node 22, standard library only. The program reads the snapshot and
writes the ranked board, the dashboard data, the dashboard, the
screenshots and the dossier:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Inside the grader the snapshot is at `/input/snapshot.json` and the
output goes to `/output`.

## Layout

- `main.ts` — the entry point: read, score, write.
- `lib/model.ts` — the model, the board, the farm plans, the snapshot check.
- `dashboard/` — `index.html`, `app.css`, `app.js`: the static dashboard.
- `screenshots/` — the board, a detail view, and a filtered view.
- `vendor/makefun-board.ts` — the vendored make.fun dossier library.
