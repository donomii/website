(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installSound = function (context) {
    with (context) {
      let audioCtx = null;
      let masterGain = null;
      let noiseBuffer = null;

      function audioAvailable() {
        if (typeof window === "undefined") return false;
        const Ctor = window.AudioContext || window.webkitAudioContext;
        return !!Ctor;
      }

      function getAudioContext() {
        if (audioCtx) return audioCtx;
        if (!audioAvailable()) return null;
        try {
          const Ctor = window.AudioContext || window.webkitAudioContext;
          audioCtx = new Ctor();
          masterGain = audioCtx.createGain();
          masterGain.gain.value = 0.4;
          masterGain.connect(audioCtx.destination);
        } catch (error) {
          audioCtx = null;
          masterGain = null;
        }
        return audioCtx;
      }

      function soundEnabled() {
        const settings = typeof readSettings === "function" ? readSettings() : {};
        return settings.sound !== false; // default on
      }

      function ensureNoiseBuffer() {
        if (noiseBuffer || !audioCtx) return noiseBuffer;
        const length = Math.floor(audioCtx.sampleRate * 0.3);
        const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
        noiseBuffer = buffer;
        return buffer;
      }

      function playTone(opts) {
        const ctx = getAudioContext();
        if (!ctx || !soundEnabled()) return false;
        const start = ctx.currentTime + (opts.delay || 0) / 1000;
        const duration = (opts.duration || 80) / 1000;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = opts.type || "sine";
          osc.frequency.setValueAtTime(opts.freq, start);
          if (opts.freqEnd && opts.freqEnd !== opts.freq) {
            try {
              osc.frequency.exponentialRampToValueAtTime(Math.max(0.0001, opts.freqEnd), start + duration);
            } catch (e) {
              osc.frequency.linearRampToValueAtTime(opts.freqEnd, start + duration);
            }
          }
          const peakVol = opts.volume ?? 0.12;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(peakVol, start + Math.min(0.012, duration / 3));
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.connect(gain).connect(masterGain);
          osc.start(start);
          osc.stop(start + duration + 0.05);
        } catch (error) {
          return false;
        }
        return true;
      }

      function playNoise(opts) {
        const ctx = getAudioContext();
        if (!ctx || !soundEnabled()) return false;
        const buffer = ensureNoiseBuffer();
        if (!buffer) return false;
        try {
          const start = ctx.currentTime + (opts.delay || 0) / 1000;
          const duration = (opts.duration || 100) / 1000;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const filter = ctx.createBiquadFilter();
          filter.type = opts.filterType || "lowpass";
          filter.frequency.value = opts.filterFreq || 1200;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(opts.volume ?? 0.15, start + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          source.connect(filter).connect(gain).connect(masterGain);
          source.start(start);
          source.stop(start + duration + 0.05);
        } catch (error) {
          return false;
        }
        return true;
      }

      function playSound(kind) {
        if (!soundEnabled()) return false;
        switch (kind) {
          case "move":
            return playTone({ freq: 220, freqEnd: 160, type: "sine", duration: 55, volume: 0.04 });
          case "bump":
            return playTone({ freq: 90, freqEnd: 50, type: "square", duration: 180, volume: 0.16 });
          case "attack":
            playTone({ freq: 280, freqEnd: 120, type: "square", duration: 120, volume: 0.14 });
            return playNoise({ filterFreq: 800, duration: 90, volume: 0.12 });
          case "crit":
            playTone({ freq: 440, freqEnd: 880, type: "triangle", duration: 80, volume: 0.18 });
            playTone({ freq: 880, freqEnd: 1760, type: "triangle", duration: 90, delay: 70, volume: 0.16 });
            return true;
          case "hit":
            return playNoise({ filterFreq: 500, duration: 140, volume: 0.18 });
          case "door":
            return playTone({ freq: 110, freqEnd: 70, type: "square", duration: 220, volume: 0.12 });
          case "pickup":
            playTone({ freq: 660, freqEnd: 1320, type: "triangle", duration: 90, volume: 0.14 });
            return true;
          case "stairs":
            playTone({ freq: 220, freqEnd: 110, type: "sine", duration: 220, volume: 0.14 });
            playTone({ freq: 330, freqEnd: 165, type: "sine", duration: 220, delay: 60, volume: 0.1 });
            return true;
          case "levelUp":
            [0, 110, 220, 330].forEach((delay, i) => {
              playTone({ freq: 440 + i * 110, freqEnd: 440 + i * 110, type: "triangle", duration: 120, delay, volume: 0.16 });
            });
            return true;
          case "defeat":
            playTone({ freq: 220, freqEnd: 55, type: "sawtooth", duration: 700, volume: 0.18 });
            return true;
          case "victory":
            [0, 120, 240, 360, 480].forEach((delay, i) => {
              playTone({ freq: 392 + i * 60, freqEnd: 392 + i * 60, type: "triangle", duration: 140, delay, volume: 0.16 });
            });
            return true;
          case "achievement":
            playTone({ freq: 880, type: "triangle", duration: 60, volume: 0.14 });
            playTone({ freq: 1320, type: "triangle", duration: 120, delay: 60, volume: 0.14 });
            return true;
          case "signature":
            playTone({ freq: 220, freqEnd: 660, type: "triangle", duration: 220, volume: 0.18 });
            playNoise({ filterFreq: 1400, duration: 220, volume: 0.06 });
            return true;
          case "spell":
            playTone({ freq: 660, freqEnd: 220, type: "sine", duration: 220, volume: 0.12 });
            return true;
          default:
            return false;
        }
      }

      function resumeAudio() {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
      }

      // Unlock the audio context on the first user gesture (required by iOS).
      function bindAudioUnlock() {
        if (typeof document === "undefined") return;
        const unlock = () => {
          resumeAudio();
          document.removeEventListener?.("touchstart", unlock);
          document.removeEventListener?.("touchend", unlock);
          document.removeEventListener?.("mousedown", unlock);
          document.removeEventListener?.("keydown", unlock);
        };
        if (typeof document.addEventListener === "function") {
          document.addEventListener("touchstart", unlock, { once: true, passive: true });
          document.addEventListener("touchend", unlock, { once: true, passive: true });
          document.addEventListener("mousedown", unlock, { once: true });
          document.addEventListener("keydown", unlock, { once: true });
        }
      }

      Object.assign(context, {
        playSound,
        soundEnabled,
        resumeAudio,
        bindAudioUnlock
      });

      bindAudioUnlock();
    }
  };
}());
