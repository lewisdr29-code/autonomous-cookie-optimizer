export class InViaInspector {
  constructor(vizEngine) {
    this.viz = vizEngine;
  }

  calculatePhases(T, t) {
    const R = 8.314, TK = T + 273.15;
    const r = 6.0e7 * Math.exp(-120000 / (R * TK));
    const C = 1 - Math.exp(-(r * t));
    const rutileShare = (1 / (1 + Math.exp((600 - T) / 30))) * (1 - Math.exp(-t / 70));
    const anatase = Math.max(0, Math.min(1, C * (1 - rutileShare)));
    const rutile = Math.max(0, Math.min(1, C * rutileShare));
    const amorphous = Math.max(0, 1 - C);
    return { anatase, rutile, amorphous, crystallized: C };
  }

  async characterizeAndScore(T, t, speedMultiplier) {
    this.viz.updateStatus('③ Characterize (in-situ Raman) → ④ Score', true);
    this.viz.animateHardware('ui-inspector');
    
    const delay = 800 / speedMultiplier;
    await new Promise(r => setTimeout(r, delay));

    const phases = this.calculatePhases(T, t);
    const score = Math.max(0, Math.min(0.995, phases.anatase + (Math.random() - 0.5) * 0.02));
    
    this.viz.clearHardware();
    return { score, phases };
  }
}