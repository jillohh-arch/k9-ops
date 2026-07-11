"use client";

import { useParams, useSearchParams, redirect } from "next/navigation";

/**
 * Legacy route: /training/sessions/[sessionId]?dog={dogId}
 *
 * Redirects to the canonical route when dog is provided.
 * Falls back to the sessions list when dog is missing or invalid.
 */
export default function SessionRedirect() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const dogId = searchParams.get("dog");
  const sessionId = params.sessionId;

  if (dogId && sessionId) {
    redirect(`/training/dogs/${dogId}/sessions/${sessionId}`);
  }

  redirect("/training?tab=sessions");
}
