/**
 * Primitive Detection using RANSAC-like algorithms
 * Detects planes, cylinders, circles, and other analytic surfaces from mesh data
 */

import * as THREE from 'three';
import { MeshPreview } from '../types';

export interface DetectedPrimitive {
  id: string;
  type: 'plane' | 'cylinder' | 'circle' | 'sphere' | 'cone';
  confidence: number; // 0-1
  supportCount: number; // number of triangles supporting this primitive
  parameters: any;
  triangles: number[]; // indices of supporting triangles
}

export interface PlanePrimitive {
  type: 'plane';
  normal: [number, number, number];
  point: [number, number, number]; // point on plane
  d: number; // plane equation: ax + by + cz + d = 0
}

export interface CylinderPrimitive {
  type: 'cylinder';
  axis: [number, number, number]; // direction
  point: [number, number, number]; // point on axis
  radius: number;
}

export interface CirclePrimitive {
  type: 'circle';
  center: [number, number, number];
  normal: [number, number, number];
  radius: number;
}

export interface SpherePrimitive {
  type: 'sphere';
  center: [number, number, number];
  radius: number;
}

/**
 * Detect all primitives in a mesh
 */
export function detectPrimitives(
  preview: MeshPreview,
  options: {
    distanceTolerance?: number;
    normalTolerance?: number;
    minSupport?: number;
    maxIterations?: number;
  } = {}
): DetectedPrimitive[] {
  const {
    distanceTolerance = 0.1, // 0.1mm
    normalTolerance = 5 * Math.PI / 180, // 5 degrees
    minSupport = 10,
    maxIterations = 1000,
  } = options;

  const primitives: DetectedPrimitive[] = [];
  const triangles = preview.preview;
  const usedTriangles = new Set<number>();

  // Calculate mesh bounds for relative tolerance
  const maxDim = Math.max(preview.bounds[0], preview.bounds[1], preview.bounds[2]);
  const relTolerance = distanceTolerance * maxDim * 0.01; // 1% of max dimension

  // 1. Detect planes using flat regions from mesh analysis
  if (preview.flatRegions) {
    preview.flatRegions.forEach((region, idx) => {
      if (region.previewFacets >= minSupport) {
        const plane: PlanePrimitive = {
          type: 'plane',
          normal: region.normal,
          point: region.center,
          d: -(region.normal[0] * region.center[0] + 
               region.normal[1] * region.center[1] + 
               region.normal[2] * region.center[2]),
        };

        primitives.push({
          id: `plane-${idx}`,
          type: 'plane',
          confidence: 0.95,
          supportCount: region.previewFacets,
          parameters: plane,
          triangles: region.previewIndices,
        });

        region.previewIndices.forEach(i => usedTriangles.add(i));
      }
    });
  }

  // 2. Detect circles on planes using boundary edges
  if (preview.boundaryEdges) {
    const circles = detectCirclesOnPlanes(
      preview.boundaryEdges,
      primitives.filter(p => p.type === 'plane').map(p => p.parameters as PlanePrimitive),
      relTolerance
    );

    circles.forEach((circle, idx) => {
      primitives.push({
        id: `circle-${idx}`,
        type: 'circle',
        confidence: 0.85,
        supportCount: 0, // TODO: count supporting edges
        parameters: circle,
        triangles: [],
      });
    });
  }

  // 3. Detect cylinders using RANSAC on remaining triangles
  const remainingTriangles = triangles
    .map((tri, idx) => ({ tri, idx }))
    .filter(({ idx }) => !usedTriangles.has(idx));

  if (remainingTriangles.length >= minSupport) {
    const cylinders = detectCylindersRANSAC(
      remainingTriangles.map(t => t.tri),
      relTolerance,
      normalTolerance,
      minSupport,
      maxIterations
    );

    cylinders.forEach((cyl, idx) => {
      primitives.push({
        id: `cylinder-${idx}`,
        type: 'cylinder',
        confidence: 0.8,
        supportCount: cyl.supportCount,
        parameters: cyl,
        triangles: cyl.triangleIndices,
      });
    });
  }

  return primitives;
}

/**
 * Detect circles on detected planes using boundary edges
 */
