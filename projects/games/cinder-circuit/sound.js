(() => {
  "use strict";

  function createSound() {
    let context;
    let heat;
    let enabled = true;
    const voices = {
      burn: [94, 49, 0.16, 0.08, "triangle"],
      coin: [970, 1380, 0.085, 0.034, "sine"],
      bank: [435, 865, 0.32, 0.095, "sine"],
      royalOpen: [283, 523, 0.25, 0.07, "triangle"],
      royal: [527, 990, 0.42, 0.084, "sine"],
      royalDeparture: [390, 655, 0.28, 0.052, "sine"],
      hit: [150, 46, 0.23, 0.13, "triangle"],
      fall: [320, 40, 0.55, 0.1, "triangle"],
      dash: [150, 236, 0.19, 0.075, "triangle"],
      upgrade: [655, 1085, 0.36, 0.066, "sine"],
      phase: [150, 225, 0.72, 0.083, "sine"],
      finish: [338, 680, 0.72, 0.087, "sine"]
    };
    let lastCoin = -1;

    function unlock() {
      if (!enabled || !window.AudioContext) return;
      if (!context) {
        context = new AudioContext();
        const buffer = context.createBuffer(1,context.sampleRate,context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i=0;i<data.length;i+=1) data[i] = Math.random()*2-1;
        const noise = context.createBufferSource();
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 560;
        noise.buffer = buffer;
        noise.loop = true;
        heat = context.createGain();
        heat.gain.value = 0;
        noise.connect(filter).connect(heat).connect(context.destination);
        noise.start();
      }
      if (context.state !== "running") void context.resume().catch(() => {});
    }

    function event(type) {
      if (!enabled || context?.state !== "running" || !voices[type]) return;
      const now = context.currentTime;
      if (type === "coin" && now-lastCoin < .045) return;
      if (type === "coin") lastCoin = now;
      const [from,to,length,volume,wave] = voices[type];
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.001,now);
      gain.gain.exponentialRampToValueAtTime(volume,now+.012);
      gain.gain.exponentialRampToValueAtTime(.001,now+length);
      const tone = context.createOscillator();
      tone.type = wave;
      tone.frequency.setValueAtTime(from,now);
      tone.frequency.exponentialRampToValueAtTime(to,now+length*.82);
      tone.connect(gain).connect(context.destination);
      tone.start(now);
      tone.stop(now+length);
    }

    function firing(active) {
      if (heat && context.state === "running") {
        heat.gain.setTargetAtTime(enabled && active ? .15 : 0,context.currentTime,.035);
      }
    }

    function toggle() {
      enabled = !enabled;
      if (enabled) unlock();
      else firing(false);
      return enabled;
    }

    return {unlock, event, firing, toggle};
  }

  globalThis.CinderSound = {createSound};
})();
