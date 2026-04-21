export const noiseGateWorkletCode = `
class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'threshold', defaultValue: -100, minValue: -100, maxValue: 0 }];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.gain = 1;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    // Use a-rate or k-rate threshold param
    const thresholdDB = parameters.threshold.length > 1 ? parameters.threshold[0] : parameters.threshold[0];
    
    // If set to -100dB, functionally disable the gate to save CPU
    if (thresholdDB <= -99) {
      for (let c = 0; c < input.length; c++) {
        output[c].set(input[c]);
      }
      return true;
    }

    const threshold = Math.pow(10, thresholdDB / 20);

    const attackCoef = 0.05; 
    const releaseCoef = 0.002; 
    const gainAttack = 0.1; 
    const gainRelease = 0.005;

    const sampleCount = input[0].length;
    for (let i = 0; i < sampleCount; i++) {
      // Track envelope based on the first channel
      const absIn = Math.abs(input[0][i]);
      if (absIn > this.envelope) {
          this.envelope += attackCoef * (absIn - this.envelope);
      } else {
          this.envelope += releaseCoef * (absIn - this.envelope);
      }
      
      const targetGain = this.envelope > threshold ? 1 : 0;
      
      if (targetGain > this.gain) {
          this.gain += gainAttack * (targetGain - this.gain);
      } else {
          this.gain += gainRelease * (targetGain - this.gain);
      }
      
      // Apply exact smooth gain to all channels for this sample
      for (let c = 0; c < input.length; c++) {
        output[c][i] = input[c][i] * this.gain;
      }
    }
    
    return true;
  }
}
registerProcessor('noise-gate-processor', NoiseGateProcessor);
`;