function detectCirclesOnPlanes(
  edges: { a: [number, number, number]; b: [number, number, number] }[],
  planes: PlanePrimitive[],
  tolerance: number
): CirclePrimitive[] {
  const circles: CirclePrimitive[] = [];

  // Group edges by plane
  for (const plane of planes) {
    const planeEdges = edges.filter(edge => {
      // Check if both endpoints are on the plane
      const distA = Math.abs(
        plane.normal[0] * edge.a[0] + 
        plane.normal[1] * edge.a[1] + 
        plane.normal[2] * edge.a[2] + 
        plane.d
      );
      const distB = Math.abs(
        plane.normal[0] * edge.b[0] + 
        plane.normal[1] * edge.b[1] + 
        plane.normal[2] * edge.b[2] + 
        plane.d
      );
      return distA < tolerance && distB < tolerance;
    });

    if (planeEdges.length < 3) continue;

    // Try to fit circles to edge loops
    const loops = findEdgeLoops(planeEdges, tolerance);

    for (const loop of loops) {
      if (loop.length < 3) continue;

      // Fit circle to loop points
      const circle = fitCircleToPoints(loop, plane.normal);
      if (circle) {
        circles.push(circle);
      }
    }
  }

  return circles;
}

/**
 * Find closed loops of edges
 */
function findEdgeLoops(
  edges: { a: [number, number, number]; b: [number, number, number] }[],
  tolerance: number
): [number, number, number][][] {
  const loops: [number, number, number][][] = [];
  const usedEdges = new Set<number>();

  for (let startIdx = 0; startIdx < edges.length; startIdx++) {
    if (usedEdges.has(startIdx)) continue;

    const loop: [number, number, number][] = [edges[startIdx].a];
    usedEdges.add(startIdx);
    let currentPoint = edges[startIdx].b;
    loop.push(currentPoint);

    // Try to close the loop
    let maxIterations = edges.length;
    while (maxIterations-- > 0) {
      // Find next edge
      let found = false;
      for (let i = 0; i < edges.length; i++) {
        if (usedEdges.has(i)) continue;

        const edge = edges[i];
        const distA = distance3D(currentPoint, edge.a);
        const distB = distance3D(currentPoint, edge.b);

        if (distA < tolerance) {
          usedEdges.add(i);
          currentPoint = edge.b;
          loop.push(currentPoint);
          found = true;
          break;
        } else if (distB < tolerance) {
          usedEdges.add(i);
          currentPoint = edge.a;
          loop.push(currentPoint);
          found = true;
          break;
        }
      }

      if (!found) break;

      // Check if loop is closed
      if (distance3D(currentPoint, loop[0]) < tolerance) {
        loops.push(loop);
        break;
      }
    }
  }

  return loops;
}

/**
 * Fit circle to 3D points using least squares
 */
function fitCircleToPoints(
  points: [number, number, number][],
  normal: [number, number, number]
): CirclePrimitive | null {
  if (points.length < 3) return null;

  // Project points to 2D plane
  const u = getPerpendicularVector(normal);
  const v = cross3D(normal, u);

  const points2D = points.map(p => {
    const rel = [p[0] - points[0][0], p[1] - points[0][1], p[2] - points[0][2]];
    return [dot3D(rel, u), dot3D(rel, v)] as [number, number];
  });

  // Fit circle in 2D using algebraic fit
  const n = points2D.length;
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumX3 = 0, sumY3 = 0;
  let sumXY = 0, sumX2Y = 0, sumXY2 = 0;

  for (const [x, y] of points2D) {
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
    sumX3 += x * x * x;
    sumY3 += y * y * y;
    sumXY += x * y;
    sumX2Y += x * x * y;
    sumXY2 += x * y * y;
  }

  // Solve linear system for circle parameters
  const A = n * sumX2 - sumX * sumX;
  const B = n * sumXY - sumX * sumY;
  const C = n * sumY2 - sumY * sumY;
  const D = 0.5 * (n * sumX2Y - sumX * sumY2 + n * sumX3 - sumX * sumX2);
  const E = 0.5 * (n * sumXY2 - sumY * sumX2 + n * sumY3 - sumY * sumY2);

  const det = A * C - B * B;
  if (Math.abs(det) < 1e-10) return null;

  const xc = (D * C - B * E) / det;
  const yc = (A * E - B * D) / det;

  // Calculate radius
  let sumR = 0;
  for (const [x, y] of points2D) {
    sumR += Math.sqrt((x - xc) ** 2 + (y - yc) ** 2);
  }
  const radius = sumR / n;

  // Convert center back to 3D
  const center3D: [number, number, number] = [
    points[0][0] + xc * u[0] + yc * v[0],
    points[0][1] + xc * u[1] + yc * v[1],
    points[0][2] + xc * u[2] + yc * v[2],
  ];

  return {
    type: 'circle',
    center: center3D,
    normal,
    radius,
  };
}

