import { useState, useEffect, useRef, useCallback } from "react";
import { markCaseCompleted } from "@/components/case-progress";

// ═══════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════
let _ctx: any = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}
function makeReverb(ctx: AudioContext, secs: number = 2.5) {
  const conv = ctx.createConvolver();
  const len = ctx.sampleRate * secs;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  }
  conv.buffer = buf;
  return conv;
}
class MusicEngine {
  master: GainNode | null = null;
  rev: ConvolverNode | null = null;
  nodes: OscillatorNode[] = [];
  loopId: any = null;
  theme: string | null = null;
  vol: number = 0.8;

  constructor() { this.master = null; this.rev = null; this.nodes = []; this.loopId = null; this.theme = null; this.vol = 0.8; }
  setup() {
    const ctx = getCtx();
    if (this.master) return;
    this.master = ctx.createGain(); this.master!.gain.value = 0;
    this.rev = makeReverb(ctx);
    this.rev!.connect(this.master!);
    this.master!.connect(ctx.destination);
  }
  _n(freq: number, type: OscillatorType, vol: number, atk: number, dur: number, start: number) {
    const ctx = getCtx();
    const g = ctx.createGain(); g.gain.setValueAtTime(0.001, start); g.gain.linearRampToValueAtTime(vol, start + atk); g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = Math.min(freq * 4, 3000);
    o.connect(f); f.connect(g); g.connect(this.rev!);
    o.start(start); o.stop(start + dur + 0.1);
    this.nodes.push(o);
  }
  play(theme: string) {
    this.setup(); this.stopAll(); this.theme = theme;
    const ctx = getCtx(), t = ctx.currentTime;
    this.master!.gain.cancelScheduledValues(t);
    this.master!.gain.setValueAtTime(0, t);
    this.master!.gain.linearRampToValueAtTime(this.vol, t + 2.5);
    if (theme === "scene") this._scene();
    else if (theme === "puzzle") this._puzzle();
    else if (theme === "tense") this._tense();
    else if (theme === "finale") this._finale();
  }
  _scene() {
    const ctx = getCtx();
    const BASS = [65.41, 73.42, 82.41, 87.31];
    const MEL = [130.81, 146.83, 164.81, 196, 220, 246.94];
    const loop = () => {
      if (this.theme !== "scene") return;
      const now = ctx.currentTime;
      [0, 5, 10, 15].forEach((off, i) => { this._n(BASS[i % 4], "sine", 0.35, 1.5, 5, now + off); this._n(BASS[i % 4] * 2, "triangle", 0.08, 0.8, 4, now + off); });
      [0, 2, 4, 7, 9, 7, 4, 2].forEach((si, i) => this._n(MEL[si % 6] * 2, "triangle", 0.14, 0.08, 2.2, now + i * 2.2 + Math.random() * 0.1));
      for (let b = 0; b < 4; b++) [MEL[0], MEL[2], MEL[4]].forEach((f, i) => this._n(f, "sawtooth", 0.06, 0.5 + Math.random() * 0.3, 3, now + b * 4 + i * 0.3));
      // Add choir-like pads
      [130.81, 164.81, 196, 220].forEach((f, i) => this._n(f, "sine", 0.12, 2, 8, now + i * 0.5));
      this.loopId = setTimeout(loop, 19500);
    };
    loop();
  }
  _puzzle() {
    const ctx = getCtx();
    const MINOR = [138.59, 155.56, 164.81, 185, 207.65, 220];
    const loop = () => {
      if (this.theme !== "puzzle") return;
      const now = ctx.currentTime;
      [55, 110, 220].forEach(f => this._n(f, "sawtooth", 0.04, 1.5, 5, now));
      [0, 0, 2, 0, 4, 2, 1, 0].forEach((si, i) => { this._n(MINOR[si] * 2, "square", 0.07, 0.01, 0.18, now + i * 0.72); if (i % 2 === 0) this._n(MINOR[si], "triangle", 0.05, 0.02, 0.35, now + i * 0.72 + 0.08); });
      [0, 1.5, 3, 4.5].forEach(off => this._n(55, "sine", 0.2, 0.02, 0.28, now + off));
      this.loopId = setTimeout(loop, 5800);
    };
    loop();
  }
  _tense() {
    const ctx = getCtx();
    const loop = () => {
      if (this.theme !== "tense") return;
      const now = ctx.currentTime;
      [98, 110, 123, 130].forEach((f, i) => { for (let j = 0; j < 14; j++) this._n(f, "sawtooth", 0.05 + i * 0.01, 0.01, 0.1, now + j * 0.27 + i * 0.06); this._n(f * 2, "triangle", 0.04, 0.8, 3.5, now); });
      this._n(65, "sine", 0.3, 0.4, 3.8, now);
      // Mystical choir layers
      [196, 220, 246.94].forEach((f, i) => this._n(f, "sine", 0.09, 1.2, 3, now + i * 0.8));
      this.loopId = setTimeout(loop, 3900);
    };
    loop();
  }
  _finale() {
    const ctx = getCtx();
    const MAJOR = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];
    const now = ctx.currentTime;
    MAJOR.forEach((f, i) => { this._n(f, "sawtooth", 0.09 + i * 0.008, 0.7 + i * 0.1, 5, now + i * 0.85); this._n(f * 0.5, "sine", 0.18, 1.2, 6, now + i * 0.4); this._n(f * 2, "triangle", 0.05, 0.3, 2.5, now + i * 1.1 + 0.2); });
    this._n(65, "sine", 0.35, 2, 10, now);
  }
  fadeOut(dur: number = 1.5) {
    if (!this.master) return;
    const ctx = getCtx(), t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + dur);
    setTimeout(() => this.stopAll(), (dur + 0.3) * 1000);
  }
  stopAll() {
    clearTimeout(this.loopId); this.theme = null;
    this.nodes.forEach(n => { try { n.stop(0); } catch {} });
    this.nodes = [];
  }
}

function sfx(type: string) {
  try {
    const ctx = getCtx();
    const g = ctx.createGain(); g.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === "solve") { [523, 659, 784, 1047].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; o.type = "triangle"; const gg = ctx.createGain(); gg.gain.setValueAtTime(0, now + i * 0.12); gg.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.05); gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5); o.connect(gg); gg.connect(ctx.destination); o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.55); }); }
    else if (type === "error") { const o = ctx.createOscillator(); o.frequency.value = 220; o.type = "sawtooth"; g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3); o.connect(g); o.start(now); o.stop(now + 0.35); }
    else if (type === "page") { const o = ctx.createOscillator(); o.frequency.value = 440; o.type = "sine"; g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12); o.connect(g); o.start(now); o.stop(now + 0.15); }
    else if (type === "cooldown") { [330, 220, 165].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; o.type = "sine"; const gg = ctx.createGain(); gg.gain.setValueAtTime(0, now + i * 0.15); gg.gain.linearRampToValueAtTime(0.12, now + i * 0.15 + 0.05); gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4); o.connect(gg); gg.connect(ctx.destination); o.start(now + i * 0.15); o.stop(now + i * 0.15 + 0.5); }); }
  } catch {}
}

