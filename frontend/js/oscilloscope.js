/**
 * AstroHealth — Autonomous Spaceflight Telemetry & Avionics
 * 60 FPS Canvas Oscilloscope (Lead II ECG) & Rolling Heart Rate (BPM) Trend Graph
 */

class ECGOscilloscope {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.sweepX = 0;
    this.lastVal = 0.0;
    this.targetVal = 0.0;
    this.bpm = 71.0;
    this.phase = 0.0;
    this.isRunning = false;
    this.sweepSpeed = 2.4; // Pixels per frame
    this.eraseGap = 32;    // Pixels ahead of sweep line to erase

    this.setupCanvas();
    window.addEventListener('resize', () => this.setupCanvas());
  }

  setupCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width > 0 ? rect.width : (this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 360);
    this.height = rect.height > 0 ? rect.height : 64;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx.resetTransform) {
      this.ctx.resetTransform();
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.scale(dpr, dpr);

    this.drawGrid();
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.fillStyle = '#161b29';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.lineWidth = 0.5;
    const gridMajor = 24;
    const gridMinor = 6;

    // Minor clinical grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
    ctx.beginPath();
    for (let x = 0; x < this.width; x += gridMinor) {
      ctx.moveTo(x, 0); ctx.lineTo(x, this.height);
    }
    for (let y = 0; y < this.height; y += gridMinor) {
      ctx.moveTo(0, y); ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // Major clinical grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.beginPath();
    for (let x = 0; x < this.width; x += gridMajor) {
      ctx.moveTo(x, 0); ctx.lineTo(x, this.height);
    }
    for (let y = 0; y < this.height; y += gridMajor) {
      ctx.moveTo(0, y); ctx.lineTo(this.width, y);
    }
    ctx.stroke();
  }

  setBPM(bpm) {
    if (bpm && bpm > 20 && bpm < 250) {
      this.bpm = bpm;
    }
  }

  updateECGAmplitude(amp) {
    this.targetVal = amp !== undefined ? amp : 0.0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animate();
  }

  // Synthesize realistic P-Q-R-S-T biopotential complex
  computeECGSample(p) {
    let val = 0.0;
    // P wave: atrial depolarization
    if (p >= 0.12 && p <= 0.22) {
      val += 0.16 * Math.sin((p - 0.12) / 0.10 * Math.PI);
    }
    // Q wave: septal depolarization
    else if (p >= 0.32 && p <= 0.35) {
      val -= 0.18 * Math.sin((p - 0.32) / 0.03 * Math.PI);
    }
    // R peak: ventricular depolarization
    else if (p >= 0.35 && p <= 0.40) {
      val += 1.35 * Math.sin((p - 0.35) / 0.05 * Math.PI);
    }
    // S wave: late ventricular depolarization
    else if (p >= 0.40 && p <= 0.43) {
      val -= 0.28 * Math.sin((p - 0.40) / 0.03 * Math.PI);
    }
    // T wave: ventricular repolarization
    else if (p >= 0.55 && p <= 0.72) {
      val += 0.32 * Math.sin((p - 0.55) / 0.17 * Math.PI);
    }
    return val;
  }

  animate() {
    if (!this.isRunning || !this.ctx) return;

    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = now;

    // Advance cardiac phase based on current BPM (beats per second = bpm / 60)
    const beatsPerSecond = this.bpm / 60.0;
    this.phase = (this.phase + dt * beatsPerSecond) % 1.0;

    const syntheticAmp = this.computeECGSample(this.phase);
    // Combine with external hardware / sensor amplitude if provided
    const combinedAmp = Math.abs(this.targetVal) > 0.05 ? this.targetVal : syntheticAmp;

    const ctx = this.ctx;
    const centerY = this.height * 0.52;
    const scaleY = this.height * 0.40;

    this.lastVal = this.lastVal + (combinedAmp - this.lastVal) * 0.45;
    const currentY = centerY - (this.lastVal * scaleY);

    const prevX = this.sweepX;
    this.sweepX += this.sweepSpeed;

    if (this.sweepX >= this.width) {
      this.sweepX = 0;
    }

    // Erase a gap ahead of the phosphor sweep line
    ctx.fillStyle = '#161b29';
    ctx.fillRect(this.sweepX, 0, this.eraseGap, this.height);

    // Redraw faint grid in the erased section
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let gx = Math.floor(this.sweepX / 24) * 24; gx < this.sweepX + this.eraseGap; gx += 24) {
      ctx.moveTo(gx, 0); ctx.lineTo(gx, this.height);
    }
    ctx.stroke();

    // Radiant sweep glow bar
    ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.fillRect(this.sweepX, 0, 2.5, this.height);

    // Draw ECG Lead line
    if (prevX < this.sweepX) {
      ctx.strokeStyle = this.bpm > 115 ? '#ffb4ab' : '#00e5ff';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = this.bpm > 115 ? '#ffb4ab' : '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const prevY = this.prevCalculatedY !== undefined ? this.prevCalculatedY : currentY;
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(this.sweepX, currentY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    this.prevCalculatedY = currentY;

    requestAnimationFrame(() => this.animate());
  }
}

/**
 * Historical Rolling Heart Rate (BPM) Trend Graph
 * Displays rolling 60-second / 5-minute BPM curves with baseline tolerance zones
 */
class HeartRateTrendGraph {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.dataPoints = []; // [{ time: timestamp, bpm: number }]
    this.minBPM = 40;
    this.maxBPM = 160;

    this.setupCanvas();
    window.addEventListener('resize', () => this.setupCanvas());
  }

  setupCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width > 0 ? rect.width : (this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 360);
    this.height = rect.height > 0 ? rect.height : 80;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx.resetTransform) {
      this.ctx.resetTransform();
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  updateData(points) {
    this.dataPoints = points || [];
    this.render();
  }

  addPoint(bpm) {
    if (bpm === undefined || bpm === null) return;
    this.dataPoints.push({ time: Date.now(), bpm: bpm });
    if (this.dataPoints.length > 60) {
      this.dataPoints.shift();
    }
    this.render();
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background
    ctx.fillStyle = '#161b29';
    ctx.fillRect(0, 0, w, h);

    // Baseline Normal Band (60 - 80 BPM)
    const normTop = h - ((80 - this.minBPM) / (this.maxBPM - this.minBPM)) * h;
    const normBottom = h - ((60 - this.minBPM) / (this.maxBPM - this.minBPM)) * h;
    ctx.fillStyle = 'rgba(5, 231, 119, 0.08)';
    ctx.fillRect(0, normTop, w, normBottom - normTop);

    // Warning Threshold Line (100 BPM)
    const warnY = h - ((100 - this.minBPM) / (this.maxBPM - this.minBPM)) * h;
    ctx.strokeStyle = 'rgba(255, 183, 120, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, warnY); ctx.lineTo(w, warnY);
    ctx.stroke();

    // Critical Threshold Line (120 BPM)
    const critY = h - ((120 - this.minBPM) / (this.maxBPM - this.minBPM)) * h;
    ctx.strokeStyle = 'rgba(255, 180, 171, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, critY); ctx.lineTo(w, critY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Labels
    ctx.fillStyle = 'rgba(221, 226, 245, 0.4)';
    ctx.font = '10px "Space Grotesk", monospace';
    ctx.fillText('120 BPM (CRIT)', 6, critY - 3);
    ctx.fillText('100 BPM (WARN)', 6, warnY - 3);
    ctx.fillText('60-80 BPM (NOMINAL)', 6, normBottom - 4);

    if (this.dataPoints.length < 2) return;

    // Draw Spline BPM Curve
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();

    const stepX = w / (this.dataPoints.length - 1);
    this.dataPoints.forEach((pt, idx) => {
      const val = Math.max(this.minBPM, Math.min(this.maxBPM, pt.bpm || pt.hr || 70));
      const x = idx * stepX;
      const y = h - ((val - this.minBPM) / (this.maxBPM - this.minBPM)) * h;

      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw gradient area under the curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw current point indicator
    const lastPt = this.dataPoints[this.dataPoints.length - 1];
    const lastVal = lastPt.bpm || lastPt.hr || 70;
    const lastX = w;
    const lastY = h - ((lastVal - this.minBPM) / (this.maxBPM - this.minBPM)) * h;

    ctx.fillStyle = lastVal > 115 ? '#ffb4ab' : '#05e777';
    ctx.beginPath();
    ctx.arc(lastX - 4, lastY, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

window.ECGOscilloscope = ECGOscilloscope;
window.HeartRateTrendGraph = HeartRateTrendGraph;
