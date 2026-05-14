// FeverZone Description Builder — main app component

const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layoutVariant": "sidebar-properties",
  "showRequirements": true,
  "showStepper": true
}/*EDITMODE-END*/;

const { TweaksPanel, useTweaks, TweakSection, TweakToggle, TweakSelect } = window;

// ---------- Component definitions ----------
const COMPONENT_TYPES = {
  title:    { icon: 'title', label: 'Title' },
  paragraph:{ icon: 'notes', label: 'Paragraph' },
  spacer:   { icon: 'height', label: 'Spacer' },
  fullImage:{ icon: 'image', label: 'Full width image' },
  imageGrid:{ icon: 'grid_view', label: '4 images block' },
  eventDetails: { icon: 'badge', label: 'Event details' },
  infoCard: { icon: 'sell', label: 'Info card' },
  tabs:     { icon: 'tab', label: 'Tabs navigation' },
};

const PALETTE_ORDER = ['title','paragraph','spacer','fullImage','imageGrid','eventDetails','infoCard','tabs'];

/** Static Plan Creation–style product preview — opens from palette “Preview on”. */
const PRODUCT_PAGE_PREVIEW_URL = 'plan-creation-product.html';

/** pickerIndex when the empty-canvas “+” popover is open (no numeric insert index conflicts). */
const PICKER_EMPTY = -1;
/** pickerIndex for the trailing append “+” after the last block. */
const PICKER_TRAILING = -2;

/** dataTransfer type for reordering an existing block (also mirrored to text/plain for Safari). */
const BLOCK_DRAG_MIME = 'application/x-description-builder-block-id';

const TABS_MAX = 6;
const INFO_CARD_MAX = 6;
/** Preview + picker default when `tabBarColor` is empty (matches `.block-tabs` CSS token). */
const TABS_BAR_COLOR_DEFAULT_HEX = '#002737';
const MOBILE_VIEWPORT_QUERY = '(max-width: 900px)';

const IMAGE_GRID_DEFAULT_TITLE = 'What is included in the package';
const IMAGE_GRID_DEFAULT_BODY =
  'Get ready to samba, celebrate, and experience the greatest show in the world with all the comfort and exclusivity that only ALL Accor can offer.';

/** Legacy blocks used `images` only; normalize to Figma card layout (image + title + body per cell). */
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

/** Use alt text on `<img>` when non-empty; otherwise decorative empty alt. */
function imageAltText(value) {
  const s = value == null ? '' : String(value).trim();
  return s || '';
}

const INFO_CARD_DEFAULT_BULLET_TEXT =
  'Festival access — single day\nStanding area\nMerch discount';

/** Default ticket accent (matches `.block-info-card` `--ic-accent` in CSS). */
const INFO_CARD_ACCENT_DEFAULT_HEX = '#e31b23';

/**
 * Shared preset accents inspired by common competitor/event-market palettes:
 * red, deep blue, cobalt, teal, and purple.
 */
const SHARED_ACCENT_PRESETS = ['#e31b23', '#003087', '#0057ff', '#00a3a3', '#6f42c1'];
const INFO_CARD_ACCENT_PRESETS = SHARED_ACCENT_PRESETS;

/** Tabs keep product default first, then reuse the shared preset family. */
const TABS_BAR_COLOR_PRESETS = [TABS_BAR_COLOR_DEFAULT_HEX, ...SHARED_ACCENT_PRESETS];

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

/** Black or white for text on solid `bgHex` (CTA). */
function contrastTextForBackground(bgHex) {
  const rgb = parseHex6(bgHex);
  if (!rgb) return '#ffffff';
  return relativeLuminance(rgb) > 0.179 ? '#0a0a0a' : '#ffffff';
}

/** Darkens accent until contrast vs white ≥ 4.5:1 — for price & bullet copy on white cards. */
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

