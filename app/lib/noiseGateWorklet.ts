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

    // Fast attack (to not cut transients) and slower release (to not click)
    const attackCoef = 0.05; 
    const releaseCoef = 0.002; 
    const gainAttack = 0.1; 
    const gainRelease = 0.005;

    for (let c = 0; c < input.length; c++) {
      const inChannel = input[c];
      const outChannel = output[c];

      for (let i = 0; i < inChannel.length; i++) {
        // Track envelope strictly on the left channel (0) to avoid stereo phase wandering
        if (c === 0) {
           const absIn = Math.abs(inChannel[i]);
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
        }
        
        outChannel[i] = inChannel[i] * this.gain;
      }
    }
    return true;
  }
}
registerProcessor('noise-gate-processor', NoiseGateProcessor);
`;
