import { MagnaTranHandler } from './MagnaTranHandler.js';
import { EpiCentreOven } from './EpiCentreOven.js';
import { InViaInspector } from './InViaInspector.js';
import { JetsonBrain } from './JetsonBrain.js';
import { VisualizationEngine } from './VisualizationEngine.js';

// Physical bounds
const Tlo = 250, Thi = 750, tlo = 5, thi = 180;
const toReal = u => [Tlo + u[0] * (Thi - Tlo), tlo + u[1] * (thi - tlo)];

class RTOS {
  constructor() {
    this.viz = new VisualizationEngine();
    this.handler = new MagnaTranHandler(this.viz);
    this.oven = new EpiCentreOven(this.viz);
    this.inspector = new InViaInspector(this.viz);
    this.brain = new JetsonBrain();
    
    this.speedMultiplier = 5; 
    this.running = false;
    this.setupListeners();
    this.reset();
  }

  setupListeners() {
    document.getElementById('btn-step').onclick = () => this.runCycle();
    document.getElementById('btn-auto').onclick = () => this.toggleAuto();
    document.getElementById('btn-reset').onclick = () => this.reset();
    
    document.querySelectorAll('.spd-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.spd-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.speedMultiplier = parseFloat(e.target.dataset.speed);
      };
    });
  }

  reset() {
    this.running = false;
    document.getElementById('btn-auto').textContent = '⟳ Auto-bake (Loop)';
    
    // 3 Seed bakes
    this.X = [[0.06, 0.55], [0.95, 0.85], [0.14, 0.10]];
    this.y = this.X.map(u => {
      const [T, t] = toReal(u);
      return this.inspector.calculatePhases(T, t).anatase; 
    });
    
    this.hist = this.y.map((val, i) => ({ best: Math.max(...this.y.slice(0, i + 1)) }));
    this.model = this.brain.gpFit(this.X, this.y);
    
    this.syncUI();
    this.viz.updateStatus('Idle — 3 seeds loaded', false);
    document.getElementById('summary').style.display = 'none';
  }

  async runCycle() {
    if (this.hist.length >= 27) return; 
    
    // Step 5: Decide
    const { nextU, model } = await this.brain.decideNext(this.X, this.y, this.viz, this.speedMultiplier);
    this.model = model;
    const [T, t] = toReal(nextU);
    
    // Step 1: Load
    await this.handler.loadSample(this.speedMultiplier);
    
    // Step 2: Anneal
    await this.oven.anneal(T, t, this.speedMultiplier);
    
    // Steps 3 & 4: Characterize & Score
    const { score, phases } = await this.inspector.characterizeAndScore(T, t, this.speedMultiplier);
    
    // Record Data
    this.X.push(nextU);
    this.y.push(score);
    this.hist.push({ best: Math.max(...this.y) });
    this.latestP = phases;
    
    this.syncUI();
    
    if (this.hist.length >= 27) {
      this.running = false;
      this.viz.updateStatus('Optimization Complete', false);
      const bestIdx = this.y.indexOf(Math.max(...this.y));
      const [bestT, bestt] = toReal(this.X[bestIdx]);
      
      this.viz.renderAnalysis(
        this.y[bestIdx], 
        bestT, 
        bestt, 
        this.inspector.calculatePhases(bestT, bestt), 
        this.hist.length - 3,
        this.viz.viewMode
      );
    }
  }

  async toggleAuto() {
    this.running = !this.running;
    const btn = document.getElementById('btn-auto');
    btn.textContent = this.running ? '⏸ Pause' : '⟳ Auto-bake (Loop)';
    
    while (this.running && this.hist.length < 27) {
      await this.runCycle();
    }
    
    if (this.hist.length >= 27) {
      this.running = false;
      btn.textContent = '⟳ Auto-bake (Loop)';
    }
  }

  syncUI() {
    const bestIdx = this.y.indexOf(Math.max(...this.y));
    const [bestT, bestt] = toReal(this.X[bestIdx]);
    const lastU = this.X[this.X.length - 1];
    const [lastT, lastt] = toReal(lastU);
    
    this.viz.updateReadouts(this.hist.length - 3, this.y[bestIdx], bestT, bestt, lastT, lastt);
    
    this.viz.drawAll({ 
      X: this.X, 
      y: this.y, 
      model: this.model, 
      hist: this.hist, 
      latestP: this.latestP, 
      latestU: lastU, 
      bestIdx: bestIdx 
    });
  }
}

// Boot the lab
window.addEventListener('DOMContentLoaded', () => {
  window.labOrchestrator = new RTOS();
});