// OpenCASCADE.js - optional dependency
let OpenCascadeModule: any = null;

export interface BRepTopology {
  faces: BRepFace[];
  edges: BRepEdge[];
  vertices: BRepVertex[];
}

export interface BRepFace {
  id: number;
  type: 'plane' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'bspline' | 'unknown';
  vertices: number[][];
  triangles: number[][];
  normal?: [number, number, number];
}

export interface BRepEdge {
  id: number;
  type: 'line' | 'circle' | 'ellipse' | 'bspline' | 'unknown';
  points: number[][];
  startVertex?: number;
  endVertex?: number;
}

export interface BRepVertex {
  id: number;
  position: [number, number, number];
}

let occt: any = null;

export async function initOpenCascade(): Promise<void> {
  if (occt) return;
  
  if (!OpenCascadeModule) {
    try {
      console.log('Loading OpenCASCADE...');
      // @ts-ignore
      OpenCascadeModule = await import('opencascade.js');
    } catch (e) {
      throw new Error('OpenCASCADE.js not available - STEP import requires opencascade.js package');
    }
  }
  
  console.log('Initializing OpenCASCADE...');
  occt = await OpenCascadeModule.default();
  console.log('OpenCASCADE initialized');
}

export async function loadSTEP(fileContent: string): Promise<BRepTopology> {
  if (!occt) {
    await initOpenCascade();
  }

  try {
    console.log('Loading STEP file...');
    
    // Create STEP reader
    const reader = new occt.STEPControl_Reader();
    
    // Read STEP content
    const readStatus = reader.ReadStepContent(fileContent);
    if (readStatus !== occt.IFSelect_ReturnStatus.IFSelect_RetDone) {
      throw new Error('Failed to read STEP file');
    }

    // Transfer shapes
    reader.TransferRoots();
    const shape = reader.OneShape();

    // Extract topology
    const topology = extractTopology(shape);
    
    console.log('STEP file loaded successfully');
    console.log(`Faces: ${topology.faces.length}, Edges: ${topology.edges.length}, Vertices: ${topology.vertices.length}`);
    
    return topology;
  } catch (error) {
    console.error('Error loading STEP file:', error);
    throw error;
  }
}

function extractTopology(shape: any): BRepTopology {
  const faces: BRepFace[] = [];
  const edges: BRepEdge[] = [];
  const vertices: BRepVertex[] = [];

  // Extract faces
  const faceExplorer = new occt.TopExp_Explorer(shape, occt.TopAbs_ShapeEnum.TopAbs_FACE);
  let faceId = 0;
  
  while (faceExplorer.More()) {
    const face = faceExplorer.Current();
    const faceData = extractFace(face, faceId++);
    if (faceData) {
      faces.push(faceData);
    }
    faceExplorer.Next();
  }

  // Extract edges
  const edgeExplorer = new occt.TopExp_Explorer(shape, occt.TopAbs_ShapeEnum.TopAbs_EDGE);
  let edgeId = 0;
  
  while (edgeExplorer.More()) {
    const edge = edgeExplorer.Current();
    const edgeData = extractEdge(edge, edgeId++);
    if (edgeData) {
      edges.push(edgeData);
    }
    edgeExplorer.Next();
  }

  // Extract vertices
  const vertexExplorer = new occt.TopExp_Explorer(shape, occt.TopAbs_ShapeEnum.TopAbs_VERTEX);
  let vertexId = 0;
  
  while (vertexExplorer.More()) {
    const vertex = vertexExplorer.Current();
    const vertexData = extractVertex(vertex, vertexId++);
    if (vertexData) {
      vertices.push(vertexData);
    }
    vertexExplorer.Next();
  }

  return { faces, edges, vertices };
}

