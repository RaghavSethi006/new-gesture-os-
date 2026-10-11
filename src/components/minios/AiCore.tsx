import { useEffect, useMemo, useRef, useState } from "react";
import { useCoreEnergy } from "./useCoreEnergy";

export type CoreState = "idle" | "listening" | "thinking" | "speaking" | "sleep";

const R = 500; // viewBox radius units (viewBox -500 -500 1000 1000)

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [Number((Math.cos(a) * r).toFixed(3)), Number((Math.sin(a) * r).toFixed(3))] as const;
}

function arcPath(r: number, from: number, to: number) {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Deterministic pseudo-random so SSR and client agree. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function Spin({
  dur,
  reverse,
  children,
  className = "",
  style,
}: {
  dur: number;
  reverse?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <g
      className={`ac-spin ${className}`}
      style={{
        animationDuration: `${dur}s`,
        animationDirection: reverse ? "reverse" : "normal",
        ...style,
      }}
    >
      {children}
    </g>
  );
}

/* ---------------- ring builders ---------------- */

function SegmentedArcs({
  r,
  count,
  gap,
  w,
  o,
}: {
  r: number;
  count: number;
  gap: number;
  w: number;
  o: number;
}) {
  const step = 360 / count;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <path
          key={i}
          d={arcPath(r, i * step, i * step + step - gap)}
          fill="none"
          strokeWidth={w}
          strokeLinecap="round"
          className="ac-stroke-primary"
          opacity={o}
        />
      ))}
    </>
  );
}

function TickRing({
  r,
  count,
  len,
  w = 1.2,
  o = 0.55,
  every = 5,
  longLen,
}: {
  r: number;
  count: number;
  len: number;
  w?: number;
  o?: number;
  every?: number;
  longLen?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const deg = (360 / count) * i;
        const major = i % every === 0;
        const l = major ? (longLen ?? len * 2) : len;
        const [x1, y1] = polar(r, deg);
        const [x2, y2] = polar(r + l, deg);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={major ? w * 1.6 : w}
            className={major ? "ac-stroke-accent" : "ac-stroke-primary"}
            opacity={major ? o * 1.5 : o}
          />
        );
      })}
    </>
  );
}

function DashScanRing({ r, count, w }: { r: number; count: number; w: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const deg = (360 / count) * i;
        const [x1, y1] = polar(r - 5, deg);
        const [x2, y2] = polar(r + 5, deg);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={w}
            className="ac-stroke-accent ac-dash"
            style={{ animationDelay: `${(i / count) * 2.4}s` }}
          />
        );
      })}
    </>
  );
}

function HexLattice({ r, count, size }: { r: number; count: number; size: number }) {
  const hex = Array.from({ length: 6 }, (_, k) => {
    const a = (k * 60 * Math.PI) / 180;
    return `${(Math.cos(a) * size).toFixed(2)},${(Math.sin(a) * size).toFixed(2)}`;
  }).join(" ");
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const deg = (360 / count) * i;
        const [x, y] = polar(r, deg);
        return (
          <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg})`}>
            <polygon
              points={hex}
              fill="none"
              strokeWidth={1.1}
              className="ac-stroke-accent ac-flicker"
              style={{ animationDelay: `${(i / count) * 3}s` }}
            />
          </g>
        );
      })}
    </>
  );
}

function NeuralSpikes({ r, count, seed }: { r: number; count: number; seed: number }) {
  const rand = useMemo(() => {
    const g = rng(seed);
    return Array.from({ length: count }, () => g());
  }, [count, seed]);
  return (
    <>
      {rand.map((v, i) => {
        const deg = (360 / count) * i;
        const h = 4 + v * 22;
        const [x1, y1] = polar(r, deg);
        const [x2, y2] = polar(r + h, deg);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={1.6}
            strokeLinecap="round"
            className="ac-stroke-primary ac-pulse-spike"
            style={{
              animationDelay: `${(v * 2.6).toFixed(2)}s`,
              transformOrigin: `${x1.toFixed(2)}px ${y1.toFixed(2)}px`,
            }}
          />
        );
      })}
    </>
  );
}

function ParticleRing({ r, count, seed }: { r: number; count: number; seed: number }) {
  const parts = useMemo(() => {
    const g = rng(seed);
    return Array.from({ length: count }, () => ({
      deg: g() * 360,
      rr: r + (g() - 0.5) * 26,
      dur: 14 + g() * 34,
      rev: g() > 0.5,
      s: 1 + g() * 1.8,
      o: 0.3 + g() * 0.7,
    }));
  }, [count, r, seed]);
  return (
    <>
      {parts.map((p, i) => {
        const [x, y] = polar(p.rr, p.deg);
        return (
          <g
            key={i}
            className="ac-spin"
            style={{
              animationDuration: `${p.dur}s`,
              animationDirection: p.rev ? "reverse" : "normal",
            }}
          >
            <circle cx={x} cy={y} r={p.s} className="ac-fill-accent" opacity={p.o} />
          </g>
        );
      })}
    </>
  );
}

function GlyphRing({
  r,
  id,
  chars,
  size,
  dur,
  reverse = false,
}: {
  r: number;
  id: string;
  chars: string;
  size: number;
  dur: number;
  reverse?: boolean;
}) {
  return (
    <Spin dur={dur} reverse={reverse}>
      <defs>
        <path id={id} d={`M 0 ${-r} A ${r} ${r} 0 1 1 -0.01 ${-r}`} fill="none" />
      </defs>
      <text className="ac-glyph" fontSize={size} letterSpacing={size * 0.42}>
        <textPath href={`#${id}`}>{chars}</textPath>
      </text>
    </Spin>
  );
}

