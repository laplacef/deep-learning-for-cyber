/* analogy-vectors.js — why king - man + woman ≈ queen, shown as geometry.
 * Four words sit at the corners of a parallelogram. The arrow from "man" to
 * "woman" is one "step". That same arrow is then lifted up and placed on "king":
 * it lands exactly on "queen". So the step that turns man into woman also turns
 * king into queen, which is what the analogy means. Self-registers as
 * <analogy-vectors>. Vanilla JS + SVG, house style. Loops gently with a pause on
 * the final frame; no replay button. */
(function () {
  if (customElements.get('analogy-vectors')) return;

  const BLUE = '#3b56d8', INK = '#15161d', RED = '#c0392b', MUT = '#6b6f80', GUIDE = '#cfd0d6';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const VW = 1000, VH = 520, DUR = 4200, HOLD = 2200, CYCLE = DUR + HOLD;
  // a parallelogram: man->woman is the same displacement as king->queen
  const man =   { x: 285, y: 415 };
  const woman = { x: 705, y: 365 };
  const king =  { x: 285, y: 185 };
  const queen = { x: 705, y: 135 };

  function el(name, attrs) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const pt = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host { display:flex; align-items:center; justify-content:center; width:100%; height:100%;
              font-family:'IBM Plex Sans',sans-serif; position:relative; }
      svg { width:100%; height:100%; max-height:100%; display:block; overflow:visible; }
    </style>`;

  class AnalogyVectors extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));

      const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid meet' });
      this._gDyn = el('g', {});            // arrows + guides, redrawn each frame
      const gPts = el('g', {});            // static points + labels
      svg.appendChild(this._gDyn); svg.appendChild(gPts);
      root.appendChild(svg);

      // caption explaining the takeaway
      const cap = el('text', { x: VW / 2, y: 52, 'text-anchor': 'middle', fill: INK, 'font-family': "'IBM Plex Sans', sans-serif", 'font-size': 30, 'font-weight': 600 });
      cap.textContent = 'the step from man to woman also turns king into queen';
      gPts.appendChild(cap);

      // four corner points
      this._queenDot = null;
      const addPt = (p, name, color) => {
        const dot = el('circle', { cx: p.x, cy: p.y, r: 13, fill: color });
        const below = name === 'man' || name === 'woman';
        const lab = el('text', { x: p.x, y: p.y + (below ? 44 : -26), 'text-anchor': 'middle', 'font-family': "'IBM Plex Sans', sans-serif", 'font-size': 32, 'font-weight': 600, fill: color });
        lab.textContent = name;
        gPts.appendChild(dot); gPts.appendChild(lab);
        if (name === 'queen') this._queenDot = dot;
        return dot;
      };
      addPt(man, 'man', MUT); addPt(woman, 'woman', MUT);
      addPt(king, 'king', BLUE); addPt(queen, 'queen', BLUE);

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

    arrow(from, to, color, opacity, label) {
      this._gDyn.appendChild(el('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round', opacity }));
      const ang = Math.atan2(to.y - from.y, to.x - from.x), a = 18, w = 0.45;
      const head = `${to.x},${to.y} ${to.x - a * Math.cos(ang - w)},${to.y - a * Math.sin(ang - w)} ${to.x - a * Math.cos(ang + w)},${to.y - a * Math.sin(ang + w)}`;
      this._gDyn.appendChild(el('polygon', { points: head, fill: color, opacity }));
      if (label) {
        const t = el('text', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + 40, 'text-anchor': 'middle', 'font-family': "'IBM Plex Mono', monospace", 'font-size': 23, 'font-weight': 600, fill: color, opacity });
        t.textContent = label;
        this._gDyn.appendChild(t);
      }
    }
    guide(from, to) {
      this._gDyn.appendChild(el('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: GUIDE, 'stroke-width': 2, 'stroke-dasharray': '5 7' }));
    }

    loop(now) {
      let elapsed = now - this._start;
      if (elapsed > CYCLE) { this._start = now; elapsed = 0; }
      const p = clamp(elapsed / DUR, 0, 1);
      while (this._gDyn.firstChild) this._gDyn.removeChild(this._gDyn.firstChild);

      // Phase A (0 - 0.32): grow the man -> woman arrow.
      const a = clamp(p / 0.32, 0, 1);
      // Phase C (0.45 - 0.85): lift a copy of that arrow up onto king; it ends at queen.
      const c = clamp((p - 0.45) / 0.40, 0, 1);

      // faint guides showing the lift, fading in with c
      if (c > 0) { this.guide(man, pt(man, king, ease(c))); this.guide(woman, pt(woman, queen, ease(c))); }

      // the reference step, man -> woman (stays once drawn)
      if (a > 0) this.arrow(man, pt(man, woman, ease(a)), RED, 1, a > 0.7 ? 'man → woman' : null);

      // the same arrow, translated; tail man->king, head woman->queen
      if (c > 0) {
        const tail = pt(man, king, ease(c)), head = pt(woman, queen, ease(c));
        this.arrow(tail, head, RED, 1, c > 0.85 ? 'king → queen' : null);
      }

      // emphasize queen as the lifted arrow lands
      const qp = clamp((p - 0.82) / 0.18, 0, 1);
      if (this._queenDot) this._queenDot.setAttribute('r', (13 + 7 * qp).toFixed(1));

      this._raf = requestAnimationFrame(this.loop);
    }
  }
  customElements.define('analogy-vectors', AnalogyVectors);
})();
