import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/hunt/case-07/lib/session";
import { isDbAvailable, db } from "@/db";
import { timelineProgress } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

const caseTimelineMap: Record<string, string> = {
  "01": "heart-of-osiris",
  "02": "age-of-embers",
  "03": "echoes-of-the-artifact",
  "04": "midnight-carnival",
  "05": "project-heisenberg",
  "06": "protocol-zero",
  "07": "operation-deadlight",
  "08": "the-card-cabinets",
  "09": "final-stage-v2",
};

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession();
  
  const completedCases: Record<string, boolean> = {};
  let stage1Completed = false;

  // 1. Initial status from cookies
  Object.keys(caseTimelineMap).forEach((num) => {
    completedCases[num] = cookieStore.get(`case-${num}-completed`)?.value === "true";
  });

  // 2. Query from database if session is active
  if (isDbAvailable && session?.userId) {
    try {
      const progress = await db
        .select()
        .from(timelineProgress)
        .where(eq(timelineProgress.userId, session.userId));
        
      progress.forEach((row: any) => {
        if (row.timelineId === "final-stage" && row.status === "completed") {
          stage1Completed = true;
        }
        const caseNum = Object.keys(caseTimelineMap).find(
          (key) => caseTimelineMap[key] === row.timelineId
        );
        if (caseNum) {
          completedCases[caseNum] = row.status === "completed";
        }
      });
    } catch (error) {
      console.error("Failed to query progress from database:", error);
    }
  }

  return NextResponse.json({ success: true, authenticated: !!session, completedCases, stage1Completed, userId: session?.userId });
}

export async function POST(request: NextRequest) {
  try {
    const { caseId } = await request.json();
    if (!caseId || typeof caseId !== "string" || !caseTimelineMap[caseId]) {
      return NextResponse.json({ success: false, error: "Invalid caseId parameter" }, { status: 400 });
    }

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const timelineId = caseTimelineMap[caseId];

    // Verify progression prerequisites if DB is available
    if (isDbAvailable) {
      try {
        const userProgressRows = await db
          .select({ timelineId: timelineProgress.timelineId, status: timelineProgress.status })
          .from(timelineProgress)
          .where(eq(timelineProgress.userId, session.userId));

        const completedSet = new Set<string>();
        userProgressRows.forEach((row: any) => {
          if (row.status === "completed") {
            completedSet.add(row.timelineId);
          }
        });

        if (caseId === "09") {
          // Case 09 requires all 8 previous cases (01-08) to be completed
          const allPreviousCompleted = Array.from({ length: 8 }, (_, i) => String(i + 1).padStart(2, "0"))
            .every((num) => completedSet.has(caseTimelineMap[num]));

          if (!allPreviousCompleted) {
            return NextResponse.json(
              { success: false, error: "Prerequisite failure: All preceding cases (01-08) must be completed before Case 09" },
              { status: 403 }
            );
          }
        }
        // Cases 01 to 08 can be completed in any order
      } catch (dbErr) {
        console.error("Database check failed during progress validation:", dbErr);
      }
    }

    // Set cookie cache
    const cookieStore = await cookies();
    const cookieName = `case-${caseId}-completed`;
    const isProd = process.env.NODE_ENV === "production";
    cookieStore.set(cookieName, "true", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
      secure: isProd,
    });

    // Write to DB if session is active and DB is available
    if (isDbAvailable && session.userId && timelineId) {
      try {
        await db
          .insert(timelineProgress)
          .values({
            userId: session.userId,
            timelineId: timelineId,
            status: "completed",
            completedAt: new Date(),
            fragmentRecovered: false,
          })
          .onConflictDoUpdate({
            target: [timelineProgress.userId, timelineProgress.timelineId],
            set: {
              status: "completed",
              completedAt: new Date(),
            },
          });
      } catch (error) {
        console.error("Failed to update database progress:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progress POST API error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
