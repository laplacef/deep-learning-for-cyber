/* network-flow.js — a fully-connected network diagram with a play-once,
 * one-way "forward pulse". Self-registers as <network-flow>. Vanilla JS + SVG.
 * Shows every input wired to every hidden neuron, every hidden to the output,
 * then a signal sweeps left -> right once (never back) to embody "feedforward".
 * Plays once on arrival; replay button; no auto-loop. */
(function () {
  if (customElements.get('network-flow')) return;

  const BLUE = '#3b56d8', INK = '#15161d', RED = '#c0392b', MUT = '#6b6f80', FAINT = '#9da0b0';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const VW = 1120, VH = 600;
  const IX = 120, H1X = 413, H2X = 707, OX = 1000;
  const IY = [180, 300, 420];
  const H1Y = [120, 240, 360, 480];
  const H2Y = [180, 300, 420];
  const OY = [300];
  const R = 30;
  const DUR = 3800;

  const GREY = [215, 217, 224], BLU = [59, 86, 216];
  const mix = (p) => {
    const c = GREY.map((v, i) => Math.round(lerp(v, BLU[i], p)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

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
      .replay { position:absolute; top:6px; right:6px; border:1px solid #e3e3e8; background:#fff; color:${MUT};
                border-radius:999px; padding:9px 18px; font:600 19px 'IBM Plex Sans',sans-serif; cursor:pointer; }
      .replay:hover { color:${INK}; border-color:#c9cad2; }
    </style>
    <button class="replay" id="replay">↻ replay</button>`;

  class NetworkFlow extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));

      const svg = el('svg', { viewBox: `0 0 ${VW} ${VH}`, preserveAspectRatio: 'xMidYMid meet' });
      const gLines = el('g', {}); const gDots = el('g', {}); const gNodes = el('g', {});
      svg.appendChild(gLines); svg.appendChild(gDots); svg.appendChild(gNodes);
      root.appendChild(svg);

      // connections: every input -> every hidden, every hidden -> output
      this.lines = [];
      const addLine = (xa, ya, xb, yb) => {
        const ln = el('line', { x1: xa, y1: ya, x2: xb, y2: yb, stroke: mix(0), 'stroke-width': 2.5, 'stroke-opacity': 0.5 });
        const dot = el('circle', { r: 7, fill: BLUE, opacity: 0 });
        gLines.appendChild(ln); gDots.appendChild(dot);
        this.lines.push({ ln, dot, xa, ya, xb, yb });
      };
      IY.forEach((iy) => H1Y.forEach((hy) => addLine(IX, iy, H1X, hy)));
      H1Y.forEach((ay) => H2Y.forEach((by) => addLine(H1X, ay, H2X, by)));
      H2Y.forEach((hy) => OY.forEach((oy) => addLine(H2X, hy, OX, oy)));

      // nodes (halo + circle) + labels
      this.nodes = [];
      const addNode = (x, y, kind) => {
        const halo = el('circle', { cx: x, cy: y, r: R + 16, fill: kind === 'out' ? RED : BLUE, opacity: 0 });
        let circ;
        if (kind === 'in') circ = el('circle', { cx: x, cy: y, r: R, fill: BLUE });
        else if (kind === 'hidden') circ = el('circle', { cx: x, cy: y, r: R, fill: '#fff', stroke: INK, 'stroke-width': 3 });
        else circ = el('circle', { cx: x, cy: y, r: R, fill: RED });
        gNodes.insertBefore(halo, gNodes.firstChild);
        gNodes.appendChild(circ);
        this.nodes.push({ halo, x });
      };
      IY.forEach((y) => addNode(IX, y, 'in'));
      H1Y.forEach((y) => addNode(H1X, y, 'hidden'));
      H2Y.forEach((y) => addNode(H2X, y, 'hidden'));
      OY.forEach((y) => addNode(OX, y, 'out'));

      // column labels
      const label = (x, top, sub) => {
        const t1 = el('text', { x, y: 548, 'text-anchor': 'middle', fill: MUT, 'font-family': "'IBM Plex Mono', monospace", 'font-size': 26, 'font-weight': 500 });
        t1.textContent = top;
        const t2 = el('text', { x, y: 582, 'text-anchor': 'middle', fill: FAINT, 'font-family': "'IBM Plex Sans', sans-serif", 'font-size': 24, 'font-weight': 400 });
        t2.textContent = sub;
        gNodes.appendChild(t1); gNodes.appendChild(t2);
      };
      label(IX, 'inputs', 'the features');
      label(H1X, 'hidden 1', 'simple patterns');
      label(H2X, 'hidden 2', 'bigger ideas');
      label(OX, 'output', 'the phishing score');

      this.loop = this.loop.bind(this);
      const replay = () => { this.start = performance.now(); if (!this._raf) this._raf = requestAnimationFrame(this.loop); };
      root.getElementById('replay').addEventListener('click', replay);
      this.start = performance.now();
      this._raf = requestAnimationFrame(this.loop);

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => {
          es.forEach((e) => { if (e.isIntersecting) replay(); });
        }, { threshold: 0.4 });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._io) this._io.disconnect();
    }

    loop(now) {
      const t = now - this.start;
      const p = ease(clamp(t / DUR, 0, 1));
      const frontX = lerp(40, 1080, p);
      this.render(frontX);
      if (t >= DUR) { this._raf = null; return; }   // play once, hold final
      this._raf = requestAnimationFrame(this.loop);
    }

    render(frontX) {
      for (const L of this.lines) {
        const p = clamp((frontX - L.xa) / (L.xb - L.xa), 0, 1);
        L.ln.setAttribute('stroke', mix(p));
        L.ln.setAttribute('stroke-opacity', (0.5 + 0.45 * p).toFixed(2));
        if (p > 0.02 && p < 0.98) {
          L.dot.setAttribute('opacity', 1);
          L.dot.setAttribute('cx', lerp(L.xa, L.xb, p).toFixed(1));
          L.dot.setAttribute('cy', lerp(L.ya, L.yb, p).toFixed(1));
        } else {
          L.dot.setAttribute('opacity', 0);
        }
      }
      for (const N of this.nodes) {
        const bump = Math.exp(-Math.pow((frontX - N.x) / 95, 2));
        N.halo.setAttribute('opacity', (bump * 0.28).toFixed(3));
      }
    }
  }
  customElements.define('network-flow', NetworkFlow);
})();
