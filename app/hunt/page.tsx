"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { isCaseCompleted } from "@/components/case-progress";
import { Lock, X, Menu } from "lucide-react";
import gsap from "gsap";

const SYMBOL_DETAILS: Record<string, { title: string; desc: string }> = {
  "01": {
    title: "The Pharaoh's Curse",
    desc: "Recovered from the primary server breach. Its geometric lines align perfectly with archaic celestial mapping ciphers.",
  },
  "02": {
    title: "The Lost Chronicle",
    desc: "Extracted from the encrypted transmission logs. Represents infinite recursion, suggesting a self-replicating loop in the network core.",
  },
  "03": {
    title: "The Dying Flame",
    desc: "Obtained from the metadata of the corrupted time-stamped files. A representation of temporal fragmentation.",
  },
  "04": {
    title: "The Crimson Carnival",
    desc: "Discovered within the deep web darknet handshake protocols. Points to three intersecting nodes in the darknet routing table.",
  },
  "05": {
    title: "The Blue Ledger",
    desc: "Retrieved from the memory dump of the compromised firewall. Refracts incoming security scans into harmless noise.",
  },
  "06": {
    title: "The Override Sequence",
    desc: "Found embedded in the binary structure of the zero-day exploit. Synthesizes empty space to absorb memory buffer overflows.",
  },
  "07": {
    title: "Operation Deadlight",
    desc: "Decoded from the final radio transmission. The primary key used to lock Operation Deadlight's communication array.",
  },
  "08": {
    title: "The Broken Deck",
    desc: "Acquired from the core reactor console before collapse. The ultimate symbol that binds all other network nodes together.",
  },
};

const CASE_COLORS = [
  {
    hoverBorder: "hover:border-cyan-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(6,182,212,0.12)]",
    bgGradient: "to-cyan-500/[0.02]",
    textColor: "group-hover:text-cyan-400",
  },
  {
    hoverBorder: "hover:border-red-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(239,68,68,0.12)]",
    bgGradient: "to-red-500/[0.02]",
    textColor: "group-hover:text-red-400",
  },
  {
    hoverBorder: "hover:border-amber-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.12)]",
    bgGradient: "to-amber-500/[0.02]",
    textColor: "group-hover:text-amber-400",
  },
  {
    hoverBorder: "hover:border-violet-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.12)]",
    bgGradient: "to-violet-500/[0.02]",
    textColor: "group-hover:text-violet-400",
  },
  {
    hoverBorder: "hover:border-emerald-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.12)]",
    bgGradient: "to-emerald-500/[0.02]",
    textColor: "group-hover:text-emerald-400",
  },
  {
    hoverBorder: "hover:border-pink-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.12)]",
    bgGradient: "to-pink-500/[0.02]",
    textColor: "group-hover:text-pink-400",
  },
  {
    hoverBorder: "hover:border-orange-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.12)]",
    bgGradient: "to-orange-500/[0.02]",
    textColor: "group-hover:text-orange-400",
  },
  {
    hoverBorder: "hover:border-fuchsia-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(217,70,239,0.12)]",
    bgGradient: "to-fuchsia-500/[0.02]",
    textColor: "group-hover:text-fuchsia-400",
  },
  {
    hoverBorder: "hover:border-indigo-500/40",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(99,102,241,0.12)]",
    bgGradient: "to-indigo-500/[0.02]",
    textColor: "group-hover:text-indigo-400",
  },
];



