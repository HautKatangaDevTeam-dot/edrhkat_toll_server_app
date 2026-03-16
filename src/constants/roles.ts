export const ROLES = [
  'ADMIN_SYSTEME',
  'SUPERVISEUR',
  'AGENT_BUREAU',
  'AGENT_TOLL'
] as const;

export type Role = (typeof ROLES)[number];