function DataPackets({ r, count, seed }: { r: number; count: number; seed: number }) {
  const items = useMemo(() => {
    const g = rng(seed);
    return Array.from({ length: count }, () => ({
      dur: 6 + g() * 12,
      delay: -g() * 12,
      rev: g() > 0.6,
      s: 3 + g() * 4,
    }));
  }, [count, seed]);
  return (
    <>
      {items.map((p, i) => (
        <g
          key={i}
          className="ac-spin-ease"
          style={{
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            animationDirection: p.rev ? "reverse" : "normal",
          }}
        >
          <rect
            x={-p.s / 2}
            y={-r - p.s / 2}
            width={p.s}
            height={p.s}
            className="ac-fill-highlight"
            opacity={0.9}
          />
        </g>
      ))}
    </>
  );
}

function Waveform({ r, count, seed }: { r: number; count: number; seed: number }) {
  const rand = useMemo(() => {
    const g = rng(seed);
    return Array.from({ length: count }, () => g());
  }, [count, seed]);
  return (
    <g className="ac-wave">
      {rand.map((v, i) => {
        const deg = (360 / count) * i;
        const [x1, y1] = polar(r, deg);
        const [x2, y2] = polar(r + 6 + v * 26, deg);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={2}
            strokeLinecap="round"
            className="ac-stroke-accent ac-wave-bar"
            style={{
              animationDelay: `${(i / count) * 1.4}s`,
              transformOrigin: `${x1.toFixed(2)}px ${y1.toFixed(2)}px`,
            }}
          />
        );
      })}
    </g>
  );
}

function Diamonds({ r, count, size }: { r: number; count: number; size: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const deg = (360 / count) * i;
        const [x, y] = polar(r, deg);
        return (
          <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
            <rect
              x={-size / 2}
              y={-size / 2}
              width={size}
              height={size}
              className="ac-stroke-accent ac-rotate-self"
              fill="none"
              strokeWidth={1.2}
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          </g>
        );
      })}
    </>
  );
}

function Crosshairs({ r, count, size }: { r: number; count: number; size: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const deg = (360 / count) * i + 12;
        const [x, y] = polar(r, deg);
        return (
          <g
            key={i}
            transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
            className="ac-flicker"
            style={{ animationDelay: `${i * 0.7}s` }}
          >
            <circle r={size} fill="none" strokeWidth={1} className="ac-stroke-primary" />
            <line
              x1={-size * 1.7}
              y1={0}
              x2={size * 1.7}
              y2={0}
              strokeWidth={0.8}
              className="ac-stroke-primary"
            />
            <line
              x1={0}
              y1={-size * 1.7}
              x2={0}
              y2={size * 1.7}
              strokeWidth={0.8}
              className="ac-stroke-primary"
            />
          </g>
        );
      })}
    </>
  );
}

