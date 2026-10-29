import { BRepTopology, BRepVertex, BRepEdge, BRepFace } from './stepImporter';

export interface SnapTarget {
  type: 'vertex' | 'edge' | 'face' | 'center';
  position: [number, number, number];
  id: number;
  distance: number;
  normal?: [number, number, number];
}

export class SnapEngine {
  private topology: BRepTopology;
  private snapRadius: number;

  constructor(topology: BRepTopology, snapRadius: number = 0.5) {
    this.topology = topology;
    this.snapRadius = snapRadius;
  }

  /**
   * Find the nearest snap target to a given point
   */
  findSnapTarget(point: [number, number, number]): SnapTarget | null {
    const targets: SnapTarget[] = [];

    // Check vertices
    for (const vertex of this.topology.vertices) {
      const distance = this.distance(point, vertex.position);
      if (distance <= this.snapRadius) {
        targets.push({
          type: 'vertex',
          position: vertex.position,
          id: vertex.id,
          distance
        });
      }
    }

    // Check edges
    for (const edge of this.topology.edges) {
      const snapPoint = this.projectPointToEdge(point, edge);
      if (snapPoint) {
        const distance = this.distance(point, snapPoint);
        if (distance <= this.snapRadius) {
          targets.push({
            type: 'edge',
            position: snapPoint,
            id: edge.id,
            distance
          });
        }
      }
    }

    // Check face centers (for planar faces)
    for (const face of this.topology.faces) {
      if (face.type === 'plane' && face.normal) {
        const center = this.calculateFaceCenter(face);
        const distance = this.distance(point, center);
        if (distance <= this.snapRadius) {
          targets.push({
            type: 'center',
            position: center,
            id: face.id,
            distance,
            normal: face.normal
          });
        }
      }
    }

    // Return the closest target
    if (targets.length === 0) return null;
    
    targets.sort((a, b) => a.distance - b.distance);
    return targets[0];
  }

  /**
   * Get all snap targets within radius
   */
  getAllSnapTargets(point: [number, number, number]): SnapTarget[] {
    const targets: SnapTarget[] = [];

    // Vertices
    for (const vertex of this.topology.vertices) {
      const distance = this.distance(point, vertex.position);
      if (distance <= this.snapRadius) {
        targets.push({
          type: 'vertex',
          position: vertex.position,
          id: vertex.id,
          distance
        });
      }
    }

    // Edges
    for (const edge of this.topology.edges) {
      const snapPoint = this.projectPointToEdge(point, edge);
      if (snapPoint) {
        const distance = this.distance(point, snapPoint);
        if (distance <= this.snapRadius) {
          targets.push({
            type: 'edge',
            position: snapPoint,
            id: edge.id,
            distance
          });
        }
      }
    }

    // Face centers
    for (const face of this.topology.faces) {
      if (face.type === 'plane' && face.normal) {
        const center = this.calculateFaceCenter(face);
        const distance = this.distance(point, center);
        if (distance <= this.snapRadius) {
          targets.push({
            type: 'center',
            position: center,
            id: face.id,
            distance,
            normal: face.normal
          });
        }
      }
    }

    return targets.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Project a point onto an edge
   */
  private projectPointToEdge(point: [number, number, number], edge: BRepEdge): [number, number, number] | null {
    if (edge.points.length < 2) return null;

    // For line edges, use simple projection
    if (edge.type === 'line' && edge.points.length >= 2) {
      const start = edge.points[0];
      const end = edge.points[edge.points.length - 1];
      
      const v = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
      const w = [point[0] - start[0], point[1] - start[1], point[2] - start[2]];
      
      const c1 = this.dot(w, v);
      const c2 = this.dot(v, v);
      
      if (c2 === 0) return null;
      
      const t = Math.max(0, Math.min(1, c1 / c2));
      
      return [
        start[0] + t * v[0],
        start[1] + t * v[1],
        start[2] + t * v[2]
      ];
    }

    // For curved edges, find closest point on sampled curve
    let closestPoint: [number, number, number] | null = null;
    let minDist = Infinity;

    for (let i = 0; i < edge.points.length - 1; i++) {
      const p1 = edge.points[i];
      const p2 = edge.points[i + 1];
      
      const v = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
      const w = [point[0] - p1[0], point[1] - p1[1], point[2] - p1[2]];
      
      const c1 = this.dot(w, v);
      const c2 = this.dot(v, v);
      
      if (c2 === 0) continue;
      
      const t = Math.max(0, Math.min(1, c1 / c2));
      const proj: [number, number, number] = [
        p1[0] + t * v[0],
        p1[1] + t * v[1],
        p1[2] + t * v[2]
      ];
      
      const dist = this.distance(point, proj);
      if (dist < minDist) {
        minDist = dist;
        closestPoint = proj;
      }
    }

    return closestPoint;
  }

  /**
   * Calculate the center of a face
   */
  private calculateFaceCenter(face: BRepFace): [number, number, number] {
    if (face.vertices.length === 0) return [0, 0, 0];

    let sumX = 0, sumY = 0, sumZ = 0;
    for (const vertex of face.vertices) {
      sumX += vertex[0];
      sumY += vertex[1];
      sumZ += vertex[2];
    }

    const count = face.vertices.length;
    return [sumX / count, sumY / count, sumZ / count];
  }

  /**
   * Calculate distance between two points
   */
  private distance(a: [number, number, number], b: [number, number, number]): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Dot product of two vectors
   */
  private dot(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  /**
   * Update snap radius
   */
  setSnapRadius(radius: number): void {
    this.snapRadius = radius;
  }

  /**
   * Update topology
   */
  setTopology(topology: BRepTopology): void {
    this.topology = topology;
  }
}
