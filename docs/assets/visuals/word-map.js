/* word-map.js — a play-once animation that shows why embeddings matter.
 * Self-registers as <word-map>. Vanilla JS + DOM (shadow). Not interactive.
 *
 * Words start scattered at random ("just IDs — position means nothing") and
 * ease into meaning-based clusters ("learned embedding — meaning becomes
 * distance"). One synonym pair (verify / confirm) is joined by a dashed line
 * and a live "similarity" chip that climbs as the two words drift together.
 * Plays once on arrival; ↻ replay re-runs it. House style: IBM Plex, blue
 * #3b56d8 / red #c0392b / ink, white map with a faint dotted grid. */
(function () {
  if (customElements.get('word-map')) return;

  const INK = '#15161d', MUT = '#6b6f80', BLUE = '#3b56d8', RED = '#c0392b';
  const GRID = '#e9e9ee', LINE = '#cfd0d6';
  const DUR = 3600;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Target positions in normalized [0,1] space, grouped into three meaning
  // clusters. col = dot/label color. lab = which side to draw the label.
  const WORDS = [
    // money / account  (blue, upper-left)
    { t: 'invoice',  x: 0.15, y: 0.30, col: BLUE, lab: 'r' },
    { t: 'payment',  x: 0.24, y: 0.20, col: BLUE, lab: 'r' },
    { t: 'account',  x: 0.27, y: 0.40, col: BLUE, lab: 'r' },
    { t: 'wire',     x: 0.12, y: 0.46, col: BLUE, lab: 'r' },
    // phishing action / credential  (red, center-top)
    { t: 'urgent',   x: 0.50, y: 0.16, col: RED,  lab: 'r' },
    { t: 'verify',   x: 0.57, y: 0.30, col: RED,  lab: 'r', pair: 1 },
    { t: 'confirm',  x: 0.50, y: 0.37, col: RED,  lab: 'l', pair: 1 },
    { t: 'password', x: 0.66, y: 0.22, col: RED,  lab: 'r' },
    { t: 'login',    x: 0.62, y: 0.44, col: RED,  lab: 'r' },
    // benign everyday  (ink/gray, lower-right)
    { t: 'lunch',    x: 0.80, y: 0.74, col: MUT,  lab: 'l' },
    { t: 'weekend',  x: 0.88, y: 0.64, col: MUT,  lab: 'l' },
    { t: 'meeting',  x: 0.72, y: 0.66, col: MUT,  lab: 'l' },
    { t: 'thanks',   x: 0.85, y: 0.82, col: MUT,  lab: 'l' },
    { t: 'coffee',   x: 0.76, y: 0.86, col: MUT,  lab: 'l' },
  ];

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host { display:block; position:relative; width:100%; height:100%;
              font-family:'IBM Plex Sans',sans-serif; }
      canvas { display:block; width:100%; height:100%; }
      .chip { position:absolute; top:16px; right:16px; background:#fff;
              border:1px solid #e3e3e8; border-radius:12px; padding:13px 18px;
              box-shadow:0 2px 14px rgba(21,22,29,.06); min-width:230px; }
      .chip .k { font:500 18px 'IBM Plex Mono',monospace; color:${MUT}; }
      .chip .row { display:flex; align-items:baseline; gap:10px; margin-top:4px; }
      .chip .v { font:600 30px 'IBM Plex Mono',monospace; color:${RED}; }
      .chip .w { font:500 17px 'IBM Plex Sans',sans-serif; color:${MUT}; }
      .chip .bar { height:8px; border-radius:5px; background:#f1f1f3; margin-top:10px; overflow:hidden; }
      .chip .fill { height:100%; width:0%; background:${RED}; }
      .replay { position:absolute; bottom:14px; right:16px; border:1px solid #e3e3e8;
                background:#fff; color:${MUT}; border-radius:999px; padding:9px 18px;
                font:600 19px 'IBM Plex Sans',sans-serif; cursor:pointer; }
      .replay:hover { color:${INK}; border-color:#c9cad2; }
    </style>
    <canvas id="cv"></canvas>
    <div class="chip">
      <div class="k">verify ↔ confirm</div>
      <div class="row"><span class="v" id="sim">0.10</span><span class="w">similarity</span></div>
      <div class="bar"><div class="fill" id="fill"></div></div>
    </div>
    <button class="replay" id="replay">↻ replay</button>`;

  class WordMap extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));
      this.cv = root.getElementById('cv');
      this.ctx = this.cv.getContext('2d');
      this.simEl = root.getElementById('sim');
      this.fillEl = root.getElementById('fill');

      const rnd = mulberry32(7);
      this.nodes = WORDS.map((w) => ({
        ...w,
        sx: 0.08 + rnd() * 0.84,   // scattered start
        sy: 0.08 + rnd() * 0.84,
      }));

      this.loop = this.loop.bind(this);
      const replay = () => { this.start = performance.now(); if (!this._raf) this._raf = requestAnimationFrame(this.loop); };
      root.getElementById('replay').addEventListener('click', replay);

      this._ro = new ResizeObserver(() => { this.resize(); this.draw(this._p == null ? 0 : this._p); });
      this._ro.observe(this);
      this.resize();
      this.start = performance.now();
      this._raf = requestAnimationFrame(this.loop);

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => {
          es.forEach((e) => { if (e.isIntersecting) replay(); });
        }, { threshold: 0.35 });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._io) this._io.disconnect();
      if (this._ro) this._ro.disconnect();
    }

    resize() {
      const r = this.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(320, r.width); this.h = Math.max(200, r.height);
      this.cv.width = this.w * dpr; this.cv.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    loop(now) {
      const p = ease(clamp((now - this.start) / DUR, 0, 1));
      this.draw(p);
      if ((now - this.start) >= DUR) { this._raf = null; return; }
      this._raf = requestAnimationFrame(this.loop);
    }

    draw(p) {
      this._p = p;
      const ctx = this.ctx, W = this.w, H = this.h;
      const pad = 30;
      const PX = (nx) => pad + nx * (W - 2 * pad);
      const PY = (ny) => pad + ny * (H - 2 * pad);
      ctx.clearRect(0, 0, W, H);

      // faint dotted grid -> "a map / a space"
      ctx.fillStyle = GRID;
      const step = 46;
      for (let gx = pad; gx <= W - pad + 1; gx += step)
        for (let gy = pad; gy <= H - pad + 1; gy += step) {
          ctx.beginPath(); ctx.arc(gx, gy, 1.4, 0, 7); ctx.fill();
        }

      // current positions
      const pos = this.nodes.map((n) => ({
        n,
        x: PX(n.sx + (n.x - n.sx) * p),
        y: PY(n.sy + (n.y - n.sy) * p),
      }));

      // synonym pair connector
      const pair = pos.filter((q) => q.n.pair);
      if (pair.length === 2) {
        ctx.strokeStyle = RED; ctx.globalAlpha = 0.45; ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.moveTo(pair[0].x, pair[0].y); ctx.lineTo(pair[1].x, pair[1].y); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      // dots + labels
      ctx.font = "500 19px 'IBM Plex Sans', sans-serif";
      ctx.textBaseline = 'middle';
      pos.forEach((q) => {
        if (q.n.pair) { // halo on the highlighted pair
          ctx.fillStyle = 'rgba(192,57,43,0.13)';
          ctx.beginPath(); ctx.arc(q.x, q.y, 15, 0, 7); ctx.fill();
        }
        ctx.fillStyle = q.n.col;
        ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = INK;
        if (q.n.lab === 'l') { ctx.textAlign = 'right'; ctx.fillText(q.n.t, q.x - 13, q.y); }
        else { ctx.textAlign = 'left'; ctx.fillText(q.n.t, q.x + 13, q.y); }
      });

      // similarity readout from the pair's current distance
      if (pair.length === 2) {
        const dx = (pair[0].x - pair[1].x) / (W - 2 * pad);
        const dy = (pair[0].y - pair[1].y) / (H - 2 * pad);
        const dist = Math.hypot(dx, dy);
        const sim = clamp(1 - dist / 0.62, 0, 0.97);
        this.simEl.textContent = sim.toFixed(2);
        this.fillEl.style.width = (sim * 100) + '%';
      }
    }
  }
  customElements.define('word-map', WordMap);
})();
