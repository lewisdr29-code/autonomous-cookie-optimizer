export class EpiCentreOven {
  constructor(vizEngine) {
    this.viz = vizEngine;
  }

  async anneal(T, t, speedMultiplier) {
    this.viz.updateStatus(`② Anneal ${Math.round(T)}°C / ${Math.round(t)}min (vacuum · gas · ramp · dwell)`, true);
    this.viz.setSubstage(`UHV · 200 mTorr O₂ · Target: ${Math.round(T)}°C`);
    this.viz.animateHardware('ui-oven');
    
    const delay = 1500 / speedMultiplier;
    await new Promise(r => setTimeout(r, delay));
    
    this.viz.clearHardware();
    return true;
  }
}