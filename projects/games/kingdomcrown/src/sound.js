export function createSoundController(button) {
    return new SoundController(button);
}

class SoundController {
    constructor(button) {
        this.button = button;
        this.enabled = true;
        this.context = null;
        this.master = null;
        this.drone = null;
        this.supported = window.AudioContext !== undefined || window.webkitAudioContext !== undefined;
        this.updateButton();
    }

    ensure() {
        if (!this.supported) {
            this.enabled = false;
            this.updateButton();
        } else {
            if (this.context === null) {
                this.createContext();
            } else {
                this.resumeContext();
            }
            this.applyVolume();
        }
    }

    createContext() {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        const filter = this.context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 220;
        filter.Q.value = 2.5;
        filter.connect(this.master);
        const droneGain = this.context.createGain();
        droneGain.gain.value = 0.075;
        droneGain.connect(filter);
        this.drone = this.context.createOscillator();
        this.drone.type = "sawtooth";
        this.drone.frequency.value = 43.65;
        this.drone.detune.value = -7;
        this.drone.connect(droneGain);
        this.drone.start();
    }

    resumeContext() {
        if (this.context.state === "suspended") {
            this.context.resume();
        } else {
            this.applyVolume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.ensure();
        } else {
            this.applyVolume();
        }
        this.updateButton();
    }

    applyVolume() {
        if (this.master === null || this.context === null) {
            return;
        } else {
            const target = this.enabled ? 0.2 : 0;
            this.master.gain.cancelScheduledValues(this.context.currentTime);
            this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.06);
        }
    }

    updateButton() {
        if (this.supported) {
            this.button.textContent = this.enabled ? "Sound on" : "Sound off";
            this.button.title = this.enabled ? "Turn generated ambient and feedback sounds off." : "Turn generated ambient and feedback sounds on.";
        } else {
            this.button.textContent = "Sound unavailable";
            this.button.title = "This browser does not provide the audio system used by the game.";
            this.button.disabled = true;
        }
    }

    consumeEvents(events) {
        if (this.enabled && this.context !== null) {
            for (const event of events) {
                this.soundEvent(event);
            }
        } else {
            return;
        }
    }

    soundEvent(event) {
        switch (event.type) {
            case "collect":
                this.tone(410 + event.value * 35, 0.13, "sine", 0.18);
                break;
            case "tendril":
                this.tone(86, 0.36, "sawtooth", 0.24, 42);
                break;
            case "awaken":
                this.tone(72 + event.level * 18, 0.7, "triangle", 0.23, 180);
                break;
            case "mark-acolyte":
            case "job-filled":
                this.tone(event.type === "mark-acolyte" ? 132 : 196, 0.34, "triangle", 0.14, 264);
                break;
            case "structure-rise":
                this.tone(74 + event.level * 22, 0.62, "sawtooth", 0.18, 146 + event.level * 18);
                break;
            case "pasture-yield":
            case "charnel-harvest":
            case "corpse-dissolve":
                this.tone(event.type === "charnel-harvest" ? 118 : 248, 0.22, "sine", 0.12, 352);
                break;
            case "spire-shot":
                this.tone(480, 0.12, "square", 0.09, 170);
                break;
            case "human-fall":
                this.tone(155, 0.16, "square", 0.1, 80);
                break;
            case "site-collapse":
            case "structure-collapse":
            case "acolyte-fall":
            case "dissolve":
                this.tone(65, 0.75, "sawtooth", 0.24, 28);
                break;
            case "wave-warning":
            case "wave":
                this.tone(event.type === "wave" ? 82 : 110, 0.55, "square", 0.13, 55);
                break;
            case "finale":
                this.tone(54, 2.2, "sawtooth", 0.3, 220);
                break;
            case "defeat":
                this.tone(92, 1.4, "triangle", 0.24, 35);
                break;
            default:
                return;
        }
    }

    tone(frequency, duration, type, volume, endingFrequency = frequency) {
        const context = this.context;
        if (context === null || this.master === null) {
            return;
        } else {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endingFrequency), context.currentTime + duration);
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.018);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
            oscillator.connect(gain);
            gain.connect(this.master);
            oscillator.start();
            oscillator.stop(context.currentTime + duration + 0.03);
        }
    }
}
