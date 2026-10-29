import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { MeshPreview, RunManifest, Stage, CameraView, DrawTool, SketchElement, SketchPlane, Point2D } from '../types';
import { FLAT_FACE_COLORS } from '../cadTools';
import { projectToPlane, unprojectFromPlane, distanceToPlane, sampleElement } from '../utils/sketchGeometry';

interface ViewportProps {
  preview: MeshPreview | null;
  run: RunManifest;
  cameraView: CameraView;
  onCameraViewChange: (view: CameraView) => void;
  stage: Stage;
  flatFaceIndex: number;
  drawTool: DrawTool;
  activeSketchId: string | null;
  onAddSketchElement: (element: SketchElement) => void;
}

export function Viewport({
  preview, run, cameraView, onCameraViewChange, stage, flatFaceIndex,
  drawTool, activeSketchId, onAddSketchElement,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const overlayGroupRef = useRef<THREE.Group | null>(null);
  const axisGroupRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef(-0.65);
  const pitchRef = useRef(0.45);
  const zoomRef = useRef(1);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const animFrameRef = useRef<number>(0);
  const drawPointsRef = useRef<Point2D[]>([]);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const buildScene = useCallback(() => {
    if (!sceneRef.current || !preview) return;

    // Clear existing
    if (meshGroupRef.current) {
      sceneRef.current.remove(meshGroupRef.current);
      meshGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    if (overlayGroupRef.current) {
      sceneRef.current.remove(overlayGroupRef.current);
    }
    if (axisGroupRef.current) {
      sceneRef.current.remove(axisGroupRef.current);
    }

    const group = new THREE.Group();
    const orientation = run.orientation;
    const scale = orientation.scale;
    const rotRad = orientation.rotation.map(v => v * Math.PI / 180) as [number, number, number];

    group.rotation.set(rotRad[0], rotRad[1], rotRad[2]);
    group.scale.set(scale, scale, scale);

    const center = new THREE.Vector3(...preview.center);
    group.position.sub(center.multiplyScalar(scale));

    if (preview.preview.length > 0) {
      const flatRegions = stage === 0 ? (preview.flatRegions || []) : [];
      const faceColorMap = new Map<number, number>();
      flatRegions.forEach((region, regionIndex) => {
        region.previewIndices.forEach(triIdx => faceColorMap.set(triIdx, regionIndex));
      });

      const vertices: number[] = [];
      const normals: number[] = [];
      const colors: number[] = [];

      preview.preview.forEach((tri, triIdx) => {
        const a = new THREE.Vector3(...tri[0]);
        const b = new THREE.Vector3(...tri[1]);
        const c = new THREE.Vector3(...tri[2]);
        const ab = new THREE.Vector3().subVectors(b, a);
        const ac = new THREE.Vector3().subVectors(c, a);
        const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();

        vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);

        const regionIdx = faceColorMap.get(triIdx);
        if (regionIdx !== undefined) {
          const color = new THREE.Color(FLAT_FACE_COLORS[regionIdx % FLAT_FACE_COLORS.length]);
          if (regionIdx === flatFaceIndex) color.set('#239bff');
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
        } else {
          const light = Math.max(0.35, Math.min(1, 0.58 + Math.abs(normal.x * -0.45 + normal.y * 0.7 + normal.z * 0.55) * 0.5));
          const gray = (115 + 105 * light) / 255;
          colors.push(gray * 0.85, gray, Math.min(1, gray * 1.05));
          colors.push(gray * 0.85, gray, Math.min(1, gray * 1.05));
          colors.push(gray * 0.85, gray, Math.min(1, gray * 1.05));
        }
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.MeshPhongMaterial({ 
        vertexColors: true, 
        flatShading: true, 
        shininess: 20,
        side: THREE.DoubleSide // Render both sides of faces
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      meshRef.current = mesh;

      // Boundary edges overlay
      if (preview.boundaryEdges && preview.boundaryEdges.length > 0) {
        const edgeVertices: number[] = [];
        preview.boundaryEdges.forEach(edge => {
          edgeVertices.push(edge.a[0], edge.a[1], edge.a[2]);
          edgeVertices.push(edge.b[0], edge.b[1], edge.b[2]);
        });
        const edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 1, transparent: true, opacity: 0.8 });
        const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
        group.add(edgeLines);
      }
    }

    sceneRef.current.add(group);
    meshGroupRef.current = group;

    // Add world axes (fixed, not transformed)
    const axisLength = Math.max(preview.bounds[0], preview.bounds[1], preview.bounds[2]) * 0.6;
    const axisGroup = new THREE.Group();
    
    // X axis (red)
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(axisLength, 0, 0),
    ]);
    const xAxisMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
    axisGroup.add(new THREE.Line(xAxisGeo, xAxisMat));
    
    // X arrow head
    const xArrowGeo = new THREE.ConeGeometry(axisLength * 0.03, axisLength * 0.08, 8);
    const xArrowMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const xArrow = new THREE.Mesh(xArrowGeo, xArrowMat);
    xArrow.position.set(axisLength, 0, 0);
    xArrow.rotation.z = -Math.PI / 2;
    axisGroup.add(xArrow);
    
    // Y axis (green)
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, axisLength, 0),
    ]);
    const yAxisMat = new THREE.LineBasicMaterial({ color: 0x44ff44, linewidth: 2 });
    axisGroup.add(new THREE.Line(yAxisGeo, yAxisMat));
    
    // Y arrow head
    const yArrowGeo = new THREE.ConeGeometry(axisLength * 0.03, axisLength * 0.08, 8);
    const yArrowMat = new THREE.MeshBasicMaterial({ color: 0x44ff44 });
    const yArrow = new THREE.Mesh(yArrowGeo, yArrowMat);
    yArrow.position.set(0, axisLength, 0);
    axisGroup.add(yArrow);
    
    // Z axis (blue)
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, axisLength),
    ]);
    const zAxisMat = new THREE.LineBasicMaterial({ color: 0x4444ff, linewidth: 2 });
    axisGroup.add(new THREE.Line(zAxisGeo, zAxisMat));
    
    // Z arrow head
    const zArrowGeo = new THREE.ConeGeometry(axisLength * 0.03, axisLength * 0.08, 8);
    const zArrowMat = new THREE.MeshBasicMaterial({ color: 0x4444ff });
    const zArrow = new THREE.Mesh(zArrowGeo, zArrowMat);
    zArrow.position.set(0, 0, axisLength);
    zArrow.rotation.x = Math.PI / 2;
    axisGroup.add(zArrow);
    
    // Origin marker (yellow sphere)
    const originGeo = new THREE.SphereGeometry(axisLength * 0.04, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const originMarker = new THREE.Mesh(originGeo, originMat);
    originMarker.position.set(0, 0, 0);
    axisGroup.add(originMarker);
    
    // Center point marker (cyan sphere)
    const centerGeo = new THREE.SphereGeometry(axisLength * 0.03, 16, 16);
    const centerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
    const centerMarker = new THREE.Mesh(centerGeo, centerMat);
    centerMarker.position.set(preview.center[0], preview.center[1], preview.center[2]);
    axisGroup.add(centerMarker);
    
    // Center cross-hair lines
    const crossSize = axisLength * 0.08;
    const crossGeo1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(preview.center[0] - crossSize, preview.center[1], preview.center[2]),
      new THREE.Vector3(preview.center[0] + crossSize, preview.center[1], preview.center[2]),
    ]);
    const crossGeo2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(preview.center[0], preview.center[1] - crossSize, preview.center[2]),
      new THREE.Vector3(preview.center[0], preview.center[1] + crossSize, preview.center[2]),
    ]);
    const crossGeo3 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(preview.center[0], preview.center[1], preview.center[2] - crossSize),
      new THREE.Vector3(preview.center[0], preview.center[1], preview.center[2] + crossSize),
    ]);
    const crossMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.5 });
    axisGroup.add(new THREE.Line(crossGeo1, crossMat));
    axisGroup.add(new THREE.Line(crossGeo2, crossMat));
    axisGroup.add(new THREE.Line(crossGeo3, crossMat));
    
    sceneRef.current.add(axisGroup);
    axisGroupRef.current = axisGroup;

    // Build sketch overlay
    buildSketchOverlay();
  }, [preview, run.orientation, stage, flatFaceIndex, run.sketches, run.sketchPlanes]);

  const buildSketchOverlay = useCallback(() => {
    if (!sceneRef.current) return;

    if (overlayGroupRef.current) {
      sceneRef.current.remove(overlayGroupRef.current);
      overlayGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }

    const overlayGroup = new THREE.Group();
    const orientation = run.orientation;
    const scale = orientation.scale;
    const rotRad = orientation.rotation.map(v => v * Math.PI / 180) as [number, number, number];

    overlayGroup.rotation.set(rotRad[0], rotRad[1], rotRad[2]);
    overlayGroup.scale.set(scale, scale, scale);

    const center = new THREE.Vector3(...(preview?.center || [0, 0, 0]));
    overlayGroup.position.sub(center.multiplyScalar(scale));

    // Draw each sketch
    for (const sketch of run.sketches) {
      const plane = run.sketchPlanes.find(p => p.id === sketch.planeId);
      if (!plane) continue;

      const isActive = sketch.id === activeSketchId;
      const color = new THREE.Color(sketch.color);

      for (const element of sketch.elements) {
        const sampled = sampleElement(element, 32);
        if (sampled.length < 2) continue;

        const points3D = sampled.map(p2d => {
          const p3d = unprojectFromPlane(plane, p2d);
          return new THREE.Vector3(p3d[0], p3d[1], p3d[2]);
        });

        const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
        const material = new THREE.LineBasicMaterial({
          color: color,
          linewidth: isActive ? 3 : 2,
          transparent: true,
          opacity: isActive ? 1.0 : 0.7,
        });
        const line = new THREE.Line(geometry, material);
        overlayGroup.add(line);

        // Draw control points
        if (isActive) {
          const controlPoints = element.type === 'circle3p' || element.type === 'arc3p'
            ? element.points
            : element.type === 'line' ? [element.points[0], element.points[1]]
            : element.points;

          for (const cp of controlPoints) {
            const cp3d = unprojectFromPlane(plane, cp);
            const sphereGeo = new THREE.SphereGeometry(Math.max(0.3, (preview?.bounds[0] || 10) * 0.008), 8, 8);
            const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.set(cp3d[0], cp3d[1], cp3d[2]);
            overlayGroup.add(sphere);
          }
        }
      }
    }

    // Draw in-progress line
    if (drawPointsRef.current.length > 0 && activeSketchId) {
      const plane = run.sketchPlanes.find(p => p.id === run.sketches.find(s => s.id === activeSketchId)?.planeId);
      if (plane) {
        const points3D = drawPointsRef.current.map(p2d => {
          const p3d = unprojectFromPlane(plane, p2d);
          return new THREE.Vector3(p3d[0], p3d[1], p3d[2]);
        });
        if (points3D.length >= 2) {
          const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
          const material = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
          overlayGroup.add(new THREE.Line(geometry, material));
        }
        // Draw control points
        for (const p of points3D) {
          const sphereGeo = new THREE.SphereGeometry(Math.max(0.3, (preview?.bounds[0] || 10) * 0.01), 8, 8);
          const sphereMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          sphere.position.copy(p);
          overlayGroup.add(sphere);
        }
      }
    }

    sceneRef.current.add(overlayGroup);
    overlayGroupRef.current = overlayGroup;
  }, [run.sketches, run.sketchPlanes, activeSketchId, preview, run.orientation]);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171b1f);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x404050, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 80, 60);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0x4488aa, 0.3);
    backLight.position.set(-40, -20, -50);
    scene.add(backLight);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const distance = 100 / zoomRef.current;
      camera.position.x = distance * Math.cos(pitchRef.current) * Math.sin(yawRef.current);
      camera.position.y = distance * Math.sin(pitchRef.current);
      camera.position.z = distance * Math.cos(pitchRef.current) * Math.cos(yawRef.current);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => { buildScene(); }, [buildScene]);
  useEffect(() => { buildSketchOverlay(); }, [buildSketchOverlay]);

  useEffect(() => {
    switch (cameraView) {
      case 'iso': yawRef.current = -0.65; pitchRef.current = 0.45; break;
      case 'front': yawRef.current = 0; pitchRef.current = Math.PI / 2 - 0.02; break;
      case 'top': yawRef.current = 0; pitchRef.current = 1.5; break;
      case 'right': yawRef.current = Math.PI / 2; pitchRef.current = 0; break;
    }
  }, [cameraView]);

  // Get 3D point from mouse click via raycasting
  const getClickPoint3D = useCallback((e: React.PointerEvent): [number, number, number] | null => {
    if (!containerRef.current || !cameraRef.current || !meshRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(meshRef.current, false);
    if (intersects.length === 0) return null;
    const point = intersects[0].point;
    
    // The mesh is in a group with rotation, scale, and translation applied
    // We need to get the world position relative to the group's parent (scene)
    // Since the group has the transform, we need to inverse it
    const orientation = run.orientation;
    const scale = orientation.scale;
    const rotRad = orientation.rotation.map(v => v * Math.PI / 180) as [number, number, number];
    const center = new THREE.Vector3(...(preview?.center || [0, 0, 0]));
    
    // Start with the intersection point in world space
    const p = point.clone();
    
    // Undo the translation (center was subtracted and scaled)
    p.add(center.clone().multiplyScalar(scale));
    
    // Undo the scale
    p.divideScalar(scale);
    
    // Undo the rotation (apply in reverse order)
    p.applyAxisAngle(new THREE.Vector3(1, 0, 0), -rotRad[0]);
    p.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotRad[1]);
    p.applyAxisAngle(new THREE.Vector3(0, 0, 1), -rotRad[2]);
    
    return [p.x, p.y, p.z];
  }, [run.orientation, preview]);

  // Handle drawing clicks
  const handleViewportClick = useCallback((e: React.PointerEvent) => {
    if (drawTool === 'select' || drawTool === 'pan') return;
    if (!activeSketchId) return;

    const point3D = getClickPoint3D(e);
    if (!point3D) return;

    const activeSketch = run.sketches.find(s => s.id === activeSketchId);
    if (!activeSketch) return;
    const plane = run.sketchPlanes.find(p => p.id === activeSketch.planeId);
    if (!plane) return;

    // Check if point is close enough to the sketch plane
    // Use a more lenient tolerance - 10% of the largest dimension
    const dist = distanceToPlane(plane, point3D);
    const maxDim = Math.max(preview?.bounds[0] || 10, preview?.bounds[1] || 10, preview?.bounds[2] || 10);
    const tolerance = maxDim * 0.1; // 10% tolerance
    if (dist > tolerance) {
      console.log('Point too far from plane:', dist, 'tolerance:', tolerance);
      return;
    }

    const point2D = projectToPlane(plane, point3D);
    drawPointsRef.current.push(point2D);
    console.log('Added point:', point2D, 'total points:', drawPointsRef.current.length);

    // Auto-complete based on tool
    if (drawTool === 'line' && drawPointsRef.current.length === 2) {
      onAddSketchElement({
        id: crypto.randomUUID(),
        type: 'line',
        points: [drawPointsRef.current[0], drawPointsRef.current[1]],
      });
      drawPointsRef.current = [];
    } else if (drawTool === 'circle3p' && drawPointsRef.current.length === 3) {
      onAddSketchElement({
        id: crypto.randomUUID(),
        type: 'circle3p',
        points: [drawPointsRef.current[0], drawPointsRef.current[1], drawPointsRef.current[2]],
      });
      drawPointsRef.current = [];
    } else if (drawTool === 'arc3p' && drawPointsRef.current.length === 3) {
      onAddSketchElement({
        id: crypto.randomUUID(),
        type: 'arc3p',
        points: [drawPointsRef.current[0], drawPointsRef.current[1], drawPointsRef.current[2]],
      });
      drawPointsRef.current = [];
    }

    buildSketchOverlay();
  }, [drawTool, activeSketchId, run.sketches, run.sketchPlanes, getClickPoint3D, onAddSketchElement, preview, buildSketchOverlay]);

  // Finish polyline/spline on double-click or Enter
  const handleDoubleClick = useCallback(() => {
    if (drawTool === 'polyline' && drawPointsRef.current.length >= 2) {
      onAddSketchElement({
        id: crypto.randomUUID(),
        type: 'polyline',
        points: [...drawPointsRef.current],
        closed: false,
      });
      drawPointsRef.current = [];
      buildSketchOverlay();
    } else if (drawTool === 'spline' && drawPointsRef.current.length >= 2) {
      onAddSketchElement({
        id: crypto.randomUUID(),
        type: 'spline',
        points: [...drawPointsRef.current],
      });
      drawPointsRef.current = [];
      buildSketchOverlay();
    }
  }, [drawTool, onAddSketchElement, buildSketchOverlay]);

  // Keyboard handler for finishing polylines and undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Undo last point with Backspace or Ctrl+Z
      if ((e.key === 'Backspace' || (e.ctrlKey && e.key === 'z')) && drawPointsRef.current.length > 0) {
        e.preventDefault();
        drawPointsRef.current.pop();
        console.log('Undo point, remaining:', drawPointsRef.current.length);
        buildSketchOverlay();
        return;
      }
      
      if (e.key === 'Enter' || e.key === 'Escape') {
        if (e.key === 'Escape') {
          // Cancel drawing
          drawPointsRef.current = [];
          buildSketchOverlay();
          return;
        }
        
        if (drawTool === 'polyline' && drawPointsRef.current.length >= 2) {
          onAddSketchElement({
            id: crypto.randomUUID(),
            type: 'polyline',
            points: [...drawPointsRef.current],
            closed: true,
          });
          drawPointsRef.current = [];
          buildSketchOverlay();
        } else if (drawTool === 'spline' && drawPointsRef.current.length >= 2) {
          onAddSketchElement({
            id: crypto.randomUUID(),
            type: 'spline',
            points: [...drawPointsRef.current],
          });
          drawPointsRef.current = [];
          buildSketchOverlay();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawTool, onAddSketchElement, buildSketchOverlay]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (drawTool === 'select' || drawTool === 'pan' || drawTool === 'line' || drawTool === 'polyline' || drawTool === 'circle3p' || drawTool === 'arc3p' || drawTool === 'spline') {
      if (drawTool !== 'select' && drawTool !== 'pan') {
        handleViewportClick(e);
        return;
      }
    }
    dragRef.current = { x: e.clientX, y: e.clientY, yaw: yawRef.current, pitch: pitchRef.current };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [drawTool, handleViewportClick]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    yawRef.current = dragRef.current.yaw + (e.clientX - dragRef.current.x) * 0.009;
    pitchRef.current = Math.max(-1.5, Math.min(1.5, dragRef.current.pitch + (e.clientY - dragRef.current.y) * 0.009));
  }, []);

  const handlePointerUp = useCallback(() => { dragRef.current = null; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.3, Math.min(3, zoomRef.current * (e.deltaY > 0 ? 0.9 : 1.1)));
  }, []);

  const hasMesh = preview && preview.preview.length > 0;
  const unitLabel = run.orientation.units === 'unknown' ? 'src units' : run.orientation.units;
  const isDrawing = drawTool !== 'select' && drawTool !== 'pan';

  return (
    <section className="flex flex-col flex-1 min-w-0 bg-[#121518]">
      <div className="flex h-10 items-center justify-between px-3 border-b border-[#292e33] bg-[#20252a]">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden text-[#d3dade] text-[11px]">
          <span className="w-1.5 h-1.5 bg-[#56a4ff]" />
          <span className="truncate">{run.input?.name || 'No STL loaded'}</span>
        </div>
        <div className="flex gap-1 items-center">
          {(['iso', 'front', 'top'] as CameraView[]).map(view => (
            <button key={view} type="button" onClick={() => onCameraViewChange(view)}
              className={`px-2 py-1 border rounded-sm text-[10px] cursor-pointer ${
                cameraView === view ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#42494f] text-[#aeb8bd] bg-[#292f34] hover:text-white hover:border-[#68737b]'
              }`}>
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
          <button type="button" onClick={() => { zoomRef.current = 1; }}
            className="px-2 py-1 border border-[#42494f] rounded-sm text-[#aeb8bd] bg-[#292f34] text-[10px] cursor-pointer hover:text-white hover:border-[#68737b]">
            Fit
          </button>
        </div>
      </div>

      <div ref={containerRef}
        className={`relative flex-1 min-h-0 overflow-hidden ${isDrawing ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        style={{
          backgroundColor: '#171b1f',
          backgroundImage: 'linear-gradient(#252b3040 1px, transparent 1px), linear-gradient(90deg, #252b3040 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}>

        {!hasMesh && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-[#b4bdc2] pointer-events-none">
            <div className="grid w-[54px] h-[54px] place-items-center border border-[#495158] rounded-full text-[#70a6ed] text-[29px]">◇</div>
            <strong className="text-[14px] font-medium">Import an STL to begin</strong>
            <span className="text-[#7e898f] text-[11px]">Binary or ASCII STL files supported</span>
          </div>
        )}

        {/* Drawing mode indicator */}
        {isDrawing && activeSketchId && (
          <div className="absolute top-3 left-3 px-3 py-2 border border-[#00ff88] rounded-sm bg-[#002211ee] text-[#00ff88] text-[10px]">
            <div className="font-bold mb-1">DRAWING: {drawTool.toUpperCase()}</div>
            <div>Points: {drawPointsRef.current.length}</div>
            <div className="text-[#88ddaa] text-[9px] mt-1">
              {drawTool === 'line' && 'Click 2 points'}
              {(drawTool === 'circle3p' || drawTool === 'arc3p') && 'Click 3 points'}
              {(drawTool === 'polyline' || drawTool === 'spline') && 'Click points · Enter to close · Esc to cancel'}
            </div>
            {drawPointsRef.current.length > 0 && (
              <div className="text-[#ffaa44] text-[9px] mt-1">
                Backspace/Ctrl+Z to undo last point
              </div>
            )}
          </div>
        )}

        {/* View cube */}
        <div className="absolute top-4 right-4 grid grid-cols-2 gap-0.5 w-[72px] p-[3px] border border-[#4d5861] rounded bg-[#29323be8]">
          <button type="button" onClick={() => onCameraViewChange('top')}
            className={`col-span-2 min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${cameraView === 'top' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#35414a] hover:border-[#83b9e8] hover:text-white'}`}>TOP</button>
          <button type="button" onClick={() => onCameraViewChange('front')}
            className={`min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${cameraView === 'front' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#38536a] hover:border-[#83b9e8] hover:text-white'}`}>FRONT</button>
          <button type="button" onClick={() => onCameraViewChange('right')}
            className={`min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${cameraView === 'right' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#35414a] hover:border-[#83b9e8] hover:text-white'}`}>RIGHT</button>
        </div>

        {/* Edge legend */}
        {hasMesh && preview?.boundaryEdges && preview.boundaryEdges.length > 0 && (
          <div className="absolute bottom-3 right-3 p-2 border border-[#44515a] rounded-sm bg-[#22282dd9] text-[9px]">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#ffaa00]" />
              <span className="text-[#aab4ba]">Detected edges ({preview.boundaryEdges.length})</span>
            </div>
          </div>
        )}

        {/* Axis legend */}
        {hasMesh && preview && (
          <div className="absolute bottom-3 left-3 p-2 border border-[#44515a] rounded-sm bg-[#22282dd9] text-[9px]">
            <div className="text-[#aab4ba] font-bold tracking-[.8px] mb-1">COORDINATE SYSTEM ({unitLabel})</div>
            <div className="grid gap-1">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#ff4444]" />
                <span className="text-[#ff4444] font-bold">X</span>
                <span className="text-[#dae0e3]">{(preview.bounds[0] * run.orientation.scale).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#44ff44]" />
                <span className="text-[#44ff44] font-bold">Y</span>
                <span className="text-[#dae0e3]">{(preview.bounds[1] * run.orientation.scale).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#4444ff]" />
                <span className="text-[#4444ff] font-bold">Z</span>
                <span className="text-[#dae0e3]">{(preview.bounds[2] * run.orientation.scale).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-[#44515a]">
                <span className="w-2 h-2 rounded-full bg-[#ffff00]" />
                <span className="text-[#aab4ba]">Origin (0,0,0)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00ffff]" />
                <span className="text-[#aab4ba]">Center point</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex h-[29px] items-center justify-between gap-3 px-2.5 border-t border-[#333a40] text-[#8f9ba2] bg-[#20262b] text-[9px]">
        <div>
          {preview ? `${preview.vertices.toLocaleString()} vertices · ${preview.triangles.toLocaleString()} triangles · ${preview.flatRegions?.length || 0} flat regions · ${preview.boundaryEdges?.length || 0} edges` : 'Waiting for STL import'}
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>{run.sketches.reduce((sum, s) => sum + s.elements.length, 0)} sketch elements</span>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${preview?.triangles ? 'bg-[#67c38c]' : 'bg-[#758087]'}`} />
          <span>{run.orientation.units} · {run.orientation.scale.toFixed(4)}×</span>
        </div>
      </div>
    </section>
  );
}
