export const POSTS = [
  'KAMPEMBA',
  'MIKAS',
  'DITENGWA',
  'MENDA',
  'MULUNGWISI',
  'LWAMBO',
  'LWISHA CENTRE',
  'EXCELLENT',
  'RTE SHEMAF',
  'KABOLA',
  'KYANDWE',
  'SASE',
  '45 KM',
  'MIRINGI',
  'DIRECTION_GENERALE'
] as const;

export type Post = (typeof POSTS)[number];
