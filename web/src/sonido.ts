// Pequeños "beeps" de confirmación (como los de una pistola lectora real) sin
// depender de ningún archivo de audio: se generan con Web Audio API.
let ctx: AudioContext | null = null;

function tono(frecuencia: number, duracionMs: number, volumen = 0.15) {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frecuencia;
    gain.gain.value = volumen;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracionMs / 1000);
    osc.stop(ctx.currentTime + duracionMs / 1000);
  } catch {
    // Si el navegador bloquea audio sin interacción previa, simplemente no suena.
  }
}

export function beepExito() {
  tono(1500, 90);
}

export function beepError() {
  tono(220, 220);
}
