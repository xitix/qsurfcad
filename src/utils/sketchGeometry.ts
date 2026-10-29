import { SketchPlane, Point2D, SketchElement, SketchLoop } from '../types';

/**
 * Create a 2D coordinate frame on a flat face.
 * The frame is defined by an origin point and two orthogonal axes (u, v) in the plane.
 */
export function createSketchPlane(
  flatRegionIndex: number,
  normal: [number, number, number],
  center: [number, number, number],
  label: string
): SketchPlane {
  // Create u-axis perpendicular to normal
  // Choose the world axis most perpendicular to the normal
  const absNormal = [Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2])];
  let worldAxis: [number, number, number];
  if (absNormal[0] <= absNormal[1] && absNormal[0] <= absNormal[2]) {
    worldAxis = [1, 0, 0];
  } else if (absNormal[1] <= absNormal[2]) {
    worldAxis = [0, 1, 0];
  } else {
    worldAxis = [0, 0, 1];
  }

  // u = normalize(worldAxis - (worldAxis · normal) * normal)
  const dot = worldAxis[0] * normal[0] + worldAxis[1] * normal[1] + worldAxis[2] * normal[2];
  const uAxis: [number, number, number] = normalize([
    worldAxis[0] - dot * normal[0],
    worldAxis[1] - dot * normal[1],
    worldAxis[2] - dot * normal[2],
  ]);

  // v = normal × u
  const vAxis: [number, number, number] = cross(normal, uAxis);

  return {
    id: crypto.randomUUID(),
    flatRegionIndex,
    origin: center,
    uAxis,
    vAxis,
    normal,
    label,
  };
}

/** Project a 3D point onto a sketch plane, returning 2D coordinates */
export function projectToPlane(plane: SketchPlane, point3D: [number, number, number]): Point2D {
  const dx = point3D[0] - plane.origin[0];
  const dy = point3D[1] - plane.origin[1];
  const dz = point3D[2] - plane.origin[2];

  const u = dx * plane.uAxis[0] + dy * plane.uAxis[1] + dz * plane.uAxis[2];
  const v = dx * plane.vAxis[0] + dy * plane.vAxis[1] + dz * plane.vAxis[2];

  return [u, v];
}

/** Unproject a 2D point from a sketch plane back to 3D */
export function unprojectFromPlane(plane: SketchPlane, point2D: Point2D): [number, number, number] {
  return [
    plane.origin[0] + point2D[0] * plane.uAxis[0] + point2D[1] * plane.vAxis[0],
    plane.origin[1] + point2D[0] * plane.uAxis[1] + point2D[1] * plane.vAxis[1],
    plane.origin[2] + point2D[0] * plane.uAxis[2] + point2D[1] * plane.vAxis[2],
  ];
}

/** Get the distance from a 3D point to a sketch plane */
export function distanceToPlane(plane: SketchPlane, point3D: [number, number, number]): number {
  const dx = point3D[0] - plane.origin[0];
  const dy = point3D[1] - plane.origin[1];
  const dz = point3D[2] - plane.origin[2];
  return Math.abs(dx * plane.normal[0] + dy * plane.normal[1] + dz * plane.normal[2]);
}

/** Circle from 3 points (2D) */
export function circleFrom3Points(p1: Point2D, p2: Point2D, p3: Point2D): { center: Point2D; radius: number } | null {
  const ax = p1[0], ay = p1[1];
  const bx = p2[0], by = p2[1];
  const cx = p3[0], cy = p3[1];

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const center: Point2D = [ux, uy];
  const radius = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);

  return { center, radius };
}

/** Compute the signed area of a polygon (2D) */
export function polygonArea(points: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return Math.abs(area) / 2;
}

/** Compute the perimeter of a polygon (2D) */
export function polygonPerimeter(points: Point2D[]): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    perimeter += Math.sqrt((points[j][0] - points[i][0]) ** 2 + (points[j][1] - points[i][1]) ** 2);
  }
  return perimeter;
}

