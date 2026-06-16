/* plots.js — draws the small explanatory curves (sigmoid, relu, bend, bowl,
 * squeeze, training curves) onto <canvas data-plot> elements. Ported from the
 * deck's original drawing code; no dependencies. Exposes window.__drawPlots so
 * the deck can redraw on slide change (canvases hidden at load get painted by
 * the time their slide is shown). */
(function () {
  function plot(canvas) {
    const type = canvas.dataset.plot;
    const cw = parseInt(canvas.dataset.w, 10) || 400;
    const ch = parseInt(canvas.dataset.h, 10) || 260;
    const dpr = 2;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const INK = '#15161d', BLUE = '#3b56d8', RED = '#c0392b', GRID = '#e3e3e8', MUT = '#9da0b0';
    const pad = 34;
    const x0 = pad, x1 = cw - pad, y0 = ch - pad, y1 = pad;
    const lerp = (a, b, t) => a + (b - a) * t;

    const axes = (zeroY) => {
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke(); // x
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.stroke(); // y
      if (zeroY != null) {
        ctx.strokeStyle = '#cfd0d6'; ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(x0, zeroY); ctx.lineTo(x1, zeroY); ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    const curve = (fn, dom, rng, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width || 4; ctx.lineJoin = 'round';
      ctx.beginPath();
      const N = 120;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const xv = lerp(dom[0], dom[1], t);
        const yv = fn(xv);
        const px = lerp(x0, x1, t);
        const py = lerp(y0, y1, (yv - rng[0]) / (rng[1] - rng[0]));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    const sig = (z) => 1 / (1 + Math.exp(-z));

    if (type === 'sigmoid') {
      const midY = lerp(y0, y1, 0.5);
      axes(midY);
      curve(sig, [-6, 6], [0, 1], BLUE);
      ctx.fillStyle = MUT; ctx.font = "500 18px 'IBM Plex Mono', monospace";
      ctx.fillText('1', x0 - 18, y1 + 12); ctx.fillText('0', x0 - 18, y0 + 2);
    } else if (type === 'relu') {
      axes(null);
      curve((x) => Math.max(0, x), [-6, 6], [0, 6], BLUE);
      ctx.fillStyle = MUT; ctx.font = "500 18px 'IBM Plex Mono', monospace";
      ctx.fillText('0', lerp(x0, x1, 0.5) - 4, y0 + 22);
    } else if (type === 'bend') {
      axes(null);
      // straight line (gray) vs a bent curve (blue)
      curve((x) => x, [-3, 3], [-3.2, 3.2], '#cfd0d6', 3);
      curve((x) => Math.tanh(x * 1.4) * 2.6, [-3, 3], [-3.2, 3.2], BLUE, 4);
    } else if (type === 'bowl') {
      axes(null);
      const f = (x) => x * x;
      curve(f, [-3, 3], [-0.4, 9], BLUE, 4);
      // ball partway down the right side + downhill arrow
      const bx = 1.7, by = f(bx);
      const px = lerp(x0, x1, (bx - (-3)) / 6);
      const py = lerp(y0, y1, (by - (-0.4)) / (9 - (-0.4)));
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(px - 6, py + 26); ctx.lineTo(px - 40, py + 50); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 40, py + 50); ctx.lineTo(px - 30, py + 44);
      ctx.moveTo(px - 40, py + 50); ctx.lineTo(px - 34, py + 38); ctx.stroke();
      ctx.fillStyle = MUT; ctx.font = "500 17px 'IBM Plex Mono', monospace";
      ctx.fillText('downhill', px - 96, py + 70);
    } else if (type === 'squeeze') {
      const midY = lerp(y0, y1, 0.5);
      axes(midY);
      curve(sig, [-6, 6], [0, 1], BLUE);
      const marks = [-4, 0, 4];
      marks.forEach((z) => {
        const s = sig(z);
        const px = lerp(x0, x1, (z + 6) / 12);
        const py = lerp(y0, y1, s);
        ctx.strokeStyle = '#cfd0d6'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, py); ctx.lineTo(x0, py); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill();
        ctx.fillStyle = MUT; ctx.font = "600 18px 'IBM Plex Mono', monospace";
        ctx.fillText(z > 0 ? '+' + z : '' + z, px - 8, y0 + 24);
        ctx.fillStyle = INK; ctx.fillText(s.toFixed(2), x0 + 8, py - 9);
      });
      ctx.fillStyle = MUT; ctx.font = "500 17px 'IBM Plex Mono', monospace";
      ctx.fillText('1', x0 - 20, y1 + 12); ctx.fillText('0', x0 - 20, y0 + 2);
    } else if (type === 'curves') {
      axes(null);
      const tl = (t) => 0.68 * Math.exp(-2.6 * t) + 0.10;          // training loss down
      const vl = (t) => 0.66 * Math.exp(-2.2 * t) + 0.16 + 0.06 * t; // val loss down then drifts up
      curve(tl, [0, 1], [0, 0.75], BLUE, 4);
      curve(vl, [0, 1], [0, 0.75], RED, 4);
    }
  }

  function drawAll() {
    document.querySelectorAll('canvas[data-plot]').forEach((c) => {
      try { plot(c); } catch (e) { /* layout not ready yet; a later retry covers it */ }
    });
  }

  window.__drawPlots = drawAll;
  [60, 250, 600, 1200].forEach((ms) => setTimeout(drawAll, ms));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
})();
