// Analyse de composition — partagé entre le script de page et le popup
(function (global) {
  const FIBERS = {
    // Synthétiques
    polyester:        { label: 'Polyester',        cat: 'synth', words: ['polyester', 'poliester', 'poliestere'] },
    polyamide:        { label: 'Polyamide',        cat: 'synth', words: ['polyamide', 'polyamid', 'poliamida', 'poliammide', 'nylon'] },
    acrylique:        { label: 'Acrylique',        cat: 'synth', words: ['acrylique', 'acrylic', 'acrilico', 'acrilica', 'acryl', 'polyacryl', 'polyacrylique'] },
    elasthanne:       { label: 'Élasthanne',       cat: 'synth', words: ['elasthanne', 'elastane', 'elasthan', 'elastan', 'spandex', 'lycra'] },
    polyurethane:     { label: 'Polyuréthane',     cat: 'synth', words: ['polyurethane', 'polyurethan', 'poliuretano', 'pu'] },
    polypropylene:    { label: 'Polypropylène',    cat: 'synth', words: ['polypropylene', 'polypropylen', 'polipropileno', 'polipropilene'] },
    modacrylique:     { label: 'Modacrylique',     cat: 'synth', words: ['modacrylique', 'modacrylic', 'modacrilico'] },
    elastomultiester: { label: 'Élastomultiester', cat: 'synth', words: ['elastomultiester'] },
    pvc:              { label: 'PVC',              cat: 'synth', words: ['pvc', 'polychlorure de vinyle', 'vinyle', 'vinyl'] },
    // bare : souvent cité sans pourcentage ("Matière : cuir de vachette")
    simili: { label: 'Simili cuir', cat: 'synth', bare: true, words: [
      'simili cuir', 'similicuir', 'simili', 'faux cuir', 'cuir synthetique', 'cuir vegan', 'imitation cuir', 'effet cuir', 'aspect cuir', 'facon cuir',
      'faux leather', 'vegan leather', 'synthetic leather', 'imitation leather', 'pu leather', 'leather look', 'leather effect', 'leatherette',
      'faux daim', 'faux suede', 'suedine', 'microsuede', 'faux shearling', 'ecopiel', 'polipiel', 'piel sintetica', 'ecopelle', 'similpelle', 'kunstleder'] },
    // Artificielles (cellulose)
    viscose:  { label: 'Viscose', cat: 'art', words: ['viscose', 'viscosa', 'rayonne', 'rayon'] },
    modal:    { label: 'Modal',   cat: 'art', words: ['modal'] },
    lyocell:  { label: 'Lyocell', cat: 'art', words: ['lyocell', 'tencel'] },
    acetate:  { label: 'Acétate', cat: 'art', words: ['acetate', 'acetato', 'triacetate'] },
    cupro:    { label: 'Cupro',   cat: 'art', words: ['cupro'] },
    // Naturelles
    coton:     { label: 'Coton',     cat: 'nat', words: ['coton', 'cotton', 'algodon', 'cotone', 'baumwolle'] },
    laine:     { label: 'Laine',     cat: 'nat', words: ['laine', 'wool', 'lana', 'wolle', 'merinos', 'merino'] },
    lin:       { label: 'Lin',       cat: 'nat', words: ['lin', 'linen', 'lino', 'leinen', 'flax'] },
    soie:      { label: 'Soie',      cat: 'nat', words: ['soie', 'silk', 'seda', 'seta', 'seide'] },
    cachemire: { label: 'Cachemire', cat: 'nat', words: ['cachemire', 'cashmere', 'cachemira', 'kaschmir'] },
    mohair:    { label: 'Mohair',    cat: 'nat', words: ['mohair'] },
    alpaga:    { label: 'Alpaga',    cat: 'nat', words: ['alpaga', 'alpaca', 'alpaka'] },
    chanvre:   { label: 'Chanvre',   cat: 'nat', words: ['chanvre', 'hemp', 'canamo', 'canapa', 'hanf'] },
    yak:       { label: 'Yak',       cat: 'nat', words: ['yak'] },
    angora:    { label: 'Angora',    cat: 'nat', words: ['angora'] },
    // Cuir (pas une fibre, mais la matière principale des sacs, chaussures, ceintures…)
    cuir: { label: 'Cuir', cat: 'nat', bare: true, words: [
      'cuir', 'leather', 'piel', 'pelle', 'leder', 'echtleder', 'glattleder', 'wildleder', 'daim', 'suede', 'nubuck', 'vachette', 'shearling'] },
  };

  const DEFAULTS = {
    sites: [],
    threshold: 50,
    bad: ['polyester', 'polyamide', 'acrylique', 'polyurethane', 'polypropylene', 'modacrylique', 'elastomultiester', 'pvc', 'simili'],
    mode: 'hide',        // 'hide' | 'dim'
    badges: true,
    hideUnknown: false,
  };

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u00a0\u202f]/g, ' ');

  const WORD2KEY = {};
  for (const [k, f] of Object.entries(FIBERS)) for (const w of f.words) WORD2KEY[w] = k;
  // Les plus longs d'abord : "simili cuir" avant "cuir" ; espace ou tiret ("simili-cuir")
  const FIBER_ALT = Object.keys(WORD2KEY).sort((a, b) => b.length - a.length).map(w => w.replace(/ /g, '[\\s-]+')).join('|');
  const FIBER_RE = new RegExp('\\b(' + FIBER_ALT + ')s?\\b', 'g');
  const FIBER_AT = new RegExp('^(' + FIBER_ALT + ')s?\\b');
  const keyOf = w => WORD2KEY[w.replace(/[\s-]+/g, ' ')];
  const PCT_RE = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g;
  const KEYWORD_RE = /composition|matiere|materiau|material|fabric|tissu|zusammensetzung|composicion|composizione/g;
  const GAP_MAX = 25;

  // Libellés de section : ce qui n'est PAS le tissu principal…
  const LINING_RE = /\b(doublures?|lining|forro|fodera|futter|voering|poches?|pocket(?:ing)?s?|bolsillos?|rembourrage|garnissage|ouatinage|ouatine|filling|padding|relleno|imbottitura|bords?[ -]?cotes?|ribbing|garnitures?|trims?|empiecements?)\b/g;
  // … et ce qui l'est explicitement
  const MAIN_RE = /\b(exterieur|tissu (?:principal|exterieur)|matiere (?:principale|exterieure)|dessus|tige|empeigne|outer(?: shell)?|shell|upper|main (?:fabric|material)|exterior|tejido (?:principal|exterior)|capellada|tessuto (?:principale|esterno)|esterno|tomaia|oberstoff|obermaterial|aussenmaterial|hauptmaterial)\b/g;
  const GENERIC_RE = /\b(composition|materials?|matieres?|materiaux|materiau|tissu|fabric|composicion|composizione|zusammensetzung)\b/;
  const LABEL_ANY = new RegExp(`${LINING_RE.source}|${MAIN_RE.source}|${GENERIC_RE.source}`);
  const LABEL_MAIN_G = new RegExp(`${MAIN_RE.source}|${GENERIC_RE.source}`, 'g');
  const BARE_STOP = new RegExp(`[.;|!?]|${LABEL_ANY.source}`);
  // Entre un % et sa fibre : pas d'autre chiffre, de fin de phrase ni de libellé de section
  const badGap = s => /[\d%!?;]/.test(s) || LABEL_ANY.test(s);

  // Associe chaque pourcentage à une fibre, soit après ("60% coton"), soit avant ("Coton 60%")
  function pairs(text, dir) {
    const fibers = [...text.matchAll(FIBER_RE)].map(m => ({ i: m.index, end: m.index + m[0].length, key: keyOf(m[1]) }));
    const out = [];
    let fi = 0;
    for (const m of text.matchAll(PCT_RE)) {
      const prev = text[m.index - 1];
      if (prev === '-' || prev === '\u2212' || /\d/.test(prev || '')) continue; // remises "-30%"
      const v = parseFloat(m[1].replace(',', '.'));
      if (!(v > 0 && v <= 100)) continue;
      const pEnd = m.index + m[0].length;
      while (fi < fibers.length && fibers[fi].end <= m.index - GAP_MAX) fi++;
      let f = null;
      if (dir === 'after') {
        for (let j = fi; j < fibers.length && fibers[j].i - pEnd <= GAP_MAX; j++) {
          if (fibers[j].i >= pEnd) { if (!badGap(text.slice(pEnd, fibers[j].i))) f = fibers[j]; break; }
        }
      } else {
        for (let j = fi; j < fibers.length && fibers[j].end <= m.index; j++) f = fibers[j];
        if (f && badGap(text.slice(f.end, m.index))) f = null;
      }
      if (f) out.push({ start: Math.min(m.index, f.i), end: Math.max(pEnd, f.end), key: f.key, v });
    }
    return out;
  }

  // Tous les blocs de fibres consécutives qui totalisent 100 %
  function groups(ps) {
    const out = [];
    let g = {}, sum = 0, last = -1e9, start = 0;
    for (const p of ps) {
      if (p.start - last > 200 || g[p.key] != null || sum + p.v > 101) { g = {}; sum = 0; }
      if (sum === 0) start = p.start;
      g[p.key] = p.v; sum += p.v; last = p.end;
      if (Math.abs(sum - 100) <= 1) { out.push({ fibers: g, start, end: p.end }); g = {}; sum = 0; }
    }
    return out;
  }

  // Quel libellé précède le bloc ? Le plus proche l'emporte ; "composition" seul = tissu principal
  function labelOf(text, from, to) {
    const zone = text.slice(Math.max(from, to - 80), to);
    let found = null;
    for (const [re, kind] of [[LINING_RE, 'lining'], [MAIN_RE, 'main']])
      for (const m of zone.matchAll(re)) if (!found || m.index >= found.i) found = { i: m.index, kind };
    if (found) return found.kind;
    return GENERIC_RE.test(zone) ? 'main' : 'none';
  }

  // "Matière : cuir de vachette" : matière sans pourcentage juste après un libellé = 100 %.
  // Réservé aux matières "bare" (cuir…), et seulement si rien d'autre n'est cité avant la fin de la mention
  function bare(text) {
    const out = [];
    for (const m of text.matchAll(LABEL_MAIN_G)) {
      let i = m.index + m[0].length;
      i += /^["'\s:=\-–]*(?:(?:en|in|de|aus|di)\s+)?/.exec(text.slice(i, i + 20))[0].length;
      const f = FIBER_AT.exec(text.slice(i, i + 40));
      const key = f && keyOf(f[1]);
      if (!key || !FIBERS[key].bare) continue;
      const end = i + f[0].length;
      let tail = text.slice(end, end + 40);
      const stop = tail.search(BARE_STOP);
      if (stop >= 0) tail = tail.slice(0, stop);
      if (/[\d%]/.test(tail) || [...tail.matchAll(FIBER_RE)].some(o => keyOf(o[1]) !== key)) continue; // "cuir et coton", "cuir 80 %"…
      out.push({ fibers: { [key]: 100 }, start: i, end });
    }
    return out;
  }

  const RANK = { main: 2, none: 1 };

  // Blocs candidats au tissu principal, dans l'ordre du texte ; doublure & co. ignorés
  function candidates(t) {
    const ga = groups(pairs(t, 'after')), gb = groups(pairs(t, 'before'));
    const gs = (!ga.length ? gb : !gb.length ? ga : (gb[0].start < ga[0].start ? gb : ga))
      .concat(bare(t)).sort((a, b) => a.start - b.start);
    const out = [];
    let prevEnd = 0;
    for (const g of gs) {
      const kind = labelOf(t, prevEnd, g.start);
      prevEnd = g.end;
      if (kind !== 'lining') out.push({ fibers: g.fibers, rank: RANK[kind] });
    }
    return out;
  }

  const same = (a, b) => describe(a) === describe(b);

  // Bloc étiqueté principal > bloc sans étiquette. Les blocs sans étiquette viennent souvent
  // d'articles recommandés : on ne conclut que s'ils concordent tous
  function pick(cs) {
    const main = cs.find(c => c.rank === 2);
    if (main) return main;
    return cs.length && cs.every(c => same(c.fibers, cs[0].fibers)) ? cs[0] : null;
  }

  // sure = trouvé près d'un mot-clé "composition / matière…"
  function parseText(raw) {
    const text = norm(raw);
    let n = 0;
    for (const m of text.matchAll(KEYWORD_RE)) {
      const r = pick(candidates(text.slice(Math.max(0, m.index - 80), m.index + 800))); // -80 : voir "Doublure" placé avant "composition"
      if (r) return { fibers: r.fibers, sure: true };
      if (++n > 40) break;
    }
    const r = pick(candidates(text));
    return r ? { fibers: r.fibers, sure: false } : null;
  }

  // Articles hors sujet (parfum, bijoux…) : l'extension se tait, même si une composition traîne sur la page
  const NA_RE = /\b(parfums?|eaux? de (?:toilette|parfum|cologne)|fragrances?|perfumes?|profum[oi]|colonias?|deodorants?|bougies?|candles?|diffuseurs?|maquillage|make ?up|rouges? a levres|lipsticks?|mascaras?|serums?|lotions?|shampo+ings?|gels? douche|cosmetiques?|cosmetics?|beaute|beauty|bijoux?|jewel(?:le)?ry|joyas|gioielli|schmuck|colliers?|necklaces?|boucles? d ?oreilles?|earrings?|bagues?|bracelets?|montres?|lunettes|sunglasses|eyewear|gafas|occhiali|cartes? cadeaux?|gift ?cards?|\d+(?:[.,]\d+)? ?ml)\b/;
  const LOOKALIKE_BEFORE = /\b(effet|facon|toucher|aspect|imitation|faux|style|esprit|look|type)\W*(?:de |d )?$/;
  const LOOKALIKE_AFTER = /^\W*(look|touch|feel|effect|like|style)\b/;

  // Matières naturelles annoncées par le nom ("Sac en cuir", "Pull cachemire"), hors "effet cuir", "toucher cachemire"…
  function hints(name) {
    const out = new Set();
    for (const m of name.matchAll(FIBER_RE)) {
      const key = keyOf(m[1]);
      if (FIBERS[key].cat !== 'nat') continue;
      if (LOOKALIKE_BEFORE.test(name.slice(Math.max(0, m.index - 14), m.index))) continue;
      if (LOOKALIKE_AFTER.test(name.slice(m.index + m[0].length, m.index + m[0].length + 10))) continue;
      out.add(key);
    }
    return [...out];
  }

  function urlWords(url) {
    try { return norm(decodeURIComponent(new URL(url).pathname)).replace(/[-_/+.]+/g, ' '); } catch { return ''; }
  }
  const naFromUrl = url => NA_RE.test(urlWords(url));

  // null = rien de fiable ; { na: true } = article non adapté ; sinon { fibers, sure }
  function judge(text, title, url) {
    const name = norm(title || '').replace(/'/g, ' ');
    if (NA_RE.test(name) || naFromUrl(url)) return { na: true };
    const c = parseText(text);
    if (!c) return null;
    const h = hints(name);
    if (h.length && !h.some(k => k in c.fibers)) return null; // le nom dit "cuir", l'analyse non : elle s'est trompée de bloc
    return c;
  }

  function parseHtml(html) {
    html = html
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\[nrt]/g, ' ')
      .replace(/</g, ' <'); // évite "coton40%" quand les balises sont collées
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style, .cc-ui').forEach(e => e.remove());
    return doc;
  }

  function productName(j, depth = 0) {
    if (!j || typeof j !== 'object' || depth > 4) return '';
    if (Array.isArray(j)) { for (const x of j) { const n = productName(x, depth + 1); if (n) return n; } return ''; }
    if ([].concat(j['@type']).some(t => /^Product(Group)?$/.test(t)) && typeof j.name === 'string') return j.name;
    return productName(j['@graph'], depth + 1);
  }

  // Nom du produit : JSON-LD > h1 > og:title (le <title> contient souvent le slogan du site : "mode, beauté, parfums")
  function titleOf(doc) {
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try { const n = productName(JSON.parse(s.textContent)); if (n) return n; } catch {}
    }
    return doc.querySelector('h1')?.textContent || doc.querySelector('meta[property="og:title"]')?.content || '';
  }

  // textContent inclut le JSON des <script>, souvent riche en compositions
  const analyze = (doc, url) => judge(doc.documentElement.textContent, titleOf(doc), url);

  function verdict(comp, s) {
    if (!comp) return { status: 'unknown', bad: 0 };
    if (comp.na) return { status: 'na', bad: 0 };
    let bad = 0;
    for (const [k, v] of Object.entries(comp.fibers)) if (s.bad.includes(k)) bad += v;
    return { status: bad > s.threshold ? 'bad' : 'ok', bad: Math.round(bad) };
  }

  function describe(fibers) {
    return Object.entries(fibers).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${Math.round(v * 10) / 10}% ${FIBERS[k].label}`).join(', ');
  }

  const VERSION = 3; // à incrémenter quand l'analyse change : vide le cache des compositions

  global.CC = { VERSION, FIBERS, DEFAULTS, parseText, judge, parseHtml, analyze, naFromUrl, verdict, describe };
})(globalThis);
