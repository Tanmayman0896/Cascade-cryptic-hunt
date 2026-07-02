'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Act1Archive } from './acts/Act1Archive'
import { Act2Quarantine } from './acts/Act2Quarantine'
import { Act3Infection } from './acts/Act3Infection'
import { Act4Silence } from './acts/Act4Silence'
import { Act5BlackSymbol } from './acts/Act5BlackSymbol'
import { Act6Identity } from './acts/Act6Identity'
import { Act7Memory } from './acts/Act7Memory'
import { Act8FinalTransmission } from './acts/Act8FinalTransmission'
import { EchoGuide } from '@/components/case-07/shared/EchoGuide'
import { useActProgress } from './hooks/useActProgress'
import { markCaseCompleted } from '@/components/case-progress'
import CaseGuard from '@/components/CaseGuard'
import styles from './operation-deadlight.module.css'

export default function OperationDeadlightPage() {
  const { isComplete, markComplete, hydrated } = useActProgress()

  // Sync completion with main progress database/cookies
  useEffect(() => {
    if (hydrated && isComplete('act-8')) {
      markCaseCompleted('07')
    }
  }, [hydrated, isComplete])

  useEffect(() => {
    if (typeof window === 'undefined' || !hydrated) return

    gsap.registerPlugin(ScrollTrigger)
    const mainEl = document.querySelector('main[data-timeline="operation-deadlight"]')
    if (!mainEl) return

    let debounceTimer: NodeJS.Timeout
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        ScrollTrigger.refresh()
        if ((window as any).lenis) {
          (window as any).lenis.resize()
        }
      }, 150)
    })

    resizeObserver.observe(mainEl)

    const timer = setTimeout(() => {
      ScrollTrigger.refresh()
      if ((window as any).lenis) {
        (window as any).lenis.resize()
      }
    }, 150)

    return () => {
      resizeObserver.disconnect()
      clearTimeout(timer)
    }
  }, [hydrated])

  const devUnlockAll = false // Set to true to unlock all acts for testing

  const actProgress =
    isComplete('act-8') ? 8 :
      isComplete('act-7') ? 7 :
        isComplete('act-6') ? 6 :
          isComplete('act-5') ? 5 :
            isComplete('act-4') ? 4 :
              isComplete('act-3') ? 3 :
                isComplete('act-2') ? 2 :
                  hydrated ? 1 : 0

  if (!hydrated) {
    return (
      <CaseGuard caseId="07">
        <main data-timeline="operation-deadlight" className={styles.timeline}>
          <Act1Archive />
          <EchoGuide character="crow" actProgress={0} />
        </main>
      </CaseGuard>
    )
  }

  return (
    <CaseGuard caseId="07">
      <main data-timeline="operation-deadlight" className={styles.timeline}>
        {/* Act 1: Always accessible — no puzzle gate */}
        <Act1Archive />

        {/* Stage 1 (Act 2 Quarantine): Commented out for now */}
        {/* <Act2Quarantine
          onPuzzleSolved={() => markComplete('act-2')}
        /> */}

        {/* Act 3: Unlocked (Stage 1 skipped) */}
        {(true || isComplete('act-2') || devUnlockAll) && (
          <Act3Infection
            onPuzzleSolved={() => markComplete('act-3')}
          />
        )}

        {/* Act 4: Locked until Act 3 behavioral match solved */}
        {(isComplete('act-3') || devUnlockAll) && (
          <Act4Silence
            onPuzzleSolved={() => markComplete('act-4')}
          />
        )}

        {/* Act 5: Locked until Act 4 alert elimination completed */}
        {(isComplete('act-4') || devUnlockAll) && (
          <Act5BlackSymbol
            onPuzzleSolved={() => markComplete('act-5')}
          />
        )}

        {/* Act 6: Locked until Act 5 symbol reconstruction solved */}
        {(isComplete('act-5') || devUnlockAll) && (
          <Act6Identity
            onPuzzleSolved={() => markComplete('act-6')}
          />
        )}

        {/* Act 7: Locked until Act 6 identity distortion solved */}
        {(isComplete('act-6') || devUnlockAll) && (
          <Act7Memory
            onPuzzleSolved={() => markComplete('act-7')}
          />
        )}

        {/* Act 8: Locked until Act 7 memory corruption solved */}
        {(isComplete('act-7') || devUnlockAll) && (
          <Act8FinalTransmission
            onPuzzleSolved={() => markComplete('act-8')}
          />
        )}

        <EchoGuide character="crow" actProgress={actProgress} />
      </main>
    </CaseGuard>
  )
}
