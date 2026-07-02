"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MirrorScriptPuzzle, FortuneTellerPuzzle, BrokenTicketPuzzle, AudioGamePuzzle, FakeLoginPuzzle, GhostPuzzle } from "@/components/case-file-04";
import { markCaseCompleted } from "@/components/case-progress";

type StageType = "mirror" | "fortune" | "ticket" | "audio" | "login" | "ghost" | "completed";

export default function Page() {
  const [stage, setStage] = useState<StageType>("mirror");

  const saveStage = useCallback((newStage: StageType) => {
    setStage(newStage);
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: "04", key: "stage", value: newStage }),
    }).catch((err) => console.error("Failed to save Case 4 progress:", err));
  }, []);

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await fetch("/api/progress?caseId=04");
        const data = await res.json();
        if (data.success && data.progress?.stage) {
          if (data.progress.stage === "wheel") {
            saveStage("mirror");
          } else if (data.progress.stage === "shooting" || data.progress.stage === "fortune") {
            saveStage("ticket");
          } else {
            setStage(data.progress.stage);
          }
        }
      } catch (err) {
        console.error("Failed to load Case 4 progress:", err);
      }
    }
    loadProgress();
  }, [saveStage]);

  useEffect(() => {
    if (stage === "fortune") {
      saveStage("ticket");
    }
  }, [stage, saveStage]);

  useEffect(() => {
    if (stage === "completed") {
      markCaseCompleted("04");
      const timer = setTimeout(() => {
        window.location.href = "/hunt";
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  if (stage === "mirror") {
    return <MirrorScriptPuzzle onSolved={() => saveStage("ticket")} />;
  }

  if (stage === "fortune") {
    return null;
  }

  if (stage === "ticket") {
    return <BrokenTicketPuzzle onSolved={() => saveStage("audio")} />;
  }

  if (stage === "audio") {
    return <AudioGamePuzzle onSolved={() => saveStage("login")} />;
  }

  if (stage === "login") {
    return <FakeLoginPuzzle onSolved={() => saveStage("ghost")} />;
  }

  if (stage === "ghost") {
    return <GhostPuzzle onSolved={() => saveStage("completed")} />;
  }

  return (
    <div className="min-h-screen bg-[#030005] flex flex-col items-center justify-center text-white p-4">
      {/* Grid overlay background to maintain premium look */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.025)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-40" />

      <div className="max-w-md w-full bg-zinc-950/40 border border-emerald-500/35 p-8 rounded-2xl text-center space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.1)] relative z-10">
        <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-500 rounded-full flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black uppercase text-emerald-300 tracking-wider">
          CASE FILE 04 COMPLETE
        </h2>
        <p className="text-sm font-mono text-zinc-400 uppercase tracking-widest leading-relaxed">
          All nodes resolved. Sector 04 security systems stabilized.
        </p>
        <div className="pt-4 flex flex-col items-center gap-2">
          <button
            onClick={() => { markCaseCompleted("04"); window.location.href = '/hunt'; }}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-mono text-xs font-bold uppercase tracking-wider rounded-lg border border-emerald-500 transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            ◈ Return to Hub
          </button>
          <span className="text-[10px] text-zinc-500 font-mono">
            Redirecting automatically in 5 seconds...
          </span>
        </div>
      </div>
    </div>
  );
}
