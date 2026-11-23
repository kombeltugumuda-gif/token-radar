// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a model
// panel with the full category table, and a per-protocol detail view with
// the model's own inputs, a recompute check, and the protocol's farm plan.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }

  function mult(n) {
    return '×' + n.toFixed(2);
  }

  function ageLabel(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  function chainOf(row) {
    return row.chains && row.chains.length ? row.chains[0] : 'its main chain';
  }

  function capitalFor(row) {
    if (row.tvl_usd >= 5e9) return 250;
    if (row.tvl_usd >= 1e9) return 150;
    if (row.tvl_usd >= 1e8) return 100;
    return 50;
  }

  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function gasFor(chain) {
    var c = String(chain).toLowerCase();
    if (c === 'ethereum') return { perTx: 'about $5 to $15 of gas', weekly: 'about $5 of gas a week' };
    if (c === 'bitcoin' || c === 'tron') return { perTx: 'about $1 to $3 of gas', weekly: 'about $1 of gas a week' };
    return { perTx: 'under $1 of gas', weekly: 'under $1 of gas a week' };
  }

  function actionFor(row, capital, chain) {
    var c = String(row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') !== -1 || c.indexOf('cdp') !== -1 || c.indexOf('collateral') !== -1) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') !== -1 || c.indexOf('yield') !== -1 || c.indexOf('leveraged farm') !== -1) return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    if (c.indexOf('bridge') !== -1) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') !== -1 || c.indexOf('restak') !== -1) return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') !== -1 || c.indexOf('derivative') !== -1) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') !== -1) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') !== -1 || c.indexOf('allocator') !== -1) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') !== -1) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') !== -1) return 'Mint $' + capital + ' of the protocol\'s yield asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') !== -1) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('restaked') !== -1 || c.indexOf('anchor') !== -1) return 'Deposit $' + capital + ' of the wrapped asset into ' + name + ' on ' + chain + ' and hold the receipt.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }

  // The farm plan, generated in the page from the row's own record, in the
  // same seven steps the program writes into board.json.
  function farmSteps(row) {
    var chain = chainOf(row);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var gas = gasFor(chain);
    var action = actionFor(row, capital, chain);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'nothing to set up', time: '5 minutes' },
      { text: action, cost: '$' + capital + ' of capital and ' + gas.perTx, time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: gas.weekly, time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Open the protocol\'s own points or rewards page, if it has one, and check that your wallet and actions are counted.', cost: 'no fee to check', time: '10 minutes' },
      { text: 'Never pay to claim and never open a claim link from social media: claim only from the protocol\'s own page.', cost: 'nothing, and a paid claim is a scam', time: '5 minutes to verify' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ];
  }

  // The model's own arithmetic, recomputed in the page from the row's stored
  // multipliers, so the detail view can check its own number.
  function recomputed(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * row.growth_multiplier * row.maturity_multiplier * row.chain_multiplier));
  }

  function readHash() {
    var h = new URLSearchParams(window.location.hash.slice(1));
    state.q = h.get('q') || '';
    state.category = h.get('category') || 'all';
    state.chain = h.get('chain') || 'all';
    state.scope = h.get('scope') || 'all';
    state.tab = h.get('tab') || 'pre-token';
    state.sort = h.get('sort') || 'implied';
    state.dir = h.get('dir') === '1' ? 1 : -1;
    state.selected = h.get('p') || null;
  }

  function writeHash() {
    var h = new URLSearchParams();
    if (state.q) h.set('q', state.q);
    if (state.category !== 'all') h.set('category', state.category);
    if (state.chain !== 'all') h.set('chain', state.chain);
    if (state.scope !== 'all') h.set('scope', state.scope);
    if (state.tab !== 'pre-token') h.set('tab', state.tab);
    if (state.sort !== 'implied') h.set('sort', state.sort);
    if (state.dir === 1) h.set('dir', '1');
    if (state.selected) h.set('p', state.selected);
    var s = h.toString();
    history.replaceState(null, '', s ? '#' + s : window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var rows = DATA.rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.watchlist) return false;
      if (state.scope === 'early' && r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if ((r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    rows.sort(function (a, b) {
      var va, vb;
      if (key === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
      else if (key === 'growth') { va = a.change_7d === null ? -Infinity : a.change_7d; vb = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { va = a.age_days === null ? -1 : a.age_days; vb = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'name') { return dir * a.name.localeCompare(b.name); }
      else { va = a.implied_value_usd; vb = b.implied_value_usd; }
      return dir * (va - vb);
    });
    return rows;
  }

  function sortTh(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ↓' : ' ↑') : '';
    return '<th><button class="sort" data-sort="' + key + '">' + label + arrow + '</button></th>';
  }

  function tableHtml(rows) {
    if (!rows.length) return '<p class="empty">No protocols match this filter. Clear the search or pick another category.</p>';
    var body = rows.map(function (r) {
      var g = r.change_7d;
      var gClass = g === null ? '' : (g >= 0 ? 'up' : 'down');
      var badge = r.watchlist ? '<span class="badge watch">Watchlist</span>' : '<span class="badge early">Early</span>';
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><button class="name" data-slug="' + esc(r.slug) + '">' + esc(r.name) + '</button> ' + badge + '<div class="sub">' + esc(r.slug) + '</div></td>' +
        '<td>' + esc(r.category || 'Other') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + gClass + '">' + pct(g) + '</td>' +
        '<td class="num strong">' + money(r.implied_value_usd) + '</td>' +
        '</tr>';
    }).join('');
    return '<table><thead><tr>' +
      '<th class="num">#</th><th>' + sortTh('Protocol', 'name') + '</th><th>Category</th><th>Chains</th>' +
      sortTh('TVL', 'tvl') + sortTh('7d', 'growth') + sortTh('Implied value', 'implied') +
      '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function liveHtml() {
    var body = DATA.live.map(function (r, i) {
      var g = r.change_7d;
      var gClass = g === null ? '' : (g >= 0 ? 'up' : 'down');
      var ratio = (r.mcap_usd && r.tvl_usd) ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : '—';
      return '<tr><td class="num">' + (i + 1) + '</td>' +
        '<td>' + esc(r.name) + '<div class="sub">' + esc(r.slug) + '</div></td>' +
        '<td>' + esc(r.category || 'Other') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + money(r.mcap_usd) + '</td>' +
        '<td class="num">' + ratio + '</td>' +
        '<td class="num ' + gClass + '">' + pct(g) + '</td></tr>';
    }).join('');
    return '<p class="note">Live-token protocols are not ranked: they already trade, so the board shows the market&rsquo;s own value. Their market-cap-to-TVL ratios are what price the pre-token board&rsquo;s categories.</p>' +
      '<table><thead><tr><th class="num">#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">MCap / TVL</th><th class="num">7d</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function categoryOptions() {
    var cats = [];
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    cats.sort();
    return cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
  }

  function chainOptions() {
    var chains = [];
    DATA.rows.forEach(function (r) {
      (r.chains || []).forEach(function (c) { if (chains.indexOf(c) === -1) chains.push(c); });
    });
    chains.sort();
    return chains.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
  }

  function modelPanel() {
    var m = DATA.model;
    var rows = DATA.category_table.map(function (t) {
      return '<tr><td>' + esc(t.category) + '</td><td class="num">' + t.samples + '</td><td class="num">' + (t.median === null ? '—' : t.median.toFixed(3) + '×') + '</td><td class="num strong">' + t.multiple.toFixed(2) + '×</td></tr>';
    }).join('');
    return '<section class="panel model"><h2>How the model prices a protocol</h2>' +
      '<p>Implied value = TVL × category multiple × growth × maturity × chains. Every input comes from this snapshot; no protocol name is ever special-cased.</p>' +
      '<ul class="formula">' +
      '<li><b>Category</b> — the median market-cap-to-TVL ratio of the live-token protocols in the same category (n ≥ ' + m.category_min_samples + '), clamped to ' + m.category_min.toFixed(2) + '–' + m.category_max.toFixed(2) + '; ' + m.category_fallback.toFixed(2) + ' when a category has too few live protocols to read.</li>' +
      '<li><b>Growth</b> — 1 + clamp(7-day change, ' + m.growth_floor + '%, ' + m.growth_cap + '%) / 100 × ' + m.growth_weight + '.</li>' +
      '<li><b>Maturity</b> — ' + m.maturity_floor + ' + ' + m.maturity_range + ' × ln(1 + age) / ln(1 + ' + m.maturity_days + ' days); age unknown counts as ' + m.unknown_age_days + ' days. A long run with no token is worth more, with diminishing returns.</li>' +
      '<li><b>Chains</b> — 1 + ' + m.chain_step + ' per chain beyond the first, up to ' + m.chain_max_bonus + ' extra chains.</li>' +
      '</ul>' +
      '<table class="cats"><thead><tr><th>Category</th><th class="num">Live n</th><th class="num">Median MCap / TVL</th><th class="num">Multiple used</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="note">Implied value is a model of what a token would be worth if the protocol&rsquo;s record stayed as it is. It is not a promise, and it does not predict whether or when a token is issued.</p>' +
      '</section>';
  }

  function render() {
    var rows = filteredRows();
    var top = DATA.rows[0];
    var watchCount = DATA.rows.filter(function (r) { return r.watchlist; }).length;
    var html = '<section class="hero"><div>' +
      '<h1>Token Radar</h1>' +
      '<p class="lede">Pre-token protocols ranked by implied value, from a snapshot of ' + DATA.as_of + ' (' + esc(DATA.source) + '). The watchlist of ' + DATA.watchlist_size + ' protocols is the floor, never the ceiling: the board also ranks ' + DATA.early_size + ' early protocols below the $50M TVL floor, for ' + DATA.board_size + ' rows in all.</p>' +
      '</div><dl class="stats">' +
      '<div><dt>Top implied value</dt><dd>' + money(top.implied_value_usd) + '</dd><dd class="sub">' + esc(top.name) + '</dd></div>' +
      '<div><dt>Watchlist</dt><dd>' + watchCount + '</dd><dd class="sub">of ' + DATA.board_size + ' rows</dd></div>' +
      '<div><dt>Early finds</dt><dd>' + DATA.early_size + '</dd><dd class="sub">below the $50M floor</dd></div>' +
      '<div><dt>Live-token set</dt><dd>' + DATA.live_size + '</dd><dd class="sub">priced by the market</dd></div>' +
      '</dl></section>' +
      '<section class="panel controls">' +
      '<div class="tabs" role="tablist">' +
      '<button data-tab="pre-token" class="' + (state.tab === 'pre-token' ? 'on' : '') + '">Pre-token board</button>' +
      '<button data-tab="live" class="' + (state.tab === 'live' ? 'on' : '') + '">Live token</button>' +
      '</div>' +
      (state.tab === 'pre-token' ?
        '<div class="filters">' +
        '<label>Search <input id="q" type="search" value="' + esc(state.q) + '" placeholder="Name, slug or category"></label>' +
        '<label>Category <select id="category"><option value="all">All categories</option>' + categoryOptions() + '</select></label>' +
        '<label>Chain <select id="chain"><option value="all">All chains</option>' + chainOptions() + '</select></label>' +
        '<div class="scope" role="group" aria-label="Scope">' +
        '<button data-scope="all" class="' + (state.scope === 'all' ? 'on' : '') + '">All ' + DATA.board_size + '</button>' +
        '<button data-scope="watchlist" class="' + (state.scope === 'watchlist' ? 'on' : '') + '">Watchlist ' + watchCount + '</button>' +
        '<button data-scope="early" class="' + (state.scope === 'early' ? 'on' : '') + '">Early ' + DATA.early_size + '</button>' +
        '</div></div>' +
        '<p class="count">' + rows.length + ' of ' + DATA.board_size + ' protocols · sorted by ' + (state.sort === 'implied' ? 'implied value' : state.sort) + (state.dir === -1 ? ' ↓' : ' ↑') + '</p>' +
        tableHtml(rows)
        : liveHtml()) +
      '</section>' +
      modelPanel() +
      '<p class="foot">Snapshot ' + DATA.as_of + ' · ' + esc(DATA.source) + ' · model ' + esc(DATA.model_version) + ' · board.json carries the same ' + DATA.board_size + ' rows, with farm plans. Implied value is a model, not a promise.</p>';
    app.innerHTML = html;
    bind();
    if (state.selected) openDetail(state.selected);
  }

  function bind() {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; writeHash(); render(); var nq = document.getElementById('q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } });
    var cat = document.getElementById('category');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = document.getElementById('chain');
    if (ch) ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    app.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); writeHash(); render(); });
    });
    app.querySelectorAll('[data-scope]').forEach(function (b) {
      b.addEventListener('click', function () { state.scope = b.getAttribute('data-scope'); writeHash(); render(); });
    });
    app.querySelectorAll('[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
        writeHash(); render();
      });
    });
    app.querySelectorAll('[data-slug]').forEach(function (b) {
      b.addEventListener('click', function () { state.selected = b.getAttribute('data-slug'); writeHash(); openDetail(state.selected); });
    });
  }

  function openDetail(slug) {
    var row = DATA.rows.find(function (r) { return r.slug === slug; });
    var dlg = document.getElementById('detail');
    if (!row || !dlg) return;
    var rec = recomputed(row);
    var ok = rec === row.implied_value_usd;
    var steps = farmSteps(row).map(function (s, i) {
      return '<li><span class="step-n">' + (i + 1) + '</span><div><p>' + esc(s.text) + '</p><p class="meta">Cost: ' + esc(s.cost) + ' · Time: ' + esc(s.time) + '</p></div></li>';
    }).join('');
    var g = row.change_7d;
    dlg.innerHTML = '<form method="dialog" class="detail">' +
      '<div class="detail-head"><div><h2>' + esc(row.name) + '</h2><p class="sub">Rank #' + row.rank + ' · ' + esc(row.slug) + ' · ' + esc(row.category || 'Other') + ' · ' + esc((row.chains || []).join(', ') || '—') + (row.watchlist ? ' · <span class="badge watch">Watchlist</span>' : ' · <span class="badge early">Early</span>') + '</p></div>' +
      '<button class="close" value="close" aria-label="Close">×</button></div>' +
      '<dl class="facts">' +
      '<div><dt>Implied value</dt><dd>' + money(row.implied_value_usd) + '</dd></div>' +
      '<div><dt>TVL</dt><dd>' + money(row.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd class="' + (g === null ? '' : (g >= 0 ? 'up' : 'down')) + '">' + pct(g) + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + ageLabel(row.age_days) + '</dd></div>' +
      '<div><dt>Listed</dt><dd>' + esc(row.listed_at || 'unknown') + '</dd></div>' +
      '</dl>' +
      '<h3>Why this rank</h3>' +
      '<table class="breakdown"><thead><tr><th>Multiplier</th><th class="num">Value</th><th>What it means</th></tr></thead><tbody>' +
      '<tr><td>Category</td><td class="num">' + mult(row.category_multiple) + '</td><td>Median MCap / TVL of ' + row.category_samples + ' live ' + esc(row.category || 'Other') + ' protocols</td></tr>' +
      '<tr><td>Growth</td><td class="num">' + mult(row.growth_multiplier) + '</td><td>7-day change ' + pct(g) + ', clamped and weighted ' + DATA.model.growth_weight + '</td></tr>' +
      '<tr><td>Maturity</td><td class="num">' + mult(row.maturity_multiplier) + '</td><td>' + ageLabel(row.age_days) + ' with no token, diminishing returns</td></tr>' +
      '<tr><td>Chains</td><td class="num">' + mult(row.chain_multiplier) + '</td><td>' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's') + '</td></tr>' +
      '<tr><td>Recompute</td><td class="num">' + money(rec) + '</td><td>' + (ok ? 'Matches the board: the page recomputed the same number.' : 'Does not match the board — the model changed after the board was built.') + '</td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan</h3><ol class="steps">' + steps + '</ol>' +
      '<p class="note">A farm plan is a set of actions with costs and times, not a promise of an airdrop. Never pay to claim.</p>' +
      '</form>';
    if (!dlg.open) dlg.showModal();
  }

  window.addEventListener('hashchange', function () { readHash(); render(); });
  readHash();
  render();
})();
