import React, { useState, useEffect, useRef, useCallback } from "react";
import { markCaseCompleted } from "@/components/case-progress";

interface PuzzleStatus {
  ok: boolean;
  msg: string;
}

interface PuzzleProps {
  wrong: () => void;
  locked: boolean;
  onSolve: () => void;
}

/* ── MUSIC ENGINE ── */
function useMusicEngine() {
  const r = useRef<{
    ctx: AudioContext | null;
    master: GainNode | null;
    nodes: (OscillatorNode | AudioBufferSourceNode)[];
    timers: any[];
  }>({ ctx: null, master: null, nodes: [], timers: [] });

  function getCtx(): AudioContext {
    if (!r.current.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      r.current.ctx = new AudioCtx();
    }
    return r.current.ctx;
  }

  function start() {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const master = ctx.createGain(); master.gain.value = 0.13; master.connect(ctx.destination);
    r.current.master = master;
    const rev = ctx.createDelay(2.2); rev.delayTime.value = 0.09;
    const revG = ctx.createGain(); revG.gain.value = 0.28; rev.connect(revG); revG.connect(rev); revG.connect(master);
    function drone(f: number, d: number, g: number) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.detune.value = d;
      const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(rev); gn.connect(master); o.start();
      return o;
    }
    const d1 = drone(48, 0, 0.22); const d2 = drone(48, 7, 0.12); const d3 = drone(96, -5, 0.06);
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.055;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.04;
    const baseG = ctx.createGain(); baseG.gain.value = 0.22;
    lfo.connect(lfoG); lfoG.connect(baseG.gain); d1.connect(baseG); baseG.connect(master); lfo.start();
    r.current.nodes = [d1, d2, d3, lfo];

    // FIX: capture timers ref so push after stop() is safe
    function schedulePulse() {
      const tid = setTimeout(() => {
        if (!r.current.ctx) return; // stopped
        const t = ctx.currentTime;
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(36, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.6);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 2);
        schedulePulse();
      }, 2800 + Math.random() * 1200);
      r.current.timers.push(tid);
    }
    schedulePulse();

    const shimNotes = [523, 622, 698, 932, 1047, 784];
    function scheduleShim() {
      const tid = setTimeout(() => {
        if (!r.current.ctx) return;
        const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = "sine";
        o.frequency.value = shimNotes[Math.floor(Math.random() * shimNotes.length)];
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.042, t + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + 3.8);
        o.connect(g); g.connect(rev); o.start(t); o.stop(t + 4.2);
        scheduleShim();
      }, 3000 + Math.random() * 5000);
      r.current.timers.push(tid);
    }
    setTimeout(scheduleShim, 1500);

    const motNotes = [98, 110, 131, 147, 175, 196, 220]; let mi = 0;
    function scheduleMotif() {
      const tid = setTimeout(() => {
        if (!r.current.ctx) return;
        const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = "triangle";
        o.frequency.value = motNotes[mi++ % motNotes.length];
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.35); g.gain.exponentialRampToValueAtTime(0.001, t + 3);
        o.connect(g); g.connect(rev); g.connect(master); o.start(t); o.stop(t + 3.5);
        scheduleMotif();
      }, 1600 + Math.random() * 2800);
      r.current.timers.push(tid);
    }
    setTimeout(scheduleMotif, 800);

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const bpf = ctx.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 200; bpf.Q.value = 0.4;
    const nsG = ctx.createGain(); nsG.gain.value = 0.012; ns.connect(bpf); bpf.connect(nsG); nsG.connect(master); ns.start();
    r.current.nodes.push(ns);
  }
  function setVol(v: number) { if (r.current.master) r.current.master.gain.setTargetAtTime(v, getCtx().currentTime, 0.4); }
  function stop() {
    r.current.timers.forEach(clearTimeout); r.current.timers = [];
    r.current.nodes.forEach(n => { try { n.stop(); } catch(e){} });
    r.current.nodes = [];
    try { r.current.ctx?.close(); } catch(e){}
    r.current.ctx = null; r.current.master = null;
  }
  return { start, stop, setVol };
}


