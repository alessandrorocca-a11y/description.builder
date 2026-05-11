/**
 * Renders Description Builder canvas blocks into the Plan Creation product preview.
 * Data is written by app.jsx to localStorage under STORAGE_KEY before opening this page.
 */
(function () {
  const STORAGE_KEY = 'descriptionBuilderPlanPreview';
  const TABS_MAX = 6;
  const IMAGE_GRID_DEFAULT_TITLE = 'What is included in the package';
  const IMAGE_GRID_DEFAULT_BODY =
    'Get ready to samba, celebrate, and experience the greatest show in the world with all the comfort and exclusivity that only ALL Accor can offer.';
  const INFO_CARD_DEFAULT_BULLET_TEXT =
    'Festival access — single day\nStanding area\nMerch discount';
  const INFO_CARD_ACCENT_DEFAULT_HEX = '#e31b23';

  const SOURCE_LOCALE = 'en';

  function mergeLocaleRow(baseRow, overlayRow) {
    if (!overlayRow || typeof overlayRow !== 'object') return baseRow;
    const out = { ...baseRow };
    for (const [k, v] of Object.entries(overlayRow)) {
      if (v === '' || v === undefined) continue;
      out[k] = v;
    }
    return out;
  }

  function mergePropsLocaleOverlay(baseProps, overlay) {
    if (!overlay || typeof overlay !== 'object') return baseProps;
    const base = baseProps || {};
    const out = { ...base };
    for (const [k, v] of Object.entries(overlay)) {
      if (v === '' || v === undefined) continue;
      if (
        k !== 'items' &&
        k !== 'cards' &&
        k !== 'tabs' &&
        k !== 'details' &&
        v !== null &&
        typeof v !== 'object'
      ) {
        out[k] = v;
      }
    }
    if (Array.isArray(base.items) && overlay.items) {
      out.items = base.items.map((row, i) => mergeLocaleRow(row || {}, overlay.items[i] || {}));
    }
    if (Array.isArray(base.cards) && overlay.cards) {
      out.cards = base.cards.map((row, i) => mergeLocaleRow(row || {}, overlay.cards[i] || {}));
    }
    if (Array.isArray(base.tabs) && overlay.tabs) {
      out.tabs = base.tabs.map((row, i) => mergeLocaleRow(row || {}, overlay.tabs[i] || {}));
    }
    if (Array.isArray(base.details) && overlay.details) {
      out.details = base.details.map((row, i) => mergeLocaleRow(row || {}, overlay.details[i] || {}));
    }
    return out;
  }

  function resolveBlockForPreview(block, locale) {
    if (!block || locale === SOURCE_LOCALE) return block;
    const ov = block.i18n && block.i18n[locale];
    if (!ov) return block;
    return {
      ...block,
      props: mergePropsLocaleOverlay(block.props || {}, ov),
    };
  }

  function resolveHeroTitle(data) {
    const master = typeof data.eventTitle === 'string' ? data.eventTitle.trim() : '';
    const loc =
      typeof data.previewLocale === 'string' ? data.previewLocale : SOURCE_LOCALE;
    if (loc === SOURCE_LOCALE) return master;
    const map = data.eventTitleByLocale;
    if (map && typeof map[loc] === 'string' && map[loc].trim()) return map[loc].trim();
    return master;
  }

  function clamp255(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }
  function parseHex6(hex) {
    if (typeof hex !== 'string') return null;
    const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function formatHex6(rgb) {
    return '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function relativeLuminance(rgb) {
    const lin = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }
  function contrastRatio(hexA, hexB) {
    const a = parseHex6(hexA);
    const b = parseHex6(hexB);
    if (!a || !b) return 1;
    const La = relativeLuminance(a);
    const Lb = relativeLuminance(b);
    const light = Math.max(La, Lb);
    const dark = Math.min(La, Lb);
    return (light + 0.05) / (dark + 0.05);
  }
  function contrastTextForBackground(bgHex) {
    const rgb = parseHex6(bgHex);
    if (!rgb) return '#ffffff';
    return relativeLuminance(rgb) > 0.179 ? '#0a0a0a' : '#ffffff';
  }
  function accentReadableOnWhite(accentHex) {
    const rgb = parseHex6(accentHex);
    if (!rgb) return INFO_CARD_ACCENT_DEFAULT_HEX;
    let r = rgb[0],
      g = rgb[1],
      b = rgb[2];
    for (let step = 0; step < 28; step++) {
      const candidate = formatHex6([r, g, b]);
      if (contrastRatio(candidate, '#ffffff') >= 4.5) return candidate;
      r = clamp255(r * 0.9);
      g = clamp255(g * 0.9);
      b = clamp255(b * 0.9);
    }
    return '#031419';
  }
  function normalizeAccentHex(value, fallback = INFO_CARD_ACCENT_DEFAULT_HEX) {
    if (typeof value !== 'string') return fallback;
    const m = value.trim().match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return fallback;
    return '#' + m[1].toLowerCase();
  }
  function resolveCardAccent(ic) {
    const n = normalizeAccentHex(ic?.accentColor, '');
    return n || INFO_CARD_ACCENT_DEFAULT_HEX;
  }
  function bulletLinesFromCard(ic) {
    const t = ic?.bulletPointsText;
    if (typeof t !== 'string') return [];
    return t.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  function normalizeOneInfoCard(c, legacyRootBullets) {
    const src = c && typeof c === 'object' ? c : {};
    const legacy =
      typeof legacyRootBullets === 'string' && legacyRootBullets.trim() ? legacyRootBullets : '';
    const hasCardBullets = Object.prototype.hasOwnProperty.call(src, 'bulletPointsText');
    let bulletPointsText;
    if (hasCardBullets && typeof src.bulletPointsText === 'string') bulletPointsText = src.bulletPointsText;
    else if (legacy) bulletPointsText = legacy;
    else bulletPointsText = INFO_CARD_DEFAULT_BULLET_TEXT;
    let accentColor =
      typeof src.accentColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(src.accentColor.trim())
        ? src.accentColor.trim().toLowerCase()
        : '';
    if (!accentColor) accentColor = src.ctaStyle === 'brand' ? INFO_CARD_ACCENT_DEFAULT_HEX : '#111111';
    return {
      heading: src.heading ?? src.title ?? 'Ticket',
      price: src.price ?? '',
      imageSrc: typeof src.imageSrc === 'string' ? src.imageSrc : '',
      ctaLabel: src.ctaLabel ?? 'Select tickets',
      highlighted: !!src.highlighted,
      badge: src.badge ?? '',
      accentColor,
      bulletPointsText,
    };
  }
  function normalizeInfoCardProps(p) {
    if (!p) p = {};
    const legacyRootBullets = typeof p.bulletPointsText === 'string' ? p.bulletPointsText : '';
    if (Array.isArray(p.cards) && p.cards.length > 0) {
      return { cards: p.cards.map((c) => normalizeOneInfoCard(c, legacyRootBullets)) };
    }
    return { cards: [normalizeOneInfoCard(p, legacyRootBullets)] };
  }
  function normalizeImageGridProps(props) {
    const row = (item) => ({
      src: item.src ?? '',
      title: item.title ?? IMAGE_GRID_DEFAULT_TITLE,
      body: item.body ?? IMAGE_GRID_DEFAULT_BODY,
    });
    if (props.items && props.items.length === 4) return props.items.map(row);
    const images = props.images && props.images.length === 4 ? props.images : ['', '', '', ''];
    return images.map((src) => row({ src, title: IMAGE_GRID_DEFAULT_TITLE, body: IMAGE_GRID_DEFAULT_BODY }));
  }
  function normalizeTabRow(t) {
    return {
      label: t.label ?? 'Tab',
      body: t.body ?? '',
      contentTitle: t.contentTitle ?? '',
      imageSrc: typeof t.imageSrc === 'string' ? t.imageSrc : '',
    };
  }
  function normalizeTabsProps(p) {
    const tabs = Array.isArray(p.tabs) ? p.tabs : [];
    return tabs.map(normalizeTabRow).slice(0, TABS_MAX);
  }
  function imageAltText(value) {
    const s = value == null ? '' : String(value).trim();
    return s || '';
  }

  function el(tag, className, attrs) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'style' && v && typeof v === 'object') Object.assign(n.style, v);
        else if (v != null) n.setAttribute(k, v);
      });
    }
    return n;
  }
  function spanMaterial(iconText) {
    const s = el('span', 'ms material-symbols-outlined');
    s.textContent = iconText;
    return s;
  }

  function renderInfoCardTile(ic) {
    const accent = resolveCardAccent(ic);
    const ctaFg = contrastTextForBackground(accent);
    const readableAccent = accentReadableOnWhite(accent);
    const card = el('div', 'block-info-card' + (ic.highlighted ? ' block-info-card--highlight' : ''));
    card.style.setProperty('--ic-accent', accent);
    card.style.setProperty('--ic-cta-fg', ctaFg);
    card.style.setProperty('--ic-readable-accent', readableAccent);

    const top = el('div', 'info-card-top');
    if (ic.imageSrc) {
      const img = el('img', 'info-card-image', { src: ic.imageSrc, alt: '' });
      top.appendChild(img);
      if (ic.badge) {
        const b = el('span', 'info-card-badge');
        b.textContent = ic.badge;
        top.appendChild(b);
      }
    } else {
      const hdr = el('div', 'info-card-header');
      if (ic.badge) {
        const b = el('span', 'info-card-badge');
        b.textContent = ic.badge;
        hdr.appendChild(b);
      }
      top.appendChild(hdr);
    }
    card.appendChild(top);

    const main = el('div', 'info-card-main');
    const h = el('div', 'info-card-heading');
    h.textContent = ic.heading;
    const price = el('div', 'info-card-price');
    price.style.color = readableAccent;
    price.textContent = ic.price;
    main.appendChild(h);
    main.appendChild(price);

    const ul = el('ul', 'info-card-features');
    bulletLinesFromCard(ic).forEach((line) => {
      const li = document.createElement('li');
      const chk = spanMaterial('check');
      chk.classList.add('info-card-check');
      const sp = document.createElement('span');
      sp.className = 'info-card-feature-text';
      sp.textContent = line;
      li.appendChild(chk);
      li.appendChild(sp);
      ul.appendChild(li);
    });
    main.appendChild(ul);

    const cta = el('div', 'info-card-cta');
    const ctaSpan = document.createElement('span');
    ctaSpan.textContent = ic.ctaLabel;
    cta.appendChild(ctaSpan);
    cta.appendChild(spanMaterial('arrow_forward'));
    main.appendChild(cta);
    card.appendChild(main);
    return card;
  }

  function renderInfoCardsCarousel(cards) {
    const wrap = el('div', 'block-info-cards block-info-cards--carousel');
    const prev = el('button', 'block-info-cards-nav block-info-cards-nav--prev', {
      type: 'button',
      'aria-label': 'Previous cards',
    });
    prev.appendChild(spanMaterial('chevron_left'));
    const next = el('button', 'block-info-cards-nav block-info-cards-nav--next', {
      type: 'button',
      'aria-label': 'Next cards',
    });
    next.appendChild(spanMaterial('chevron_right'));
    const track = el('div', 'block-info-cards-track');
    cards.forEach((ic) => track.appendChild(renderInfoCardTile(ic)));
    wrap.appendChild(prev);
    wrap.appendChild(next);
    wrap.appendChild(track);

    function syncNav() {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      const overflow = max > 2;
      wrap.classList.toggle('block-info-cards--carousel-overflow', overflow);
      if (!overflow) {
        prev.disabled = false;
        next.disabled = false;
        return;
      }
      prev.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= max - 1;
    }
    function scrollDir(dir) {
      const first = track.querySelector('.block-info-card');
      const gap = 12;
      const w = first ? first.getBoundingClientRect().width : 272;
      track.scrollBy({ left: dir * (w + gap), behavior: 'smooth' });
    }
    prev.addEventListener('click', (e) => {
      e.preventDefault();
      scrollDir(-1);
    });
    next.addEventListener('click', (e) => {
      e.preventDefault();
      scrollDir(1);
    });
    track.addEventListener('scroll', syncNav, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncNav())
        : null;
    ro?.observe(track);
    const bump = () => syncNav();
    queueMicrotask(() => {
      bump();
      requestAnimationFrame(bump);
    });
    window.addEventListener('resize', bump);
    track.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', bump, { once: true });
    });
    return wrap;
  }

  function renderTabsBlock(block) {
    const p = block.props || {};
    const tabs = normalizeTabsProps(p);
    let idx = tabs.length === 0 ? 0 : Math.min(Math.max(0, p.activeIndex ?? 0), tabs.length - 1);
    const surface =
      typeof p.tabBarColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(p.tabBarColor.trim())
        ? p.tabBarColor.trim()
        : '';
    const shell = el('div', 'block-tabs');
    if (surface) shell.style.setProperty('--tabs-surface', surface);

    const nav = el('div', 'block-tabs-nav');
    nav.setAttribute('aria-label', 'Tabs');
    const inner = el('div', 'block-tabs-nav-inner');
    const pills = [];

    const panel = el('div', 'block-tabs-panel');
    const panelMain = el('div', 'block-tabs-panel-main');
    const panelMedia = el('div', 'block-tabs-panel-media');
    panel.appendChild(panelMain);
    panel.appendChild(panelMedia);

    function applyActive() {
      pills.forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
      });
      const t = tabs[idx] || { label: '', body: '', contentTitle: '', imageSrc: '' };
      panel.classList.toggle('block-tabs-panel--no-media', !t.imageSrc);
      panelMain.innerHTML = '';
      if (t.contentTitle) {
        const ct = el('div', 'block-tabs-panel-title');
        ct.textContent = t.contentTitle;
        panelMain.appendChild(ct);
      }
      const body = el('div', 'block-tabs-panel-body');
      body.style.whiteSpace = 'pre-wrap';
      body.textContent = t.body || '';
      panelMain.appendChild(body);
      panelMedia.innerHTML = '';
      if (t.imageSrc) {
        panelMedia.style.display = '';
        const img = el('img', '', { src: t.imageSrc, alt: '' });
        panelMedia.appendChild(img);
      } else {
        panelMedia.style.display = 'none';
      }
    }

    tabs.forEach((tab, i) => {
      const btn = el('button', 'block-tabs-pill', { type: 'button' });
      if (i === idx) btn.classList.add('active');
      btn.textContent = tab.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        idx = i;
        applyActive();
      });
      pills.push(btn);
      inner.appendChild(btn);
    });
    nav.appendChild(inner);
    shell.appendChild(nav);
    shell.appendChild(panel);
    applyActive();
    return shell;
  }

  function renderBlock(block) {
    const p = block.props || {};
    switch (block.type) {
      case 'title': {
        const level = p.level === 'h1' ? 'h1' : p.level === 'h3' ? 'h3' : 'h2';
        const cls =
          p.level === 'h1' ? 'block-title-h1' : p.level === 'h3' ? 'block-title-h3' : 'block-title-h2';
        const node = el(level, cls);
        node.textContent = p.text || 'Add a title';
        return node;
      }
      case 'paragraph': {
        const node = el('div', 'block-paragraph');
        node.style.whiteSpace = 'pre-wrap';
        node.textContent = p.text || '';
        return node;
      }
      case 'spacer': {
        const h = p.size != null ? Number(p.size) : 32;
        const node = el('div', 'pcp-plan-spacer');
        node.style.height = `${h}px`;
        node.style.flexShrink = '0';
        return node;
      }
      case 'fullImage': {
        const wrap = el('div', 'block-image');
        wrap.style.aspectRatio = '16/9';
        if (p.src) {
          const img = el('img', '', { src: p.src, alt: imageAltText(p.alt) });
          wrap.appendChild(img);
        } else {
          const ph = el('div', 'placeholder');
          ph.appendChild(spanMaterial('image'));
          const lab = el('span', '');
          lab.textContent = 'Full width image';
          ph.appendChild(lab);
          wrap.appendChild(ph);
        }
        return wrap;
      }
      case 'imageGrid': {
        const items = normalizeImageGridProps(p);
        const grid = el('div', 'block-image-grid');
        items.forEach((item) => {
          const card = el('div', 'block-image-grid-card');
          const thumb = el('div', 'block-image block-image-grid-thumb');
          if (item.src) thumb.appendChild(el('img', '', { src: item.src, alt: '' }));
          else {
            const ph = el('div', 'placeholder');
            ph.appendChild(spanMaterial('image'));
            thumb.appendChild(ph);
          }
          const tit = el('div', 'block-image-grid-title');
          tit.textContent = item.title || IMAGE_GRID_DEFAULT_TITLE;
          const body = el('div', 'block-image-grid-body');
          body.textContent = item.body;
          card.appendChild(thumb);
          card.appendChild(tit);
          card.appendChild(body);
          grid.appendChild(card);
        });
        return grid;
      }
      case 'eventDetails': {
        if (Array.isArray(p.details) && p.heading === undefined && p.promo === undefined) {
          const leg = el('div', 'block-event-details block-event-details--legacy');
          p.details.forEach((d) => {
            const row = el('div', 'detail');
            row.appendChild(spanMaterial(d.icon || 'circle'));
            const txt = el('div', 'detail-text');
            const strong = document.createElement('strong');
            strong.textContent = d.title || '';
            const sub = document.createElement('span');
            sub.textContent = d.sub || '';
            txt.appendChild(strong);
            txt.appendChild(sub);
            row.appendChild(txt);
            leg.appendChild(row);
          });
          return leg;
        }
        const card = el('div', 'block-event-details-card');
        const head = el('div', 'event-details-heading');
        head.textContent = p.heading || '';
        const body = el('div', 'event-details-body');
        const colMeta = el('div', 'event-details-col event-details-col--meta');
        const row1 = el('div', 'event-details-row');
        const pin = spanMaterial('location_on');
        pin.classList.add('event-details-icon', 'event-details-icon--pin');
        const loc = el('span', 'event-details-meta-text');
        loc.textContent = p.locationLine || '';
        row1.appendChild(pin);
        row1.appendChild(loc);
        const row2 = el('div', 'event-details-row');
        const cal = spanMaterial('calendar_month');
        cal.classList.add('event-details-icon', 'event-details-icon--calendar');
        const dates = el('span', 'event-details-meta-text');
        dates.textContent = p.datesLine || '';
        row2.appendChild(cal);
        row2.appendChild(dates);
        colMeta.appendChild(row1);
        colMeta.appendChild(row2);
        const colPromo = el('div', 'event-details-col event-details-col--promo');
        const ticket = spanMaterial('confirmation_number');
        ticket.classList.add('event-details-icon', 'event-details-icon--ticket');
        const promo = el('p', 'event-details-promo');
        promo.textContent = p.promo || '';
        colPromo.appendChild(ticket);
        colPromo.appendChild(promo);
        body.appendChild(colMeta);
        body.appendChild(colPromo);
        card.appendChild(head);
        card.appendChild(body);
        return card;
      }
      case 'infoCard': {
        const { cards } = normalizeInfoCardProps(p);
        if (cards.length <= 1) {
          const wrap = el('div', 'block-info-cards');
          cards.forEach((ic) => wrap.appendChild(renderInfoCardTile(ic)));
          return wrap;
        }
        return renderInfoCardsCarousel(cards);
      }
      case 'tabs':
        return renderTabsBlock(block);
      default:
        return null;
    }
  }

  function mountDescription(data) {
    const root = document.getElementById('pcp-builder-description');
    if (!root) return;
    const fb = root.querySelector('[data-pcp-builder-fallback]');
    if (fb) fb.remove();
    root.innerHTML = '';
    const locale =
      typeof data.previewLocale === 'string' ? data.previewLocale : SOURCE_LOCALE;
    (data.blocks || []).forEach((block) => {
      try {
        const node = renderBlock(resolveBlockForPreview(block, locale));
        if (node) root.appendChild(node);
      } catch (e) {
        console.warn('Plan preview: skip block', block, e);
      }
    });
    const heroTitle = document.getElementById('pcp-hero-title');
    const titleResolved = resolveHeroTitle(data);
    if (heroTitle) {
      heroTitle.textContent = titleResolved;
    }
    document.title = titleResolved ? `${titleResolved} — Plan preview` : 'Plan preview';
  }

  function tryMount() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return;
    }
    if (!raw || !raw.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    mountDescription({
      eventTitle: parsed.eventTitle,
      eventTitleByLocale: parsed.eventTitleByLocale,
      previewLocale: parsed.previewLocale,
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryMount);
  } else {
    tryMount();
  }
})();
