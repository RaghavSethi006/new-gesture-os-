import { useEffect, useRef } from "react";
import type { CoreState } from "./AiCore";

/**
 * Physical energy driver for the core.
 *
 * A spring integrates impulses generated per state (heartbeats, syllables,
 * computation surges, listening inhales). The resulting signal is recorded in a
 * ring buffer so each visual layer can read a *delayed* tap of it — that delay
 * is what makes energy look like it propagates outward through the structure
 * instead of every ring animating on its own.
 */
export function useCoreEnergy(state: CoreState, ref: React.RefObject<HTMLDivElement | null>) {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el: HTMLDivElement | null = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const TAPS = 8;
    const BUF = 256;
    const buf = new Float32Array(BUF); // energy history @ ~60fps
    let head = 0;

    let x = 0; // displacement
    let v = 0; // velocity
    let swirl = 0; // extra rotation offset (deg)
    let swirlV = 0;
    let glow = 0;
    let scanA = 0; // roaming scan beam angle
    let scanOn = 0;
    // "gaze" — the whole avatar leans/drifts as if looking around
    let gx = 0,
      gy = 0,
      gxT = 0,
      gyT = 0,
      gxV = 0,
      gyV = 0;
    let gazeNext = 0;
    let hue = 0,
      hueT = 0;
    let jolt = 0; // sharp accent on strong impulses
    let nextEvent = 0;
    let phrase = 0; // speaking: remaining syllables in current phrase
    let restUntil = 0;

    let raf = 0;
    let t0 = performance.now();
    let clock = 0;

    const rnd = () => Math.random();

    function schedule(now: number) {
      const s = stateRef.current;
      if (s === "sleep") {
        nextEvent = now + 6000;
        return;
      }
      if (s === "speaking") {
        if (now < restUntil) {
          nextEvent = restUntil;
          return;
        }
        if (phrase <= 0) {
          phrase = 3 + Math.floor(rnd() * 7);
          restUntil = 0;
        }
        phrase -= 1;
        // syllable: loud words punch harder, soft ones just breathe
        const loud = rnd();
        const amp = 0.35 + loud * loud * 1.9;
        v += amp * 3.1;
        glow = Math.max(glow, 0.5 + loud * 0.7);
        jolt = Math.max(jolt, 0.4 + loud * 0.9);
        swirlV += (rnd() - 0.5) * 1.6;
        if (loud > 0.7) {
          gxT = (rnd() - 0.5) * 26;
          gyT = (rnd() - 0.5) * 18;
        }
        nextEvent = now + 90 + rnd() * 190;
        if (phrase <= 0) restUntil = nextEvent + 420 + rnd() * 900; // pause, relax
        return;
      }
      if (s === "thinking") {
        const kind = rnd();
        if (kind < 0.45) {
          // anticipation: compress inward, then violent release
          v -= 2.4 - rnd();
          gxT = (rnd() - 0.5) * 40;
          gyT = (rnd() - 0.5) * 28;
          window.setTimeout(
            () => {
              v += 6.2 + rnd() * 3.4;
              glow = Math.max(glow, 1.15);
              jolt = 1.4;
              swirlV += (rnd() - 0.5) * 9;
            },
            130 + rnd() * 120,
          );
        } else if (kind < 0.75) {
          // scanning burst travelling around the ring
          scanOn = 1;
          scanA = rnd() * 360;
          v += 1.4;
          gxT = (rnd() - 0.5) * 48;
        } else {
          // random layer speed change
          swirlV += (rnd() - 0.5) * 12;
          v += 1;
          jolt = Math.max(jolt, 0.7);
        }
        nextEvent = now + 260 + rnd() * 700;
        return;
      }
      if (s === "listening") {
        // inhale: gather inward, small settle back
        v -= 1.5 + rnd() * 0.8;
        glow = Math.max(glow, 0.45);
        gxT = (rnd() - 0.5) * 22;
        gyT = (rnd() - 0.5) * 14;
        nextEvent = now + 900 + rnd() * 800;
        return;
      }
      // idle — slow double heartbeat + rare curiosity wander
      v += 1.05;
      window.setTimeout(() => (v += 0.7), 190);
      if (rnd() < 0.45) {
        swirlV += (rnd() - 0.5) * 3.4;
        gxT = (rnd() - 0.5) * 20;
        gyT = (rnd() - 0.5) * 12;
      }
      nextEvent = now + 3200 + rnd() * 2600;
    }

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      clock += dt;

      const s = stateRef.current;
      if (now >= nextEvent) schedule(now);

      // spring constants per state → different "weight" / elasticity
      const k =
        s === "thinking"
          ? 78
          : s === "speaking"
            ? 96
            : s === "listening"
              ? 34
              : s === "sleep"
                ? 8
                : 26;
      const c =
        s === "thinking"
          ? 6.2
          : s === "speaking"
            ? 7.4
            : s === "listening"
              ? 5.4
              : s === "sleep"
                ? 6
                : 4.2;

      // resting bias: listening sits slightly contracted, sleep collapsed
      const bias = s === "listening" ? -0.16 : s === "sleep" ? -0.3 : 0;
      const breath = s === "sleep" ? 0.02 : s === "listening" ? 0.05 : 0.09;
      const target = bias + Math.sin(clock * (s === "sleep" ? 0.25 : 0.62)) * breath;

      v += (target - x) * k * dt;
      v -= v * c * dt;
      x += v * dt;
      x = Math.max(-0.9, Math.min(1.6, x));

      // secondary rotational motion with inertia
      swirlV -= swirlV * 1.6 * dt;
      swirlV += v * 0.9 * dt;
      swirl += swirlV * dt * 26;

      glow += (Math.abs(x) * 0.7 - glow) * Math.min(1, dt * 4);
      jolt -= jolt * 7 * dt;

      // gaze spring (slow, heavy) — reads as intention rather than jitter
      if (now >= gazeNext) {
        if (s === "sleep") {
          gxT = 0;
          gyT = 0;
        } else if (rnd() < 0.5) {
          gxT = (rnd() - 0.5) * (s === "thinking" ? 46 : 18);
          gyT = (rnd() - 0.5) * 12;
        }
        gazeNext = now + (s === "thinking" ? 500 : 1800) + rnd() * 1600;
      }
      const gk = s === "thinking" ? 26 : 12;
      gxV += (gxT - gx) * gk * dt;
      gxV -= gxV * 5.6 * dt;
      gx += gxV * dt;
      gyV += (gyT - gy) * gk * dt;
      gyV -= gyV * 5.6 * dt;
      gy += gyV * dt;

      // emotional colour: thinking pushes violet, speaking warms toward white-cyan
      hueT =
        s === "thinking"
          ? -26
          : s === "speaking"
            ? 10
            : s === "listening"
              ? -8
              : s === "sleep"
                ? -40
                : 0;
      hue += (hueT + Math.abs(x) * 8 - hue) * Math.min(1, dt * 2.2);

      if (scanOn > 0) {
        scanA += dt * 220;
        scanOn -= dt * 0.55;
      }

      buf[head] = x;
      head = (head + 1) % BUF;

      const st = el.style;
      for (let i = 0; i < TAPS; i++) {
        // ~28ms of lag per layer index → visible outward propagation
        const back = Math.round(i * 1.7);
        const val = buf[(head - 1 - back + BUF * 2) % BUF] ?? 0;
        st.setProperty(`--e${i}`, val.toFixed(4));
      }
      st.setProperty("--swirl", swirl.toFixed(3));
      st.setProperty("--glow", glow.toFixed(4));
      st.setProperty("--gx", gx.toFixed(3));
      st.setProperty("--gy", gy.toFixed(3));
      st.setProperty("--hue", hue.toFixed(2));
      st.setProperty("--jolt", jolt.toFixed(4));
      st.setProperty("--scan-a", scanA.toFixed(2));
      st.setProperty("--scan-o", Math.max(0, Math.min(1, scanOn)).toFixed(3));
    }

    nextEvent = performance.now() + 400;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}
