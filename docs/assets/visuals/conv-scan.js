/* conv-scan.js — a 3x3 filter window scanning a 5x5 input image to build the
 * feature map. Self-registers as <conv-scan>. Vanilla JS + SVG, house style.
 * The geometry is exact: output = input - filter + 1, so a 5x5 image with a 3x3
 * filter yields a 3x3 feature map, and the window's start columns 0,1,2 mean its
 * last position spans columns 2,3,4 — every position is covered, 1:1 with the map.
 * As the window steps to each position the matching cell flashes accent (just
 * computed); strong-match cells settle to accent, the rest to pale. Loops gently;
 * like dropout-net it has no replay button. */
(function () {
  if (customElements.get('conv-scan')) return;

  const BLUE = '#3b56d8', MUT = '#6b6f80', TINT = '#eef1fc', EMPTY = '#f3f3f1', LINE = '#e3e3e8';
  const SVGNS = 'http://www.w3.org/2000/svg';

  const N = 5, F = 3, OUT = N - F + 1;          // 5, 3, 3
  const CELL = 50, GAP = 7, PITCH = CELL + GAP;  // input pitch 57
  const OCELL = 58, OGAP = 8, OPITCH = OCELL + OGAP; // feature-map pitch 66
  const IX = 14, IY = 46;                        // input grid origin
  const IGRIDW = N * CELL + (N - 1) * GAP;        // 278
  const OGRIDW = OUT * OCELL + (OUT - 1) * OGAP;  // 190
  const FX = 400, FY = IY + (IGRIDW - OGRIDW) / 2; // feature map, centered against input
  const WINW = F * CELL + (F - 1) * GAP;          // 164
  const STEP = 680;                              // ms per position

  // illustrative input texture (1 light, 2 mid, 3 dark)
  const PIX = [
    [1, 2, 3, 3, 2],
    [2, 3, 3, 2, 1],
    [3, 3, 1, 2, 3],
    [2, 1, 2, 3, 2],
    [1, 2, 3, 2, 1],
  ];
  const SHADE = { 1: '#e3e3e8', 2: '#9da0b0', 3: '#2b2d39' };
  const HOT = new Set(['0,1', '1,2', '2,0']); // output cells that are strong matches

  function el(name, attrs) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host { display:flex; align-items:center; justify-content:center; width:100%; height:100%;
              font-family:'IBM Plex Sans',sans-serif; }
      svg { width:100%; height:100%; max-height:100%; display:block; overflow:visible; }
      .win { transition: transform .5s cubic-bezier(.4,0,.2,1); }
      .fcell { transition: fill .35s ease; }
    </style>`;

  class ConvScan extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));

      const svg = el('svg', { viewBox: '0 0 620 340', preserveAspectRatio: 'xMidYMid meet' });
      root.appendChild(svg);

      // input image
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        svg.appendChild(el('rect', { x: IX + c * PITCH, y: IY + r * PITCH, width: CELL, height: CELL, rx: 5, fill: SHADE[PIX[r][c]] }));
      }

      // feature map cells (start empty)
      this._fcells = {};
      for (let r = 0; r < OUT; r++) for (let c = 0; c < OUT; c++) {
        const rc = el('rect', { x: FX + c * OPITCH, y: FY + r * OPITCH, width: OCELL, height: OCELL, rx: 6, fill: EMPTY, stroke: LINE, 'stroke-width': 1, class: 'fcell' });
        svg.appendChild(rc); this._fcells[r + ',' + c] = rc;
      }

      // arrow from image to feature map
      const ay = IY + IGRIDW / 2;
      svg.appendChild(el('line', { x1: 312, y1: ay, x2: 380, y2: ay, stroke: '#b9bcc8', 'stroke-width': 3 }));
      svg.appendChild(el('path', { d: `M384 ${ay} l-13 -7 l0 14 z`, fill: '#b9bcc8' }));

      // labels
      const lab = (x, txt) => {
        const t = el('text', { x, y: 28, 'text-anchor': 'middle', fill: MUT, 'font-family': "'IBM Plex Mono', monospace", 'font-size': 26, 'font-weight': 500 });
        t.textContent = txt; svg.appendChild(t);
      };
      lab(IX + IGRIDW / 2, 'image');
      lab(FX + OGRIDW / 2, 'feature map');

      // window (a <g> we translate); rect drawn with a small outset
      this._win = el('g', { class: 'win' });
      this._win.appendChild(el('rect', { x: -3, y: -3, width: WINW + 6, height: WINW + 6, rx: 8, fill: 'rgba(59,86,216,0.14)', stroke: BLUE, 'stroke-width': 3 }));
      this._win.style.transform = `translate(${IX}px, ${IY}px)`;
      svg.appendChild(this._win);

      // raster order of (row,col) window start positions
      this._order = [];
      for (let r = 0; r < OUT; r++) for (let c = 0; c < OUT; c++) this._order.push([r, c]);

      this._start();
      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) this._start(); }), { threshold: 0.4 });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      if (this._timer) clearInterval(this._timer);
      if (this._io) this._io.disconnect();
    }

    _place(r, c) { this._win.style.transform = `translate(${IX + c * PITCH}px, ${IY + r * PITCH}px)`; }
    _settle(key) { this._fcells[key].setAttribute('fill', HOT.has(key) ? BLUE : TINT); }
    _clear() { for (const k in this._fcells) this._fcells[k].setAttribute('fill', EMPTY); }

    _start() {
      if (this._timer) clearInterval(this._timer);
      this._frame = 0; this._tick();
      this._timer = setInterval(() => this._tick(), STEP);
    }
    _tick() {
      const P = this._order.length;     // 9
      const f = this._frame;
      if (f === 0) { this._clear(); this._place(0, 0); }
      if (f < P) {
        const [r, c] = this._order[f];
        this._place(r, c);
        if (f > 0) { const [pr, pc] = this._order[f - 1]; this._settle(pr + ',' + pc); }
        this._fcells[r + ',' + c].setAttribute('fill', BLUE); // active cell flashes
      } else if (f === P) {
        const [pr, pc] = this._order[P - 1]; this._settle(pr + ',' + pc); // settle the last
      }
      // frames P+1, P+2 hold the full map; wrap back to 0 clears and restarts
      this._frame = (f + 1) % (P + 3);
    }
  }
  customElements.define('conv-scan', ConvScan);
})();
