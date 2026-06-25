/* vector-average.js — turning several word vectors into one email vector. Three
 * word points sit on the map; lines reach in to their average, and a dark point,
 * the email's center of gravity, grows where they meet. Self-registers as
 * <vector-average>. Vanilla JS + SVG, house style. Loops gently with a hold on
 * the final frame; no replay button. */
(function () {
  if (customElements.get('vector-average')) return;

  const BLUE = '#3b56d8', INK = '#15161d', RED = '#c0392b', MUT = '#6b6f80';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const VW = 1000, VH = 500, DUR = 2600, HOLD = 1600, CYCLE = DUR + HOLD;
  const WORDS = [
    { name: 'verify', x: 250, y: 170, c: RED },
    { name: 'your', x: 360, y: 380, c: BLUE },
    { name: 'account', x: 700, y: 250, c: BLUE },
  ];
  const CX = WORDS.reduce((s, w) => s + w.x, 0) / WORDS.length;
  const CY = WORDS.reduce((s, w) => s + w.y, 0) / WORDS.length;

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

  class VectorAverage extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));

      const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid meet' });
      this._gLines = el('g', {});
      const gPts = el('g', {});
      svg.appendChild(this._gLines); svg.appendChild(gPts);
      root.appendChild(svg);

      // word points + labels (static)
      WORDS.forEach((w) => {
        gPts.appendChild(el('circle', { cx: w.x, cy: w.y, r: 12, fill: w.c }));
        const lab = el('text', { x: w.x, y: w.y - 22, 'text-anchor': 'middle', 'font-family': "'IBM Plex Sans', sans-serif", 'font-size': 30, 'font-weight': 600, fill: w.c });
        lab.textContent = w.name;
        gPts.appendChild(lab);
      });

      // centroid point + label (grown during the animation)
      this._cdot = el('circle', { cx: CX, cy: CY, r: 0, fill: INK });
      this._clab = el('text', { x: CX, y: CY + 44, 'text-anchor': 'middle', 'font-family': "'IBM Plex Mono', monospace", 'font-size': 26, 'font-weight': 600, fill: INK, opacity: 0 });
      this._clab.textContent = 'email vector';
      gPts.appendChild(this._cdot); gPts.appendChild(this._clab);

      this.loop = this.loop.bind(this);
      this._start = performance.now();
      this._raf = requestAnimationFrame(this.loop);

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => {
          es.forEach((e) => { if (e.isIntersecting && !this._raf) { this._start = performance.now(); this._raf = requestAnimationFrame(this.loop); } });
        }, { threshold: 0.4 });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._io) this._io.disconnect();
    }

    loop(now) {
      let elapsed = now - this._start;
      if (elapsed > CYCLE) { this._start = now; elapsed = 0; }
      const t = clamp(elapsed / DUR, 0, 1);
      const p = ease(t);
      while (this._gLines.firstChild) this._gLines.removeChild(this._gLines.firstChild);
      // each word reaches a line toward the centroid
      WORDS.forEach((w) => {
        const ex = lerp(w.x, CX, p), ey = lerp(w.y, CY, p);
        this._gLines.appendChild(el('line', { x1: w.x, y1: w.y, x2: ex, y2: ey, stroke: w.c, 'stroke-width': 2.5, 'stroke-opacity': 0.5, 'stroke-dasharray': '5 6' }));
      });
      this._cdot.setAttribute('r', (13 * p).toFixed(1));
      this._clab.setAttribute('opacity', clamp((p - 0.6) * 2.5, 0, 1).toFixed(2));
      this._raf = requestAnimationFrame(this.loop);
    }
  }
  customElements.define('vector-average', VectorAverage);
})();