function CalibrationNumbers({ r, count }: { r: number; count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const deg = (360 / count) * i;
        const [x, y] = polar(r, deg);
        return (
          <text
            key={i}
            x={x}
            y={y}
            className="ac-glyph"
            fontSize={11}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${deg} ${x.toFixed(2)} ${y.toFixed(2)})`}
          >
            {String(i * 15).padStart(3, "0")}
          </text>
        );
      })}
    </>
  );
}

/** A structural layer that reacts to a delayed tap of the core energy signal.
 *  `amp` sets elasticity: positive expands, negative compresses, ~0 = fixed (tension). */
function Layer({
  tap,
  amp = 1,
  spin = 0,
  className = "",
  children,
}: {
  tap: number;
  amp?: number;
  spin?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <g
      className={`ac-lay ${className}`}
      style={
        {
          "--tap": `var(--e${tap}, 0)`,
          "--amp": amp,
          "--spin-amp": spin,
          "--par": 0.25 + tap * 0.22,
        } as React.CSSProperties
      }
    >
      {children}
    </g>
  );
}

/* ---------------- main ---------------- */

export function AiCore({
  state = "idle",
  className = "",
}: {
  state?: CoreState;
  className?: string;
}) {
  const [ripples, setRipples] = useState<number[]>([]);
  const key = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useCoreEnergy(state, rootRef);

  useEffect(() => {
    const period =
      state === "thinking"
        ? 1400
        : state === "speaking"
          ? 1800
          : state === "listening"
            ? 2600
            : 4200;
    if (state === "sleep") return;
    const t = setInterval(() => {
      key.current += 1;
      const id = key.current;
      setRipples((p) => [...p, id]);
      setTimeout(() => setRipples((p) => p.filter((x) => x !== id)), 2600);
    }, period);
    return () => clearInterval(t);
  }, [state]);

  return (
    <div ref={rootRef} className={`ac-root ac-state-${state} ${className}`}>
      {/* Soft fading dark negative glow shadow field for high optical contrast on light backgrounds */}
      <div className="ac-void-field" aria-hidden="true" />
      <svg viewBox={`-${R} -${R} ${R * 2} ${R * 2}`} className="ac-svg" aria-hidden="true">
        <defs>
          <radialGradient id="ac-core">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="28%" stopColor="#7DF9FF" />
            <stop offset="60%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#2196F3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ac-bloom">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#2196F3" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#2196F3" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ac-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7DF9FF" stopOpacity="0" />
            <stop offset="70%" stopColor="#00E5FF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
          </linearGradient>
          <filter id="ac-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b1" />
            <feGaussianBlur stdDeviation="14" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ac-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* holographic assembly */}
        <g className="ac-assembly">
          <Layer tap={7} amp={0.9} spin={0.4}>
            {/* --- L1 outer subtle energetic sweep --- */}
            <Spin dur={26}>
              <path d={arcPath(468, 0, 70)} fill="none" strokeWidth={2.2} stroke="url(#ac-sweep)" />
            </Spin>
          </Layer>

          <Layer tap={6} amp={0.7} spin={0.3}>
            {/* --- L2 glyph / binary ring --- */}
            <GlyphRing
              id="ac-glyphpath-1"
              r={438}
              size={13}
              dur={110}
              chars="01001100 ▪ SYS.CORE ▲ 10110 ◇ NEXUS ▪ 11010011 ◆ Δ7F2A ▪ 001101 ▫ QBIT ◇ 1011 ▪ 0110100 ▲ VECTOR ▪ 1100 ◆ 010011 ▫ SYNAPSE ▪ 1110 ◇ 0101101 ▲ FLUX ▪ 1001 "
            />
          </Layer>

          <Layer tap={6} amp={-0.35}>
            {/* --- L3 dense micro ticks --- */}
            <Spin dur={200} reverse>
              <TickRing r={412} count={240} len={5} w={0.7} o={0.4} every={10} longLen={12} />
            </Spin>
          </Layer>

          <Layer tap={5} amp={0.8} spin={0.6}>
            {/* --- L4 quantum interference --- */}
            <circle
              r={398}
              fill="none"
              strokeWidth={10}
              className="ac-stroke-primary ac-quantum"
              opacity={0.12}
            />
            <Spin dur={40}>
              <SegmentedArcs r={392} count={3} gap={64} w={3} o={0.5} />
            </Spin>
          </Layer>

          <Layer tap={5} amp={1.3} spin={1.4} className="ac-drift">
            {/* --- L5 orbital particles (outer) --- */}
            <ParticleRing r={372} count={90} seed={11} />
          </Layer>

          <Layer tap={4} amp={0.12} spin={0.15}>
            {/* --- L6 mechanical calibration ring --- */}
            <Spin dur={150}>
              <CalibrationNumbers r={352} count={24} />
              <TickRing r={341} count={120} len={4} w={0.7} o={0.35} every={5} longLen={9} />
            </Spin>
          </Layer>

          <Layer tap={4} amp={-0.5} spin={0.5}>
            {/* --- L7 dashed scanning ring --- */}
            <Spin dur={70} reverse>
              <DashScanRing r={320} count={180} w={1.4} />
            </Spin>
          </Layer>

          <Layer tap={3} amp={0.95} spin={0.8}>
            {/* --- L8 segmented precision arcs --- */}
            <Spin dur={34}>
              <SegmentedArcs r={300} count={6} gap={22} w={4} o={0.7} />
            </Spin>
            <Spin dur={52} reverse>
              <SegmentedArcs r={288} count={12} gap={16} w={1.6} o={0.45} />
            </Spin>
          </Layer>

          <Layer tap={3} amp={-0.6} spin={0.4}>
            {/* --- L9 hexagonal computation lattice --- */}
            <Spin dur={120}>
              <HexLattice r={266} count={40} size={9} />
            </Spin>
          </Layer>

          <Layer tap={2} amp={1.0} spin={1.8}>
            {/* --- L10 data packet orbit --- */}
            <circle
              r={244}
              fill="none"
              strokeWidth={0.7}
              className="ac-stroke-primary"
              opacity={0.3}
            />
            <DataPackets r={244} count={14} seed={7} />
          </Layer>

          <Layer tap={2} amp={0.7} spin={0.5}>
            {/* --- L11 neural pulse ring --- */}
            <Spin dur={180} reverse>
              <NeuralSpikes r={216} count={150} seed={23} />
            </Spin>
          </Layer>

          <Layer tap={1} amp={1.15} spin={0.6} className="ac-wave-layer">
            {/* --- L12 waveform communication ring --- */}
            <Waveform r={190} count={96} seed={31} />
          </Layer>

          <Layer tap={1} amp={-0.45} spin={0.9}>
            {/* --- L13 diamonds + crosshairs --- */}
            <Spin dur={64}>
              <Diamonds r={168} count={18} size={7} />
            </Spin>
            <Spin dur={96} reverse>
              <Crosshairs r={148} count={6} size={5} />
            </Spin>
          </Layer>

          <Layer tap={1} amp={1.35} spin={1.6} className="ac-drift">
            {/* --- L14 inner particles --- */}
            <ParticleRing r={132} count={60} seed={53} />
          </Layer>

          <Layer tap={0} amp={1.6} spin={1.2}>
            {/* --- L15 inner arcs + oscillating ring --- */}
            <g className="ac-oscillate">
              <SegmentedArcs r={116} count={4} gap={30} w={3} o={0.8} />
            </g>
            <Spin dur={18} reverse>
              <SegmentedArcs r={100} count={8} gap={20} w={1.4} o={0.55} />
            </Spin>
            <Spin dur={28}>
              <TickRing r={84} count={72} len={4} w={0.7} o={0.5} every={6} longLen={8} />
            </Spin>
          </Layer>

          <Layer tap={6} amp={0.0} spin={0.2}>
            {/* --- radial connectors --- */}
            <Spin dur={240}>
              {Array.from({ length: 36 }, (_, i) => {
                const deg = i * 10;
                const [x1, y1] = polar(64, deg);
                const [x2, y2] = polar(410, deg);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    strokeWidth={0.4}
                    className="ac-stroke-primary"
                    opacity={0.09}
                  />
                );
              })}
            </Spin>
          </Layer>

          <Layer tap={0} amp={2.2} spin={0.8} className="ac-core-layer">
            {/* --- core --- */}
            <g className="ac-core">
              <circle r={150} fill="url(#ac-bloom)" filter="url(#ac-soft)" className="ac-breathe" />
              <Spin dur={22}>
                <polygon
                  points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23"
                  fill="none"
                  strokeWidth={1}
                  className="ac-stroke-highlight"
                  opacity={0.5}
                />
              </Spin>
              <Spin dur={13} reverse>
                <polygon
                  points="0,-30 26,15 -26,15"
                  fill="none"
                  strokeWidth={0.9}
                  className="ac-stroke-accent"
                  opacity={0.65}
                />
              </Spin>
              <circle r={58} fill="url(#ac-core)" className="ac-breathe" />
              <circle r={22} fill="#FFFFFF" opacity={0.95} className="ac-breathe-fast" />
            </g>
          </Layer>

          {/* --- roaming scan beam (thinking bursts) --- */}
          <g className="ac-scanbeam">
            <path d={arcPath(430, -26, 26)} fill="none" strokeWidth={3} stroke="url(#ac-sweep)" />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={-430}
              strokeWidth={1}
              className="ac-stroke-highlight"
              opacity={0.25}
            />
          </g>

          {/* --- ripples --- */}
          {ripples.map((id) => (
            <circle
              key={id}
              r={60}
              fill="none"
              strokeWidth={2}
              className="ac-stroke-accent ac-ripple"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
