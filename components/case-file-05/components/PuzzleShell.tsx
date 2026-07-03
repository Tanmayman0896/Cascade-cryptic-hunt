"use client";

import React, { ReactNode, useState, useEffect, useRef } from "react";
import { useCaseStore } from "../CaseFileProvider";
import { AnswerInput } from "./AnswerInput";
import { HintSystem } from "./HintSystem";
import { SolvedReveal } from "./SolvedReveal";
import { Terminal } from "lucide-react";
import { PuzzleLoadingOverlay } from "@/components/case-05/PuzzleLoadingOverlay";
import { SuccessOverlay } from "@/components/case-05/SuccessOverlay";

interface PuzzleShellProps {
  puzzleId: number;
  title: string;
  clue: string;
  children: ReactNode;
}

export function PuzzleShell({ puzzleId, title, clue, children }: PuzzleShellProps) {
  const solved = useCaseStore((state) => state.solved);
  const isSolved = solved.includes(puzzleId);

  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const wasSolvedRef = useRef(isSolved);

  useEffect(() => {
    setIsLoading(true);
    setShowSuccess(false);
    wasSolvedRef.current = isSolved;
  }, [puzzleId, isSolved]);

  useEffect(() => {
    if (isSolved && !wasSolvedRef.current) {
      setShowSuccess(true);
      wasSolvedRef.current = true;
    }
  }, [isSolved]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12 font-mono text-zinc-100 select-text relative min-h-[500px]">
      {/* Narrative overlays */}
      {isLoading && <PuzzleLoadingOverlay onComplete={() => setIsLoading(false)} />}
      {showSuccess && <SuccessOverlay onComplete={() => setShowSuccess(false)} />}

      {/* Puzzle Meta Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4 text-left">
        <div>
          <span className="text-[10px] text-emerald-500/70 tracking-widest uppercase">
            // ANOMALY STABILIZATION MODULE #{String(puzzleId).padStart(2, "0")}
          </span>
          <h2 className="text-2xl font-bold tracking-wide text-zinc-100 font-serif uppercase">
            {title}
          </h2>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold border ${
              isSolved
                ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-400"
                : "bg-amber-950/20 border-amber-900/50 text-amber-500 animate-pulse"
            }`}
          >
            {isSolved ? "STABILIZED" : "ACTIVE ANOMALY"}
          </span>
        </div>
      </div>



      {/* Interactive component child container */}
      <div className="py-6 min-h-[200px] border border-zinc-900 bg-zinc-950/20 backdrop-blur-xs rounded-md shadow-inner flex flex-col justify-center">
        {isLoading ? (
          <div className="text-zinc-600 text-xs font-mono text-center py-12">
            Loading security record feed...
          </div>
        ) : (
          children
        )}
      </div>

      {/* Submit / Solved Reveal area */}
      <div className="pt-2">
        {isSolved ? (
          <SolvedReveal puzzleId={puzzleId} />
        ) : (
          <div className="space-y-6">
            <AnswerInput puzzleId={puzzleId} />
            <HintSystem puzzleId={puzzleId} />
          </div>
        )}
      </div>
    </div>
  );
}

export default PuzzleShell;
