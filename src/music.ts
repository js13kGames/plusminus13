const envelopes = (i: number, c: number, s: number) => {
  const minIntensity = 0.2;
  const skewF = 0.96;
  const t = (1000 + (i + 2 * Math.sin(c) + c * s)) / s;
  return [
    minIntensity + (0.5 - minIntensity) * (1 + Math.sin(2 * Math.PI * 0.1 * t)),
    (2.6 +
      (1 / skewF) *
        Math.atan(
          (skewF * Math.sin((Math.PI / 5) * t - 1)) / (1 - skewF * Math.cos((Math.PI / 5) * t - 1)),
        )) /
      1 -
      3 * Math.abs(Math.sin((Math.PI / 10) * t - Math.PI)),
  ];
};
export default class Music {
  _audioContext: AudioContext;
  _noteCount: number;
  _notes: { [key: string]: number };
  _arpeggioDurations: number[][];
  _chorusDurations: number[];
  _chorusSequence: string[];
  _oscillatorPool: { oscillator: OscillatorNode; gain: GainNode }[];
  _currentOscillator: number;
  _sampleRate: number;
  _started = false;

  constructor() {
    this._audioContext = new AudioContext();
    this._sampleRate = this._audioContext.sampleRate;
    // Function to create a basic impulse response for reverb

    const reverb = this._audioContext.createConvolver();
    reverb.buffer = this._createReverbIR(2, 2); // 2 seconds reverb, decay factor 2
    reverb.connect(this._audioContext.destination);

    const filter = this._audioContext.createBiquadFilter();
    filter.type = "lowpass";

    filter.Q.value = 1;

    // scriptNode.connect(filter);
    // filter.connect(this._audioContext.destination);
    // filter.connect(reverb);  // Connect the node to the audio context

    this._noteCount = 0;

    this._notes = {
      "C": 261.63,
      "C#": 277.18,
      "D": 293.66,
      "D#": 311.13,
      "E": 329.63,
      "F": 349.23,
      "F#": 369.99,
      "G": 392.0,
      "G#": 415.3,
      "A": 440.0,
      "A#": 466.16,
      "B": 493.88,
    };

    for (const note in this._notes) {
      this._notes[note + "'"] = this._notes[note] * 2; // Using ' to denote the next octave
    }

    this._chorusSequence = [
      "C'",
      "B",
      "A",
      "C'",
      "B",
      "A",
      "B",
      "A",
      "G",
      "A",
      "C'",
      "B",
      "A",
      "C'",
      "B",
      "A",
      "G",
      "B",
      "A",
      "G",
      "A",
      "A",
      "B",
      "B",
      "C'",
      "C'",
      "D'",
      "C'",
      "B",
      "C'",
      "B",
      "A",
    ];

    this._chorusDurations = [
      1, 0.125, 0.125, 0.75, 0.25, 0.25, 0.25, 0.25, 1, 0.125, 0.125, 0.75, 0.5, 0.75, 0.75, 1,
      0.25, 0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 0.75, 0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.25,
    ];

    this._arpeggioDurations = [
      [0.75, 0.75, 0.25, 0.25, 0.125, 0.125, 0.75, 1],
      [0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      [0.125, 0.25, 0.375, 0.75, 0.375, 0.25, 0.125, 1.75],
      // [0.125, 0.125, 0.125, 0.125, 0.75, 0.5, 0.5, 0.75],
      // [0.75, 0.75, 0.5, 0.25, 0.125, 0.125, 0.25, 0.25],
      // [0.375, 0.125, 0.375, 0.125, 0.5, 0.25, 0.125, 0.125],
      // [0.5, 0.25, 0.25, 0.5, 0.25, 0.25, 0.5, 0.5]
    ];

    this._currentOscillator = 0;

    this._oscillatorPool = new Array(2).fill(0).map(() => {
      const oscillator = this._audioContext.createOscillator();
      oscillator.type = "triangle";
      const gain = this._audioContext.createGain();
      gain.gain.value = 0.0;
      oscillator.connect(gain);
      gain.connect(reverb);
      oscillator.start(this._audioContext.currentTime);
      oscillator.detune.value = 1;
      return { oscillator, gain };
    });

    this.init();
  }

  async init() {
    // await this._audioContext.audioWorklet.addModule(new URL("./waveProcessor.js", import.meta.url));
    // const waveProcessor = new AudioWorkletNode(this._audioContext, "waveProcessor");
    // waveProcessor.port.postMessage(envelopes.toString());
    // Low pass filter
    const filter = this._audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1;
    // waveProcessor.connect(filter);
    filter.connect(this._audioContext.destination);
    setInterval(() => {
      filter.frequency.exponentialRampToValueAtTime(
        300 +
          400 *
            envelopes(0, this._audioContext.currentTime + 0.1, this._audioContext.sampleRate)[1],
        this._audioContext.currentTime + 0.1,
      );
    }, 100);
    // filter.frequency.value =
    //   300 + 2000 * envelopes(0, this._audioContext.currentTime, this._audioContext.sampleRate)[1];

    // waveProcessor.connect(this._audioContext.destination);
  }

  // filter.frequency.value = baseFreq + freqRange * crashEnvelope;
  //   }
  // };
  // Low pass filter
  _createReverbIR(duration: number, decay: number) {
    const length = this._sampleRate * duration;
    const impulse = this._audioContext.createBuffer(2, length, this._sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      impulseL[i] = (Math.random() * 100 - 1) * Math.pow(1 - i / length, decay);
      impulseR[i] = (Math.random() * 100 - 1) * Math.pow(1 - i / length, decay);
    }

    return impulse;
  }

  _playKick() {
    // console.log("kick", this._audioContext.currentTime);
    const osc = this._audioContext.createOscillator();
    const gainNode = this._audioContext.createGain();

    osc.type = "sine";

    const filter = this._audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, this._audioContext.currentTime);

    osc.frequency.setValueAtTime(80, this._audioContext.currentTime + 0.01);
    // gainNode.gain.linearRampToValueAtTime(0.3, this._audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.8, this._audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this._audioContext.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this._audioContext.currentTime + 0.5);
    // Connect the gain node to a low pass filter

    osc.connect(gainNode);

    gainNode.connect(filter);
    filter.connect(this._audioContext.destination);

    osc.start(this._audioContext.currentTime + 0.02);
    osc.stop(this._audioContext.currentTime + 0.5);
    // Allowed to run again after 1 second
    this._scheduleAlignedTimeout(() => this._playKick(), 1000, this._audioContext.currentTime + 1);
  }