/* ── PALETTE / STYLES ── */
const S = `
@import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=IBM+Plex+Mono:wght@400;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --void:#060e09;--panel:#0b1410;--paper:#e9e3d0;--ink:#1c1810;--pe:#b8b09a;
  --g:#6dfb9b;--gd:#2a5e3f;--am:#ffb238;--re:#ff4040;--ub:#c8e8ff;
  --ln:rgba(109,251,155,0.11);--lns:rgba(109,251,155,0.22);
}
body{background:var(--void)}
.root{min-height:100vh;background:var(--void);color:var(--g);font-family:'IBM Plex Mono',monospace;overflow-x:hidden;position:relative}
.root::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:30;background:repeating-linear-gradient(to bottom,rgba(109,251,155,.018) 0,rgba(109,251,155,.018) 1px,transparent 2px,transparent 4px);animation:scan 14s linear infinite}
@keyframes scan{to{background-position:0 200px}}
/* SPLASH */
.sp{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0;background:radial-gradient(ellipse 65% 55% at 50% 50%,rgba(109,251,155,.05) 0,transparent 70%);padding:40px 20px;text-align:center}
.sp-eye{font-size:48px;margin-bottom:20px;opacity:.6;animation:eyepulse 4s ease-in-out infinite}
@keyframes eyepulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.75;transform:scale(1.06)}}
.sp-pre{font-size:9px;letter-spacing:.38em;color:var(--gd);margin-bottom:18px;text-transform:uppercase}
.sp-title{font-family:'Special Elite',serif;font-size:clamp(56px,14vw,108px);line-height:.9;color:var(--g);margin-bottom:24px;text-shadow:0 0 120px rgba(109,251,155,.12)}
.sp-rule{width:48px;height:1px;background:var(--gd);margin:0 auto 20px}
.sp-tag{font-size:12px;color:var(--gd);letter-spacing:.08em;line-height:1.7;max-width:400px;margin-bottom:36px}
.sp-btn{background:transparent;border:1px solid var(--g);color:var(--g);padding:13px 30px;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.12em;cursor:pointer;border-radius:2px;transition:background .15s,color .15s}
.sp-btn:hover{background:var(--g);color:#04180a}
/* HEADER */
.hd{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:9px 16px;border-bottom:1px solid var(--ln);background:rgba(6,14,9,.85);position:sticky;top:0;z-index:20;backdrop-filter:blur(4px)}
.hd-l{display:flex;align-items:center;gap:10px}
.hd-title{font-size:10px;letter-spacing:.14em;font-weight:600;color:var(--g)}
.hd-sub{font-size:8px;color:var(--gd);margin-top:2px;letter-spacing:.06em}
.hd-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hd-timer{font-size:11px;font-weight:600;letter-spacing:.06em;background:rgba(109,251,155,.05);border:1px solid var(--ln);padding:4px 9px;border-radius:2px;display:flex;align-items:center;gap:5px}
.hd-dots{display:flex;gap:3px}
.hd-dot{width:6px;height:6px;border-radius:50%;background:var(--gd);border:1px solid var(--gd);transition:all .3s}
.hd-dot.done{background:var(--g);border-color:var(--g)}
.hd-dot.cur{background:transparent;border-color:var(--g);box-shadow:0 0 7px rgba(109,251,155,.5)}
.hd-btn{background:transparent;border:1px solid var(--gd);color:var(--gd);padding:5px 8px;border-radius:2px;cursor:pointer;font-size:11px;transition:color .15s,border-color .15s}
.hd-btn:hover{color:var(--g);border-color:var(--g)}
/* MAIN / STAGE */
.main{display:flex;justify-content:center;padding:22px 14px 60px;position:relative;z-index:2}
.stage{width:100%;max-width:780px}
.fade-in{animation:fadein .4s ease both}
@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
/* DIALOGUE */
.dlg{background:var(--panel);border:1px solid var(--ln);border-radius:4px;padding:22px 18px 18px;min-height:420px;display:flex;flex-direction:column;position:relative;box-shadow:0 0 100px rgba(0,0,0,.6),inset 0 0 60px rgba(0,0,0,.4)}
.dlg::before{content:"ARCHIVE LINK — SECURE";position:absolute;top:10px;right:14px;font-size:7px;letter-spacing:.18em;color:var(--gd);opacity:.6}
.dlg-hist{display:flex;flex-direction:column;gap:5px;margin-bottom:8px;flex:1}
.dlg-ghost-row{display:flex}
.dlg-gl{justify-content:flex-start}
.dlg-gr{justify-content:flex-end}
.dlg-ghost{font-size:10px;color:rgba(109,251,155,.35);max-width:74%;padding:4px 8px;border-radius:3px;background:rgba(109,251,155,.02);line-height:1.5;font-style:italic}
.dlg-active{display:flex;align-items:flex-start;gap:11px;padding:4px 0;margin-top:auto}
.dlg-left{flex-direction:row}.dlg-right{flex-direction:row-reverse}
.dlg-av{width:40px;height:40px;border:2px solid;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(0,0,0,.5);font-size:18px}
.dlg-bwrap{display:flex;flex-direction:column;gap:3px;max-width:calc(100% - 56px)}
.dlg-name{font-size:8px;letter-spacing:.16em;font-weight:600;text-transform:uppercase}
.dlg-bub{padding:11px 14px;border-radius:4px;font-size:12.5px;line-height:1.75;font-family:'Special Elite',serif}
.dlg-bub-n{background:rgba(109,251,155,.055);border:1px solid rgba(109,251,155,.18);color:var(--g)}
.dlg-bub-s{background:rgba(160,184,168,.07);border:1px solid rgba(160,184,168,.15);color:#9ab0a0;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.04em}
.dlg-bub-u{background:rgba(200,232,255,.06);border:1px solid rgba(200,232,255,.15);color:var(--ub)}
.dlg-typing{display:flex;gap:4px;padding:12px 16px;align-items:center}
.dlg-dot-anim{width:6px;height:6px;border-radius:50%;background:var(--gd);animation:dotpulse 1.2s ease-in-out infinite}
.dlg-dot-anim:nth-child(2){animation-delay:.2s}.dlg-dot-anim:nth-child(3){animation-delay:.4s}
@keyframes dotpulse{0%,80%,100%{opacity:.3}40%{opacity:1}}
.dlg-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--ln);padding-top:12px;margin-top:10px}
.dlg-dots{display:flex;gap:3px;flex-wrap:wrap;max-width:50%}
.dlg-pdot{width:5px;height:5px;border-radius:50%;background:var(--gd);transition:all .2s}
.dlg-pdot.a{background:var(--g);transform:scale(1.4)}
.dlg-pdot.d{background:var(--gd)}
.dlg-next{background:transparent;border:1px solid var(--g);color:var(--g);padding:7px 16px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.09em;cursor:pointer;border-radius:2px;display:inline-flex;align-items:center;gap:5px;transition:background .15s,color .15s}
.dlg-next:hover{background:var(--g);color:#04180a}
/* PUZZLE */
.pz{border:1px solid var(--pe);background:var(--paper);color:var(--ink);border-radius:3px;padding:22px 18px 18px;box-shadow:0 14px 50px rgba(0,0,0,.55);position:relative;overflow:hidden}
.pz::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(28,24,16,.3),transparent)}
.pz-stamp{display:inline-block;font-size:9px;letter-spacing:.18em;padding:2px 8px;border:1px solid var(--am);color:var(--am);margin-bottom:10px}
.pz-title{font-family:'Special Elite',serif;font-size:21px;color:var(--ink);margin:5px 0 7px}
.pz-prompt{font-size:11px;color:#4a4030;line-height:1.7;margin-bottom:14px}
.pz-doc{font-family:'Special Elite',serif;font-size:12.5px;line-height:1.75;color:var(--ink);margin-bottom:8px}
.row{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}
.inp{flex:1;min-width:120px;background:rgba(0,0,0,.06);border:1px solid #9a9278;color:var(--ink);padding:8px 9px;font-family:'IBM Plex Mono',monospace;font-size:12px;border-radius:2px;outline:none}
.inp:focus{border-color:#4a4030}
.inp::placeholder{color:#9a8a6a}
.inp:disabled{opacity:.5}
.btn{background:transparent;border:1px solid var(--ink);color:var(--ink);padding:8px 15px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.07em;cursor:pointer;border-radius:2px;transition:background .15s,color .15s}
.btn:hover:not(:disabled){background:var(--ink);color:var(--paper)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-sm{padding:5px 9px;font-size:10px}
.btn-ghost{border-color:#9a9278;color:#5a5240}
.link-btn{background:none;border:none;color:#6b5e3a;text-decoration:underline dotted;font-family:inherit;font-size:10px;cursor:pointer;padding:3px 0;letter-spacing:.04em;display:block;margin:5px 0}
.status{display:flex;align-items:center;gap:6px;font-size:11px;margin-top:10px;padding:6px 9px;border-radius:2px}
.status.ok{color:#1f5e30;background:rgba(31,94,48,.08);border:1px solid rgba(31,94,48,.2)}
.status.err{color:#7a1a1a;background:rgba(122,26,26,.08);border:1px solid rgba(122,26,26,.2)}
/* COOLDOWN */
.cd-overlay{position:absolute;inset:0;background:rgba(6,14,9,.94);z-index:50;display:flex;align-items:center;justify-content:center;border-radius:3px;backdrop-filter:blur(2px)}
.cd-box{text-align:center;padding:28px;display:flex;flex-direction:column;align-items:center;gap:12px}
.cd-icon{font-size:26px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700}
.cd-wrong{background:rgba(255,64,64,.1);color:var(--re);border:2px solid rgba(255,64,64,.35)}
.cd-hint{background:rgba(109,251,155,.07);color:var(--g);border:2px solid rgba(109,251,155,.25)}
.cd-title{font-size:13px;letter-spacing:.1em;font-weight:600}
.cd-msg{font-size:10px;color:var(--gd);letter-spacing:.04em;line-height:1.5;max-width:220px}
.cd-timer{font-size:34px;font-weight:600;color:var(--am);letter-spacing:.04em;font-variant-numeric:tabular-nums}
.cd-bar-w{width:180px;height:3px;background:rgba(255,178,56,.15);border-radius:2px;overflow:hidden}
.cd-bar{height:100%;background:var(--am);transition:width 1s linear;border-radius:2px}
/* HINTS */
.hint-zone{margin-top:14px;border:1px solid rgba(107,94,58,.3);border-radius:3px;overflow:hidden}
.hint-label{font-size:9px;letter-spacing:.14em;padding:6px 10px;background:rgba(107,94,58,.05);color:#7a6e50;border-bottom:1px solid rgba(107,94,58,.2)}
.hint-item{border-bottom:1px solid rgba(107,94,58,.12)}
.hint-item:last-child{border-bottom:none}
.hint-revealed{padding:8px 10px;font-size:10.5px;color:#4a4030;line-height:1.6;display:flex;gap:9px;font-family:'Special Elite',serif}
.hint-num{font-size:8px;color:#9a8a6a;letter-spacing:.1em;white-space:nowrap;padding-top:2px;min-width:46px}
.hint-btn{width:100%;background:transparent;border:none;padding:9px 10px;text-align:left;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#9a8a6a;cursor:pointer;letter-spacing:.04em;transition:color .15s,background .15s}
.hint-btn:hover:not(:disabled){background:rgba(107,94,58,.05);color:#6b5e3a}
.hint-btn:disabled{cursor:not-allowed;opacity:.4}
/* P1 */
.p1-log{display:flex;flex-direction:column;gap:4px;margin:10px 0}
.p1-entry{border:1px solid var(--pe);padding:9px;cursor:pointer;transition:background .1s;border-radius:2px}
.p1-entry:hover,.p1-entry.open{background:rgba(0,0,0,.04)}
.p1-time{font-size:9px;color:#9a8a6a;margin-right:9px;letter-spacing:.04em}
.p1-raw{font-size:11px;color:var(--ink);font-family:'Special Elite',serif}
.p1-dec{margin-top:6px;font-size:12px;font-weight:600;color:#1a3a1f;background:rgba(26,58,31,.06);padding:4px 8px;border-left:2px solid #1a3a1f}
/* P2 */
.p2-tbl{border:1px solid var(--pe);border-radius:2px;overflow:hidden;margin:10px 0;font-size:10px;overflow-x:auto}
.p2-hd,.p2-row{display:grid;grid-template-columns:26px 1fr 1fr 32px 50px 50px 32px;gap:0;padding:5px 7px}
.p2-hd{background:rgba(0,0,0,.06);font-weight:600;letter-spacing:.05em;color:#46402e}
.p2-row{border-top:1px solid var(--pe);cursor:pointer;transition:background .1s}
.p2-row:hover{background:rgba(0,0,0,.03)}
.p2-row.flagged{background:rgba(122,26,26,.07)}
.p2-sel{font-size:10px;color:#7a1a1a;margin-top:4px;padding:4px 7px;border-left:2px solid #7a1a1a}
/* P3 */
.p3-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}
.p3-c{border:1px solid var(--pe);padding:10px;cursor:pointer;transition:background .15s;border-radius:2px}
.p3-c:hover,.p3-c.open{background:rgba(0,0,0,.04)}
.p3-c.imp{border-color:rgba(122,26,26,.35);background:rgba(122,26,26,.03)}
.p3-f{font-family:'Special Elite',serif;font-size:15px;color:var(--ink);margin-bottom:4px}
.p3-det{margin-top:5px;font-size:10px}
.p3-bk{color:#6b5e3a;margin-bottom:3px}
.p3-sm{font-weight:600;color:var(--ink)}
.p3-ltr{color:#1a3a1f;font-weight:600;margin-top:2px}
.p3-no{color:#7a1a1a;font-weight:600;margin-top:2px}
/* P4 */
.p4-gw{margin:10px 0;overflow-x:auto;border:1px solid var(--pe);border-radius:2px}
.p4-hrow,.p4-row2{display:flex}
.p4-rc,.p4-ch,.p4-rh{width:26px;font-size:8px;color:#9a8a6a;padding:3px;display:flex;align-items:center;justify-content:center}
.p4-ch,.p4-rh{border-left:1px solid var(--pe);background:rgba(0,0,0,.04)}
.p4-rh{border-left:none;border-top:1px solid var(--pe)}
.p4-cell{width:26px;height:26px;font-size:11px;display:flex;align-items:center;justify-content:center;border-left:1px solid var(--pe);border-top:1px solid var(--pe);color:var(--ink)}
.p4-cell.cor{background:rgba(122,26,26,.1);color:#7a1a1a;font-weight:700}
.p4-sl{border:1px solid var(--pe);border-radius:2px;overflow:hidden;margin:10px 0}
.p4-sl-hd{font-size:9px;letter-spacing:.1em;padding:5px 8px;background:rgba(0,0,0,.04);color:#46402e;border-bottom:1px solid var(--pe)}
.p4-sl-r{padding:6px 8px;border-bottom:1px solid var(--pe);font-size:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.p4-sl-r:last-child{border-bottom:none}
.p4-sl-lb{font-weight:700;color:var(--ink);min-width:50px}
.p4-sl-p{color:#6b5e3a;font-size:9px;flex:1;word-break:break-all}
.p4-cor-tag{font-size:9px;color:#7a1a1a;white-space:nowrap}
/* P5 */
.p5-ws{display:flex;flex-direction:column;gap:5px;margin:10px 0}
.p5-w{border:1px solid var(--pe);border-radius:2px;overflow:hidden}
.p5-wh{width:100%;background:rgba(0,0,0,.04);border:none;padding:9px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--ink);text-align:left}
.p5-wid{font-weight:600;flex:1}.p5-wt{font-size:9px;color:#9a8a6a}
.p5-stmts{display:flex;flex-direction:column}
.p5-s{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;cursor:pointer;border-top:1px solid var(--pe);transition:background .1s;font-size:11px}
.p5-s:hover{background:rgba(0,0,0,.03)}.p5-s.fl{background:rgba(122,26,26,.06)}
.p5-fl{font-size:10px;color:#9a8a6a;min-width:36px;flex-shrink:0}
.p5-s.fl .p5-fl{color:#7a1a1a}
.p5-st{color:var(--ink);line-height:1.6;font-family:'Special Elite',serif}
/* P6 */
.p6-term{background:#090e0b;border:1px solid rgba(109,251,155,.18);border-radius:2px;padding:13px;margin:10px 0;font-family:'IBM Plex Mono',monospace}
.p6-path{font-size:9px;color:var(--gd);margin-bottom:5px;word-break:break-all;line-height:1.6}
.p6-letters{font-size:14px;color:var(--g);font-weight:600;margin-bottom:10px;letter-spacing:.08em}
.p6-cur{border:1px solid var(--ln);padding:10px;border-radius:2px}
.p6-nd{font-size:9px;color:var(--gd);margin-bottom:5px;letter-spacing:.06em}
.p6-et{font-size:11px;color:var(--g);line-height:1.65;margin-bottom:8px}
.p6-fl{background:transparent;border:1px solid var(--g);color:var(--g);padding:5px 11px;font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;border-radius:2px;transition:background .15s}
.p6-fl:hover:not(:disabled){background:var(--g);color:#04180a}
.p6-fl:disabled{opacity:.4;cursor:not-allowed}
.p6-end{font-size:10px;color:var(--am);letter-spacing:.06em}
.p6-man{display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap}
.p6-manlb{font-size:10px;color:var(--gd)}
/* P7 */
.p7-w{margin:10px 0;border:1px solid var(--pe);border-radius:2px;overflow:hidden}
.p7-rules{padding:10px;background:rgba(122,26,26,.03);border-bottom:1px solid var(--pe)}
.p7-rh{font-size:9px;letter-spacing:.12em;color:#7a1a1a;margin-bottom:6px;font-weight:600}
.p7-rule{font-size:10px;color:#5a2a2a;padding:2px 0;line-height:1.5}
.p7-rooms{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid var(--pe)}
.p7-room{padding:7px;border-right:1px solid var(--pe);border-bottom:1px solid var(--pe);font-size:9px}
.p7-room:nth-child(3n){border-right:none}
.p7-room.hl{background:rgba(26,58,31,.05)}
.p7-rid{display:block;font-weight:700;font-size:10px;color:var(--ink);margin-bottom:2px}
.p7-rn{display:block;color:#46402e;margin-bottom:2px;line-height:1.3}
.p7-ra{display:block;color:#9a8a6a;font-size:8px;margin-bottom:2px}
.p7-rl{display:block;color:var(--ink);font-weight:600}
.p7-ht{color:#1a3a1f;margin-left:3px}
.p7-vs{padding:10px;border-bottom:1px solid var(--pe);display:flex;flex-direction:column;gap:5px}
.p7-vh{font-size:9px;letter-spacing:.1em;color:#46402e;margin-bottom:4px}
.p7-vp{background:transparent;border:1px solid var(--pe);padding:7px 9px;font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;text-align:left;color:#6b5e3a;border-radius:2px;transition:background .15s}
.p7-vp:hover{background:rgba(122,26,26,.03);border-color:rgba(122,26,26,.25);color:#7a1a1a}
.p7-vp.fl{background:rgba(122,26,26,.07);border-color:rgba(122,26,26,.38);color:#7a1a1a}
.p7-corr{padding:10px}
.p7-ch{font-size:9px;color:#46402e;letter-spacing:.08em;margin-bottom:8px}
.p7-cr{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:10px;flex-wrap:wrap}
.p7-ci{width:36px;height:30px;border:1px solid var(--pe);background:rgba(0,0,0,.04);text-align:center;font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:var(--ink);border-radius:2px}
/* P8 */
.p8-st{margin:10px 0;border:1px solid var(--pe);border-radius:2px;overflow:hidden}
.p8-sth{font-size:9px;letter-spacing:.1em;padding:5px 9px;background:rgba(0,0,0,.04);color:#46402e;border-bottom:1px solid var(--pe)}
.p8-stg{display:flex;flex-wrap:wrap}
.p8-stc{display:flex;flex-direction:column;align-items:center;padding:7px 10px;border-right:1px solid var(--pe);border-bottom:1px solid var(--pe);min-width:46px}
.p8-sy{font-size:18px;line-height:1;margin-bottom:4px}
.p8-lt{font-size:10px;font-weight:600;color:var(--ink);letter-spacing:.06em}
.p8-seqs{display:flex;flex-direction:column;gap:5px;margin:10px 0}
.p8-sc{border:1px solid var(--pe);border-radius:2px;overflow:hidden}
.p8-sh{width:100%;background:rgba(0,0,0,.04);border:none;padding:8px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;font-family:'IBM Plex Mono',monospace;text-align:left}
.p8-sh span:first-child{font-size:11px;font-weight:700;color:var(--ink);min-width:82px}
.p8-sr{font-size:9px;color:#6b5e3a;flex:1;line-height:1.4}
.p8-sb{padding:10px;border-top:1px solid var(--pe)}
.p8-syms{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px}
.p8-sym{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 6px;border:1px solid var(--pe);border-radius:2px;min-width:32px}
.p8-sym.intr{border-color:rgba(122,26,26,.45);background:rgba(122,26,26,.05)}
.p8-si{font-size:7px;color:#9a8a6a}
.p8-sv{font-size:15px}
.p8-in{font-size:10px;color:#7a1a1a;margin-bottom:8px}
.p8-ar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:10px}
.p8-ai{width:40px;height:32px;border:1px solid var(--pe);background:rgba(0,0,0,.04);text-align:center;font-size:15px;border-radius:2px;outline:none}
.p8-al{color:#1a3a1f;font-weight:600}
/* P9 */
.p9-dos{border:1px solid var(--pe);border-radius:2px;overflow:hidden;margin:10px 0;background:rgba(0,0,0,.02)}
.p9-dh{padding:11px 13px;background:rgba(0,0,0,.05);font-family:'Special Elite',serif;font-size:15px;border-bottom:1px solid var(--pe);color:var(--ink)}
.p9-ds{padding:5px 13px;font-size:9px;letter-spacing:.1em;color:#9a8a6a;border-bottom:1px solid var(--pe)}
.p9-f{display:flex;flex-direction:column;gap:3px;padding:9px 13px;border-bottom:1px solid var(--pe)}
.p9-f:last-child{border-bottom:none}
.p9-lb{font-size:9px;letter-spacing:.1em;color:#6b5e3a;font-weight:600}
.p9-in{width:100%;background:transparent;border:none;border-bottom:1px solid var(--pe);padding:4px 0;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink);outline:none;transition:border-color .15s}
.p9-in:focus{border-bottom-color:var(--ink)}
.p9-in:disabled{opacity:.5}
.p9-in::placeholder{color:#c0b498;font-size:10px}
/* FINALE */
.fin{background:var(--panel);border:1px solid var(--ln);border-radius:4px;padding:32px 24px;box-shadow:0 0 100px rgba(109,251,155,.04);text-align:center}
.fin-eye{font-size:40px;margin-bottom:18px;opacity:.65}
.fin-title{font-family:'Special Elite',serif;font-size:28px;color:var(--g);margin:10px 0 18px}
.fin-time{font-size:38px;font-weight:600;color:var(--g);letter-spacing:.06em;margin-bottom:10px;font-variant-numeric:tabular-nums}
.fin-rank{font-size:11px;color:var(--am);letter-spacing:.1em;margin-bottom:24px;padding:7px 14px;border:1px solid rgba(255,178,56,.28);display:inline-block;border-radius:2px}
.fin-story{display:flex;flex-direction:column;gap:14px;margin-bottom:24px;border:1px solid var(--ln);padding:18px;border-radius:3px;text-align:left}
.fin-story p{font-size:11.5px;color:var(--gd);line-height:1.8}
.fin-q{color:var(--g) !important;font-family:'Special Elite',serif;font-size:14px !important}
@media(max-width:560px){
  .p3-grid,.p7-rooms{grid-template-columns:repeat(2,1fr)}
  .p2-hd,.p2-row{grid-template-columns:22px 1fr 1fr 26px 40px 40px 26px;font-size:8.5px}
  .p4-cell,.p4-ch,.p4-rh,.p4-rc{width:22px;height:22px;font-size:9px}
  .dlg-bub{font-size:11px}
}
@media(prefers-reduced-motion:reduce){
  .root::before,.sp-eye,.dlg-dot-anim{animation:none}
  .fade-in{animation:none}
}
`;