export default function HuntPage() {
  const [completedList, setCompletedList] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string | null>(null);
  
  // State for newly solved case symbol animation
  const [solvedCaseForAnim, setSolvedCaseForAnim] = useState<string | null>(null);
  const [showUnlockOverlay, setShowUnlockOverlay] = useState<boolean>(false);
  const [animStep, setAnimStep] = useState<"intro" | "fly" | "done">("intro");
  
  // State for inventory dropdown open/close
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);

  // State for symbol details popup modal
  const [selectedSymbolCase, setSelectedSymbolCase] = useState<string | null>(null);

  const flyerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Initial client-side check from cookies
    const list: Record<string, boolean> = {};
    const caseFilesNums = Array.from({ length: 9 }, (_, i) => String(i + 1).padStart(2, "0"));
    caseFilesNums.forEach((num) => {
      list[num] = isCaseCompleted(num);
    });
    setCompletedList(list);

    // 2. Fetch latest from database API and sync
    async function syncProgress() {
      try {
        const res = await fetch("/api/cases/progress");
        const data = await res.json();
        
        if (data.success && data.userId) {
          setUserId(data.userId);
        }

        // Fetch Case 9 state from progress DB
        const c9Res = await fetch("/api/progress?caseId=09");
        const c9Data = await c9Res.json();
        const stage2Completed = c9Data.success && c9Data.progress?.case9State?.stage2Completed === true;

        if (data.success && data.completedCases) {
          if (data.stage1Completed) {
            if (!stage2Completed) {
              data.completedCases["09"] = false;
              list["09"] = false;
            }
          }

          const apiCompleted = data.completedCases as Record<string, boolean>;
          let changed = false;
          
          for (const num of caseFilesNums) {
            // If DB says it's completed, set cookie cache
            if (apiCompleted[num]) {
              if (!list[num]) {
                list[num] = true;
                const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
                document.cookie = `case-${num}-completed=true; path=/; max-age=31536000; SameSite=Lax${isSecure ? '; Secure' : ''}`;
                changed = true;
              }
            } else {
              // If DB says not completed, clear client cache (reconciles leftover session data)
              if (list[num]) {
                list[num] = false;
                document.cookie = `case-${num}-completed=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                changed = true;
              }
            }
          }
          
          if (changed) {
            setCompletedList({ ...list });
          }
        }
      } catch (err) {
        console.error("Failed to sync case progress:", err);
      }
    }
    syncProgress();
  }, []);

  // Triggered when completedList is populated: checks if a case was just solved in this tab session
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Object.keys(completedList).length === 0) return;

    const justSolved = sessionStorage.getItem("just-solved-case");
    if (justSolved) {
      const caseInt = parseInt(justSolved, 10);
      if (caseInt >= 1 && caseInt <= 8) {
        setSolvedCaseForAnim(justSolved);
        setShowUnlockOverlay(true);
        setAnimStep("intro");
      }
    }
  }, [completedList]);

  // Minimal GSAP animation for the unlock overlay intro
  useEffect(() => {
    if (!showUnlockOverlay || !solvedCaseForAnim || animStep !== "intro") return;

    // Clean minimal entrance of the modal card without 3D tilt or heavy bounce
    gsap.fromTo(
      ".stacked-modal-card",
      { scale: 0.92, opacity: 0, y: 15 },
      { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
    );

    // Subtle entrance of the center symbol
    gsap.fromTo(
      ".center-symbol-container",
      { scale: 0.85, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, delay: 0.1, ease: "power2.out" }
    );
  }, [showUnlockOverlay, solvedCaseForAnim, animStep]);

  const handleStoreSymbol = () => {
    if (!solvedCaseForAnim) return;

    // Open inventory dropdown so target slot exists in the DOM and coordinates can be read
    setIsInventoryOpen(true);

    // Start flying step
    setAnimStep("fly");

    // Fade out overlay card content quickly
    gsap.to(".stacked-modal-card-content", {
      opacity: 0,
      duration: 0.2,
      ease: "power2.out",
    });

    // Give DOM 100ms to render the inventory panel and target slot
    setTimeout(() => {
      const centralEl = document.querySelector(".center-symbol-img");
      const targetSlotEl = document.getElementById(`inventory-slot-${solvedCaseForAnim}`);

      if (!centralEl || !targetSlotEl) {
        // Fallback
        sessionStorage.removeItem("just-solved-case");
        setAnimStep("done");
        setShowUnlockOverlay(false);
        return;
      }

      const rectStart = centralEl.getBoundingClientRect();
      const rectEnd = targetSlotEl.getBoundingClientRect();

      // Configure starting geometry of the flyer to match the central symbol size/pos
      if (flyerRef.current) {
        gsap.set(flyerRef.current, {
          x: rectStart.left,
          y: rectStart.top,
          width: rectStart.width,
          height: rectStart.height,
          opacity: 1,
          scale: 1,
        });

        // Minimal direct translate flyer to the target slot
        gsap.to(flyerRef.current, {
          x: rectEnd.left,
          y: rectEnd.top,
          width: rectEnd.width,
          height: rectEnd.height,
          opacity: 0.9,
          duration: 0.55,
          ease: "power2.inOut",
          onComplete: () => {
            // Subtle slot pulse on arrival
            gsap.fromTo(
              targetSlotEl,
              { scale: 1 },
              { scale: 1.1, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.out" }
            );

            // Cleanup overlay and flag
            setAnimStep("done");
            setShowUnlockOverlay(false);
            sessionStorage.removeItem("just-solved-case");
          }
        });
      }
    }, 100);
  };

  const caseFiles = Array.from({ length: 9 }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    return `Case-File-${num}`;
  });

  return (
    <main 
      className="flex flex-col items-center min-h-screen w-full text-white pt-16 md:pt-24 px-6 pb-24 relative overflow-hidden bg-cover bg-center bg-no-repeat"
    >
      <Image
        src="/Hunt/Background-Image.avif"
        alt="Background"
        fill
        priority
        sizes="100vw"
        className="object-cover pointer-events-none -z-10"
      />
      {/* Premium dark cinematic overlays */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.65)_100%)] pointer-events-none z-0" />

      {/* Floating HUD Inventory Hamburger Trigger */}
      <button 
        onClick={() => setIsInventoryOpen(!isInventoryOpen)}
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-35 flex items-center gap-3 px-4.5 py-2 bg-gradient-to-r from-zinc-950/90 via-zinc-900/90 to-zinc-950/90 border border-zinc-800/60 hover:border-amber-500/80 text-zinc-300 hover:text-amber-400 rounded-xl cursor-pointer transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 backdrop-blur-md font-mono text-[10px] sm:text-[11px] tracking-[0.2em] font-extrabold select-none group active:scale-95"
      >
        <span className="relative flex items-center justify-center w-4 h-4">
          {/* Pulsing indicator when there are solved items */}
          {Object.keys(completedList).filter(k => parseInt(k, 10) <= 8 && completedList[k]).length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
            </span>
          )}
          <span className="transition-transform duration-300 group-hover:rotate-180">
            {isInventoryOpen ? <X size={15} className="text-amber-400" /> : <Menu size={15} className="text-zinc-400 group-hover:text-amber-400" />}
          </span>
        </span>
        
        <span className="bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent group-hover:from-amber-300 group-hover:to-yellow-400 transition-all duration-300">
          INVENTORY
        </span>
        
        <span className="font-mono text-[10px] sm:text-[11px] font-black text-amber-400 bg-amber-950/40 px-2 py-0.5 border border-amber-500/30 rounded-lg shadow-[inset_0_0_8px_rgba(245,158,11,0.25)] group-hover:border-amber-400/60 transition-all duration-300">
          {Object.keys(completedList).filter(k => parseInt(k, 10) <= 8 && completedList[k]).length}/8
        </span>
      </button>

      {/* Dropdown Deciphered Archive Inventory (Top Left Corner) */}
      {isInventoryOpen && (
        <section 
          id="inventory-section"
          className="fixed top-16 left-4 sm:top-20 sm:left-6 z-30 bg-zinc-950/95 border border-zinc-800/80 hover:border-amber-500/40 rounded-2xl px-4 py-3 backdrop-blur-lg shadow-[0_12px_40px_rgba(0,0,0,0.85),_0_0_30px_rgba(245,158,11,0.05)] flex flex-col gap-2.5 w-[calc(100%-2rem)] sm:w-auto max-w-sm sm:max-w-md transition-all duration-300 animate-[fadeIn_0.3s_ease-out] origin-top-left"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-500/[0.03] pointer-events-none rounded-2xl" />
          
          {/* Title and stats bar */}
          <div className="flex items-center justify-between w-full border-b border-zinc-800/50 pb-1.5 text-[9px] tracking-widest font-mono text-zinc-400">
            <span className="uppercase tracking-[0.2em] bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent font-bold">
              ARCHIVE RECORDS
            </span>
          </div>

          {/* 8 slots row */}
          <div className="flex items-center justify-start gap-1.5 sm:gap-2.5 w-full py-0.5 overflow-x-auto">
            {Array.from({ length: 8 }, (_, i) => {
              const num = String(i + 1).padStart(2, "0");
              const isCompleted = completedList[num];
              const isUnlocked = isCompleted && !(solvedCaseForAnim === num && animStep !== "done");

              if (isUnlocked) {
                return (
                  <div
                    key={num}
                    id={`inventory-slot-${num}`}
                    onClick={() => setSelectedSymbolCase(num)}
                    className="relative w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center border border-amber-500/20 bg-amber-950/10 hover:bg-amber-950/20 rounded-xl transition-all duration-300 hover:border-amber-400/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:-translate-y-0.5 cursor-pointer group select-none flex-shrink-0"
                  >
                    <Image
                      src={`/Symbols/cf${i + 1}.avif`}
                      alt={`Case ${num} Symbol`}
                      width={36}
                      height={36}
                      className="w-5 h-5 sm:w-7 sm:h-7 md:w-9 md:h-9 object-contain filter drop-shadow-[0_0_6px_rgba(245,158,11,0.45)]"
                    />
                    {/* Subtle hover tooltip */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-[8px] tracking-wider text-amber-400 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap font-mono z-40">
                      CF-{num}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={num}
                  id={`inventory-slot-${num}`}
                  className="relative w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center border border-zinc-900/60 bg-zinc-950/40 rounded-xl text-zinc-700 select-none group flex-shrink-0"
                >
                  <Lock size={11} className="opacity-45" />
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-[8px] tracking-wider text-zinc-500 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap font-mono z-40">
                    LOCKED
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <h1 className="relative z-10 font-serif text-4xl sm:text-5xl md:text-6xl tracking-[0.2em] bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent uppercase select-none mb-12 md:mb-16">
        Choose Case File
      </h1>

      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
        {(() => {
          const displayIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];

          return displayIndices.map((origIndex) => {
            const num = String(origIndex + 1).padStart(2, "0");
            const fileName = `Case-File-${num}`;
            const isCompleted = completedList[num];

            if (isCompleted) {
              return (
                <Link
                  key={origIndex}
                  href={`/hunt/case-${num}`}
                  className="flex flex-col items-center justify-center h-36 md:h-44 bg-zinc-950/20 border border-emerald-950/40 rounded-xl p-6 relative overflow-hidden select-none cursor-pointer group hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all duration-300"
                >
                  {["01", "02", "03", "04", "05", "06", "07", "08", "09"].includes(num) && (
                    <>
                      <Image
                        src={`/Cards-hunt/case${num}.avif`}
                        alt={`Case File ${num}`}
                        fill
                        priority
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover scale-[1.2] group-hover:scale-[1.25] transition-transform duration-300 z-0"
                      />
                      <div className="absolute inset-0 bg-black/60 group-hover:bg-black/45 transition-colors duration-300 z-0" />
                    </>
                  )}
                  {/* Muted green matrix overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-500/[0.01] z-10" />
                  
                  <div className="absolute bottom-3 right-4 font-mono text-[9px] tracking-[0.2em] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 border border-emerald-500/40 rounded z-20 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                    SECURED
                  </div>
                </Link>
              );
            }

            // Case-File-09 requires cases 1 to 8 to be solved
            const allOtherCasesSolved = Array.from({ length: 8 }, (_, i) => String(i + 1).padStart(2, "0"))
              .every((n) => completedList[n] === true);

            if (num === "09" && !allOtherCasesSolved) {
              return (
                <div
                  key={origIndex}
                  className="flex flex-col items-center justify-center h-36 md:h-44 bg-zinc-950/40 border border-red-950/30 rounded-xl p-6 relative overflow-hidden select-none cursor-not-allowed group"
                >
                  <Image
                    src="/Cards-hunt/case09.avif"
                    alt="Case File 09"
                    fill
                    priority
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover scale-[1.2] opacity-35 filter grayscale z-0"
                  />
                  <div className="absolute inset-0 bg-black/60 z-0" />
                  {/* Subtle red overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-red-500/[0.01] z-10" />
                  
                  <div className="absolute top-4 left-4 flex items-center justify-center text-red-500/40 z-20">
                    <Lock size={14} className="animate-pulse" />
                  </div>
                  
                  <div className="absolute bottom-3 right-4 font-mono text-[9px] tracking-[0.2em] text-red-500/60 bg-red-950/20 px-2 py-0.5 border border-red-500/20 rounded z-20">
                    LOCKED
                  </div>
                </div>
              );
            }

            const colors = CASE_COLORS[origIndex] || CASE_COLORS[0];

            return (
              <Link
                key={origIndex}
                href={`/hunt/case-${num}`}
                className={`flex items-center justify-center h-36 md:h-44 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-6 cursor-pointer transition-all duration-300 ${colors.hoverBorder} ${colors.hoverShadow} hover:-translate-y-1 group relative overflow-hidden`}
              >
                {["01", "02", "03", "04", "05", "06", "07", "08", "09"].includes(num) && (
                  <>
                    <Image
                      src={`/Cards-hunt/case${num}.avif`}
                      alt={`Case File ${num}`}
                      fill
                      priority
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover scale-[1.2] transition-transform duration-300 group-hover:scale-[1.25] z-0"
                    />
                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/35 transition-colors duration-300 z-0" />
                  </>
                )}
                {/* Subtle glow border effect on hover */}
                <div className={`absolute inset-0 bg-gradient-to-b from-transparent ${colors.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10`} />
              </Link>
            );
          });
        })()}
      </div>

      {/* Minimal Symbol Unlock Overlay (Stacked upon the Hunt page without background blur) */}
      {showUnlockOverlay && solvedCaseForAnim && (
        <div 
          className="fixed inset-0 z-45 flex flex-col items-center justify-center p-4 overflow-hidden select-none animate-[fadeIn_0.2s_ease-out]"
        >
          {/* Minimal Glass Card */}
          <div className="stacked-modal-card relative max-w-sm sm:max-w-md w-full bg-zinc-950/95 border border-amber-500/40 rounded-2xl p-6 md:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.9),_0_0_25px_rgba(245,158,11,0.2)] flex flex-col items-center text-center">
            {/* Header Status */}
            <div className="w-full flex items-center justify-between font-mono text-[9px] sm:text-[10px] tracking-[0.2em] text-amber-400/80 border-b border-zinc-800/80 pb-2.5 mb-5">
              <span>RECORD // CASE {solvedCaseForAnim}</span>
              <span className="text-emerald-400 font-bold">DECRYPTED</span>
            </div>

            <div className="stacked-modal-card-content relative flex flex-col items-center w-full">
              {/* Central Symbol Container */}
              <div className="relative w-28 h-28 md:w-32 md:h-32 z-10 flex items-center justify-center bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 shadow-[0_0_25px_rgba(245,158,11,0.2)] center-symbol-container mb-4">
                <Image
                  src={`/Symbols/cf${parseInt(solvedCaseForAnim, 10)}.avif`}
                  alt="Recovered Symbol"
                  width={128}
                  height={128}
                  className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(245,158,11,0.65)] center-symbol-img"
                />
              </div>

              {/* Title & Info */}
              <div className="z-10 flex flex-col items-center w-full">
                <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.2em] text-amber-300 uppercase mb-1 px-2.5 py-0.5 bg-amber-950/60 border border-amber-500/30 rounded-md">
                  CASE FILE {solvedCaseForAnim} SECURED
                </span>
                <h3 className="font-serif text-xl sm:text-2xl text-zinc-100 tracking-wider my-2">
                  {SYMBOL_DETAILS[solvedCaseForAnim]?.title}
                </h3>
                <p className="font-mono text-[10px] sm:text-[11px] text-zinc-400 tracking-wide leading-relaxed max-w-xs mb-5">
                  {SYMBOL_DETAILS[solvedCaseForAnim]?.desc}
                </p>

                <button
                  onClick={handleStoreSymbol}
                  disabled={animStep === "fly"}
                  className="w-full sm:w-auto px-6 py-2.5 bg-amber-950/70 hover:bg-amber-500/20 text-amber-300 hover:text-amber-100 font-mono text-xs tracking-[0.15em] uppercase border border-amber-500/40 hover:border-amber-400 rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {animStep === "fly" ? "RECORDING..." : "RECORD IN ARCHIVE HUB"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Symbol Detail Inspection Modal */}
      {selectedSymbolCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 select-none animate-[fadeIn_0.3s_ease-out]">
          <div className="relative max-w-md w-full border border-amber-500/40 bg-zinc-950/90 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden animate-[scaleUp_0.3s_ease-out]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-500/[0.02] pointer-events-none" />
            
            <button
              onClick={() => setSelectedSymbolCase(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 transition-colors duration-200 cursor-pointer"
            >
              <X size={18} />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className="w-36 h-36 flex items-center justify-center bg-amber-950/10 border border-amber-500/20 rounded-xl p-4 mb-6 shadow-inner relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-amber-500/[0.04]" />
                <Image
                  src={`/Symbols/cf${parseInt(selectedSymbolCase, 10)}.avif`}
                  alt={`Case ${selectedSymbolCase} Symbol`}
                  width={144}
                  height={144}
                  className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                />
              </div>
              
              <span className="font-mono text-[10px] tracking-[0.25em] text-amber-400 uppercase mb-2">
                ◈ RECOVERED SYMBOL 0{parseInt(selectedSymbolCase, 10)} ◈
              </span>
              
              <h3 className="font-serif text-xl md:text-2xl text-zinc-100 tracking-wider mb-4">
                {SYMBOL_DETAILS[selectedSymbolCase]?.title}
              </h3>
              
              <p className="font-mono text-xs text-zinc-400 tracking-wide leading-relaxed mb-6">
                {SYMBOL_DETAILS[selectedSymbolCase]?.desc}
              </p>
              
              <div className="font-mono text-[9px] tracking-[0.15em] text-zinc-500 border border-zinc-800/80 px-3 py-1 rounded bg-zinc-950/40">
                CASE-{selectedSymbolCase} SECURED // INT.SYS.RECORD
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flying Symbol Animation Canvas */}
      {animStep === "fly" && solvedCaseForAnim && (
        <div
          ref={flyerRef}
          className="fixed pointer-events-none z-50 rounded-xl border border-amber-500/50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-3 shadow-[0_0_30px_rgba(245,158,11,0.4)]"
          style={{
            width: "180px",
            height: "180px",
            left: 0,
            top: 0,
          }}
        >
          <Image
            src={`/Symbols/cf${parseInt(solvedCaseForAnim, 10)}.avif`}
            alt="Flying Symbol"
            width={180}
            height={180}
            className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]"
          />
        </div>
      )}
    </main>
  );
}