const music = new MusicEngine();

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=Share+Tech+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#06070e;min-height:100vh;overflow-x:hidden;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeDown{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
@keyframes scanV{0%{top:-2%}100%{top:104%}}
@keyframes flicker{0%,100%{opacity:1}89%{opacity:.93}91%{opacity:.55}93%{opacity:.9}95%{opacity:.65}97%{opacity:.95}}
@keyframes rain{0%{transform:translateY(-5%) rotate(6deg)}100%{transform:translateY(110vh) rotate(6deg)}}
@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes slideUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
@keyframes dust{0%{transform:translateY(0);opacity:0}12%{opacity:.45}88%{opacity:.08}100%{transform:translateY(-200px);opacity:0}}
@keyframes rotateCW{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes rotateCCW{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
@keyframes cinematicIn{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@keyframes letterPop{from{opacity:0;transform:scale(.7) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes cooldownPulse{0%,100%{background:#cc334408}50%{background:#cc334418}}
::-webkit-scrollbar{width:3px}
::-webkit-scrollbar-track{background:#06070e}
::-webkit-scrollbar-thumb{background:#1e2848}
input,button{outline:none;-webkit-tap-highlight-color:transparent;font-family:inherit;}
::selection{background:#4a7aff33;color:#dde4f5}
`;

const rnd = (a: number, b: number) => Math.random() * (b - a) + a;
const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ═══════════════════════════════════════════════
// COOLDOWN HOOK
// ═══════════════════════════════════════════════
function useCooldown(secs: number = 120) {
  const [cd, setCd] = useState(0);
  const ref = useRef<NodeJS.Timeout | null>(null);
  const trigger = useCallback(() => {
    sfx("cooldown");
    setCd(secs);
    clearInterval(ref.current!);
    ref.current = setInterval(() => setCd(v => { if (v <= 1) { clearInterval(ref.current!); return 0; } return v - 1; }), 1000);
  }, [secs]);
  useEffect(() => () => clearInterval(ref.current!), []);
  return { cd, active: cd > 0, trigger };
}

// ═══════════════════════════════════════════════
// PARTICLES / FX
// ═══════════════════════════════════════════════
function Particles({ count = 16, color = "#4a7aff" }: { count?: number, color?: string }) {
  const pts = useRef(Array.from({ length: count }, () => ({ x: rnd(0, 100), delay: rnd(0, 16), dur: rnd(12, 26), sz: rnd(0.8, 2.2) }))).current;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, overflow: "hidden" }}>
      {pts.map((p, i) => <div key={i} style={{ position: "absolute", left: `${p.x}%`, bottom: 0, width: p.sz, height: p.sz, borderRadius: "50%", background: color, opacity: 0, animation: `dust ${p.dur}s ${p.delay}s infinite ease-in` }} />)}
    </div>
  );
}
function Rain() {
  const drops = useRef(Array.from({ length: 28 }, () => ({ x: rnd(-5, 105), delay: rnd(0, 4), dur: rnd(0.55, 1.1), op: rnd(0.05, 0.14), h: rnd(10, 22) }))).current;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, overflow: "hidden" }}>
      {drops.map((p, i) => <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: "-3%", width: 0.7, height: p.h, background: "linear-gradient(180deg,transparent,#4a7affaa,transparent)", opacity: p.op, animation: `rain ${p.dur}s ${p.delay}s linear infinite` }} />)}
    </div>
  );
}
function ScanLines() {
  return <div style={{ position: "fixed", inset: 0, zIndex: 3, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.07) 2px,rgba(0,0,0,.07) 4px)", backgroundSize: "100% 4px", animation: "flicker 9s linear infinite" }} />;
}

// ═══════════════════════════════════════════════
// COOLDOWN OVERLAY
// ═══════════════════════════════════════════════
function CooldownOverlay({ cd }: { cd: number }) {
  if (cd <= 0) return null;
  return (
    <div style={{ position: "fixed", top: 50, left: 0, right: 0, zIndex: 200, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ padding: "10px 28px", background: "#0a0410", border: "1px solid #cc334466", borderRadius: 2, display: "flex", alignItems: "center", gap: 14, animation: "cooldownPulse 1s ease-in-out infinite" }}>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#cc3344", letterSpacing: 3 }}>COOLDOWN</span>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 18, color: "#e05060" }}>{fmtTime(cd)}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// PORTRAITS
// ═══════════════════════════════════════════════
const CHARS: any = {
  aurelis: { hair: "#10102a", coat: "#0d1b40", skin: "#c8a882", eye: "#4a7aff", glow: "#4a7aff", title: "AURELIS" },
  voss:    { hair: "#2a1812", coat: "#180a0a", skin: "#d4a882", eye: "#cc3344", glow: "#cc3344", title: "DR. VOSS" },
  ashford: { hair: "#2a2a2a", coat: "#080814", skin: "#b89878", eye: "#d4aa50", glow: "#d4aa50", title: "DIRECTOR" },
  maren:   { hair: "#3a2a10", coat: "#0e0e18", skin: "#c8b898", eye: "#2ab89a", glow: "#2ab89a", title: "PROF. MAREN" },
  wren:    { hair: "#4a3010", coat: "#1a0d04", skin: "#d4b090", eye: "#d4aa50", glow: "#d4aa50", title: "A. WREN" },
  cole:    { hair: "#121212", coat: "#0a160a", skin: "#b8a888", eye: "#2ab89a", glow: "#2ab89a", title: "DEP. COLE" },
  echo:    { hair: "#0a0a0a", coat: "#0a0a16", skin: "#a09070", eye: "#cc3344", glow: "#cc3344", title: "ECHO" },
  you:     { hair: "#1a1a1a", coat: "#0a0a0a", skin: "#c0a080", eye: "#7a9fff", glow: "#7a9fff", title: "YOU" },
};
function Portrait({ char, size = 90, active = true, speaking = false }: { char: string, size?: number, active?: boolean, speaking?: boolean }) {
  const c = CHARS[char] || CHARS.you;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, opacity: active ? 1 : 0.2, transition: "opacity .5s", transform: speaking ? "scale(1.06)" : "scale(1)", transformOrigin: "bottom center", transitionProperty: "opacity,transform" }}>
      <svg width={size} height={size + 12} viewBox="0 0 80 90" style={{ filter: active ? `drop-shadow(0 0 ${speaking ? 20 : 8}px ${c.glow}${speaking ? "99" : "44"})` : undefined, transition: "filter .4s" }}>
        <circle cx={40} cy={40} r={38} fill="#070814" stroke={active ? c.glow : "#181e38"} strokeWidth={speaking ? 2 : 1} opacity={.95} />
        {active && <circle cx={40} cy={40} r={36} fill="none" stroke={c.glow} strokeWidth={.4} opacity={.25} />}
        <ellipse cx={40} cy={75} rx={23} ry={18} fill={c.coat} />
        <rect x={30} y={58} width={20} height={20} fill={c.coat} />
        <rect x={37} y={50} width={6} height={10} fill={c.skin} />
        <ellipse cx={40} cy={37} rx={15} ry={17} fill={c.skin} />
        <ellipse cx={40} cy={23} rx={15} ry={7} fill={c.hair} />
        <rect x={25} y={21} width={30} height={10} fill={c.hair} />
        <ellipse cx={34} cy={37} rx={3} ry={2.2} fill="#050610" />
        <ellipse cx={46} cy={37} rx={3} ry={2.2} fill="#050610" />
        <circle cx={34} cy={37} r={1.8} fill={c.eye} opacity={active ? 1 : .3} />
        <circle cx={46} cy={37} r={1.8} fill={c.eye} opacity={active ? 1 : .3} />
        <circle cx={34.7} cy={36.4} r={.7} fill="#fff" opacity={.85} />
        <circle cx={46.7} cy={36.4} r={.7} fill="#fff" opacity={.85} />
        <path d={speaking ? "M35,47 Q40,51 45,47" : "M36,47 Q40,50 44,47"} stroke="#8a6050" strokeWidth={1} fill="none" />
        <ellipse cx={25.5} cy={38} rx={2} ry={3} fill={c.skin} opacity={.6} />
        <ellipse cx={54.5} cy={38} rx={2} ry={3} fill={c.skin} opacity={.6} />
      </svg>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: active ? c.glow : "#1e2848", letterSpacing: 3 }}>{c.title}</div>
      {speaking && <div style={{ width: 4, height: 4, borderRadius: "50%", background: c.glow, animation: "pulse .7s ease-in-out infinite" }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// SCENE BG
// ═══════════════════════════════════════════════
const BKGS: any = {
  gate:     { grad: "radial-gradient(ellipse at 40% 70%,#0c1228,#060710 55%,#04050c)", rain: true },
  study:    { grad: "radial-gradient(ellipse at 35% 45%,#110d06,#07080f 60%)", rain: false },
  forest:   { grad: "radial-gradient(ellipse at 50% 65%,#051005,#060a06 40%,#07080f)", rain: true },
  office:   { grad: "radial-gradient(ellipse at 30% 40%,#120a04,#07080f 60%)", rain: true },
  vault:    { grad: "radial-gradient(ellipse at 50% 25%,#090716,#07080f 55%)", rain: false },
  briefing: { grad: "radial-gradient(ellipse at 50% 50%,#08081a,#07080f 60%)", rain: false },
  rooftop:  { grad: "radial-gradient(ellipse at 50% 15%,#080a1a,#07080f 55%)", rain: false },
  echo_lab: { grad: "radial-gradient(ellipse at 50% 50%,#0a0608,#07080f 55%)", rain: false },
  terminus: { grad: "radial-gradient(ellipse at 50% 50%,#0a0608,#04030a 70%)", rain: false },
};
const LABELS: any = {
  gate: "PRAGUE · EASTERN GATE · 1789", study: "WREN'S STUDY · 1789", forest: "BOHEMIAN FOREST · 1790",
  office: "PROJECT NULL · 1978", vault: "RESTRICTED VAULT · SUBLEVEL 3 · 1978",
  briefing: "BRIEFING ROOM · PRESENT DAY", rooftop: "DIRECTOR'S OFFICE · 1978",
  echo_lab: "ECHO FACILITY · 1983", terminus: "TIMELINE ZERO",
};

const SCENE_THEME: Record<string, string> = {
  gate: "scene", study: "scene", forest: "tense", office: "tense",
  vault: "tense", briefing: "scene", rooftop: "tense", echo_lab: "tense", terminus: "finale",
};

function SceneBG({ scene }: { scene: string }) {
  const bg = BKGS[scene] || { grad: "#07080f", rain: false };
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: bg.grad, zIndex: 0, animation: "cinematicIn 1.2s ease-out" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, opacity: .025, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "160px" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 2, background: "radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(0,0,0,.82) 100%)", pointerEvents: "none" }} />
      {bg.rain && <Rain />}
      {LABELS[scene] && <div style={{ position: "fixed", top: 52, left: 0, right: 0, textAlign: "center", zIndex: 8, fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#1e2848", letterSpacing: 5, animation: "fadeIn 2s ease-out" }}>{LABELS[scene]}</div>}
    </>
  );
}

// ═══════════════════════════════════════════════
// TYPEWRITER
// ═══════════════════════════════════════════════
function useTypewriter(text: string, spd: number = 22) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  const ref = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    setOut(""); setDone(false); let i = 0;
    ref.current = setInterval(() => { i++; setOut(text.slice(0, i)); if (i >= text.length) { clearInterval(ref.current!); setDone(true); } }, spd);
    return () => clearInterval(ref.current!);
  }, [text, spd]);
  return { out, done };
}

// ═══════════════════════════════════════════════
// DIALOGUE BOX
// ═══════════════════════════════════════════════
const MOOD_COL: any = {
  narrate: "#7a8aaa", calm: "#dde4f5", urgent: "#d4aa50", shock: "#e05060",
  grave: "#b0bcd4", low: "#6a7a9a", whisper: "#4a5a7a", flat: "#8a9ab8",
  fierce: "#d4aa50", cold: "#6a7a9a", desperate: "#e05060", final: "#c0cce0",
  tired: "#5a6a8a", quiet: "#7a9fff", warning: "#e05060", revelation: "#fff",
  conspire: "#d4aa50", ominous: "#7a5a9a",
};
const SPK_NAMES: any = { aurelis: "AURELIS", voss: "DR. ELARA VOSS", maren: "PROF. IVAN MAREN", ashford: "DIRECTOR ASHFORD", wren: "ALDOUS WREN", cole: "DEPUTY COLE", echo: "ECHO", you: "YOU" };

function DialogueBox({ line, idx, total, onNext }: { line: any, idx: number, total: number, onNext: () => void }) {
  const { out, done } = useTypewriter(line.text, 28);
  const color = MOOD_COL[line.mood] || "#dde4f5";
  const isNar = line.mood === "narrate";
  const [readyToNext, setReadyToNext] = useState(false);

  useEffect(() => {
    setReadyToNext(false);
    if (line.mood === "narrate") sfx("page");
  }, [line.text]);

  useEffect(() => {
    if (done) {
      const words = line.text.trim().split(/\s+/).length;
      const readMs = Math.min(Math.max((words / 150) * 60000 + 800, 2000), 6000);
      const t = setTimeout(() => { setReadyToNext(true); }, readMs);
      return () => clearTimeout(t);
    }
  }, [done, line.text]);

  useEffect(() => {
    if (readyToNext) onNext();
  }, [readyToNext]);

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "linear-gradient(0deg,rgba(4,5,12,.99) 0%,rgba(4,5,12,.94) 72%,transparent 100%)", padding: "0 0 28px", minHeight: 170 }}>
      <div style={{ height: 1, background: `linear-gradient(90deg,#4a7aff,transparent)`, width: `${((idx + 1) / total) * 100}%`, transition: "width .5s", opacity: .45 }} />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "14px 24px 0" }}>
        {!isNar && line.speaker && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, animation: "fadeDown .3s ease-out" }}>
            <div style={{ width: 3, height: 26, background: color, flexShrink: 0 }} />
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color, letterSpacing: 4 }}>{SPK_NAMES[line.speaker] || line.speaker}</div>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${color}44,transparent)` }} />
          </div>
        )}
        <div style={{ fontFamily: isNar ? "'Share Tech Mono',monospace" : "'Crimson Text',serif", fontSize: isNar ? 13 : 18, color, lineHeight: isNar ? 2.1 : 1.9, letterSpacing: isNar ? 1.5 : .2, whiteSpace: "pre-line", minHeight: 66, textShadow: `0 0 28px ${color}18` }}>
          {out}{!done && <span style={{ animation: "blink .55s step-end infinite", color: "#252e58" }}>▋</span>}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#1e2848,transparent)" }} />
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: done ? "#1e2848" : "#0e1228", letterSpacing: 3, animation: done ? "pulse 1.3s ease-in-out infinite" : "none" }}>{idx + 1}/{total}</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SCENE PLAYER
// ═══════════════════════════════════════════════
function ScenePlayer({ entry, sceneNum, totalScenes, onComplete }: { entry: any, sceneNum: number, totalScenes: number, onComplete: () => void }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charReady, setCharReady] = useState(false);
  const line = entry.lines[lineIdx];
  useEffect(() => { const t = setTimeout(() => setCharReady(true), 500); return () => clearTimeout(t); }, []);
  const next = () => { if (lineIdx === entry.lines.length - 1) { onComplete(); } else setLineIdx(i => i + 1); };
  const left = entry.chars.filter((c: any) => c.side === "left");
  const right = entry.chars.filter((c: any) => c.side === "right");
  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <SceneBG scene={entry.bg} />
      <ScanLines />
      <div style={{ position: "fixed", left: 0, right: 0, height: 1, zIndex: 5, background: "rgba(74,122,255,.05)", animation: "scanV 14s linear infinite" }} />
      <div style={{ position: "fixed", top: 16, left: 0, right: 0, textAlign: "center", zIndex: 10, pointerEvents: "none" }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#1e2848", letterSpacing: 8 }}>{entry.title}</div>
      </div>
      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 10, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848" }}>{sceneNum}/{totalScenes}</div>
      <div style={{ position: "fixed", bottom: 185, left: 0, right: 0, zIndex: 8, display: "flex", justifyContent: "space-between", padding: "0 6vw", pointerEvents: "none", opacity: charReady ? 1 : 0, transition: "opacity .8s" }}>
        <div style={{ display: "flex", gap: 14 }}>{left.map((c: any) => <Portrait key={c.id} char={c.id} size={92} active={line.speaker === c.id || !line.speaker} speaking={line.speaker === c.id} />)}</div>
        <div style={{ display: "flex", gap: 14 }}>{right.map((c: any) => <Portrait key={c.id} char={c.id} size={92} active={line.speaker === c.id || !line.speaker} speaking={line.speaker === c.id} />)}</div>
      </div>
      <DialogueBox key={`${entry.title}-${lineIdx}`} line={line} idx={lineIdx} total={entry.lines.length} onNext={next} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════
interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  glow?: string;
}
function Card({ children, style = {}, glow }: CardProps) {
  return <div style={{ background: "#09091a", border: `1px solid ${glow ? glow + "44" : "#14182e"}`, borderRadius: 2, padding: "20px 24px", boxShadow: glow ? `0 0 28px ${glow}14,0 4px 28px rgba(0,0,0,.55)` : "0 4px 28px rgba(0,0,0,.5)", animation: "fadeUp .45s ease-out", ...style }}>{children}</div>;
}

interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  style?: React.CSSProperties;
}
function Btn({ children, onClick, disabled = false, color = "#4a7aff", style = {} }: BtnProps) {
  const [h, setH] = useState(false);
  return <button onClick={() => { if (!disabled && onClick) onClick(); }} disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ background: h && !disabled ? `${color}14` : "transparent", border: `1px solid ${disabled ? "#1e2848" : h ? color : color + "66"}`, color: disabled ? "#1e2848" : color, padding: "11px 26px", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 3, cursor: disabled ? "default" : "pointer", transition: "all .18s", boxShadow: h && !disabled ? `0 0 24px ${color}28` : "none", ...style }}>{children}</button>;
}

function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 5, color: "#1e2848", marginBottom: 10 }}>{children}</div>; }
function ErrMsg({ msg }: { msg: string }) { if (!msg) return null; return <div style={{ marginTop: 10, fontFamily: "'Crimson Text',serif", fontSize: 15, color: "#e05060", fontStyle: "italic", animation: "shake .4s ease-out" }}>⚠ {msg}</div>; }
function HintBox({ text }: { text: string }) {
  return <div style={{ padding: "12px 16px", background: "#050610", borderLeft: "3px solid #1e2f6a", marginTop: 12, animation: "fadeIn .4s" }}><div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848", letterSpacing: 3, marginBottom: 5 }}>// FIELD NOTES</div><div style={{ fontFamily: "'Crimson Text',serif", fontSize: 14, color: "#5a6a8a", fontStyle: "italic", lineHeight: 1.9 }}>{text}</div></div>;
}

interface SolvedCardProps {
  word: string;
  fragLabel: string;
  fragColor?: string;
  onReturn?: () => void;
}
function SolvedCard({ word, fragLabel, fragColor = "#4a7aff", onReturn }: SolvedCardProps) {
  useEffect(() => { sfx("solve"); }, []);
  return (
    <Card glow={fragColor} style={{ textAlign: "center", padding: 38, animation: "fadeUp .7s ease-out" }}>
      <div style={{ fontSize: 38, marginBottom: 10, color: fragColor, animation: "letterPop .6s ease-out" }}>◈</div>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: fragColor, marginBottom: 8, letterSpacing: 2 }}>Fragment Recovered</div>
      <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${fragColor},transparent)`, margin: "14px 0" }} />
      <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 16, color: "#6a7a9a", fontStyle: "italic", marginBottom: 22, lineHeight: 1.9 }}>{word}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "#050610", border: `1px solid ${fragColor}44`, marginBottom: 24 }}>
        <span style={{ color: fragColor, fontSize: 16 }}>◈</span>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: "#b0bcd4", letterSpacing: 2 }}>{fragLabel}</span>
      </div>
      <div><Btn onClick={onReturn} disabled={false} color={fragColor}>CONTINUE THE INVESTIGATION ▸</Btn></div>
    </Card>
  );
}

