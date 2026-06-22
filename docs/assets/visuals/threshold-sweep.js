/* threshold-sweep.js — two score distributions (legitimate mail near 0,
 * phishing near 1) with a decision cutoff that sweeps across the axis. The area
 * of phishing left of the cutoff is shaded as false negatives (missed attacks);
 * the area of legitimate mail right of the cutoff is shaded as false positives
 * (false alarms). Moving the cutoff trades one error for the other. Self-registers
 * as <threshold-sweep>. Vanilla JS + canvas, house style. Plays once on arrival;
 * replay button; no auto-loop. */
(function () {
  if (customElements.get('threshold-sweep')) return;

  const INK = '#15161d', BLUE = '#3b56d8', RED = '#c0392b', MUT = '#6b6f80', GRID = '#e3e3e8';
  const CW = 1040, CH = 470, DPR = 2;
  const DUR = 5200;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // unnormalised gaussians for the two classes
  const safe = (x) => Math.exp(-Math.pow(x - 0.30, 2) / (2 * 0.130 * 0.130));
  const phish = (x) => Math.exp(-Math.pow(x - 0.72, 2) / (2 * 0.120 * 0.120));

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host { display:flex; align-items:center; justify-content:center; width:100%; height:100%;
              font-family:'IBM Plex Sans',sans-serif; position:relative; }
      canvas { width:100%; height:100%; display:block; object-fit:contain; }
      .replay { position:absolute; top:6px; right:6px; border:1px solid #e3e3e8; background:#fff; color:${MUT};
                border-radius:999px; padding:9px 18px; font:600 19px 'IBM Plex Sans',sans-serif; cursor:pointer; }
      .replay:hover { color:${INK}; border-color:#c9cad2; }
    </style>
    <button class="replay" id="replay">↻ replay</button>`;

  class ThresholdSweep extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));
      this.canvas = document.createElement('canvas');
      this.canvas.width = CW * DPR; this.canvas.height = CH * DPR;
      root.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.loop = this.loop.bind(this);
      const replay = () => { this.start = performance.now(); if (!this._raf) this._raf = requestAnimationFrame(this.loop); };
      root.getElementById('replay').addEventListener('click', replay);
      replay();

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
      const t = clamp((now - this.start) / DUR, 0, 1);
      // sweep low -> high -> settle at 0.5
      let xc;
      if (t < 0.4) xc = lerp(0.20, 0.82, ease(t / 0.4));
      else if (t < 0.7) xc = lerp(0.82, 0.50, ease((t - 0.4) / 0.3));
      else xc = 0.50;
      this.draw(xc);
      if (t >= 1) { this._raf = null; return; }
      this._raf = requestAnimationFrame(this.loop);
    }

    draw(xc) {
      const ctx = this.ctx;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, CW, CH);
      const padX = 56, padTop = 64, padBot = 66;
      const x0 = padX, x1 = CW - padX, yBase = CH - padBot, yTop = padTop;
      const sx = (v) => lerp(x0, x1, v);                 // score 0..1 -> px
      const sy = (h) => lerp(yBase, yTop, h);            // height 0..1 -> px
      const xcPx = sx(xc);

      // filled area under a class curve, restricted to [a,b] in score space
      const fillBand = (fn, a, b, color) => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(sx(a), yBase);
        const N = 120;
        for (let i = 0; i <= N; i++) { const v = lerp(a, b, i / N); ctx.lineTo(sx(v), sy(fn(v))); }
        ctx.lineTo(sx(b), yBase); ctx.closePath(); ctx.fill();
      };
      const stroke = (fn, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath();
        const N = 200;
        for (let i = 0; i <= N; i++) { const v = i / N; const px = sx(v), py = sy(fn(v)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
      };

      // baseline
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, yBase); ctx.lineTo(x1, yBase); ctx.stroke();

      // faint full curves
      ctx.globalAlpha = 0.10; fillBand(safe, 0, 1, BLUE); fillBand(phish, 0, 1, RED); ctx.globalAlpha = 1;

      // error regions: phishing left of cutoff (false negatives), safe right of cutoff (false positives)
      ctx.globalAlpha = 0.30; fillBand(phish, 0, xc, RED); ctx.globalAlpha = 0.28; fillBand(safe, xc, 1, BLUE); ctx.globalAlpha = 1;

      stroke(safe, BLUE); stroke(phish, RED);

      // cutoff line
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.moveTo(xcPx, yTop - 18); ctx.lineTo(xcPx, yBase); ctx.stroke(); ctx.setLineDash([]);

      // labels
      ctx.textAlign = 'center';
      ctx.fillStyle = BLUE; ctx.font = "600 26px 'IBM Plex Sans', sans-serif";
      ctx.fillText('legitimate mail', sx(0.30), sy(safe(0.30)) - 16);
      ctx.fillStyle = RED;
      ctx.fillText('phishing', sx(0.72), sy(phish(0.72)) - 16);

      // short static tag at the top of the line (no moving number, to avoid colliding
      // with the class labels as the line sweeps under them)
      ctx.fillStyle = INK; ctx.font = "600 22px 'IBM Plex Mono', monospace";
      ctx.fillText('cutoff', xcPx, yTop - 34);

      // region annotations
      ctx.font = "500 21px 'IBM Plex Sans', sans-serif";
      if (xc > 0.34) { ctx.fillStyle = RED; ctx.fillText('false negatives', sx(clamp(xc - 0.08, 0.46, 0.66)), yBase + 30); }
      if (xc < 0.68) { ctx.fillStyle = BLUE; ctx.fillText('false positives', sx(clamp(xc + 0.08, 0.34, 0.56)), yBase + 56); }

      // axis ends
      ctx.fillStyle = MUT; ctx.font = "400 20px 'IBM Plex Mono', monospace";
      ctx.textAlign = 'left'; ctx.fillText('score 0', x0, yBase + 30);
      ctx.textAlign = 'right'; ctx.fillText('1', x1, yBase + 30);
    }
  }
  customElements.define('threshold-sweep', ThresholdSweep);
})();
