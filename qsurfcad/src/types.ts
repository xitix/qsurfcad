export interface SnapTarget {
  type: 'vertex' | 'edge' | 'face-center';
  position: [number, number, number];
  distance: number;
}

export interface SketchPoint {
  position: [number, number, number];
  snapped: boolean;
}

export interface Sketch {
  id: string;
  points: SketchPoint[];
  type: 'line' | 'arc' | 'circle';
}