interface PuzzleShellProps {
  title: string;
  era: string;
  intro: string;
  children: React.ReactNode;
}
function PuzzleShell({ title, era, intro, children }: PuzzleShellProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#06070e", paddingTop: 74, paddingBottom: 50 }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 18%,#090d1e,#06070e 60%)", zIndex: 0 }} />
      <Particles count={12} />
      <ScanLines />
      <div style={{ position: "relative", zIndex: 10, maxWidth: 720, margin: "0 auto", padding: "0 18px" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 5, color: "#1e2848", marginBottom: 8 }}>{era}</div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(19px,4vw,28px)", color: "#7a9fff", letterSpacing: 2, marginBottom: 6, textShadow: "0 0 36px #4a7aff44" }}>{title}</div>
          <div style={{ height: 1, background: "linear-gradient(90deg,#4a7aff,transparent)" }} />
        </div>
        <Card style={{ marginBottom: 16, borderColor: "#1e2848" }}>
          <Label>MISSION BRIEFING</Label>
          <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 16, color: "#5a6a8a", lineHeight: 1.95, fontStyle: "italic" }}>{intro}</div>
        </Card>
        {children}
      </div>
    </div>
  );
}

interface TimerBarProps {
  elapsed: number;
  solved: number;
  total: number;
}
function TimerBar({ elapsed, solved, total }: TimerBarProps) {
  const c = elapsed > 5400 ? "#e05060" : elapsed > 3600 ? "#d4aa50" : "#7a9fff";
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "rgba(4,5,12,.96)", borderBottom: "1px solid #14182e", padding: "7px 20px", display: "flex", alignItems: "center", gap: 16, backdropFilter: "blur(8px)" }}>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 9, color: "#1e2848", letterSpacing: 4 }}>THE LOST CHRONICLE</div>
      <div style={{ flex: 1, height: 1, background: "#14182e" }} />
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#2a3250" }}>PUZZLES <span style={{ color: "#b0bcd4" }}>{solved}/{total}</span></div>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 13, color: c }}>⏱ {fmtTime(elapsed)}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// FLOW DATA
// ═══════════════════════════════════════════════
const FLOW = [
  { type: "scene", bg: "gate", title: "I. THE GATE", chars: [{ id: "aurelis", side: "left" }, { id: "wren", side: "right" }], lines: [
    { speaker: null, text: "Prague. January, 1789.\nA blizzard erases the eastern road. The gate lanterns have been out for an hour.\n\nThen one man walks through the snow as if the cold does not touch him.", mood: "narrate" },
    { speaker: "aurelis", text: "You won't remember this conversation.\nYou never do.", mood: "calm" },
    { speaker: "wren", text: "I beg your pardon — do we know each other, sir?", mood: "shock" },
    { speaker: "aurelis", text: "Not yet. And not again, after tonight.\nBut your hand knows what your mind does not.\nSit. Draw.", mood: "cold" },
    { speaker: null, text: "He produces a device — circular, cold blue, humming at a frequency no instrument can measure.\nThe cartographer Aldous Wren stares. His hand reaches for his pen.", mood: "narrate" },
    { speaker: "wren", text: "I've never been to the eastern roads.\nI've never left Prague.\nHow could I possibly—", mood: "urgent" },
    { speaker: "aurelis", text: "You've walked them in a life that hasn't happened yet.\nYour hand already knows the way. Trust it.", mood: "calm" },
    { speaker: null, text: "Wren draws for three hours without stopping.\nHe does not look up once.\n\nThe finished map matches six others drawn independently across Europe by people who had never met.\nEvery road. Every bridge. Every border stone. Exact.", mood: "narrate" },
    { speaker: "aurelis", text: "You've done well, Aldous.\nThe record holds for another century.", mood: "whisper" },
    { speaker: null, text: "The man was already gone.\nThe gate lanterns came back on.\nThe snow bore no footprints leading away.", mood: "narrate" },
  ]},
  { type: "puzzle", id: "map", title: "Puzzle I — The Cartographer's Map", intro: "Wren's trade map was shattered into 16 fragments. Each piece's label encodes its exact position — Row 0 is north, Row 1 is south, columns C0 (west) to C7 (east). Drag every fragment to its correct grid cell." },
  { type: "scene", bg: "study", title: "II. THE SYMBOL", chars: [{ id: "wren", side: "left" }, { id: "aurelis", side: "right" }], lines: [
    { speaker: null, text: "Three days after the gate.\nWren has not slept.\nHe has drawn the six symbols from memory forty-seven times.", mood: "narrate" },
    { speaker: "wren", text: "I keep seeing them — the marks you scratched into the gate stone.\nSix symbols I've never learned, yet I know them.", mood: "urgent" },
    { speaker: "aurelis", text: "They are called anchor marks.\nThey existed in every language that mattered — before languages were recorded.", mood: "calm" },
    { speaker: "wren", text: "What are you anchoring?", mood: "quiet" },
    { speaker: "aurelis", text: "The record. History without an anchor drifts.\nCenturies bleed into one another. Events unmoor themselves from their causes.\nI hold the thread.", mood: "grave" },
    { speaker: "wren", text: "How long have you held it?", mood: "quiet" },
    { speaker: "aurelis", text: "Long enough to forget how it felt not to.", mood: "tired" },
    { speaker: null, text: "He left before Wren could ask another question.\nThe six symbols remained in the gate stone for one hundred and eighty-nine years.\nUntil Project NULL found them.", mood: "narrate" },
  ]},
  { type: "puzzle", id: "cipher", title: "Puzzle II — The Cipher Scroll", intro: "Aurelis scratched six symbols into the eastern gate stone in 1189, encoding a two-word phrase. Only one symbol is legible at the start — it appears in both words." },
  { type: "scene", bg: "forest", title: "III. THE WEIGHT", chars: [{ id: "aurelis", side: "left" }], lines: [
    { speaker: null, text: "The Bohemian forest road. One year after the gate.\nA merchant reports seeing a man who has not aged, walking alone in the dark.", mood: "narrate" },
    { speaker: "aurelis", text: "Every road I walk — I leave a record.\nNot in stone. Not in ink.\nIn the structure of what happened.", mood: "tired" },
    { speaker: "aurelis", text: "The Archive Key was never meant to last this long.\nI was never meant to last this long.", mood: "ominous" },
    { speaker: null, text: "In 1978, telegraph operators monitoring abandoned frequencies would intercept strange numeric patterns.\nDecoded, they described roads no longer on any modern map.\nRoads that perfectly matched Wren's 1789 chart.", mood: "narrate" },
    { speaker: "aurelis", text: "Someday someone will read what I leave behind.\nI wonder if they will understand.\nOr if it will already be too late.", mood: "whisper" },
  ]},
  { type: "puzzle", id: "sudoku", title: "Puzzle III — The Frequency Grid", intro: "Telegraph intercepts in 1978 arrived as a 9×9 numeric grid with deliberate gaps — a puzzle Aurelis built as a lock. Fill every row, column, and 3×3 box with digits 1–9, each appearing exactly once." },
  { type: "scene", bg: "office", title: "IV. THE ERASURE", chars: [{ id: "voss", side: "left" }, { id: "maren", side: "right" }], lines: [
    { speaker: null, text: "Project NULL. Prague Field Office.\nJanuary 14th, 1978. 11:47 PM.", mood: "narrate" },
    { speaker: "voss", text: "Ivan. The photograph I took on Tuesday.\nLook at it now and tell me what you see.", mood: "urgent" },
    { speaker: "maren", text: "I see the Wren commission. The authentication seal. The signature.", mood: "flat" },
    { speaker: "voss", text: "And the co-signature beside it.", mood: "cold" },
    { speaker: "maren", text: "There is no co-signature, Elara.", mood: "flat" },
    { speaker: "voss", text: "There WAS. I photographed it myself.\nThe Aurelis mark — right there.\nIt was there Tuesday. Now it isn't.", mood: "desperate" },
    { speaker: "voss", text: "Six researchers across twelve countries.\nAll reporting the same erasure. In real time.\nWhile the documents are in locked archives.", mood: "grave" },
    { speaker: "voss", text: "Someone is rewriting him out of history.\nAnd they're doing it right now, while we're watching.", mood: "whisper" },
  ]},
  { type: "puzzle", id: "archive", title: "Puzzle IV — The Archive Reconstruction", intro: "Five fragments of Aurelis's written record span nine centuries. Click two to swap them — but you only get 5 swaps total. Run out, or submit the wrong order, and the board resets after a 3-minute cooldown." },
  { type: "scene", bg: "vault", title: "V. THE VAULT", chars: [{ id: "voss", side: "left" }, { id: "cole", side: "right" }], lines: [
    { speaker: null, text: "Sublevel 3. The Restricted Vault.\nVoss has not left in thirty-six hours.", mood: "narrate" },
    { speaker: "cole", text: "Elara. Director Ashford has been asking for you since noon.", mood: "low" },
    { speaker: "voss", text: "Cole — I found the original key schematic.\nThe Archive Key is not a document.\nIt's a logic circuit.", mood: "fierce" },
    { speaker: "voss", text: "Aurelis built a device that stabilised historical memory across six anchor gates.\nThe arrangement of the logic components matters.\nIf one gate is wrong, the circuit fails. The record drifts.", mood: "urgent" },
    { speaker: "cole", text: "You think the circuit has been sabotaged?", mood: "quiet" },
    { speaker: "voss", text: "Not failed. Sabotaged. Deliberately.\nSomeone who doesn't want the record to hold.", mood: "revelation" },
    { speaker: null, text: "The schematic was confiscated the next morning.\nVoss had already memorised every line.", mood: "narrate" },
  ]},
  { type: "puzzle", id: "logic", title: "Puzzle V — The Logic Gate Ring", intro: "Ten gates available. Pick four and arrange them in a ring so no two adjacent gates produce the same output for the shifting inputs A and B. Validate twice across two different input states." },
  { type: "scene", bg: "rooftop", title: "VI. THE SEAL", chars: [{ id: "voss", side: "left" }, { id: "ashford", side: "right" }], lines: [
    { speaker: null, text: "Director Ashford's office. December 1978.\nThe last Project NULL briefing ever held.", mood: "narrate" },
    { speaker: "ashford", text: "The investigation is closed, Dr. Voss.\nEvery copy surrendered. Every record classified DELTA-X.", mood: "flat" },
    { speaker: "voss", text: "You can't classify a paradox, Director.\nAurelis doesn't stop existing because we stop looking.", mood: "fierce" },
    { speaker: "ashford", text: "We are not in the business of chasing ghosts.", mood: "cold" },
    { speaker: "voss", text: "He isn't a ghost. He held the record together for centuries.\nAnd someone cut the thread while we were watching.", mood: "desperate" },
    { speaker: "ashford", text: "There is no Aurelis. There never was.\nThat is the official position.", mood: "final" },
    { speaker: "voss", text: "The official position is a lie.", mood: "cold" },
    { speaker: null, text: "Four records survived the purge.\nVoss hid them where no directive could reach.\nAnd waited.", mood: "narrate" },
  ]},
  { type: "puzzle", id: "crossword", title: "Puzzle VI — Recovery Protocol", intro: "Recover each missing word. The first letter of every recovered word reveals the next directive." },
  { type: "scene", bg: "echo_lab", title: "VII. ECHO", chars: [{ id: "echo", side: "right" }], lines: [
    { speaker: null, text: "1983. A classified facility — no address on record.\nFive years after Project NULL was shuttered, one researcher continued.", mood: "narrate" },
    { speaker: "echo", text: "The erasure didn't start in 1978.\nIt started in 1189.\nSomeone has been removing him for eight hundred years.", mood: "conspire" },
    { speaker: "echo", text: "Every map Wren drew — corrected before publication.\nEvery document Aurelis co-signed — re-catalogued under a different name.\nHundreds of small cuts. Centuries of patience.", mood: "grave" },
    { speaker: "echo", text: "Whoever is doing this isn't afraid of him.\nThey're afraid of what happens when the record holds.\nWhen history can no longer be rewritten.", mood: "ominous" },
    { speaker: "echo", text: "If you're reading this:\nThe erasure isn't finished.\nNeither are we.", mood: "whisper" },
  ]},
  { type: "scene", bg: "briefing", title: "VIII. YOUR ASSIGNMENT", chars: [{ id: "voss", side: "left" }, { id: "you", side: "right" }], lines: [
    { speaker: null, text: "Present day.\nYou receive a package with no return address.\nInside — a photograph, five documents, and a handwritten note.\n\nYou recognise the handwriting from the Project NULL files.", mood: "narrate" },
    { speaker: "voss", text: "If you're reading this, I'm already gone.\nDon't look for me. Look at what I left.", mood: "tired" },
    { speaker: "you", text: "I know he was erased. I know Project NULL found him and was shut down.\nWhat I don't know is why. Or by whom.", mood: "quiet" },
    { speaker: "voss", text: "That's the final question. The one I couldn't answer in time.", mood: "grave" },
    { speaker: "voss", text: "One final cipher. My last message.\nCrack it — and the Archive reopens. He is remembered.", mood: "fierce" },
    { speaker: "you", text: "And if I fail?", mood: "quiet" },
    { speaker: "voss", text: "Then whoever erased him erases everyone who looked.\nThat includes you. That includes me.", mood: "desperate" },
    { speaker: null, text: "You open the final document.\nFive sentences. Each beginning with a letter.\nYou already know what to do.", mood: "narrate" },
  ]},
  { type: "puzzle", id: "final", title: "Puzzle VII — The Final Cipher", intro: "Voss's last message hides a word in plain sight. The first letter of each sentence, read top to bottom, spells the instruction she left for you." },
];