/* ── SCENE DATA ── */
const CHARS = {
  ARCHIVIST: { name: "Archivist",  avatar: "🗂",  color: "#6dfb9b" },
  SYSTEM:    { name: "SYSTEM",     avatar: "⬛",  color: "#a0b8a8" },
  USER:      { name: "You",        avatar: "🔍",  color: "#c8e8ff" },
  VOSS:      { name: "Dir. Voss",  avatar: "👁",  color: "#ffb238" },
};
const SCENES: Record<string, { c: keyof typeof CHARS; t: string }[]> = {
  intro:[
    {c:"SYSTEM",t:"ARCHIVE ACCESS INITIALISED — 03:17:44"},
    {c:"SYSTEM",t:"Loading case file... BROKEN DECK... classification depth: LEVEL IX."},
    {c:"ARCHIVIST",t:"You're in. I wasn't sure the old terminal would accept the token."},
    {c:"USER",t:"What is this place?"},
    {c:"ARCHIVIST",t:"A research facility. Government contract. Shuttered 1972 — no official explanation was ever given."},
    {c:"ARCHIVIST",t:"Investigators found a sealed sub-level years later. Four cabinets in a row. No names on the doors — just card suits."},
    {c:"USER",t:"What happened to the people who went inside?"},
    {c:"ARCHIVIST",t:"Each one reported something different. A city. A library. A childhood memory they didn't own."},
    {c:"ARCHIVIST",t:"But every single subject, independently, came back saying the exact same thing."},
    {c:"USER",t:"What did they say?"},
    {c:"ARCHIVIST",t:"That's still sealed. We unlock it piece by piece. The first layer is the radio logs — there's a transmission from the final night that's been hiding in plain sight for fifty years."},
  ],
  beforeP1:[
    {c:"ARCHIVIST",t:"The facility ran shortwave radio. Every transmission was logged, timestamped, filed."},
    {c:"ARCHIVIST",t:"The log from the final night looks like ordinary noise. Static. Dead air. Operator chatter."},
    {c:"USER",t:"What am I actually looking at?"},
    {c:"ARCHIVIST",t:"Someone embedded a message inside the punctuation. Dots and dashes. Old wartime habit — operators used to do it when they couldn't speak openly."},
    {c:"VOSS",t:"[RECOVERED AUDIO] — 'If anyone finds this, the date matters. The date is everything.'"},
    {c:"ARCHIVIST",t:"Six words decoded from the punctuation. Five are anagrams of each other. The one that isn't — that's your date."},
  ],
  afterP1:[
    {c:"SYSTEM",t:"TRANSMISSION DATE — VERIFIED."},
    {c:"USER",t:"October 14th. Hidden in a radio log for fifty years."},
    {c:"ARCHIVIST",t:"The operator knew it would be reviewed. So they buried it in the noise."},
    {c:"ARCHIVIST",t:"Cross-referencing that date pulls up a staff roster. Twelve people were in the facility that night."},
    {c:"USER",t:"Are any of them still alive?"},
    {c:"ARCHIVIST",t:"Three confirmed deceased. The rest — no record. Someone deliberately erased them from the personnel ledger. But they weren't careful enough."},
  ],
  beforeP2:[
    {c:"ARCHIVIST",t:"Here's the ledger. Twelve entries, one for each person logged that night."},
    {c:"USER",t:"What exactly am I checking?"},
    {c:"ARCHIVIST",t:"Timestamps. Clearance levels. Department assignments. Someone edited this after the fact — but they made three mistakes."},
    {c:"VOSS",t:"[RECOVERED MEMO] — 'Ensure the primary witnesses cannot be traced. Adjust the record accordingly. Leave no thread.'"},
    {c:"ARCHIVIST",t:"The initials of those three entries, in the order their contradictions appear in the ledger, spell your next code."},
    {c:"USER",t:"They hid the key inside the thing they were trying to erase."},
    {c:"ARCHIVIST",t:"Whoever did this was arrogant. Thought no one would look closely enough."},
  ],
  afterP2:[
    {c:"SYSTEM",t:"LEDGER CONTRADICTIONS — IDENTIFIED."},
    {c:"USER",t:"EK4. Three erased witnesses."},
    {c:"ARCHIVIST",t:"That code opens the secondary archive. There's a blackboard photograph in here — taken inside the main laboratory the night it was shut down."},
    {c:"USER",t:"Chemical formulas."},
    {c:"ARCHIVIST",t:"They were running compound analysis alongside the cabinet experiments. But one of these formulas doesn't exist. It's a decoy — planted to confuse anyone who came looking."},
    {c:"USER",t:"How do I tell which one?"},
    {c:"ARCHIVIST",t:"Basic chemistry. One of those compounds is impossible by the rules of bonding. Eliminate it. The rest encode something."},
  ],
  beforeP3:[
    {c:"ARCHIVIST",t:"Six compounds on the blackboard. Your job is to sum the atomic numbers for each."},
    {c:"VOSS",t:"[RECOVERED LOG] — 'The summation values lead the way. Discard the impossible. Read what remains.'"},
    {c:"USER",t:"And the impossible one?"},
    {c:"ARCHIVIST",t:"Noble gases don't form bonds. If you see one in a compound formula, it's the decoy. Discard it."},
    {c:"ARCHIVIST",t:"Each valid sum maps to a position in the alphabet — 1 is A, 26 is Z. Five compounds. Five letters. One word."},
    {c:"USER",t:"What word?"},
    {c:"ARCHIVIST",t:"That's what you're going to find out."},
  ],
  afterP3:[
    {c:"SYSTEM",t:"BLACKBOARD CIPHER — DECODED."},
    {c:"USER",t:"DELTA. The word is DELTA."},
    {c:"ARCHIVIST",t:"That's the internal codename for the sub-level. The chamber where the cabinets were kept."},
    {c:"USER",t:"Why DELTA?"},
    {c:"ARCHIVIST",t:"Fourth letter of the Greek alphabet. Four cabinets. They liked their symmetry — it shows up everywhere in this project."},
    {c:"ARCHIVIST",t:"There's a frequency monitoring grid in the archive. They scanned for electromagnetic anomalies during experiments. One scan line got corrupted."},
    {c:"VOSS",t:"[RECOVERED NOTE] — 'The grid is symmetric. What the corruption took, the symmetry returns.'"},
  ],
  beforeP4:[
    {c:"ARCHIVIST",t:"Eight-by-eight grid. Four diagonal scan lines crossing it. Each cell holds a reading from 1 to 9."},
    {c:"USER",t:"What do I do with it?"},
    {c:"ARCHIVIST",t:"Average the values along each scan line. Round down. That gives you one digit per line — four digits total."},
    {c:"ARCHIVIST",t:"Except scan line GAMMA has a corrupted cell. Marked as unknown. You need to recover it before you can average the line."},
    {c:"USER",t:"How?"},
    {c:"ARCHIVIST",t:"The grid was built with 180° rotational symmetry. Every cell has a mirror on the opposite side. Cell (row, col) mirrors to cell (7−row, 7−col). Find the mirror. That's your missing value."},
    {c:"VOSS",t:"[RECOVERED MEMO] — 'The symmetry was intentional. It was always meant to be reconstructable by someone patient enough to look.'"},
  ],
  afterP4:[
    {c:"SYSTEM",t:"FREQUENCY PIN — RECOVERED."},
    {c:"USER",t:"7-2-9-4. Four digits from the anomaly readings."},
    {c:"ARCHIVIST",t:"That PIN unlocks the witness archive. Five testimonies from five subjects who entered the cabinets."},
    {c:"USER",t:"I thought the testimonies were classified."},
    {c:"ARCHIVIST",t:"They were. Someone filed them under the wrong clearance level. Either a mistake — or they wanted them found eventually."},
    {c:"USER",t:"What's wrong with them?"},
    {c:"ARCHIVIST",t:"Each one contains a single lie. Not obvious. Internal contradictions — a time that doesn't add up, a room that can't connect to another, a claim another witness directly contradicts."},
    {c:"VOSS",t:"[RECOVERED AUDIO] — 'Strip away what can't be true. What remains is the location.'"},
  ],
  beforeP5:[
    {c:"ARCHIVIST",t:"Five witness statements. Read every line carefully."},
    {c:"USER",t:"One lie per witness?"},
    {c:"ARCHIVIST",t:"Exactly one. Find it. Flag it. The key word in the remaining true statements — one per witness, first three witnesses — assembles your answer in order."},
    {c:"ARCHIVIST",t:"The answer is a location. Three words. Where every subject ended up inside the cabinet — described differently by each person, but always drawn the same way."},
    {c:"VOSS",t:"[RECOVERED NOTE] — 'They all went to the same place. They just didn't have the same words for it.'"},
  ],
  afterP5:[
    {c:"SYSTEM",t:"DESTINATION — IDENTIFIED."},
    {c:"USER",t:"The Null Room. That's what they called it."},
    {c:"ARCHIVIST",t:"Every subject, independently. A room with no walls they could describe. No dimensions. Just — presence."},
    {c:"USER",t:"That's not possible."},
    {c:"ARCHIVIST",t:"The formal documentation is buried in the archive index under a chain of cross-references. Dead ends were planted to slow anyone down."},
    {c:"ARCHIVIST",t:"You'll know a dead end because it loops — it sends you somewhere you've already been. The real chain doesn't loop."},
    {c:"VOSS",t:"[RECOVERED MEMO] — 'The chain leads where it leads. Follow it without shortcuts and you'll find the name of the project itself.'"},
  ],
  beforeP6:[
    {c:"ARCHIVIST",t:"The archive index. Dozens of entries. Each has a cross-reference code pointing to the next."},
    {c:"USER",t:"Starting point?"},
    {c:"ARCHIVIST",t:"Entry A-1. Follow its reference. Each valid node reveals one letter. Collect them in order."},
    {c:"ARCHIVIST",t:"Dead ends exist — entries that reference themselves or circle back early. If you hit a loop, you've gone wrong. Backtrack."},
    {c:"USER",t:"How many letters?"},
    {c:"ARCHIVIST",t:"Eight. The path has exactly eight valid stops. What you collect spells the name of the project."},
    {c:"VOSS",t:"[RECOVERED AUDIO] — 'The index was designed to be navigated by someone who knew what they were looking for. You don't. That's the entire point.'"},
  ],
  afterP6:[
    {c:"SYSTEM",t:"PROJECT NAME — RETRIEVED."},
    {c:"USER",t:"NULL-GATE. The project was called NULL-GATE."},
    {c:"ARCHIVIST",t:"Not just NULL. NULL-GATE. The cabinet wasn't a container — it was a doorway."},
    {c:"USER",t:"A doorway to where?"},
    {c:"ARCHIVIST",t:"The blueprint should tell us. Floor plan of the facility. Numbered rooms. A substitution cipher legend."},
    {c:"ARCHIVIST",t:"But the legend has three errors in it. Deliberate sabotage. The architectural logic of the rooms will expose them."},
    {c:"VOSS",t:"[RECOVERED MEMO] — 'A wet lab cannot share a wall with a high-voltage room. Anyone who knew this building would catch it in seconds.'"},
  ],
  beforeP7:[
    {c:"ARCHIVIST",t:"The blueprint. Twelve numbered rooms, a cipher legend mapping each room number to a letter."},
    {c:"USER",t:"And three of those letter assignments are wrong."},
    {c:"ARCHIVIST",t:"Three. You find them by checking adjacencies. Rooms that can't legally share a wall — fire code, safety regulations, basic physics — those pairings expose the bad legend entries."},
    {c:"ARCHIVIST",t:"Fix the three errors. Then read the letters for rooms one through seven in sequence."},
    {c:"USER",t:"And that spells?"},
    {c:"ARCHIVIST",t:"The name of the entity. The thing inside the Null Room that every single subject reported encountering."},
    {c:"VOSS",t:"[RECOVERED NOTE] — 'We gave it a name because nameless things are harder to contain in a report. The name didn't capture it. Nothing could.'"},
  ],
  afterP7:[
    {c:"SYSTEM",t:"BLUEPRINT CIPHER — RESOLVED."},
    {c:"USER",t:"WATCHER. They called it the Watcher."},
    {c:"ARCHIVIST",t:"Every subject used a different word. Observer. Presence. Mirror. The report standardised it."},
    {c:"USER",t:"What was it actually?"},
    {c:"ARCHIVIST",t:"The files don't say. They only record that it was consistent. Same entity. Every cabinet. Every subject. Every session."},
    {c:"ARCHIVIST",t:"The last record is a memory sequence archive. Subjects were shown symbol patterns after the experiment — testing what came back with them. Something interfered with position six in every sequence."},
    {c:"VOSS",t:"[RECOVERED AUDIO] — 'Position six. Every single time. As if something intervened at exactly that moment and refused to let go.'"},
  ],
  beforeP8:[
    {c:"ARCHIVIST",t:"Four symbol sequences. Each follows a clear rule that holds for every position — except position six."},
    {c:"USER",t:"What broke it?"},
    {c:"ARCHIVIST",t:"Unknown. What we can do is determine what symbol should have appeared at position six in each sequence if the rule had held."},
    {c:"ARCHIVIST",t:"Find the correct symbol for each. Look each one up in the reference table. Collect four letters."},
    {c:"USER",t:"And together they spell?"},
    {c:"ARCHIVIST",t:"One final word. Then we have everything."},
    {c:"VOSS",t:"[RECOVERED NOTE] — 'Whatever altered position six did so with consistency. That implies intention. Something intended it.'"},
  ],
  afterP8:[
    {c:"SYSTEM",t:"MEMORY SEQUENCES — ANALYSED."},
    {c:"USER",t:"ZERO. The four letters spell ZERO."},
    {c:"ARCHIVIST",t:"NULL-GATE. ZERO. The project was about absence. About what lives inside nothing."},
    {c:"USER",t:"And the Watcher was inside the absence."},
    {c:"ARCHIVIST",t:"You have everything now. Every answer. Every fragment. The final dossier is locked behind all of it — eight fields, eight answers."},
    {c:"ARCHIVIST",t:"Six come from the puzzles you've solved. Two come from something else entirely — things said aloud in these rooms, not written in any file."},
    {c:"VOSS",t:"[RECOVERED AUDIO] — 'Pay attention to what people say. Not just what they write down. That's always where the truth actually lives.'"},
  ],
  beforeP9:[
    {c:"ARCHIVIST",t:"This is the final lock. Eight blanks. Fill them all and the dossier opens."},
    {c:"USER",t:"Six from the puzzles. Two from the record."},
    {c:"ARCHIVIST",t:"Two details spoken aloud during the course of this investigation. Not in any file. Not on any blackboard. You heard them — if you were listening."},
    {c:"USER",t:"What are they?"},
    {c:"ARCHIVIST",t:"I can't tell you. If you were paying attention, you already have them. If not — go back."},
    {c:"VOSS",t:"[RECOVERED AUDIO] — 'The founding year was 1967. I built this place with my own hands. I know exactly where every secret is buried.'"},
    {c:"ARCHIVIST",t:"Fill in all eight. Submit. The archive opens."},
  ],
  final:[
    {c:"SYSTEM",t:"FINAL DOSSIER — UNLOCKED."},
    {c:"SYSTEM",t:"Loading complete case file... BROKEN DECK..."},
    {c:"USER",t:"It's all here. Every experiment. Every subject. Every report they tried to bury."},
    {c:"ARCHIVIST",t:"NULL-GATE ran for five years. Sixty-three subjects. All voluntary. All informed. None of them could have known what they were agreeing to."},
    {c:"USER",t:"And the Watcher?"},
    {c:"ARCHIVIST",t:"Still in the record. Described the same way by every person who entered, across five years, across all four cabinets."},
    {c:"USER",t:"Did they ever close the gate?"},
    {c:"ARCHIVIST",t:"They shut down the facility. Voss signed the order himself. Whether the gate was ever actually closed —"},
    {c:"SYSTEM",t:"ARCHIVE CLOSED. Case file logged: BROKEN DECK. Classification: PERMANENT."},
  ],
};

