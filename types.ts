export type Point = {
  x: number;
  y: number;
};

export enum PlaneType {
  RED = 'RED',
  BLUE = 'BLUE',
  YELLOW = 'YELLOW',
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Plane {
  id: string;
  x: number;
  y: number;
  angle: number; // radians
  speed: number;
  type: PlaneType;
  path: Point[];
  isSelected: boolean;
  state: 'FLYING' | 'LANDING' | 'CRASHED' | 'LANDED';
  landingProgress: number; // 0 to 1
}

export interface Runway {
  id: string;
  x: number; // Center x
  y: number; // Center y
  width: number;
  height: number;
  angle: number; // radians
  type: PlaneType;
  entryPoint: Point; // Where the plane must hit to start landing
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  opacity: number;
}