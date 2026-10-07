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

      // Positional audio. Sounds may carry `at` — the tile they happen on.
      // The position is resolved into LISTENER space (x right, y up, -z
      // ahead, metres): normally from the party's tile and facing (so the 2D
      // first-person view pans a monster on the right to the right ear); a
      // running VR/AR session installs a spatializer that maps the tile
      // through the diorama's room transform and the headset pose instead.
      let soundSpatializer = null;

      function setSoundSpatializer(fn) {
        soundSpatializer = typeof fn === "function" ? fn : null;
      }

      function soundPosition(at) {
        if (!at || typeof at.x !== "number" || typeof at.y !== "number") return null;
        if (soundSpatializer) {
          const p = soundSpatializer(at);
          if (p) return p;
        }
        const f = dirs[state.dir] || dirs[0];
        const dx = at.x - state.x;
        const dy = at.y - state.y;
        const ahead = dx * f.x + dy * f.y;
        const lateral = dx * -f.y + dy * f.x;
        // + 0 folds negative zero out of the dead-ahead/abeam cases.
        return { x: lateral + 0, y: 0, z: -ahead + 0 };
      }

      // Where a sound plugs in: a panner at its position, or the plain master
      // gain for untagged (party-centred) sounds.
      function spatialTarget(at) {
        const p = soundPosition(at);
        if (!p || !audioCtx) return masterGain;
        try {
          const panner = audioCtx.createPanner();
          panner.panningModel = "HRTF";
          panner.distanceModel = "inverse";
          panner.refDistance = 1;
          panner.rolloffFactor = 0.5;
          if (panner.positionX) {
            panner.positionX.value = p.x;
            panner.positionY.value = p.y;
            panner.positionZ.value = p.z;
          } else {
            panner.setPosition(p.x, p.y, p.z);
          }
          panner.connect(masterGain);
          return panner;
        } catch (error) {
          return masterGain;
        }
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
          osc.connect(gain).connect(spatialTarget(opts.at));
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
          source.connect(filter).connect(gain).connect(spatialTarget(opts.at));
          source.start(start);
          source.stop(start + duration + 0.05);
        } catch (error) {
          return false;
        }
        return true;
      }

      function playSound(kind, at) {
        if (!soundEnabled()) return false;
        const tone = (opts) => playTone({ ...opts, at });
        const noise = (opts) => playNoise({ ...opts, at });
        switch (kind) {
          case "move":
            return tone({ freq: 220, freqEnd: 160, type: "sine", duration: 55, volume: 0.04 });
          case "bump":
            return tone({ freq: 90, freqEnd: 50, type: "square", duration: 180, volume: 0.16 });
          case "attack":
            tone({ freq: 280, freqEnd: 120, type: "square", duration: 120, volume: 0.14 });
            return noise({ filterFreq: 800, duration: 90, volume: 0.12 });
          case "crit":
            tone({ freq: 440, freqEnd: 880, type: "triangle", duration: 80, volume: 0.18 });
            tone({ freq: 880, freqEnd: 1760, type: "triangle", duration: 90, delay: 70, volume: 0.16 });
            return true;
          case "hit":
            return noise({ filterFreq: 500, duration: 140, volume: 0.18 });
          case "door":
            return tone({ freq: 110, freqEnd: 70, type: "square", duration: 220, volume: 0.12 });
          case "pickup":
            tone({ freq: 660, freqEnd: 1320, type: "triangle", duration: 90, volume: 0.14 });
            return true;
          case "stairs":
            tone({ freq: 220, freqEnd: 110, type: "sine", duration: 220, volume: 0.14 });
            tone({ freq: 330, freqEnd: 165, type: "sine", duration: 220, delay: 60, volume: 0.1 });
            return true;
          case "levelUp":
            [0, 110, 220, 330].forEach((delay, i) => {
              tone({ freq: 440 + i * 110, freqEnd: 440 + i * 110, type: "triangle", duration: 120, delay, volume: 0.16 });
            });
            return true;
          case "defeat":
            tone({ freq: 220, freqEnd: 55, type: "sawtooth", duration: 700, volume: 0.18 });
            return true;
          case "victory":
            [0, 120, 240, 360, 480].forEach((delay, i) => {
              tone({ freq: 392 + i * 60, freqEnd: 392 + i * 60, type: "triangle", duration: 140, delay, volume: 0.16 });
            });
            return true;
          case "achievement":
            tone({ freq: 880, type: "triangle", duration: 60, volume: 0.14 });
            tone({ freq: 1320, type: "triangle", duration: 120, delay: 60, volume: 0.14 });
            return true;
          case "signature":
            tone({ freq: 220, freqEnd: 660, type: "triangle", duration: 220, volume: 0.18 });
            noise({ filterFreq: 1400, duration: 220, volume: 0.06 });
            return true;
          case "spell":
            tone({ freq: 660, freqEnd: 220, type: "sine", duration: 220, volume: 0.12 });
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
        soundPosition,
        setSoundSpatializer,
        resumeAudio,
        bindAudioUnlock
      });

      bindAudioUnlock();
    }
  };
}());
