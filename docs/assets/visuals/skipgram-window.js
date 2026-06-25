/* skipgram-window.js — the skip-gram training task made visible. A row of word
 * chips; a window slides along the sentence, the center word lights up, and arcs
 * connect it to the neighbors it must predict. The window advances one word per
 * step and loops, mirroring how the task sweeps billions of sentences. Self-
 * registers as <skipgram-window>. Vanilla JS + SVG, house style. Loops gently
 * (a repeated process), so no replay button. */
(function () {
  if (customElements.get('skipgram-window')) return;

  const BLUE = '#3b56d8', INK = '#15161d', MUT = '#6b6f80', FAINT = '#9da0b0', TINT = '#eef1fc';
  const SVGNS = 'http://www.w3.org/2000/svg';

  const WORDS = ['please', 'verify', 'your', 'account', 'before', 'it', 'closes'];
  const RADIUS = 2;            // predict this many neighbors on each side
  const STEP = 1150;           // ms per window position
  const VW = 1320, VH = 380;
  const CHIPY = 250, CHIPH = 70, FS = 32;

  function el(name, attrs) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host { display:flex; align-items:center; justify-content:center; width:100%; height:100%;
              font-family:'IBM Plex Sans',sans-serif; position:relative; }
      svg { width:100%; height:100%; max-height:100%; display:block; overflow:visible; }
    </style>`;

  class SkipgramWindow extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));

      const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid meet' });
      const gArcs = el('g', {}); const gWin = el('g', {}); const gChips = el('g', {});
      svg.appendChild(gWin); svg.appendChild(gArcs); svg.appendChild(gChips);
      root.appendChild(svg);

      // lay the chips out in a centered row, width estimated from text length
      const gap = 26;
      const widths = WORDS.map((w) => w.length * 17 + 46);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (WORDS.length - 1);
      let x = (VW - total) / 2;
      this._chips = WORDS.map((w, i) => {
        const cw = widths[i];
        const rect = el('rect', { x, y: CHIPY, width: cw, height: CHIPH, rx: 14, fill: '#f1f2f6', stroke: '#e3e3e8', 'stroke-width': 1.5 });
        const t = el('text', { x: x + cw / 2, y: CHIPY + CHIPH / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': "'IBM Plex Sans', sans-serif", 'font-size': FS, 'font-weight': 500, fill: INK });
        t.textContent = w;
        gChips.appendChild(rect); gChips.appendChild(t);
        const c = { rect, t, cx: x + cw / 2, left: x, right: x + cw, w: cw };
        x += cw + gap;
        return c;
      });

      // the sliding window box (drawn behind the chips)
      this._winRect = el('rect', { y: CHIPY - 26, height: CHIPH + 52, rx: 18, fill: TINT, stroke: BLUE, 'stroke-width': 2, 'stroke-opacity': 0.5 });
      gWin.appendChild(this._winRect);
      this._gArcs = gArcs;

      // caption
      this._cap = el('text', { x: VW / 2, y: 70, 'text-anchor': 'middle', fill: BLUE, 'font-family': "'IBM Plex Mono', monospace", 'font-size': 27, 'font-weight': 600 });
      this._cap.textContent = 'the center word predicts its neighbors';
      gChips.appendChild(this._cap);

      const start = () => {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._center = RADIUS;            // first center that has full context on the left
        this.tick();
        this._timer = setInterval(() => this.tick(), STEP);
      };
      start();

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => {
          es.forEach((e) => { if (e.isIntersecting) start(); });
        }, { threshold: 0.4 });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      if (this._timer) clearInterval(this._timer);
      if (this._io) this._io.disconnect();
    }

    tick() {
      const c = this._center;
      const lo = Math.max(0, c - RADIUS), hi = Math.min(WORDS.length - 1, c + RADIUS);

      // window box spans the covered chips
      const L = this._chips[lo].left - 16, R = this._chips[hi].right + 16;
      this._winRect.setAttribute('x', L);
      this._winRect.setAttribute('width', R - L);

      // color the chips by role
      this._chips.forEach((chip, i) => {
        const inWin = i >= lo && i <= hi;
        if (i === c) {
          chip.rect.setAttribute('fill', BLUE); chip.rect.setAttribute('stroke', BLUE);
          chip.t.setAttribute('fill', '#fff');
        } else if (inWin) {
          chip.rect.setAttribute('fill', '#fff'); chip.rect.setAttribute('stroke', BLUE);
          chip.t.setAttribute('fill', INK);
        } else {
          chip.rect.setAttribute('fill', '#f1f2f6'); chip.rect.setAttribute('stroke', '#e3e3e8');
          chip.t.setAttribute('fill', FAINT);
        }
      });

      // redraw arcs from the center to each neighbor in the window
      while (this._gArcs.firstChild) this._gArcs.removeChild(this._gArcs.firstChild);
      const cx = this._chips[c].cx;
      for (let i = lo; i <= hi; i++) {
        if (i === c) continue;
        const nx = this._chips[i].cx;
        const up = CHIPY - 24, peak = CHIPY - 92;
        const d = `M ${cx} ${up} Q ${(cx + nx) / 2} ${peak} ${nx} ${up}`;
        this._gArcs.appendChild(el('path', { d, fill: 'none', stroke: BLUE, 'stroke-width': 2.5, 'stroke-opacity': 0.55 }));
        this._gArcs.appendChild(el('circle', { cx: nx, cy: up, r: 5, fill: BLUE }));
      }

      this._center = c + 1 > WORDS.length - 1 - RADIUS ? RADIUS : c + 1;
    }
  }
  customElements.define('skipgram-window', SkipgramWindow);
})();