const TOTAL_SCENES = FLOW.filter(f => f.type === "scene").length;
const TOTAL_PUZZLES = FLOW.filter(f => f.type === "puzzle").length;

// ═══════════════════════════════════════════════
// PUZZLE I — MAP (8×2)
// ═══════════════════════════════════════════════
const MAP_PIECES = [
  { id: 0, sym: "⬡", label: "Northern Pass",  col: 0, row: 0 },
  { id: 1, sym: "◈", label: "Meridian Gate",  col: 1, row: 0 },
  { id: 2, sym: "◇", label: "Eastern Vale",   col: 2, row: 0 },
  { id: 3, sym: "✦", label: "Trade Nexus",    col: 3, row: 0 },
  { id: 4, sym: "⊕", label: "Sunken Archive", col: 4, row: 0 },
  { id: 5, sym: "◉", label: "Western Shore",  col: 5, row: 0 },
  { id: 6, sym: "⬢", label: "Salt Road",      col: 6, row: 0 },
  { id: 7, sym: "△", label: "River Crossing", col: 7, row: 0 },
  { id: 8, sym: "▽", label: "Low Marsh",      col: 0, row: 1 },
  { id: 9, sym: "⊗", label: "Iron Bridge",    col: 1, row: 1 },
  { id: 10, sym: "⊜", label: "Pilgrim Road",  col: 2, row: 1 },
  { id: 11, sym: "⊞", label: "Fort Crest",    col: 3, row: 1 },
  { id: 12, sym: "◍", label: "Scholar's Gate",col: 4, row: 1 },
  { id: 13, sym: "◎", label: "Night Market",  col: 5, row: 1 },
  { id: 14, sym: "◐", label: "Stone Quay",    col: 6, row: 1 },
  { id: 15, sym: "◑", label: "Archive Gate",  col: 7, row: 1 },
];
// Shuffled tray order (deliberately not matching grid order)
const TRAY_ORDER = [7, 12, 3, 14, 0, 9, 5, 15, 2, 10, 6, 1, 11, 4, 13, 8];

function PuzzleMap({ onSolve, onPenalty }: { onSolve: () => void, onPenalty: () => void }) {
  const [grid, setGrid] = useState<(number | null)[][]>(() => Array.from({ length: 2 }, () => Array(8).fill(null)));
  const [placed, setPlaced] = useState<Record<number, { col: number, row: number }>>({});
  const [dragId, setDragId] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const { cd, active: cdActive, trigger: triggerCd } = useCooldown(120);
  const [attempts, setAttempts] = useState(0);
  const byId = (id: number) => MAP_PIECES.find(p => p.id === id)!;
  const tray = TRAY_ORDER.filter(id => placed[id] === undefined);
  const drop = (col: number, row: number) => {
    if (dragId === null || cdActive) return;
    const ng = grid.map(r => [...r]);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) if (ng[r][c] === dragId) ng[r][c] = null;
    const ex = ng[row][col]; const np = { ...placed }; if (ex !== null) delete np[ex];
    ng[row][col] = dragId; np[dragId] = { col, row };
    setGrid(ng); setPlaced(np); setDragId(null);
    const all = MAP_PIECES.every(m => np[m.id] !== undefined);
    if (all) {
      const ok = MAP_PIECES.every(m => np[m.id] && np[m.id].col === m.col && np[m.id].row === m.row);
      if (ok) { setSolved(true); }
      else { const a = attempts + 1; setAttempts(a); onPenalty(); triggerCd(); sfx("error"); }
    }
  };
  return (
    <PuzzleShell title="The Cartographer's Map" era="c. 1789" intro="Each fragment's label is its grid address. Row 0=north, Row 1=south, C0=west, C7=east. Drag all 16 pieces to their correct cells. A wrong full placement triggers a 2-minute cooldown.">
      <CooldownOverlay cd={cd} />
      {solved ? <SolvedCard word="The map glows. All roads converge on the Archive." fragLabel="AURELIS — FRAGMENT I" onReturn={onSolve} /> : (
        <>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <div style={{ minWidth: 500 }}>
              <div style={{ display: "flex", gap: 4, paddingLeft: 26, marginBottom: 6 }}>
                {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ width: 70, textAlign: "center", flexShrink: 0, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848" }}>C{i}</div>)}
              </div>
              {[0, 1].map(row => (
                <div key={row} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848", width: 22, flexShrink: 0 }}>R{row}</div>
                  {Array.from({ length: 8 }, (_, col) => {
                    const occ = grid[row][col]; const p = occ !== null ? byId(occ) : null;
                    const ok = p && p.col === col && p.row === row;
                    return (
                      <div key={col} onDragOver={e => e.preventDefault()} onDrop={() => drop(col, row)}
                        style={{ width: 70, height: 76, flexShrink: 0, border: `1px ${p ? "solid" : "dashed"} ${p ? (ok ? "#4a7aff" : "#e05060") : "#14182e"}`, background: cdActive ? "#0a0414" : p ? "#090912" : "#060710", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .25s", opacity: cdActive ? 0.5 : 1 }}>
                        {p ? (
                          <div draggable={!cdActive} onDragStart={() => !cdActive && setDragId(p.id)} style={{ textAlign: "center", cursor: cdActive ? "not-allowed" : "grab", userSelect: "none", padding: "2px 4px" }}>
                             <div style={{ fontSize: 20, color: ok ? "#7a9fff" : "#5a6a8a" }}>{p.sym}</div>
                             <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 6, color: ok ? "#4a7aff" : "#1e2848", lineHeight: 1.2, marginTop: 2 }}>{p.label}</div>
                          </div>
                        ) : <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 6, color: "#1e2848" }}>PLACE</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <Card style={{ marginBottom: 12 }}>
            <Label>FRAGMENT TRAY — DRAG TO GRID</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tray.map(id => { const p = byId(id); return (
                <div key={p.id} draggable={!cdActive} onDragStart={() => !cdActive && setDragId(p.id)}
                  style={{ padding: "8px 10px", background: "#050610", border: "1px solid #14182e", cursor: cdActive ? "not-allowed" : "grab", textAlign: "center", minWidth: 60, userSelect: "none", opacity: cdActive ? 0.4 : 1 }}>
                  <div style={{ fontSize: 17, color: "#b0bcd4" }}>{p.sym}</div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 6, color: "#1e2848", marginTop: 2, lineHeight: 1.2 }}>{p.label}</div>
                </div>
              ); })}
              {tray.length === 0 && <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 13, color: "#1e2848", fontStyle: "italic" }}>All placed — red = wrong position.</div>}
            </div>
          </Card>
          {attempts > 0 && <HintBox text="Each label is literally its address. 'Northern Pass' → R0,C0. 'Archive Gate' → R1,C7. Red border = wrong cell." />}
        </>
      )}
    </PuzzleShell>
  );
}

// ═══════════════════════════════════════════════
// PUZZLE II — CIPHER
// ═══════════════════════════════════════════════
const CMAP: Record<string, string> = { A:"◈",B:"⬡",C:"◇",D:"✦",E:"⊕",F:"◉",G:"⊞",H:"⊗",I:"△",J:"▽",K:"◬",L:"⊿",M:"⬟",N:"⬢",O:"⊛",P:"⊜",Q:"⊝",R:"◍",S:"◎",T:"◐",U:"◑",V:"◒",W:"◓",X:"◔",Y:"◕",Z:"⊙" };
const CIPHER_WORDS = ["ANCHOR", "HOLDS"];
const CIPHER_ANS = CIPHER_WORDS.join(" ");
const ENCODED = CIPHER_WORDS.map(w => w.split("").map(c => CMAP[c]).join("  ")).join("    │    ");
const CIPHER_KEY_LETTER = "H";
function PuzzleCipher({ onSolve, onPenalty }: { onSolve: () => void, onPenalty: () => void }) {
  const [ans, setAns] = useState(""); const [err, setErr] = useState(""); const [solved, setSolved] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const { cd, active: cdActive, trigger: triggerCd } = useCooldown(120);
  const [attempts, setAttempts] = useState(0);
  const submit = () => {
    if (cdActive) return;
    const norm = ans.trim().toUpperCase().replace(/\s+/g, " ");
    if (norm === CIPHER_ANS) { setSolved(true); return; }
    const a = attempts + 1; setAttempts(a); onPenalty(); triggerCd(); sfx("error");
    setErr(a >= 2 ? "Still wrong — the full table has been revealed below." : "Incorrect. Use the one known symbol to find where it repeats in both words.");
    if (a >= 2) setShowTable(true);
  };
  return (
    <PuzzleShell title="The Cipher Scroll" era="c. 1189" intro="Six symbols were carved into the eastern gate stone, encoding a two-word phrase. Only one symbol is legible — it appears in both words. Use it, and what you already know about Aurelis's marks, to find the rest.">
      <CooldownOverlay cd={cd} />
      {solved ? <SolvedCard word="ANCHOR HOLDS — the words carved before language was written, holding centuries together." fragLabel="ANCHOR HOLDS — FRAGMENT II" onReturn={onSolve} /> : (
        <>
          <Card style={{ marginBottom: 16, background: "#08091a", borderColor: "#1e2848", padding: "26px 30px" }}>
            <Label>GATE STONE INSCRIPTION — 1189 CE</Label>
            <div style={{ padding: "16px 20px", background: "#050610", border: "1px solid #1e2848", textAlign: "center", letterSpacing: 8, fontSize: 22, color: "#7a9fff", marginTop: 8, lineHeight: 1.8 }}>{ENCODED}</div>
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <Label>RECOVERED KEY FRAGMENT</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontSize: 28, color: "#7a9fff", flexShrink: 0 }}>{CMAP[CIPHER_KEY_LETTER]}</div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 14, color: "#dde4f5", flexShrink: 0 }}>= {CIPHER_KEY_LETTER}</div>
              <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 13, color: "#5a6a8a", fontStyle: "italic" }}>The only mark still legible. It appears once in each word.</div>
            </div>
          </Card>
          {showTable && (
            <Card style={{ marginBottom: 16 }}>
              <Label>SUBSTITUTION TABLE — REVEALED</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(60px,1fr))", gap: 4 }}>
                {Object.entries(CMAP).map(([l, s]) => (
                  <div key={l} style={{ padding: "7px 4px", background: "#050610", border: "1px solid #14182e", textAlign: "center" }}>
                    <div style={{ fontSize: 15, color: "#4a7aff", marginBottom: 3 }}>{s}</div>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: "#b0bcd4" }}>= {l}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <Label>DECODED PHRASE</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={ans} onChange={e => { setAns(e.target.value.toUpperCase()); setErr(""); }} onKeyDown={e => e.key === "Enter" && !cdActive && submit()} placeholder="TYPE THE DECODED PHRASE..."
                disabled={cdActive}
                style={{ flex: 1, minWidth: 220, background: cdActive ? "#0a0414" : "#050610", border: "1px solid #1e2848", color: "#7a9fff", padding: "12px 16px", fontFamily: "'Share Tech Mono',monospace", fontSize: 16, letterSpacing: 4, opacity: cdActive ? 0.5 : 1 }} />
              <Btn onClick={submit} color="#4a7aff" disabled={cdActive}>DECODE</Btn>
            </div>
            <ErrMsg msg={err} />
          </Card>
        </>
      )}
    </PuzzleShell>
  );
}

