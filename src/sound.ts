const gsound = (e: number, V: number) => {
  const D = [];
  for (let i = 0; i < 44100 * V; i++) {
    const b = (e: number, t: number, a: number, i: number) => Math.sin((e / t) * 6.28 * a + i);
    const w = (e: number, t: number) =>
      Math.sin(
        (e / 44100) * t * 6.28 +
          b(e, 44100, t, 0) ** 3 +
          0.75 * b(e, 44100, t, 0.25) +
          0.1 * b(e, 44100, t, 0.5),
      );

    D[i] =
      i < 88
        ? (i / 88.2) * w(i, e)
        : (1 - (i - 88.2) / (44100 * (V - 0.002))) ** ((0.5 * Math.log((1e4 * e) / 44100)) ** 2) *
          w(i, e);
  }
  return D;
};

const ac = new window.AudioContext();

const getBuffer = (D: number[]) => {
  const buffer = ac.createBuffer(1, D.length, 44100);
  buffer.getChannelData(0).set(D);
  return buffer;
};

// Frequencies for one octave
const frequencies = [609, 653, 705, 822, 887, 954, 1050].map((f) => f / 8);
// Generate three octaves
const soundBuffers: AudioBuffer[] = [];
for (let i = -1; i < 3; i++) {
  soundBuffers.push(...frequencies.map((f) => getBuffer(gsound(f * Math.pow(2, i), 0.65))));
}

// Function to play a random sound
export function playRandomSound() {
  const note = Math.floor(Math.random() * soundBuffers.length);
  const bufferSource = ac.createBufferSource();

  bufferSource.buffer = soundBuffers[note];
  bufferSource.connect(ac.destination);
  bufferSource.start(0);
}

export function playSound(note: number) {
  const bufferSource = ac.createBufferSource();

  bufferSource.buffer = soundBuffers[note];
  // Make it quieter
  const gain = ac.createGain();
  gain.gain.value = 0.5;
  bufferSource.connect(gain);
  gain.connect(ac.destination);
  //   bufferSource.connect(ac.destination);
  bufferSource.start(0);
}
