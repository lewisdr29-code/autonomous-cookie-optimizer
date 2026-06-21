export class JetsonBrain {
  constructor() {
    this.L = 0.18; this.SF2 = 1.0; this.SN2 = 0.0025;
  }

  kern(a, b) {
    const dx = a[0] - b[0], dy = a[1] - b[1];
    return this.SF2 * Math.exp(-(dx * dx + dy * dy) / (2 * this.L * this.L));
  }

  chol(A) {
    const n = A.length, M = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = A[i][j];
        for (let k = 0; k < j; k++) s -= M[i][k] * M[j][k];
        if (i === j) {
          if (!(s > 1e-12)) return null;
          M[i][j] = Math.sqrt(s);
        } else M[i][j] = s / M[j][j];
      }
    }
    return M;
  }

  solve(M, b) {
    const n = b.length, y = new Array(n), x = new Array(n);
    for (let i = 0; i < n; i++) {
      let s = b[i]; for (let k = 0; k < i; k++) s -= M[i][k] * y[k]; y[i] = s / M[i][i];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i]; for (let k = i + 1; k < n; k++) s -= M[k][i] * x[k]; x[i] = s / M[i][i];
    }
    return x;
  }

  gpFit(X, y) {
    const staticX = X.map(u => [...u]);
    
    const n = staticX.length, mean = y.reduce((a, b) => a + b, 0) / n, yc = y.map(v => v - mean);
    let jit = this.SN2;
    for (let tries = 0; tries < 7; tries++) {
      const K = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => this.kern(staticX[i], staticX[j]) + (i === j ? jit : 0)));
      const M = this.chol(K);
      if (M) return { X: staticX, M, alpha: this.solve(M, yc), mean };
      jit *= 10;
    }
    return { X: staticX, M: null, alpha: yc.map(() => 0), mean };
  }

  gpPred(m, xs) {
    if (!m.M) return { mu: m.mean, sigma: 1 };
    const ks = m.X.map(xi => this.kern(xi, xs));
    let mu = m.mean;
    for (let i = 0; i < ks.length; i++) mu += ks[i] * m.alpha[i];
    const v = this.solve(m.M, ks);
    let kss = this.SF2; for (let i = 0; i < ks.length; i++) kss -= ks[i] * v[i];
    if (!isFinite(mu)) mu = m.mean;
    const sigma = Math.sqrt(Math.max(kss, 1e-9));
    return { mu, sigma: isFinite(sigma) ? sigma : 1 };
  }

  erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  async decideNext(X, y, vizEngine, speedMultiplier) {
    vizEngine.updateStatus('⑤ Decide next run (Max Expected Improvement)', true);
    vizEngine.animateHardware('ui-brain');
    
    const delay = 600 / speedMultiplier;
    await new Promise(r => setTimeout(r, delay));

    const model = this.gpFit(X, y);
    const G = 34, fbest = Math.max(...y), xi = 0.01, minD = 0.5 / (G - 1);
    let best = -Infinity, bx = null, altSig = -Infinity, alt = null;
    const Phi = z => 0.5 * (1 + this.erf(z / Math.SQRT2));
    const pdf = z => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        const g = [i / (G - 1), j / (G - 1)];
        let taken = false;
        for (const xp of X) { if (Math.abs(xp[0] - g[0]) < minD && Math.abs(xp[1] - g[1]) < minD) taken = true; }
        if (taken) continue;
        
        const { mu, sigma } = this.gpPred(model, g);
        let ei = 0;
        if (sigma > 1e-6) {
          const z = (mu - fbest - xi) / sigma;
          ei = (mu - fbest - xi) * Phi(z) + sigma * pdf(z);
        }
        if (isFinite(ei) && ei > best) { best = ei; bx = g; }
        if (sigma > altSig) { altSig = sigma; alt = g; }
      }
    }
    
    vizEngine.clearHardware();
    return { nextU: bx || alt || [Math.random(), Math.random()], model };
  }
}