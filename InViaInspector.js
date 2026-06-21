export class InViaInspector {
  constructor(vizEngine) {
    this.viz = vizEngine;

    // Wavenumber axis: 100–750 cm-1, 200 points
    this.wn = Array.from({ length: 200 }, (_, i) => 100 + i * 3.25);

    // Noise-free, baseline-subtracted reference spectra for per-phase calibration
    const refA  = this.subtractBaseline(this._synth({ anatase: 1, rutile: 0, amorphous: 0 }, false));
    const refR  = this.subtractBaseline(this._synth({ anatase: 0, rutile: 1, amorphous: 0 }, false));
    const refAm = this.subtractBaseline(this._synth({ anatase: 0, rutile: 0, amorphous: 1 }, false));

    this._calAnatase   = this._win(refA,  130, 165);
    this._calRutile    = this._win(refR,  430, 470) + this._win(refR, 595, 635);
    this._calAmorphous = this._win(refAm, 270, 315);

    // Gain: calibrated so a noise-free pure-anatase reference scores ~0.98
    const a0  = this._win(refA, 130, 165) / this._calAnatase;
    const r0  = (this._win(refA, 430, 470) + this._win(refA, 595, 635)) / this._calRutile;
    const am0 = this._win(refA, 270, 315)  / this._calAmorphous;
    this._gain = 0.98 / (a0 / (a0 + r0 + am0));
  }

  _lor(center, fwhm, intensity) {
    const g2 = (fwhm / 2) ** 2;
    return this.wn.map(x => intensity * g2 / ((x - center) ** 2 + g2));
  }

  _gauss(center, fwhm, intensity) {
    const s2 = (fwhm / (2 * Math.sqrt(2 * Math.log(2)))) ** 2;
    return this.wn.map(x => intensity * Math.exp(-0.5 * (x - center) ** 2 / s2));
  }

  _synth(phases, addNoise = true) {
    const { anatase = 0, rutile = 0, amorphous = 0 } = phases;
    const a144 = this._lor(144,  15, anatase  * 2.0);
    const r447 = this._lor(447,  20, rutile   * 1.0);
    const r612 = this._lor(612,  18, rutile   * 1.2);
    const hump = this._gauss(450, 220, amorphous * 0.4);
    const spec = this.wn.map((x, i) =>
      a144[i] + r447[i] + r612[i] + hump[i] + 0.05 + (x - 100) * 0.0003
    );
    if (!addNoise) return spec;
    return spec.map(v => Math.max(0, v + (Math.random() - 0.5) * 0.03));
  }

  _win(spectrum, lo, hi) {
    let s = 0;
    for (let i = 0; i < this.wn.length; i++) {
      if (this.wn[i] >= lo && this.wn[i] <= hi) s += spectrum[i];
    }
    return Math.max(s, 1e-9);
  }

  acquireSpectrum(phases) {
    return this._synth(phases, true);
  }

  subtractBaseline(spectrum) {
    const n = spectrum.length;
    const slope = (spectrum[n - 1] - spectrum[0]) / (n - 1);
    return spectrum.map((v, i) => v - (spectrum[0] + slope * i));
  }

  calculatePhases(T, t) {
    const R = 8.314, TK = T + 273.15;
    const r = 6.0e7 * Math.exp(-120000 / (R * TK));
    const C = 1 - Math.exp(-(r * t));
    const rutileShare = (1 / (1 + Math.exp((600 - T) / 30))) * (1 - Math.exp(-t / 70));
    const anatase   = Math.max(0, Math.min(1, C * (1 - rutileShare)));
    const rutile    = Math.max(0, Math.min(1, C * rutileShare));
    const amorphous = Math.max(0, 1 - C);
    return { anatase, rutile, amorphous, crystallized: C };
  }

  async characterizeAndScore(T, t, speedMultiplier) {
    this.viz.updateStatus('③ Characterize (in-situ Raman) → ④ Score', true);
    this.viz.animateHardware('ui-inspector');

    const delay = 800 / speedMultiplier;
    await new Promise(r => setTimeout(r, delay));

    const phases = this.calculatePhases(T, t);

    const rawSpectrum = this.acquireSpectrum(phases);
    const spectrum    = this.subtractBaseline(rawSpectrum);

    const a  = this._win(spectrum, 130, 165) / this._calAnatase;
    const r  = (this._win(spectrum, 430, 470) + this._win(spectrum, 595, 635)) / this._calRutile;
    const am = this._win(spectrum, 270, 315)  / this._calAmorphous;

    const score = Math.min(0.995, Math.max(0, (a / (a + r + am)) * this._gain));

    this.viz.clearHardware();
    return { score, phases, spectrum };
  }
}
