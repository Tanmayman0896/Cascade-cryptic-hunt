"use client";

import React, { useState, useEffect, useRef } from "react";
import { PuzzleProps } from "../types";

// ── PLAY BEEP STUB ──
const playBeep = (freq = 600, duration = 0.08) => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    // blocked or failed
  }
};

export default function AudioGame({
  onSolved,
  onFailed,
  disabled = false,
}: PuzzleProps) {
  const [freq, setFreq] = useState<number>(1.0);
  const [gain, setGain] = useState<number>(1.0);
  const [noise, setNoise] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isStabilized, setIsStabilized] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [isSolvedState, setIsSolvedState] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const historyRef = useRef<number[][]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // ── INIT AUDIO CONTEXT ON FIRST PLAY ──
  const initAudioContext = () => {
    if (audioContextRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;

      const source = ctx.createMediaElementSource(audioRef.current!);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
    } catch (err) {
      console.error("Audio Context Init Failed:", err);
    }
  };

  // ── HANDLE PLAY/PAUSE ──
  const handlePlayToggle = async () => {
    if (disabled || isSolvedState) return;
    if (!audioRef.current) return;

    if (!audioContextRef.current) {
      initAudioContext();
    }

    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.error("Audio Playback Blocked:", e);
      });
    }
  };

  // ── SIGNAL DETECTION CHECK ──
  useEffect(() => {
    const stabilized =
      freq > 2.4 && freq < 2.6 &&
      gain > 1.4 && gain < 1.6 &&
      noise > 45 && noise < 55;

    setIsStabilized(stabilized);
  }, [freq, gain, noise]);

  // ── DRAW LOOP EFFECT ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1000;
    canvas.height = 520;

    const runAnimation = () => {
      if (analyserRef.current && dataArrayRef.current && isPlaying) {
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;

        analyser.getByteFrequencyData(dataArray as any);
        historyRef.current.push([...dataArray]);

        if (historyRef.current.length > canvas.width / 4) {
          historyRef.current.shift();
        }
      }

      // Draw Background
      ctx.fillStyle = "#030105";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Spectrogram History
      const history = historyRef.current;
      for (let x = 0; x < history.length; x++) {
        const frame = history[x];
        for (let y = 0; y < frame.length; y++) {
          let intensity = frame[y] * gain;

          if (intensity < noise) continue;

          let mappedY = y * freq;
          if (mappedY >= canvas.height) break;

          // Green-to-magenta heatmap scaled by intensity to keep the background dark
          const fade = Math.min(intensity / 40, 1.0);
          const red = Math.min(intensity, 255) * fade;
          const green = Math.max(255 - intensity, 0) * fade;
          const blue = Math.min(intensity * 0.5, 255) * fade;

          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
          ctx.fillRect(x * 4, canvas.height - mappedY, 4, 2);
        }
      }

      // Draw Neon Target Lines if Stabilized
      if (isStabilized) {
        ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animationFrameIdRef.current = requestAnimationFrame(runAnimation);
    };

    runAnimation();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying, freq, gain, noise, isStabilized]);

  // ── CLEANUP EFFECT ──
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const [isVerifying, setIsVerifying] = useState(false);

  // ── SUBMIT VERIFICATION ──
  const handleVerify = async () => {
    if (disabled || isSolvedState || isVerifying) return;
    setIsVerifying(true);

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: "04",
          puzzleKey: "audio_game",
          answer: passcode
        })
      });
      const data = await res.json();
      if (data.success && data.correct) {
        playBeep(900, 0.2);
        setIsSolvedState(true);
        setIsModalOpen(false);
        setFeedback("");
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        if (onSolved) {
          onSolved();
        }
      } else {
        playBeep(250, 0.25);
        setFeedback("ACCESS DECRYPTION FAILED. SEQUENCE MISMATCH.");
        if (onFailed) {
          onFailed();
        }
      }
    } catch (err) {
      console.error(err);
      playBeep(250, 0.25);
      setFeedback("ACCESS DECRYPTION FAILED. CONNECTION ERROR.");
      if (onFailed) {
        onFailed();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="audio-game-container min-h-screen text-[#F5F5F5] flex flex-col justify-start selection:bg-cyan-950 selection:text-cyan-200 relative overflow-hidden w-full select-none">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap");
        .audio-game-container {
          font-family: "Inter", sans-serif;
          background-color: #050109;
        }
        .audio-game-container .font-mono {
          font-family: "JetBrains Mono", monospace !important;
        }
      `,
        }}
      />

      {/* Atmospheric neon radial glows */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.06)_0%,transparent_60%)] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.05)_0%,transparent_70%)] pointer-events-none z-0"></div>

      {/* Top Header */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-6 z-20 w-full bg-zinc-950/80 backdrop-blur-sm relative">
        <div className="text-xs tracking-[0.25em] uppercase font-bold text-cyan-400">
          SIGNAL DECRYPTOR
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest hidden sm:inline">
            SYSTEM NODE:
          </span>
          <div className="text-xs font-mono font-bold bg-cyan-950/45 px-3 py-1.5 border border-cyan-900/30 text-cyan-400 rounded-sm">
            📡 CF-04-SIG-LOOP
          </div>
        </div>
      </nav>

      {/* Main layout context */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 z-10 relative">
        <div className="w-full max-w-6xl flex flex-col items-center gap-6">
          <div className="text-center space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-cyan-500 to-cyan-700 uppercase">
              ESCAPE THE LOOP
            </h1>
            <p className="text-xs font-mono text-cyan-300/50 tracking-widest italic">
              “The song remains the same. The signal does not.”
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 w-full items-stretch">
            {/* Visualizer Spectrogram Canvas */}
            <div className="lg:col-span-3 flex flex-col justify-between bg-zinc-950/40 border border-white/5 p-4 sm:p-5 rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.05)] backdrop-blur-md">
              <div className="relative flex-1 bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center min-h-[300px] md:min-h-[420px] w-full">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain block"
                />

                {/* Ambient loading / instructions text overlay when not playing */}
                {!isPlaying && !isSolvedState && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-14 h-14 bg-cyan-950/20 border border-cyan-500/35 rounded-full flex items-center justify-center text-cyan-400 animate-pulse mb-3">
                      <svg className="w-6 h-6 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">
                      System Awaiting Playback
                    </span>
                    <p className="text-[10px] text-zinc-500 max-w-xs mt-2 uppercase tracking-wide">
                      Start audio analyzer loops by clicking play below to render spectral data
                    </p>
                  </div>
                )}

                {/* Final Completion Overlay */}
                {isSolvedState && (
                  <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm border-2 border-emerald-500/30 rounded-xl">
                    <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500 rounded-full flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider">
                      SIGNAL LOCKED
                    </h2>
                    <p className="font-mono text-xs text-emerald-300 mt-2 uppercase tracking-widest max-w-sm">
                      Passcode verified. Transmission decrypted completely.
                    </p>
                  </div>
                )}
              </div>

              {/* Native Audio controls block wrapped nicely */}
              <div className="mt-4 flex items-center gap-4 bg-zinc-950/80 border border-white/5 rounded-xl p-3">
                <button
                  onClick={handlePlayToggle}
                  disabled={disabled || isSolvedState}
                  className={`px-5 py-2.5 rounded font-mono text-xs uppercase tracking-wider font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isPlaying
                      ? "bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30"
                      : "bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {isPlaying ? (
                    <>
                      <span>⏸ Pause</span>
                    </>
                  ) : (
                    <>
                      <span>⏵ Play Signal</span>
                    </>
                  )}
                </button>

                <div className="flex-1 opacity-25 font-mono text-[9px] uppercase tracking-widest text-right select-none">
                  Spectrogram Monitor Active
                </div>

                <audio
                  ref={audioRef}
                  src="/audio/circus-audio.mp3"
                  loop
                  className="hidden"
                />
              </div>
            </div>

            {/* Slider Control Panel */}
            <div className="flex flex-col gap-4 justify-between bg-zinc-950/40 border border-white/5 p-5 rounded-2xl shadow-[0_0_35px_rgba(168,85,247,0.03)] backdrop-blur-md">
              <div className="space-y-6">
                <div className="border-b border-white/5 pb-2 mb-2">
                  <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400/80">
                    Spectral Knobs
                  </h3>
                </div>

                {/* Slider 1: Freq */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-zinc-400 font-bold uppercase tracking-wider">Frequency Stretch</span>
                    <span className="text-cyan-400 font-bold bg-cyan-950/30 border border-cyan-900/30 px-2 py-0.5 rounded">
                      {freq.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={freq}
                    disabled={disabled || isSolvedState}
                    onChange={(e) => setFreq(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none disabled:opacity-40"
                  />
                </div>

                {/* Slider 2: Gain */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-zinc-400 font-bold uppercase tracking-wider">Gain Multiplier</span>
                    <span className="text-cyan-400 font-bold bg-cyan-950/30 border border-cyan-900/30 px-2 py-0.5 rounded">
                      {gain.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={gain}
                    disabled={disabled || isSolvedState}
                    onChange={(e) => setGain(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none disabled:opacity-40"
                  />
                </div>

                {/* Slider 3: Noise Floor */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-zinc-400 font-bold uppercase tracking-wider">Noise Threshold</span>
                    <span className="text-cyan-400 font-bold bg-cyan-950/30 border border-cyan-900/30 px-2 py-0.5 rounded">
                      {noise}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={noise}
                    disabled={disabled || isSolvedState}
                    onChange={(e) => setNoise(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="space-y-4 pt-4 border-t border-white/5 mt-6">
                {/* Connection Status Panel */}
                <div className="min-h-[50px] flex items-center justify-center rounded-xl bg-zinc-950 border border-zinc-900/60 p-2 text-center">
                  {isStabilized ? (
                    <span className="text-emerald-400 text-xs font-mono font-bold tracking-wider animate-pulse uppercase">
                      ❇️ SIGNAL STABILIZED: CRIMSON
                    </span>
                  ) : (
                    <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
                      Searching active signal...
                    </span>
                  )}
                </div>

                {/* Submit Trigger button */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={disabled || isSolvedState}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 font-mono text-xs uppercase tracking-widest font-black text-black rounded-xl transition-all cursor-pointer shadow-lg shadow-cyan-950/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  DECODE ANSWER
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Verification Modal Panel overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex justify-center items-center p-4 z-50 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-sm bg-zinc-950 border-2 border-cyan-500/40 p-6 rounded-2xl shadow-2xl relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setIsModalOpen(false);
                setFeedback("");
              }}
              className="absolute top-3 right-3 text-zinc-500 hover:text-white cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-black uppercase text-white tracking-wider">
                DECRYPT WORD
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-1">
                Enter the stabilized transmission key
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerify();
                }}
                placeholder="ENTER SIGNAL KEYWORD"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-center text-sm font-mono uppercase tracking-widest focus:outline-none focus:border-cyan-500 placeholder:opacity-20 text-white"
              />

              {feedback && (
                <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-lg text-[10px] font-mono text-center text-rose-300 tracking-wide">
                  {feedback}
                </div>
              )}

              <button
                onClick={handleVerify}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs uppercase tracking-widest rounded-xl cursor-pointer font-bold transition-all"
              >
                VERIFY SIGNATURE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
