import * as THREE from 'three';

export interface SnapTarget {
  type: 'vertex' | 'edge' | 'face-center' | 'cylinder-axis';
  position: THREE.Vector3;
  normal?: THREE.Vector3;
  distance: number;
  confidence: number;
}

export interface SketchPoint {
  position: THREE.Vector3;
  snapped: boolean;
  snapTarget?: SnapTarget;
}

export interface Sketch {
  id: string;
  points: SketchPoint[];
  type: 'line' | 'arc' | 'circle' | 'polyline';
  fitted?: {
    type: 'line' | 'circle' | 'arc';
    parameters: any;
  };
}

export class MagicTraceEngine {
  private snapRadius: number = 0.5; // mm
  private edgeThreshold: number = 15; // degrees
  private mesh: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private geometry: THREE.BufferGeometry | null = null;

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  setMesh(mesh: THREE.Mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry as THREE.BufferGeometry;
  }

  setSnapRadius(radius: number) {
    this.snapRadius = radius;
  }

  /**
   * Find snap targets near a 3D point
   */
  findSnapTargets(point: THREE.Vector3, maxTargets: number = 5): SnapTarget[] {
    if (!this.geometry) return [];

    const targets: SnapTarget[] = [];
    const positions = this.geometry.attributes.position;
    const normals = this.geometry.attributes.normal;

    if (!positions || !normals) return [];

    // 1. Check vertices
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );

