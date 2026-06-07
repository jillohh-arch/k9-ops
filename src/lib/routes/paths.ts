export const paths = {
  login: "/login",
  dashboard: "/dashboard",
  k9: "/k9",
  humans: "/humans",
  vehicles: "/vehicles",
  occurrences: "/occurrences",
  training: "/training",
  trainingMatrix: "/training-matrix",
  health: "/health",
  inventory: "/inventory",
  reports: "/reports",
  notifications: "/notifications",
  admin: "/admin",
} as const;

export type AppPath = (typeof paths)[keyof typeof paths];
