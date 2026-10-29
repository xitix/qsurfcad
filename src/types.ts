export interface WorkflowDefinition {
  id: string;
  label: string;
  inputExtension: string;
  exportExtensions: string[];
  exportLabel: string;
  reviewChecks: [string, string][];
  validationChecks: [string, string][];
  cadTitle: string;
  cadDescription: string;
  toleranceLabel: string;
  toleranceHelp: string;
  validationHelp: string;
  exportDescription: string;
}

export interface Orientation {
  rotation: [number, number, number];
  scale: number;
  units: string;
}

export interface MeshPreview {
  format: string;
  encoding?: string;
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

export interface RunManifest {
  id: string;
  workflow: string;
  createdAt: string;
  input: { name: string; path: string } | null;
  export: {
    name: string;
    path: string;
    generated?: boolean;
    conversion?: string;
    triangles?: number;
    solids?: number;
    boundsMm?: number[];
    traceCount?: number;
  } | null;
  orientation: Orientation;
  orientationConfirmed: boolean;
  orientationNotes: string;
  orientationComplete: boolean;
  reviewNotes: string;
  reviewChecks: string[];
  reviewComplete: boolean;
  validationNotes: string;
  validationChecks: string[];
  validated: boolean;
  exportFormatValid: boolean;
}

export type Stage = 0 | 1 | 2 | 3;

export type CameraView = 'iso' | 'front' | 'top' | 'right' | 'face';