/** Sample points along a sketch element for rendering */
export function sampleElement(element: SketchElement, segments: number = 32): Point2D[] {
  switch (element.type) {
    case 'line':
      return element.points;

    case 'polyline':
      return element.points;

    case 'circle3p': {
      const circle = circleFrom3Points(element.points[0], element.points[1], element.points[2]);
      if (!circle) return [];
      const pts: Point2D[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        pts.push([
          circle.center[0] + circle.radius * Math.cos(t),
          circle.center[1] + circle.radius * Math.sin(t),
        ]);
      }
      return pts;
    }

    case 'arc3p': {
      const circle = circleFrom3Points(element.points[0], element.points[1], element.points[2]);
      if (!circle) return element.points;
      // Compute angles
      const a1 = Math.atan2(element.points[0][1] - circle.center[1], element.points[0][0] - circle.center[0]);
      const a2 = Math.atan2(element.points[2][1] - circle.center[1], element.points[2][0] - circle.center[0]);
      let startAngle = a1;
      let endAngle = a2;
      // Ensure we go through the middle point
      const midAngle = Math.atan2(element.points[1][1] - circle.center[1], element.points[1][0] - circle.center[0]);
      // Adjust angles so the arc goes through the middle point
      if (endAngle < startAngle) endAngle += Math.PI * 2;
      if (midAngle < startAngle) {
        // Check if we need to wrap
        if (midAngle + Math.PI * 2 < endAngle) endAngle -= Math.PI * 2;
      }
      const pts: Point2D[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = startAngle + (i / segments) * (endAngle - startAngle);
        pts.push([
          circle.center[0] + circle.radius * Math.cos(t),
          circle.center[1] + circle.radius * Math.sin(t),
        ]);
      }
      return pts;
    }

    case 'spline': {
      // Catmull-Rom spline interpolation
      if (element.points.length < 2) return element.points;
      if (element.points.length === 2) return element.points;
      const pts: Point2D[] = [];
      const points = element.points;
      const perSegment = Math.max(2, Math.floor(segments / (points.length - 1)));
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let j = 0; j < perSegment; j++) {
          const t = j / perSegment;
          const t2 = t * t;
          const t3 = t2 * t;
          const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
          const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
          pts.push([x, y]);
        }
      }
      pts.push(points[points.length - 1]);
      return pts;
    }
  }
}

/** Detect closed loops from sketch elements on a plane */
export function detectClosedLoops(elements: SketchElement[]): SketchLoop[] {
  const loops: SketchLoop[] = [];

  // Find closed polylines
  for (const el of elements) {
    if (el.type === 'polyline' && el.closed && el.points.length >= 3) {
      loops.push({
        id: crypto.randomUUID(),
        sketchId: '',
        points3D: [],
        points2D: el.points,
        area: polygonArea(el.points),
        perimeter: polygonPerimeter(el.points),
        suggestedPrimitive: suggestPrimitive(el.points),
      });
    }
  }

  // Find closed circles
  for (const el of elements) {
    if (el.type === 'circle3p') {
      const circle = circleFrom3Points(el.points[0], el.points[1], el.points[2]);
      if (circle) {
        const pts: Point2D[] = [];
        for (let i = 0; i < 32; i++) {
          const t = (i / 32) * Math.PI * 2;
          pts.push([circle.center[0] + circle.radius * Math.cos(t), circle.center[1] + circle.radius * Math.sin(t)]);
        }
        loops.push({
          id: crypto.randomUUID(),
          sketchId: '',
          points3D: [],
          points2D: pts,
          area: Math.PI * circle.radius * circle.radius,
          perimeter: 2 * Math.PI * circle.radius,
          suggestedPrimitive: 'circle',
        });
      }
    }
  }

  return loops;
}

function suggestPrimitive(points: Point2D[]): 'extrude' | 'revolve' | 'circle' | 'rectangle' | 'unknown' {
  if (points.length < 3) return 'unknown';
  
  // Check if it's approximately a rectangle
  if (points.length === 4) {
    const angles: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = points[i];
      const b = points[(i + 1) % 4];
      const c = points[(i + 2) % 4];
      const ab = [b[0] - a[0], b[1] - a[1]];
      const bc = [c[0] - b[0], c[1] - b[1]];
      const dot = ab[0] * bc[0] + ab[1] * bc[1];
      const magAB = Math.sqrt(ab[0] ** 2 + ab[1] ** 2);
      const magBC = Math.sqrt(bc[0] ** 2 + bc[1] ** 2);
      if (magAB > 0 && magBC > 0) {
        angles.push(Math.abs(dot / (magAB * magBC)));
      }
    }
    if (angles.length === 4 && angles.every(a => Math.abs(a) < 0.1)) {
      return 'rectangle';
    }
  }

  return 'extrude';
}

// Vector math helpers
function normalize(v: number[]): [number, number, number] {
  const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (mag < 1e-10) return [0, 0, 0];
  return [v[0] / mag, v[1] / mag, v[2] / mag];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