function extractFace(face: any, id: number): BRepFace | null {
  try {
    // Get surface type
    const surface = new occt.BRep_Tool().Surface(face);
    const surfaceType = surface.get().GeometryType();
    
    let type: BRepFace['type'] = 'unknown';
    let normal: [number, number, number] | undefined;
    
    if (surfaceType === occt.GeomAbs_SurfaceType.GeomAbs_Plane) {
      type = 'plane';
      const plane = new occt.Geom_Plane(surface.get());
      const axis = plane.Axis().Direction();
      normal = [axis.X(), axis.Y(), axis.Z()];
    } else if (surfaceType === occt.GeomAbs_SurfaceType.GeomAbs_Cylinder) {
      type = 'cylinder';
    } else if (surfaceType === occt.GeomAbs_SurfaceType.GeomAbs_Cone) {
      type = 'cone';
    } else if (surfaceType === occt.GeomAbs_SurfaceType.GeomAbs_Sphere) {
      type = 'sphere';
    } else if (surfaceType === occt.GeomAbs_SurfaceType.GeomAbs_Torus) {
      type = 'torus';
    } else if (surfaceType === occt.GeomAbs_SurfaceType.GeomAbs_BSplineSurface) {
      type = 'bspline';
    }

    // Tessellate face for visualization
    const tessellation = tessellateFace(face);
    
    return {
      id,
      type,
      vertices: tessellation.vertices,
      triangles: tessellation.triangles,
      normal
    };
  } catch (error) {
    console.error('Error extracting face:', error);
    return null;
  }
}

function extractEdge(edge: any, id: number): BRepEdge | null {
  try {
    // Get curve type
    const curve = new occt.BRep_Tool().Curve(edge);
    const curveType = curve.get().GeometryType();
    
    let type: BRepEdge['type'] = 'unknown';
    
    if (curveType === occt.GeomAbs_CurveType.GeomAbs_Line) {
      type = 'line';
    } else if (curveType === occt.GeomAbs_CurveType.GeomAbs_Circle) {
      type = 'circle';
    } else if (curveType === occt.GeomAbs_CurveType.GeomAbs_Ellipse) {
      type = 'ellipse';
    } else if (curveType === occt.GeomAbs_CurveType.GeomAbs_BSplineCurve) {
      type = 'bspline';
    }

    // Sample points along edge
    const points = sampleEdge(edge);
    
    // Get start and end vertices
    const firstVertex = new occt.TopExp().FirstVertex(edge);
    const lastVertex = new occt.TopExp().LastVertex(edge);
    
    return {
      id,
      type,
      points,
      startVertex: firstVertex ? getVertexId(firstVertex) : undefined,
      endVertex: lastVertex ? getVertexId(lastVertex) : undefined
    };
  } catch (error) {
    console.error('Error extracting edge:', error);
    return null;
  }
}

function extractVertex(vertex: any, id: number): BRepVertex | null {
  try {
    const point = new occt.BRep_Tool().Pnt(vertex);
    return {
      id,
      position: [point.X(), point.Y(), point.Z()]
    };
  } catch (error) {
    console.error('Error extracting vertex:', error);
    return null;
  }
}

function tessellateFace(face: any): { vertices: number[][], triangles: number[][] } {
  const mesh = new occt.BRepMesh_IncrementalMesh(face, 0.1, false, 0.5, false);
  mesh.Perform();
  
  const triangulation = new occt.BRep_Tool().Triangulation(face, new occt.TopLoc_Location());
  
  if (!triangulation.get()) {
    return { vertices: [], triangles: [] };
  }

  const vertices: number[][] = [];
  const triangles: number[][] = [];

  // Extract vertices
  const nodeCount = triangulation.get().NbNodes();
  for (let i = 1; i <= nodeCount; i++) {
    const node = triangulation.get().Node(i);
    vertices.push([node.X(), node.Y(), node.Z()]);
  }

  // Extract triangles
  const triangleCount = triangulation.get().NbTriangles();
  for (let i = 1; i <= triangleCount; i++) {
    const triangle = triangulation.get().Triangle(i);
    const n1 = triangle.Value(1) - 1; // Convert to 0-based index
    const n2 = triangle.Value(2) - 1;
    const n3 = triangle.Value(3) - 1;
    triangles.push([n1, n2, n3]);
  }

  return { vertices, triangles };
}

function sampleEdge(edge: any, numSamples: number = 20): number[][] {
  const curve = new occt.BRep_Tool().Curve(edge);
  const first = curve.get().FirstParameter();
  const last = curve.get().LastParameter();
  
  const points: number[][] = [];
  
  for (let i = 0; i <= numSamples; i++) {
    const t = first + (last - first) * (i / numSamples);
    const point = curve.get().Value(t);
    points.push([point.X(), point.Y(), point.Z()]);
  }
  
  return points;
}

function getVertexId(vertex: any): number {
  // This is a simplified implementation
  // In reality, you'd need to maintain a map of vertex objects to IDs
  return 0;
}

export function disposeOpenCascade(): void {
  if (occt) {
    occt = null;
  }
}