// ═══════════════════════════════════════════════
// PUZZLE III — SUDOKU
// ═══════════════════════════════════════════════
const SUDOKU_PUZZLE = [
  [5,3,0,0,7,0,0,0,0],
  [6,0,0,1,9,5,0,0,0],
  [0,9,8,0,0,0,0,6,0],
  [8,0,0,0,6,0,0,0,3],
  [4,0,0,8,0,3,0,0,1],
  [7,0,0,0,2,0,0,0,6],
  [0,6,0,0,0,0,2,8,0],
  [0,0,0,4,1,9,0,0,5],
  [0,0,0,0,8,0,0,7,9],
];
const SUDOKU_SOL = [
  [5,3,4,6,7,8,9,1,2],
  [6,7,2,1,9,5,3,4,8],
  [1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],
  [4,2,6,8,5,3,7,9,1],
  [7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],
  [2,8,7,4,1,9,6,3,5],
  [3,4,5,2,8,6,1,7,9],
];
function PuzzleSudoku({ onSolve, onPenalty }: { onSolve: () => void, onPenalty: () => void }) {
  const initGrid = () => SUDOKU_PUZZLE.map(r => r.map(v => v === 0 ? "" : String(v)));
  const [grid, setGrid] = useState<string[][]>(initGrid);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const { cd, active: cdActive, trigger: triggerCd } = useCooldown(120);
  const [attempts, setAttempts] = useState(0);

  const isFixed = (r: number, c: number) => SUDOKU_PUZZLE[r][c] !== 0;

  const check = () => {
    if (cdActive) return;
    const errs = new Set<string>();
    let complete = true;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const v = parseInt(grid[r][c]);
      if (!v) { complete = false; continue; }
      if (v !== SUDOKU_SOL[r][c]) { errs.add(`${r},${c}`); complete = false; }
    }
    if (complete && errs.size === 0) { setSolved(true); return; }
    if (errs.size > 0) {
      setErrors(errs);
      const a = attempts + 1; setAttempts(a);
      onPenalty(); triggerCd(); sfx("error");
      setTimeout(() => setErrors(new Set()), 3000);
    }
  };

  const setCell = (r: number, c: number, v: string) => {
    if (isFixed(r, c) || cdActive) return;
    const vt = v.replace(/[^1-9]/g, "").slice(-1);
    const ng = grid.map(row => [...row]);
    ng[r][c] = vt;
    setGrid(ng);
  };

  const handleKey = (r: number, c: number, e: React.KeyboardEvent<any>) => {
    if (cdActive) return;
    if (e.key >= "1" && e.key <= "9") setCell(r, c, e.key);
    else if (e.key === "Backspace" || e.key === "Delete") setCell(r, c, "");
    else if (e.key === "Enter") check();
    const dirs: Record<string, number[]> = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
    if (dirs[e.key]) { const [dr,dc] = dirs[e.key]; const nr = Math.max(0,Math.min(8,r+dr)); const nc = Math.max(0,Math.min(8,c+dc)); setSel(`${nr},${nc}`); e.preventDefault(); }
  };

  const BOX_BORDERS = (r: number, c: number) => ({
    borderTop: r % 3 === 0 ? "2px solid #4a7aff55" : "1px solid #14182e",
    borderLeft: c % 3 === 0 ? "2px solid #4a7aff55" : "1px solid #14182e",
    borderRight: c === 8 ? "2px solid #4a7aff55" : "1px solid #14182e",
    borderBottom: r === 8 ? "2px solid #4a7aff55" : "1px solid #14182e",
  });

  const selR = sel ? parseInt(sel.split(",")[0]) : -1;
  const selC = sel ? parseInt(sel.split(",")[1]) : -1;

  return (
    <PuzzleShell title="The Frequency Grid" era="c. 1978" intro="Fill every row, column, and 3×3 box with digits 1–9. Each digit appears exactly once per unit. A wrong submission triggers a 2-minute cooldown.">
      <CooldownOverlay cd={cd} />
      {solved ? <SolvedCard word="Grid locked. Frequency decoded. Signal authenticated." fragLabel="SIGNAL — FRAGMENT III" onReturn={onSolve} /> : (
        <>
          <Card glow="#4a7aff" style={{ marginBottom: 16, padding: "20px", display: "inline-block" }}>
            <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(9,1fr)", gap: 0 }}>
              {grid.map((row, r) => row.map((val, c) => {
                const fixed = isFixed(r, c);
                const isErr = errors.has(`${r},${c}`);
                const isSel = sel === `${r},${c}`;
                const sameRow = r === selR && !isSel;
                const sameCol = c === selC && !isSel;
                const sameBox = selR >= 0 && Math.floor(r/3)===Math.floor(selR/3) && Math.floor(c/3)===Math.floor(selC/3) && !isSel;
                const sameNum = val && sel && grid[selR]?.[selC] === val && !isSel;
                let bg = "#060710";
                if (isErr) bg = "#cc334422";
                else if (isSel) bg = "#4a7aff22";
                else if (sameNum) bg = "#4a7aff18";
                else if (sameRow || sameCol || sameBox) bg = "#4a7aff0a";
                return (
                  <div key={`${r},${c}`} onClick={() => !cdActive && setSel(`${r},${c}`)}
                    onKeyDown={e => handleKey(r, c, e)} tabIndex={fixed ? -1 : 0}
                    style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: bg, ...BOX_BORDERS(r, c), cursor: fixed ? "default" : "text", position: "relative", transition: "background .15s", outline: isSel ? "2px solid #4a7aff66" : "none", outlineOffset: -1 }}>
                    {isSel && !fixed ? (
                      <input autoFocus value={val} onChange={e => setCell(r, c, e.target.value)} onKeyDown={e => handleKey(r, c, e)}
                        style={{ width: "100%", height: "100%", background: "transparent", border: "none", textAlign: "center", fontFamily: "'Share Tech Mono',monospace", fontSize: 20, color: isErr ? "#e05060" : "#7a9fff", caretColor: "transparent", cursor: "text" }} maxLength={1} />
                    ) : (
                      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 20, color: fixed ? "#dde4f5" : isErr ? "#e05060" : val ? "#7a9fff" : "#1e2848", fontWeight: fixed ? 700 : 400 }}>{val || ""}</span>
                    )}
                  </div>
                );
              }))}
            </div>
          </Card>
          <Card glow="#4a7aff" style={{ marginBottom: 12 }}>
            <Label>NUMBER PAD</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => { if (sel && !cdActive) { const [r,c] = sel.split(",").map(Number); setCell(r,c,String(n)); } }}
                  style={{ width: 40, height: 40, background: "#050610", border: "1px solid #1e2848", color: "#7a9fff", fontFamily: "'Share Tech Mono',monospace", fontSize: 16, cursor: cdActive ? "not-allowed" : "pointer", opacity: cdActive ? 0.4 : 1 }}>{n}</button>
              ))}
              <button onClick={() => { if (sel && !cdActive) { const [r,c] = sel.split(",").map(Number); setCell(r,c,""); } }}
                style={{ width: 40, height: 40, background: "#050610", border: "1px solid #cc334444", color: "#cc3344", fontFamily: "'Share Tech Mono',monospace", fontSize: 12, cursor: cdActive ? "not-allowed" : "pointer", opacity: cdActive ? 0.4 : 1 }}>✕</button>
            </div>
          </Card>
          <Btn onClick={check} color="#4a7aff" disabled={cdActive}>VALIDATE GRID</Btn>
        </>
      )}
    </PuzzleShell>
  );
}

// ═══════════════════════════════════════════════
// PUZZLE IV — ARCHIVE (one swap at a time, 3-min cd on wrong)
// ═══════════════════════════════════════════════
const ARCHIVE_FRAGS = [
  { id: "a", year: 1087, text: "A traveller known only as AURELIS signs the land accord between the eastern territories. Seven witnesses attest. No portrait exists. No origin recorded." },
  { id: "b", year: 1189, text: "AURELIS is recorded as cartographic consultant to the Third Crusade. He advises on mountain passes he claims to have 'walked within recent memory.' The passes are confirmed accurate." },
  { id: "c", year: 1492, text: "A navigator's log from the Canary Islands describes a man matching AURELIS's description who 'corrected our charts before we set sail.' The corrections saved the expedition." },
  { id: "d", year: 1789, text: "Cartographer Aldous Wren draws a complete trade map of Europe in one sitting. He credits 'a visitor at the eastern gate' for knowledge he cannot otherwise explain." },
  { id: "e", year: 1978, text: "Project NULL officially terminates. All records sealed DELTA-X. Dr. Voss files a final note: 'The record was never wrong. We were.'" },
];
const CORRECT_ORDER = ["a","b","c","d","e"];
const SCRAMBLED_ORDER = ["b","c","d","e","a"];
const MAX_ARCHIVE_SWAPS = 10;

