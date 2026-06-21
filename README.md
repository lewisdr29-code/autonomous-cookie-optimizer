# Autonomous Cookie Optimizer (TiO2 Phase Optimization)

This is a browser-based simulation of a closed-loop materials science laboratory. It models the automated process of finding the exact annealing conditions needed to convert amorphous titanium dioxide (the "raw dough") into the anatase phase ("perfectly crispy"), without over-baking it into the rutile phase ("burnt").

**Author:** Lewis Rael
**Context:** Developed for the CINT Integration intersnhip posting to demonstrate system architecture and optimization logic.

---

## System Architecture and Hardware Mapping

The simulation runs on standard ES6 JavaScript modules. The code is separated into distinct classes that represent the physical hardware used in the lab. This mirrors a standard two-layer control stack: a high-level decision node communicating with a real-time operating system (RTOS).

* **MagnaTranHandler.js (The Handler)**
    * Real hardware: Brooks MagnaTran LEAP robot on a Marathon Express platform.
    * Role: Handles the simulated sample transfer from the cassette to the UHV chamber.
* **EpiCentreOven.js (The Oven)**
    * Real hardware: UHV Design EpiCentre (EC-R) heating stage, Pfeiffer HiPace 300 turbopump, Alicat MFC.
    * Role: Controls the simulated thermodynamic environment, managing the temperature ramp and dwell time under a 200 mTorr O2 atmosphere.
* **InViaInspector.js (The Inspector)**
    * Real hardware: Renishaw inVia Qontor confocal Raman microscope.
    * Role: Synthesizes a noisy Raman spectrum (anatase 144 cm^-1 Lorentzian, rutile 447/612 cm^-1 Lorentzians, broad amorphous Gaussian hump, sloped fluorescence baseline), subtracts a linear fluorescence baseline anchored at the two endpoints, integrates fixed windows at 144, 447/612, and 290 cm^-1 for each phase, and computes the figure of merit as anatase/(anatase+rutile+amorphous) response-calibrated against a noise-free pure-anatase standard.
* **JetsonBrain.js (The Optimizer)**
    * Real hardware: NVIDIA Jetson node.
    * Role: Runs the Gaussian-Process Bayesian optimization. It calculates the next experimental conditions by maximizing Expected Improvement.
* **VisualizationEngine.js (The UI)**
    * Role: Manages canvas rendering for the response surface, Raman spectra, and convergence charts. Also handles the timeline animation.
* **main.js (The Orchestrator)**
    * Real hardware: NI PXIe controller.
    * Role: The main state machine that runs the 5-step cycle (Load -> Anneal -> Characterize -> Score -> Decide).

---

## How to Run the Simulation

Because this project uses ES6 modules (import/export statements), browsers will block the scripts from running if you just double-click the index.html file due to CORS security policies. The files need to be served over a local HTTP server.

**Using VS Code Live Server**
1. Open the project folder in VS Code.
2. Install the Live Server extension by Ritwick Dey.
3. Open index.html.
4. Right-click the code and select "Open with Live Server". The app will open in your browser at http://127.0.0.1:5500.

**Using Python**
If you have Python installed, you can use the terminal:
1. Open your terminal and navigate to the project directory.
2. Run `python -m http.server` (or `python3 -m http.server` on macOS/Linux).
3. Open your browser to http://localhost:8000.

---

## Using the Application

**Control and Monitoring Tab**
* **Bake one cookie (Step):** Manually advance the simulation one loop at a time.
* **Auto-bake (Loop):** Let the system run automatically until it completes its 24-run budget.
* **View Toggles:** Switch between "Model Belief" (the AI's current map of the response surface) and "Ground Truth" (the underlying physics model).

**System Animation and Analysis Tab**
* Follow the timeline as the orchestrator passes instructions between the hardware modules.
* Change the simulation speed (1x to 10x) during execution.
* Read the final analytical report generated when the optimization loop finishes.
