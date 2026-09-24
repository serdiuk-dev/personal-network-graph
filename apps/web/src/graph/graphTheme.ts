export const PRODIGY_LIGHT_THEME = {
  canvas: {
    background: '#f8fbfc',
    surface: '#ffffff',
    surfaceSoft: '#f3f8fa',
    border: '#e4edf1',
  },

  text: {
    primary: '#17233d',
    secondary: '#63758a',
    muted: '#94a3b8',
  },

  accent: {
    cyan: '#22d3ee',
    turquoise: '#18c7bd',
    blue: '#5b8def',
    deepBlue: '#2563eb',
  },

  node: {
    default: '#5b8def',
    selected: '#0ea5e9',
    neighbor: '#18c7bd',
    inactive: '#dce5eb',

    baseSize: 6,
    importanceStep: 2,

    selectedMinSize: 16,

    overviewLabelMinImportance: 3,

    clusterHubBonus: 4,
    interClusterBridgeBonus: 2,
  },

  edge: {
    default: '#bfd6e3',
    active: '#65b7e8',
    selected: '#18bfc4',
    inactive: '#e4ecef',

    defaultWidth: 0.9,
    activeWidth: 1.8,
    selectedWidth: 2.4,
    inactiveWidth: 0.45,

    strengthWidthStep: 0.12,
    maxStrengthWidthBonus: 0.72,
  },

  focus: {
    selectedZIndex: 3,
    neighborZIndex: 2,
    inactiveZIndex: 0,
  },

  motion: {
    cameraDurationMs: 450,
    transitionDurationMs: 260,
  },
} as const;

export type ProdigyLightTheme =
  typeof PRODIGY_LIGHT_THEME;