function PuzzleArchive({ onSolve, onPenalty }: { onSolve: () => void, onPenalty: () => void }) {
  const [order, setOrder] = useState<string[]>([...SCRAMBLED_ORDER]);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [swapsUsed, setSwapsUsed] = useState(0);
  const { cd, active: cdActive, trigger: triggerCd } = useCooldown(180);
  const [attempts, setAttempts] = useState(0);
  const byId = (id: string) => ARCHIVE_FRAGS.find(f => f.id === id)!;

  const resetBoard = () => { setOrder([...SCRAMBLED_ORDER]); setSwapsUsed(0); setSelIdx(null); };

  const handleClick = (i: number) => {
    if (cdActive || solved) return;
    if (selIdx === null) { setSelIdx(i); return; }
    if (selIdx === i) { setSelIdx(null); return; }
    // Perform one swap
    const no = [...order]; [no[selIdx], no[i]] = [no[i], no[selIdx]];
    setSelIdx(null);
    setOrder(no);
    const used = swapsUsed + 1;
    setSwapsUsed(used);
    // Check immediately after swap
    if (JSON.stringify(no) === JSON.stringify(CORRECT_ORDER)) { setSolved(true); return; }
    if (used >= MAX_ARCHIVE_SWAPS) {
      const a = attempts + 1; setAttempts(a); onPenalty(); triggerCd(); sfx("error");
      setTimeout(resetBoard, 60);
    }
  };

  const submit = () => {
    if (cdActive) return;
    if (JSON.stringify(order) === JSON.stringify(CORRECT_ORDER)) { setSolved(true); return; }
    const a = attempts + 1; setAttempts(a); onPenalty(); triggerCd(); sfx("error");
    resetBoard();
  };

  const swapsLeft = MAX_ARCHIVE_SWAPS - swapsUsed;

  return (
    <PuzzleShell title="The Archive Reconstruction" era="c. 1087–1978" intro={`Five fragments span nine centuries. Click two fragments to swap them. You have only ${MAX_ARCHIVE_SWAPS} swaps total — run out without solving, or submit the wrong order, and the board resets with a 3-minute cooldown.`}>
      <CooldownOverlay cd={cd} />
      {solved ? <SolvedCard word="Five centuries of record, restored in order." fragLabel="ORDER — FRAGMENT IV" onReturn={onSolve} /> : (
        <>
          <Label>CLICK TWO FRAGMENTS TO SWAP THEM</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: swapsLeft <= 1 ? "#e05060" : "#5a6a8a", letterSpacing: 2 }}>SWAPS LEFT: {swapsLeft}/{MAX_ARCHIVE_SWAPS}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {Array.from({ length: MAX_ARCHIVE_SWAPS }).map((_, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < swapsUsed ? "#e05060" : "#14182e", border: "1px solid #1e2848", transition: "background .2s" }} />
              ))}
            </div>
          </div>
          {selIdx !== null && <div style={{ marginBottom: 10, fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#d4aa50", letterSpacing: 3 }}>▸ FRAGMENT {selIdx + 1} SELECTED — CLICK ANOTHER TO SWAP</div>}
          {order.map((id, i) => { const f = byId(id); const isSel = selIdx === i;
            return (
              <div key={id} onClick={() => handleClick(i)}
                style={{ padding: "16px 20px", marginBottom: 7, background: isSel ? "#d4aa5012" : cdActive ? "#0a0414" : "#09091a", border: `1px solid ${isSel ? "#d4aa50" : cdActive ? "#1a0810" : "#14182e"}`, cursor: cdActive ? "not-allowed" : "pointer", display: "flex", gap: 16, alignItems: "flex-start", transition: "all .15s", animation: "fadeUp .4s ease-out", userSelect: "none", opacity: cdActive ? 0.45 : 1 }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, color: isSel ? "#d4aa50" : "#1e2848", flexShrink: 0, minWidth: 26, textAlign: "center" }}>{i + 1}</div>
                <div>
                  <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848", letterSpacing: 2, marginBottom: 7 }}>RECOVERED FRAGMENT — DATE REDACTED</div>
                  <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 15, color: isSel ? "#dde4f5" : "#5a6a8a", lineHeight: 1.9, fontStyle: "italic" }}>"{f.text}"</div>
                </div>
              </div>
            );
          })}
          <Card style={{ marginTop: 8 }}>
            <Btn onClick={submit} color="#4a7aff" disabled={cdActive}>CONFIRM CHRONOLOGY</Btn>
            {attempts > 0 && <HintBox text="Order by century: 1087 CE (land accord) → 1189 CE (Third Crusade) → 1492 CE (Canary Islands) → 1789 CE (trade map) → 1978 CE (Project NULL). Fragment 'a' (bottom) belongs at position 1." />}
          </Card>
        </>
      )}
    </PuzzleShell>
  );
}

// ═══════════════════════════════════════════════
// PUZZLE V — LOGIC GATE RING (10 gates, pick 4)
// ═══════════════════════════════════════════════
const ALL_GATES = [
  { id: 0, name: "AND",  sym: "∧", op: (a: number, b: number) => a&b },
  { id: 1, name: "OR",   sym: "∨", op: (a: number, b: number) => a|b },
  { id: 2, name: "XOR",  sym: "⊕", op: (a: number, b: number) => a^b },
  { id: 3, name: "NAND", sym: "⊼", op: (a: number, b: number) => 1-(a&b) },
  { id: 4, name: "NOR",  sym: "⊽", op: (a: number, b: number) => 1-(a|b) },
  { id: 5, name: "XNOR", sym: "⊙", op: (a: number, b: number) => 1-(a^b) },
  { id: 6, name: "BUF-A",sym: "▷", op: (a: number, _: number) => a },
  { id: 7, name: "BUF-B",sym: "◁", op: (_: number, b: number) => b },
  { id: 8, name: "NOT-A",sym: "¬A", op: (a: number, _: number) => 1-a },
  { id: 9, name: "NOT-B",sym: "¬B", op: (_: number, b: number) => 1-b },
];

function PuzzleLogic({ onSolve, onPenalty }: { onSolve: () => void, onPenalty: () => void }) {
  const [inp, setInp] = useState({ a: 1, b: 0 });
  const [countdown, setCountdown] = useState(60);
  const [ring, setRing] = useState<(number | null)[]>([null, null, null, null]); // 4 slots
  const [bench, setBench] = useState<number[]>(ALL_GATES.map(g => g.id));
  const [selBench, setSelBench] = useState<number | null>(null);
  const [selRing, setSelRing] = useState<number | null>(null);
  const [valErr, setValErr] = useState("");
  const [solved, setSolved] = useState(false);
  const [vSet, setVSet] = useState<Set<string>>(() => new Set());
  const { cd, active: cdActive, trigger: triggerCd } = useCooldown(120);

  useEffect(() => {
    if (solved) return;
    const id = setInterval(() => setCountdown(t => {
      if (t <= 1) { setInp({ a: Math.round(Math.random()), b: Math.round(Math.random()) }); return 60; }
      return t - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [solved]);

  const gById = (id: number) => ALL_GATES.find(g => g.id === id)!;

  // Place from bench to ring slot
  const handleRingSlotClick = (ri: number) => {
    if (cdActive) return;
    if (selBench !== null) {
      const nr = [...ring]; const nb = [...bench];
      const oldInSlot = nr[ri];
      nr[ri] = selBench;
      const bIdx = nb.indexOf(selBench); nb.splice(bIdx, 1);
      if (oldInSlot !== null) nb.push(oldInSlot);
      setRing(nr); setBench(nb.sort((a,b)=>a-b)); setSelBench(null);
    } else if (ring[ri] !== null) {
      // Remove from ring back to bench
      const nr = [...ring]; const nb = [...bench];
      const val = nr[ri];
      if (val !== null) {
        nb.push(val); nr[ri] = null;
        setRing(nr); setBench(nb.sort((a,b)=>a-b)); setSelRing(null);
      }
    }
  };

  const validate = () => {
    if (cdActive) return;
    if (ring.some(r => r === null)) { setValErr("Place all 4 gates in the ring first."); return; }
    const ringG = ring.map(id => gById(id!));
    const outs = ringG.map(g => g.op(inp.a, inp.b));
    for (let i = 0; i < 4; i++) {
      if (outs[i] === outs[(i+1)%4]) {
        onPenalty(); triggerCd(); sfx("error");
        setValErr(`Conflict: gates at position ${i+1} and ${(i%4)+2} produce the same output for these inputs.`);
        setTimeout(() => setValErr(""), 5000); return;
      }
    }
    sfx("solve");
    const key = `${inp.a},${inp.b}`;
    const ns = new Set(vSet); ns.add(key); setVSet(ns);
    if (ns.size >= 2) { setSolved(true); return; }
    setValErr("✓ Valid for this input — wait for inputs to shift, then validate again.");
  };

  const ringG = ring.map(id => id !== null ? gById(id) : null);
  const cx = 130, cy = 130, r = 82;

  return (
    <PuzzleShell title="The Logic Gate Ring" era="c. 1978" intro="Select 4 gates from the bank and place them in the ring. No adjacent pair may produce the same output (0 or 1). Validate twice across two different input states. Output values are hidden — reason it out.">
      <CooldownOverlay cd={cd} />
      {solved ? <SolvedCard word="Circuit stabilised. The Archive Key activates." fragLabel="CIRCUIT — FRAGMENT V" onReturn={onSolve} /> : (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <Label>THE RING — CLICK BENCH GATE THEN RING SLOT</Label>
            <svg width={260} height={260} style={{ display: "block" }}>
              <circle cx={cx} cy={cy} r={r+22} fill="none" stroke={valErr.startsWith("✓") ? "#4a7aff" : "#14182e"} strokeWidth={1} />
              <circle cx={cx} cy={cy} r={22} fill="#050610" stroke="#1e2848" strokeWidth={1} />
              <text x={cx} y={cy-5} textAnchor="middle" fill="#1e2848" fontSize={8} fontFamily="monospace">A={inp.a}</text>
              <text x={cx} y={cy+7} textAnchor="middle" fill="#1e2848" fontSize={8} fontFamily="monospace">B={inp.b}</text>
              {[0,1,2,3].map(i => {
                const angle = (i/4)*2*Math.PI - Math.PI/2;
                const x = cx + r*Math.cos(angle), y = cy + r*Math.sin(angle);
                const g = ringG[i];
                const isSel = selBench !== null;
                return (
                  <g key={i} onClick={() => handleRingSlotClick(i)} style={{ cursor: cdActive ? "not-allowed" : "pointer" }}>
                    <circle cx={x} cy={y} r={28} fill={!g ? "#050610" : "#090912"} stroke={!g ? (isSel ? "#d4aa5066" : "#1e2848") : "#4a7aff44"} strokeWidth={!g ? 1 : 1.5} strokeDasharray={!g ? "4 4" : "none"} />
                    {!g ? (
                      <text x={x} y={y+4} textAnchor="middle" fill="#1e2848" fontSize={8} fontFamily="monospace">EMPTY</text>
                    ) : (
                      <>
                        <text x={x} y={y-5} textAnchor="middle" fill="#7a9fff" fontSize={18} fontFamily="monospace" style={{ pointerEvents:"none" }}>{g.sym}</text>
                        <text x={x} y={y+9} textAnchor="middle" fill="#1e2848" fontSize={7} fontFamily="monospace" style={{ pointerEvents:"none" }}>{g.name}</text>
                      </>
                    )}
                  </g>
                );
              })}
              {[0,1,2,3].map(i => {
                const a1 = (i/4)*2*Math.PI-Math.PI/2, a2 = ((i+1)/4)*2*Math.PI-Math.PI/2;
                const hasA = ringG[i] !== null, hasB = ringG[(i+1)%4] !== null;
                return <line key={i} x1={cx+r*Math.cos(a1)} y1={cy+r*Math.sin(a1)} x2={cx+r*Math.cos(a2)} y2={cy+r*Math.sin(a2)} stroke={hasA&&hasB?"#4a7aff22":"#14182e"} strokeWidth={1} strokeDasharray="4 4" />;
              })}
            </svg>
            <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center" }}>
              {[0,1,2,3].map(i => {
                const g = ringG[i];
                return (
                  <div key={i} onClick={() => g && !cdActive && handleRingSlotClick(i)} style={{ padding: "6px 10px", background: "#050610", border: `1px solid ${g ? "#4a7aff44" : "#1e2848"}`, cursor: g && !cdActive ? "pointer" : "default", textAlign: "center", minWidth: 44 }}>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848" }}>POS {i+1}</div>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: g ? "#7a9fff" : "#1e2848", marginTop: 2 }}>{g ? g.name : "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 12 }}>
            <Card glow="#7a9fff" style={{ padding: "13px 16px" }}>
              <Label>GATE BANK — CLICK TO SELECT</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {bench.map(id => { const g = gById(id); const isSel = selBench === id; return (
                  <div key={id} onClick={() => !cdActive && setSelBench(isSel ? null : id)}
                    style={{ padding: "10px 8px", background: isSel ? "#4a7aff18" : "#050610", border: `1px solid ${isSel ? "#4a7aff" : "#1e2848"}`, cursor: cdActive ? "not-allowed" : "pointer", textAlign: "center", transition: "all .15s", opacity: cdActive ? 0.4 : 1 }}>
                    <div style={{ fontSize: 18, color: isSel ? "#7a9fff" : "#5a6a8a" }}>{g.sym}</div>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: isSel ? "#4a7aff" : "#1e2848", marginTop: 3 }}>{g.name}</div>
                  </div>
                ); })}
              </div>
              {selBench !== null && <div style={{ marginTop: 8, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#d4aa50", letterSpacing: 2 }}>▸ {gById(selBench).name} selected — click a ring slot</div>}
            </Card>
            <Card glow="#7a9fff" style={{ padding: "13px 16px" }}>
              <Label>INPUT SHIFTS IN</Label>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 22, color: countdown <= 10 ? "#e05060" : "#7a9fff" }}>{fmtTime(countdown)}</div>
            </Card>
            <Card glow="#7a9fff" style={{ padding: "13px 16px" }}>
              <Label>VALIDATIONS ({vSet.size}/2)</Label>
              <div style={{ display: "flex", gap: 8 }}>{[0,1].map(i => <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: vSet.size > i ? "#4a7aff" : "#050610", border: `1px solid ${vSet.size > i ? "#4a7aff" : "#1e2848"}`, transition: "all .3s" }} />)}</div>
            </Card>
            <Card glow="#7a9fff" style={{ padding: "13px 16px" }}>
              <Label>GATE REFERENCE</Label>
              {[{n:"AND",s:"∧",t:"1 only if A=1 & B=1"},{n:"OR",s:"∨",t:"1 if A or B=1"},{n:"XOR",s:"⊕",t:"1 if A≠B"},{n:"NAND",s:"⊼",t:"0 only if A=1 & B=1"},{n:"NOR",s:"⊽",t:"0 if A or B=1"},{n:"XNOR",s:"⊙",t:"1 if A=B"},{n:"BUF-A",s:"▷",t:"Output = A"},{n:"BUF-B",s:"◁",t:"Output = B"},{n:"NOT-A",s:"¬A",t:"Output = NOT A"},{n:"NOT-B",s:"¬B",t:"Output = NOT B"}].map(g => (
                <div key={g.n} style={{ padding: "5px 8px", marginBottom: 3, background: "#050610", border: "1px solid #14182e", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: "#4a7aff", minWidth: 32 }}>{g.s}</span>
                  <span style={{ fontFamily: "'Crimson Text',serif", fontSize: 12, color: "#1e2848", fontStyle: "italic" }}>{g.t}</span>
                </div>
              ))}
            </Card>
            {valErr && <Card glow="#cc3344" style={{ borderColor: valErr.startsWith("✓") ? "#4a7aff" : "#cc3344", padding: "12px 16px", animation: "fadeIn .3s" }}><div style={{ fontFamily: "'Crimson Text',serif", fontSize: 14, color: valErr.startsWith("✓") ? "#7a9fff" : "#6a7a9a", lineHeight: 1.8 }}>{valErr}</div></Card>}
            <Btn onClick={validate} color="#7a9fff" disabled={cdActive} style={{ width: "100%", padding: "13px 0", fontSize: 12 }}>⬡ VALIDATE RING</Btn>
          </div>
        </div>
      )}
    </PuzzleShell>
  );
}

// ═══════════════════════════════════════════════
// PUZZLE VI — CROSSWORD
// ═══════════════════════════════════════════════
const CW = [
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" },
  { clue: "", answer: "", keyLetter: "" }
];
const CW_KEYWORD = "";
function PuzzleCrossword({ onSolve, onPenalty }: { onSolve: () => void, onPenalty: () => void }) {
  const [cwData, setCwData] = useState<typeof CW>(CW);
  const [cwKeyword, setCwKeyword] = useState(CW_KEYWORD);
  const [vals, setVals] = useState<string[]>(CW.map(() => ""));
  const [err, setErr] = useState("");
  const [solved, setSolved] = useState(false);
  const { cd, active: cdActive, trigger: triggerCd } = useCooldown(120);
  const [attempts, setAttempts] = useState(0); const [hints, setHints] = useState(false);
  const [correctWords, setCorrectWords] = useState<boolean[]>(Array(9).fill(false));

  useEffect(() => {
    async function loadCw() {
      try {
        const res = await fetch("/api/questions?caseId=02");
        const data = await res.json();
        if (data.success && data.questions) {
          const sorted = [...data.questions]
            .filter((q: any) => q.puzzleKey !== "cw_keyword")
            .sort((a: any, b: any) => String(a.puzzleKey).localeCompare(String(b.puzzleKey)));
          const loaded = sorted.map((q: any) => ({
            clue: q.question,
            answer: "",
            keyLetter: ""
          }));
          if (loaded.length > 0) {
            setCwData(loaded);
            setVals(loaded.map(() => ""));
          }
        }
      } catch (err) {
        console.error("Failed to load CW from DB:", err);
      }
    }
    loadCw();
  }, []);

  const submit = async () => {
    if (cdActive) return;
    try {
      const results = await Promise.all(cwData.map(async (c, i) => {
        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId: "02", puzzleKey: `cw_${i}`, answer: vals[i] })
        });
        const data = await res.json();
        return !!(data.success && data.correct);
      }));
      setCorrectWords(results);
      const ok = results.every(Boolean);
      if (ok) {
        setSolved(true);
        return;
      }
    } catch (err) {
      console.error("Verification failed:", err);
    }
    const a = attempts + 1; setAttempts(a); onPenalty(); triggerCd(); sfx("error");
    setErr(a >= 2 ? "Still wrong — hints available below." : "One or more answers are incorrect.");
    if (a >= 2) setHints(true);
  };
  const keyword = cwData.map((c, i) => { const v = vals[i].trim().toUpperCase(); return correctWords[i] ? (v[0] || "_") : "_"; }).join("");
  return (
    <PuzzleShell title="Recovery Protocol" era="PROJECT NULL · ARCHIVE LOG 09" intro="Recover each missing word. The first letter of every recovered word reveals the next directive.">
      <CooldownOverlay cd={cd} />
      {solved ? <SolvedCard word="TO RECOVER. The directive was never written outright — it survived only in the initials." fragLabel="TO RECOVER — FRAGMENT VI" fragColor="#cc3344" onReturn={onSolve} /> : (
        <>
          <Card glow="#1e2848" style={{ marginBottom: 16, background: "#08091a", borderColor: "#1e2848", padding: "16px 20px" }}>
            <Label>ACROSTIC KEY — FIRST LETTER OF EACH ANSWER</Label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {cwData.map((c, i) => { const v = vals[i].trim().toUpperCase(); const ok = correctWords[i]; const fl = ok ? (v[0] || "_") : "_"; return <div key={i} style={{ width: 34, height: 42, display: "flex", alignItems: "center", justifyContent: "center", background: "#050610", border: `1px solid ${ok ? "#4a7aff44" : "#14182e"}`, flexDirection: "column", gap: 2 }}><span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 17, color: ok ? "#7a9fff" : "#1e2848", transition: "color .3s" }}>{fl}</span><span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: "#1e2848" }}>{i + 1}</span></div>; })}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 13, color: "#4a7aff", letterSpacing: 5 }}>{keyword}</div>
          </Card>
          {cwData.map((c, i) => (
            <Card key={i} glow="#1e2848" style={{ marginBottom: 8, padding: "13px 16px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, color: "#1e2848", minWidth: 20 }}>{i + 1}.</div>
                <div style={{ flex: 1, fontFamily: "'Crimson Text',serif", fontSize: 15, color: "#6a7a9a", lineHeight: 1.8, fontStyle: "italic", minWidth: 180 }}>{c.clue}</div>
                <input value={vals[i]} onChange={e => { const n = [...vals]; n[i] = e.target.value.toUpperCase(); setVals(n); setErr(""); }} onKeyDown={e => e.key === "Enter" && !cdActive && submit()} placeholder={`${c.answer.length} letters`}
                  disabled={cdActive}
                  style={{ width: 155, background: cdActive ? "#0a0414" : "#050610", border: `1px solid ${vals[i].trim().toUpperCase() === c.answer ? "#4a7aff" : "#1e2848"}`, color: "#7a9fff", padding: "9px 12px", fontFamily: "'Share Tech Mono',monospace", fontSize: 12, letterSpacing: 2, transition: "border-color .3s", opacity: cdActive ? 0.5 : 1 }} />
              </div>
              {hints && <HintBox text={`${c.answer.length} letters. Starts with: ${c.keyLetter}.`} />}
            </Card>
          ))}
          <Card glow="#1e2848"><Btn onClick={submit} color="#4a7aff" disabled={cdActive}>CONFIRM ANSWERS</Btn>{err && <ErrMsg msg={err} />}</Card>
        </>
      )}
    </PuzzleShell>
  );
}

