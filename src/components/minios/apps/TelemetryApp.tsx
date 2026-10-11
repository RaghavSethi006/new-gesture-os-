import { Activity, Cpu, Network, Radio, Zap } from "lucide-react";
import { useEffect, useState } from "react";

export function TelemetryApp() {
  const [dataPoints, setDataPoints] = useState<number[]>([
    45, 52, 48, 65, 78, 62, 55, 70, 85, 92, 74, 68, 80, 88, 95, 72, 60, 84, 90, 78,
  ]);
  const [fps, setFps] = useState(60);

  useEffect(() => {
    const interval = setInterval(() => {
      setDataPoints((prev) => {
        const nextVal = Math.max(
          30,
          Math.min(100, (prev[prev.length - 1] || 50) + (Math.random() * 24 - 12)),
        );
        return [...prev.slice(1), Math.round(nextVal)];
      });
      setFps(Math.round(59 + Math.random() * 2));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const maxVal = 100;
  const minVal = 20;

  // Build SVG polygon and stroke paths
  const svgWidth = 520;
  const svgHeight = 140;
  const points = dataPoints.map((val, idx) => {
    const x = (idx / (dataPoints.length - 1)) * svgWidth;
    const y = svgHeight - ((val - minVal) / (maxVal - minVal)) * (svgHeight - 20) - 10;
    return `${x},${y}`;
  });
  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `M 0,${svgHeight} L ${points.join(" L ")} L ${svgWidth},${svgHeight} Z`;

  return (
    <div className="flex h-full flex-col justify-between p-5 select-none space-y-4">
      {/* Top Telemetry Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-xs font-semibold tracking-widest text-cyan-300 uppercase">
            CONNECTORS // 18 ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-white/50">
          <span>
            LATENCY: <strong className="text-cyan-400">12ms</strong>
          </span>
          <span>
            FPS: <strong className="text-cyan-400">{fps}</strong>
          </span>
          <span>
            BANDWIDTH: <strong className="text-cyan-400">1.4 GB/s</strong>
          </span>
        </div>
      </div>

      {/* Holographic Waveform Graph */}
      <div className="relative w-full rounded-xl bg-cyan-950/20 p-2 overflow-hidden">
        {/* Subtle grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00d4ff0a_1px,transparent_1px),linear-gradient(to_bottom,#00d4ff0a_1px,transparent_1px)] bg-[size:24px_24px]" />

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="relative z-10 w-full h-32 overflow-visible"
        >
          <defs>
            <linearGradient id="telemetryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#telemetryGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="#00d4ff"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="filter drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]"
          />
        </svg>
      </div>

      {/* Bottom Node Metrics */}
      <div className="grid grid-cols-4 gap-3 font-mono">
        <div className="rounded-lg bg-white/5 p-2.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase">
            <Cpu className="size-3 text-cyan-400" />
            <span>Core Load</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white/90">24.2%</p>
        </div>
        <div className="rounded-lg bg-white/5 p-2.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase">
            <Zap className="size-3 text-amber-400" />
            <span>Power Flux</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white/90">0.94 kW</p>
        </div>
        <div className="rounded-lg bg-white/5 p-2.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase">
            <Network className="size-3 text-emerald-400" />
            <span>Mesh Nodes</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white/90">128/128</p>
        </div>
        <div className="rounded-lg bg-white/5 p-2.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase">
            <Radio className="size-3 text-indigo-400" />
            <span>Signal Str</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white/90">-42 dBm</p>
        </div>
      </div>
    </div>
  );
}
