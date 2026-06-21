export class MagnaTranHandler {
  constructor(vizEngine) {
    this.viz = vizEngine;
  }
  
  async loadSample(speedMultiplier) {
    this.viz.updateStatus('① Load sample (cassette → robot → load-lock)', true);
    this.viz.animateHardware('ui-handler');
    
    const delay = 1000 / speedMultiplier; 
    await new Promise(r => setTimeout(r, delay));
    
    this.viz.clearHardware();
    return true;
  }
}