      const distance = point.distanceTo(vertex);
      if (distance <= this.snapRadius) {
        targets.push({
          type: 'vertex',
          position: vertex,
          distance,
          confidence: 1.0 - (distance / this.snapRadius)
        });
      }
    }

    // 2. Check edges (sharp edges based on normal difference)
    const edges = this.detectSharpEdges();
    for (const edge of edges) {
      const closestPoint = this.closestPointOnEdge(point, edge.start, edge.end);
      const distance = point.distanceTo(closestPoint);

      if (distance <= this.snapRadius) {
        targets.push({
          type: 'edge',
          position: closestPoint,
          normal: edge.normal,
          distance,
          confidence: 0.9 - (distance / this.snapRadius)
        });
      }
    }

    // 3. Check face centers
    const faces = this.detectFaces();
    for (const face of faces) {
      const distance = point.distanceTo(face.center);
      if (distance <= this.snapRadius * 2) {
        targets.push({
          type: 'face-center',
          position: face.center,
          normal: face.normal,
          distance,
          confidence: 0.7 - (distance / (this.snapRadius * 2))
        });
      }
    }

    // Sort by confidence and return top N
    return targets
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxTargets);
  }

  /**
   * Get the best snap target
   */
  getBestSnapTarget(point: THREE.Vector3): SnapTarget | null {
    const targets = this.findSnapTargets(point, 1);
    return targets.length > 0 ? targets[0] : null;
  }

  /**
   * Detect sharp edges (where normal changes significantly)
   */
  private detectSharpEdges(): Array<{ start: THREE.Vector3; end: THREE.Vector3; normal: THREE.Vector3 }> {
    if (!this.geometry) return [];

    const positions = this.geometry.attributes.position;
    const normals = this.geometry.attributes.normal;
    const edges: Array<{ start: THREE.Vector3; end: THREE.Vector3; normal: THREE.Vector3 }> = [];

    const threshold = Math.cos(this.edgeThreshold * Math.PI / 180);

    // For each triangle, check edges against neighbors
    for (let i = 0; i < positions.count; i += 3) {
      const v0 = new THREE.Vector3().fromBufferAttribute(positions, i);
      const v1 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      const v2 = new THREE.Vector3().fromBufferAttribute(positions, i + 2);

      const n0 = new THREE.Vector3().fromBufferAttribute(normals, i);
      const n1 = new THREE.Vector3().fromBufferAttribute(normals, i + 1);
      const n2 = new THREE.Vector3().fromBufferAttribute(normals, i + 2);

      // Check edge v0-v1
      if (n0.dot(n1) < threshold) {
        edges.push({
          start: v0,
          end: v1,
          normal: n0.clone().add(n1).normalize()
        });
      }

      // Check edge v1-v2
      if (n1.dot(n2) < threshold) {
        edges.push({
          start: v1,
          end: v2,
          normal: n1.clone().add(n2).normalize()
        });
      }

      // Check edge v2-v0
      if (n2.dot(n0) < threshold) {
        edges.push({
          start: v2,
          end: v0,
          normal: n2.clone().add(n0).normalize()
        });
      }
    }

    return edges;
  }

  /**
   * Detect faces and their centers
   */
  private detectFaces(): Array<{ center: THREE.Vector3; normal: THREE.Vector3 }> {
    if (!this.geometry) return [];

    const positions = this.geometry.attributes.position;
    const normals = this.geometry.attributes.normal;
    const faces: Array<{ center: THREE.Vector3; normal: THREE.Vector3 }> = [];

    // Group triangles by normal direction
    const faceGroups = new Map<string, THREE.Vector3[]>();

    for (let i = 0; i < positions.count; i += 3) {
      const v0 = new THREE.Vector3().fromBufferAttribute(positions, i);
      const v1 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      const v2 = new THREE.Vector3().fromBufferAttribute(positions, i + 2);

      const n0 = new THREE.Vector3().fromBufferAttribute(normals, i);

      // Quantize normal to group similar faces
      const key = `${Math.round(n0.x * 10)}_${Math.round(n0.y * 10)}_${Math.round(n0.z * 10)}`;

      if (!faceGroups.has(key)) {
        faceGroups.set(key, []);
      }

      const center = v0.clone().add(v1).add(v2).divideScalar(3);
      faceGroups.get(key)!.push(center);
    }

    // Calculate average center for each face group
    for (const [key, centers] of faceGroups.entries()) {
      if (centers.length >= 3) { // Only consider faces with at least 3 triangles
        const avgCenter = new THREE.Vector3();
        centers.forEach(c => avgCenter.add(c));
        avgCenter.divideScalar(centers.length);

        const [nx, ny, nz] = key.split('_').map(Number);
        const normal = new THREE.Vector3(nx, ny, nz).normalize();

        faces.push({ center: avgCenter, normal });
      }
    }

    return faces;
  }

  /**
   * Find closest point on an edge to a given point
   */
  private closestPointOnEdge(point: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3 {
    const edge = end.clone().sub(start);
    const pointToStart = point.clone().sub(start);

    const t = pointToStart.dot(edge) / edge.lengthSq();
    const clampedT = Math.max(0, Math.min(1, t));

    return start.clone().add(edge.multiplyScalar(clampedT));
  }

  /**
   * Fit a sketch to geometric primitives
   */
  fitSketch(sketch: Sketch): Sketch {
    if (sketch.points.length < 2) return sketch;

    const positions = sketch.points.map(p => p.position);

    // Try to fit line
    if (sketch.type === 'line' || sketch.type === 'polyline') {
      const lineFit = this.fitLine(positions);
      if (lineFit.confidence > 0.9) {
        return {
          ...sketch,
          fitted: {
            type: 'line',
            parameters: lineFit
          }
        };
      }
    }

    // Try to fit circle
    if (sketch.type === 'circle' || sketch.type === 'arc') {
      const circleFit = this.fitCircle(positions);
      if (circleFit.confidence > 0.8) {
        return {
          ...sketch,
          fitted: {
            type: sketch.type === 'circle' ? 'circle' : 'arc',
            parameters: circleFit
          }
        };
      }
    }

    return sketch;
  }

  /**
   * Least squares line fitting
   */
  private fitLine(points: THREE.Vector3[]): any {
    if (points.length < 2) return { confidence: 0 };

    // Calculate centroid
    const centroid = new THREE.Vector3();
    points.forEach(p => centroid.add(p));
    centroid.divideScalar(points.length);

    // Calculate direction using PCA (simplified)
    let maxVariance = 0;
    let direction = new THREE.Vector3(1, 0, 0);

    // Try principal axes
    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];

    for (const axis of axes) {
      let variance = 0;
      for (const point of points) {
        const projected = point.clone().sub(centroid).dot(axis);
        variance += projected * projected;
      }
      if (variance > maxVariance) {
        maxVariance = variance;
        direction = axis.clone();
      }
    }

    // Calculate fit quality
    let totalError = 0;
    for (const point of points) {
      const projected = centroid.clone().add(
        direction.clone().multiplyScalar(point.clone().sub(centroid).dot(direction))
      );
      totalError += point.distanceTo(projected);
    }

    const avgError = totalError / points.length;
    const confidence = Math.max(0, 1 - avgError / this.snapRadius);

    return {
      start: centroid.clone().sub(direction.clone().multiplyScalar(maxVariance / 2)),
      end: centroid.clone().add(direction.clone().multiplyScalar(maxVariance / 2)),
      direction,
      confidence
    };
  }

  /**
   * Least squares circle fitting
   */
  private fitCircle(points: THREE.Vector3[]): any {
    if (points.length < 3) return { confidence: 0 };

    // Simplified circle fitting using 3 points
    const p1 = points[0];
    const p2 = points[Math.floor(points.length / 2)];
    const p3 = points[points.length - 1];

    // Calculate circumcenter
    const a = p1.clone().sub(p2);
    const b = p3.clone().sub(p2);
    const c = a.clone().cross(b);

    if (c.lengthSq() < 1e-10) return { confidence: 0 };

    const center = p2.clone().add(
      b.clone().multiplyScalar(a.lengthSq()).sub(a.clone().multiplyScalar(b.lengthSq()))
        .cross(c).divideScalar(2 * c.lengthSq())
    );

    const radius = center.distanceTo(p1);

    // Calculate fit quality
    let totalError = 0;
    for (const point of points) {
      const dist = center.distanceTo(point);
      totalError += Math.abs(dist - radius);
    }

    const avgError = totalError / points.length;
    const confidence = Math.max(0, 1 - avgError / this.snapRadius);

    // Calculate normal (perpendicular to plane)
    const normal = a.clone().cross(b).normalize();

    return {
      center,
      radius,
      normal,
      confidence
    };
  }
}
