/* deck-chrome.js — shared deck chrome (self-injecting).
   Adds three fixed overlays to every deck, in viewport pixels so they stay
   pinned to the screen corners regardless of reveal's slide scaling:
     - top-left    : a hamburger menu linking to the index and every deck
     - top-right   : a link to the GitHub repository
     - bottom-left : the current project version

   Repo-specific data (DECKS, VERSION, REPO_URL) lives here so there is a
   single place to edit. Drop it into a deck with:
     <script src="../assets/deck-chrome.js"></script>
   No dependency on reveal; safe to load before or after it. */
(function () {
  'use strict';

  var VERSION  = window.DLFC_VERSION || 'v0.1.0';
  var REPO_URL = 'https://github.com/laplacef/deep-learning-for-cyber';

  // Teaching order; matches docs/index.html. built:false renders as a
  // dimmed, non-linked "soon" row.
  var DECKS = [
    { n: '01', slug: 'neural-networks',                title: 'Neural Networks',                    built: true  },
    { n: '02', slug: 'how-neural-networks-learn',      title: 'How Neural Networks Learn',          built: true  },
    { n: '03', slug: 'training-deep-networks',         title: 'Training Deep Networks',             built: true  },
    { n: '04', slug: 'text-embeddings',                title: 'Text Embeddings',                    built: true  },
    { n: '05', slug: 'malware-as-images',              title: 'Malware as Images',                  built: true  }
  ];

  // Current deck slug from the URL (…/docs/<slug>/…).
  var parts = location.pathname.replace(/\/+$/, '').split('/');
  var current = parts[parts.length - 1] || '';

  function build() {
    if (document.getElementById('deck-chrome')) return;

    var style = document.createElement('style');
    style.id = 'deck-chrome-style';
    style.textContent = [
      '#deck-chrome{font-family:var(--mono,"IBM Plex Mono",monospace);}',
      '#deck-chrome .dc-btn{position:fixed;z-index:60;top:22px;left:22px;display:flex;',
      'align-items:center;justify-content:center;width:46px;height:46px;',
      'background:none;border:0;color:var(--ink,#15161d);',
      'cursor:pointer;transition:color .15s;padding:0;}',
      '#deck-chrome .dc-btn:hover{color:var(--accent,#3b56d8);}',
      '#deck-chrome .dc-btn svg{width:22px;height:22px;}',
      // overlay menu
      '#deck-chrome .dc-scrim{position:fixed;inset:0;z-index:70;background:rgba(21,22,29,.42);',
      'opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s;}',
      '#deck-chrome .dc-menu{position:fixed;top:0;left:0;z-index:71;height:100%;width:min(460px,86vw);',
      'background:#fff;border-right:1px solid var(--line,#dededf);box-shadow:0 0 60px rgba(21,22,29,.18);',
      'transform:translateX(-102%);transition:transform .24s ease;display:flex;flex-direction:column;',
      'padding:30px 0 24px;overflow-y:auto;}',
      '#deck-chrome.open .dc-scrim{opacity:1;visibility:visible;}',
      '#deck-chrome.open .dc-menu{transform:translateX(0);}',
      '#deck-chrome .dc-menu-top{display:flex;align-items:center;justify-content:space-between;padding:0 30px 18px;}',
      '#deck-chrome .dc-eyebrow{font:600 13px/1 var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:var(--muted2,#9da0b0);}',
      '#deck-chrome .dc-close{background:none;border:0;font-size:26px;line-height:1;color:var(--muted,#6b6f80);cursor:pointer;padding:0 4px;}',
      '#deck-chrome .dc-close:hover{color:var(--ink,#15161d);}',
      '#deck-chrome .dc-home-row{display:flex;align-items:center;gap:16px;padding:13px 30px;',
      'border-top:1px solid var(--line,#dededf);border-bottom:1px solid var(--line,#dededf);}',
      '#deck-chrome .dc-home{font:600 19px/1 var(--sans,sans-serif);color:var(--ink);text-decoration:none;}',
      '#deck-chrome .dc-home:hover{color:var(--accent,#3b56d8);}',
      '#deck-chrome .dc-meta{margin-left:auto;display:flex;align-items:center;gap:16px;}',
      '#deck-chrome .dc-ext{display:flex;align-items:center;gap:7px;text-decoration:none;',
      'font:500 14px/1 var(--mono,monospace);letter-spacing:.03em;color:var(--muted,#6b6f80);}',
      '#deck-chrome .dc-ext:hover{color:var(--accent,#3b56d8);}',
      '#deck-chrome .dc-ver{margin-left:8px;font:500 11px/1 var(--mono,monospace);',
      'letter-spacing:0;text-transform:none;color:var(--muted2,#9da0b0);}',
      '#deck-chrome .dc-list{list-style:none;margin:0;padding:6px 0;}',
      '#deck-chrome .dc-row{display:flex;align-items:baseline;gap:16px;padding:11px 30px;text-decoration:none;}',
      '#deck-chrome a.dc-row:hover{background:var(--bg-alt,#f6f6f4);}',
      '#deck-chrome a.dc-row:hover .dc-title{color:var(--accent,#3b56d8);}',
      '#deck-chrome .dc-num{font:500 14px/1.4 var(--mono,monospace);color:var(--muted2,#9da0b0);min-width:2.4ch;}',
      '#deck-chrome .dc-title{font:500 18px/1.3 var(--sans,sans-serif);color:var(--ink,#15161d);}',
      '#deck-chrome .dc-soon{margin-left:auto;align-self:center;font:500 12px/1 var(--mono,monospace);color:var(--muted2,#9da0b0);}',
      '#deck-chrome .dc-row.planned{cursor:default;}',
      '#deck-chrome .dc-row.planned .dc-title{color:var(--muted2,#9da0b0);}',
      '#deck-chrome .dc-row.active{background:var(--tint-blue,#eef1fc);}',
      '#deck-chrome .dc-row.active .dc-title{color:var(--accent,#3b56d8);font-weight:600;}',
      '#deck-chrome .dc-row.active .dc-num{color:var(--accent,#3b56d8);}'
    ].join('');
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'deck-chrome';

    var rows = DECKS.map(function (d) {
      var active = d.slug === current ? ' active' : '';
      var inner =
        '<span class="dc-num">' + d.n + '</span>' +
        '<span class="dc-title">' + d.title + '</span>' +
        (d.built ? '' : '<span class="dc-soon">soon</span>');
      if (d.built) {
        return '<li><a class="dc-row' + active + '" href="../' + d.slug + '/">' + inner + '</a></li>';
      }
      return '<li><span class="dc-row planned' + active + '">' + inner + '</span></li>';
    }).join('');

    root.innerHTML =
      '<button class="dc-btn" id="dc-toggle" aria-label="Open deck menu" aria-expanded="false" aria-controls="dc-menu">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/>' +
        '</svg>' +
      '</button>' +
      '<div class="dc-scrim" id="dc-scrim"></div>' +
      '<nav class="dc-menu" id="dc-menu" aria-label="Decks" hidden>' +
        '<div class="dc-menu-top"><span class="dc-eyebrow">Deep Learning for Cyber<span class="dc-ver">(' + VERSION + ')</span></span>' +
          '<button class="dc-close" id="dc-close" aria-label="Close menu">&times;</button></div>' +
        '<div class="dc-home-row">' +
          '<a class="dc-home" href="../">Index</a>' +
          '<div class="dc-meta">' +
            '<a class="dc-ext" href="' + REPO_URL + '" target="_blank" rel="noopener">Repository</a>' +
          '</div>' +
        '</div>' +
        '<ul class="dc-list">' + rows + '</ul>' +
      '</nav>';

    document.body.appendChild(root);

    var menu  = root.querySelector('#dc-menu');
    function open()  { root.classList.add('open');  menu.hidden = false; root.querySelector('#dc-toggle').setAttribute('aria-expanded', 'true'); }
    function close() { root.classList.remove('open'); root.querySelector('#dc-toggle').setAttribute('aria-expanded', 'false'); }

    root.querySelector('#dc-toggle').addEventListener('click', open);
    root.querySelector('#dc-close').addEventListener('click', close);
    root.querySelector('#dc-scrim').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('open')) { close(); e.stopPropagation(); }
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