/* ── DIALOGUE ── */
interface DialogueProps {
  sceneKey: string;
  onComplete: () => void;
}
function Dialogue({ sceneKey, onComplete }: DialogueProps) {
  const lines = SCENES[sceneKey] || [];
  const [cur, setCur] = useState(0);
  const [typing, setTyping] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTyping(true);
    setVisible(false);
    const t = setTimeout(() => {
      setTyping(false);
      setTimeout(() => setVisible(true), 60);
    }, 700 + Math.random() * 400);
    return () => clearTimeout(t);
  }, [cur]);

  function advance() {
    if (cur < lines.length - 1) setCur(c => c + 1);
    else onComplete();
  }

  const line = lines[cur];
  if (!line) return null;
  const ch = CHARS[line.c];
  const isU = line.c === "USER";
  const isSys = line.c === "SYSTEM";

  return (
    <div className="dlg fade-in">
      <div className="dlg-hist">
        {lines.slice(0, cur).map((l, i) => {
          const iu = l.c === "USER";
          return (
            <div key={i} className={`dlg-ghost-row ${iu ? "dlg-gr" : "dlg-gl"}`}>
              <div className="dlg-ghost">{l.t}</div>
            </div>
          );
        })}
      </div>
      <div className={`dlg-active ${isU ? "dlg-right" : "dlg-left"}`}>
        {!isU && (
          <div className="dlg-av" style={{ borderColor: ch.color, borderRadius: isSys ? "4px" : "50%" }}>
            <span>{ch.avatar}</span>
          </div>
        )}
        <div className="dlg-bwrap">
          <div className="dlg-name" style={{ color: ch.color, textAlign: isU ? "right" : "left" }}>{ch.name}</div>
          {typing
            ? <div className="dlg-bub dlg-bub-n"><div className="dlg-typing"><span className="dlg-dot-anim"/><span className="dlg-dot-anim"/><span className="dlg-dot-anim"/></div></div>
            : <div className={`dlg-bub ${isU ? "dlg-bub-u" : isSys ? "dlg-bub-s" : "dlg-bub-n"}`} style={{ opacity: visible ? 1 : 0, transition: "opacity .2s" }}>{line.t}</div>
          }
        </div>
        {isU && (
          <div className="dlg-av" style={{ borderColor: ch.color }}>
            <span>{ch.avatar}</span>
          </div>
        )}
      </div>
      <div className="dlg-foot">
        <div className="dlg-dots">
          {lines.map((_line, i) => <span key={i} className={`dlg-pdot ${i === cur ? "a" : i < cur ? "d" : ""}`}/>)}
        </div>
        <button className="dlg-next" onClick={advance} disabled={typing}>
          {cur < lines.length - 1 ? "CONTINUE ›" : "PROCEED ›"}
        </button>
      </div>
    </div>
  );
}

