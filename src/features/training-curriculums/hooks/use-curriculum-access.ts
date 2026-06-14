"use client";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";

export function useCurriculumAccess() {
  const { can, profileId } = useAccessControl();
  const { profile } = useAuth();
  const isCurriculumAuthority =
    profileId === "administrador" || profile?.isK9Instructor === true;

  return {
    canEditCurriculums:
      isCurriculumAuthority && can("training", "edit"),
    canViewCurriculums: can("training", "view"),
    isCurriculumAuthority,
  };
}