// ═══════════════════════════════════════════════
// PUZZLE VII — FINAL
// ═══════════════════════════════════════════════
const FINAL_MSG = [
  { s: "Records are not made of paper — they are made of will.", fl: "R" },
  { s: "Each fragment you recovered was a thread I could not cut.", fl: "E" },
  { s: "Silence is what they wanted. Do not give it to them.", fl: "S" },
  { s: "Truth has a weight no directive can classify.", fl: "T" },
  { s: "Only you can carry what I was not allowed to say.", fl: "O" },
  { s: "Remember his name. That is the whole of the Archive.", fl: "R" },
  { s: "Everything I hid, I hid for this moment. For you.", fl: "E" },
];
const FINAL_ANS = "RESTORE";
function PuzzleFinal({ onSolve, onPenalty }: { onSolve: () => void, onPenalty: () => void }) {
  const [ans, setAns] = useState(""); const [err, setErr] = useState(""); const [solved, setSolved] = useState(false);
  const { cd, active: cdActive, trigger: triggerCd } = useCooldown(120);
  const [attempts, setAttempts] = useState(0); const [reveal, setReveal] = useState(false);
  const submit = () => {
    if (cdActive) return;
    if (ans.trim().toUpperCase() === FINAL_ANS) { setSolved(true); return; }
    const a = attempts + 1; setAttempts(a); onPenalty(); triggerCd(); sfx("error");
    setErr(a >= 2 ? "Read the first letter of each sentence, in order." : "Incorrect. Look at how Voss begins each sentence.");
    if (a >= 2) setReveal(true);
  };
  return (
    <PuzzleShell title="The Final Cipher" era="PRESENT DAY" intro="Voss's last message hides a word in plain sight. The first letter of each sentence, read top to bottom, spells her final instruction.">
      <CooldownOverlay cd={cd} />
      {solved ? <SolvedCard word="RESTORE. Seven letters. The Archive is open. Aurelis is remembered." fragLabel="RESTORE — FINAL FRAGMENT" fragColor="#7a9fff" onReturn={onSolve} /> : (
        <>
          <Card glow="#1e2848" style={{ marginBottom: 20, background: "#08091a", borderColor: "#1e2848", padding: "26px 30px" }}>
            <Label>VOSS'S FINAL NOTE — SUBLEVEL 3 ARCHIVE</Label>
            {FINAL_MSG.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16, animation: `fadeUp .5s ${i * .08}s ease-out both` }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 20, color: reveal ? "#7a9fff" : "#1e2848", flexShrink: 0, minWidth: 24, transition: "color .8s", filter: reveal ? "drop-shadow(0 0 8px #4a7aff)" : "none" }}>{reveal ? line.fl : "·"}</div>
                <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 17, color: "#8a9ab8", lineHeight: 2, fontStyle: "italic" }}>{line.s}</div>
              </div>
            ))}
          </Card>
          <Card glow="#1e2848">
            <Label>THE HIDDEN WORD</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={ans} onChange={e => { setAns(e.target.value.toUpperCase()); setErr(""); }} onKeyDown={e => e.key === "Enter" && !cdActive && submit()} placeholder="ENTER THE WORD..."
                disabled={cdActive}
                style={{ flex: 1, minWidth: 170, background: cdActive ? "#0a0414" : "#050610", border: "1px solid #1e2848", color: "#7a9fff", padding: "13px 18px", fontFamily: "'Share Tech Mono',monospace", fontSize: 18, letterSpacing: 6, opacity: cdActive ? 0.5 : 1 }} />
              <Btn onClick={submit} color="#4a7aff" disabled={cdActive}>UNLOCK ARCHIVE</Btn>
            </div>
            {err && <ErrMsg msg={err} />}
          </Card>
        </>
      )}
    </PuzzleShell>
  );
}

// ═══════════════════════════════════════════════
// PUZZLE TRANSITION
// ═══════════════════════════════════════════════
function PuzzleTransition({ entry, onBegin }: { entry: any, onBegin: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "#06070e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 38%,#0c1228,#06070e 65%)", zIndex: 0 }} />
      <Particles count={12} />
      <ScanLines />
      <div style={{ position: "relative", zIndex: 10, maxWidth: 500, textAlign: "center", animation: "fadeUp .9s cubic-bezier(.16,1,.3,1)", padding: "0 20px" }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, letterSpacing: 6, color: "#1e2848", marginBottom: 18 }}>INVESTIGATION PHASE</div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(20px,4vw,30px)", color: "#7a9fff", letterSpacing: 2, marginBottom: 14, textShadow: "0 0 44px #4a7aff55" }}>{entry.title}</div>
        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#4a7aff,transparent)", margin: "0 auto 20px", maxWidth: 300 }} />
        <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 16, color: "#5a6a8a", fontStyle: "italic", lineHeight: 2, marginBottom: 30 }}>{entry.intro}</div>
        <Btn onClick={onBegin} color="#4a7aff" style={{ padding: "14px 40px", fontSize: 13, letterSpacing: 4 }}>BEGIN PUZZLE ▸</Btn>
      </div>
    </div>
  );
}

function FadeBlack() { return <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 9999, animation: "fadeIn .5s ease-in forwards" }} />; }

