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
function Block({ block, selected, onSelect, onDelete, onMoveUp, onMoveDown, layoutVariant, onPatchBlockProps, onBlockDragStart, onBlockDragEnd }) {
  return (
    <div
      className={`block ${selected?'selected':''} ${block.type==='spacer'?'block-spacer':''}`}
      onClick={(e)=>{ e.stopPropagation(); onSelect(block.id); }}
      data-block-id={block.id}
    >
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
      <BlockContent
        block={block}
        onPatchProps={onPatchBlockProps ? (patch) => onPatchBlockProps(block.id, patch) : undefined}
      />
      {layoutVariant === 'floating-toolbar' ? (
        <div className="floating-toolbar" onClick={e=>e.stopPropagation()}>
          <span style={{padding:'0 6px', fontSize:12, opacity:0.8}}>{COMPONENT_TYPES[block.type].label}</span>
          <span className="sep"></span>
          <button onClick={onMoveUp} title="Move up"><span className="ms material-symbols-outlined">arrow_upward</span></button>
          <button onClick={onMoveDown} title="Move down"><span className="ms material-symbols-outlined">arrow_downward</span></button>
          <span className="sep"></span>
          <button onClick={onDelete} title="Delete"><span className="ms material-symbols-outlined">delete</span></button>
        </div>
      ) : (
        <div className="block-toolbar" onClick={e=>e.stopPropagation()}>
          <button onClick={onMoveUp} title="Move up"><span className="ms material-symbols-outlined">arrow_upward</span></button>
          <button onClick={onMoveDown} title="Move down"><span className="ms material-symbols-outlined">arrow_downward</span></button>
          <button className="danger" onClick={onDelete} title="Delete"><span className="ms material-symbols-outlined">delete</span></button>
        </div>
      )}
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
function Properties({ block, onChange, onDelete }) {
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
  const set = (k,v) => onChange({ ...block.props, [k]: v });
  const t = COMPONENT_TYPES[block.type];
  return (
    <aside className="properties" onClick={(e) => e.stopPropagation()}>
      <div className="properties-title">
        <span className="ms material-symbols-outlined" style={{verticalAlign:'middle', fontSize:18, marginRight:6, color:'var(--brand-primary)'}}>{t.icon}</span>
        {t.label}
      </div>
      <div className="properties-sub">Customise this component</div>
      {block.type === 'title' && <>
        <div className="prop">
          <label className="prop-label">Heading level</label>
          <div className="prop-segment">
            {['h1','h2','h3'].map(l => (
              <button key={l} className={block.props.level===l?'active':''} onClick={()=>set('level',l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="prop">
          <label className="prop-label">Text</label>
          <input type="text" value={block.props.text} onChange={e=>set('text', e.target.value)} />
        </div>
      </>}
      {block.type === 'paragraph' && <>
        <div className="prop">
          <label className="prop-label">Text</label>
          <textarea value={block.props.text} onChange={e=>set('text', e.target.value)} />
          <div style={{fontSize:11, color:'var(--fg-3)', marginTop:4}}>{block.props.text.length} / 600 characters</div>
        </div>
      </>}
      {block.type === 'spacer' && <>
        <div className="prop">
          <label className="prop-label">Height</label>
          <div className="prop-slider">
            <input type="range" min="8" max="120" step="4" value={block.props.size} onChange={e=>set('size', parseInt(e.target.value))} />
            <span className="val">{block.props.size}px</span>
          </div>
        </div>
      </>}
      {block.type === 'fullImage' && <>
        <div className="prop">
          <label className="prop-label">Upload image</label>
          <FullImageLocalUpload
            previewUrl={block.props.src}
            onClear={() => set('src', '')}
            onDataUrl={(dataUrl) => set('src', dataUrl)}
          />
        </div>
      </>}
      {block.type === 'imageGrid' && (() => {
        const gridItems = normalizeImageGridProps(block.props);
        const i = Math.min(Math.max(0, imageGridCardTab), gridItems.length - 1);
        const item = gridItems[i];
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
            <div className="prop">
              <label className="prop-label">Upload image</label>
              <FullImageLocalUpload
                previewUrl={item.src}
                onClear={() => {
                  const next = normalizeImageGridProps(block.props).map((row, j) =>
                    j === i ? { ...row, src: '' } : row
                  );
                  set('items', next);
                }}
                onDataUrl={(dataUrl) => {
                  const next = normalizeImageGridProps(block.props).map((row, j) =>
                    j === i ? { ...row, src: dataUrl } : row
                  );
                  set('items', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Title</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => {
                  const next = normalizeImageGridProps(block.props).map((row, j) =>
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
                  const next = normalizeImageGridProps(block.props).map((row, j) =>
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
        const icCards = normalizeInfoCardProps(block.props).cards;
        const i = Math.min(Math.max(0, infoCardTab), icCards.length - 1);
        const card = icCards[i] ?? createDefaultInfoCard(0);
        const nCards = icCards.length;
        return <>
          <div className="prop">
            <label className="prop-label">Active card</label>
            <div className="prop-segment prop-image-grid-card-tabs" role="tablist" aria-label="Info cards">
              {icCards.map((_, idx) => (
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
              {nCards < INFO_CARD_MAX ? (
                <button
                  type="button"
                  className="prop-segment-add"
                  aria-label="Add card"
                  onClick={() => {
                    const next = [...icCards, createDefaultInfoCard(icCards.length)];
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
              {nCards > 1 ? (
                <button
                  type="button"
                  className="prop-tabs-delete"
                  title="Remove this card from the block"
                  onClick={() => {
                    const nextCards = icCards.filter((_, j) => j !== i);
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
            <div className="prop">
              <label className="prop-label">Top image</label>
              <FullImageLocalUpload
                previewUrl={card.imageSrc}
                onClear={() => {
                  const next = [...icCards];
                  next[i] = { ...next[i], imageSrc: '' };
                  set('cards', next);
                }}
                onDataUrl={(dataUrl) => {
                  const next = [...icCards];
                  next[i] = { ...next[i], imageSrc: dataUrl };
                  set('cards', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Heading</label>
              <input
                type="text"
                value={card.heading}
                onChange={(e) => {
                  const next = [...icCards];
                  next[i] = { ...next[i], heading: e.target.value };
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
                  const next = [...icCards];
                  next[i] = { ...next[i], price: e.target.value };
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
                  const next = [...icCards];
                  next[i] = { ...next[i], ctaLabel: e.target.value };
                  set('cards', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Accent color</label>
              <div className="prop-accent-field">
              <div className="prop-accent-row">
                <input
                  type="text"
                  className="prop-accent-hex"
                  value={card.accentColor ?? ''}
                  placeholder={INFO_CARD_ACCENT_DEFAULT_HEX}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-label="Accent color (hex)"
                  onChange={(e) => {
                    let v = e.target.value;
                    if (v.length > 0 && !v.startsWith('#')) v = '#' + v.replace(/^#+/, '');
                    const next = [...icCards];
                    next[i] = { ...next[i], accentColor: v.slice(0, 7) };
                    set('cards', next);
                  }}
                  onBlur={(e) => {
                    const normalized = normalizeAccentHex(e.target.value, INFO_CARD_ACCENT_DEFAULT_HEX);
                    const next = [...icCards];
                    next[i] = { ...next[i], accentColor: normalized };
                    set('cards', next);
                  }}
                />
                <input
                  type="color"
                  className="prop-accent-picker"
                  value={normalizeAccentHex(card.accentColor, INFO_CARD_ACCENT_DEFAULT_HEX)}
                  aria-label="Choose accent with color picker"
                  onChange={(e) => {
                    const next = [...icCards];
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
                    className={`prop-accent-swatch${normalizeAccentHex(card.accentColor, '') === hex ? ' prop-accent-swatch--active' : ''}`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    aria-label={`Set accent to ${hex}`}
                    aria-pressed={normalizeAccentHex(card.accentColor, '') === hex}
                    onClick={() => {
                      const next = [...icCards];
                      next[i] = { ...next[i], accentColor: hex };
                      set('cards', next);
                    }}
                  />
                ))}
              </div>
              </div>
            </div>
            <div className="prop">
              <label className="prop-label">Badge (optional)</label>
              <input
                type="text"
                placeholder="e.g. MOST POPULAR"
                value={card.badge}
                onChange={(e) => {
                  const next = [...icCards];
                  next[i] = { ...next[i], badge: e.target.value };
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
                  const next = [...icCards];
                  next[i] = { ...next[i], bulletPointsText: e.target.value };
                  set('cards', next);
                }}
              />
            </div>
            <div className="prop">
              <label className="prop-label">Highlight card</label>
              <div className="prop-segment">
                <button
                  type="button"
                  className={card.highlighted ? 'active' : ''}
                  onClick={() => {
                    const next = [...icCards];
                    next[i] = { ...next[i], highlighted: true };
                    set('cards', next);
                  }}
                >
                  On
                </button>
                <button
                  type="button"
                  className={!card.highlighted ? 'active' : ''}
                  onClick={() => {
                    const next = [...icCards];
                    next[i] = { ...next[i], highlighted: false };
                    set('cards', next);
                  }}
                >
                  Off
                </button>
              </div>
            </div>
            </div>
          </div>
        </>;
      })()}
      {block.type === 'eventDetails' && <>
        {Array.isArray(block.props.details) && block.props.heading === undefined && block.props.promo === undefined ? (
          block.props.details.map((d,i)=>(
            <div key={i} className="prop">
              <label className="prop-label">{d.title} value</label>
              <input type="text" value={d.sub} onChange={e=>{
                const next = [...block.props.details]; next[i] = {...d, sub: e.target.value};
                set('details', next);
              }} />
            </div>
          ))
        ) : (
          <>
            <div className="prop">
              <label className="prop-label">Section heading</label>
              <input type="text" value={block.props.heading ?? ''} onChange={e=>set('heading', e.target.value)} />
            </div>
            <div className="prop">
              <label className="prop-label">Location line</label>
              <input type="text" value={block.props.locationLine ?? ''} onChange={e=>set('locationLine', e.target.value)} />
            </div>
            <div className="prop">
              <label className="prop-label">Dates line</label>
              <input type="text" value={block.props.datesLine ?? ''} onChange={e=>set('datesLine', e.target.value)} />
            </div>
            <div className="prop">
              <label className="prop-label">Promotional text</label>
              <textarea value={block.props.promo ?? ''} onChange={e=>set('promo', e.target.value)} />
            </div>
          </>
        )}
      </>}
      {block.type === 'tabs' && (() => {
        const tabRows = normalizeTabsProps(block.props);
        const n = tabRows.length;
        const idx = n === 0 ? 0 : Math.min(Math.max(0, block.props.activeIndex ?? 0), n - 1);
        const t = n > 0 ? tabRows[idx] : null;
        const tabBarRaw =
          typeof block.props.tabBarColor === 'string' ? block.props.tabBarColor.trim() : '';
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
                    const n = normalizeAccentHex(e.target.value, '');
                    set('tabBarColor', n || '');
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
          <div className="prop">
            <label className="prop-label">Active tab</label>
            <div className="prop-segment prop-image-grid-card-tabs" role="tablist" aria-label="Tabs">
              {tabRows.map((_, i) => (
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
              {n < TABS_MAX ? (
                <button
                  type="button"
                  className="prop-segment-add"
                  aria-label="Add tab"
                  onClick={() => {
                    const nextTabs = [...tabRows, createDefaultTab(tabRows.length)];
                    onChange({
                      ...block.props,
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
          {n > 0 && t ? (
            <div className="prop-tabs-section">
              <div className="prop-tabs-section-head">
                <div className="prop-tabs-section-head-text">
                  <span className="prop-tabs-section-eyebrow">Tab content</span>
                  <h3 className="prop-tabs-section-heading">Tab {idx + 1}</h3>
                  <p className="prop-tabs-section-lede">
                    Nav label, optional heading above the body, main text, and optional uploaded side image in the preview.
                  </p>
                </div>
                {n > 1 ? (
                  <button
                    type="button"
                    className="prop-tabs-delete"
                    title="Remove this tab from the block"
                    onClick={() => {
                      const nextTabs = tabRows.filter((_, j) => j !== idx);
                      let nextActive = block.props.activeIndex ?? 0;
                      if (idx < nextActive) nextActive -= 1;
                      else if (idx === nextActive) nextActive = Math.min(idx, nextTabs.length - 1);
                      nextActive = Math.max(0, Math.min(nextActive, nextTabs.length - 1));
                      onChange({
                        ...block.props,
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
                      const next = tabRows.map((row, j) =>
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
                      const next = tabRows.map((row, j) =>
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
                      const next = tabRows.map((row, j) =>
                        j === idx ? { ...row, body: e.target.value } : row
                      );
                      set('tabs', next);
                    }}
                  />
                </div>
                <div className="prop">
                  <label className="prop-label">Upload image</label>
                  <FullImageLocalUpload
                    previewUrl={t.imageSrc ?? ''}
                    onClear={() => {
                      const next = tabRows.map((row, j) =>
                        j === idx ? { ...row, imageSrc: '' } : row
                      );
                      set('tabs', next);
                    }}
                    onDataUrl={(dataUrl) => {
                      const next = tabRows.map((row, j) =>
                        j === idx ? { ...row, imageSrc: dataUrl } : row
                      );
                      set('tabs', next);
                    }}
                  />
                </div>
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
  const [activeTab, setActiveTab] = React.useState('Content');
  const [device] = React.useState('desktop');
  const [eventTitle, setEventTitle] = React.useState('Pizza in Piazza');
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
          <h1 className="page-title">{eventTitle}</h1>
          {tweaks.showStepper && <Stepper />}

          <h2 className="section-title">Content</h2>
          <p className="section-sub">Enter key details for your event, including content, images, venue, capacity, and general information.</p>

          <div className="tabs">
            {['Content','Media','Venue','Translations'].map(t => (
              <div key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>{t}</div>
            ))}
          </div>

          {tweaks.showRequirements && <Requirements />}

          <div className="field">
            <label className="field-label">Event title</label>
            <input className="input" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} />
          </div>

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
                        patchBlockProps={patchBlockProps}
                        onBlockDragStart={handleBlockDragStart}
                        onBlockDragEnd={handleBlockDragEnd}
                        isMobileViewport={isMobileViewport}
                        onOpenMobilePicker={openMobilePicker}
                      />
                    </div>
                  ) : (
                    <BlocksList
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
                      patchBlockProps={patchBlockProps}
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
                  onChange={(props)=>selected && updateBlock(selected.id, props)}
                  onDelete={()=>selected && deleteBlock(selected.id)}
                />
              )}
            </div>
          </div>
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
                  onChange={(props)=>selected && updateBlock(selected.id, props)}
                  onDelete={()=>{
                    if (!selected) return;
                    deleteBlock(selected.id);
                    closeMobileSheet();
                  }}
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

function BlocksList({ blocks, selectedId, setSelectedId, deleteBlock, moveBlock, dragOverIndex, layoutVariant, addBlock, pickerIndex, setPickerIndex, patchBlockProps, onBlockDragStart, onBlockDragEnd, isMobileViewport, onOpenMobilePicker }) {
  if (blocks.length === 0 && dragOverIndex < 0) {
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
        <div>Drag a component here, double-click one in the palette, or use + to choose</div>
      </div>
    );
  }
  const items = [];
  for (let i = 0; i <= blocks.length; i++) {
    if (dragOverIndex === i) {
      items.push(<div key={`d-${i}`} className="drop-indicator show"></div>);
    }
    if (layoutVariant === 'inline-plus' && i < blocks.length) {
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
      items.push(
        <Block
          key={b.id}
          block={b}
          selected={selectedId === b.id}
          onSelect={setSelectedId}
          onDelete={()=>deleteBlock(b.id)}
          onMoveUp={()=>moveBlock(b.id, -1)}
          onMoveDown={()=>moveBlock(b.id, 1)}
          layoutVariant={layoutVariant}
          onPatchBlockProps={patchBlockProps}
          onBlockDragStart={onBlockDragStart}
          onBlockDragEnd={onBlockDragEnd}
        />
      );
    }
  }
  if (blocks.length > 0) {
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
