import {
  Disc3,
  Heart,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function MediaApp() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(124); // 2:04
  const [liked, setLiked] = useState(true);
  const duration = 216; // 3:36

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full flex-col justify-between p-5 select-none">
      {/* Track Info Section */}
      <div className="flex items-center gap-4">
        {/* Album Artwork with Holographic HUD Frame */}
        <div className="relative group size-24 shrink-0 overflow-hidden rounded-xl bg-cyan-950/40 shadow-[0_0_24px_rgba(0,212,255,0.2)]">
          <img
            src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80"
            alt="Album Artwork"
            className="size-full object-cover opacity-85 transition-transform duration-500 group-hover:scale-105"
          />
          {/* Animated spinning record overlay or badge */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-300 font-medium">
              LIVE_STREAM
            </span>
          </div>
        </div>

        {/* Title, Artist, and Badges */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase">
              // NOW_PLAYING
            </span>
            <button
              type="button"
              onClick={() => setLiked(!liked)}
              className={cn(
                "size-6 rounded-full flex items-center justify-center transition-colors",
                liked ? "text-rose-400" : "text-white/40 hover:text-white",
              )}
            >
              <Heart className={cn("size-3.5", liked && "fill-current")} />
            </button>
          </div>

          <h2 className="truncate text-base font-semibold tracking-tight text-white/95">
            Still into You
          </h2>
          <p className="truncate text-xs font-medium text-white/60">Paramore</p>
          <p className="text-[11px] text-cyan-200/50 font-mono">Paramore (Deluxe Edition)</p>
        </div>
      </div>

      {/* Progress Scrubber */}
      <div className="my-2 space-y-1.5">
        <div
          className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/10 overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            setProgress(Math.round(clickPos * duration));
          }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_12px_rgba(0,212,255,0.7)] transition-all"
            style={{ width: `${(progress / duration) * 100}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-white/50">
          <span>{formatTime(progress)}</span>
          <span className="text-cyan-400/70">FLAC · 24-bit/96kHz</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="size-8 rounded-full flex items-center justify-center text-white/50 hover:text-cyan-300 transition-colors"
          >
            <Shuffle className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setProgress(Math.max(0, progress - 15))}
            className="size-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <SkipBack className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="size-10 rounded-full bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-300 shadow-[0_0_16px_rgba(0,212,255,0.3)] flex items-center justify-center transition-all active:scale-95"
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => setProgress(Math.min(duration, progress + 15))}
            className="size-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <SkipForward className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-white/50">
          <button
            type="button"
            className="size-8 rounded-full flex items-center justify-center hover:text-cyan-300 transition-colors"
          >
            <Repeat className="size-3.5" />
          </button>
          <Volume2 className="size-3.5" />
        </div>
      </div>
    </div>
  );
}
