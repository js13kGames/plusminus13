// import { Note, Chord } from "./types"; // Assuming we have these types defined

export default class Music {
  private _audioContext: AudioContext;
  private _noteCount: number;
  private _notes: { [key: string]: number };
  private _melodySequence: string[];
  private _melodyDurations: number[];
  private _bassSequence: string[];
  private _bassDurations: number[];
  private _oscillatorPool: { oscillator: OscillatorNode; gain: GainNode }[];
  private _currentOscillator: number;
  private _sampleRate: number;
  private _started = false;
  private _tempo: number;

  private _melodyCount = 0;
  private _scheduledTimeouts: [number, NodeJS.Timeout][] = [];
  constructor() {
    this._audioContext = new AudioContext();
    this._sampleRate = this._audioContext.sampleRate;
    this._noteCount = 0;
    this._tempo = 60; // BPM

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

    // Add higher octave notes
    for (const note in this._notes) {
      this._notes[note + "'"] = this._notes[note] * 2;
      this._notes[note + "$"] = this._notes[note] / 4;
    }

    // Upbeat game-like melody
    this._melodySequence = [
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

    // Rhythm for the melody (in beats)
    this._melodyDurations = [
      1, 0.125, 0.125, 0.75, /* 2 */ 0.25, 0.25, 0.25, 0.25, 1, /* 2 */ 0.125, 0.125, 0.75, 0.5,
      0.25, 0.25 /* 2 */, 1, 0.25, 0.25, 0.25, 0.25, /*2*/ 0.25, 0.5, 0.5, 0.75, /*2*/ 0.25, 0.25,
      0.75, 0.25, 0.5 /*2*/, 0.25, 0.75, /*1*/ 1 /*1*/,
    ];
    // this._melodyDurations = [
    //   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    //   1,
    // ];
    // this._melodyDurations = this._melodyDurations.map((d) => d / 1);

    // Bass line to complement the melody
    this._bassSequence = ["C$", "C$", "F$", "F$", "G$", "G$", "C$", "C$"];

    // Rhythm for the bass (in beats)
    this._bassDurations = [2, 2, 2, 2, 2, 2, 1, 1];

    this._currentOscillator = 0;
    this._oscillatorPool = new Array(4).fill(0).map(() => this._createOscillator());

    this._setupEffects();
  }

  private _createOscillator() {
    const oscillator = this._audioContext.createOscillator();
    oscillator.type = "sawtooth"; // Changed to sawtooth for a richer game-like sound
    const gain = this._audioContext.createGain();
    gain.gain.value = 0.0;
    oscillator.connect(gain);
    oscillator.start(this._audioContext.currentTime);
    return { oscillator, gain };
  }

  private _setupEffects() {
    const reverb = this._audioContext.createConvolver();
    reverb.buffer = this._createReverbIR(1.5, 2); // Shorter reverb for faster rhythm

    const filter = this._audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 5000; // Higher cutoff for brighter sound
    filter.Q.value = 5; // Increased resonance for more character

    this._oscillatorPool.forEach(({ gain }) => {
      gain.connect(filter);
      filter.connect(reverb);
      reverb.connect(this._audioContext.destination);
    });
  }

  private _createReverbIR(duration: number, decay: number) {
    const length = this._sampleRate * duration;
    const impulse = this._audioContext.createBuffer(2, length, this._sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }

    return impulse;
  }

  private _playNote(note: string, duration: number, oscillatorIndex: number) {
    const freq = this._notes[note];
    if (!freq) return;

    const { oscillator, gain } = this._oscillatorPool[oscillatorIndex];

    const now = this._audioContext.currentTime;
    const noteDuration = (duration * 60) / this._tempo;
    const attack = 0.01;
    const decay = noteDuration * 0.3;
    const sustain = 0.7;
    const release = noteDuration * 0.2;

    oscillator.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + attack);
    gain.gain.linearRampToValueAtTime(sustain * 0.3, now + attack + decay);
    gain.gain.setValueAtTime(sustain * 0.6, now + noteDuration - release);
    gain.gain.linearRampToValueAtTime(0, now + noteDuration);
  }

  private _playMelodyOrRandomSection() {
    this._melodyCount++;

    if (this._melodyCount % 3 === 0) {
      // Play the melody every 3 iterations
      this._playMelody();
    } else {
      // Play a random slow note section
      this._playRandomSlowSection(14); // Pass the length of 14 as per your requirement
    }
  }

  private _playMelody() {
    let delay = 0;
    for (let i = 0; i < this._melodySequence.length; i++) {
      const duration = ((this._melodyDurations[i] * 60) / this._tempo) * 1000;
      this.scheduleAlignedTimeout(
        () => this._playNote(this._melodySequence[i], this._melodyDurations[i], 0),
        delay,
        "note",
      );
      delay += duration;
    }
    this.scheduleAlignedTimeout(() => this._playMelodyOrRandomSection(), delay, "melody");
  }

