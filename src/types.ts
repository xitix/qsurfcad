export interface MeshPreview {
  format: string;
  vertices: number;
  triangles: number;
  bounds: [number, number, number];
  center: [number, number, number];
  preview: number[][][];
  previewTriangles: number;
  points?: number[][];
  previewPoints?: number;
  pointCloud?: boolean;
  flatRegions?: FlatRegion[];
  flatRegion?: FlatRegion | null;
  curvatureTraces?: CurvatureTrace[];
}

export interface FlatRegion {
  normal: [number, number, number];
  center: [number, number, number];
  side: string;
  previewAreaPercent: number;
  previewFacets: number;
  connectedPatches: number;
  previewIndices: number[];
}

export interface CurvatureTrace {
  points: number[][];
  angle: number;
}

export interface ModificationNote {
  id: string;
  type: 'dimension' | 'grip' | 'fixture' | 'insert' | 'cutout' | 'fillet' | 'other';
  description: string;
  location?: [number, number, number];
  priority: 'high' | 'medium' | 'low';
  done: boolean;
}

export interface Orientation {
  rotation: [number, number, number];
  scale: number;
  units: string;
}

export interface RunManifest {
  id: string;
  createdAt: string;
  projectName: string;
  input: { name: string; path: string; size: number } | null;
  export: {
    name: string;
    path: string;
    generated: boolean;
    triangles?: number;
    solids?: number;
    boundsMm?: number[];
  } | null;
  orientation: Orientation;
  orientationConfirmed: boolean;
  modifications: ModificationNote[];
  reviewNotes: string;
  reviewComplete: boolean;
  targetCadTool: string;
  validated: boolean;
  validationNotes: string;
}

export type Stage = 0 | 1 | 2 | 3;
export type CameraView = 'iso' | 'front' | 'top' | 'right';

export interface CadTool {
  id: string;
  name: string;
  description: string;
  platform: string;
  icon: string;
  bestFor: string[];
  available: boolean;
}
