/* dropout-net.js — a small fully-connected network that illustrates dropout.
 * Self-registers as <dropout-net>. Vanilla JS + SVG, house style.
 * On each training pass a random ~30% of the hidden neurons are switched off
 * (dimmed, their connections faded); the mask changes every pass so the network
 * can never lean on one neuron. Every sixth frame restores all neurons to show
 * that at test time the whole network is active. Unlike the one-shot house
 * visuals (neuron-flow, network-flow), this one loops gently: dropout is a
 * repeated, stochastic process, so a calm cycle conveys it better than a single
 * pass. Replay button restarts the cycle. */
(function () {
  if (customElements.get('dropout-net')) return;

  const BLUE = '#3b56d8', INK = '#15161d', RED = '#c0392b', MUT = '#6b6f80', FAINT = '#9da0b0';
  const SVGNS = 'http://www.w3.org/2000/svg';

  const VW = 1120, VH = 600;
  const IX = 150, H1X = 430, H2X = 700, OX = 970;
  const IY = [200, 300, 400];
  const H1Y = [110, 205, 300, 395, 490];
  const H2Y = [110, 205, 300, 395, 490];
  const OY = [300];
  const R = 26;
  const DROP_P = 0.3;            // fraction of hidden neurons switched off per pass
  const CYCLE = 6;              // frames per cycle; the last frame is the test-time view
  const STEP = 950;             // ms each frame holds

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

  class DropoutNet extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));

      const svg = el('svg', { viewBox: `108 78 916 524`, preserveAspectRatio: 'xMidYMid meet' });
      const gLines = el('g', {}); const gNodes = el('g', {});
      svg.appendChild(gLines); svg.appendChild(gNodes);
      root.appendChild(svg);

      // hidden neurons are the droppable set; index them so a mask can address them
      this._hidden = [];           // {circ, halo, x, y, key}
      this.lines = [];            // {ln, aKey, bKey}  (keys reference droppable hidden neurons; null = always on)

      const addLine = (xa, ya, xb, yb, aKey, bKey) => {
        const ln = el('line', { x1: xa, y1: ya, x2: xb, y2: yb, stroke: '#c7cbe8', 'stroke-width': 2.5, 'stroke-opacity': 0.55 });
        gLines.appendChild(ln);
        this.lines.push({ ln, aKey, bKey });
      };

      // build connections, tagging each endpoint that is a droppable hidden neuron
      IY.forEach((iy) => H1Y.forEach((hy, j) => addLine(IX, iy, H1X, hy, null, 'h1:' + j)));
      H1Y.forEach((ay, a) => H2Y.forEach((by, b) => addLine(H1X, ay, H2X, by, 'h1:' + a, 'h2:' + b)));
      H2Y.forEach((hy, j) => OY.forEach((oy) => addLine(H2X, hy, OX, oy, 'h2:' + j, null)));

      const addNode = (x, y, kind, key) => {
        const halo = el('circle', { cx: x, cy: y, r: R + 14, fill: BLUE, opacity: 0 });
        let circ;
        if (kind === 'in') circ = el('circle', { cx: x, cy: y, r: R, fill: BLUE });
        else if (kind === 'hidden') circ = el('circle', { cx: x, cy: y, r: R, fill: '#fff', stroke: INK, 'stroke-width': 3 });
        else circ = el('circle', { cx: x, cy: y, r: R, fill: RED });
        gNodes.appendChild(halo); gNodes.appendChild(circ);
        if (kind === 'hidden') this._hidden.push({ circ, halo, key });
      };
      IY.forEach((y) => addNode(IX, y, 'in'));
      H1Y.forEach((y, j) => addNode(H1X, y, 'hidden', 'h1:' + j));
      H2Y.forEach((y, j) => addNode(H2X, y, 'hidden', 'h2:' + j));
      OY.forEach((y) => addNode(OX, y, 'out'));

      // column labels
      const label = (x, top, sub) => {
        const t1 = el('text', { x, y: 552, 'text-anchor': 'middle', fill: MUT, 'font-family': "'IBM Plex Mono', monospace", 'font-size': 26, 'font-weight': 500 });
        t1.textContent = top;
        const t2 = el('text', { x, y: 586, 'text-anchor': 'middle', fill: FAINT, 'font-family': "'IBM Plex Sans', sans-serif", 'font-size': 24, 'font-weight': 400 });
        t2.textContent = sub;
        gNodes.appendChild(t1); gNodes.appendChild(t2);
      };
      label(IX, 'inputs', 'the features');
      label(H1X, 'hidden 1', '');
      label(H2X, 'hidden 2', '');
      label(OX, 'output', 'phishing score');

      const replay = () => {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._frame = 0;
        this.tick();
        this._timer = setInterval(() => this.tick(), STEP);
      };
      replay();

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => {
          es.forEach((e) => { if (e.isIntersecting) replay(); });
        }, { threshold: 0.4 });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      if (this._timer) clearInterval(this._timer);
      if (this._io) this._io.disconnect();
    }

    tick() {
      const testFrame = (this._frame % CYCLE) === (CYCLE - 1);
      const dropped = {};
      if (!testFrame) {
        // fresh random mask each pass; guarantee at least one drop so the effect reads
        this._hidden.forEach((n) => { dropped[n.key] = Math.random() < DROP_P; });
        if (!Object.values(dropped).some(Boolean)) {
          const k = this._hidden[Math.floor(Math.random() * this._hidden.length)].key;
          dropped[k] = true;
        }
      }

      this._hidden.forEach((n) => {
        const off = !testFrame && dropped[n.key];
        if (off) {
          n.circ.setAttribute('fill', '#9498ab');
          n.circ.setAttribute('stroke', '#9498ab');
          n.circ.setAttribute('opacity', 1);
        } else {
          n.circ.setAttribute('fill', '#fff');
          n.circ.setAttribute('stroke', INK);
          n.circ.setAttribute('opacity', 1);
        }
        n.halo.setAttribute('opacity', testFrame ? 0.12 : 0);
      });
      this.lines.forEach((L) => {
        const off = !testFrame && ((L.aKey && dropped[L.aKey]) || (L.bKey && dropped[L.bKey]));
        L.ln.setAttribute('stroke-opacity', off ? 0.05 : 0.55);
      });

      this._frame += 1;
    }
  }
  customElements.define('dropout-net', DropoutNet);
})();
