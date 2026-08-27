"use client";

import { useEffect, useRef } from "react";
import { getOrCreateLandingVariant, trackClientEvent } from "@/lib/clientAnalytics";

type ResultViewTrackerProps = {
  reportId: string;
  score: number;
};

export function ResultViewTracker({ reportId, score }: ResultViewTrackerProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }
    trackedRef.current = true;

    const variant = getOrCreateLandingVariant();
    void trackClientEvent({
      name: "result_view",
      variant,
      metadata: {
        reportId,
        score,
      },
    });
  }, [reportId, score]);

  return null;
}
