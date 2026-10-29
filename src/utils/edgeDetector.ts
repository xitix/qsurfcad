import { FlatRegion, BoundaryEdge } from '../types';

/**
 * Detect boundary edges of flat regions.
 * A boundary edge is an edge shared between a triangle in the flat region
 * and a triangle outside the flat region.
 */
export function detectBoundaryEdges(
  triangles: number[][][],
  flatRegions: FlatRegion[]
): BoundaryEdge[] {
  const edges: BoundaryEdge[] = [];

  // Build a map of edge -> triangle indices
  type EdgeData = { triIndices: number[]; a: [number, number, number]; b: [number, number, number] };
  const edgeMap = new Map<string, EdgeData>();

  for (let triIdx = 0; triIdx < triangles.length; triIdx++) {
    const tri = triangles[triIdx];
    const triEdges: [number[], number[]][] = [
      [tri[0], tri[1]],
      [tri[1], tri[2]],
      [tri[2], tri[0]],
    ];

    for (const [a, b] of triEdges) {
      const key = edgeKey(a, b);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          triIndices: [],
          a: [a[0], a[1], a[2]],
          b: [b[0], b[1], b[2]],
        });
      }
      edgeMap.get(key)!.triIndices.push(triIdx);
    }
  }

  // For each flat region, find edges that are on the boundary
  for (let regionIdx = 0; regionIdx < flatRegions.length; regionIdx++) {
    const region = flatRegions[regionIdx];
    const regionTriSet = new Set(region.previewIndices);

    // Check each edge in the map
    for (const [, edgeData] of edgeMap) {
      const { triIndices } = edgeData;

      // An edge is a boundary if it's shared by exactly one triangle in the region
      // and at least one triangle outside the region
      const inRegion = triIndices.filter(idx => regionTriSet.has(idx));
      const outRegion = triIndices.filter(idx => !regionTriSet.has(idx));

      if (inRegion.length === 1 && outRegion.length >= 1) {
        edges.push({
          a: edgeData.a,
          b: edgeData.b,
          regionIndex: regionIdx,
        });
      }
    }
  }

  return edges;
}

function edgeKey(a: number[], b: number[]): string {
  // Sort vertices to create a canonical key
  const [v1, v2] = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) || (a[0] === b[0] && a[1] === b[1] && a[2] < b[2])
    ? [a, b]
    : [b, a];
  return `${v1[0].toFixed(6)},${v1[1].toFixed(6)},${v1[2].toFixed(6)}|${v2[0].toFixed(6)},${v2[1].toFixed(6)},${v2[2].toFixed(6)}`;
}