  private _playRandomSlowSection(totalLength: number) {
    let delay = 0;
    let accumulatedLength = 0;

    const arpeggioPatterns = [
      [1, 3, 5, 8, 5, 3, 5],
      [1, 4, 6, 8, 6, 4, 6],
      [1, 5, 7, 8, 7, 5, 7],
    ]; // Example arpeggio patterns

    const selectedPattern = arpeggioPatterns[Math.floor(Math.random() * arpeggioPatterns.length)];
    let i = 0;
    while (accumulatedLength < totalLength) {
      const randomNote = this._getNote(selectedPattern[i]); // Method to get a random note
      let randomDuration = this._getRandomDuration(); // Method to get a random duration

      if (accumulatedLength + randomDuration > totalLength) {
        // Adjust the last note to fit the total length
        randomDuration = totalLength - accumulatedLength;
      }

      const duration = ((randomDuration * 60) / this._tempo) * 1000;
      this.scheduleAlignedTimeout(
        () => this._playNote(randomNote, randomDuration, 0),
        delay,
        "note",
      );

      delay += duration;
      accumulatedLength += randomDuration;
      i = i + 1;
    }

    this.scheduleAlignedTimeout(() => this._playMelodyOrRandomSection(), delay, "melody");
  }

  // Example helper methods to get random note and duration
  private _getNote(i: number): string {
    const notes = ["C", "D", "E", "F", "G", "A", "B", "C'", "D'"]; // Example note set
    return notes[i];
  }

  private _getRandomDuration(): number {
    const durations = [0.5, 0.75, 1, 2]; // Example durations, can be whole, half, quarter, etc.
    return durations[Math.floor(Math.random() * durations.length)];
  }

  private _playBass() {
    let delay = 0;
    for (let i = 0; i < this._bassSequence.length; i++) {
      const duration = ((this._bassDurations[i] * 60) / this._tempo) * 1000;
      this.scheduleAlignedTimeout(
        () => this._playNote(this._bassSequence[i], this._bassDurations[i], 1),
        delay,
        "bass",
      );
      delay += duration;
    }
    this.scheduleAlignedTimeout(() => this._playBass(), delay, "bass");
  }

  private _playDrums() {
    const kickPattern = [1, 0, 0, 1, 0, 1, 0, 0];
    const snarePattern = [0, 0, 1, 0, 0, 0, 1, 0];
    const hihatPattern = [1, 1, 1, 1, 1, 1, 1, 1];

    const playDrumLoop = () => {
      const now = this._audioContext.currentTime;
      const sixteenthNote = 15 / this._tempo;
      for (let i = 0; i < 8; i++) {
        if (this._started) {
          if (kickPattern[i]) this._playKick(now + i * sixteenthNote);
          if (snarePattern[i]) this._playSnare(now + i * sixteenthNote);
          if (hihatPattern[i]) this._playHiHat(now + i * sixteenthNote);
        }
      }

      this.scheduleAlignedTimeout(playDrumLoop, 8 * sixteenthNote * 1000, "drum");
    };

    playDrumLoop();
  }

  private _playKick(time: number) {
    const osc = this._audioContext.createOscillator();
    const gain = this._audioContext.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.connect(gain);
    gain.connect(this._audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  private _playSnare(time: number) {
    const noise = this._audioContext.createBufferSource();
    const noiseBuffer = this._audioContext.createBuffer(
      1,
      this._audioContext.sampleRate * 0.2,
      this._audioContext.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    noise.buffer = noiseBuffer;

    const noiseGain = this._audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noise.connect(noiseGain);
    noiseGain.connect(this._audioContext.destination);

    noise.start(time);
  }

  private _playHiHat(time: number) {
    const noise = this._audioContext.createBufferSource();
    const noiseBuffer = this._audioContext.createBuffer(
      1,
      this._audioContext.sampleRate * 0.1,
      this._audioContext.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    noise.buffer = noiseBuffer;

    const noiseGain = this._audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.2, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    const filter = this._audioContext.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this._audioContext.destination);

    noise.start(time);
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._playMelody();
    this._playBass();
    this._playDrums();
  }

  stop() {
    this._started = false;
    this._oscillatorPool.forEach(({ oscillator, gain }) => {
      gain.gain.setValueAtTime(0, this._audioContext.currentTime);
      oscillator.stop(this._audioContext.currentTime + 0.5);
    });
  }

  setNextTempo() {
    // this._scheduledTimeouts.forEach(([time, timeout]) => {
    //   clearTimeout(timeout);
    // });
    // this.scheduleAlignedTimeout(
    //   () => {
    //     this._tempo += 5;
    //     this._playBass();
    //     this._playMelody();
    //     this._playDrums();
    //   },
    //   (60 / this._tempo) * 1000,
    //   "tempo",
    // );
  }

  scheduleAlignedTimeout(callback: () => void, delay = 0, name = "timeout") {
    // interval is a function of tempo
    if (!this._started) {
      return;
    }
    const interval = 60 / this._tempo;
    const currentTime = this._audioContext.currentTime;
    const nextGridTime = Math.ceil(currentTime / interval) * interval; // Find the next grid point
    let timeoutDuration = (nextGridTime - currentTime) * 1000 + delay + Math.random() * 30; // Convert to milliseconds

    // if it's super close to the previous grid point, do it now
    const previousGridTime = Math.floor(currentTime / interval) * interval;
    if (currentTime - previousGridTime < 0.05) {
      timeoutDuration = delay;
    }

    // console.log("nextGridtime", nextGridTime, "name", name, "timeoutDuration", timeoutDuration);
    this._scheduledTimeouts.push([
      currentTime * 1000 + timeoutDuration,
      setTimeout(() => {
        callback();
        // remove the timeout from the list
      }, timeoutDuration),
    ]);
    // Clear timeouts that have already passed
    this._scheduledTimeouts = this._scheduledTimeouts.filter(([time, timeout]) => {
      if (time < currentTime * 1000) {
        clearTimeout(timeout);
        return false;
      }
      return true;
    });
  }
}
