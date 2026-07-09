/* rnn-unroll.js — the recurrent cell, rolled then unrolled across time.
 * Self-registers as <rnn-unroll>. Vanilla JS + SVG, house style.
 * Frame 0 shows one cell with a feedback loop (the rolled view); frames 1..4
 * unroll it into a chain of the SAME cell, an input arriving at each step and
 * the memory passing forward; the chain holds, then collapses back to the loop.
 * Loops on its own, no replay button (like conv-scan / dropout-net). Honors
 * prefers-reduced-motion by rendering the finished chain statically. */
(function () {
  if (customElements.get('rnn-unroll')) return;

  const BLUE = '#3b56d8', INK = '#15161d', MUT = '#6b6f80', BG = '#f6f6f4';
  const SVGNS = 'http://www.w3.org/2000/svg';

  const N = 4;                       // steps in the unrolled chain
  const CW = 128, CH = 84;           // cell box
  const X0 = 96, PITCH = 210, CY = 96; // first cell x, spacing, cell top y
  const MIDY = CY + CH / 2;           // memory-arrow height
  const STEP = 1350;                  // ms per frame

  function el(name, attrs) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const cx = (i) => X0 + i * PITCH;   // cell left x

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host { display:flex; align-items:center; justify-content:center; width:100%; height:100%;
              font-family:'IBM Plex Sans',sans-serif; }
      svg { width:100%; height:100%; max-height:100%; display:block; overflow:visible; }
      .fade { transition: opacity .65s ease; }
      .ring { transition: transform .7s cubic-bezier(.4,0,.2,1), opacity .5s ease; }
      text { font-family:'IBM Plex Mono', monospace; }
    </style>`;

  class RnnUnroll extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));
      const svg = el('svg', { viewBox: '0 0 940 340', preserveAspectRatio: 'xMidYMid meet' });
      root.appendChild(svg);

      // arrowheads
      const defs = el('defs', {});
      const mk = (id, color) => {
        const m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' });
        m.appendChild(el('path', { d: 'M0 0 L10 5 L0 10 z', fill: color }));
        return m;
      };
      defs.appendChild(mk('rn-head', MUT));
      defs.appendChild(mk('rn-head-b', BLUE));
      svg.appendChild(defs);

      this._cells = []; this._inArr = []; this._inLab = []; this._mem = []; this._memLab = [];

      // memory arrows between consecutive cells
      const digits = '₁₂₃₄';   // subscript 1-4
      for (let i = 0; i < N - 1; i++) {
        const a = el('line', { x1: cx(i) + CW, y1: MIDY, x2: cx(i + 1), y2: MIDY, stroke: BLUE, 'stroke-width': 3, 'marker-end': 'url(#rn-head-b)', opacity: 0, class: 'fade' });
        svg.appendChild(a); this._mem.push(a);
        const t = el('text', { x: (cx(i) + CW + cx(i + 1)) / 2, y: MIDY - 14, 'text-anchor': 'middle', fill: BLUE, 'font-size': 22, 'font-weight': 600, opacity: 0, class: 'fade' });
        t.textContent = 'h' + digits[i];
        svg.appendChild(t); this._memLab.push(t);
      }

      // cells with their input arrows
      for (let i = 0; i < N; i++) {
        const inA = el('line', { x1: cx(i) + CW / 2, y1: CY + CH + 70, x2: cx(i) + CW / 2, y2: CY + CH + 6, stroke: MUT, 'stroke-width': 3, 'marker-end': 'url(#rn-head)', opacity: 0, class: 'fade' });
        svg.appendChild(inA); this._inArr.push(inA);
        const inL = el('text', { x: cx(i) + CW / 2, y: CY + CH + 98, 'text-anchor': 'middle', fill: MUT, 'font-size': 22, 'font-weight': 500, opacity: 0, class: 'fade' });
        inL.textContent = 'x' + digits[i];
        svg.appendChild(inL); this._inLab.push(inL);

        const g = el('g', { opacity: 0, class: 'fade' });
        g.appendChild(el('rect', { x: cx(i), y: CY, width: CW, height: CH, rx: 14, fill: BG }));
        const ct = el('text', { x: cx(i) + CW / 2, y: CY + CH / 2 + 10, 'text-anchor': 'middle', fill: INK, 'font-size': 28, 'font-weight': 600 });
        ct.textContent = 'cell';
        g.appendChild(ct);
        svg.appendChild(g); this._cells.push(g);
      }

      // self-loop on cell 0 (the rolled view)
      this._loop = el('g', { class: 'fade', opacity: 0 });
      const lx = cx(0);
      this._loop.appendChild(el('path', { d: `M ${lx + CW - 22} ${CY} C ${lx + CW + 64} ${CY - 88}, ${lx - 64} ${CY - 88}, ${lx + 22} ${CY}`, fill: 'none', stroke: BLUE, 'stroke-width': 3, 'marker-end': 'url(#rn-head-b)' }));
      svg.appendChild(this._loop);

      // active-step ring (a <g> we translate, like conv-scan's window)
      this._ringG = el('g', { class: 'ring', opacity: 0 });
      this._ringG.appendChild(el('rect', { x: cx(0) - 6, y: CY - 6, width: CW + 12, height: CH + 12, rx: 18, fill: 'none', stroke: BLUE, 'stroke-width': 3 }));
      svg.appendChild(this._ringG);

      // captions (cross-faded)
      this._capA = el('text', { x: 470, y: 324, 'text-anchor': 'middle', fill: MUT, 'font-size': 24, 'font-weight': 500, class: 'fade', opacity: 0 });
      this._capA.textContent = 'one cell, its memory looping back';
      svg.appendChild(this._capA);
      this._capB = el('text', { x: 470, y: 324, 'text-anchor': 'middle', fill: MUT, 'font-size': 24, 'font-weight': 500, class: 'fade', opacity: 0 });
      this._capB.textContent = 'the same cell, reused at every step';
      svg.appendChild(this._capB);

      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { this._static(); return; }

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

    _show(node, on) { node.style.opacity = on ? 1 : 0; }
    _ringTo(i) { this._ringG.style.transform = `translateX(${i * PITCH}px)`; }

    _static() {   // finished chain, no motion
      for (let i = 0; i < N; i++) { this._show(this._cells[i], 1); this._show(this._inArr[i], 1); this._show(this._inLab[i], 1); }
      for (let i = 0; i < N - 1; i++) { this._show(this._mem[i], 1); this._show(this._memLab[i], 1); }
      this._show(this._capB, 1); this._show(this._loop, 0); this._show(this._ringG, 0);
    }

    _reset() {   // back to the single rolled cell
      for (let i = 0; i < N; i++) { this._show(this._cells[i], i === 0 ? 1 : 0); this._show(this._inArr[i], 0); this._show(this._inLab[i], 0); }
      for (let i = 0; i < N - 1; i++) { this._show(this._mem[i], 0); this._show(this._memLab[i], 0); }
      this._show(this._loop, 1); this._show(this._capA, 1); this._show(this._capB, 0);
      this._ringTo(0); this._show(this._ringG, 1);
    }

    _start() {
      if (this._timer) clearInterval(this._timer);
      this._frame = 0; this._tick();
      this._timer = setInterval(() => this._tick(), STEP);
    }
    _tick() {
      const f = this._frame;   // 0 rolled, 1..N unroll steps, N+1..N+2 hold
      if (f === 0) { this._reset(); }
      else if (f >= 1 && f <= N) {
        const i = f - 1;
        this._show(this._loop, 0); this._show(this._capA, 0); this._show(this._capB, 1);
        this._show(this._cells[i], 1); this._show(this._inArr[i], 1); this._show(this._inLab[i], 1);
        if (i > 0) { this._show(this._mem[i - 1], 1); this._show(this._memLab[i - 1], 1); }
        this._ringTo(i); this._show(this._ringG, 1);
      } else if (f === N + 1) {
        this._show(this._ringG, 0);   // hold the full chain, drop the ring
      }
      this._frame = (f + 1) % (N + 3);
    }
  }
  customElements.define('rnn-unroll', RnnUnroll);
})();