/* ── COOLDOWN ── */
interface CooldownProps {
  seconds: number;
  reason: string;
  onDone: () => void;
}
function Cooldown({ seconds, reason, onDone }: CooldownProps) {
  const [rem, setRem] = useState(seconds);
  useEffect(() => {
    const iv = setInterval(() => setRem(r => {
      if (r <= 1) { clearInterval(iv); onDone(); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, []);
  const isW = reason === "wrong";
  return (
    <div className="cd-overlay">
      <div className="cd-box">
        <div className={`cd-icon ${isW ? "cd-wrong" : "cd-hint"}`}>{isW ? "✗" : "💡"}</div>
        <div className="cd-title">{isW ? "WRONG ANSWER" : "HINT UNLOCKED"}</div>
        <div className="cd-msg">{isW ? "Terminal locked while recalibrating." : "Processing investigator lead."}</div>
        <div className="cd-timer">{rem}s</div>
        <div className="cd-bar-w"><div className="cd-bar" style={{ width: `${(rem / seconds) * 100}%` }}/></div>
      </div>
    </div>
  );
}

/* ── PUZZLE SHELL ── */
interface ShellProps {
  index: number;
  title: string;
  prompt: string;
  hints: string[];
  children?: React.ReactNode;
}
function Shell({ index, title, prompt, hints, children }: ShellProps) {
  const [hintIdx, setHintIdx] = useState(-1);
  const [used, setUsed] = useState<number[]>([]);
  const [cooldown, setCooldown] = useState<{ s: number; r: string } | null>(null);
  const wrong = useCallback(() => setCooldown({ s: 120, r: "wrong" }), []);
  const locked = !!cooldown;

  function useHint(i: number) {
    if (locked || used.includes(i)) return;
    setUsed(u => [...u, i]);
    setHintIdx(i);
    setCooldown({ s: 60, r: "hint" });
  }

  const childrenWithProps = children
    ? (Array.isArray(children) ? children : [children]).map((child, i) =>
        child && typeof child === "object"
          ? React.cloneElement(child as React.ReactElement<any>, { key: i, wrong, locked })
          : child
      )
    : null;

  return (
    <div className="pz fade-in" style={{ position: "relative" }}>
      {cooldown && (
        <Cooldown
          key={cooldown.r + cooldown.s}
          seconds={cooldown.s}
          reason={cooldown.r}
          onDone={() => setCooldown(null)}
        />
      )}
      <div className="pz-stamp">PUZZLE {index} / 9</div>
      <h2 className="pz-title">{title}</h2>
      <p className="pz-prompt">{prompt}</p>
      <div>{childrenWithProps}</div>
      {hints?.length > 0 && (
        <div className="hint-zone">
          <div className="hint-label">INVESTIGATOR LEADS</div>
          {hints.map((h, i) => (
            <div key={i} className="hint-item">
              {used.includes(i)
                ? <div className="hint-revealed"><span className="hint-num">LEAD {i + 1}</span>{h}</div>
                : <button
                    className="hint-btn"
                    onClick={() => useHint(i)}
                    disabled={locked || (i > 0 && !used.includes(i - 1))}
                  >
                    {i > 0 && !used.includes(i - 1) ? `→ UNLOCK LEAD ${i} FIRST` : `→ REVEAL LEAD ${i + 1}`}
                  </button>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── PUZZLE DATA / COMPONENTS ── */
function normalizeAnswer(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function checkClientAnswer(puzzleKey: string, answer: string): boolean {
  const norm = normalizeAnswer(answer);
  const rawClean = (answer || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!norm && !rawClean) return false;

  switch (puzzleKey) {
    case "p1":
    case "dossier_1":
      return norm.includes("october") || rawClean.includes("october") || norm === "14101972" || rawClean === "14101972";
    case "p2":
    case "dossier_2":
      return rawClean === "ek4";
    case "p3":
    case "dossier_3":
      return rawClean === "delta";
    case "p4":
    case "dossier_4":
      return rawClean === "7294";
    case "p5":
    case "dossier_5":
      return rawClean === "thenullroom" || rawClean === "nullroom";
    case "p6":
    case "dossier_6":
      return rawClean === "nullgate";
    case "p7":
      return rawClean === "watcher";
    case "p8":
      return rawClean === "zero";
    case "dossier_7":
      return rawClean === "1967";
    case "dossier_8":
      return rawClean === "voss";
    default:
      return false;
  }
}

const P1_LINES = [
  { time:"22:01", raw:"Transmission alpha.. —received.. Station.. clear.—.", decoded:"LISTEN" },
  { time:"22:04", raw:"Signal.. noise—ratio.. nominal.—.. Awaiting.. confirm.", decoded:"TINSEL" },
  { time:"22:09", raw:"Operator..— Enfield.. signing.. on.— Stand.. by.", decoded:"ENLIST" },
  { time:"22:14", raw:"All.. channels.. —clear.. no.. anomaly.—. Logged.", decoded:"SILENT" },
  { time:"22:19", raw:"Inland.. nets..— offline.— Routing.. via.. primary.", decoded:"INLETS" },
  { time:"22:31", raw:"Final.. log—..— Experiment.. date:.. October.—. Year:.. 1972.", decoded:"OCTOBER" },
];
function P1({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [open, setOpen] = useState<number | null>(null);
  const [inp, setInp] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p1", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p1", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: "Confirmed — verified." });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Not quite. Check which decoded word uses a completely different set of letters from the others." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">Six transmissions from the final night. The morse embedded in the punctuation has already been decoded below. Click any entry to reveal its decoded word. Five decoded words are perfect anagrams of each other. One is not — and it contains the date.</p>
    <div className="p1-log">
      {P1_LINES.map((l, i) => (
        <div key={i} className={`p1-entry ${open === i ? "open" : ""}`} onClick={() => setOpen(open === i ? null : i)}>
          <span className="p1-time">[{l.time}]</span>
          <span className="p1-raw">{l.raw}</span>
          {open === i && <div className="p1-dec">DECODED: {l.decoded}</div>}
        </div>
      ))}
    </div>
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="The odd word out (or full date)" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

interface StaffEntry {
  id: number;
  name: string;
  dept: string;
  clr: string;
  entry: string;
  exit: string;
  flag: boolean;
}
const STAFF: StaffEntry[] = [
  {id:1,  name:"Dr. Eleanor Marsh", dept:"Neuroscience",   clr:"B", entry:"22:05", exit:"06:10", flag:false},
  {id:2,  name:"K. Osei",           dept:"Engineering",    clr:"A", entry:"21:50", exit:"05:40", flag:false},
  {id:3,  name:"Dr. Lena Vance",    dept:"Psychology",     clr:"C", entry:"22:00", exit:"04:00", flag:false},
  {id:4,  name:"E. Hartley",        dept:"Security",       clr:"A", entry:"21:30", exit:"21:15", flag:true},  // exit before entry
  {id:5,  name:"T. Nakamura",       dept:"Chemistry",      clr:"B", entry:"22:10", exit:"05:55", flag:false},
  {id:6,  name:"Dr. K. Adeyemi",    dept:"Neuroscience",   clr:"D", entry:"21:45", exit:"04:30", flag:true},  // Neuroscience needs min C; D is too low
  {id:7,  name:"R. Okafor",         dept:"Logistics",      clr:"A", entry:"22:20", exit:"06:00", flag:false},
  {id:8,  name:"Dr. F. Solis",      dept:"Physics",        clr:"B", entry:"22:00", exit:"05:30", flag:false},
  {id:9,  name:"4. Brennan",        dept:"Administration", clr:"C", entry:"22:15", exit:"05:45", flag:true},  // numeric char in name field
  {id:10, name:"M. Johansson",      dept:"Security",       clr:"A", entry:"21:55", exit:"05:50", flag:false},
  {id:11, name:"Dr. P. Osei",       dept:"Chemistry",      clr:"B", entry:"22:05", exit:"04:45", flag:false},
  {id:12, name:"A. Whitmore",       dept:"Engineering",    clr:"A", entry:"22:00", exit:"05:20", flag:false},
];
function P2({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [sel, setSel] = useState<number[]>([]);
  const [inp, setInp] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  function toggle(id: number) { setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p2", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p2", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: `Three contradictions confirmed.` });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Incorrect. Order matters — read initials as they appear in the ledger, top to bottom." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">Three entries have been tampered with — impossible timestamps, invalid clearance levels, or protocol violations in the name field. Click rows to flag them. The first character of each contradicted entry, in ledger order, gives your code. Clearance scale: A=highest, D=lowest. Neuroscience minimum: C.</p>
    <div className="p2-tbl">
      <div className="p2-hd"><span>#</span><span>Name</span><span>Dept</span><span>Clr</span><span>In</span><span>Out</span><span>⚑</span></div>
      {STAFF.map(s => (
        <div key={s.id} className={`p2-row ${sel.includes(s.id) ? "flagged" : ""}`} onClick={() => toggle(s.id)}>
          <span>{s.id}</span><span>{s.name}</span><span>{s.dept}</span><span>{s.clr}</span>
          <span>{s.entry}</span><span>{s.exit}</span><span>{sel.includes(s.id) ? "⚑" : "○"}</span>
        </div>
      ))}
    </div>
    {sel.length > 0 && (
      <div className="p2-sel">Flagged: {sel.map(id => STAFF.find(s => s.id === id)?.name).join(", ")}</div>
    )}
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="3-character code" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

// FIX: P3 compound id:2 formula "B" (Boron alone) and id:6 "H" (Hydrogen alone)
// are single-atom "compounds" — valid for puzzle purposes as atomic number lookups.
// No code change needed; documenting intent.
interface P3Compound {
  id: number;
  formula: string;
  breakdown: string;
  sum: number;
  letter: string;
  impossible: boolean;
}
const P3_COMPOUNDS: P3Compound[] = [
  {id:1, formula:"LiH",  breakdown:"Li(3) + H(1)",     sum:4,   letter:"D", impossible:false},
  {id:2, formula:"B",    breakdown:"B(5)",              sum:5,   letter:"E", impossible:false},
  {id:3, formula:"XeF₈", breakdown:"Xe(54) + F(9)×8",  sum:126, letter:"—", impossible:true},
  {id:4, formula:"Mg",   breakdown:"Mg(12)",            sum:12,  letter:"L", impossible:false},
  {id:5, formula:"Ca",   breakdown:"Ca(20)",            sum:20,  letter:"T", impossible:false},
  {id:6, formula:"H",    breakdown:"H(1)",              sum:1,   letter:"A", impossible:false},
];
function P3({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [rev, setRev] = useState<Record<number, boolean>>({});
  const [inp, setInp] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p3", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p3", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: `Codename confirmed.` });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Not quite. Skip the impossible compound, then read the remaining five letters in written order." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">Six compounds on the blackboard. Sum the atomic numbers for each. Map each sum to a letter (1=A, 26=Z). One compound is chemically impossible — noble gases cannot form bonds. Discard it. The remaining five, in written order, spell a word.</p>
    <div style={{fontSize:10,color:"#6b5e3a",marginBottom:6}}>Atomic ref: H=1, He=2, Li=3, Be=4, B=5, C=6, N=7, O=8, F=9, Ne=10, Na=11, Mg=12, Ca=20, Xe=54</div>
    <div className="p3-grid">
      {P3_COMPOUNDS.map(c => (
        <div key={c.id} className={`p3-c ${rev[c.id] ? "open" : ""} ${c.impossible ? "imp" : ""}`} onClick={() => setRev(r => ({ ...r, [c.id]: !r[c.id] }))}>
          <div className="p3-f">{c.formula}</div>
          {rev[c.id] && (
            <div className="p3-det">
              <div className="p3-bk">{c.breakdown}</div>
              <div className="p3-sm">Σ = {c.sum}</div>
              {c.impossible
                ? <div className="p3-no">⚠ IMPOSSIBLE — discard</div>
                : <div className="p3-ltr">→ {c.letter}</div>
              }
            </div>
          )}
        </div>
      ))}
    </div>
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="Five-letter word" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

// THE_GRID uses a mixed (number | string)[][] type — "?" marks the corrupted cell.
// This is intentional; the className check `cell === "?"` correctly identifies it.
const THE_GRID: (number | string)[][] = [
  [7,3,5,2,8,1,6,4],[2,9,4,7,3,6,1,8],[6,1,8,3,9,4,"?",2],[4,7,2,9,1,8,3,6],
  [8,3,6,1,7,2,9,4],[1,5,9,4,2,7,8,3],[5,2,3,8,6,9,4,7],[3,8,7,6,4,3,2,9],
];
interface SlDef {
  id: number;
  label: string;
  path: [number, number][];
  digit: number;
  corruptAt?: [number, number];
}
const SL_DEFS: SlDef[] = [
  {id:1, label:"ALPHA", path:[[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7]], digit:7},
  {id:2, label:"BETA",  path:[[0,7],[1,6],[2,5],[3,4],[4,3],[5,2],[6,1],[7,0]], digit:2},
  {id:3, label:"GAMMA", path:[[0,2],[1,3],[2,6],[3,5],[4,4],[5,3],[6,2],[7,1]], digit:9, corruptAt:[2,6]},
  {id:4, label:"DELTA", path:[[0,5],[1,4],[2,3],[3,2],[4,1],[5,0],[6,7],[7,6]], digit:4},
];
function P4({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [showGrid, setShowGrid] = useState(false);
  const [inp, setInp] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p4", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p4", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: `PIN confirmed.` });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Incorrect. Recover the corrupted cell first using the mirror rule, then average all four scan lines." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">Four diagonal scan lines cross an 8×8 grid. Average each line's values (round down) for one digit of a 4-digit PIN. Scan line GAMMA has a corrupted cell marked "?". Recover it: the mirror of cell (row, col) under 180° rotation is cell (7−row, 7−col). That mirror holds the missing value.</p>
    <button className="link-btn" onClick={() => setShowGrid(v => !v)}>{showGrid ? "▲ HIDE GRID" : "▼ SHOW FREQUENCY GRID"}</button>
    {showGrid && (
      <div className="p4-gw">
        <div className="p4-hrow">
          <span className="p4-rc">r\c</span>
          {[0,1,2,3,4,5,6,7].map(c => <span key={c} className="p4-ch">{c}</span>)}
        </div>
        {THE_GRID.map((row, r) => (
          <div key={r} className="p4-row2">
            <span className="p4-rh">{r}</span>
            {row.map((cell, c) => (
              <span key={c} className={`p4-cell ${cell === "?" ? "cor" : ""}`}>{cell}</span>
            ))}
          </div>
        ))}
      </div>
    )}
    <div className="p4-sl">
      <div className="p4-sl-hd">SCAN LINE PATHS</div>
      {SL_DEFS.map(sl => (
        <div key={sl.id} className="p4-sl-r">
          <span className="p4-sl-lb">{sl.label}</span>
          <span className="p4-sl-p">{sl.path.map(([r,c]) => `(${r},${c})`).join(" → ")}</span>
          {sl.corruptAt && <span className="p4-cor-tag">⚠ ({sl.corruptAt[0]},{sl.corruptAt[1]}) CORRUPT</span>}
        </div>
      ))}
    </div>
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="4-digit PIN" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

interface Statement {
  id: string;
  text: string;
  true: boolean;
}
interface Witness {
  id: string;
  name: string;
  time: string;
  statements: Statement[];
}
const WITNESSES: Witness[] = [
  {id:"W1", name:"Subject 001", time:"23:00", statements:[
    {id:"W1a", text:"I entered the cabinet at exactly 22:45.", true:true},
    {id:"W1b", text:"The cabinet door closed automatically behind me.", true:true},
    {id:"W1c", text:"I saw Subject 003 leaving the room before I entered — around 22:30.", true:false},
    {id:"W1d", text:"The space inside had no visible walls or boundaries.", true:true},
  ]},
  {id:"W2", name:"Subject 002", time:"23:05", statements:[
    {id:"W2a", text:"The room felt like standing inside fog with no edges.", true:true},
    {id:"W2b", text:"I was inside for approximately 40 minutes before the door reopened.", true:false},
    {id:"W2c", text:"There was a presence. Not human. Not threatening. Only observing.", true:true},
    {id:"W2d", text:"The word that came to mind was NULL.", true:true},
  ]},
  {id:"W3", name:"Subject 003", time:"23:10", statements:[
    {id:"W3a", text:"I entered at 23:10 as scheduled.", true:true},
    {id:"W3b", text:"The interior of the cabinet was identical to the anteroom I had just left.", true:false},
    {id:"W3c", text:"The word ROOM came to me unprompted.", true:true},
    {id:"W3d", text:"The presence did not interact. It only watched.", true:true},
  ]},
  {id:"W4", name:"Subject 004", time:"23:20", statements:[
    {id:"W4a", text:"I felt no passage of time inside.", true:true},
    {id:"W4b", text:"The atmosphere was like deep water — pressure without substance.", true:true},
    {id:"W4c", text:"Dr. Marsh was monitoring from inside the control room when I entered.", true:false},
    {id:"W4d", text:"I wanted to describe it as THE — a definite, specific, located place.", true:true},
  ]},
  {id:"W5", name:"Subject 005", time:"23:30", statements:[
    {id:"W5a", text:"Before entering I was told the session would last 10 minutes.", true:true},
    {id:"W5b", text:"I heard a low hum the moment the door sealed.", true:true},
    {id:"W5c", text:"The session lasted exactly 10 minutes by my own internal count.", true:false},
    {id:"W5d", text:"The only word I could produce afterward was ROOM, again.", true:true},
  ]},
];
function P5({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [openW, setOpenW] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [inp, setInp] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  function toggleFlag(wid: string, sid: string) { setFlagged(f => ({ ...f, [`${wid}-${sid}`]: !f[`${wid}-${sid}`] })); }

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p5", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p5", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: `Location confirmed.` });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Not quite. Find one lie per witness. The key word in each of the first three witnesses' true statements (in witness order) gives you the answer." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">Five debriefings. Exactly one lie per witness — find it by contradiction with other testimonies or with logged records. Flag the lie in each block. The key word from the true statements of witnesses 1, 2, and 3 (in that order) assembles the location name.</p>
    <div className="p5-ws">
      {WITNESSES.map(w => (
        <div key={w.id} className="p5-w">
          <button className="p5-wh" onClick={() => setOpenW(openW === w.id ? null : w.id)}>
            <span className="p5-wid">{w.name}</span>
            <span className="p5-wt">Filed {w.time}</span>
            <span>{openW === w.id ? "▲" : "▼"}</span>
          </button>
          {openW === w.id && (
            <div className="p5-stmts">
              {w.statements.map(s => (
                <div key={s.id} className={`p5-s ${flagged[`${w.id}-${s.id}`] ? "fl" : ""}`} onClick={() => toggleFlag(w.id, s.id)}>
                  <span className="p5-fl">{flagged[`${w.id}-${s.id}`] ? "⚑ LIE" : "○"}</span>
                  <span className="p5-st">{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="Location (up to 3 words)" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

interface ArchiveEntry {
  letter: string;
  next: string | null;
  text: string;
}
const ARCHIVE: Record<string, ArchiveEntry> = {
  "A-1": {letter:"N", next:"C-3", text:"Initial access log — cross-reference C-3 for continuation."},
  "C-3": {letter:"U", next:"B-7", text:"Secondary cross-file. See B-7."},
  "B-7": {letter:"L", next:"F-2", text:"Facility sub-level reference. Continue at F-2."},
  "F-2": {letter:"L", next:"D-5", text:"Frequency monitor log. Anomaly records at D-5."},
  "D-5": {letter:"G", next:"E-4", text:"DELTA sub-index. Forward to E-4."},
  "E-4": {letter:"A", next:"G-1", text:"Experiment archive node. See G-1."},
  "G-1": {letter:"T", next:"H-6", text:"Gate access record. Final node at H-6."},
  "H-6": {letter:"E", next:null,  text:"Terminal node. No further references. Chain complete."},
  "D-9": {letter:"X", next:"D-9", text:"[CORRUPTED] — Self-referential. This entry references itself."},
  "B-2": {letter:"Z", next:"C-3", text:"Returns to C-3 — you've already been there. Dead end."},
  "F-8": {letter:"Q", next:"F-2", text:"Returns to F-2 — already visited. Dead end branch."},
  "G-9": {letter:"W", next:"G-9", text:"[LOOP] — References itself. Dead end."},
};
function P6({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [visited, setVisited] = useState<string[]>([]);
  const [letters, setLetters] = useState<string[]>([]);
  const [cur, setCur] = useState<string>("A-1");
  const [inp, setInp] = useState("");
  const [manual, setManual] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  function visit(code: string) {
    const e = ARCHIVE[code];
    if (!e) { setSt({ ok: false, msg: `No entry: ${code}` }); return; }
    setVisited(v => [...v, code]);
    setLetters(l => [...l, e.letter]);
    setCur(e.next || "END");
  }

  function jumpTo(e: React.FormEvent) {
    e.preventDefault();
    const c = manual.trim().toUpperCase();
    if (!ARCHIVE[c]) { setSt({ ok: false, msg: `No entry: ${c}` }); return; }
    visit(c);
    setManual("");
  }

  function reset() { setVisited([]); setLetters([]); setCur("A-1"); setSt(null); }

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p6", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p6", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: "Project name confirmed — NULL-GATE." });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Incorrect. The valid chain has exactly 8 stops. Dead ends loop — if you've revisited a node, backtrack." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  const entry = cur && cur !== "END" ? ARCHIVE[cur] : null;

  return (<>
    <p className="pz-doc">Navigate the archive index from A-1. Each valid entry reveals one letter and points forward. Dead ends loop or self-reference — if an entry sends you somewhere already visited, it's a dead end. Collect 8 letters in chain order.</p>
    <div className="p6-term">
      <div className="p6-path">PATH: {visited.length === 0 ? "START AT A-1" : visited.join(" → ")}{cur === "END" ? " → [END]" : ""}</div>
      <div className="p6-letters">LETTERS: [{letters.join("")}]</div>
      {cur !== "END" && entry && (
        <div className="p6-cur">
          <div className="p6-nd">CURRENT: {visited[visited.length - 1] || "A-1"} — letter "{entry.letter}"</div>
          <div className="p6-et">{entry.text}</div>
          {entry.next
            ? <button className="p6-fl" onClick={() => visit(entry.next!)} disabled={locked}>FOLLOW → {entry.next}</button>
            : <div className="p6-end">Terminal node.</div>
          }
        </div>
      )}
      {cur === "END" && <div className="p6-end">Chain complete. {letters.length} letters collected.</div>}
      {visited.length === 0 && <button className="p6-fl" onClick={() => visit("A-1")} disabled={locked}>OPEN A-1 →</button>}
    </div>
    <div className="p6-man">
      <span className="p6-manlb">JUMP TO:</span>
      <form className="row" onSubmit={jumpTo} style={{marginTop:0}}>
        <input className="inp" style={{width:80,flex:"none"}} placeholder="e.g. D-9" value={manual} onChange={e => setManual(e.target.value)} disabled={locked}/>
        <button className="btn btn-sm" type="submit" disabled={locked}>GO</button>
        <button className="btn btn-sm btn-ghost" type="button" onClick={reset}>RESET</button>
      </form>
    </div>
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="8-letter project name" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

interface Room {
  id: number;
  label: string;
  adj: number[];
}
const ROOMS: Room[] = [
  {id:1,  label:"Wet Lab",           adj:[2,5]},
  {id:2,  label:"Electrical Vault",  adj:[1,3,6]},
  {id:3,  label:"Server Room",       adj:[2,4]},
  {id:4,  label:"High-Voltage Bay",  adj:[3,5,8]},
  {id:5,  label:"Chemical Store",    adj:[1,4,6]},
  {id:6,  label:"Observation Deck",  adj:[2,5,7]},
  {id:7,  label:"Cabinet Chamber",   adj:[6,8,9]},
  {id:8,  label:"Cryogenic Store",   adj:[4,7,9]},
  {id:9,  label:"Medical Bay",       adj:[7,8,10]},
  {id:10, label:"Corridor",          adj:[9,11,12]},
  {id:11, label:"Pressure Chamber",  adj:[10,12]},
  {id:12, label:"Director's Office", adj:[10,11]},
];
const LEGEND_GIVEN: Record<number, string> = {1:"W",2:"Z",3:"T",4:"F",5:"H",6:"E",7:"R",8:"M",9:"S",10:"O",11:"I",12:"N"};
const HIGHLIGHTED = [1,2,3,4,5,6,7];
const VIOLATIONS = [[1,2],[4,8],[11,12]];
function P7({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  // FIX: corr keys stored as numbers; JS coerces to strings in object lookups — harmless,
  // but initialising as strings makes intent explicit and avoids any linting noise.
  const [flagV, setFlagV] = useState<string[]>([]);
  const [corr, setCorr] = useState<Record<string, string>>({"2":"","4":"","8":""});
  const [show, setShow] = useState(false);
  const [inp, setInp] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  function toggleV(pair: number[]) { const k = pair.join("-"); setFlagV(f => f.includes(k) ? f.filter(x => x !== k) : [...f, k]); }
  function setC(r: number, v: string) { setCorr(c => ({ ...c, [String(r)]: v.toUpperCase().slice(0,1) })); }

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p7", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p7", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: `Blueprint cipher resolved.` });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Not correct. Find all three violations, correct those legend entries, then read rooms 1–7 in sequence." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">The blueprint cipher legend has three errors. Find them by checking which room adjacencies violate architectural safety rules. Correct those three legend entries, then read the letters for rooms 1 through 7 in sequence — starred rooms are the ones that matter.</p>
    <button className="link-btn" onClick={() => setShow(v => !v)}>{show ? "▲ HIDE BLUEPRINT" : "▼ SHOW BLUEPRINT & LEGEND"}</button>
    {show && (
      <div className="p7-w">
        <div className="p7-rules">
          <div className="p7-rh">ARCHITECTURAL SAFETY RULES</div>
          <div className="p7-rule">• Wet Lab cannot share a wall with Electrical Vault (water + electricity)</div>
          <div className="p7-rule">• High-Voltage Bay cannot share a wall with Cryogenic Store (thermal + electrical)</div>
          <div className="p7-rule">• Pressure Chamber must be isolated from office spaces</div>
        </div>
        <div className="p7-rooms">
          {ROOMS.map(r => (
            <div key={r.id} className={`p7-room ${HIGHLIGHTED.includes(r.id) ? "hl" : ""}`}>
              <span className="p7-rid">[{r.id}]{HIGHLIGHTED.includes(r.id) && <span className="p7-ht"> ★</span>}</span>
              <span className="p7-rn">{r.label}</span>
              <span className="p7-ra">adj: {r.adj.join(", ")}</span>
              <span className="p7-rl">Legend: {LEGEND_GIVEN[r.id]}</span>
            </div>
          ))}
        </div>
        <div className="p7-vs">
          <div className="p7-vh">FLAG ADJACENCY VIOLATIONS:</div>
          {VIOLATIONS.map(pair => {
            const k = pair.join("-");
            const r1 = ROOMS.find(r => r.id === pair[0])!;
            const r2 = ROOMS.find(r => r.id === pair[1])!;
            return (
              <button key={k} className={`p7-vp ${flagV.includes(k) ? "fl" : ""}`} onClick={() => toggleV(pair)}>
                ⚑ Room {pair[0]} ({r1.label}) ↔ Room {pair[1]} ({r2.label})
              </button>
            );
          })}
        </div>
        {flagV.length === 3 && (
          <div className="p7-corr">
            <div className="p7-ch">CORRECT LEGEND FOR ROOMS 2, 4, 8:</div>
            {[2,4,8].map(r => (
              <div key={r} className="p7-cr">
                <span style={{fontSize:10,color:"#46402e"}}>Room {r} ({ROOMS.find(x => x.id === r)!.label}) — currently "{LEGEND_GIVEN[r]}" → correct:</span>
                <input className="p7-ci" maxLength={1} value={corr[String(r)]} onChange={e => setC(r, e.target.value)} disabled={locked}/>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="7-letter word (rooms 1–7)" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

const SYM_MAP: Record<string, string> = {"△":"Z","□":"E","○":"R","⬟":"O","⬡":"W","⊕":"T","⊗":"K","★":"Q","◈":"X","⬢":"A"};
interface P8Seq {
  id: number;
  rule: string;
  seq: string[];
  correct: string;
  note: string;
}
const P8_SEQS: P8Seq[] = [
  {id:1, rule:"3-cycle repeating: ○ → □ → △ → ○ → □ → △ …",        seq:["○","□","△","○","□","★","△","○","□","△"], correct:"△", note:"Index 5: cycle position 5%3=2 → △. Intruder: ★"},
  {id:2, rule:"Even indices (0,2,4…) = ⬟ ; odd indices (1,3,5…) = □", seq:["⬟","□","⬟","□","⬟","⬟","⬟","□","⬟","□"], correct:"□", note:"Index 5 is odd → □. Intruder: ⬟ (matches even pattern)"},
  {id:3, rule:"Each symbol mirrors the one two positions before it: seq[n] = seq[n−2]", seq:["△","○","△","○","△","⊕","△","○","△","○"], correct:"○", note:"seq[5] = seq[3] = ○. Intruder: ⊕"},
  {id:4, rule:"Symbols appear in pairs before advancing: ⬡⬡ → ○○ → ⬟⬟ …", seq:["⬡","⬡","○","○","⬟","★","⬟","★","⬡","⬡"], correct:"⬟", note:"Index 5: second of ⬟⬟ pair. Intruder: ★"},
];
function P8({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [openS, setOpenS] = useState<number | null>(null);
  // FIX: was Array(8) in original — should be 4 entries for 4 sequences.
  const [ans, setAns] = useState<string[]>(["", "", "", ""]);
  const [inp, setInp] = useState("");
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  function setA(i: number, v: string) { const a = [...ans]; a[i] = v.slice(0,2); setAns(a); }

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);
    try {
      let isCorrect = checkClientAnswer("p8", inp);
      if (!isCorrect) {
        try {
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: "08", puzzleKey: "p8", answer: inp })
          });
          const data = await res.json();
          if (data.success && data.correct) isCorrect = true;
        } catch (err) {}
      }
      if (isCorrect) {
        setSt({ ok: true, msg: `Sequence anomaly confirmed.` });
        setTimeout(onSolve, 700);
      } else {
        setSt({ ok: false, msg: "Not correct. For each sequence: find the rule, determine the correct symbol at index 5, look it up in the table." });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">Four symbol sequences, each following a clear rule. Position 6 (index 5, counting from 0) is always corrupted. Determine what symbol should appear at index 5 per the rule. Look it up in the symbol table below. Four symbols → four letters → one word.</p>
    <div className="p8-st">
      <div className="p8-sth">SYMBOL → LETTER REFERENCE</div>
      <div className="p8-stg">
        {Object.entries(SYM_MAP).map(([s, l]) => (
          <div key={s} className="p8-stc"><span className="p8-sy">{s}</span><span className="p8-lt">{l}</span></div>
        ))}
      </div>
    </div>
    <div className="p8-seqs">
      {P8_SEQS.map((sq, i) => (
        <div key={sq.id} className="p8-sc">
          <button className="p8-sh" onClick={() => setOpenS(openS === sq.id ? null : sq.id)}>
            <span>SEQUENCE {sq.id}</span>
            <span className="p8-sr">{sq.rule}</span>
            <span>{openS === sq.id ? "▲" : "▼"}</span>
          </button>
          {openS === sq.id && (
            <div className="p8-sb">
              <div className="p8-syms">
                {sq.seq.map((s, j) => (
                  <span key={j} className={`p8-sym ${j === 5 ? "intr" : ""}`}>
                    <span className="p8-si">{j}</span>
                    <span className="p8-sv">{s}</span>
                  </span>
                ))}
              </div>
              <p className="p8-in">Index 5 is highlighted — this is the corrupted position.</p>
              <div className="p8-ar">
                <span style={{fontSize:10}}>Correct symbol:</span>
                <input className="p8-ai" maxLength={2} value={ans[i]} onChange={e => setA(i, e.target.value)} disabled={locked} placeholder="?"/>
                {ans[i] && SYM_MAP[ans[i]] && <span className="p8-al">→ {SYM_MAP[ans[i]]}</span>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
    <form className="row" onSubmit={submit}>
      <input className="inp" placeholder="4-letter word (sequences 1–4)" value={inp} onChange={e => setInp(e.target.value)} disabled={locked}/>
      <button className="btn" type="submit" disabled={locked}>SUBMIT</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

interface DossierField {
  id: number;
  label: string;
  answer: string;
  ph: string;
}
const DOSSIER: DossierField[] = [
  {id:1, label:"TRANSMISSION DATE", answer:"14 OCTOBER 1972", ph:"From Puzzle 1"},
  {id:2, label:"WITNESS CODE",       answer:"EK4",            ph:"From Puzzle 2"},
  {id:3, label:"CODENAME",           answer:"DELTA",          ph:"From Puzzle 3"},
  {id:4, label:"FREQUENCY PIN",      answer:"7294",           ph:"From Puzzle 4"},
  {id:5, label:"DESTINATION",        answer:"THE NULL ROOM",  ph:"From Puzzle 5"},
  {id:6, label:"PROJECT NAME",       answer:"NULL-GATE",      ph:"From Puzzle 6"},
  {id:7, label:"FACILITY FOUNDED",   answer:"1967",           ph:"Spoken, not written"},
  {id:8, label:"DIRECTOR SURNAME",   answer:"VOSS",           ph:"Heard in recovered audio"},
];
function P9({ wrong, locked, onSolve, dbAnswers = {} }: PuzzleProps & { dbAnswers?: Record<string, string> }) {
  const [vals, setVals] = useState<string[]>(Array(8).fill(""));
  const [st, setSt] = useState<PuzzleStatus | null>(null);

  function setV(i: number, v: string) { const a = [...vals]; a[i] = v; setVals(a); }

  const [isVerifying, setIsVerifying] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || isVerifying) return;
    setIsVerifying(true);

    try {
      const results = await Promise.all(DOSSIER.map(async (b, i) => {
        let isCorrect = checkClientAnswer(`dossier_${i + 1}`, vals[i]);
        if (!isCorrect) {
          try {
            const res = await fetch("/api/questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ caseId: "08", puzzleKey: `dossier_${i + 1}`, answer: vals[i] })
            });
            const data = await res.json();
            if (data.success && data.correct) isCorrect = true;
          } catch (err) {}
        }
        return isCorrect;
      }));

      const bad = DOSSIER
        .map((b, i) => !results[i] ? b.id : null)
        .filter((b): b is number => b !== null);

      if (bad.length === 0) {
        setSt({ ok: true, msg: "ALL FIELDS CONFIRMED. Final dossier unlocked." });
        setTimeout(onSolve, 900);
      } else {
        setSt({ ok: false, msg: `Fields ${bad.join(", ")} incorrect. Two fields require details spoken aloud — not found in any file.` });
        wrong();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  return (<>
    <p className="pz-doc">The final dossier. Eight blanks. Six answers come from the puzzles you've solved. Two come from things said aloud during this investigation — not written in any file, not on any blackboard. If you were listening, you have them.</p>
    <div className="p9-dos">
      <div className="p9-dh">PROJECT NULL-GATE — FINAL CASE FILE</div>
      <div className="p9-ds">CLASSIFICATION: LEVEL IX — BROKEN DECK</div>
      {DOSSIER.map((b, i) => (
        <div key={b.id} className="p9-f">
          <label className="p9-lb">[{String(b.id).padStart(2,"0")}] {b.label}</label>
          <input className="p9-in" value={vals[i]} onChange={e => setV(i, e.target.value)} disabled={locked} placeholder={b.ph}/>
        </div>
      ))}
    </div>
    <form onSubmit={submit}>
      <button className="btn" type="submit" disabled={locked} style={{marginTop:12}}>SUBMIT FINAL DOSSIER</button>
    </form>
    {st && <div className={`status ${st.ok ? "ok" : "err"}`}>{st.msg}</div>}
  </>);
}

/* ── META / HINTS ── */
interface PuzzleMetaItem {
  title: string;
  prompt: string;
  hints: string[];
}
const PUZZLE_META: PuzzleMetaItem[] = [
  {title:"The Transmission Log",     prompt:"Morse encoded in punctuation has been decoded for you. Five words are anagrams of each other. The one that isn't — that's your answer.",          hints:["Compare only the decoded words (not the raw transmissions). Five share the exact same set of letters. One uses completely different letters.","The five anagrams all rearrange the same six letters. The sixth decoded word — the odd one out — is a month name.","OCTOBER is the non-anagram. The final log entry also includes the year: 1972. Full answer accepted: OCTOBER or 14 OCTOBER 1972."]},
  {title:"The Personnel Ledger",     prompt:"Find three tampered entries. The first character of each, in ledger order (top to bottom), spells your code.",                                   hints:["Start with timestamps — can someone exit before they've entered? Check the Security department entries carefully.","Clearance levels: A=highest, D=lowest. Neuroscience sub-level requires minimum clearance C. Check who's listed under Neuroscience with a D clearance.","Third contradiction: look at the name fields themselves. Staff names should only contain letters. Facility protocol doesn't allow numeric characters in name fields."]},
  {title:"The Blackboard Formula",   prompt:"Sum atomic numbers per compound. Map each sum to a letter (1=A). Discard the chemically impossible one. Read the remaining five in order.",      hints:["Noble gases — He, Ne, Ar, Kr, Xe — cannot form bonds. Any compound containing a noble gas is chemically impossible and should be discarded.","After discarding the impossible compound (XeF₈, Xe cannot bond): remaining valid sums are 4, 5, 12, 20, 1. Map: 4=D, 5=E, 12=L, 20=T, 1=A.","The five valid compounds in written order spell DELTA."]},
  {title:"The Frequency Grid",       prompt:"Average each scan line (round down). Recover the corrupted GAMMA cell using 180° mirror symmetry before averaging.",                            hints:["The corrupted cell is at row 2, column 6. Its mirror under 180° rotation is at (7−2, 7−6) = row 5, column 1.","The grid value at row 5, column 1 is 5. That's your recovered value. Now average all 8 cells in GAMMA (including the recovered 5).","The four rounded-down averages are 7, 2, 9, 4. PIN = 7294."]},
  {title:"The Witness Statements",   prompt:"One lie per witness. Cross-reference against each other and against log records. Key word per witness (1–3 in order) gives the location.",      hints:["W1's lie involves timing another subject — check when W3 says they entered and whether W1's claim about seeing them leave is possible.","W2 says they were inside 40 minutes. Exit logs contradict this. W3's lie: their description of the interior contradicts every other witness.","Key words: W1's true statements contain THE, W2's contain NULL, W3's contain ROOM. Location: THE NULL ROOM."]},
  {title:"The Cross-Reference Chain",prompt:"Follow entries from A-1. Collect letters. Dead ends loop — if you've seen a node already, back out. Eight valid stops total.",                    hints:["Dead ends: D-9 references itself. B-2 sends you back to C-3. F-8 sends you back to F-2. G-9 references itself. Avoid all of these.","The valid chain: A-1 → C-3 → B-7 → F-2 → D-5 → E-4 → G-1 → H-6. Follow only these eight entries.","Letters collected in order: N, U, L, L, G, A, T, E → NULL-GATE."]},
  {title:"The Blueprint Cipher",     prompt:"Three room adjacency pairs violate safety rules. Those rooms have wrong legend entries. Fix them, read rooms 1–7.",                              hints:["The three violations: Room 1 (Wet Lab) adj Room 2 (Electrical Vault) — water + electricity hazard. Room 4 (High-Voltage) adj Room 8 (Cryogenic) — thermal + electrical. Room 11 (Pressure Chamber) adj Room 12 (Director's Office) — safety isolation violation.","The wrong legend entries are rooms 2, 4, and 8. The correct word spelled by rooms 1–7 is a word meaning one who observes.","Correct legend: Room 2=A, Room 4=C, Room 8=X. Reading rooms 1–7: W, A, T, C, H, E, R → WATCHER."]},
  {title:"The Memory Sequences",     prompt:"Each sequence has a rule. Index 5 always breaks it. Find the correct symbol for each, look it up, collect four letters.",                       hints:["Seq 1: 3-cycle ○□△. Index 5: position 5%3=2 in cycle = △ → Z. Seq 2: odd index = □. Index 5 is odd → □ → E.","Seq 3: seq[n]=seq[n−2]. seq[5]=seq[3]=○ → R. Seq 4: pairs ⬡⬡,○○,⬟⬟. Index 5 = second ⬟ in pair → ⬟ → O.","Correct symbols: △, □, ○, ⬟ → letters Z, E, R, O → ZERO."]},
  {title:"The Final Dossier",        prompt:"Eight fields. Six from puzzles. Two from something spoken aloud during this investigation — not written anywhere.",                               hints:["Fields 1–6: 14 OCTOBER 1972 / EK4 / DELTA / 7294 / THE NULL ROOM / NULL-GATE.","Fields 7 and 8 come from the dialogue scenes. Someone mentioned the founding year. Someone's surname has appeared in every single recovered audio header.","Field 7: 1967 (stated by Voss in recovered audio). Field 8: VOSS (the Director's surname, present throughout)."]},
];

/* ── SEQUENCE ── */
type SeqItem = 
  | { type: "cutscene"; key: string }
  | { type: "puzzle"; idx: number };

const buildSeq = (): SeqItem[] => {
  const s: SeqItem[] = [{ type: "cutscene", key: "intro" }];
  for (let i = 0; i < 9; i++) {
    s.push({ type: "cutscene", key: `beforeP${i + 1}` });
    s.push({ type: "puzzle", idx: i });
    if (i < 8) s.push({ type: "cutscene", key: `afterP${i + 1}` });
  }
  s.push({ type: "cutscene", key: "final" });
  return s;
};
const SEQ = buildSeq();
const PUZZLE_COMPS: React.ComponentType<any>[] = [P1, P2, P3, P4, P5, P6, P7, P8, P9];

/* ── HEADER ── */
interface HeaderProps {
  stage: number;
  elapsed: number;
  onRestart: () => void;
  muted: boolean;
  onToggle: () => void;
}
function Header({ stage, elapsed, onRestart, muted, onToggle }: HeaderProps) {
  const done = Math.max(0, Math.floor((stage - 1) / 2));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s2 = elapsed % 60;
  const fmt = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="hd">
      <div className="hd-l">
        <span style={{fontSize:16}}>🗂</span>
        <div>
          <div className="hd-title">BROKEN DECK</div>
          <div className="hd-sub">PUZZLE {Math.min(done + 1, 9)} / 9</div>
        </div>
      </div>
      <div className="hd-r">
        <div className="hd-timer">⏱ {fmt(h)}:{fmt(m)}:{fmt(s2)}</div>
        <div className="hd-dots">
          {Array(9).fill(0).map((_val, i) => (
            <span key={i} className={`hd-dot ${i < done ? "done" : i === done ? "cur" : ""}`}/>
          ))}
        </div>
        <button className="hd-btn" onClick={onToggle}>{muted ? "🔇" : "🔊"}</button>
        <button className="hd-btn" onClick={onRestart}>↺</button>
      </div>
    </div>
  );
}

/* ── SPLASH ── */
interface SplashProps {
  onStart: () => void;
}
function Splash({ onStart }: SplashProps) {
  return (
    <div className="sp">
      <div className="sp-eye">👁</div>
      <div className="sp-pre">Classified Archive · 1972</div>
      <h1 className="sp-title">THE<br/>BROKEN<br/>DECK</h1>
      <div className="sp-rule"/>
      <p className="sp-tag">A government facility. Nine puzzles. A name no one was supposed to find. Follow the chain — and pay close attention to everything that is said.</p>
      <button className="sp-btn" onClick={onStart}>BEGIN INVESTIGATION</button>
    </div>
  );
}

/* ── FINALE ── */
interface FinaleProps {
  elapsed: number;
  onRestart: () => void;
}
function Finale({ elapsed, onRestart }: FinaleProps) {
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s2 = elapsed % 60;
  const fmt = (n: number) => String(n).padStart(2, "0");
  const rank = elapsed < 1800 ? "⚡ ARCHIVIST ELITE" : elapsed < 2700 ? "🔍 SENIOR INVESTIGATOR" : elapsed < 4200 ? "📁 INVESTIGATOR" : "⏳ FIELD ANALYST";
  return (
    <div className="fin fade-in">
      <div className="fin-eye">👁</div>
      <div style={{fontSize:9,letterSpacing:".18em",color:"var(--gd)",marginBottom:8}}>CASE CLOSED</div>
      <h2 className="fin-title">ARCHIVE UNLOCKED</h2>
      <div className="fin-time">{fmt(h)}:{fmt(m)}:{fmt(s2)}</div>
      <div className="fin-rank">{rank}</div>
      <div className="fin-story">
        <p>NULL-GATE ran for five years. Sixty-three voluntary subjects. All informed. None of them could have known what they were actually consenting to.</p>
        <p>The Watcher appeared in every session — every cabinet, every subject, every year. Described differently each time. Drawn identically every time.</p>
        <p>Director Voss signed the shutdown order himself in late 1972. No reason was given on record. The facility was sealed. The sub-level was left intact.</p>
        <p>Whether the gate was ever closed — the archive does not say.</p>
        <p className="fin-q">"There was never a choice. Every cabinet was leading here."</p>
      </div>
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "20px" }}>
        <button className="sp-btn" onClick={onRestart}>↺ REOPEN</button>
        <button className="sp-btn" onClick={() => { markCaseCompleted("08"); window.location.href = '/hunt'; }} style={{ background: "var(--gd)", color: "black" }}>◈ RETURN TO HUB</button>
      </div>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "12px", textAlign: "center", fontFamily: "monospace" }}>
        Redirecting to hub in 15 seconds...
      </div>
    </div>
  );
}

/* ── ROOT ── */
export default function App() {
  const [phase, setPhase] = useState("splash");
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [trans, setTrans] = useState(false);
  const ivRef = useRef<any>(null);
  const music = useMusicEngine();

  useEffect(() => {
    if (timerOn) { ivRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else if (ivRef.current) clearInterval(ivRef.current);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [timerOn]);

  // Load DB progress on mount
  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await fetch("/api/progress?caseId=08");
        const data = await res.json();
        if (data.success && data.progress?.case8State) {
          const state = data.progress.case8State;
          if (state.stage !== undefined) setStage(state.stage);
          if (state.phase && state.phase !== "splash") {
            setPhase(state.phase);
            if (state.phase === "game") {
              const currentStep = SEQ[state.stage ?? 0];
              if (currentStep && currentStep.type === "puzzle") {
                setTimerOn(true);
              }
            }
          }
          if (state.elapsed !== undefined) setElapsed(state.elapsed);
        }
      } catch (err) {
        console.error("Failed to load Case 8 progress:", err);
      }
    }
    loadProgress();
  }, []);

  // Save progress when phase or stage changes
  useEffect(() => {
    if (phase === "splash") return;
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: "08", key: "case8State", value: { phase, stage, elapsed } }),
    }).catch((err) => console.error("Failed to save Case 8 progress:", err));
  }, [phase, stage]);

  useEffect(() => {
    if (phase === "finale") {
      markCaseCompleted("08");
      const timer = setTimeout(() => {
        window.location.href = '/hunt';
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  function startGame() { setPhase("game"); setStage(0); music.start(); }
  function toggleMute() { const n = !muted; setMuted(n); music.setVol(n ? 0 : 0.13); }

  function goNext() {
    setTrans(true);
    setTimeout(() => {
      const next = stage + 1;
      if (next >= SEQ.length) { setTimerOn(false); setPhase("finale"); }
      else {
        const nextStep = SEQ[next];
        if (nextStep && nextStep.type === "puzzle" && !timerOn) setTimerOn(true);
        setStage(next);
      }
      setTrans(false);
    }, 300);
  }

  function restart() { setPhase("splash"); setStage(0); setElapsed(0); setTimerOn(false); setMuted(false); music.stop(); }

  const step = SEQ[stage];

  return (
    <div className="root">
      <style>{S}</style>
      {phase === "splash" && <Splash onStart={startGame}/>}
      {phase === "game" && (<>
        <Header stage={stage} elapsed={elapsed} onRestart={restart} muted={muted} onToggle={toggleMute}/>
        <div className="main">
          <div className="stage" style={{ opacity: trans ? 0 : 1, transition: "opacity .3s" }}>
            {step && step.type === "cutscene" && (
              <Dialogue key={step.key} sceneKey={step.key} onComplete={goNext}/>
            )}
            {step && step.type === "puzzle" && (() => {
              const Comp = PUZZLE_COMPS[step.idx];
              const meta = PUZZLE_META[step.idx];
              return (
                <Shell key={step.idx} index={step.idx + 1} title={meta.title} prompt={meta.prompt} hints={meta.hints}>
                  <Comp onSolve={goNext} dbAnswers={{}}/>
                </Shell>
              );
            })()}
          </div>
        </div>
      </>)}
      {phase === "finale" && (<>
        <Header stage={SEQ.length} elapsed={elapsed} onRestart={restart} muted={muted} onToggle={toggleMute}/>
        <div className="main">
          <div className="stage">
            <Finale elapsed={elapsed} onRestart={restart}/>
          </div>
        </div>
      </>)}
    </div>
  );
}
