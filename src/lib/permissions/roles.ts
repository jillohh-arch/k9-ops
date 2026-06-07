export const roles = {
  admin: "admin",
  gestor: "gestor",
  instrutorK9: "instrutor_k9",
  condutor: "condutor",
  inventoryManager: "inventory_manager",
  fleetManager: "fleet_manager",
  healthManager: "health_manager",
} as const;

export type Role = (typeof roles)[keyof typeof roles];

export function hasAnyRole(userRoles: string[] | undefined, allowed: Role[]) {
  if (!userRoles?.length) return false;
  return allowed.some((role) => userRoles.includes(role));
}

export function isInstructorK9(claims: Record<string, unknown> | undefined) {
  if (!claims) return false;
  const claimRoles = Array.isArray(claims.roles) ? claims.roles : [];
  return (
    claims.role === roles.instrutorK9 ||
    claims.instrutor_k9 === true ||
    claims.training_role === roles.instrutorK9 ||
    claims.training_instructor === true ||
    claimRoles.includes(roles.instrutorK9)
  );
}
