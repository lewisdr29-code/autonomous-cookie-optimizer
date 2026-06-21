export class VisualizationEngine {
  constructor() {
    this.viewMode = 'belief';
    
    // Physical bounds for rendering
    this.Tlo = 250; this.Thi = 750;
    this.tlo = 5; this.thi = 180;
    
    // Light bakery colormap
    this.STOPS = [[248,235,220], [238,205,170], [218,155,90], [194,115,40], [139,69,19]];
    
    this.setupTabs();
    this.setupViewToggles();
  }

  setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
        this.resizeCanvases();
      });
    });
  }

  setupViewToggles() {
    document.querySelectorAll('#view button').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('#view button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.viewMode = b.dataset.v;
        if(this.lastState) this.drawMap(this.lastState);
      };
    });
  }

  updateStatus(txt, isLive) {
    document.getElementById('stage').textContent = txt;
    document.getElementById('dot').classList.toggle('on', !!isLive);
  }

  setSubstage(txt) {
    document.getElementById('substage').textContent = txt;
  }

  animateHardware(elementId) {
    this.clearHardware();
    
    const hw = document.getElementById(elementId);
    if(hw) hw.classList.add('active');
    
    const infoId = elementId.replace('ui-', 'info-');
    const info = document.getElementById(infoId);
    if(info) info.classList.add('active');
  }

  clearHardware() {
    document.querySelectorAll('.hw-module').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.hw-info').forEach(el => el.classList.remove('active'));
  }

  updateReadouts(iteration, bestScore, bestT, bestt, lastT, lastt) {
    document.getElementById('r-iter').innerHTML = `${iteration}<small> / 24</small>`;
    document.getElementById('r-best').textContent = (bestScore * 100).toFixed(1) + '%';
    document.getElementById('r-cond').textContent = `${Math.round(bestT)}°C · ${Math.round(bestt)} min`;
    if(lastT) document.getElementById('r-last').textContent = `${Math.round(lastT)}°C · ${Math.round(lastt)} min`;
  }

  renderAnalysis(bestScore, bestT, bestt, phases, totalIters, mode) {
    const sm = document.getElementById('summary');
    sm.style.display = 'block';
    
    const ana = phases.anatase * 100, rut = phases.rutile * 100, amo = phases.amorphous * 100;
    
    document.getElementById('sum-ana').textContent = (bestScore * 100).toFixed(1) + '%';
    document.getElementById('sum-cond').textContent = `${Math.round(bestT)}°C · ${Math.round(bestt)} min`;
    document.getElementById('sum-iter').textContent = totalIters + ' / 24';
    
    document.getElementById('seg-ana').style.width = ana + '%';
    document.getElementById('seg-rut').style.width = rut + '%';
    document.getElementById('seg-amo').style.width = amo + '%';
    
    document.getElementById('key-ana').textContent = ana.toFixed(0) + '%';
    document.getElementById('key-rut').textContent = rut.toFixed(0) + '%';
    document.getElementById('key-amo').textContent = amo.toFixed(0) + '%';
    
    const modeString = mode === 'truth' 
      ? "<b>Ground Truth</b> (simulating exhaustive knowledge of the physical physics surface)" 
      : "<b>Model Belief</b> (a Gaussian-Process surrogate built efficiently from sparse sampling)";
      
    document.getElementById('sum-text').innerHTML = `The Edge-AI optimizer converged on <b>${Math.round(bestT)}°C for ${Math.round(bestt)} min</b> at 200 mTorr O₂. Guided by the ${modeString}, the system steered toward high-potential conditions. At this optimum the simulated film is <b>${ana.toFixed(0)}% anatase</b>, ${rut.toFixed(0)}% rutile, and ${amo.toFixed(0)}% amorphous.`;
  }

  resizeCanvases() { this.drawAll(this.lastState); }
  
  drawAll(state) {
    if(!state || !state.X) return;
    this.lastState = state;
    this.drawMap(state);
    this.drawRaman(state);
    this.drawConv(state);
  }

  fit(c) {
    const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    c.width = r.width * d; c.height = r.height * d; 
    const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
    return { x, w: r.width, h: c.height / d };
  }

  cmap(v) {
    if (isNaN(v) || !isFinite(v)) v = 0;
    v = Math.max(0, Math.min(1, v));
    const s = v * (this.STOPS.length - 1);
    const i = Math.floor(s), f = s - i;
    const a = this.STOPS[i], b = this.STOPS[Math.min(i + 1, this.STOPS.length - 1)];
    return `rgb(${a[0]+(b[0]-a[0])*f|0},${a[1]+(b[1]-a[1])*f|0},${a[2]+(b[2]-a[2])*f|0})`;
  }

  star(x, cx, cy, r, col) {
    x.beginPath();
    for(let i=0; i<10; i++){
      const a = Math.PI/5*i - Math.PI/2, rr = i%2 ? r*.45 : r;
      x.lineTo(cx + Math.cos(a)*rr, cy + Math.sin(a)*rr);
    }
    x.closePath(); x.fillStyle = col; x.fill();
    x.lineWidth = 1.4; x.strokeStyle = '#fff'; x.stroke();
  }

  drawMap(state) {
    const c = document.getElementById('map'); if (!c.offsetParent) return;
    const {x,w,h} = this.fit(c);
    const padL = 44, padB = 34, padT = 8, padR = 8;
    const pw = w - padL - padR, ph = h - padT - padB;
    const N = 46, cw = pw/N, ch = ph/N;
    const truth = this.viewMode === 'truth';

    const calcPhases = (T, t) => {
        const R=8.314, TK=T+273.15;
        const r = 6.0e7*Math.exp(-120000/(R*TK));
        const C = 1-Math.exp(-(r*t));
        const rutileShare = (1/(1+Math.exp((600-T)/30))) * (1-Math.exp(-t/70));
        return Math.max(0,Math.min(1, C*(1-rutileShare)));
    };

    for(let i=0; i<N; i++) {
      for(let j=0; j<N; j++) {
        const u = [i/(N-1), j/(N-1)];
        let v;
        if (truth) {
          const T = this.Tlo + u[0]*(this.Thi-this.Tlo);
          const t = this.tlo + u[1]*(this.thi-this.tlo);
          v = calcPhases(T, t);
        } else {
          if(!state.model) { v = 0; } 
          else {
            const kern = (a, b) => Math.exp(-(Math.pow(a[0]-b[0],2) + Math.pow(a[1]-b[1],2)) / (2*0.18*0.18));
            const ks = state.model.X.map(xi => kern(xi, u));
            let mu = state.model.mean;
            for(let k=0; k<ks.length; k++) mu += ks[k] * state.model.alpha[k];
            v = Math.max(0, Math.min(1, mu));
          }
        }
        x.fillStyle = this.cmap(v);
        x.fillRect(padL + i*cw, padT + (ph - (j+1)*ch), cw+1, ch+1);
      }
    }

    x.strokeStyle = '#eaddd0'; x.lineWidth = 1; x.strokeRect(padL, padT, pw, ph);
    x.fillStyle = '#795548'; x.font = '10px ui-monospace,monospace'; x.textAlign = 'center';
    for(let k=0; k<=4; k++){
      const T = this.Tlo + (this.Thi - this.Tlo)*k/4;
      x.fillText(Math.round(T), padL + pw*k/4, h - padB + 15);
    }
    x.save(); x.translate(13, padT + ph/2); x.rotate(-Math.PI/2); x.fillText('bake / dwell time (min)', 0, 0); x.restore();
    x.fillText('oven / anneal temperature (°C)', padL + pw/2, h - 4);
    x.textAlign = 'left';
    for(let k=0; k<=3; k++){
      const t = this.tlo + (this.thi - this.tlo)*k/3;
      x.fillText(Math.round(t), 4, padT + ph - (ph*k/3) + 3);
    }

    const px = u => padL + u[0]*pw, py = u => padT + ph - u[1]*ph;
    state.X.forEach((u, idx) => {
      const isBest = idx === state.bestIdx, isLast = state.latestU && u === state.latestU;
      x.beginPath(); x.arc(px(u), py(u), isBest ? 0 : 3.6, 0, 7);
      x.fillStyle = 'rgba(62,39,35,.85)'; x.fill();
      if(isLast){ x.beginPath(); x.arc(px(u), py(u), 6.5, 0, 7); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); }
    });
    
    if(state.X[state.bestIdx]){
      this.star(x, px(state.X[state.bestIdx]), py(state.X[state.bestIdx]), 9, '#e65100');
    }
  }

  lorentz(x0, w, A, x) { return A / (1 + Math.pow((x - x0) / w, 2)); }

  drawRaman(state) {
    const c = document.getElementById('raman'); if (!c.offsetParent) return;
    const {x,w,h} = this.fit(c);
    const padL = 8, padB = 36, padT = 6, padR = 8, pw = w - padL - padR, ph = h - padT - padB;
    
    const p = state.latestP || { anatase: 0, rutile: 0, amorphous: 1, crystallized: 0 };
    
    if(state.latestU) {
        const T = Math.round(this.Tlo + state.latestU[0]*(this.Thi-this.Tlo));
        const t = Math.round(this.tlo + state.latestU[1]*(this.thi-this.tlo));
        document.getElementById('raman-sub').textContent = `T=${T}°C · t=${t}min · crispy ${(p.anatase*100|0)}% · burnt ${(p.rutile*100|0)}%`;
    }

    const lo = 100, hi = 800;
    const xpix = k => padL + (k - lo) / (hi - lo) * pw;
    const ana = [[144,7,1.0], [197,9,.18], [399,12,.30], [516,12,.26], [639,13,.34]];
    const rut = [[143,9,.25], [447,16,.55], [612,16,.62], [826,18,.2]];
    
    const pts = []; let maxv = 0.001;
    for (let k = lo; k <= hi; k += 2) {
      let v = p.amorphous * 0.18 * Math.exp(-Math.pow((k - 480) / 240, 2));
      ana.forEach(q => v += p.anatase * this.lorentz(q[0], q[1], q[2], k));
      rut.forEach(q => v += p.rutile * this.lorentz(q[0], q[1], q[2], k));
      v += 0.006 * Math.random(); 
      pts.push([k, v]);
      if (v > maxv) maxv = v;
    }

    x.strokeStyle = '#eaddd0'; x.lineWidth = 1; x.strokeRect(padL, padT, pw, ph);
    x.beginPath(); x.moveTo(xpix(lo), padT + ph);
    pts.forEach(p2 => x.lineTo(xpix(p2[0]), padT + ph - (p2[1] / maxv) * ph * 0.92));
    x.lineTo(xpix(hi), padT + ph); x.closePath();
    
    const g = x.createLinearGradient(0, padT, 0, padT + ph);
    g.addColorStop(0, 'rgba(218,155,90,.45)'); g.addColorStop(1, 'rgba(218,155,90,.02)');
    x.fillStyle = g; x.fill();
    
    x.beginPath();
    pts.forEach((p2, i) => {
      const X2 = xpix(p2[0]), Y2 = padT + ph - (p2[1] / maxv) * ph * 0.92;
      i ? x.lineTo(X2, Y2) : x.moveTo(X2, Y2);
    });
    x.strokeStyle = '#d9853b'; x.lineWidth = 2; x.stroke();

    if (p.anatase > 0.08) {
      x.strokeStyle = 'rgba(217,133,59,.55)'; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(xpix(144), padT); x.lineTo(xpix(144), padT + ph); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#c27328'; x.font = '9px ui-monospace,monospace'; x.textAlign = 'center';
      x.fillText('Crisp (144)', xpix(144) + 28, padT + 10);
    }
    if (p.rutile > 0.10) {
      x.strokeStyle = 'rgba(184,80,66,.55)'; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(xpix(612), padT); x.lineTo(xpix(612), padT + ph); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#b85042'; x.font = '9px ui-monospace,monospace'; x.textAlign = 'center';
      x.fillText('Burnt (612)', xpix(612), padT + 10);
    }

    x.fillStyle = '#795548'; x.font = '10px ui-monospace,monospace'; x.textAlign = 'center';
    [200, 400, 600, 800].forEach(k => x.fillText(k, xpix(k), padT + ph + 14));
    x.fillText('Raman shift (cm⁻¹)', padL + pw / 2, padT + ph + 28);
  }

  drawConv(state) {
    const c = document.getElementById('conv'); if (!c.offsetParent) return;
    const {x,w,h} = this.fit(c);
    const padL = 34, padB = 24, padT = 10, padR = 10, pw = w - padL - padR, ph = h - padT - padB;
    
    x.strokeStyle = '#eaddd0'; x.lineWidth = 1; x.strokeRect(padL, padT, pw, ph);
    x.fillStyle = '#795548'; x.font = '10px ui-monospace,monospace'; x.textAlign = 'right';
    
    [0, 0.5, 1].forEach(v => {
      const Y = padT + ph - v * ph;
      x.fillText(v.toFixed(1), padL - 5, Y + 3);
      x.strokeStyle = '#f4eee8'; x.beginPath(); x.moveTo(padL, Y); x.lineTo(padL + pw, Y); x.stroke();
    });

    const xp = i => padL + (i / 26) * pw, yp = v => padT + ph - v * ph;
    
    x.beginPath();
    state.hist.forEach((d, i) => {
      const X2 = xp(i), Y2 = yp(d.best);
      i ? x.lineTo(X2, Y2) : x.moveTo(X2, Y2);
    });
    x.strokeStyle = '#e65100'; x.lineWidth = 2; x.stroke();
    
    state.hist.forEach((d, i) => {
      x.beginPath(); x.arc(xp(i), yp(d.best), 2.6, 0, 7);
      x.fillStyle = '#ffb74d'; x.fill();
    });
    
    x.fillStyle = '#795548'; x.textAlign = 'center';
    x.fillText('iteration', padL + pw / 2, h - 4);
  }
}