  _generateArpeggioSequence(rootNote: string, pattern: string): string[] {
    // Define the intervals for a major chord (root, third, fifth)
    const majorChord: { [key: number]: number } = {
      1: 0, // Root
      2: 4, // Major third
      3: 7, // Perfect fifth
      4: 12, // Octave
    };

    // Use a lookup table for note frequencies (in this case, just the C Major scale)

    // Identify the root note's index in the lookup table
    const rootIndex = Object.keys(this._notes).indexOf(rootNote);
    if (rootIndex === -1) {
      return [];
    }

    const sequence = [];
    for (let i = 0; i < pattern.length; i++) {
      const interval = majorChord[parseInt(pattern[i])];
      if (interval === undefined) {
        return [];
      }
      const noteIndex = rootIndex + interval;
      sequence.push(Object.keys(this._notes)[noteIndex]);
    }

    return sequence || [];
  }

  _playRandomNote() {
    // Play arpeggio every notes, but not on the first note
    // Chorus on every 48th note
    if (this._noteCount === 0 || this._noteCount % 48 !== 0) {
      const rootNote = Object.keys(this._notes)[Math.floor(Math.random() * 12)]; // C
      const arpeggioPattern = ["13133411", "34121234", "34132312", "12314321"][
        Math.floor(Math.random() * 4)
      ];
      const sequence = this._generateArpeggioSequence(rootNote, arpeggioPattern);
      const durations =
        this._arpeggioDurations[Math.floor(Math.random() * this._arpeggioDurations.length)];

      this._scheduleAlignedTimeout(() => this._playSequence(sequence, durations), 2000);
    } else if (this._noteCount % 48 === 0 && this._noteCount > 0) {
      this._scheduleAlignedTimeout(
        () => this._playSequence(this._chorusSequence, this._chorusDurations),
        2000,
      );
    } else {
      // const freq = freqValues[Math.floor(Math.random() * freqValues.length)];
      // const randomLength = Math.random() * 1000 + 500;
      // const randomLength2 = Math.random() * 1000 +500;
      // playNote(freq, randomLength);
      // this._noteCount++;
      // setTimeout(playRandomNote, randomLength);
    }
  }

  _playSequence(sequence: string[], durations: number[]) {
    let delay = 0;
    for (let i = 0; i < sequence.length; i++) {
      const duration = durations[i] * 1000;

      setTimeout(
        () => this._playNote(this._notes[sequence[i]], duration * (1 + Math.random() * 0.05)),
        delay,
      );
      // Set some random delays for natural feel
      delay += duration;
    }
    setTimeout(() => this._playRandomNote(), delay);
  }

  _playNote(freq: number, duration: number) {
    // console.log(this._noteCount, freq, duration, this._audioContext.currentTime);
    this._noteCount++;
    if (!freq) {
      return;
    }
    const { oscillator, gain } = this._oscillatorPool[this._currentOscillator];

    const attack = 0.01;
    const decay = duration / 1000.0 / 3.5;
    const sustain = 0.8;
    const release = duration / 1000.0 / 3.5;
    const triggerTime = this._audioContext.currentTime;

    gain.gain.setValueAtTime(0.0, this._audioContext.currentTime);
    oscillator.frequency.setTargetAtTime(freq / 2, this._audioContext.currentTime, attack);
    gain.gain.linearRampToValueAtTime(0.8, triggerTime + attack);
    gain.gain.linearRampToValueAtTime(sustain, triggerTime + attack + decay);
    gain.gain.linearRampToValueAtTime(0.0, triggerTime + attack + decay + release);

    this._currentOscillator = (this._currentOscillator + 1) % 2;
  }

  _scheduleAlignedTimeout(callback: () => void, interval = 2000, nextStartTime = 0) {
    const currentTime = this._audioContext.currentTime;
    const nextGridTime = (Math.ceil((currentTime * 1000) / interval) * interval) / 1000; // Find the next grid point
    const timeoutDuration = (nextGridTime - currentTime) * 1000; // Convert to milliseconds
    // console.log(audioContext.currentTime, nextStartTime);

    if (timeoutDuration > 1986 && nextStartTime < currentTime) {
      callback();
    } else {
      setTimeout(() => {
        callback();
      }, timeoutDuration);
    }
  }

  start() {
    if (this._started) {
      return;
    }
    this._started = true;
    this._playRandomNote(); // Start the melody
    setTimeout(() => {
      this._scheduleAlignedTimeout(() => this._playKick(), 2000);
    }, 4000);
  }
}
