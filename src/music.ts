export default class Music {
  private audioContext: AudioContext;
  private isPlaying = false;
  private tempo = 60;
  private currentTime = 0;
  private nextNoteTime = 0;
  private timerID: number | null = null;
  private currentChord = 0;

  private measureCount = 0;
  private chorusMelodyIndex = 0;
  private chorusMelodyTime = 0;
  private bassNoteTime = 0;
  private currentBassIndex = 0;
  private currentSection: "verse" | "bridge" | "chorus" = "verse";

  private verseChords = [
    { root: "C4", chord: ["C4", "E4", "G4"] },
    { root: "F4", chord: ["F4", "A4", "C5"] },
    { root: "G4", chord: ["G4", "B4", "D5"] },
    { root: "Am", chord: ["A4", "C5", "E5"] },
  ];

  private bridgeChords = [
    { root: "Dm", chord: ["D4", "F4", "A4"] },
    { root: "G4", chord: ["G4", "B4", "D5"] },
    { root: "Em", chord: ["E4", "G4", "B4"] },
    { root: "Am", chord: ["A4", "C5", "E5"] },
  ];

  private chorusChords = [
    { root: "C4", chord: ["C4", "E4", "G4"] },
    { root: "Am", chord: ["A4", "C5", "E5"] },
    { root: "F4", chord: ["F4", "A4", "C5"] },
    { root: "G4", chord: ["G4", "B4", "D5"] },
  ];

  private chorusMelody = [
    { note: "C5", duration: 0.25 },
    { note: "B4", duration: 0.25 },
    { note: "A4", duration: 0.5 },
    { note: "C5", duration: 0.25 },
    { note: "B4", duration: 0.25 },
    { note: "A4", duration: 0.5 },
    { note: "B4", duration: 0.5 },
    { note: "A4", duration: 0.5 },
    { note: "G4", duration: 0.25 },
    { note: "A4", duration: 0.75 },
    { note: "C5", duration: 0.25 },
    { note: "B4", duration: 0.25 },
    { note: "A4", duration: 0.5 },
    { note: "C5", duration: 0.25 },
    { note: "B4", duration: 0.25 },
    { note: "A4", duration: 0.5 },
    { note: "G4", duration: 0.5 },
    { note: "B4", duration: 0.5 },
    { note: "A4", duration: 0.25 },
    { note: "G4", duration: 1.0 },
    { note: "A4", duration: 0.25 },
    { note: "A4", duration: 0.5 },
    { note: "B4", duration: 0.25 },
    { note: "B4", duration: 0.5 },
    { note: "C5", duration: 0.25 },
    { note: "C5", duration: 0.25 },
    { note: "D5", duration: 0.25 },
    { note: "C5", duration: 0.25 },
    { note: "B4", duration: 0.25 },
    { note: "C5", duration: 0.25 },
    { note: "B4", duration: 0.25 },
    { note: "A4", duration: 1.0 },
  ];

  private melodyPatterns = [
    [
      { note: "C5", duration: 0.5 },
      { note: "E5", duration: 0.25 },
      { note: "G5", duration: 0.25 },
      { note: "C6", duration: 0.5 },
      { note: "G5", duration: 0.25 },
      { note: "E5", duration: 0.25 },
    ],
    [
      { note: "E5", duration: 0.25 },
      { note: "G5", duration: 0.25 },
      { note: "C6", duration: 0.25 },
      { note: "D6", duration: 0.125 },
      { note: "C6", duration: 0.125 },
      { note: "G5", duration: 0.5 },
      { note: "E5", duration: 0.5 },
    ],
  ];

  private bridgeMelodyPattern = [
    { note: "D5", duration: 0.75 },
    { note: "F5", duration: 0.25 },
    { note: "A5", duration: 0.5 },
    { note: "G5", duration: 0.5 },
    { note: "E5", duration: 0.75 },
    { note: "G5", duration: 0.25 },
    { note: "C6", duration: 1 },
  ];

  private bassPatterns = [
    [
      { note: "C2", duration: 1 },
      { note: "G2", duration: 0.5 },
      { note: "C3", duration: 1 },
    ],
    [
      { note: "C2", duration: 1 },
      { note: "G2", duration: 0.5 },
      { note: "C3", duration: 1 },
      { note: "G2", duration: 0.5 },
    ],
  ];

  private chorusBassPattern = [
    { note: "C2", duration: 0.5 },
    { note: "G2", duration: 0.5 },
    { note: "C3", duration: 0.25 },
    { note: "G2", duration: 0.25 },
    { note: "C2", duration: 0.5 },
    // { note: "G2", duration: 0.5 },
    // { note: "C3", duration: 0.5 },
  ];

  private drumPatterns = [
    [
      { type: "kick", time: 0 },
      { type: "snare", time: 0.5 },
      { type: "kick", time: 1 },
      { type: "snare", time: 1.5 },
    ],
    [
      { type: "kick", time: 0.0 },
      { type: "snare", time: 0.25 },
      { type: "kick", time: 0.5 },
      { type: "snare", time: 1.0 },
      { type: "kick", time: 1.5 },
    ],
  ];

  private reverb!: ConvolverNode;
  private filter!: BiquadFilterNode;
  private distortion!: WaveShaperNode;
  filter2: any;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this._setupEffects();
  }

  private _setupEffects() {
    this.reverb = this.audioContext.createConvolver();
    this.reverb.buffer = this._createReverbIR(1.4, 2); // Shorter reverb for faster rhythm

    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 3000; // Higher cutoff for brighter sound
    this.filter.Q.value = 1.0; // Increased resonance for more character

    this.filter2 = this.audioContext.createBiquadFilter();
    this.filter2.type = "lowpass";
    this.filter2.frequency.value = 3000; // Higher cutoff for brighter sound
    this.filter2.Q.value = 5.0; // Increased resonance for more character

    // this.distortion = this.audioContext.createWaveShaper();
    // this.distortion.curve = this._makeDistortionCurve(50); // Amount of distortion
    // this.distortion.oversample = "4x"; // Options are 'none', '2x', or '4x'
  }

  private _createReverbIR(duration: number, decay: number) {
    const length = this.audioContext.sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }

    return impulse;
  }

  // private _makeDistortionCurve(amount: number): Float32Array {
  //   const k = typeof amount === "number" ? amount : 50;
  //   const numSamples = 44100;
  //   const curve = new Float32Array(numSamples);
  //   const deg = Math.PI / 180;

  //   for (let i = 0; i < numSamples; ++i) {
  //     const x = (i * 2) / numSamples - 1;
  //     curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  //   }

  //   return curve;
  // }

  private noteToFrequency(note: string): number {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = parseInt(note.slice(-1));
    const semitone = notes.indexOf(note.slice(0, -1));
    return 440 * Math.pow(2, (semitone - 9) / 12 + (octave - 4));
  }

  private createOscillator(
    type: OscillatorType,
    frequency: number,
    start: number,
    duration: number,
    gain = 1.0,
  ): void {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.connect(gainNode);

    // Connect through effects chain
    gainNode.connect(this.filter);
    this.filter.connect(this.reverb);
    // this.distortion.connect(this.audioContext.destination);
    this.reverb.connect(this.audioContext.destination);
    // gainNode.connect(this.audioContext.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    // gainNode.gain.setValueAtTime(0.9, start);
    // gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

    const attack = 0.01;
    const decay = duration * 0.3;
    const sustain = 0.7;
    const release = duration * 0.2;

    oscillator.frequency.setValueAtTime(frequency, start);
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(gain, start + attack);
    gainNode.gain.linearRampToValueAtTime(sustain * (gain / 2), start + attack + decay);
    gainNode.gain.setValueAtTime(sustain * gain, start + duration - release);
    gainNode.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private playNote(note: string, start: number, duration: number, gain = 1): void {
    this.createOscillator("sawtooth", this.noteToFrequency(note), start, duration, gain);
  }

  private playBassNote(note: string, start: number, duration: number): void {
    // console.log("Bass note", note, duration);
    this.createOscillator("triangle", this.noteToFrequency(note), start, duration, 0.7);
  }

  private playChord(chord: string[], start: number, duration: number): void {
    chord.forEach((note) => {
      this.createOscillator("triangle", this.noteToFrequency(note), start, duration, 0.2);
    });
  }

  private playCounterMelody(note: string, start: number, duration: number): void {
    this.createOscillator("sawtooth", this.noteToFrequency(note), start, duration * 0.8, 0.4);
  }

  private playDrum(type: string, time: number): void {
    if (type === "kick") {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      oscillator.connect(gainNode);

      // Connect kick drum directly to destination for punchier sound
      gainNode.connect(this.filter2);
      this.filter2.connect(this.audioContext.destination);
      // this.reverb.connect(this.audioContext.destination);

      // gainNode.connect(this.audioContext.destination);

      const length = 0.5 * (60 / this.tempo);
      oscillator.frequency.setValueAtTime(160, time);
      oscillator.frequency.exponentialRampToValueAtTime(0.01, time + length);

      gainNode.gain.setValueAtTime(0.3, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + length);

      oscillator.start(time);
      oscillator.stop(time + length);
      // this.setNextTempo();
    } else if (type === "snare") {
      const noise = this.audioContext.createBufferSource();
      const noiseBuffer = this.audioContext.createBuffer(
        1,
        this.audioContext.sampleRate * 0.05,
        this.audioContext.sampleRate,
      );
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      noise.buffer = noiseBuffer;

      const gainNode = this.audioContext.createGain();
      noise.connect(gainNode);

      // Connect snare through effects for more body
      // gainNode.connect(this.audioContext.destination);
      gainNode.connect(this.filter2);
      this.filter2.connect(this.reverb);
      this.reverb.connect(this.audioContext.destination);

      gainNode.gain.setValueAtTime(0.4, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      noise.start(time);
    }
  }
  private resetChorusState(): void {
    this.chorusMelodyIndex = 0;
    this.chorusMelodyTime = 0;
  }

  private scheduleNote(): void {
    const secondsPerBeat = 60.0 / this.tempo;

    while (this.nextNoteTime < this.audioContext.currentTime + 0.1) {
      const currentMeasure = Math.floor(this.currentTime / 4);
      const currentBeat = this.currentTime % 4;

      if (currentBeat === 0) {
        this.currentChord = (this.currentChord + 1) % 4;
        this.measureCount++;

        // console.log("Measure", this.measureCount);
        if (this.measureCount % 4 === 0) {
          const previousSection = this.currentSection;
          this.currentSection = this.getNextSection();
          this.currentChord = 0;

          // Reset chorus state when transitioning out of chorus
          if (previousSection === "chorus" && this.currentSection !== "chorus") {
            this.resetChorusState();
          }
        }
      }

      const chords = this.getCurrentChords();

      // Play chord
      if (currentBeat % 1 === 0) {
        this.playChord(chords[this.currentChord].chord, this.nextNoteTime, secondsPerBeat);
      }

      // Play melody
      this.playCurrentSectionMelody(currentMeasure, currentBeat, secondsPerBeat);

      // Play bass
      let bassPattern;
      if (this.currentSection === "chorus") {
        bassPattern = this.chorusBassPattern;
      } else {
        bassPattern = this.bassPatterns[currentMeasure % this.bassPatterns.length];
      }
      // Check if it's time to play the next bass note
      if (this.currentTime >= this.bassNoteTime) {
        const bassNote = bassPattern[this.currentBassIndex];
        this.playBassNote(bassNote.note, this.nextNoteTime, bassNote.duration * secondsPerBeat);

        // Update the time for the next bass note
        this.bassNoteTime += bassNote.duration;

        // Move to the next bass note in the pattern
        this.currentBassIndex = (this.currentBassIndex + 1) % bassPattern.length;

        // If we've completed the pattern, reset the bass note time to the start of the next measure
        if (this.currentBassIndex === 0) {
          this.bassNoteTime = Math.ceil(this.currentTime / 4) * 4;
        }
      }
      // Play drums
      this.playDrums(currentMeasure, currentBeat);

      this.currentTime += 0.25;
      this.nextNoteTime += 0.25 * secondsPerBeat;
    }

    this.timerID = window.setTimeout(() => this.scheduleNote(), 25);
  }

  private getNextSection(): "verse" | "bridge" | "chorus" {
    switch (this.currentSection) {
      case "verse":
        return "chorus";
      case "chorus":
        return "bridge";
      case "bridge":
        return "verse";
    }
  }

  private getCurrentChords() {
    switch (this.currentSection) {
      case "verse":
        return this.verseChords;
      case "bridge":
        return this.bridgeChords;
      case "chorus":
        return this.chorusChords;
    }
  }

  private playCurrentSectionMelody(
    currentMeasure: number,
    currentBeat: number,
    secondsPerBeat: number,
  ) {
    switch (this.currentSection) {
      case "verse":
        this.playVerseMelody(currentMeasure, currentBeat, secondsPerBeat);
        break;
      case "bridge":
        this.playBridgeMelody(currentBeat, secondsPerBeat);
        break;
      case "chorus":
        this.playChorusMelody(currentBeat, secondsPerBeat);
        break;
    }
  }

  private playVerseMelody(currentMeasure: number, currentBeat: number, secondsPerBeat: number) {
    const melodyPattern = this.melodyPatterns[currentMeasure % this.melodyPatterns.length];
    const melodyNote = melodyPattern[Math.floor(currentBeat * 2) % melodyPattern.length];
    this.playNote(melodyNote.note, this.nextNoteTime, melodyNote.duration * secondsPerBeat, 0.4);

    // Play counter-melody (call and response)
    if (currentBeat >= 2) {
      const counterMelodyNote =
        melodyPattern[(Math.floor(currentBeat * 2) + 2) % melodyPattern.length];
      this.playCounterMelody(
        counterMelodyNote.note,
        this.nextNoteTime,
        counterMelodyNote.duration * secondsPerBeat,
      );
    }
  }

  private playBridgeMelody(currentBeat: number, secondsPerBeat: number) {
    const bridgeNote =
      this.bridgeMelodyPattern[Math.floor(currentBeat) % this.bridgeMelodyPattern.length];
    this.playNote(bridgeNote.note, this.nextNoteTime, bridgeNote.duration * secondsPerBeat, 0.4);
  }

  private getCurrentChorusNote(currentBeat: number): { note: string; duration: number } | null {
    if (currentBeat === 0) {
      this.chorusMelodyTime = 0;
    }
    if (this.chorusMelodyTime <= currentBeat) {
      const currentNote = this.chorusMelody[this.chorusMelodyIndex];
      this.chorusMelodyIndex = (this.chorusMelodyIndex + 1) % this.chorusMelody.length;
      this.chorusMelodyTime += currentNote.duration;
      return currentNote;
    }
    return null;
  }

  private playChorusMelody(currentBeat: number, secondsPerBeat: number) {
    const chorusNote = this.getCurrentChorusNote(currentBeat % 4); // Use beat within measure
    // console.log("Chorus", chorusNote);
    if (chorusNote) {
      this.playNote(chorusNote.note, this.nextNoteTime, chorusNote.duration * secondsPerBeat);
    }
  }

  private playDrums(currentMeasure: number, currentBeat: number) {
    const drumPattern = this.drumPatterns[currentMeasure % this.drumPatterns.length];
    // console.log("Current drum pattern:", drumPattern);

    drumPattern.forEach((drum) => {
      // Calculate the beat within the current measure
      const measureBeat = currentBeat % 2;

      // Check if it's time to play this drum hit
      if (Math.abs(measureBeat - drum.time) < 0.001) {
        // console.log("Playing drum:", drum.type, "at beat:", measureBeat);
        this.playDrum(drum.type, this.nextNoteTime);
      }
    });

    // Add syncopation to hi-hat
    if (currentBeat % 0.5 === 0.0) {
      // this.playDrum("snare", this.nextNoteTime);
    }
  }
  public start(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentTime = 0;
    this.nextNoteTime = this.audioContext.currentTime;
    this.measureCount = 0;
    this.currentSection = "chorus";
    this.currentChord = 0;
    this.chorusMelodyIndex = 0; // Add this line
    this.chorusMelodyTime = 0; // Add this line
    this.scheduleNote();
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timerID !== null) {
      clearTimeout(this.timerID);
    }
  }

  public setNextTempo(): void {
    this.tempo += 5;
  }
}
