export interface MeshPreview {
  format: string;
  vertices: number;
  triangles: number;
  bounds: [number, number, number];
  center: [number, number, number];
  preview: number[][][];
  previewTriangles: number;
  flatRegions?: FlatRegion[];
  flatRegion?: FlatRegion | null;
  boundaryEdges?: BoundaryEdge[];
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

/** An edge on the boundary of a flat region (shared with a non-flat neighbor) */
export interface BoundaryEdge {
  a: [number, number, number];
  b: [number, number, number];
  regionIndex: number;
}

/** 2D coordinate frame on a flat face */
export interface SketchPlane {
  id: string;
  flatRegionIndex: number;
  origin: [number, number, number];
  uAxis: [number, number, number];
  vAxis: [number, number, number];
  normal: [number, number, number];
  label: string;
}

/** A 2D point in sketch-plane coordinates */
export type Point2D = [number, number];

/** Drawing primitives on a sketch plane */
export type SketchElement =
  | { id: string; type: 'line'; points: [Point2D, Point2D] }
  | { id: string; type: 'polyline'; points: Point2D[]; closed: boolean }
  | { id: string; type: 'circle3p'; points: [Point2D, Point2D, Point2D] }
  | { id: string; type: 'arc3p'; points: [Point2D, Point2D, Point2D] }
  | { id: string; type: 'spline'; points: Point2D[] };

/** A sketch on one plane */
export interface Sketch {
  id: string;
  planeId: string;
  elements: SketchElement[];
  color: string;
  name: string;
}

/** A closed loop identified from sketch elements */
export interface SketchLoop {
  id: string;
  sketchId: string;
  points3D: [number, number, number][];
  points2D: Point2D[];
  area: number;
  perimeter: number;
  suggestedPrimitive: 'extrude' | 'revolve' | 'circle' | 'rectangle' | 'unknown';
}

/** A 3D primitive identified from a sketch loop */
export interface IdentifiedPrimitive {
  id: string;
  loopId: string;
  sketchId: string;
  kind: 'extrude' | 'revolve' | 'cylinder' | 'box' | 'cone' | 'unknown';
  parameters: {
    depth?: number;
    axis?: [number, number, number];
    angle?: number;
    radius?: number;
  };
  done: boolean;
}

export interface ModificationNote {
  id: string;
  type: 'dimension' | 'grip' | 'fixture' | 'insert' | 'cutout' | 'fillet' | 'other';
  description: string;
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
    format: 'step' | 'iges' | 'dxf' | 'json';
    triangles?: number;
    solids?: number;
    boundsMm?: number[];
  } | null;
  orientation: Orientation;
  orientationConfirmed: boolean;
  sketchPlanes: SketchPlane[];
  sketches: Sketch[];
  identifiedPrimitives: IdentifiedPrimitive[];
  modifications: ModificationNote[];
  reviewNotes: string;
  reviewComplete: boolean;
  targetCadTool: string;
  validated: boolean;
  validationNotes: string;
}

export type Stage = 0 | 1 | 2 | 3;
export type CameraView = 'iso' | 'front' | 'top' | 'right';

/** Drawing tool modes */
export type DrawTool = 'select' | 'line' | 'polyline' | 'circle3p' | 'arc3p' | 'spline' | 'pan';

export interface CadTool {
  id: string;
  name: string;
  description: string;
  platform: string;
  icon: string;
  bestFor: string[];
}
