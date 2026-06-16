/* neuron-flow.js — an auto-playing, looping "worked example" of one neuron.
 * Self-registers as <neuron-flow>. Vanilla JS, no deps.
 * One phishing email's numbers flow through: feature × weight -> add up ->
 * add the bias -> squeeze into a 0..1 score. A numbered step list builds up
 * and STAYS, so the finished slide reads as its own recap. */
(function () {
  if (customElements.get('neuron-flow')) return;

  const INK = '#15161d', MUT = '#6b6f80', LINE = '#e3e3e8';
  const BLUE = '#3b56d8', RED = '#c0392b', SOFT = '#f6f6f4';

  // ---- the worked example (chosen for clean arithmetic) ----
  const ROWS = [
    { name: 'links',   val: 3, w: 2, prod: 6 },
    { name: 'urgency', val: 7, w: 1, prod: 7 },
    { name: 'sender',  val: 1, w: 1, prod: 1 },
  ];
  const SUM = 14, BIAS = -10, Z = 4;          // 6+7+1 = 14 ; 14 + (-10) = 4
  const SCORE = 1 / (1 + Math.exp(-Z));        // sigmoid(4) ≈ 0.98

  // ---- timeline (ms) — paced slowly so each beat can be read ----
  const T = { in: 400, mult: 2100, sum: 3900, bias: 5900, act: 7800, out: 9500, hold: 12600, end: 14000 };

  const STEPS = [
    'Three features come in as numbers: 3, 7, 1.',
    'Multiply each feature by its weight: 6, 7, 1.',
    'Add them all up  →  14.',
    'Add the bias (−10)  →  4.',
    'Squeeze into a score from 0 to 1  →  0.98.',
    '0.98 means this email is very likely phishing.',
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const prog = (t, startT, dur) => easeOut(clamp((t - startT) / dur, 0, 1));

  function sigPath() {
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const x = -6 + (12 * i) / 40;
      const px = (i / 40) * 120;
      const py = 60 - (1 / (1 + Math.exp(-x))) * 54 - 3;
      d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1) + ' ';
    }
    return d.trim();
  }

  const tpl = document.createElement('template');
  tpl.innerHTML = `
    <style>
      :host { display:flex; align-items:center; justify-content:center; width:100%; height:100%;
              font-family:'IBM Plex Sans',sans-serif; color:${INK}; }
      .stage { position:relative; width:100%; max-width:1640px; display:flex; flex-direction:column; gap:40px; }
      .flow { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .arrow { font-size:46px; color:#d3d4da; flex:0 0 auto; }

      .col { display:flex; flex-direction:column; gap:18px; flex:0 0 auto; }
      .row { display:flex; align-items:center; gap:14px; }
      .chip { padding:14px 20px; background:${SOFT}; border:1px solid ${LINE}; border-radius:10px;
              font:500 25px 'IBM Plex Sans',sans-serif; white-space:nowrap; }
      .chip b { font:600 25px 'IBM Plex Mono',monospace; color:${INK}; }
      .wt { font:600 24px 'IBM Plex Mono',monospace; color:${BLUE}; white-space:nowrap; }
      .prod { font:600 26px 'IBM Plex Mono',monospace; color:${INK}; min-width:64px;
              padding:8px 14px; background:#eef1fc; border-radius:8px; white-space:nowrap; }

      .node { width:184px; height:184px; border-radius:50%; display:flex; flex-direction:column;
              align-items:center; justify-content:center; flex:0 0 auto; position:relative; }
      .node.sum { border:3px solid ${INK}; }
      .node.act { border:3px solid ${BLUE}; }
      .node .big { font:600 62px 'IBM Plex Mono',monospace; line-height:1; }
      .node .cap { font:500 22px 'IBM Plex Sans',sans-serif; color:${MUT}; margin-top:8px; }
      .node .sym { position:absolute; top:-42px; left:50%; transform:translateX(-50%);
                   font:500 20px 'IBM Plex Mono',monospace; color:#9da0b0; white-space:nowrap; }
      .biaschip { margin-top:14px; align-self:center; padding:10px 18px; border-radius:999px;
                  background:#fbeceb; color:${RED}; font:600 23px 'IBM Plex Mono',monospace; white-space:nowrap; }
      .sumwrap, .actwrap { display:flex; flex-direction:column; align-items:center; }
      svg { display:block; }
      .dot { fill:${BLUE}; }
      .score { margin-top:46px; font:600 30px 'IBM Plex Mono',monospace; color:${BLUE}; }

      .out { display:flex; flex-direction:column; align-items:flex-start; gap:14px; flex:0 0 auto; }
      .outlabel { font:600 28px 'IBM Plex Sans',sans-serif; color:${INK}; white-space:nowrap; }
      .bar { width:210px; height:26px; border-radius:13px; background:${SOFT};
             border:1px solid ${LINE}; overflow:hidden; }
      .fill { height:100%; width:0%; background:${RED}; }
      .pct { font:600 30px 'IBM Plex Mono',monospace; color:${RED}; }

      .steps { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:repeat(3, auto);
               grid-auto-flow:column; column-gap:72px; row-gap:15px; }
      .step { display:flex; align-items:center; gap:18px; transition:opacity .45s ease; }
      .step .num { width:38px; height:38px; border-radius:50%; flex:0 0 auto;
                   display:flex; align-items:center; justify-content:center;
                   font:600 20px 'IBM Plex Mono',monospace; transition:background .3s, color .3s; }
      .step .txt { font:500 27px 'IBM Plex Sans',sans-serif; color:${INK}; }
      .replay { position:absolute; top:-6px; right:0; border:1px solid ${LINE}; background:#fff; color:${MUT};
                border-radius:999px; padding:10px 20px; font:600 20px 'IBM Plex Sans',sans-serif;
                cursor:pointer; white-space:nowrap; }
      .replay:hover { color:${INK}; border-color:#c9cad2; }
    </style>
    <div class="stage">
      <div class="flow">
        <div class="col" id="inputs">
          ${ROWS.map((r, i) => `
            <div class="row" data-row="${i}">
              <span class="chip">${r.name}&nbsp;<b>${r.val}</b></span>
              <span class="wt">× ${r.w}</span>
              <span class="prod" data-prod="${i}">= ${r.prod}</span>
            </div>`).join('')}
        </div>
        <span class="arrow">→</span>
        <div class="sumwrap">
          <div class="node sum">
            <span class="big" id="sumbig"></span>
            <span class="cap" id="sumcap">add them up</span>
            <span class="sym">Σ = add it all up</span>
          </div>
          <span class="biaschip" id="biaschip">+ bias&nbsp;&nbsp;−10</span>
        </div>
        <span class="arrow">→</span>
        <div class="actwrap">
          <div class="node act">
            <svg width="120" height="66" viewBox="0 0 120 66">
              <path d="${sigPath()}" fill="none" stroke="${BLUE}" stroke-width="4" stroke-linecap="round"/>
              <circle class="dot" id="dot" cx="0" cy="0" r="6" opacity="0"/>
            </svg>
            <span class="sym">ƒ = the activation</span>
          </div>
          <span class="score" id="score">σ(4) = 0.98</span>
        </div>
        <span class="arrow">→</span>
        <div class="out">
          <span class="outlabel">phishing score</span>
          <div class="bar"><div class="fill" id="fill"></div></div>
          <span class="pct" id="pct">0.98</span>
        </div>
      </div>
      <div class="steps" id="steps">
        ${STEPS.map((s, i) => `
          <div class="step" data-step="${i}">
            <span class="num">${i + 1}</span><span class="txt">${s}</span>
          </div>`).join('')}
      </div>
      <button class="replay" id="replay">↻ replay</button>
    </div>`;

  class NeuronFlow extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      const root = this.attachShadow({ mode: 'open' });
      root.appendChild(tpl.content.cloneNode(true));
      const $ = (s) => root.querySelector(s);
      this.els = {
        rows: [...root.querySelectorAll('.row')],
        prods: [...root.querySelectorAll('.prod')],
        sumbig: $('#sumbig'), sumcap: $('#sumcap'), biaschip: $('#biaschip'),
        dot: $('#dot'), score: $('#score'), fill: $('#fill'), pct: $('#pct'),
        steps: [...root.querySelectorAll('.step')],
        nums: [...root.querySelectorAll('.step .num')],
        stage: root.querySelector('.stage'),
      };
      const dx = ((Z + 6) / 12) * 120;
      const dy = 60 - SCORE * 54 - 3;
      this._dotTarget = { x: dx, y: dy };

      this.END = T.out + 1100;            // finish a beat after the bar fills, then hold
      this.loop = this.loop.bind(this);
      const replay = () => { this.start = performance.now(); if (!this._raf) this._raf = requestAnimationFrame(this.loop); };
      $('#replay').addEventListener('click', replay);
      this.start = performance.now();
      this._raf = requestAnimationFrame(this.loop);

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => {
          es.forEach((e) => { if (e.isIntersecting) replay(); });  // play once on arrival, no auto-loop
        }, { threshold: 0.5 });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._io) this._io.disconnect();
    }

    loop(now) {
      const t = now - this.start;
      if (t >= this.END) { this.apply(this.END); this._raf = null; return; }  // play once, hold final frame
      this.apply(t);
      this._raf = requestAnimationFrame(this.loop);
    }

    apply(t) {
      const e = this.els;
      e.stage.style.opacity = 0.25 + 0.75 * Math.min(1, t / T.in);

      e.rows.forEach((r, i) => {
        const p = prog(t, T.in + i * 220, 460);
        r.style.opacity = p;
        r.style.transform = `translateY(${(1 - p) * 10}px)`;
      });
      e.prods.forEach((pr, i) => {
        const p = prog(t, T.mult + i * 220, 420);
        pr.style.opacity = p;
        pr.style.transform = `scale(${0.8 + 0.2 * p})`;
      });

      if (t >= T.bias) {
        const p = prog(t, T.bias, 700);
        const v = SUM + (Z - SUM) * p;
        e.sumbig.textContent = v.toFixed(0);
        e.sumcap.textContent = 'z = total + bias';
      } else if (t >= T.sum) {
        const p = prog(t, T.sum, 800);
        e.sumbig.textContent = (SUM * p).toFixed(0);
        e.sumcap.textContent = 'running total';
      } else {
        e.sumbig.textContent = '';
        e.sumcap.textContent = 'add them up';
      }
      const bp = prog(t, T.bias, 420);
      e.biaschip.style.opacity = bp;
      e.biaschip.style.transform = `translateY(${(1 - bp) * 10}px)`;

      const ap = prog(t, T.act, 700);
      e.dot.setAttribute('opacity', ap);
      e.dot.setAttribute('cx', (this._dotTarget.x * ap).toFixed(1));
      e.dot.setAttribute('cy', (60 - (60 - this._dotTarget.y) * ap).toFixed(1));
      e.score.style.opacity = ap;
      e.score.textContent = 'σ(4) = ' + (SCORE * ap).toFixed(2);

      const op = prog(t, T.out, 800);
      e.fill.style.width = (SCORE * 100 * op).toFixed(0) + '%';
      e.pct.style.opacity = op;
      e.pct.textContent = (SCORE * op).toFixed(2);

      // numbered steps: each reveals at its beat and STAYS; current one highlighted
      const beats = [T.in, T.mult, T.sum, T.bias, T.act, T.out];
      let idx = 0;
      for (let i = 0; i < beats.length; i++) if (t >= beats[i]) idx = i;
      e.steps.forEach((st, i) => {
        const on = t >= beats[i];
        st.style.opacity = on ? 1 : 0.16;
        const cur = i === idx;
        e.nums[i].style.background = cur ? BLUE : '#eef1fc';
        e.nums[i].style.color = cur ? '#fff' : BLUE;
      });
    }
  }
  customElements.define('neuron-flow', NeuronFlow);
})();