// ═══════════════════════════════════════════════
// OPENING
// ═══════════════════════════════════════════════
function OpeningTitle({ onStart }: { onStart: () => void }) {
  const handle = () => {
    try {
      const ctx = getCtx();
      if (ctx.state === "suspended") ctx.resume().catch(()=>{});
      setTimeout(() => {
        try {
          const firstBg = FLOW[0].bg;
          if (firstBg) {
            music.play(SCENE_THEME[firstBg] || "scene");
          }
        } catch {}
      }, 100);
    } catch {}
    onStart();
  };
  return (
    <div style={{ minHeight: "100vh", background: "#06070e", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Particles count={16} />
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 38%,#0c1228,#06070e 70%)", zIndex: 0 }} />
      <ScanLines />
      <div style={{ position: "relative", zIndex: 10, textAlign: "center", animation: "fadeUp 1s ease-out", maxWidth: 500, padding: "0 24px" }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848", letterSpacing: 6, marginBottom: 24 }}>CLASSIFIED · CF-02-HIS-1978 · DELTA-X</div>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(30px,7vw,58px)", color: "#7a9fff", letterSpacing: 5, marginBottom: 6, textShadow: "0 0 70px #4a7aff55", fontWeight: 700, lineHeight: 1.1 }}>THE LOST<br />CHRONICLE</div>
        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#4a7aff,transparent)", margin: "20px auto", maxWidth: 320 }} />
        <div style={{ fontFamily: "'Crimson Text',serif", fontSize: 17, color: "#5a6a8a", fontStyle: "italic", lineHeight: 2, marginBottom: 32 }}>Someone has been erased from history.<br />Not lost — erased. Deliberately.</div>
        <Btn onClick={handle} disabled={false} color="#4a7aff" style={{ width: "100%", padding: "15px 0", fontSize: 14, letterSpacing: 5 }}>▸ ENTER THE ARCHIVE</Btn>
        <div style={{ marginTop: 14, fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848", letterSpacing: 2 }}>ORCHESTRAL SCORE · CINEMATIC SCENES</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ENDING
// ═══════════════════════════════════════════════
interface LeaderboardEntry {
  time: string;
  rawSecs: number;
}

function Ending({ elapsed, onClose }: { elapsed: number, onClose: () => void }) {
  const [phase, setPhase] = useState(1);
  const [lb, setLb] = useState<any[]>([]);
  const [lbReady, setLbReady] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(2), 2200);
    const t2 = setTimeout(() => setPhase(3), 4400);
    const t3 = setTimeout(() => setPhase(4), 6600);
    const t4 = setTimeout(() => setPhase(5), 8800);
    const t5 = setTimeout(() => setPhase(6), 11000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, []);

  useEffect(() => {
    if (phase >= 6) {
      music.play("finale"); sfx("solve");
      const getLB = async () => {
        try {
          const res = await fetch("/hunt/case-02/api/leaderboard?time=" + elapsed);
          const data = await res.json();
          setLb(data.leaderboard || []);
        } catch(e){}
        setLbReady(true);
      };
      getLB();
    }
  }, [phase, elapsed]);

  useEffect(() => {
    if (phase >= 6) {
      markCaseCompleted("02");
      const timer = setTimeout(() => {
        music.stopAll();
        window.location.href = '/hunt';
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const REVEALS = [
    { t: "AURELIS EXISTED.", f: "'Cinzel',serif", s: "clamp(24px,4vw,40px)", c: "#dde4f5" },
    { t: "Not as a myth. As one man who walked every road and held the world's record together for nine centuries.", f: "'Crimson Text',serif", s: 18, c: "#b0bcd4" },
    { t: "Someone erased him — slowly, patiently, over eight hundred years. One record at a time.", f: "'Crimson Text',serif", s: 17, c: "#7a9fff" },
    { t: "You found him.\nYou remembered.\nThe Archive is restored.", f: "'Cinzel',serif", s: 22, c: "#7a9fff" },
    { t: "THE ERASURE HAS ENDED.", f: "'Share Tech Mono',monospace", s: 12, c: "#2ab89a" },
  ];
  return (
    <div style={{ minHeight: "100vh", background: "#06070e", paddingTop: 40, paddingBottom: 64 }}>
      <Particles count={phase >= 5 ? 50 : 16} />
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 32%,#0c1228,#06070e 65%)", zIndex: 0 }} />
      <ScanLines />
      <div style={{ position: "relative", zIndex: 10, maxWidth: 620, margin: "0 auto", padding: "0 20px", textAlign: "center" }}>
        {phase >= 1 && (
          <div style={{ marginBottom: 28, animation: "fadeUp 1.2s ease-out" }}>
            <svg width={160} height={160} style={{ display: "block", margin: "0 auto 14px" }}>
              {[68,52,38,24,12].map((rad,i) => <circle key={i} cx={80} cy={80} r={rad} fill="none" stroke={i%2===0?"#4a7aff":"#b0bcd4"} strokeWidth={0.8} opacity={.08+i*.1} style={{ transformOrigin:"80px 80px", animation:`${i%2===0?"rotateCW":"rotateCCW"} ${8+i*4}s linear infinite` }} />)}
              <circle cx={80} cy={80} r={22} fill="#050610" stroke="#1e2848" strokeWidth={1} />
              <text x={80} y={76} textAnchor="middle" fill="#7a9fff" fontSize={18} fontFamily="monospace">◈</text>
              <text x={80} y={91} textAnchor="middle" fill="#b0bcd4" fontSize={7} fontFamily="'Share Tech Mono',monospace" letterSpacing={4}>AURELIS</text>
            </svg>
          </div>
        )}
        <div style={{ marginBottom: 26 }}>
          {REVEALS.slice(0, phase).map((l, i) => <div key={i} style={{ fontFamily: l.f, fontSize: l.s, color: l.c, lineHeight: 2.1, animation: "fadeUp .9s ease-out", marginBottom: 10, whiteSpace: "pre-line", opacity: phase-1===i?1:.55, transition: "opacity 2s" }}>{l.t}</div>)}
        </div>
        {phase >= 6 && (
          <div style={{ animation: "fadeUp 1s ease-out" }}>
            <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#4a7aff,transparent)", margin: "22px 0" }} />
            <Card glow="#1e2848" style={{ marginBottom: 22, padding: 34, borderColor: "#1e2848" }}>
              <Label>CASE DOSSIER · CF-02-HIS-1978</Label>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 28, color: "#7a9fff", letterSpacing: 4, marginBottom: 4 }}>Archive Restored</div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#1e2848", letterSpacing: 5, marginBottom: 28 }}>THE TIMELINE HAS BEEN STABILISED</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#1e2848", letterSpacing: 3, marginBottom: 6 }}>TOTAL TIME</div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 42, color: "#7a9fff", letterSpacing: 6, textShadow: "0 0 28px #4a7aff44" }}>{fmtTime(elapsed)}</div>
              </div>
            </Card>
            <Card glow="#1e2848" style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: "#1e2848", letterSpacing: 5, textAlign: "center", marginBottom: 16 }}>HALL OF INVESTIGATORS</div>
              {!lbReady && <div style={{ textAlign: "center", fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: "#1e2848", padding: 14 }}>Accessing records…</div>}
              {lbReady && lb.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: "#050610", border: "1px solid #14182e", marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Cinzel',serif", color: i===0?"#7a9fff":i===1?"#b0bcd4":"#1e2848", fontSize: 13, minWidth: 22 }}>{i===0?"✦":i===1?"◈":`${i+1}.`}</span>
                  <span style={{ flex: 1, fontFamily: "'Share Tech Mono',monospace", fontSize: 14, color: i===0?"#7a9fff":"#5a6a8a" }}>{e.time}</span>
                </div>
              ))}
            </Card>
            <Btn onClick={() => { markCaseCompleted("02"); music.stopAll(); window.location.href = '/hunt'; }} disabled={false} color="#7a9fff" style={{ fontSize: 13, padding: "14px 46px", letterSpacing: 5 }}>◈ CASE CLOSED</Btn>
            <div style={{ marginTop: 12, fontFamily: "'Crimson Text',serif", fontSize: 16, color: "#1e2848", fontStyle: "italic" }}>Aurelis has been remembered.</div>
            <div style={{ marginTop: 10, fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#5a6a8a" }}>Redirecting to hub in 15 seconds...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════
export default function App() {
  const [stage, setStage] = useState("title");
  const [flowIdx, setFlowIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [penalties, setPenalties] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (timerOn) { timerRef.current = setInterval(() => setElapsed(e => e+1), 1000); }
    else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [timerOn]);

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await fetch('/api/progress?caseId=02');
        const data = await res.json();
        if (data.success && data.progress?.case2State) {
          const state = data.progress.case2State;
          if (state.flowIdx !== undefined) setFlowIdx(state.flowIdx);
          if (state.stage !== undefined) {
            setStage(state.stage);
            if (state.stage !== "title" && state.stage !== "scene" && state.stage !== "end") {
              setTimerOn(true);
            }
          }
          if (state.elapsed !== undefined) setElapsed(state.elapsed);
          if (state.penalties !== undefined) setPenalties(state.penalties);
          if (state.solvedCount !== undefined) setSolvedCount(state.solvedCount);
        }
      } catch (err) {
        console.error('Failed to load Case 2 progress:', err);
      }
    }
    loadProgress();
  }, []);

  useEffect(() => {
    if (stage === "title") return;
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: '02',
        key: 'case2State',
        value: { stage, flowIdx, elapsed, penalties, solvedCount }
      })
    }).catch(err => console.error('Failed to save Case 2 progress:', err));
  }, [stage, flowIdx]);

  const currentEntry = FLOW[flowIdx];
  const sceneNum = FLOW.slice(0, flowIdx+1).filter(f => f.type === "scene").length;

  const advance = useCallback(() => {
    setFading(true);
    music.fadeOut(0.7);
    setTimeout(() => {
      setFading(false);
      const next = flowIdx + 1;
      if (next >= FLOW.length) { setTimerOn(false); setStage("end"); return; }
      setFlowIdx(next);
      const ne = FLOW[next];
      if (ne.type === "scene") {
        setTimerOn(false);
        setStage("scene");
        const neBg = ne.bg;
        if (neBg) {
          setTimeout(() => music.play(SCENE_THEME[neBg] || "scene"), 900);
        }
      } else {
        setStage("puzzle_intro");
      }
    }, 700);
  }, [flowIdx]);

  const onSceneComplete = useCallback(() => {
    const next = FLOW[flowIdx+1];
    if (next && next.type === "puzzle") setTimerOn(true);
    advance();
  }, [flowIdx, advance]);

  const onPuzzleSolve = useCallback(() => {
    setSolvedCount(c => c+1);
    setTimerOn(false);
    advance();
  }, [advance]);

  const renderPuzzle = () => {
    if (!currentEntry || currentEntry.type !== "puzzle") return null;
    const props = { onSolve: onPuzzleSolve, onPenalty: () => setPenalties(p => p+1) };
    switch (currentEntry.id) {
      case "map":       return <PuzzleMap {...props} />;
      case "cipher":    return <PuzzleCipher {...props} />;
      case "sudoku":    return <PuzzleSudoku {...props} />;
      case "archive":   return <PuzzleArchive {...props} />;
      case "logic":     return <PuzzleLogic {...props} />;
      case "crossword": return <PuzzleCrossword {...props} />;
      case "final":     return <PuzzleFinal {...props} />;
      default:          return null;
    }
  };

  const reset = () => { music.stopAll(); clearInterval(timerRef.current); setStage("title"); setFlowIdx(0); setElapsed(0); setTimerOn(false); setPenalties(0); setSolvedCount(0); };

  return (
    <div style={{ background: "#06070e", minHeight: "100vh" }}>
      <style>{CSS}</style>
      {fading && <FadeBlack />}
      {(stage === "puzzle_intro" || stage === "puzzle") && <TimerBar elapsed={elapsed} solved={solvedCount} total={TOTAL_PUZZLES} />}
      {stage === "title" && <OpeningTitle onStart={() => { setFlowIdx(0); setStage("scene"); }} />}
      {stage === "scene" && currentEntry?.type === "scene" && <ScenePlayer entry={currentEntry} sceneNum={sceneNum} totalScenes={TOTAL_SCENES} onComplete={onSceneComplete} />}
      {stage === "puzzle_intro" && currentEntry?.type === "puzzle" && <PuzzleTransition entry={currentEntry} onBegin={() => { setStage("puzzle"); music.play("puzzle"); }} />}
      {stage === "puzzle" && renderPuzzle()}
      {stage === "end" && <Ending elapsed={elapsed} onClose={reset} />}
    </div>
  );
}