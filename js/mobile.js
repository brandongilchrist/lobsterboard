/**
 * LobsterBoard Mobile — View Controller
 * Powers all 3 mobile views: Stream, Tabs, Command Center
 * Reuses widget definitions from widgets.js (WIDGETS, renderIcon, onSystemStats, etc.)
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  const state = {
    widgets: [],
    canvas: { width: 1920, height: 1080 },
    fontScale: 1,
    currentView: 'stream',
    currentFilter: 'all',
    currentTab: 0,
    authenticated: false,
    settingsOpen: false
  };

  // Widget type → mobile category mapping
  const CATEGORY_MAP = {
    // OpenClaw
    'auth-status': 'openclaw',
    'lobsterboard-release': 'openclaw',
    'openclaw-release': 'openclaw',
    'release': 'openclaw',
    'activity-list': 'openclaw',
    'cron-jobs': 'openclaw',
    'system-log': 'openclaw',

    // AI / LLM
    'ai-usage-claude': 'ai',
    'ai-usage-openai': 'ai',
    'ai-cost-tracker': 'ai',
    'api-status': 'ai',
    'session-count': 'ai',
    'token-gauge': 'ai',

    // System
    'cpu-memory': 'system',
    'disk-usage': 'system',
    'network-speed': 'system',
    'docker-containers': 'system',
    'uptime-monitor': 'system',

    // Productivity
    'todo-list': 'productivity',
    'calendar': 'productivity',
    'email-count': 'productivity',
    'pomodoro': 'productivity',
    'notes': 'productivity',
    'github-stats': 'productivity',
    'pages-menu': 'productivity',

    // Basics (Weather, Clock, etc.)
    'weather': 'basics',
    'weather-multi': 'basics',
    'clock': 'basics',
    'world-clock': 'basics',
    'countdown': 'basics',

    // Finance
    'stock-ticker': 'finance',
    'crypto-price': 'finance',

    // Content
    'quick-links': 'content',
    'image-viewer': 'content',
    'image-random': 'content',
    'latest-image': 'content',
    'iframe-embed': 'content',
    'rss-ticker': 'content',
    'quote-of-the-day': 'content',

    // Health
    'sleep-ring': 'health',

    // Layout (skip these on mobile)
    'text-header': 'layout',
    'divider-horizontal': 'layout',
    'divider-vertical': 'layout'
  };

  // Category display info
  const CATEGORIES = {
    openclaw: { name: 'OpenClaw', icon: '🐾', order: 0 },
    ai: { name: 'AI / LLM', icon: '🤖', order: 1 },
    system: { name: 'System', icon: '💻', order: 2 },
    productivity: { name: 'Productivity', icon: '📋', order: 3 },
    basics: { name: 'Basics', icon: '📌', order: 4 },
    finance: { name: 'Finance', icon: '💵', order: 5 },
    content: { name: 'Content', icon: '🔗', order: 6 },
    health: { name: 'Health', icon: '❤️', order: 7 }
  };

  // ─────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    restorePreferences();
    initEventListeners();
    await checkAuth();
    await loadConfig();
  });

  function restorePreferences() {
    // Restore theme
    const savedTheme = localStorage.getItem('lb-theme');
    if (savedTheme) {
      applyTheme(savedTheme);
      const sel = document.getElementById('mobile-theme-select');
      if (sel) sel.value = savedTheme;
    }

    // Restore view mode
    const savedView = localStorage.getItem('lb-mobile-view');
    if (savedView && ['stream', 'tabs', 'command'].includes(savedView)) {
      state.currentView = savedView;
    }
    switchView(state.currentView);
  }

  function initEventListeners() {
    // Settings toggle
    document.getElementById('btn-settings').addEventListener('click', toggleSettings);

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', refreshDashboard);

    // View switcher
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Theme selector
    document.getElementById('mobile-theme-select').addEventListener('change', (e) => {
      applyTheme(e.target.value);
      localStorage.setItem('lb-theme', e.target.value);
    });

    // Bottom tab bar (stream filter)
    document.querySelectorAll('.bottom-tab').forEach(tab => {
      tab.addEventListener('click', () => filterStream(tab.dataset.filter));
    });

    // Fullscreen close
    document.getElementById('fullscreen-close').addEventListener('click', closeFullscreen);

    // PIN modal
    document.getElementById('mobile-pin-submit').addEventListener('click', submitPin);
    document.getElementById('mobile-pin-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPin();
    });

    // Touch swipe for tabs view
    initTabSwipe();
  }

  // ─────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.hasPin && !data.publicMode) {
        // Check if we have a valid session
        const session = localStorage.getItem('lb-session');
        if (!session) {
          showPinModal();
          return;
        }
      }
      state.authenticated = true;
    } catch (e) {
      // No auth endpoint or error - proceed without auth
      state.authenticated = true;
    }
  }

  function showPinModal() {
    document.getElementById('pin-modal').style.display = 'flex';
    document.getElementById('mobile-pin-input').focus();
  }

  async function submitPin() {
    const input = document.getElementById('mobile-pin-input');
    const error = document.getElementById('pin-error');
    const pin = input.value;

    if (!pin || pin.length < 4) {
      error.textContent = 'PIN must be at least 4 digits';
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('lb-session', Date.now().toString());
        document.getElementById('pin-modal').style.display = 'none';
        state.authenticated = true;
        await loadConfig();
      } else {
        error.textContent = 'Incorrect PIN';
        input.value = '';
        input.focus();
      }
    } catch (e) {
      error.textContent = 'Connection error';
    }
  }

  // ─────────────────────────────────────────────
  // Config Loading
  // ─────────────────────────────────────────────
  async function loadConfig() {
    if (!state.authenticated) return;

    showLoading();
    try {
      const res = await fetch('/config');
      if (!res.ok) throw new Error('Failed to load config');
      const config = await res.json();

      state.canvas = config.canvas || { width: 1920, height: 1080 };
      state.fontScale = config.fontScale || 1;
      state.widgets = (config.widgets || []).filter(w => {
        // Skip layout widgets (dividers, headers) on mobile
        const cat = getCategory(w.type);
        return cat !== 'layout';
      });

      document.documentElement.style.setProperty('--font-scale', state.fontScale);
      renderCurrentView();
    } catch (e) {
      console.error('Failed to load config:', e);
      showError('Failed to load dashboard. Check your connection.');
    }
  }

  // ─────────────────────────────────────────────
  // View Switching
  // ─────────────────────────────────────────────
  function switchView(view) {
    state.currentView = view;
    document.body.dataset.view = view;
    localStorage.setItem('lb-mobile-view', view);

    // Update switcher buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Show/hide views
    document.querySelectorAll('.mobile-view').forEach(el => {
      el.style.display = 'none';
    });

    const viewMap = { stream: 'view-stream', tabs: 'view-tabs', command: 'view-command' };
    const activeView = document.getElementById(viewMap[view]);
    if (activeView) activeView.style.display = '';

    // Re-render if we have widgets
    if (state.widgets.length > 0) {
      renderCurrentView();
    }
  }

  function renderCurrentView() {
    stopAllWidgetScripts();

    switch (state.currentView) {
      case 'stream': renderStream(); break;
      case 'tabs': renderTabs(); break;
      case 'command': renderCommandCenter(); break;
    }
  }

  // ─────────────────────────────────────────────
  // VIEW: STREAM
  // ─────────────────────────────────────────────
  function renderStream() {
    const container = document.getElementById('stream-container');
    container.innerHTML = '';

    const filtered = filterWidgets(state.widgets, state.currentFilter);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="stream-empty">
          <div class="stream-empty-icon">🦞</div>
          <div class="stream-empty-text">
            ${state.widgets.length === 0
              ? 'No widgets configured yet.<br>Use the desktop builder to add widgets.'
              : 'No widgets in this category.'}
          </div>
        </div>`;
      return;
    }

    // Sort: OpenClaw first, then AI, then System, then others
    const sorted = sortWidgets(filtered);
    sorted.forEach(widget => {
      const el = createMobileWidget(widget);
      container.appendChild(el);
    });

    executeAllWidgetScripts();
  }

  function filterStream(filter) {
    state.currentFilter = filter;

    // Update bottom tabs
    document.querySelectorAll('.bottom-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });

    renderStream();
  }

  // ─────────────────────────────────────────────
  // VIEW: TABS
  // ─────────────────────────────────────────────
  function renderTabs() {
    const tabsBar = document.getElementById('tabs-bar');
    const panelsContainer = document.getElementById('tabs-panels');

    tabsBar.innerHTML = '';
    panelsContainer.innerHTML = '';

    // Group widgets by category
    const groups = groupWidgetsByCategory(state.widgets);
    const categoryKeys = Object.keys(groups).sort((a, b) => {
      return (CATEGORIES[a]?.order ?? 99) - (CATEGORIES[b]?.order ?? 99);
    });

    if (categoryKeys.length === 0) {
      panelsContainer.innerHTML = `
        <div class="tab-panel active" style="position:relative;">
          <div class="stream-empty">
            <div class="stream-empty-icon">🦞</div>
            <div class="stream-empty-text">No widgets configured yet.</div>
          </div>
        </div>`;
      return;
    }

    // Ensure current tab is valid
    if (state.currentTab >= categoryKeys.length) state.currentTab = 0;

    categoryKeys.forEach((cat, i) => {
      const info = CATEGORIES[cat] || { name: cat, icon: '●' };
      const widgets = groups[cat];

      // Tab button
      const tabBtn = document.createElement('button');
      tabBtn.className = 'tab-btn' + (i === state.currentTab ? ' active' : '');
      tabBtn.innerHTML = `${info.icon} ${info.name}<span class="tab-badge">${widgets.length}</span>`;
      tabBtn.addEventListener('click', () => switchTab(i));
      tabsBar.appendChild(tabBtn);

      // Panel
      const panel = document.createElement('div');
      panel.className = 'tab-panel' + (i === state.currentTab ? ' active' : (i < state.currentTab ? ' left' : ' right'));
      panel.dataset.index = i;

      const grid = document.createElement('div');
      grid.className = 'tab-panel-grid';

      widgets.forEach(widget => {
        grid.appendChild(createMobileWidget(widget));
      });

      panel.appendChild(grid);
      panelsContainer.appendChild(panel);
    });

    executeAllWidgetScripts();
  }

  function switchTab(index) {
    const prevIndex = state.currentTab;
    state.currentTab = index;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === index);
    });

    // Animate panels
    document.querySelectorAll('.tab-panel').forEach((panel, i) => {
      panel.classList.remove('active', 'left', 'right');
      if (i === index) panel.classList.add('active');
      else if (i < index) panel.classList.add('left');
      else panel.classList.add('right');
    });

    // Scroll tab into view
    const activeTab = document.querySelectorAll('.tab-btn')[index];
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // Tab swipe gesture
  function initTabSwipe() {
    const panels = document.getElementById('tabs-panels');
    let startX = 0;
    let startY = 0;
    let tracking = false;

    panels.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    panels.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;

      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;

      // Only trigger if horizontal swipe is dominant and > 50px
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const tabCount = document.querySelectorAll('.tab-btn').length;
        if (dx < 0 && state.currentTab < tabCount - 1) {
          switchTab(state.currentTab + 1);
        } else if (dx > 0 && state.currentTab > 0) {
          switchTab(state.currentTab - 1);
        }
      }
    }, { passive: true });
  }

  // ─────────────────────────────────────────────
  // VIEW: COMMAND CENTER
  // ─────────────────────────────────────────────
  function renderCommandCenter() {
    renderTicker();
    renderAccordionGroups();
    executeAllWidgetScripts();
  }

  function renderTicker() {
    const ticker = document.getElementById('command-ticker');
    ticker.innerHTML = '';

    // Build ticker items from system widgets if present
    const tickerItems = [
      { id: 'ticker-cpu', label: 'CPU', value: '—', color: 'blue' },
      { id: 'ticker-mem', label: 'MEM', value: '—', color: 'blue' },
      { id: 'ticker-uptime', label: 'UPTIME', value: '—', color: 'green' },
      { id: 'ticker-net-up', label: 'NET ↑', value: '—', color: '' },
      { id: 'ticker-net-dn', label: 'NET ↓', value: '—', color: '' }
    ];

    tickerItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'ticker-item';
      el.innerHTML = `
        <span class="ticker-value ${item.color}" id="${item.id}">${item.value}</span>
        <span class="ticker-label">${item.label}</span>
      `;
      ticker.appendChild(el);
    });

    // Subscribe to system stats for ticker
    if (typeof onSystemStats === 'function') {
      onSystemStats((data) => {
        const cpuEl = document.getElementById('ticker-cpu');
        const memEl = document.getElementById('ticker-mem');
        const uptimeEl = document.getElementById('ticker-uptime');
        const netUpEl = document.getElementById('ticker-net-up');
        const netDnEl = document.getElementById('ticker-net-dn');

        if (cpuEl && data.cpu) {
          const pct = Math.round(data.cpu.currentLoad || 0);
          cpuEl.textContent = pct + '%';
          cpuEl.className = 'ticker-value ' + (pct > 80 ? 'red' : pct > 50 ? 'orange' : 'blue');
        }
        if (memEl && data.memory) {
          memEl.textContent = _formatBytes(data.memory.used || 0, 1);
        }
        if (uptimeEl && data.uptime != null) {
          uptimeEl.textContent = _formatUptime(data.uptime);
        }
        if (data.network && data.network[0]) {
          const net = data.network[0];
          if (netUpEl) netUpEl.textContent = _formatBytesPerSec(net.tx_sec || 0);
          if (netDnEl) netDnEl.textContent = _formatBytesPerSec(net.rx_sec || 0);
        }
      });
    }
  }

  function renderAccordionGroups() {
    const container = document.getElementById('command-groups');
    container.innerHTML = '';

    const groups = groupWidgetsByCategory(state.widgets);
    const categoryKeys = Object.keys(groups).sort((a, b) => {
      return (CATEGORIES[a]?.order ?? 99) - (CATEGORIES[b]?.order ?? 99);
    });

    if (categoryKeys.length === 0) {
      container.innerHTML = `
        <div class="stream-empty">
          <div class="stream-empty-icon">🦞</div>
          <div class="stream-empty-text">No widgets configured yet.</div>
        </div>`;
      return;
    }

    // Open first two groups by default
    categoryKeys.forEach((cat, i) => {
      const info = CATEGORIES[cat] || { name: cat, icon: '●' };
      const widgets = groups[cat];

      const group = document.createElement('div');
      group.className = 'command-group' + (i < 2 ? ' open' : '');

      group.innerHTML = `
        <button class="command-group-header">
          <span class="command-group-left">
            <span class="command-group-icon">${info.icon}</span>
            <span>${info.name}</span>
          </span>
          <span class="command-group-right">
            <span class="command-group-count">${widgets.length}</span>
            <span class="command-group-arrow">▸</span>
          </span>
        </button>
        <div class="command-group-body">
          <div class="command-group-grid"></div>
        </div>
      `;

      // Toggle accordion
      group.querySelector('.command-group-header').addEventListener('click', () => {
        group.classList.toggle('open');
      });

      // Add widgets to grid
      const grid = group.querySelector('.command-group-grid');
      widgets.forEach(widget => {
        grid.appendChild(createMobileWidget(widget));
      });

      container.appendChild(group);
    });
  }

  // ─────────────────────────────────────────────
  // Widget Rendering (shared across all views)
  // ─────────────────────────────────────────────
  function createMobileWidget(widget) {
    const template = WIDGETS[widget.type];
    if (!template) return document.createElement('div');

    const category = template.category || 'large';
    const isSmall = category === 'small';

    const el = document.createElement('div');
    el.className = 'mobile-widget ' + (isSmall ? 'widget-half' : 'widget-full');
    el.dataset.widgetId = widget.id;
    el.dataset.widgetType = widget.type;
    el.dataset.category = getCategory(widget.type);

    // Generate widget HTML using existing template
    const props = { ...widget.properties, id: 'mobile-' + widget.id };
    let html = template.generateHtml(props);
    // Process the HTML (handle showHeader)
    if (widget.properties.showHeader === false) {
      const headerRegex = /<div\s+class="dash-card-head"[^>]*>[\s\S]*?<\/div>/i;
      html = html.replace(headerRegex, '');
    }

    el.innerHTML = `
      <div class="widget-render">${html}</div>
      <div class="widget-expand-hint">⤢</div>
    `;

    // Tap to expand fullscreen
    el.addEventListener('click', () => {
      openFullscreen(widget, template);
    });

    return el;
  }

  function executeAllWidgetScripts() {
    // Clear previous intervals
    if (window._widgetIntervals) {
      window._widgetIntervals.forEach(id => clearInterval(id));
    }
    window._widgetIntervals = [];

    const origSetInterval = window.setInterval;
    window.setInterval = function (fn, ms) {
      const id = origSetInterval(fn, ms);
      window._widgetIntervals.push(id);
      return id;
    };

    state.widgets.forEach(widget => {
      const template = WIDGETS[widget.type];
      if (!template || !template.generateJs) return;

      // Only execute if widget is rendered in DOM
      const el = document.querySelector(`[data-widget-id="${widget.id}"]`);
      if (!el) return;

      const props = sanitizeProps({ ...widget.properties, id: 'mobile-' + widget.id });
      try {
        const js = template.generateJs(props);
        new Function(js)();
      } catch (e) {
        console.error(`Widget ${widget.type} script error:`, e);
      }
    });

    window.setInterval = origSetInterval;
  }

  function stopAllWidgetScripts() {
    if (window._widgetIntervals) {
      window._widgetIntervals.forEach(id => clearInterval(id));
      window._widgetIntervals = [];
    }
    // Reset SSE
    if (typeof _statsSource !== 'undefined' && _statsSource) {
      _statsSource.close();
      _statsSource = null;
      _statsCallbacks = [];
    }
  }

  function sanitizeProps(props) {
    const safe = { ...props };
    for (const key of Object.keys(safe)) {
      if (typeof safe[key] === 'string') {
        safe[key] = safe[key].replace(/[`$\\]/g, '\\$&').replace(/'/g, "\\'").replace(/"/g, '\\"');
      }
    }
    return safe;
  }

  // ─────────────────────────────────────────────
  // Fullscreen Widget
  // ─────────────────────────────────────────────
  function openFullscreen(widget, template) {
    const overlay = document.getElementById('fullscreen-overlay');
    const title = document.getElementById('fullscreen-title');
    const body = document.getElementById('fullscreen-body');

    title.textContent = (template.icon || '') + ' ' + (widget.properties.title || template.name);

    // Generate a fresh widget instance for fullscreen
    const props = { ...widget.properties, id: 'fullscreen-' + widget.id };
    let html = template.generateHtml(props);

    body.innerHTML = `<div class="widget-render">${html}</div>`;
    overlay.style.display = 'flex';

    // Execute JS for fullscreen widget
    if (template.generateJs) {
      const jsProps = sanitizeProps({ ...widget.properties, id: 'fullscreen-' + widget.id });
      try {
        const js = template.generateJs(jsProps);
        new Function(js)();
      } catch (e) {
        console.error('Fullscreen widget script error:', e);
      }
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  function closeFullscreen() {
    document.getElementById('fullscreen-overlay').style.display = 'none';
    document.body.style.overflow = '';
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  function getCategory(widgetType) {
    return CATEGORY_MAP[widgetType] || 'content';
  }

  function filterWidgets(widgets, filter) {
    if (filter === 'all') return widgets;
    return widgets.filter(w => getCategory(w.type) === filter);
  }

  function sortWidgets(widgets) {
    return [...widgets].sort((a, b) => {
      const catA = CATEGORIES[getCategory(a.type)]?.order ?? 99;
      const catB = CATEGORIES[getCategory(b.type)]?.order ?? 99;
      return catA - catB;
    });
  }

  function groupWidgetsByCategory(widgets) {
    const groups = {};
    widgets.forEach(w => {
      const cat = getCategory(w.type);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(w);
    });
    return groups;
  }

  function applyTheme(theme) {
    document.body.className = 'mobile-app' + (theme !== 'default' ? ' theme-' + theme : '');
    // Preserve data-view attribute
    document.body.dataset.view = state.currentView;

    // Update meta theme-color for mobile browser chrome
    const themeColors = {
      default: '#0d1117',
      feminine: '#fdf4f8',
      'feminine-dark': '#1a0e2e',
      terminal: '#0a0a0a',
      paper: '#f5f0e8',
      void: '#0d1117'
    };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColors[theme] || '#0d1117';
  }

  function toggleSettings() {
    state.settingsOpen = !state.settingsOpen;
    const drawer = document.getElementById('settings-drawer');
    drawer.classList.toggle('open', state.settingsOpen);
  }

  async function refreshDashboard() {
    const btn = document.getElementById('btn-refresh');
    btn.classList.add('spinning');
    await loadConfig();
    setTimeout(() => btn.classList.remove('spinning'), 800);
  }

  function showLoading() {
    const containers = ['stream-container', 'tabs-panels', 'command-groups'];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.closest('.mobile-view')?.style.display !== 'none') {
        el.innerHTML = `
          <div class="mobile-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading dashboard...</div>
          </div>`;
      }
    });
  }

  function showError(message) {
    const containers = ['stream-container', 'tabs-panels', 'command-groups'];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = `
          <div class="stream-empty">
            <div class="stream-empty-icon">⚠️</div>
            <div class="stream-empty-text">${message}</div>
          </div>`;
      }
    });
  }
})();
