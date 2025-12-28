import { PlaneType } from './types.js'; // Changed to .js extension

export const SPAWN_RATE_INITIAL = 2000; // ms
export const SPAWN_RATE_MIN = 800;
export const PLANE_SPEED = 1.5;
export const LANDING_SPEED = 2.5;
export const COLLISION_RADIUS = 20;
export const PATH_SMOOTHING = 5;

export const COLORS = {
  [PlaneType.RED]: '#ef4444',
  [PlaneType.BLUE]: '#3b82f6',
  [PlaneType.YELLOW]: '#eab308',
};

// Runway dimensions
export const RUNWAY_WIDTH = 120;
export const RUNWAY_HEIGHT = 200; // Visual length, hit box might be smaller