/** Bullet lines for one card (newline-separated `bulletPointsText`). */
function bulletLinesFromCard(ic) {
  const t = ic?.bulletPointsText;
  if (typeof t !== 'string') return [];
  return t.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Single info card row; `legacyRootBullets` migrates old block-level `bulletPointsText`. */
function normalizeOneInfoCard(c, legacyRootBullets) {
  const src = c && typeof c === 'object' ? c : {};
  const legacy =
    typeof legacyRootBullets === 'string' && legacyRootBullets.trim()
      ? legacyRootBullets
      : '';
  const hasCardBullets = Object.prototype.hasOwnProperty.call(src, 'bulletPointsText');
  let bulletPointsText;
  if (hasCardBullets && typeof src.bulletPointsText === 'string') {
    bulletPointsText = src.bulletPointsText;
  } else if (legacy) {
    bulletPointsText = legacy;
  } else {
    bulletPointsText = INFO_CARD_DEFAULT_BULLET_TEXT;
  }
  let accentColor =
    typeof src.accentColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(src.accentColor.trim())
      ? src.accentColor.trim().toLowerCase()
      : '';
  if (!accentColor) {
    accentColor = src.ctaStyle === 'brand' ? INFO_CARD_ACCENT_DEFAULT_HEX : '#111111';
  }
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

/** Info card block: one or more ticket-style cards (`cards[]`); legacy single-card root props supported */
function normalizeInfoCardProps(p) {
  if (!p) p = {};
  const legacyRootBullets = typeof p.bulletPointsText === 'string' ? p.bulletPointsText : '';
  if (Array.isArray(p.cards) && p.cards.length > 0) {
    return { cards: p.cards.map((c) => normalizeOneInfoCard(c, legacyRootBullets)) };
  }
  return { cards: [normalizeOneInfoCard(p, legacyRootBullets)] };
}

function createDefaultInfoCard(atIndex) {
  return {
    heading: atIndex === 0 ? 'General Admission' : `Option ${atIndex + 1}`,
    price: '€89',
    imageSrc: '',
    ctaLabel: 'Select tickets',
    highlighted: false,
    badge: '',
    accentColor: INFO_CARD_ACCENT_DEFAULT_HEX,
    bulletPointsText: INFO_CARD_DEFAULT_BULLET_TEXT,
  };
}

const defaultProps = (type) => {
  switch(type){
    case 'title':     return { text: 'Add a title', level: 'h2' };
    case 'paragraph': return { text: 'Write something engaging about your event. Tell visitors what to expect, what makes it special, and any practical info they need to know.' };
    case 'spacer':    return { size: 32 };
    case 'fullImage': return { src: '', alt: '' };
    case 'imageGrid': return {
      items: [0, 1, 2, 3].map(() => ({
        src: '',
        title: IMAGE_GRID_DEFAULT_TITLE,
        body: IMAGE_GRID_DEFAULT_BODY,
      })),
    };
    case 'eventDetails': return {
      heading: 'Detalles del evento',
      locationLine: 'Lugar: Hipódromo de la Zarzuela, Madrid',
      datesLine: 'Fechas: 16 y 18 de septiembre de 2026',
      promo: '¡Consigue tu entrada para una experiencia totalmente nueva que celebra el mundo de Harry Potter™!',
    };
    case 'infoCard': return {
      cards: [createDefaultInfoCard(0)],
    };
    case 'tabs':      return {
      tabBarColor: '',
      tabs: [
      { label: 'Recta principal', contentTitle: '', body: 'Contenido de la recta principal.', imageSrc: '' },
      { label: 'Alta velocidad', contentTitle: 'No te pierdas ni un segundo de acción', body: 'Un fin de semana repleto de motor y acción en pista: además de la Formula 1®, disfruta de las emocionantes carreras de F2® y F3®.', imageSrc: '' },
      { label: 'Chicane', contentTitle: '', body: 'La chicane exige precisión y reflejos.', imageSrc: '' },
    ], activeIndex: 0 };
    default: return {};
  }
};

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

function createDefaultTab(atIndex) {
  return {
    label: `Tab ${atIndex + 1}`,
    contentTitle: '',
    body: 'Add your content here.',
    imageSrc: '',
  };
}

// uuid helper
const uid = () => Math.random().toString(36).slice(2, 9);

/** Master locale: canonical content in `block.props`; overlays per locale in `block.i18n`. */
const SOURCE_LOCALE = 'en';

const PLAN_TAB_CODES = ['Content', 'Media', 'Venue', 'Translations'];

function readPlanTabFromUrl() {
  if (typeof window === 'undefined') return 'Content';
  try {
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (raw && PLAN_TAB_CODES.includes(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'Content';
}

function replacePlanTabInUrl(tab) {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    if (tab === 'Content') u.searchParams.delete('tab');
    else u.searchParams.set('tab', tab);
    const q = u.searchParams.toString();
    window.history.replaceState({}, '', `${u.pathname}${q ? `?${q}` : ''}${u.hash}`);
  } catch {
    /* ignore */
  }
}

/** Locales shown in the translation preview + editor. */
const TRANSLATION_LOCALE_OPTIONS = [
  { code: 'en', label: 'English (master)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
];

const CHANNEL_EDITOR_STORAGE_KEY = 'descriptionBuilderChannelEditorLaunch';

function cloneJsonSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function writeChannelEditorLaunchPayload(payload) {
  const raw = JSON.stringify(payload);
  try {
    sessionStorage.setItem(CHANNEL_EDITOR_STORAGE_KEY, raw);
  } catch (e) {
    console.warn('Channel editor: sessionStorage write failed', e);
  }
  try {
    localStorage.setItem(CHANNEL_EDITOR_STORAGE_KEY, raw);
  } catch (e) {
    console.warn('Channel editor: localStorage write failed', e);
  }
}

function readChannelEditorLaunchPayload() {
  try {
    let raw = sessionStorage.getItem(CHANNEL_EDITOR_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(CHANNEL_EDITOR_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** Merge one row object; empty strings on overlay skip → keep master (fallback). */
function mergeLocaleRow(baseRow, overlayRow) {
  if (!overlayRow || typeof overlayRow !== 'object') return baseRow;
  const out = { ...baseRow };
  for (const [k, v] of Object.entries(overlayRow)) {
    if (v === '' || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Merge translated overlay onto base props (same shape as `block.props`).
 * Empty string in overlay means “not translated yet” → use master copy.
 * Listing-only chrome (info card accent, tabs bar color) always follows master.
 */
function mergePropsLocaleOverlay(baseProps, overlay) {
  if (!overlay || typeof overlay !== 'object') return baseProps;
  const base = baseProps || {};
  const out = { ...base };
  const masterOnlyTopKeys = new Set(['tabBarColor']);
  for (const [k, v] of Object.entries(overlay)) {
    if (v === '' || v === undefined) continue;
    if (masterOnlyTopKeys.has(k)) continue;
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
    out.cards = base.cards.map((row, i) => {
      const ov = overlay.cards[i];
      if (!ov || typeof ov !== 'object') return mergeLocaleRow(row || {}, {});
      const { accentColor: _accentOmit, ...ovSansListingChrome } = ov;
      return mergeLocaleRow(row || {}, ovSansListingChrome);
    });
  }
  if (Array.isArray(base.tabs) && overlay.tabs) {
    out.tabs = base.tabs.map((row, i) => mergeLocaleRow(row || {}, overlay.tabs[i] || {}));
  }
  if (Array.isArray(base.details) && overlay.details) {
    out.details = base.details.map((row, i) => mergeLocaleRow(row || {}, overlay.details[i] || {}));
  }
  return out;
}

/** Merge a new patch into an existing locale overlay (stored on `block.i18n[locale]`). */
function mergeI18nDelta(existingOverlay, patch) {
  if (!patch || typeof patch !== 'object') return existingOverlay || {};
  const ex = existingOverlay || {};
  const out = { ...ex, ...patch };
  const mergeArr = (key) => {
    if (!patch[key] || !Array.isArray(patch[key])) return;
    const exA = ex[key] || [];
    const pA = patch[key];
    const max = Math.max(exA.length, pA.length);
    const merged = [];
    for (let i = 0; i < max; i++) {
      const er = exA[i];
      const pr = pA[i];
      if (pr === undefined && er === undefined) continue;
      merged[i] = { ...(er || {}), ...(pr || {}) };
    }
    out[key] = merged;
  };
  mergeArr('items');
  mergeArr('cards');
  mergeArr('tabs');
  mergeArr('details');
  return out;
}

function resolveLocalizedProps(block, locale = SOURCE_LOCALE) {
  if (!block?.props) return {};
  if (locale === SOURCE_LOCALE) return block.props;
  const overlay = block.i18n && block.i18n[locale];
  if (!overlay) return block.props;
  return mergePropsLocaleOverlay(block.props, overlay);
}

function resolveLocalizedEventTitle(masterTitle, byLocale, locale) {
  if (locale === SOURCE_LOCALE) return masterTitle;
  const t = byLocale && byLocale[locale];
  if (typeof t === 'string' && t.trim()) return t;
  return masterTitle;
}

/** Read a string leaf stored only in the locale overlay (not merged). */
function readOverlayLeaf(overlay, pathSegments) {
  let cur = overlay;
  for (const seg of pathSegments) {
    if (cur == null) return '';
    cur = cur[seg];
  }
  return typeof cur === 'string' ? cur : '';
}

function pruneEmptyOverlayLeaves(o) {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map((item) => pruneEmptyOverlayLeaves(item));
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === '') continue;
    if (v && typeof v === 'object') out[k] = pruneEmptyOverlayLeaves(v);
    else out[k] = v;
  }
  return out;
}

/**
 * Build flat rows for side‑by‑side translation (Figma-style).
 * `targetText` is overlay-only; empty means fallback to English in preview.
 */
function collectTranslationRows(block, locale) {
  const rows = [];
  const master = block.props || {};
  const overlay = (block.i18n && block.i18n[locale]) || {};

  const push = (rowId, fieldLabel, sourceText, targetText, multiline = false) => {
    rows.push({
      rowId: `${block.id}:${rowId}`,
      fieldLabel,
      sourceText: sourceText == null ? '' : String(sourceText),
      targetText: targetText == null ? '' : String(targetText),
      multiline,
    });
  };

  if (block.type === 'title') {
    push('text', 'Text', master.text, readOverlayLeaf(overlay, ['text']), false);
  } else if (block.type === 'paragraph') {
    push('text', 'Text', master.text, readOverlayLeaf(overlay, ['text']), true);
  } else if (block.type === 'fullImage') {
    push('alt', 'Alt text', master.alt ?? '', readOverlayLeaf(overlay, ['alt']), false);
  } else if (block.type === 'imageGrid') {
    const items = normalizeImageGridProps(master);
    items.forEach((item, i) => {
      push(`items.${i}.title`, `Card ${i + 1} · Title`, item.title, readOverlayLeaf(overlay, ['items', i, 'title']), false);
      push(`items.${i}.body`, `Card ${i + 1} · Body`, item.body, readOverlayLeaf(overlay, ['items', i, 'body']), true);
    });
  } else if (block.type === 'eventDetails') {
    if (Array.isArray(master.details) && master.heading === undefined && master.promo === undefined) {
      master.details.forEach((d, i) => {
        push(`details.${i}.sub`, `${d.title || 'Field'} · value`, d.sub, readOverlayLeaf(overlay, ['details', i, 'sub']), false);
      });
    } else {
      push('heading', 'Section heading', master.heading ?? '', readOverlayLeaf(overlay, ['heading']), false);
      push('locationLine', 'Location line', master.locationLine ?? '', readOverlayLeaf(overlay, ['locationLine']), false);
      push('datesLine', 'Dates line', master.datesLine ?? '', readOverlayLeaf(overlay, ['datesLine']), false);
      push('promo', 'Promotional text', master.promo ?? '', readOverlayLeaf(overlay, ['promo']), true);
    }
  } else if (block.type === 'infoCard') {
    const { cards } = normalizeInfoCardProps(master);
    cards.forEach((c, i) => {
      push(`cards.${i}.heading`, `Card ${i + 1} · Heading`, c.heading, readOverlayLeaf(overlay, ['cards', i, 'heading']), false);
      push(`cards.${i}.price`, `Card ${i + 1} · Price`, c.price ?? '', readOverlayLeaf(overlay, ['cards', i, 'price']), false);
      push(`cards.${i}.ctaLabel`, `Card ${i + 1} · Button label`, c.ctaLabel ?? '', readOverlayLeaf(overlay, ['cards', i, 'ctaLabel']), false);
      push(`cards.${i}.badge`, `Card ${i + 1} · Badge`, c.badge ?? '', readOverlayLeaf(overlay, ['cards', i, 'badge']), false);
      push(`cards.${i}.bulletPointsText`, `Card ${i + 1} · Bullet points`, c.bulletPointsText ?? '', readOverlayLeaf(overlay, ['cards', i, 'bulletPointsText']), true);
    });
  } else if (block.type === 'tabs') {
    const tabs = normalizeTabsProps(master);
    tabs.forEach((tab, i) => {
      push(`tabs.${i}.label`, `Tab ${i + 1} · Label`, tab.label, readOverlayLeaf(overlay, ['tabs', i, 'label']), false);
      push(`tabs.${i}.contentTitle`, `Tab ${i + 1} · Section heading`, tab.contentTitle ?? '', readOverlayLeaf(overlay, ['tabs', i, 'contentTitle']), false);
      push(`tabs.${i}.body`, `Tab ${i + 1} · Body`, tab.body, readOverlayLeaf(overlay, ['tabs', i, 'body']), true);
    });
  }

  return rows;
}

/** `row.rowId` is `${blockId}:cards.${i}.heading` — return card index or null. */
function translationRowInfoCardIndex(row) {
  const m = String(row.rowId).match(/:cards\.(\d+)\./);
  return m ? parseInt(m[1], 10) : null;
}

/** Apply one target field change (stores overlay-only strings; empty removes override). */
function applyTranslationRowChange(block, locale, leafKey, newValue, patchBlockI18n) {
  const patch = {};
  const parts = leafKey.split('.');
  const master = block.props || {};
  if (parts[0] === 'text' && parts.length === 1) {
    patch.text = newValue;
  } else if (parts[0] === 'alt') {
    patch.alt = newValue;
  } else if (parts[0] === 'items') {
    const idx = parseInt(parts[1], 10);
    const field = parts[2];
    const masterItems = normalizeImageGridProps(master);
    const ov = block.i18n?.[locale] || {};
    const ovItems = [...(ov.items || [])];
    while (ovItems.length < masterItems.length) ovItems.push({});
    patch.items = masterItems.map((row, j) => {
      const prev = ovItems[j] || {};
      if (j !== idx) return prev;
      return { ...prev, [field]: newValue };
    });
  } else if (parts[0] === 'details') {
    const idx = parseInt(parts[1], 10);
    const baseDetails = master.details || [];
    const ov = block.i18n?.[locale] || {};
    const ovDetails = [...(ov.details || [])];
    while (ovDetails.length < baseDetails.length) ovDetails.push({});
    const merged = baseDetails.map((row, j) => {
      const prev = ovDetails[j] || {};
      if (j !== idx) return prev;
      return { ...prev, sub: newValue };
    });
    patch.details = merged;
  } else if (parts[0] === 'cards') {
    const idx = parseInt(parts[1], 10);
    const field = parts[2];
    const { cards } = normalizeInfoCardProps(master);
    const ov = block.i18n?.[locale] || {};
    const ovCards = [...(ov.cards || [])];
    while (ovCards.length < cards.length) ovCards.push({});
    const merged = cards.map((row, j) => {
      const prev = ovCards[j] || {};
      if (j !== idx) return prev;
      return { ...prev, [field]: newValue };
    });
    patch.cards = merged;
  } else if (parts[0] === 'tabs') {
    const idx = parseInt(parts[1], 10);
    const field = parts[2];
    const tabsM = normalizeTabsProps(master);
    const ov = block.i18n?.[locale] || {};
    const ovTabs = [...(ov.tabs || [])];
    while (ovTabs.length < tabsM.length) ovTabs.push({});
    const merged = tabsM.map((row, j) => {
      const prev = ovTabs[j] || {};
      if (j !== idx) return prev;
      return { ...prev, [field]: newValue };
    });
    patch.tabs = merged;
  } else {
    patch[parts[0]] = newValue;
  }
  patchBlockI18n(block.id, locale, pruneEmptyOverlayLeaves(patch));
}

const TRANSLATION_FIGMA_CHANNELS = [
  { id: 'all', name: 'All channels', isDefault: true, status: 'complete' },
  { id: 'reseller', name: 'Reseller', isDefault: false, status: 'complete' },
  { id: 'white_label', name: 'White label', isDefault: false, status: 'warning' },
];

function translationFigmaChannelScopeLabel(channelId) {
  if (channelId === 'white_label') return 'White Label';
  if (channelId === 'reseller') return 'Reseller';
  return 'All channels';
}

function TranslationFigmaLangColumns({ locale, onLocaleChange, done, total }) {
  return (
    <div className="translation-figma-lang-columns">
      <div className="translation-figma-lang-card translation-figma-lang-card--source">
        <div className="translation-figma-lang-card-inner">
          <span className="translation-figma-lang-card-title">English</span>
          <span className="translation-figma-lang-pill translation-figma-lang-pill--default">Default</span>
          <span className="ms material-symbols-outlined translation-figma-lang-card-chevron" aria-hidden>
            expand_more
          </span>
        </div>
      </div>
      <div className="translation-figma-lang-card translation-figma-lang-card--target">
        <label htmlFor="translation-target-select" className="sr-only">
          Target language
        </label>
        <div className="translation-figma-lang-select-wrap">
          <select
            id="translation-target-select"
            className="translation-figma-lang-select"
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value)}
          >
            {TRANSLATION_LOCALE_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="ms material-symbols-outlined translation-figma-lang-select-chevron" aria-hidden>
            expand_more
          </span>
        </div>
        {locale !== SOURCE_LOCALE ? (
          <div
            className={`translation-figma-progress translation-figma-progress--card ${done < total ? 'translation-figma-progress--warn' : ''}`}
          >
            <span className="translation-figma-progress-count">
              <span className="translation-figma-progress-num">{done}</span>
              <span className="translation-figma-progress-slash">/</span>
              <span className="translation-figma-progress-num">{total}</span>
            </span>
            <span className="translation-figma-progress-rest"> translated</span>
            <span className="ms material-symbols-outlined translation-figma-progress-warn-icon" aria-hidden>
              {done < total ? 'warning' : 'check_circle'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TranslationFigmaChannelsPanel({
  channelScope,
  onChannelScopeChange,
  activeChannelId,
  onActiveChannelChange,
}) {
  const channelsMissing = TRANSLATION_FIGMA_CHANNELS.some((c) => c.status === 'warning');
  return (
    <aside className="translation-figma-channels-panel" aria-label="Channels to apply translations">
      {channelsMissing ? (
        <div className="translation-figma-channel-alert" role="status">
          <span className="ms material-symbols-outlined translation-figma-channel-alert-icon" aria-hidden>
            warning
          </span>
          <span>Some channels have missing translations.</span>
        </div>
      ) : null}

      <div className="translation-figma-channel-field">
        <label htmlFor="translation-channel-scope" className="translation-figma-channel-field-label">
          Channels
        </label>
        <div className="translation-figma-channel-field-box">
          <select
            id="translation-channel-scope"
            className="translation-figma-channel-field-select"
            value={channelScope}
            onChange={(e) => {
              const v = e.target.value;
              onChannelScopeChange(v);
              onActiveChannelChange(v);
            }}
            aria-label="Channel scope"
          >
            <option value="all">All</option>
            <option value="reseller">Reseller</option>
            <option value="white_label">White label</option>
          </select>
          <span className="ms material-symbols-outlined translation-figma-channel-field-chevron" aria-hidden>
            expand_more
          </span>
        </div>
      </div>

      <div className="translation-figma-channel-list-head">
        <span className="translation-figma-channel-list-title">Available channels</span>
        <button type="button" className="btn btn-primary translation-figma-channel-edit-btn">
          Edit
        </button>
      </div>

      <ul className="translation-figma-channel-cards" role="list">
        {TRANSLATION_FIGMA_CHANNELS.map((ch) => {
          const selected = activeChannelId === ch.id;
          const warn = ch.status === 'warning';
          return (
            <li key={ch.id} className="translation-figma-channel-cards-item">
              <button
                type="button"
                className={`translation-figma-channel-card${selected ? ' translation-figma-channel-card--selected' : ''}`}
                onClick={() => {
                  onActiveChannelChange(ch.id);
                  onChannelScopeChange(ch.id);
                }}
                aria-pressed={selected}
              >
                <span className="translation-figma-channel-card-main">
                  <span className="translation-figma-channel-card-name">{ch.name}</span>
                  {ch.isDefault ? (
                    <span className="translation-figma-channel-badge">Default</span>
                  ) : null}
                </span>
                <span className="translation-figma-channel-card-status" aria-hidden>
                  {warn ? (
                    <span className="ms material-symbols-outlined translation-figma-channel-card-warn">warning</span>
                  ) : (
                    <span className="ms material-symbols-outlined translation-figma-channel-card-ok">check_circle</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function TranslationFigmaWorkspace({
  locale,
  onLocaleChange,
  eventTitle,
  eventTitleByLocale,
  onLocaleTitleChange,
  blocks,
  patchBlockI18n,
  childrenPreview,
  selectedBlockId = null,
  onSelectBlock,
  previewMode,
  initialChannelId = null,
  hideChannelContentEdit = false,
  channelEditorLaunchMeta = null,
  /** When true, the translation preview column does not swallow drag/drop (for embedded description builder). */
  allowPreviewCanvasDnD = false,
  /** When set (e.g. channel editor), merge patches into `block.props` for master-only fields such as Info card accents. */
  patchBlockMasterProps = null,
}) {
  const isLangBodyPreview = previewMode === 'langAndBody';
  const translationPreviewSlotClassName = `translation-figma-preview-slot translation-figma-preview-slot--direct${
    allowPreviewCanvasDnD ? ' translation-figma-preview-slot--editable-canvas' : ''
  }`;
  const translationPreviewSlotDragShieldProps = allowPreviewCanvasDnD
    ? {}
    : {
        onDragOver: (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'none';
        },
        onDrop: (e) => {
          e.preventDefault();
        },
      };
  const resolveInitialChannelId = () => {
    if (initialChannelId && TRANSLATION_FIGMA_CHANNELS.some((c) => c.id === initialChannelId)) {
      return initialChannelId;
    }
    return isLangBodyPreview ? 'reseller' : 'all';
  };
  const [search, setSearch] = React.useState('');
  const [translationsByChannel, setTranslationsByChannel] = React.useState(() => isLangBodyPreview);
  const [channelScope, setChannelScope] = React.useState(resolveInitialChannelId);
  const [activeChannelId, setActiveChannelId] = React.useState(resolveInitialChannelId);
  const [saveFlash, setSaveFlash] = React.useState(false);
  const [openSections, setOpenSections] = React.useState(() =>
    isLangBodyPreview ? new Set(['__event_content']) : new Set(),
  );
  /** Active info-card index per block (channel editor: matches "Active card" tabs). */
  const [infoCardSectionTab, setInfoCardSectionTab] = React.useState({});

  const translationBlockIdsKey = React.useMemo(() => blocks.map((b) => b.id).join('|'), [blocks]);

  React.useEffect(() => {
    if (isLangBodyPreview) {
      setOpenSections((prev) => {
        const next = new Set(prev);
        next.add('__event_content');
        return next;
      });
      return;
    }
    if (locale === SOURCE_LOCALE) return;
    setOpenSections(new Set(['__event_content']));
  }, [locale, isLangBodyPreview]);

  React.useEffect(() => {
    if (!isLangBodyPreview || locale === SOURCE_LOCALE) return;
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add('__event_content');
      blocks.forEach((block) => {
        if (collectTranslationRows(block, locale).length) next.add(block.id);
      });
      return next;
    });
  }, [isLangBodyPreview, locale, translationBlockIdsKey]);

  React.useEffect(() => {
    setInfoCardSectionTab((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const b of blocks) {
        if (b.type !== 'infoCard') continue;
        const n = normalizeInfoCardProps(b.props).cards.length;
        if (n <= 0) continue;
        const cur = next[b.id];
        if (typeof cur === 'number' && cur >= n) {
          next[b.id] = Math.max(0, n - 1);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [blocks]);

  React.useEffect(() => {
    if (!translationsByChannel) {
      setChannelScope('all');
      setActiveChannelId('all');
    }
  }, [translationsByChannel]);

  React.useEffect(() => {
    if (locale === SOURCE_LOCALE) return;
    if (!selectedBlockId || !blocks.some((b) => b.id === selectedBlockId)) return;
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(selectedBlockId);
      return next;
    });
  }, [locale, selectedBlockId, blocks.length]);

  React.useEffect(() => {
    if (locale === SOURCE_LOCALE) return;
    if (!selectedBlockId || !blocks.some((b) => b.id === selectedBlockId)) return;
    const sid = selectedBlockId;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(sid) : sid.replace(/"/g, '\\"');
        const el = document.querySelector(`[data-translation-section="${esc}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }, [locale, selectedBlockId, blocks.length]);

  const toggleSection = (id) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const eventRow = {
    rowId: '__event:title',
    fieldLabel: 'Event title',
    sourceText: eventTitle,
    targetText: locale === SOURCE_LOCALE ? eventTitle : (eventTitleByLocale[locale] ?? ''),
    multiline: false,
  };

  const allRows = [];
  if (locale !== SOURCE_LOCALE) {
    allRows.push(eventRow);
    blocks.forEach((block) => {
      collectTranslationRows(block, locale).forEach((r) => {
        allRows.push({ ...r, blockId: block.id, blockType: block.type });
      });
    });
  }

  const annotated = allRows.map((r) => {
    const src = (r.sourceText || '').trim();
    const tgt = (r.targetText || '').trim();
    const needsWarning = !tgt || tgt === src;
    return { ...r, needsWarning };
  });

  const filtered = annotated.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      r.fieldLabel.toLowerCase().includes(q) ||
      r.sourceText.toLowerCase().includes(q) ||
      r.targetText.toLowerCase().includes(q)
    );
  });

  const total = annotated.length;
  const done = annotated.filter((r) => !r.needsWarning).length;
  const targetLocaleLabel = TRANSLATION_LOCALE_OPTIONS.find((o) => o.code === locale)?.label ?? locale;

  const eventRowsFiltered =
    locale !== SOURCE_LOCALE ? filtered.filter((r) => String(r.rowId).startsWith('__event:')) : [];
  const evDone = eventRowsFiltered.filter((r) => !r.needsWarning).length;
  const evTotal = eventRowsFiltered.length;
  const eventTranslationRow =
    locale !== SOURCE_LOCALE ? filtered.find((r) => r.rowId === '__event:title') : null;

  const descriptionRowsAnnotated = annotated.filter((r) => r.blockId);
  const descriptionNeedsWarning =
    descriptionRowsAnnotated.length > 0 &&
    descriptionRowsAnnotated.some((r) => r.needsWarning);

  const handleTargetChange = (row, value) => {
    if (row.rowId === '__event:title') {
      onLocaleTitleChange(locale, value);
      return;
    }
    const block = blocks.find((b) => b.id === row.blockId);
    if (!block) return;
    const c = row.rowId.indexOf(':');
    const leafKey = c >= 0 ? row.rowId.slice(c + 1) : row.rowId;
    applyTranslationRowChange(block, locale, leafKey, value, patchBlockI18n);
  };

  const onSaveClick = () => {
    setSaveFlash(true);
    window.setTimeout(() => setSaveFlash(false), 1800);
  };

  const openChannelEditorPage = React.useCallback(() => {
    if (hideChannelContentEdit) return;
    try {
      const blocksCopy = cloneJsonSafe(blocks);
      const eventTitleByLocaleCopy = cloneJsonSafe(eventTitleByLocale) || {};
      const meta =
        channelEditorLaunchMeta && typeof channelEditorLaunchMeta === 'object'
          ? cloneJsonSafe(channelEditorLaunchMeta) || {}
          : {};
      writeChannelEditorLaunchPayload({
        v: 1,
        eventTitle,
        eventTitleByLocale: eventTitleByLocaleCopy,
        blocks: Array.isArray(blocksCopy) ? blocksCopy : [],
        locale,
        activeChannelId,
        savedAt: Date.now(),
        ...meta,
      });
    } catch (e) {
      console.warn('Channel editor: could not serialize or store launch payload', e);
    }
    const u = new URL('translation-channel-editor.html', window.location.href);
    u.searchParams.set('locale', locale);
    u.searchParams.set('channel', activeChannelId);
    window.open(u.toString(), '_blank', 'noopener,noreferrer');
  }, [
    eventTitle,
    eventTitleByLocale,
    blocks,
    locale,
    activeChannelId,
    hideChannelContentEdit,
    channelEditorLaunchMeta,
  ]);

  const renderTargetLocaleEditor = () => (
    <>
      {translationsByChannel ? (
        <div className="translation-figma-channel-content-head" aria-label="Channel translation scope">
          <h2 className="translation-figma-channel-content-title">
            {targetLocaleLabel} ({translationFigmaChannelScopeLabel(activeChannelId)})
          </h2>
          <div className="translation-figma-channel-content-head-progress">
            <span className="translation-figma-channel-content-progress-num">{done}</span>
            <span className="translation-figma-channel-content-progress-slash">/</span>
            <span className="translation-figma-channel-content-progress-num">{total}</span>
            <span className="translation-figma-channel-content-progress-rest"> translated</span>
          </div>
          {!hideChannelContentEdit ? (
            <button
              type="button"
              className="btn btn-primary translation-figma-channel-content-edit-btn"
              onClick={openChannelEditorPage}
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="translation-figma-event-content-wrap">
        <div className="translation-figma-section--event-content">
          <button
            type="button"
            className="translation-figma-section-head"
            onClick={() => toggleSection('__event_content')}
            aria-expanded={openSections.has('__event_content')}
          >
            <span className="ms material-symbols-outlined translation-figma-chevron">
              {openSections.has('__event_content') ? 'expand_less' : 'chevron_right'}
            </span>
            <span className="translation-figma-section-title">Event content</span>
            <span
              className={`translation-figma-section-meta ${
                evTotal === 0 || evDone < evTotal
                  ? 'translation-figma-section-meta--warn'
                  : 'translation-figma-section-meta--complete'
              }`}
            >
              {evDone}/{evTotal} translated
            </span>
          </button>
          {openSections.has('__event_content') ? (
            <div className="translation-figma-event-content-body">
              {eventTranslationRow ? (
                <>
                  <TranslationFigmaFieldRow
                    row={{ ...eventTranslationRow, fieldLabel: 'Title *', multiline: false }}
                    needsWarning={
                      !(eventTranslationRow.targetText || '').trim() ||
                      (eventTranslationRow.targetText || '').trim() === (eventTranslationRow.sourceText || '').trim()
                    }
                    onChange={(v) => handleTargetChange(eventTranslationRow, v)}
                    onFocusBlock={onSelectBlock}
                  />
                </>
              ) : null}
              <div className="translation-figma-description-split-head">
                <div className="translation-figma-field-label-row">
                  <span className="translation-figma-field-label">Description *</span>
                  {descriptionNeedsWarning ? (
                    <span className="translation-figma-warn-icon" title="Still matches English or empty">
                      <span className="ms material-symbols-outlined">warning</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="translation-figma-main-split translation-figma-main-split--in-event">
                <div className="translation-figma-preview-column" aria-label="Live preview">
                  <div className={translationPreviewSlotClassName} {...translationPreviewSlotDragShieldProps}>
                    {childrenPreview}
                  </div>
                </div>

                <div className="translation-figma-editor-column" aria-label="Translation fields">
                  <div className="translation-figma-editor-column-body">
                    <div className="translation-figma-dual-wrap">
                      {blocks.map((block, bi) => {
                        const blockRows = filtered.filter((r) => r.blockId === block.id);
                        const showMasterChrome =
                          typeof patchBlockMasterProps === 'function' &&
                          (block.type === 'infoCard' || block.type === 'tabs');
                        if (blockRows.length === 0 && !showMasterChrome) return null;
                        const t = COMPONENT_TYPES[block.type];
                        const filterInfoCardByActiveTab =
                          showMasterChrome && block.type === 'infoCard';
                        const nInfoCards = filterInfoCardByActiveTab
                          ? normalizeInfoCardProps(block.props).cards.length
                          : 0;
                        let activeInfoIdx = filterInfoCardByActiveTab
                          ? infoCardSectionTab[block.id] ?? 0
                          : 0;
                        if (filterInfoCardByActiveTab && nInfoCards > 0) {
                          activeInfoIdx = Math.min(Math.max(0, activeInfoIdx), nInfoCards - 1);
                        }
                        const blockRowsVisible = filterInfoCardByActiveTab
                          ? blockRows.filter((r) => translationRowInfoCardIndex(r) === activeInfoIdx)
                          : blockRows;
                        const secDone = blockRowsVisible.filter((r) => !r.needsWarning).length;
                        const secTotal = blockRowsVisible.length;
                        const metaComplete = secTotal === 0 || secDone >= secTotal;
                        return (
                          <div key={block.id} className="translation-figma-section" data-translation-section={block.id}>
                            <button
                              type="button"
                              className="translation-figma-section-head"
                              onClick={() => toggleSection(block.id)}
                              aria-expanded={openSections.has(block.id)}
                            >
                              <span className="ms material-symbols-outlined translation-figma-chevron">
                                {openSections.has(block.id) ? 'expand_less' : 'chevron_right'}
                              </span>
                              <span className="translation-figma-section-title">
                                <span className="ms material-symbols-outlined translation-figma-section-icon">{t.icon}</span>
                                {t.label}
                                <span className="translation-figma-section-idx"> · Block {bi + 1}</span>
                              </span>
                              <span
                                className={`translation-figma-section-meta ${
                                  metaComplete
                                    ? 'translation-figma-section-meta--complete'
                                    : 'translation-figma-section-meta--warn'
                                }`}
                              >
                                {secTotal > 0 ? `${secDone}/${secTotal}` : 'Listing'}
                              </span>
                            </button>
                            {openSections.has(block.id) ? (
                              <div className="translation-figma-section-expand">
                                {patchBlockMasterProps && block.type === 'infoCard' ? (
                                  <TranslationFigmaInfoCardAccentPanel
                                    block={block}
                                    onPatchMaster={patchBlockMasterProps}
                                    activeCardIndex={activeInfoIdx}
                                    onActiveCardIndexChange={(idx) =>
                                      setInfoCardSectionTab((prev) => ({ ...prev, [block.id]: idx }))
                                    }
                                  />
                                ) : null}
                                {patchBlockMasterProps && block.type === 'tabs' ? (
                                  <TranslationFigmaTabsBarColorPanel
                                    block={block}
                                    onPatchMaster={patchBlockMasterProps}
                                  />
                                ) : null}
                                {blockRowsVisible.map((row) => (
                                  <TranslationFigmaFieldRow
                                    key={row.rowId}
                                    row={row}
                                    needsWarning={row.needsWarning}
                                    onChange={(v) => handleTargetChange(row, v)}
                                    onFocusBlock={onSelectBlock}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  if (isLangBodyPreview) {
    return (
      <div className="translation-figma-root translation-figma-root--locale-preview">
        <div className="translation-figma-workspace-top">
          <TranslationFigmaLangColumns locale={locale} onLocaleChange={onLocaleChange} done={done} total={total} />
        </div>
        <div className="translation-figma-body translation-figma-body--by-channel translation-figma-body--locale-preview-solo">
          <div className="translation-figma-body-main">{renderTargetLocaleEditor()}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="translation-figma-root">
      <div className="translation-figma-workspace-top">
        <div className="translation-figma-workspace-heading-row">
          <div className="translation-figma-workspace-heading-text">
            <p className="section-sub translation-figma-workspace-section-sub">
              Translate event copy and description components for each language. Progress and warnings update as you edit.
            </p>
          </div>
          <div className="translation-figma-workspace-actions">
            <button
              type="button"
              className={`btn btn-primary translation-figma-save-top ${saveFlash ? 'translation-figma-save-top--flash' : ''}`}
              onClick={onSaveClick}
            >
              Save
            </button>
          </div>
        </div>
        <TranslationFigmaLangColumns locale={locale} onLocaleChange={onLocaleChange} done={done} total={total} />
      </div>

      <div className="translation-figma-controls">
        <div className="translation-figma-search">
          <span className="ms material-symbols-outlined translation-figma-search-icon">search</span>
          <input
            type="search"
            className="input translation-figma-search-input"
            placeholder="Search content"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search translation fields"
          />
        </div>
        <div className="translation-figma-toggle translation-figma-toggle--switch-row">
          <button
            type="button"
            id="translation-by-channel-switch"
            role="switch"
            aria-label="Translations by channel"
            aria-checked={translationsByChannel}
            className={`translation-figma-switch ${translationsByChannel ? 'translation-figma-switch--on' : ''}`}
            onClick={() => setTranslationsByChannel((v) => !v)}
          >
            <span className="translation-figma-switch-thumb" aria-hidden />
          </button>
          <label className="translation-figma-toggle-text" htmlFor="translation-by-channel-switch">
            Translations by channel
          </label>
        </div>
      </div>

      <div
        className={
          translationsByChannel && locale !== SOURCE_LOCALE
            ? 'translation-figma-body translation-figma-body--by-channel'
            : 'translation-figma-body'
        }
      >
        {translationsByChannel && locale !== SOURCE_LOCALE ? (
          <TranslationFigmaChannelsPanel
            channelScope={channelScope}
            onChannelScopeChange={setChannelScope}
            activeChannelId={activeChannelId}
            onActiveChannelChange={setActiveChannelId}
          />
        ) : null}
        <div className="translation-figma-body-main">
      {locale === SOURCE_LOCALE ? (
        <>
          <p className="translation-figma-master-hint">
            Select <strong>Spanish</strong>, <strong>French</strong>, or <strong>German</strong> to edit translations side‑by‑side with English. Master copy is edited on the <strong>Content</strong> tab.
          </p>
          <div className="translation-figma-main-split translation-figma-main-split--standalone">
            <div className="translation-figma-preview-column" aria-label="Live preview">
              <div className="translation-figma-preview-column-head">
                <span className="translation-figma-preview-column-title">Preview</span>
                <span className="translation-figma-preview-column-sub">Content builder layout, read-only</span>
              </div>
              <div className={translationPreviewSlotClassName} {...translationPreviewSlotDragShieldProps}>
                {childrenPreview}
              </div>
            </div>
            <div className="translation-figma-editor-column" aria-label="Translation fields">
              <div className="translation-figma-editor-placeholder">
                <p>Choose a target language above to enter translations in this column.</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        renderTargetLocaleEditor()
      )}
        </div>
      </div>
    </div>
  );
}

/** Info card master chrome (Active card + accent), matching `Properties` markup for channel editor. */
function TranslationFigmaInfoCardAccentPanel({ block, onPatchMaster, activeCardIndex, onActiveCardIndexChange }) {
  if (block.type !== 'infoCard' || typeof onPatchMaster !== 'function') return null;
  if (typeof activeCardIndex !== 'number' || typeof onActiveCardIndexChange !== 'function') return null;

  const { cards: cardsMaster } = normalizeInfoCardProps(block.props);
  const nCards = cardsMaster.length;
  const i = Math.min(Math.max(0, activeCardIndex), Math.max(0, nCards - 1));
  const cardAt = cardsMaster[i] ?? createDefaultInfoCard(i);

  const setCards = (next) => {
    onPatchMaster(block.id, { cards: next });
  };

  const patchCardAccent = (mutate) => {
    const next = cardsMaster.map((c, j) => (j === i ? mutate({ ...c }) : { ...c }));
    setCards(next);
  };

  return (
    <aside
      className="properties translation-figma-channel-master-properties"
      aria-label="Info card listing controls"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="prop">
        <label className="prop-label">Active card</label>
        <div className="prop-segment prop-image-grid-card-tabs" role="tablist" aria-label="Info cards">
          {cardsMaster.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className={i === idx ? 'active' : ''}
              onClick={() => onActiveCardIndexChange(idx)}
            >
              {idx + 1}
            </button>
          ))}
          {nCards < INFO_CARD_MAX ? (
            <button
              type="button"
              className="prop-segment-add"
              aria-label="Add card"
              onClick={() => {
                const next = [...cardsMaster, createDefaultInfoCard(cardsMaster.length)];
                setCards(next);
                onActiveCardIndexChange(next.length - 1);
              }}
            >
              +
            </button>
          ) : null}
        </div>
      </div>
      <div className="prop-tabs-section" key={`ic-accent-wrap-${block.id}-${i}`}>
        <div className="prop-tabs-section-head">
          <div className="prop-tabs-section-head-text">
            <span className="prop-tabs-section-eyebrow">Listing (master)</span>
            <h3 className="prop-tabs-section-heading">Card {i + 1}</h3>
          </div>
        </div>
        <div className="prop-tabs-section-fields">
          <div className="prop">
            <label className="prop-label">Accent color</label>
            <div className="prop-accent-field" key={`ic-accent-field-${block.id}-${i}`}>
              <div className="prop-accent-row">
                <input
                  key={`ic-hex-${block.id}-${i}`}
                  type="text"
                  className="prop-accent-hex"
                  value={(cardsMaster[i] ?? cardAt).accentColor ?? ''}
                  placeholder={INFO_CARD_ACCENT_DEFAULT_HEX}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label={`Accent color hex for card ${i + 1}`}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (v.length > 0 && !v.startsWith('#')) v = '#' + v.replace(/^#+/, '');
                    patchCardAccent((c) => ({ ...c, accentColor: v.slice(0, 7) }));
                  }}
                  onBlur={(e) => {
                    const normalized = normalizeAccentHex(e.target.value, INFO_CARD_ACCENT_DEFAULT_HEX);
                    patchCardAccent((c) => ({ ...c, accentColor: normalized }));
                  }}
                />
                <input
                  key={`ic-picker-${block.id}-${i}`}
                  type="color"
                  className="prop-accent-picker"
                  value={normalizeAccentHex((cardsMaster[i] ?? cardAt).accentColor, INFO_CARD_ACCENT_DEFAULT_HEX)}
                  aria-label={`Choose accent for card ${i + 1}`}
                  onChange={(e) => {
                    patchCardAccent((c) => ({ ...c, accentColor: e.target.value.toLowerCase() }));
                  }}
                />
              </div>
              <div
                className="prop-accent-presets"
                role="group"
                aria-label={`Default accent colors for card ${i + 1}`}
              >
                {INFO_CARD_ACCENT_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`prop-accent-swatch${
                      normalizeAccentHex((cardsMaster[i] ?? cardAt).accentColor, '') === hex
                        ? ' prop-accent-swatch--active'
                        : ''
                    }`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    aria-label={`Set card ${i + 1} accent to ${hex}`}
                    aria-pressed={normalizeAccentHex((cardsMaster[i] ?? cardAt).accentColor, '') === hex}
                    onClick={() => {
                      patchCardAccent((c) => ({ ...c, accentColor: hex }));
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Tabs block tab bar color (master `tabBarColor`) for channel editor. */
function TranslationFigmaTabsBarColorPanel({ block, onPatchMaster }) {
  if (block.type !== 'tabs' || typeof onPatchMaster !== 'function') return null;

  const masterProps = block.props || {};
  const tabBarRaw =
    typeof masterProps.tabBarColor === 'string' ? masterProps.tabBarColor.trim() : '';
  const tabsBarHasCustom = /^#[0-9A-Fa-f]{6}$/.test(tabBarRaw);
  const tabsBarEffectiveHex = tabsBarHasCustom ? tabBarRaw : TABS_BAR_COLOR_DEFAULT_HEX;
  const tabBarNorm = normalizeAccentHex(tabBarRaw, '');
  const tabsPresetIsActive = (hex) => {
    if (hex === TABS_BAR_COLOR_DEFAULT_HEX) {
      return !tabsBarHasCustom || tabBarNorm === TABS_BAR_COLOR_DEFAULT_HEX;
    }
    return tabsBarHasCustom && tabBarNorm === hex;
  };

  return (
    <aside
      className="properties translation-figma-channel-master-properties"
      aria-label="Tabs listing controls"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="prop">
        <label className="prop-label">Tab bar color</label>
        <div className="prop-accent-field">
          <div className="prop-accent-row">
            <input
              type="text"
              className="prop-accent-hex"
              value={tabsBarHasCustom ? tabBarRaw : ''}
              placeholder={TABS_BAR_COLOR_DEFAULT_HEX}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Tab bar color (hex)"
              onChange={(e) => {
                let v = e.target.value;
                if (v.length > 0 && !v.startsWith('#')) v = '#' + v.replace(/^#+/, '');
                onPatchMaster(block.id, { tabBarColor: v.slice(0, 7) });
              }}
              onBlur={(e) => {
                const hexNorm = normalizeAccentHex(e.target.value, '');
                onPatchMaster(block.id, { tabBarColor: hexNorm || '' });
              }}
            />
            <input
              type="color"
              className="prop-accent-picker"
              value={normalizeAccentHex(tabsBarEffectiveHex, TABS_BAR_COLOR_DEFAULT_HEX)}
              aria-label="Choose tab bar color"
              onFocus={() =>
                onPatchMaster(block.id, {
                  tabBarColor: normalizeAccentHex(tabsBarEffectiveHex, TABS_BAR_COLOR_DEFAULT_HEX),
                })
              }
              onChange={(e) => onPatchMaster(block.id, { tabBarColor: e.target.value.toLowerCase() })}
            />
          </div>
          <div className="prop-accent-presets" role="group" aria-label="Tab bar color presets">
            {TABS_BAR_COLOR_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                className={`prop-accent-swatch${tabsPresetIsActive(hex) ? ' prop-accent-swatch--active' : ''}`}
                style={{ backgroundColor: hex }}
                title={hex === TABS_BAR_COLOR_DEFAULT_HEX ? `Default (${hex})` : hex}
                aria-label={
                  hex === TABS_BAR_COLOR_DEFAULT_HEX
                    ? `Use default tab bar color ${hex}`
                    : `Set tab bar to ${hex}`
                }
                aria-pressed={tabsPresetIsActive(hex)}
                onClick={() =>
                  onPatchMaster(block.id, {
                    tabBarColor: hex === TABS_BAR_COLOR_DEFAULT_HEX ? '' : hex,
                  })
                }
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TranslationFigmaFieldRow({ row, needsWarning, onChange, showFieldLabel = true, onFocusBlock }) {
  const multiline = !!row.multiline;
  const rows = multiline ? 5 : 1;
  const syncPreviewSelection = () => {
    if (row.blockId && onFocusBlock) onFocusBlock(row.blockId);
  };
  return (
    <div className={`translation-figma-field${multiline ? '' : ' translation-figma-field--single-line'}`}>
      {showFieldLabel ? (
        <div className="translation-figma-field-label-row">
          <span className="translation-figma-field-label">{row.fieldLabel}</span>
          {needsWarning ? (
            <span className="translation-figma-warn-icon" title="Still matches English or empty">
              <span className="ms material-symbols-outlined">warning</span>
            </span>
          ) : null}
        </div>
      ) : needsWarning ? (
        <div className="translation-figma-field-label-row translation-figma-field-label-row--icon-only">
          <span className="translation-figma-warn-icon" title="Still matches English or empty">
            <span className="ms material-symbols-outlined">warning</span>
          </span>
        </div>
      ) : null}
      <div className="translation-figma-field-cols">
        <textarea
          className="translation-figma-source"
          readOnly
          value={row.sourceText}
          rows={rows}
          onFocus={syncPreviewSelection}
        />
        {multiline ? (
          <textarea
            className="translation-figma-target"
            value={row.targetText}
            placeholder={row.sourceText}
            onChange={(e) => onChange(e.target.value)}
            onFocus={syncPreviewSelection}
            rows={5}
          />
        ) : (
          <input
            type="text"
            className="input translation-figma-target"
            value={row.targetText}
            placeholder={row.sourceText}
            onChange={(e) => onChange(e.target.value)}
            onFocus={syncPreviewSelection}
          />
        )}
      </div>
    </div>
  );
}

function PlanTabEmptyState({ icon, headline, description }) {
  return (
    <div className="plan-tab-empty" role="status">
      <span className="ms material-symbols-outlined plan-tab-empty-icon" aria-hidden>
        {icon}
      </span>
      <p className="plan-tab-empty-headline">{headline}</p>
      <p className="plan-tab-empty-text">{description}</p>
    </div>
  );
}

// ---------- Sidebar ----------
function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-item parent active">
          <span className="ms material-symbols-outlined">event</span>
          Events
          <span className="ms material-symbols-outlined" style={{marginLeft:'auto', fontSize:18}}>expand_more</span>
        </div>
        <div className="sidebar-children">
          <div className="sidebar-item">Events List</div>
          <div className="sidebar-item">Dashboard</div>
          <div className="sidebar-item active">Content</div>
          <div className="sidebar-item">General Settings</div>
          <div className="sidebar-item">Inventory Setup</div>
          <div className="sidebar-item">Time Slots</div>
          <div className="sidebar-item">Channels</div>
          <div className="sidebar-item">Attendees</div>
          <div className="sidebar-item">Invitations</div>
          <div className="sidebar-item">Reviews</div>
        </div>
      </div>
      <div className="sidebar-divider"></div>
      {[
        ['verified', 'Validation'],
        ['receipt_long', 'Orders'],
        ['bookmark', 'Reservations'],
        ['card_membership', 'Memberships'],
        ['point_of_sale', 'Box Office'],
        ['campaign', 'Marketing'],
        ['monitoring', 'Analytics'],
      ].map(([icon, label]) => (
        <div key={label} className="sidebar-item">
          <span className="ms material-symbols-outlined">{icon}</span>{label}
        </div>
      ))}
      <div className="sidebar-item parent">
        <span className="ms material-symbols-outlined">hub</span>Channels
        <span className="ms material-symbols-outlined" style={{marginLeft:'auto', fontSize:18}}>expand_more</span>
      </div>
      {[
        ['location_on', 'Venues'],
        ['account_balance', 'Finance'],
      ].map(([icon, label]) => (
        <div key={label} className="sidebar-item">
          <span className="ms material-symbols-outlined">{icon}</span>{label}
        </div>
      ))}
      <div className="sidebar-item parent">
        <span className="ms material-symbols-outlined">settings</span>Settings
        <span className="ms material-symbols-outlined" style={{marginLeft:'auto', fontSize:18}}>expand_more</span>
      </div>
      <div className="sidebar-item">
        <span className="ms material-symbols-outlined">corporate_fare</span>Organizations
      </div>
      <div className="sidebar-item">
        <span className="ms material-symbols-outlined">logout</span>Log out
      </div>
    </nav>
  );
}

// ---------- Topbar ----------
function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-logo">
        <span className="badge"></span>
        fever<span className="zone">ZONE</span>
      </div>
      <div className="topbar-right">
        <button type="button" className="btn topbar-create-event">
          Create event
        </button>
        <div className="user-chip">
          <span>SO Test</span>
          <span className="user-avatar">
            <span className="ms material-symbols-outlined" style={{fontSize:18}}>person</span>
          </span>
        </div>
      </div>
    </header>
  );
}

// ---------- Stepper ----------
function Stepper() {
  return (
    <div className="stepper">
      {[
        {label: 'Content', state: 'active'},
        {label: 'Event settings', state: ''},
        {label: 'Inventory setup', state: ''},
      ].map((s, i, arr) => (
        <div key={s.label} className={`step ${s.state}`}>
          <div className="step-row">
            <div className="step-dot"></div>
            <div className="step-line"></div>
          </div>
          <div className="step-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- Requirements callout ----------
function Requirements() {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="requirements">
      <div className="requirements-header" onClick={() => setOpen(!open)}>
        Please follow the content requirements
        <span className="ms material-symbols-outlined">{open ? 'expand_less' : 'expand_more'}</span>
      </div>
      {open && (
        <div className="requirements-grid">
          <div className="requirements-item">
            <span className="ms material-symbols-outlined">match_case</span>
            <div><strong>Don't use all caps</strong> in the title or description</div>
          </div>
          <div className="requirements-item">
            <span className="ms material-symbols-outlined">edit_note</span>
            <div><strong>Be concise,</strong> shorter copies increase conversion.</div>
          </div>
          <div className="requirements-item">
            <span className="ms material-symbols-outlined">link_off</span>
            <div><strong>Don't add external links</strong></div>
          </div>
          <div className="requirements-item">
            <span className="ms material-symbols-outlined">format_size</span>
            <div><strong>Follow recommended characters</strong> per section</div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCardTile({ ic, bulletLines }) {
  const accent = resolveCardAccent(ic);
  const ctaFg = contrastTextForBackground(accent);
  const readableAccent = accentReadableOnWhite(accent);
  return (
    <div
      className={`block-info-card${ic.highlighted ? ' block-info-card--highlight' : ''}`}
      style={{
        '--ic-accent': accent,
        '--ic-cta-fg': ctaFg,
        '--ic-readable-accent': readableAccent,
      }}
    >
      <div className="info-card-top">
        {ic.imageSrc ? (
          <>
            <img className="info-card-image" src={ic.imageSrc} alt="" />
            {ic.badge ? <span className="info-card-badge">{ic.badge}</span> : null}
          </>
        ) : (
          <div className="info-card-header">
            {ic.badge ? <span className="info-card-badge">{ic.badge}</span> : null}
          </div>
        )}
      </div>
      <div className="info-card-main">
        <div className="info-card-heading">{ic.heading}</div>
        <div className="info-card-price" style={{ color: readableAccent }}>
          {ic.price}
        </div>
        <ul className="info-card-features">
          {bulletLines.map((line, i) => (
            <li key={i}>
              <span className="ms material-symbols-outlined info-card-check">check</span>
              <span className="info-card-feature-text">{line}</span>
            </li>
          ))}
        </ul>
        <div className="info-card-cta">
          <span>{ic.ctaLabel}</span>
          <span className="ms material-symbols-outlined">arrow_forward</span>
        </div>
      </div>
    </div>
  );
}

/** Horizontal strip for 2+ cards: arrow navigation on desktop preview; swipe/scroll on mobile frame. */
function InfoCardsCarousel({ cards }) {
  const trackRef = React.useRef(null);
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  const syncNav = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    const overflow = max > 2;
    setHasOverflow(overflow);
    if (!overflow) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    setCanPrev(scrollLeft > 1);
    setCanNext(scrollLeft < max - 1);
  }, []);

  React.useLayoutEffect(() => {
    syncNav();
  }, [cards.length, syncNav]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = 0;
  }, [cards.length]);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncNav, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncNav) : null;
    ro?.observe(el);
    const onResize = () => syncNav();
    window.addEventListener('resize', onResize);
    const imgs = el.querySelectorAll('img');
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener('load', onResize, { once: true });
    });
    return () => {
      el.removeEventListener('scroll', syncNav);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [syncNav, cards.length]);

  const scrollByDir = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.querySelector('.block-info-card');
    const gap = 12;
    const w = first?.getBoundingClientRect().width ?? 272;
    el.scrollBy({ left: dir * (w + gap), behavior: 'smooth' });
  };

  return (
    <div
      className={`block-info-cards block-info-cards--carousel${hasOverflow ? ' block-info-cards--carousel-overflow' : ''}`}
    >
      <button
        type="button"
        className="block-info-cards-nav block-info-cards-nav--prev"
        aria-label="Previous cards"
        disabled={!canPrev}
        onClick={(e) => {
          e.stopPropagation();
          scrollByDir(-1);
        }}
      >
        <span className="ms material-symbols-outlined">chevron_left</span>
      </button>
      <button
        type="button"
        className="block-info-cards-nav block-info-cards-nav--next"
        aria-label="Next cards"
        disabled={!canNext}
        onClick={(e) => {
          e.stopPropagation();
          scrollByDir(1);
        }}
      >
        <span className="ms material-symbols-outlined">chevron_right</span>
      </button>
      <div ref={trackRef} className="block-info-cards-track">
        {cards.map((ic, idx) => (
          <InfoCardTile key={idx} ic={ic} bulletLines={bulletLinesFromCard(ic)} />
        ))}
      </div>
    </div>
  );
}

// ---------- Block renderer ----------
function BlockContent({ block, onPatchProps }) {
  const p = block.props;
  switch(block.type){
    case 'title': {
      const cls = p.level === 'h1' ? 'block-title-h1' : p.level === 'h3' ? 'block-title-h3' : 'block-title-h2';
      return <div className={cls}>{p.text || 'Add a title'}</div>;
    }
    case 'paragraph':
      return <div className="block-paragraph" style={{whiteSpace:'pre-wrap'}}>{p.text}</div>;
    case 'spacer':
      return <div className="spacer-inner" style={{height: p.size}}>
        <div className="spacer-label">Spacer · {p.size}px</div>
      </div>;
    case 'fullImage':
      return <div className="block-image" style={{aspectRatio:'16/9'}}>
        {p.src ? <img src={p.src} alt={imageAltText(p.alt)} /> : (
          <div className="placeholder">
            <span className="ms material-symbols-outlined">image</span>
            <span>Full width image</span>
          </div>
        )}
      </div>;
    case 'imageGrid': {
      const items = normalizeImageGridProps(p);
      return (
        <div className="block-image-grid">
          {items.map((item, i) => (
            <div key={i} className="block-image-grid-card">
              <div className="block-image block-image-grid-thumb">
                {item.src ? (
                  <img src={item.src} alt="" />
                ) : (
                  <div className="placeholder">
                    <span className="ms material-symbols-outlined">image</span>
                  </div>
                )}
              </div>
              <div className="block-image-grid-title">{item.title || IMAGE_GRID_DEFAULT_TITLE}</div>
              <div className="block-image-grid-body">{item.body}</div>
            </div>
          ))}
        </div>
      );
    }
    case 'eventDetails':
      if (Array.isArray(p.details) && p.heading === undefined && p.promo === undefined) {
        return <div className="block-event-details block-event-details--legacy">
          {p.details.map((d,i)=>(
            <div key={i} className="detail">
              <span className="ms material-symbols-outlined">{d.icon}</span>
              <div className="detail-text">
                <strong>{d.title}</strong>
                <span>{d.sub}</span>
              </div>
            </div>
          ))}
        </div>;
      }
      return <div className="block-event-details-card">
        <div className="event-details-heading">{p.heading}</div>
        <div className="event-details-body">
          <div className="event-details-col event-details-col--meta">
            <div className="event-details-row">
              <span className="ms material-symbols-outlined event-details-icon event-details-icon--pin">location_on</span>
              <span className="event-details-meta-text">{p.locationLine}</span>
            </div>
            <div className="event-details-row">
              <span className="ms material-symbols-outlined event-details-icon event-details-icon--calendar">calendar_month</span>
              <span className="event-details-meta-text">{p.datesLine}</span>
            </div>
          </div>
          <div className="event-details-col event-details-col--promo">
            <span className="ms material-symbols-outlined event-details-icon event-details-icon--ticket">confirmation_number</span>
            <p className="event-details-promo">{p.promo}</p>
          </div>
        </div>
      </div>;
    case 'infoCard': {
      const { cards } = normalizeInfoCardProps(p);
      if (cards.length <= 1) {
        return (
          <div className="block-info-cards">
            {cards.map((ic, idx) => (
              <InfoCardTile key={idx} ic={ic} bulletLines={bulletLinesFromCard(ic)} />
            ))}
          </div>
        );
      }
      return <InfoCardsCarousel cards={cards} />;
    }
    case 'tabs': {
      const tabs = normalizeTabsProps(p);
      const idx = tabs.length === 0 ? 0 : Math.min(Math.max(0, p.activeIndex ?? 0), tabs.length - 1);
      const active = tabs[idx] ?? { label: '', body: '', contentTitle: '', imageSrc: '' };
      const surface =
        typeof p.tabBarColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(p.tabBarColor.trim())
          ? p.tabBarColor.trim()
          : '';
      const tabsShellStyle = surface ? { '--tabs-surface': surface } : undefined;
      return (
        <div className="block-tabs" style={tabsShellStyle}>
          <div className="block-tabs-nav" aria-label="Tabs">
            <div className="block-tabs-nav-inner">
              {tabs.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className={`block-tabs-pill ${i === idx ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPatchProps && i !== idx) onPatchProps({ activeIndex: i });
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className={`block-tabs-panel${active.imageSrc ? '' : ' block-tabs-panel--no-media'}`}>
            <div className="block-tabs-panel-main">
              {active.contentTitle ? (
                <div className="block-tabs-panel-title">{active.contentTitle}</div>
              ) : null}
              <div className="block-tabs-panel-body" style={{ whiteSpace: 'pre-wrap' }}>{active.body}</div>
            </div>
            {active.imageSrc ? (
              <div className="block-tabs-panel-media">
                <img src={active.imageSrc} alt="" />
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    default: return null;
  }
}

// ---------- Block ----------
function Block({
  block,
  displayProps,
  selected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  layoutVariant,
  onPatchBlockProps,
  onBlockDragStart,
  onBlockDragEnd,
  previewReadOnly,
}) {
  const renderBlock = displayProps ? { ...block, props: displayProps } : block;
  const patchChain =
    previewReadOnly || !onPatchBlockProps
      ? undefined
      : (patch) => onPatchBlockProps(block.id, patch);
  return (
    <div
      className={`block ${selected ? 'selected' : ''} ${block.type === 'spacer' ? 'block-spacer' : ''}${previewReadOnly ? ' block--preview-readonly' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
      data-block-id={block.id}
    >
      {!previewReadOnly ? (
        <div
          className="block-drag-handle"
          draggable={!!onBlockDragStart}
          onDragStart={(e) => {
            e.stopPropagation();
            onBlockDragStart?.(e, block.id);
          }}
          onDragEnd={() => onBlockDragEnd?.()}
          title="Drag to reorder"
        >
          <span className="ms material-symbols-outlined">drag_indicator</span>
        </div>
      ) : null}
      <BlockContent block={renderBlock} onPatchProps={patchChain} />
      {!previewReadOnly && layoutVariant === 'floating-toolbar' ? (
        <div className="floating-toolbar" onClick={(e) => e.stopPropagation()}>
          <span style={{ padding: '0 6px', fontSize: 12, opacity: 0.8 }}>{COMPONENT_TYPES[block.type].label}</span>
          <span className="sep"></span>
          <button type="button" onClick={onMoveUp} title="Move up">
            <span className="ms material-symbols-outlined">arrow_upward</span>
          </button>
          <button type="button" onClick={onMoveDown} title="Move down">
            <span className="ms material-symbols-outlined">arrow_downward</span>
          </button>
          <span className="sep"></span>
          <button type="button" onClick={onDelete} title="Delete">
            <span className="ms material-symbols-outlined">delete</span>
          </button>
        </div>
      ) : null}
      {!previewReadOnly && layoutVariant !== 'floating-toolbar' ? (
        <div className="block-toolbar" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} title="Move up">
            <span className="ms material-symbols-outlined">arrow_upward</span>
          </button>
          <button type="button" onClick={onMoveDown} title="Move down">
            <span className="ms material-symbols-outlined">arrow_downward</span>
          </button>
          <button type="button" className="danger" onClick={onDelete} title="Delete">
            <span className="ms material-symbols-outlined">delete</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Load an image from disk into `src` as a data URL (preview-only; persists in document state). */
function FullImageLocalUpload({ onDataUrl, previewUrl, onClear }) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef(null);
  const hasPreview = typeof previewUrl === 'string' && previewUrl.trim().length > 0;

  const applyFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const dragProps = {
    onDragOver: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      applyFile(e.dataTransfer.files?.[0]);
    },
  };

  return (
    <div className="prop-local-image">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="prop-local-image-input"
        tabIndex={-1}
        onChange={(e) => {
          applyFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {hasPreview ? (
        <div
          className={`prop-local-image-preview-card ${dragOver ? 'prop-drop-zone--active' : ''}`}
          {...dragProps}
        >
          <div className="prop-local-image-thumb">
            <img src={previewUrl} alt="" />
            {typeof onClear === 'function' ? (
              <button
                type="button"
                className="prop-local-image-remove"
                aria-label="Remove image"
                title="Remove image"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
              >
                <span className="ms material-symbols-outlined" aria-hidden>
                  close
                </span>
              </button>
            ) : null}
          </div>
          <div className="prop-local-image-preview-actions">
            <button
              type="button"
              className="prop-local-image-replace"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Replace image
            </button>
            <span className="prop-local-image-preview-hint">or drag a new file here</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`prop-drop-zone ${dragOver ? 'prop-drop-zone--active' : ''}`}
          {...dragProps}
          onClick={() => inputRef.current?.click()}
        >
          <span className="ms material-symbols-outlined prop-drop-zone-icon" aria-hidden>
            cloud_upload
          </span>
          <span className="prop-drop-zone-text">Drag image here or click to upload</span>
        </button>
      )}
    </div>
  );
}

// ---------- Properties panel ----------
function Properties({ block, onDelete, editLocale = SOURCE_LOCALE, onPatch, onReplaceProps, structureLocked = false }) {
  const [imageGridCardTab, setImageGridCardTab] = React.useState(0);
  const [infoCardTab, setInfoCardTab] = React.useState(0);
  React.useEffect(() => {
    setImageGridCardTab(0);
    setInfoCardTab(0);
  }, [block?.id]);

  const infoCardCount =
    block?.type === 'infoCard' ? (normalizeInfoCardProps(block.props).cards?.length ?? 0) : 0;
  React.useEffect(() => {
    if (block?.type !== 'infoCard') return;
    setInfoCardTab((t) => {
      const n = Math.max(1, infoCardCount);
      return Math.min(Math.max(0, t), n - 1);
    });
  }, [block?.type, block?.id, infoCardCount]);

  if (!block) {
    return (
      <aside className="properties" onClick={(e) => e.stopPropagation()}>
        <div className="properties-title">Properties</div>
        <div className="properties-sub">Select a component to edit it</div>
        <div className="properties-empty">
          <span className="ms material-symbols-outlined">tune</span>
          Click on any element in the preview to customise its content and appearance.
        </div>
      </aside>
    );
  }
  const props = resolveLocalizedProps(block, editLocale);
  const masterProps = block.props;
  const set = (k, v) => onPatch({ [k]: v });
  const replaceAllProps = (next) => onReplaceProps(next);
  const t = COMPONENT_TYPES[block.type];
  return (
    <aside className="properties" onClick={(e) => e.stopPropagation()}>
      <div className="properties-title">
        <span className="ms material-symbols-outlined" style={{verticalAlign:'middle', fontSize:18, marginRight:6, color:'var(--brand-primary)'}}>{t.icon}</span>
        {t.label}
      </div>
      <div className="properties-sub">Customise this component</div>
      {structureLocked ? (
        <div className="properties-i18n-hint">
          Layout and images use the English (master) version. Edit text below for this language only.
        </div>
      ) : null}
      {block.type === 'title' && <>
        {!structureLocked ? (
        <div className="prop">
          <label className="prop-label">Heading level</label>
          <div className="prop-segment">
            {['h1','h2','h3'].map(l => (
              <button key={l} className={masterProps.level===l?'active':''} onClick={()=>set('level',l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        ) : null}
        <div className="prop">
          <label className="prop-label">Text</label>
          <input type="text" value={props.text ?? ''} onChange={e=>set('text', e.target.value)} />
        </div>
      </>}
      {block.type === 'paragraph' && <>
        <div className="prop">
          <label className="prop-label">Text</label>
          <textarea value={props.text ?? ''} onChange={e=>set('text', e.target.value)} />
          <div style={{fontSize:11, color:'var(--fg-3)', marginTop:4}}>{(props.text ?? '').length} / 600 characters</div>
        </div>
      </>}
      {block.type === 'spacer' && <>
        {structureLocked ? (
          <div className="properties-sub" style={{ marginTop: 8 }}>This block has no translatable text.</div>
        ) : (
        <div className="prop">
          <label className="prop-label">Height</label>
          <div className="prop-slider">
            <input type="range" min="8" max="120" step="4" value={masterProps.size} onChange={e=>set('size', parseInt(e.target.value))} />
            <span className="val">{masterProps.size}px</span>
          </div>
        </div>
        )}
      </>}
      {block.type === 'fullImage' && <>
        {!structureLocked ? (
        <div className="prop">
          <label className="prop-label">Upload image</label>
          <FullImageLocalUpload
            previewUrl={masterProps.src}
            onClear={() => set('src', '')}
            onDataUrl={(dataUrl) => set('src', dataUrl)}
          />
        </div>
        ) : null}
        <div className="prop">
          <label className="prop-label">Alt text (accessibility)</label>
          <input type="text" value={props.alt ?? ''} placeholder="Describe the image" onChange={e=>set('alt', e.target.value)} />
        </div>
      </>}
      {block.type === 'imageGrid' && (() => {
        const gridItems = normalizeImageGridProps(props);
        const i = Math.min(Math.max(0, imageGridCardTab), gridItems.length - 1);
        const item = gridItems[i];
        const masterGrid = normalizeImageGridProps(masterProps);
        return <>
          <div className="prop">
            <div className="prop-tabs-section-head-text">
              <span className="prop-tabs-section-eyebrow">Card content</span>
              <h4 className="prop-tabs-section-heading">Card {i + 1}</h4>
            </div>
            <div className="prop-segment prop-image-grid-card-tabs" role="tablist" aria-label="Image grid card">
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  className={i === idx ? 'active' : ''}
                  onClick={() => setImageGridCardTab(idx)}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="prop-image-grid-section">
            {!structureLocked ? (
            <div className="prop">
              <label className="prop-label">Upload image</label>
              <FullImageLocalUpload
                previewUrl={masterGrid[i]?.src ?? ''}
                onClear={() => {
                  const next = masterGrid.map((row, j) =>
                    j === i ? { ...row, src: '' } : row
                  );
                  set('items', next);
                }}
                onDataUrl={(dataUrl) => {
                  const next = masterGrid.map((row, j) =>
                    j === i ? { ...row, src: dataUrl } : row
                  );
                  set('items', next);
                }}
              />
            </div>
            ) : null}
            <div className="prop">
              <label className="prop-label">Title</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => {
                  const next = gridItems.map((row, j) =>
                    j === i ? { ...row, title: e.target.value } : row
                  );
                  set('items', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Body</label>
              <textarea
                value={item.body}
                onChange={(e) => {
                  const next = gridItems.map((row, j) =>
                    j === i ? { ...row, body: e.target.value } : row
                  );
                  set('items', next);
                }}
              />
            </div>
          </div>
        </>;
      })()}
      {block.type === 'infoCard' && (() => {
        const icCardsMaster = normalizeInfoCardProps(masterProps).cards;
        const icCardsResolved = normalizeInfoCardProps(props).cards;
        const i = Math.min(Math.max(0, infoCardTab), icCardsMaster.length - 1);
        const card = icCardsResolved[i] ?? createDefaultInfoCard(0);
        const nCards = icCardsMaster.length;
        return <>
          <div className="prop">
            <label className="prop-label">Active card</label>
            <div className="prop-segment prop-image-grid-card-tabs" role="tablist" aria-label="Info cards">
              {icCardsMaster.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  className={i === idx ? 'active' : ''}
                  onClick={() => setInfoCardTab(idx)}
                >
                  {idx + 1}
                </button>
              ))}
              {!structureLocked && nCards < INFO_CARD_MAX ? (
                <button
                  type="button"
                  className="prop-segment-add"
                  aria-label="Add card"
                  onClick={() => {
                    const next = [...icCardsMaster, createDefaultInfoCard(icCardsMaster.length)];
                    set('cards', next);
                    setInfoCardTab(next.length - 1);
                  }}
                >
                  +
                </button>
              ) : null}
            </div>
          </div>
          <div className="prop-tabs-section">
            <div className="prop-tabs-section-head">
              <div className="prop-tabs-section-head-text">
                <span className="prop-tabs-section-eyebrow">Card content</span>
                <h3 className="prop-tabs-section-heading">Card {i + 1}</h3>
              </div>
              {!structureLocked && nCards > 1 ? (
                <button
                  type="button"
                  className="prop-tabs-delete"
                  title="Remove this card from the block"
                  onClick={() => {
                    const nextCards = icCardsMaster.filter((_, j) => j !== i);
                    let nextTab = infoCardTab;
                    if (i < nextTab) nextTab -= 1;
                    else if (i === nextTab) nextTab = Math.min(i, nextCards.length - 1);
                    nextTab = Math.max(0, Math.min(nextTab, nextCards.length - 1));
                    set('cards', nextCards);
                    setInfoCardTab(nextTab);
                  }}
                >
                  <span className="ms material-symbols-outlined" aria-hidden>
                    delete
                  </span>
                  Delete card
                </button>
              ) : null}
            </div>
            <div className="prop-tabs-section-fields">
            {!structureLocked ? (
            <div className="prop">
              <label className="prop-label">Top image</label>
              <FullImageLocalUpload
                previewUrl={icCardsMaster[i]?.imageSrc ?? ''}
                onClear={() => {
                  const next = [...icCardsMaster];
                  next[i] = { ...next[i], imageSrc: '' };
                  set('cards', next);
                }}
                onDataUrl={(dataUrl) => {
                  const next = [...icCardsMaster];
                  next[i] = { ...next[i], imageSrc: dataUrl };
                  set('cards', next);
                }}
              />
            </div>
            ) : null}
            <div className="prop">
              <label className="prop-label">Heading</label>
              <input
                type="text"
                value={card.heading}
                onChange={(e) => {
                  const next = icCardsResolved.map((c, j) =>
                    j === i ? { ...c, heading: e.target.value } : c
                  );
                  set('cards', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Price</label>
              <input
                type="text"
                value={card.price}
                onChange={(e) => {
                  const next = icCardsResolved.map((c, j) =>
                    j === i ? { ...c, price: e.target.value } : c
                  );
                  set('cards', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Button label</label>
              <input
                type="text"
                value={card.ctaLabel}
                onChange={(e) => {
                  const next = icCardsResolved.map((c, j) =>
                    j === i ? { ...c, ctaLabel: e.target.value } : c
                  );
                  set('cards', next);
                }}
              />
            </div>
            {!structureLocked ? (
            <div className="prop">
              <label className="prop-label">Accent color</label>
              <div className="prop-accent-field">
              <div className="prop-accent-row">
                <input
                  type="text"
                  className="prop-accent-hex"
                  value={(icCardsMaster[i] ?? card).accentColor ?? ''}
                  placeholder={INFO_CARD_ACCENT_DEFAULT_HEX}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="Accent color (hex)"
                  onChange={(e) => {
                    let v = e.target.value;
                    if (v.length > 0 && !v.startsWith('#')) v = '#' + v.replace(/^#+/, '');
                    const next = [...icCardsMaster];
                    next[i] = { ...next[i], accentColor: v.slice(0, 7) };
                    set('cards', next);
                  }}
                  onBlur={(e) => {
                    const normalized = normalizeAccentHex(e.target.value, INFO_CARD_ACCENT_DEFAULT_HEX);
                    const next = [...icCardsMaster];
                    next[i] = { ...next[i], accentColor: normalized };
                    set('cards', next);
                  }}
                />
                <input
                  type="color"
                  className="prop-accent-picker"
                  value={normalizeAccentHex((icCardsMaster[i] ?? card).accentColor, INFO_CARD_ACCENT_DEFAULT_HEX)}
                  aria-label="Choose accent with color picker"
                  onChange={(e) => {
                    const next = [...icCardsMaster];
                    next[i] = { ...next[i], accentColor: e.target.value.toLowerCase() };
                    set('cards', next);
                  }}
                />
              </div>
              <div className="prop-accent-presets" role="group" aria-label="Default accent colors">
                {INFO_CARD_ACCENT_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`prop-accent-swatch${normalizeAccentHex((icCardsMaster[i] ?? card).accentColor, '') === hex ? ' prop-accent-swatch--active' : ''}`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    aria-label={`Set accent to ${hex}`}
                    aria-pressed={normalizeAccentHex((icCardsMaster[i] ?? card).accentColor, '') === hex}
                    onClick={() => {
                      const next = [...icCardsMaster];
                      next[i] = { ...next[i], accentColor: hex };
                      set('cards', next);
                    }}
                  />
                ))}
              </div>
              </div>
            </div>
            ) : null}
            <div className="prop">
              <label className="prop-label">Badge (optional)</label>
              <input
                type="text"
                placeholder="e.g. MOST POPULAR"
                value={card.badge}
                onChange={(e) => {
                  const next = icCardsResolved.map((c, j) =>
                    j === i ? { ...c, badge: e.target.value } : c
                  );
                  set('cards', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Bullet points (one per line)</label>
              <div className="field-help" style={{ marginBottom: 6 }}>
                Shown only on this card in the preview.
              </div>
              <textarea
                rows={5}
                placeholder={'Festival access — single day\nStanding area'}
                value={card.bulletPointsText ?? ''}
                onChange={(e) => {
                  const next = icCardsResolved.map((c, j) =>
                    j === i ? { ...c, bulletPointsText: e.target.value } : c
                  );
                  set('cards', next);
                }}
              />
            </div>
            {!structureLocked ? (
            <div className="prop">
              <label className="prop-label">Highlight card</label>
              <div className="prop-segment">
                <button
                  type="button"
                  className={(icCardsMaster[i]?.highlighted ?? card.highlighted) ? 'active' : ''}
                  onClick={() => {
                    const next = [...icCardsMaster];
                    next[i] = { ...next[i], highlighted: true };
                    set('cards', next);
                  }}
                >
                  On
                </button>
                <button
                  type="button"
                  className={!(icCardsMaster[i]?.highlighted ?? card.highlighted) ? 'active' : ''}
                  onClick={() => {
                    const next = [...icCardsMaster];
                    next[i] = { ...next[i], highlighted: false };
                    set('cards', next);
                  }}
                >
                  Off
                </button>
              </div>
            </div>
            ) : null}
            </div>
          </div>
        </>;
      })()}
      {block.type === 'eventDetails' && <>
        {Array.isArray(masterProps.details) && masterProps.heading === undefined && masterProps.promo === undefined ? (
          masterProps.details.map((d,i)=>{
            const pd = props.details?.[i] ? { ...d, ...props.details[i] } : d;
            return (
            <div key={i} className="prop">
              <label className="prop-label">{d.title} value</label>
              <input type="text" value={pd.sub} onChange={e=>{
                const base = masterProps.details;
                const next = [...base]; next[i] = {...d, sub: e.target.value};
                set('details', next);
              }} />
            </div>
          );})
        ) : (
          <>
            <div className="prop">
              <label className="prop-label">Section heading</label>
              <input type="text" value={props.heading ?? ''} onChange={e=>set('heading', e.target.value)} />
            </div>
            <div className="prop">
              <label className="prop-label">Location line</label>
              <input type="text" value={props.locationLine ?? ''} onChange={e=>set('locationLine', e.target.value)} />
            </div>
            <div className="prop">
              <label className="prop-label">Dates line</label>
              <input type="text" value={props.datesLine ?? ''} onChange={e=>set('datesLine', e.target.value)} />
            </div>
            <div className="prop">
              <label className="prop-label">Promotional text</label>
              <textarea value={props.promo ?? ''} onChange={e=>set('promo', e.target.value)} />
            </div>
          </>
        )}
      </>}
      {block.type === 'tabs' && (() => {
        const tabRowsMaster = normalizeTabsProps(masterProps);
        const tabRowsResolved = normalizeTabsProps(props);
        const tabCount = tabRowsMaster.length;
        const idx =
          tabCount === 0
            ? 0
            : Math.min(Math.max(0, masterProps.activeIndex ?? 0), tabCount - 1);
        const t = tabCount > 0 ? tabRowsResolved[idx] : null;
        const tabBarRaw =
          typeof masterProps.tabBarColor === 'string' ? masterProps.tabBarColor.trim() : '';
        const tabsBarHasCustom = /^#[0-9A-Fa-f]{6}$/.test(tabBarRaw);
        const tabsBarEffectiveHex = tabsBarHasCustom ? tabBarRaw : TABS_BAR_COLOR_DEFAULT_HEX;
        const tabBarNorm = normalizeAccentHex(tabBarRaw, '');
        const tabsPresetIsActive = (hex) => {
          if (hex === TABS_BAR_COLOR_DEFAULT_HEX) {
            return !tabsBarHasCustom || tabBarNorm === TABS_BAR_COLOR_DEFAULT_HEX;
          }
          return tabsBarHasCustom && tabBarNorm === hex;
        };
        return <>
          {!structureLocked ? (
          <div className="prop">
            <label className="prop-label">Tab bar color</label>
            <div className="prop-accent-field">
              <div className="prop-accent-row">
                <input
                  type="text"
                  className="prop-accent-hex"
                  value={tabsBarHasCustom ? tabBarRaw : ''}
                  placeholder={TABS_BAR_COLOR_DEFAULT_HEX}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="Tab bar color (hex)"
                  onChange={(e) => {
                    let v = e.target.value;
                    if (v.length > 0 && !v.startsWith('#')) v = '#' + v.replace(/^#+/, '');
                    set('tabBarColor', v.slice(0, 7));
                  }}
                  onBlur={(e) => {
                    const hexNorm = normalizeAccentHex(e.target.value, '');
                    set('tabBarColor', hexNorm || '');
                  }}
                />
                <input
                  type="color"
                  className="prop-accent-picker"
                  value={normalizeAccentHex(tabsBarEffectiveHex, TABS_BAR_COLOR_DEFAULT_HEX)}
                  aria-label="Choose tab bar color"
                  onFocus={() =>
                    set(
                      'tabBarColor',
                      normalizeAccentHex(tabsBarEffectiveHex, TABS_BAR_COLOR_DEFAULT_HEX)
                    )
                  }
                  onChange={(e) => set('tabBarColor', e.target.value.toLowerCase())}
                />
              </div>
              <div className="prop-accent-presets" role="group" aria-label="Tab bar color presets">
                {TABS_BAR_COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`prop-accent-swatch${tabsPresetIsActive(hex) ? ' prop-accent-swatch--active' : ''}`}
                    style={{ backgroundColor: hex }}
                    title={
                      hex === TABS_BAR_COLOR_DEFAULT_HEX
                        ? `Default (${hex})`
                        : hex
                    }
                    aria-label={
                      hex === TABS_BAR_COLOR_DEFAULT_HEX
                        ? `Use default tab bar color ${hex}`
                        : `Set tab bar to ${hex}`
                    }
                    aria-pressed={tabsPresetIsActive(hex)}
                    onClick={() =>
                      set(
                        'tabBarColor',
                        hex === TABS_BAR_COLOR_DEFAULT_HEX ? '' : hex
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
          ) : null}
          <div className="prop">
            <label className="prop-label">Active tab</label>
            <div className="prop-segment prop-image-grid-card-tabs" role="tablist" aria-label="Tabs">
              {tabRowsMaster.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={idx === i}
                  className={idx === i ? 'active' : ''}
                  onClick={() => set('activeIndex', i)}
                >
                  {i + 1}
                </button>
              ))}
              {!structureLocked && tabCount < TABS_MAX ? (
                <button
                  type="button"
                  className="prop-segment-add"
                  aria-label="Add tab"
                  onClick={() => {
                    const nextTabs = [...tabRowsMaster, createDefaultTab(tabRowsMaster.length)];
                    replaceAllProps({
                      ...masterProps,
                      tabs: nextTabs,
                      activeIndex: nextTabs.length - 1,
                    });
                  }}
                >
                  +
                </button>
              ) : null}
            </div>
          </div>
          {tabCount > 0 && t ? (
            <div className="prop-tabs-section">
              <div className="prop-tabs-section-head">
                <div className="prop-tabs-section-head-text">
                  <span className="prop-tabs-section-eyebrow">Tab content</span>
                  <h3 className="prop-tabs-section-heading">Tab {idx + 1}</h3>
                  <p className="prop-tabs-section-lede">
                    Nav label, optional heading above the body, main text, and optional uploaded side image in the preview.
                  </p>
                </div>
                {!structureLocked && tabCount > 1 ? (
                  <button
                    type="button"
                    className="prop-tabs-delete"
                    title="Remove this tab from the block"
                    onClick={() => {
                      const nextTabs = tabRowsMaster.filter((_, j) => j !== idx);
                      let nextActive = masterProps.activeIndex ?? 0;
                      if (idx < nextActive) nextActive -= 1;
                      else if (idx === nextActive) nextActive = Math.min(idx, nextTabs.length - 1);
                      nextActive = Math.max(0, Math.min(nextActive, nextTabs.length - 1));
                      replaceAllProps({
                        ...masterProps,
                        tabs: nextTabs,
                        activeIndex: nextActive,
                      });
                    }}
                  >
                    <span className="ms material-symbols-outlined" aria-hidden>
                      delete
                    </span>
                    Delete tab
                  </button>
                ) : null}
              </div>
              <div className="prop-tabs-section-fields">
                <div className="prop">
                  <label className="prop-label" htmlFor={`tab-label-${block.id}-${idx}`}>
                    Label
                  </label>
                  <input
                    id={`tab-label-${block.id}-${idx}`}
                    type="text"
                    value={t.label}
                    onChange={(e) => {
                      const next = tabRowsResolved.map((row, j) =>
                        j === idx ? { ...row, label: e.target.value } : row
                      );
                      set('tabs', next);
                    }}
                  />
                </div>
                <div className="prop">
                  <label className="prop-label" htmlFor={`tab-heading-${block.id}-${idx}`}>
                    Section heading
                  </label>
                  <input
                    id={`tab-heading-${block.id}-${idx}`}
                    type="text"
                    placeholder="Optional title above the paragraph"
                    value={t.contentTitle ?? ''}
                    onChange={(e) => {
                      const next = tabRowsResolved.map((row, j) =>
                        j === idx ? { ...row, contentTitle: e.target.value } : row
                      );
                      set('tabs', next);
                    }}
                  />
                </div>
                <div className="prop">
                  <label className="prop-label" htmlFor={`tab-body-${block.id}-${idx}`}>
                    Body
                  </label>
                  <textarea
                    id={`tab-body-${block.id}-${idx}`}
                    value={t.body}
                    onChange={(e) => {
                      const next = tabRowsResolved.map((row, j) =>
                        j === idx ? { ...row, body: e.target.value } : row
                      );
                      set('tabs', next);
                    }}
                  />
                </div>
                {!structureLocked ? (
                <div className="prop">
                  <label className="prop-label">Upload image</label>
                  <FullImageLocalUpload
                    previewUrl={tabRowsMaster[idx]?.imageSrc ?? ''}
                    onClear={() => {
                      const next = tabRowsMaster.map((row, j) =>
                        j === idx ? { ...row, imageSrc: '' } : row
                      );
                      set('tabs', next);
                    }}
                    onDataUrl={(dataUrl) => {
                      const next = tabRowsMaster.map((row, j) =>
                        j === idx ? { ...row, imageSrc: dataUrl } : row
                      );
                      set('tabs', next);
                    }}
                  />
                </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>;
      })()}
      <div className="prop-actions">
        <button className="btn btn-ghost" style={{padding:'6px 10px', fontSize:13, color:'var(--status-danger-soft)'}} onClick={onDelete}>
          <span className="ms material-symbols-outlined" style={{fontSize:16}}>delete</span> Delete
        </button>
      </div>
    </aside>
  );
}

// ---------- Main App ----------
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAKS_DEFAULTS);
  const [activeTab, setActiveTabState] = React.useState(readPlanTabFromUrl);
  const selectPlanTab = React.useCallback((t) => {
    setActiveTabState(t);
    replacePlanTabInUrl(t);
  }, []);
  const [device] = React.useState('desktop');
  const [eventTitle, setEventTitle] = React.useState('Pizza in Piazza');
  /** Localized event titles keyed by locale code (excluding master `SOURCE_LOCALE`). */
  const [eventTitleByLocale, setEventTitleByLocale] = React.useState({});
  const [translationPreviewLocale, setTranslationPreviewLocale] = React.useState('es');
  const [blocks, setBlocks] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [dragOverIndex, setDragOverIndex] = React.useState(-1);
  const [draggingType, setDraggingType] = React.useState(null);
  const [draggingBlockId, setDraggingBlockId] = React.useState(null);
  const [pickerIndex, setPickerIndex] = React.useState(null);
  const [isMobileViewport, setIsMobileViewport] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_VIEWPORT_QUERY).matches : false
  );
  const [mobileSheet, setMobileSheet] = React.useState({
    open: false,
    mode: 'picker',
    insertAtIndex: 0,
  });
  const prevSelectedIdRef = React.useRef(null);
  /** Latest insert index during canvas dragover (avoids stale state if dragend fires before drop). */
  const lastCanvasDropIndexRef = React.useRef(-1);

  React.useEffect(() => {
    if (pickerIndex !== PICKER_EMPTY && pickerIndex !== PICKER_TRAILING) return;
    const onDocMouseDown = (e) => {
      if (e.target.closest('.canvas-empty-plus-wrap')) return;
      setPickerIndex(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [pickerIndex]);

  React.useEffect(() => {
    if (blocks.length === 0 && pickerIndex === PICKER_TRAILING) setPickerIndex(null);
  }, [blocks.length, pickerIndex]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const onChange = (e) => setIsMobileViewport(e.matches);
    setIsMobileViewport(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const selected = blocks.find(b => b.id === selectedId);
  const layoutVariant = tweaks.layoutVariant;

  const editLocale =
    activeTab === 'Translations' ? translationPreviewLocale : SOURCE_LOCALE;
  const structureLocked =
    activeTab === 'Translations' && translationPreviewLocale !== SOURCE_LOCALE;
  const canvasLocale = editLocale;

  const closeMobileSheet = React.useCallback(() => {
    setMobileSheet((prev) => ({ ...prev, open: false }));
  }, []);

  const openMobilePicker = React.useCallback((insertAtIndex) => {
    setMobileSheet({
      open: true,
      mode: 'picker',
      insertAtIndex: Number.isFinite(insertAtIndex) ? Math.max(0, insertAtIndex) : 0,
    });
  }, []);

  const addBlock = (type, atIndex) => {
    const newBlock = { id: uid(), type, props: defaultProps(type) };
    setBlocks(prev => {
      const next = [...prev];
      const idx = atIndex === undefined || atIndex < 0 ? next.length : atIndex;
      next.splice(idx, 0, newBlock);
      return next;
    });
    setSelectedId(newBlock.id);
  };

  const handleMobileAddBlock = (type) => {
    addBlock(type, mobileSheet.insertAtIndex);
    setPickerIndex(null);
    setMobileSheet((prev) => ({ ...prev, open: true, mode: 'properties' }));
  };

  const updateBlock = (id, props) => {
    setBlocks(prev => prev.map(b => b.id === id ? {...b, props} : b));
  };
  const patchBlockProps = (id, patch) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b)));
  };

  const patchBlockI18n = (id, locale, patch) => {
    if (!patch || locale === SOURCE_LOCALE) {
      if (locale === SOURCE_LOCALE && patch) patchBlockProps(id, patch);
      return;
    }
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const prevOv = (b.i18n && b.i18n[locale]) || {};
        const nextOv = pruneEmptyOverlayLeaves(mergeI18nDelta(prevOv, patch));
        return { ...b, i18n: { ...(b.i18n || {}), [locale]: nextOv } };
      }),
    );
  };

  const routeCanvasPatch = (id, patch) => {
    if (!patch) return;
    if (Object.prototype.hasOwnProperty.call(patch, 'activeIndex')) {
      patchBlockProps(id, patch);
      return;
    }
    const loc =
      activeTab === 'Translations' ? translationPreviewLocale : SOURCE_LOCALE;
    if (loc === SOURCE_LOCALE) patchBlockProps(id, patch);
    else patchBlockI18n(id, loc, patch);
  };

  const deleteBlock = (id) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const moveBlock = (id, dir) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const reorderBlock = (id, toIndex) => {
    setBlocks(prev => {
      const fromIndex = prev.findIndex(b => b.id === id);
      if (fromIndex < 0) return prev;
      const clamped = Math.max(0, Math.min(toIndex, prev.length));
      let insertAt = clamped;
      if (fromIndex < clamped) insertAt = clamped - 1;
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(insertAt, 0, item);
      return next;
    });
  };

  // Drag handlers
  const handlePaletteDragStart = (e, type) => {
    setDraggingType(type);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', type);
  };
  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    const allowMove = e.dataTransfer.effectAllowed === 'move' || e.dataTransfer.effectAllowed === 'copyMove';
    e.dataTransfer.dropEffect = allowMove ? 'move' : 'copy';
    setDragOver(true);
    // figure out drop index
    const rect = e.currentTarget.getBoundingClientRect();
    const blockEls = e.currentTarget.querySelectorAll('.block');
    let idx = blocks.length;
    for (let i = 0; i < blockEls.length; i++) {
      const r = blockEls[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height/2) { idx = i; break; }
    }
    lastCanvasDropIndexRef.current = idx;
    setDragOverIndex(idx);
  };
  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const plain = e.dataTransfer.getData('text/plain');
    const idFromMime = e.dataTransfer.getData(BLOCK_DRAG_MIME);
    const blockId = draggingBlockId || idFromMime || (plain && blocks.some((b) => b.id === plain) ? plain : null);
    if (blockId && blocks.some((b) => b.id === blockId)) {
      const refIdx = lastCanvasDropIndexRef.current;
      const toIndex = refIdx >= 0 ? refIdx : (dragOverIndex >= 0 ? dragOverIndex : blocks.length);
      reorderBlock(blockId, toIndex);
      setDraggingBlockId(null);
      setDraggingType(null);
      lastCanvasDropIndexRef.current = -1;
      setDragOverIndex(-1);
      return;
    }
    const type = plain || draggingType;
    const insertIdx =
      lastCanvasDropIndexRef.current >= 0 ? lastCanvasDropIndexRef.current : (dragOverIndex >= 0 ? dragOverIndex : blocks.length);
    if (type && COMPONENT_TYPES[type]) {
      addBlock(type, insertIdx);
    }
    setDraggingType(null);
    setDraggingBlockId(null);
    lastCanvasDropIndexRef.current = -1;
    setDragOverIndex(-1);
  };
  const handleCanvasDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
    lastCanvasDropIndexRef.current = -1;
    setDragOverIndex(-1);
  };

  const handleBlockDragStart = (e, blockId) => {
    setDraggingBlockId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
    e.dataTransfer.setData(BLOCK_DRAG_MIME, blockId);
  };
  const handleBlockDragEnd = () => {
    setDraggingBlockId(null);
    setDragOver(false);
    setDragOverIndex(-1);
  };

  const builderClass = `builder ${layoutVariant === 'floating-toolbar' ? 'floating-tools' : ''} ${layoutVariant === 'inline-plus' ? 'inline-plus' : ''}`;

  React.useEffect(() => {
    if (!isMobileViewport) closeMobileSheet();
  }, [isMobileViewport, closeMobileSheet]);

  React.useEffect(() => {
    if (!mobileSheet.open) return;
    if (mobileSheet.mode === 'properties' && !selected) {
      closeMobileSheet();
    }
  }, [mobileSheet.open, mobileSheet.mode, selected, closeMobileSheet]);

  React.useEffect(() => {
    const prev = prevSelectedIdRef.current;
    if (
      isMobileViewport &&
      selectedId &&
      selectedId !== prev
    ) {
      setMobileSheet((sheet) => ({ ...sheet, open: true, mode: 'properties' }));
    }
    prevSelectedIdRef.current = selectedId;
  }, [isMobileViewport, selectedId]);

  return (
    <div className={`app ${isMobileViewport ? 'app-mobile-builder' : ''}`} onClick={()=>setSelectedId(null)}>
      <Topbar />
      <Sidebar />
      <main className="main">
        <div className="main-inner">
          <div className="breadcrumb">Dashboard</div>
          <h1 className="page-title">
            {activeTab === 'Translations'
              ? resolveLocalizedEventTitle(eventTitle, eventTitleByLocale, translationPreviewLocale)
              : eventTitle}
          </h1>
          {tweaks.showStepper && <Stepper />}

          {activeTab !== 'Translations' ? (
            <>
              <h2 className="section-title">{activeTab === 'Content' ? 'Content' : activeTab}</h2>
              <p className="section-sub">
                {activeTab === 'Content'
                  ? 'Enter key details for your event, including content, images, venue, capacity, and general information.'
                  : activeTab === 'Media'
                    ? 'Upload images and videos that appear on your Fever listing.'
                    : activeTab === 'Venue'
                      ? 'Configure where the event takes place and how attendees get there.'
                      : ''}
              </p>
            </>
          ) : null}

          <div className="tabs">
            {['Content','Media','Venue','Translations'].map(t => (
              <div key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>selectPlanTab(t)}>{t}</div>
            ))}
          </div>

          {tweaks.showRequirements && activeTab === 'Content' && <Requirements />}

          {activeTab === 'Content' && (
          <div className="field">
            <label className="field-label">Event title</label>
            <input className="input" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} />
          </div>
          )}

          {activeTab === 'Translations' ? (
            <div className="translation-plan-page translation-tab-panel" onClick={(e) => e.stopPropagation()}>
              <TranslationFigmaWorkspace
                locale={translationPreviewLocale}
                onLocaleChange={setTranslationPreviewLocale}
                eventTitle={eventTitle}
                eventTitleByLocale={eventTitleByLocale}
                onLocaleTitleChange={(loc, value) => {
                  setEventTitleByLocale((prev) => {
                    const next = { ...prev };
                    if (!value.trim()) delete next[loc];
                    else next[loc] = value;
                    return next;
                  });
                }}
                channelEditorLaunchMeta={{
                  layoutVariant,
                  device,
                  selectedBlockId: selectedId,
                }}
                blocks={blocks}
                patchBlockI18n={patchBlockI18n}
                selectedBlockId={selectedId}
                onSelectBlock={setSelectedId}
                childrenPreview={
                  device === 'mobile' ? (
                    <div className="mobile-frame">
                      <BlocksList
                        previewReadOnly
                        canvasLocale={canvasLocale}
                        blocks={blocks}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        deleteBlock={deleteBlock}
                        moveBlock={moveBlock}
                        dragOverIndex={-1}
                        layoutVariant={layoutVariant}
                        addBlock={addBlock}
                        pickerIndex={pickerIndex}
                        setPickerIndex={setPickerIndex}
                        patchBlockProps={routeCanvasPatch}
                        onBlockDragStart={handleBlockDragStart}
                        onBlockDragEnd={handleBlockDragEnd}
                        isMobileViewport={isMobileViewport}
                        onOpenMobilePicker={openMobilePicker}
                      />
                    </div>
                  ) : (
                    <BlocksList
                      previewReadOnly
                      canvasLocale={canvasLocale}
                      blocks={blocks}
                      selectedId={selectedId}
                      setSelectedId={setSelectedId}
                      deleteBlock={deleteBlock}
                      moveBlock={moveBlock}
                      dragOverIndex={-1}
                      layoutVariant={layoutVariant}
                      addBlock={addBlock}
                      pickerIndex={pickerIndex}
                      setPickerIndex={setPickerIndex}
                      patchBlockProps={routeCanvasPatch}
                      onBlockDragStart={handleBlockDragStart}
                      onBlockDragEnd={handleBlockDragEnd}
                      isMobileViewport={isMobileViewport}
                      onOpenMobilePicker={openMobilePicker}
                    />
                  )
                }
              />
            </div>
          ) : activeTab === 'Media' ? (
            <PlanTabEmptyState
              icon="perm_media"
              headline="No media yet"
              description="Hero images, galleries, and video will show up here once you add them to your plan."
            />
          ) : activeTab === 'Venue' ? (
            <PlanTabEmptyState
              icon="location_on"
              headline="Venue not set"
              description="Add address, map location, and arrival notes so guests know exactly where to go."
            />
          ) : (
          <div className="field">
            <label className="field-label">Event description</label>
            <p className="field-help">The "description" section should be written in your local language. Please use respectful language suitable for all audiences. Compose the description with elements to fully customise your page.</p>
            <a
              className="preview-on-link"
              href={PRODUCT_PAGE_PREVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  localStorage.setItem(
                    'descriptionBuilderPlanPreview',
                    JSON.stringify({
                      v: 1,
                      eventTitle,
                      eventTitleByLocale,
                      previewLocale: translationPreviewLocale,
                      blocks,
                      savedAt: Date.now(),
                    })
                  );
                } catch (err) {
                  console.warn('Preview: could not store canvas state', err);
                }
              }}
            >
              Preview on Fever <span className="ms material-symbols-outlined" style={{fontSize:14}}>open_in_new</span>
            </a>

            <div className={builderClass}>
              <div className="builder-left">
                <div className="palette" onClick={e=>e.stopPropagation()}>
                  <div className="palette-title">Components</div>
                  <div className="palette-sub">Drag onto description or double-click it</div>
                  <div className="palette-list">
                    {PALETTE_ORDER.map(type => {
                      const t = COMPONENT_TYPES[type];
                      return (
                        <div
                          key={type}
                          className="palette-item"
                          draggable
                          onDragStart={(e)=>handlePaletteDragStart(e, type)}
                          onDragEnd={()=>setDraggingType(null)}
                          onDoubleClick={()=>addBlock(type)}
                          title="Drag onto canvas, or double-click to add"
                        >
                          <span className="ms material-symbols-outlined">{t.icon}</span>
                          {t.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="canvas-wrap" onClick={e=>e.stopPropagation()}>
                <div className="canvas-header">
                  <div className="canvas-title">Preview</div>
                </div>
                <div
                  className={`canvas ${dragOver?'drag-over':''} ${device==='mobile'?'mobile':''}`}
                  onDragOver={handleCanvasDragOver}
                  onDrop={handleCanvasDrop}
                  onDragLeave={handleCanvasDragLeave}
                >
                  {device === 'mobile' ? (
                    <div className="mobile-frame">
                      <BlocksList
                        canvasLocale={canvasLocale}
                        blocks={blocks}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        deleteBlock={deleteBlock}
                        moveBlock={moveBlock}
                        dragOverIndex={dragOver?dragOverIndex:-1}
                        layoutVariant={layoutVariant}
                        addBlock={addBlock}
                        pickerIndex={pickerIndex}
                        setPickerIndex={setPickerIndex}
                        patchBlockProps={routeCanvasPatch}
                        onBlockDragStart={handleBlockDragStart}
                        onBlockDragEnd={handleBlockDragEnd}
                        isMobileViewport={isMobileViewport}
                        onOpenMobilePicker={openMobilePicker}
                      />
                    </div>
                  ) : (
                    <BlocksList
                      canvasLocale={canvasLocale}
                      blocks={blocks}
                      selectedId={selectedId}
                      setSelectedId={setSelectedId}
                      deleteBlock={deleteBlock}
                      moveBlock={moveBlock}
                      dragOverIndex={dragOver?dragOverIndex:-1}
                      layoutVariant={layoutVariant}
                      addBlock={addBlock}
                      pickerIndex={pickerIndex}
                      setPickerIndex={setPickerIndex}
                      patchBlockProps={routeCanvasPatch}
                      onBlockDragStart={handleBlockDragStart}
                      onBlockDragEnd={handleBlockDragEnd}
                      isMobileViewport={isMobileViewport}
                      onOpenMobilePicker={openMobilePicker}
                    />
                  )}
                </div>
              </div>

              {!isMobileViewport && layoutVariant !== 'floating-toolbar' && (
                <Properties
                  block={selected}
                  editLocale={editLocale}
                  onPatch={(patch) => selected && routeCanvasPatch(selected.id, patch)}
                  onReplaceProps={(full) => selected && updateBlock(selected.id, full)}
                  onDelete={()=>selected && deleteBlock(selected.id)}
                  structureLocked={structureLocked}
                />
              )}
            </div>
          </div>
          )}
        </div>

        <div className="footer">
          <button className="btn btn-secondary">Save draft</button>
          <button className="btn btn-primary">
            Continue (Set Media)
            <span className="ms material-symbols-outlined" style={{fontSize:18}}>arrow_forward</span>
          </button>
        </div>
      </main>

      {isMobileViewport && mobileSheet.open && (
        <div className="mobile-sheet-overlay" onClick={closeMobileSheet}>
          <div className="mobile-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            {mobileSheet.mode === 'picker' ? (
              <>
                <div className="mobile-sheet-title-row">
                  <div className="mobile-sheet-title">Add component</div>
                  <button type="button" className="mobile-sheet-close" onClick={closeMobileSheet} aria-label="Close">
                    <span className="ms material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="mobile-sheet-list" role="listbox" aria-label="Components">
                  {PALETTE_ORDER.map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="option"
                      className="mobile-sheet-option"
                      onClick={() => handleMobileAddBlock(type)}
                    >
                      <span className="ms material-symbols-outlined">{COMPONENT_TYPES[type].icon}</span>
                      {COMPONENT_TYPES[type].label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mobile-sheet-properties">
                <div className="mobile-sheet-title-row">
                  <div className="mobile-sheet-title">Properties</div>
                  <button type="button" className="mobile-sheet-close" onClick={closeMobileSheet} aria-label="Close">
                    <span className="ms material-symbols-outlined">close</span>
                  </button>
                </div>
                <Properties
                  block={selected}
                  editLocale={editLocale}
                  onPatch={(patch) => selected && routeCanvasPatch(selected.id, patch)}
                  onReplaceProps={(full) => selected && updateBlock(selected.id, full)}
                  onDelete={()=>{
                    if (!selected) return;
                    deleteBlock(selected.id);
                    closeMobileSheet();
                  }}
                  structureLocked={structureLocked}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Editor layout">
          <TweakSelect
            label="Variant"
            value={tweaks.layoutVariant}
            options={[
              { value: 'sidebar-properties', label: 'Right properties panel' },
              { value: 'floating-toolbar', label: 'Floating block toolbar' },
              { value: 'inline-plus', label: 'Inline “+” inserter' },
            ]}
            onChange={(v) => setTweak('layoutVariant', v)}
          />
        </TweakSection>
        <TweakSection title="Page chrome">
          <TweakToggle
            label="Stepper"
            value={tweaks.showStepper}
            onChange={(v) => setTweak('showStepper', v)}
          />
          <TweakToggle
            label="Content requirements"
            value={tweaks.showRequirements}
            onChange={(v) => setTweak('showRequirements', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function CanvasEmptyPlusWrap({ insertAtIndex, isOpen, onToggleOpen, addBlock, setPickerIndex, isMobileViewport, onOpenMobilePicker }) {
  return (
    <div className="canvas-empty-plus-wrap">
      <button
        type="button"
        className="plus"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Add component"
        onClick={(e) => {
          e.stopPropagation();
          if (isMobileViewport) {
            onOpenMobilePicker?.(insertAtIndex);
            return;
          }
          onToggleOpen();
        }}
      >
        <span className="ms material-symbols-outlined">add</span>
      </button>
      {!isMobileViewport && isOpen && (
        <div
          className="inline-picker open canvas-empty-picker"
          role="listbox"
          onClick={(e) => e.stopPropagation()}
        >
          {PALETTE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              role="option"
              onClick={() => {
                addBlock(type, insertAtIndex);
                setPickerIndex(null);
              }}
            >
              <span className="ms material-symbols-outlined">{COMPONENT_TYPES[type].icon}</span>
              {COMPONENT_TYPES[type].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlocksList({
  blocks,
  canvasLocale,
  selectedId,
  setSelectedId,
  deleteBlock,
  moveBlock,
  dragOverIndex,
  layoutVariant,
  addBlock,
  pickerIndex,
  setPickerIndex,
  patchBlockProps,
  onBlockDragStart,
  onBlockDragEnd,
  isMobileViewport,
  onOpenMobilePicker,
  previewReadOnly,
  /** When true, hide inline “+” between blocks (inline-plus layout); add only via trailing / empty canvas plus. */
  suppressBetweenBlockInserters = false,
}) {
  if (blocks.length === 0 && dragOverIndex < 0) {
    if (previewReadOnly) {
      return (
        <div className="canvas-empty canvas-empty--translation-preview">
          <div>No description blocks yet. Add components on the <strong>Content</strong> tab.</div>
        </div>
      );
    }
    const emptyPickerOpen = pickerIndex === PICKER_EMPTY;
    return (
      <div className="canvas-empty">
        <CanvasEmptyPlusWrap
          insertAtIndex={0}
          isOpen={emptyPickerOpen}
          onToggleOpen={() => setPickerIndex(emptyPickerOpen ? null : PICKER_EMPTY)}
          addBlock={addBlock}
          setPickerIndex={setPickerIndex}
          isMobileViewport={isMobileViewport}
          onOpenMobilePicker={onOpenMobilePicker}
        />
        <div>
          {suppressBetweenBlockInserters
            ? 'Use the + button to add a component.'
            : 'Drag a component here, double-click one in the palette, or use + to choose'}
        </div>
      </div>
    );
  }
  const items = [];
  for (let i = 0; i <= blocks.length; i++) {
    if (dragOverIndex === i) {
      items.push(<div key={`d-${i}`} className="drop-indicator show"></div>);
    }
    if (!previewReadOnly && layoutVariant === 'inline-plus' && i < blocks.length && !suppressBetweenBlockInserters) {
      items.push(
        <div key={`ins-${i}`} className="inline-inserter">
          <button
            onClick={(e)=>{
              e.stopPropagation();
              if (isMobileViewport) {
                onOpenMobilePicker?.(i);
                return;
              }
              setPickerIndex(pickerIndex===i?null:i);
            }}
          >
            <span className="ms material-symbols-outlined">add</span>
          </button>
          {!isMobileViewport && pickerIndex === i && (
            <div className="inline-picker open" onClick={e=>e.stopPropagation()}>
              {PALETTE_ORDER.map(type => (
                <button key={type} onClick={()=>{ addBlock(type, i); setPickerIndex(null); }}>
                  <span className="ms material-symbols-outlined">{COMPONENT_TYPES[type].icon}</span>
                  {COMPONENT_TYPES[type].label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (i < blocks.length) {
      const b = blocks[i];
      const displayProps = resolveLocalizedProps(b, canvasLocale ?? SOURCE_LOCALE);
      items.push(
        <Block
          key={b.id}
          block={b}
          displayProps={displayProps}
          selected={selectedId === b.id}
          onSelect={setSelectedId}
          onDelete={()=>deleteBlock(b.id)}
          onMoveUp={()=>moveBlock(b.id, -1)}
          onMoveDown={()=>moveBlock(b.id, 1)}
          layoutVariant={layoutVariant}
          onPatchBlockProps={patchBlockProps}
          onBlockDragStart={previewReadOnly ? undefined : onBlockDragStart}
          onBlockDragEnd={previewReadOnly ? undefined : onBlockDragEnd}
          previewReadOnly={previewReadOnly}
        />
      );
    }
  }
  if (blocks.length > 0 && !previewReadOnly) {
    const trailingOpen = pickerIndex === PICKER_TRAILING;
    items.push(
      <div key="canvas-trailing-add" className="canvas-trailing-plus">
        <CanvasEmptyPlusWrap
          insertAtIndex={blocks.length}
          isOpen={trailingOpen}
          onToggleOpen={() => setPickerIndex(trailingOpen ? null : PICKER_TRAILING)}
          addBlock={addBlock}
          setPickerIndex={setPickerIndex}
          isMobileViewport={isMobileViewport}
          onOpenMobilePicker={onOpenMobilePicker}
        />
      </div>
    );
  }
  return <>{items}</>;
}

function TranslationChannelEditorApp() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const channelParam = params.get('channel');
  const channelFromUrl = TRANSLATION_FIGMA_CHANNELS.some((c) => c.id === channelParam) ? channelParam : 'all';
  const localeParam = params.get('locale');

  const backToTranslationsHref = React.useMemo(() => {
    const u = new URL('Description%20Builder.html', window.location.href);
    u.searchParams.set('tab', 'Translations');
    return u.href;
  }, []);

  const [stored] = React.useState(readChannelEditorLaunchPayload);
  const blocksOnLaunch = stored && Array.isArray(stored.blocks) ? stored.blocks : [];

  const [locale, setLocale] = React.useState(() => {
    if (localeParam && TRANSLATION_LOCALE_OPTIONS.some((o) => o.code === localeParam)) return localeParam;
    const cand = stored && stored.locale;
    return cand && TRANSLATION_LOCALE_OPTIONS.some((o) => o.code === cand) ? cand : 'es';
  });
  const [eventTitle] = React.useState(() => (stored && stored.eventTitle) || '');
  const [eventTitleByLocale, setEventTitleByLocale] = React.useState(() => (stored && stored.eventTitleByLocale) || {});
  const [blocks, setBlocks] = React.useState(() => blocksOnLaunch);
  const [selectedId, setSelectedId] = React.useState(() => {
    const id = stored && stored.selectedBlockId;
    if (id && blocksOnLaunch.some((b) => b.id === id)) return id;
    return null;
  });
  const [pickerIndex, setPickerIndex] = React.useState(null);
  const [layoutVariant] = React.useState(() => {
    const lv = stored && stored.layoutVariant;
    if (lv === 'floating-toolbar' || lv === 'inline-plus' || lv === 'sidebar-properties') return lv;
    return 'sidebar-properties';
  });
  const [device] = React.useState(() => (stored && stored.device === 'mobile' ? 'mobile' : 'desktop'));
  const [isMobileViewport, setIsMobileViewport] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_VIEWPORT_QUERY).matches : false,
  );

  const [dragOver, setDragOver] = React.useState(false);
  const [dragOverIndex, setDragOverIndex] = React.useState(-1);
  const [draggingBlockId, setDraggingBlockId] = React.useState(null);
  const [mobileSheet, setMobileSheet] = React.useState({
    open: false,
    insertAtIndex: 0,
  });

  const lastCanvasDropIndexRef = React.useRef(-1);

  const closeMobileSheet = React.useCallback(() => {
    setMobileSheet((prev) => ({ ...prev, open: false }));
  }, []);

  const openMobilePicker = React.useCallback((insertAtIndex) => {
    setMobileSheet({
      open: true,
      insertAtIndex: Number.isFinite(insertAtIndex) ? Math.max(0, insertAtIndex) : 0,
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const onChange = (e) => setIsMobileViewport(e.matches);
    setIsMobileViewport(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  React.useEffect(() => {
    if (pickerIndex !== PICKER_EMPTY && pickerIndex !== PICKER_TRAILING) return;
    const onDocMouseDown = (e) => {
      if (e.target.closest('.canvas-empty-plus-wrap')) return;
      setPickerIndex(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [pickerIndex]);

  React.useEffect(() => {
    if (blocks.length === 0 && pickerIndex === PICKER_TRAILING) setPickerIndex(null);
  }, [blocks.length, pickerIndex]);

  React.useEffect(() => {
    if (!isMobileViewport) closeMobileSheet();
  }, [isMobileViewport, closeMobileSheet]);

  const patchBlockProps = React.useCallback((id, patch) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b)),
    );
  }, []);

  const patchBlockI18n = React.useCallback((id, loc, patch) => {
    if (!patch || loc === SOURCE_LOCALE) return;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const prevOv = (b.i18n && b.i18n[loc]) || {};
        const nextOv = pruneEmptyOverlayLeaves(mergeI18nDelta(prevOv, patch));
        return { ...b, i18n: { ...(b.i18n || {}), [loc]: nextOv } };
      }),
    );
  }, []);

  const addBlock = React.useCallback((type, atIndex) => {
    const newBlock = { id: uid(), type, props: defaultProps(type) };
    setBlocks((prev) => {
      const next = [...prev];
      const idx = atIndex === undefined || atIndex < 0 ? next.length : atIndex;
      next.splice(idx, 0, newBlock);
      return next;
    });
    setSelectedId(newBlock.id);
  }, []);

  const deleteBlock = React.useCallback((id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((sid) => (sid === id ? null : sid));
  }, []);

  const moveBlock = React.useCallback((id, dir) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const reorderBlock = React.useCallback((id, toIndex) => {
    setBlocks((prev) => {
      const fromIndex = prev.findIndex((b) => b.id === id);
      if (fromIndex < 0) return prev;
      const clamped = Math.max(0, Math.min(toIndex, prev.length));
      let insertAt = clamped;
      if (fromIndex < clamped) insertAt = clamped - 1;
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(insertAt, 0, item);
      return next;
    });
  }, []);

  const routeChannelEditorCanvasPatch = React.useCallback(
    (id, patch) => {
      if (!patch) return;
      if (Object.prototype.hasOwnProperty.call(patch, 'activeIndex')) {
        patchBlockProps(id, patch);
        return;
      }
      if (locale === SOURCE_LOCALE) patchBlockProps(id, patch);
      else patchBlockI18n(id, locale, patch);
    },
    [locale, patchBlockI18n, patchBlockProps],
  );

  const handleCanvasDragOver = React.useCallback(
    (e) => {
      e.preventDefault();
      const allowMove =
        e.dataTransfer.effectAllowed === 'move' || e.dataTransfer.effectAllowed === 'copyMove';
      e.dataTransfer.dropEffect = allowMove ? 'move' : 'copy';
      setDragOver(true);
      const rect = e.currentTarget.getBoundingClientRect();
      const blockEls = e.currentTarget.querySelectorAll('.block');
      let idx = blocks.length;
      for (let i = 0; i < blockEls.length; i++) {
        const r = blockEls[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          idx = i;
          break;
        }
      }
      lastCanvasDropIndexRef.current = idx;
      setDragOverIndex(idx);
    },
    [blocks],
  );

  const handleCanvasDrop = React.useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const plain = e.dataTransfer.getData('text/plain');
      const idFromMime = e.dataTransfer.getData(BLOCK_DRAG_MIME);
      const blockId =
        draggingBlockId ||
        idFromMime ||
        (plain && blocks.some((b) => b.id === plain) ? plain : null);
      if (blockId && blocks.some((b) => b.id === blockId)) {
        const refIdx = lastCanvasDropIndexRef.current;
        const toIndex =
          refIdx >= 0 ? refIdx : dragOverIndex >= 0 ? dragOverIndex : blocks.length;
        reorderBlock(blockId, toIndex);
        setDraggingBlockId(null);
        lastCanvasDropIndexRef.current = -1;
        setDragOverIndex(-1);
        return;
      }
      setDraggingBlockId(null);
      lastCanvasDropIndexRef.current = -1;
      setDragOverIndex(-1);
    },
    [blocks, draggingBlockId, dragOverIndex, reorderBlock],
  );

  const handleCanvasDragLeave = React.useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
    lastCanvasDropIndexRef.current = -1;
    setDragOverIndex(-1);
  }, []);

  const handleBlockDragStart = React.useCallback((e, blockId) => {
    setDraggingBlockId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
    e.dataTransfer.setData(BLOCK_DRAG_MIME, blockId);
  }, []);

  const handleBlockDragEnd = React.useCallback(() => {
    setDraggingBlockId(null);
    setDragOver(false);
    setDragOverIndex(-1);
  }, []);

  const handleMobileAddBlock = React.useCallback(
    (type) => {
      addBlock(type, mobileSheet.insertAtIndex);
      setPickerIndex(null);
      closeMobileSheet();
    },
    [addBlock, mobileSheet.insertAtIndex, closeMobileSheet],
  );

  const builderClass = `builder translation-channel-editor-builder--no-side-panels ${
    layoutVariant === 'floating-toolbar' ? 'floating-tools' : ''
  } ${layoutVariant === 'inline-plus' ? 'inline-plus' : ''}`;

  const childrenPreview = React.useMemo(() => {
    const blocksList = (
      <BlocksList
        canvasLocale={locale}
        blocks={blocks}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        deleteBlock={deleteBlock}
        moveBlock={moveBlock}
        dragOverIndex={dragOver ? dragOverIndex : -1}
        layoutVariant={layoutVariant}
        addBlock={addBlock}
        pickerIndex={pickerIndex}
        setPickerIndex={setPickerIndex}
        patchBlockProps={routeChannelEditorCanvasPatch}
        onBlockDragStart={handleBlockDragStart}
        onBlockDragEnd={handleBlockDragEnd}
        isMobileViewport={isMobileViewport}
        onOpenMobilePicker={openMobilePicker}
        suppressBetweenBlockInserters
      />
    );

    const previewRootClass = `translation-channel-editor-preview-root${dragOver ? ' translation-channel-editor-preview-root--drag-over' : ''}${
      device === 'mobile' ? ' translation-channel-editor-preview-root--device-mobile' : ''
    }`;

    return (
      <div className="translation-channel-editor-desc-builder" onClick={(e) => e.stopPropagation()}>
        <div
          className={`${builderClass} ${previewRootClass}`.trim()}
          onClick={(e) => e.stopPropagation()}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onDragLeave={handleCanvasDragLeave}
        >
          <div className="canvas-header">
            <div className="canvas-title">Description</div>
          </div>
          {device === 'mobile' ? <div className="mobile-frame">{blocksList}</div> : blocksList}
        </div>
      </div>
    );
  }, [
    builderClass,
    locale,
    blocks,
    selectedId,
    dragOver,
    dragOverIndex,
    layoutVariant,
    addBlock,
    deleteBlock,
    moveBlock,
    pickerIndex,
    routeChannelEditorCanvasPatch,
    handleBlockDragStart,
    handleBlockDragEnd,
    handleCanvasDragOver,
    handleCanvasDrop,
    handleCanvasDragLeave,
    isMobileViewport,
    device,
    openMobilePicker,
  ]);

  return (
    <div
      className={`app app--translation-channel-editor-page${isMobileViewport ? ' app-mobile-builder' : ''}`}
      onClick={() => setSelectedId(null)}
    >
      <Topbar />
      <Sidebar />
      <main className="main">
        <div className="main-inner translation-channel-editor-page">
          <div className="tabs">
            {['Content', 'Media', 'Venue', 'Translations'].map((t) => (
              <div key={t} className={`tab ${t === 'Translations' ? 'active' : ''}`}>
                {t}
              </div>
            ))}
          </div>
          <div className="translation-channel-editor-workspace-subhead">
            <a
              className="translation-channel-editor-back"
              href={backToTranslationsHref}
            >
              <span className="ms material-symbols-outlined translation-channel-editor-back-icon" aria-hidden>
                chevron_left
              </span>
              Back to Translations
            </a>
            <button type="button" className="btn btn-primary translation-figma-save-top">
              Save
            </button>
          </div>
          <div className="translation-plan-page translation-tab-panel">
            <TranslationFigmaWorkspace
              previewMode="langAndBody"
              initialChannelId={channelFromUrl}
              hideChannelContentEdit
              allowPreviewCanvasDnD
              patchBlockMasterProps={patchBlockProps}
              locale={locale}
              onLocaleChange={setLocale}
              eventTitle={eventTitle}
              eventTitleByLocale={eventTitleByLocale}
              onLocaleTitleChange={(loc, value) => {
                setEventTitleByLocale((prev) => {
                  const next = { ...prev };
                  if (!value.trim()) delete next[loc];
                  else next[loc] = value;
                  return next;
                });
              }}
              blocks={blocks}
              patchBlockI18n={patchBlockI18n}
              selectedBlockId={selectedId}
              onSelectBlock={setSelectedId}
              childrenPreview={childrenPreview}
            />
          </div>
        </div>
      </main>

      {isMobileViewport && mobileSheet.open && (
        <div className="mobile-sheet-overlay" onClick={closeMobileSheet}>
          <div className="mobile-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <>
              <div className="mobile-sheet-title-row">
                <div className="mobile-sheet-title">Add component</div>
                <button type="button" className="mobile-sheet-close" onClick={closeMobileSheet} aria-label="Close">
                  <span className="ms material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="mobile-sheet-list" role="listbox" aria-label="Components">
                {PALETTE_ORDER.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="option"
                    className="mobile-sheet-option"
                    onClick={() => handleMobileAddBlock(type)}
                  >
                    <span className="ms material-symbols-outlined">{COMPONENT_TYPES[type].icon}</span>
                    {COMPONENT_TYPES[type].label}
                  </button>
                ))}
              </div>
            </>
          </div>
        </div>
      )}
    </div>
  );
}

function TranslationLocalePreviewApp() {
  const [locale, setLocale] = React.useState('es');
  const [eventTitle] = React.useState('Summer orchestra night');
  const [eventTitleByLocale, setEventTitleByLocale] = React.useState({});
  const blocks = [];
  function patchBlockI18n() {}
  const emptyPreview = (
    <div className="canvas-empty canvas-empty--translation-preview">
      <div>No description blocks yet. Add components on the <strong>Content</strong> tab.</div>
    </div>
  );
  return (
    <div className="app" onClick={(e) => e.stopPropagation()}>
      <main className="main">
        <div className="main-inner translation-locale-preview-shell">
          <div className="translation-plan-page translation-tab-panel">
            <TranslationFigmaWorkspace
              previewMode="langAndBody"
              locale={locale}
              onLocaleChange={setLocale}
              eventTitle={eventTitle}
              eventTitleByLocale={eventTitleByLocale}
              onLocaleTitleChange={(loc, value) => {
                setEventTitleByLocale((prev) => {
                  const next = { ...prev };
                  if (!value.trim()) delete next[loc];
                  else next[loc] = value;
                  return next;
                });
              }}
              blocks={blocks}
              patchBlockI18n={patchBlockI18n}
              selectedBlockId={null}
              onSelectBlock={() => {}}
              childrenPreview={emptyPreview}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

const translationChannelEditorMount = document.getElementById('translation-channel-editor-root');
const translationLocalePreviewMount = document.getElementById('translation-locale-preview-root');
if (translationChannelEditorMount) {
  ReactDOM.createRoot(translationChannelEditorMount).render(<TranslationChannelEditorApp />);
} else if (translationLocalePreviewMount) {
  ReactDOM.createRoot(translationLocalePreviewMount).render(<TranslationLocalePreviewApp />);
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