/**
 * Detect cylinders using RANSAC
 */
function detectCylindersRANSAC(
  triangles: number[][][],
  distanceTolerance: number,
  normalTolerance: number,
  minSupport: number,
  maxIterations: number
): (CylinderPrimitive & { supportCount: number; triangleIndices: number[] })[] {
  const cylinders: (CylinderPrimitive & { supportCount: number; triangleIndices: number[] })[] = [];

  // Extract triangle centers and normals
  const triangleData = triangles.map((tri, idx) => {
    const center = [
      (tri[0][0] + tri[1][0] + tri[2][0]) / 3,
      (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
      (tri[0][2] + tri[1][2] + tri[2][2]) / 3,
    ] as [number, number, number];

    const v1 = [tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]];
    const v2 = [tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]];
    const normal = normalize3D(cross3D(v1, v2));

    return { center, normal, idx };
  });

  for (let iter = 0; iter < maxIterations; iter++) {
    // Sample 3 random triangles
    const sample = sampleRandom(triangleData, 3);
    if (sample.length < 3) break;

    // Try to fit cylinder
    const cylinder = fitCylinderToTriangles(sample);
    if (!cylinder) continue;

    // Count inliers
    const inliers = triangleData.filter(t => {
      const dist = distanceToCylinderAxis(t.center, cylinder);
      const normalAngle = Math.acos(Math.abs(dot3D(t.normal, cylinder.axis)));
      return Math.abs(dist - cylinder.radius) < distanceTolerance && 
             normalAngle < normalTolerance;
    });

    if (inliers.length >= minSupport) {
      cylinders.push({
        ...cylinder,
        supportCount: inliers.length,
        triangleIndices: inliers.map(t => t.idx),
      });
    }
  }

  return cylinders;
}

/**
 * Fit cylinder to 3 triangles
 */
function fitCylinderToTriangles(
  triangles: { center: [number, number, number]; normal: [number, number, number] }[]
): CylinderPrimitive | null {
  if (triangles.length < 3) return null;

  // Estimate axis as average of normals (perpendicular to cylinder surface)
  const axis = normalize3D([
    triangles[0].normal[0] + triangles[1].normal[0] + triangles[2].normal[0],
    triangles[0].normal[1] + triangles[1].normal[1] + triangles[2].normal[1],
    triangles[0].normal[2] + triangles[1].normal[2] + triangles[2].normal[2],
  ]);

  // Estimate radius as average distance from centers to axis
  const point = triangles[0].center;
  let sumRadius = 0;
  for (const tri of triangles) {
    sumRadius += distanceToCylinderAxis(tri.center, { axis, point, radius: 0 });
  }
  const radius = sumRadius / triangles.length;

  return {
    type: 'cylinder',
    axis,
    point,
    radius,
  };
}

// Helper functions
function distance3D(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function dot3D(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3D(a: number[], b: number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3D(v: number[]): [number, number, number] {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  if (len < 1e-10) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function getPerpendicularVector(normal: [number, number, number]): [number, number, number] {
  const up = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize3D(cross3D(normal, up));
}

function distanceToCylinderAxis(
  point: [number, number, number],
  cylinder: { axis: [number, number, number]; point: [number, number, number]; radius?: number }
): number {
  const v = [
    point[0] - cylinder.point[0],
    point[1] - cylinder.point[1],
    point[2] - cylinder.point[2],
  ];
  const proj = dot3D(v, cylinder.axis);
  const closest = [
    cylinder.point[0] + proj * cylinder.axis[0],
    cylinder.point[1] + proj * cylinder.axis[1],
    cylinder.point[2] + proj * cylinder.axis[2],
  ];
  return distance3D(point, closest as [number, number, number]);
}

function sampleRandom<T>(arr: T[], n: number): T[] {
  const result: T[] = [];
  const indices = new Set<number>();
  while (result.length < n && indices.size < arr.length) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      result.push(arr[idx]);
    }
  }
  return result;
}
