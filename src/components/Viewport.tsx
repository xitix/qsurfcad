import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { MeshPreview, RunManifest, Stage, CameraView } from '../types';
import { FLAT_FACE_COLORS } from '../workflows';

interface ViewportProps {
  preview: MeshPreview | null;
  run: RunManifest;
  cameraView: CameraView;
  onCameraViewChange: (view: CameraView) => void;
  stage: Stage;
  workflowId: string;
  flatFaceIndex: number;
  showCurvature: boolean;
  curvatureSensitivity: number;
}

export function Viewport({
  preview,
  run,
  cameraView,
  onCameraViewChange,
  stage,
  workflowId,
  flatFaceIndex,
  showCurvature,
  curvatureSensitivity,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.Group | null>(null);
  const curvatureLinesRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef(-0.65);
  const pitchRef = useRef(0.45);
  const zoomRef = useRef(1);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const animFrameRef = useRef<number>(0);

  const buildMesh = useCallback(() => {
    if (!sceneRef.current || !preview) return;

    // Clear existing mesh
    if (meshGroupRef.current) {
      sceneRef.current.remove(meshGroupRef.current);
      meshGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    if (curvatureLinesRef.current) {
      sceneRef.current.remove(curvatureLinesRef.current);
    }

    const group = new THREE.Group();
    const orientation = run.orientation;
    const scale = orientation.scale;
    const rotRad = orientation.rotation.map(v => v * Math.PI / 180) as [number, number, number];

    // Apply orientation transform
    group.rotation.set(rotRad[0], rotRad[1], rotRad[2]);
    group.scale.set(scale, scale, scale);

    // Center the mesh
    const center = new THREE.Vector3(...preview.center);
    group.position.sub(center.multiplyScalar(scale));

    if (preview.pointCloud && preview.points) {
      // Point cloud rendering
      const positions = new Float32Array(preview.points.length * 3);
      const colors = new Float32Array(preview.points.length * 3);
      
      preview.points.forEach((point, i) => {
        positions[i * 3] = point[0];
        positions[i * 3 + 1] = point[1];
        positions[i * 3 + 2] = point[2];
        
        const shade = 0.5 + (point[2] / (preview.bounds[2] || 1)) * 0.3;
        colors[i * 3] = shade * 0.7;
        colors[i * 3 + 1] = shade * 0.85;
        colors[i * 3 + 2] = shade;
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      group.add(points);
    } else if (preview.preview.length > 0) {
      // Triangle mesh rendering
      const flatRegions = stage === 0 ? (preview.flatRegions || []) : [];
      const faceColorMap = new Map<number, number>();
      
      flatRegions.forEach((region, regionIndex) => {
        region.previewIndices.forEach(triIdx => {
          faceColorMap.set(triIdx, regionIndex);
        });
      });

      // Build geometry from triangles
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
          if (regionIdx === flatFaceIndex) {
            color.set('#239bff');
          }
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
        } else {
          // Default gray with lighting-based shading
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
      });

      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);

      // Wireframe overlay
      const wireMaterial = new THREE.MeshBasicMaterial({
        color: 0x445566,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
      });
      const wireMesh = new THREE.Mesh(geometry.clone(), wireMaterial);
      group.add(wireMesh);
    }

    sceneRef.current.add(group);
    meshGroupRef.current = group;

    // Curvature traces for PLY workflow
    if (workflowId === 'ply-iges' && showCurvature && preview.curvatureTraces && stage === 1) {
      const lineGroup = new THREE.Group();
      lineGroup.rotation.set(rotRad[0], rotRad[1], rotRad[2]);
      lineGroup.scale.set(scale, scale, scale);
      lineGroup.position.sub(center.clone().multiplyScalar(scale));

      preview.curvatureTraces
        .filter(trace => trace.angle >= curvatureSensitivity)
        .forEach(trace => {
          const points = trace.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
          if (points.length < 2) return;
          
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({
            color: 0xff4358,
            linewidth: 2,
            transparent: true,
            opacity: 0.9,
          });
          const line = new THREE.Line(geometry, material);
          lineGroup.add(line);
        });

      sceneRef.current.add(lineGroup);
      curvatureLinesRef.current = lineGroup;
    }
  }, [preview, run.orientation, stage, workflowId, flatFaceIndex, showCurvature, curvatureSensitivity]);

  const buildGrid = useCallback(() => {
    if (!sceneRef.current) return;
    
    if (gridRef.current) {
      sceneRef.current.remove(gridRef.current);
    }

    const gridGroup = new THREE.Group();
    
    // Grid plane
    const gridSize = 80;
    const divisions = 10;
    const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x3a5570, 0x2a3a4a);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -(preview ? Math.max(...preview.bounds) * 0.6 : 40);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.3;
    gridGroup.add(gridHelper);

    // Axis lines
    const axisLength = gridSize * 0.4;
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, 0, 0),
      new THREE.Vector3(axisLength, 0, 0),
    ]);
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0),
    ]);
    const xAxis = new THREE.Line(xAxisGeo, new THREE.LineBasicMaterial({ color: 0x6fbde1, transparent: true, opacity: 0.4 }));
    const yAxis = new THREE.Line(yAxisGeo, new THREE.LineBasicMaterial({ color: 0x6f9db1, transparent: true, opacity: 0.3 }));
    gridGroup.add(xAxis, yAxis);

    sceneRef.current.add(gridGroup);
    gridRef.current = gridGroup;
  }, [preview]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171b1f);
    
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10000);
    camera.position.set(60, 45, 60);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 80, 60);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0x4488aa, 0.3);
    backLight.position.set(-40, -20, -50);
    scene.add(backLight);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      
      // Update camera position based on yaw/pitch
      const distance = 100 / zoomRef.current;
      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      
      camera.position.x = distance * Math.cos(pitch) * Math.sin(yaw);
      camera.position.y = distance * Math.sin(pitch);
      camera.position.z = distance * Math.cos(pitch) * Math.cos(yaw);
      camera.lookAt(0, 0, 0);
      
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Rebuild mesh when data changes
  useEffect(() => {
    buildMesh();
    buildGrid();
  }, [buildMesh, buildGrid]);

  // Handle camera view changes
  useEffect(() => {
    switch (cameraView) {
      case 'iso':
        yawRef.current = -0.65;
        pitchRef.current = 0.45;
        break;
      case 'front':
        yawRef.current = 0;
        pitchRef.current = Math.PI / 2 - 0.02;
        break;
      case 'top':
        yawRef.current = 0;
        pitchRef.current = Math.PI / 2 - 0.01;
        yawRef.current = 0;
        pitchRef.current = 1.5;
        break;
      case 'right':
        yawRef.current = Math.PI / 2;
        pitchRef.current = 0;
        break;
    }
  }, [cameraView]);

  // Mouse interaction handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw: yawRef.current,
      pitch: pitchRef.current,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    yawRef.current = dragRef.current.yaw + (e.clientX - dragRef.current.x) * 0.009;
    pitchRef.current = Math.max(-1.5, Math.min(1.5, dragRef.current.pitch + (e.clientY - dragRef.current.y) * 0.009));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.3, Math.min(3, zoomRef.current * (e.deltaY > 0 ? 0.9 : 1.1)));
  }, []);

  const hasMesh = preview && (preview.preview.length > 0 || (preview.points && preview.points.length > 0));

  const getPreviewBadgeText = () => {
    if (!hasMesh) return '';
    if (stage !== 0) return 'TRACE REVIEW · CURVATURE ESTIMATES';
    if (preview?.pointCloud) return 'POINT CLOUD · PREVIEW';
    if (preview?.points && preview.points.length > 0) return 'MESH + POINT CLOUD · PREVIEW';
    return 'SOURCE MESH · PREVIEW';
  };

  return (
    <section className="flex flex-col flex-1 min-w-0 bg-[#121518]">
      {/* Viewport toolbar */}
      <div className="flex h-10 items-center justify-between px-3 border-b border-[#292e33] bg-[#20252a]">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden text-[#d3dade] text-[11px]">
          <span className="w-1.5 h-1.5 bg-[#56a4ff]" />
          <span className="truncate">{run.input?.name || 'No mesh loaded'}</span>
        </div>
        <div className="flex gap-1 items-center">
          {(['iso', 'front', 'top'] as CameraView[]).map(view => (
            <button
              key={view}
              type="button"
              onClick={() => onCameraViewChange(view)}
              className={`px-2 py-1 border rounded-sm text-[10px] cursor-pointer ${
                cameraView === view
                  ? 'border-[#80bdf0] text-white bg-[#286da9]'
                  : 'border-[#42494f] text-[#aeb8bd] bg-[#292f34] hover:text-white hover:border-[#68737b]'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { zoomRef.current = 1; }}
            className="px-2 py-1 border border-[#42494f] rounded-sm text-[#aeb8bd] bg-[#292f34] text-[10px] cursor-pointer hover:text-white hover:border-[#68737b]"
          >
            Fit
          </button>
          <span className="ml-1 text-[#829098] text-[9px] hidden sm:inline">Drag to orbit · scroll to zoom</span>
        </div>
      </div>

      {/* 3D Viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          backgroundColor: '#171b1f',
          backgroundImage: 'linear-gradient(#252b3040 1px, transparent 1px), linear-gradient(90deg, #252b3040 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {!hasMesh && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-[#b4bdc2] pointer-events-none">
            <div className="grid w-[54px] h-[54px] place-items-center border border-[#495158] rounded-full text-[#70a6ed] text-[29px]">
              ◇
            </div>
            <strong className="text-[14px] font-medium">Import a mesh to begin</strong>
            <span className="text-[#7e898f] text-[11px]">STL for mesh-to-solid · PLY for scan guide curves</span>
          </div>
        )}

        {/* View cube */}
        <div className="absolute top-4 right-4 grid grid-cols-2 gap-0.5 w-[72px] p-[3px] border border-[#4d5861] rounded bg-[#29323be8]">
          <button
            type="button"
            onClick={() => onCameraViewChange('top')}
            className={`col-span-2 min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${
              cameraView === 'top' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#35414a] hover:border-[#83b9e8] hover:text-white'
            }`}
          >
            TOP
          </button>
          <button
            type="button"
            onClick={() => onCameraViewChange('front')}
            className={`min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${
              cameraView === 'front' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#38536a] hover:border-[#83b9e8] hover:text-white'
            }`}
          >
            FRONT
          </button>
          <button
            type="button"
            onClick={() => onCameraViewChange('right')}
            className={`min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${
              cameraView === 'right' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#35414a] hover:border-[#83b9e8] hover:text-white'
            }`}
          >
            RIGHT
          </button>
        </div>

        {/* Object browser */}
        <div className="absolute top-4 right-[88px] w-[min(230px,38%)] p-2 border border-[#4a5259] rounded-sm bg-[#22282dd9] text-[10px]">
          <div className="flex justify-between mb-2 text-[#aab4ba] text-[9px] font-bold tracking-[.8px]">
            OBJECT BROWSER <span>•••</span>
          </div>
          <div className="flex justify-between gap-2 py-1 text-[#c9d1d5]">
            ▾ {run.input?.name || 'Source mesh'}
            <small className="text-[#87939a] text-[9px]">{run.input ? workflowId === 'stl-step' ? 'STL' : 'PLY' : 'not loaded'}</small>
          </div>
          <div className="flex justify-between gap-2 py-1 text-[#c9d1d5]">
            Reference geometry
            <small className="text-[#87939a] text-[9px]">{workflowId === 'ply-iges' && run.export ? 'IGES attached' : 'none'}</small>
          </div>
          <div className="flex justify-between gap-2 py-1 text-[#c9d1d5]">
            {workflowId === 'stl-step' ? 'STEP output' : 'Guide curves'}
            <small className="text-[#87939a] text-[9px]">
              {run.export ? (run.export.generated ? 'generated' : 'attached') : 'not generated'}
            </small>
          </div>
        </div>

        {/* Preview badge */}
        {hasMesh && (
          <div className="absolute bottom-3 left-3 px-2 py-1 border border-[#44515a] rounded-sm text-[#b9c3c8] bg-[#22282dbb] text-[9px] tracking-[.7px]">
            {getPreviewBadgeText()}
          </div>
        )}
      </div>

      {/* Viewport footer */}
      <div className="flex h-[29px] items-center justify-between gap-3 px-2.5 border-t border-[#333a40] text-[#8f9ba2] bg-[#20262b] text-[9px]">
        <div>
          {preview
            ? `${preview.vertices.toLocaleString()} vertices · ${preview.triangles.toLocaleString()} facets · bounds ${preview.bounds.map(v => v.toFixed(1)).join(' × ')} ${run.orientation.units === 'unknown' ? 'source units' : 'mm'}`
            : 'Waiting for source mesh'}
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>{preview?.pointCloud ? 'Point cloud parsed' : preview?.triangles ? 'Facets parsed' : 'No mesh loaded'}</span>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${preview?.triangles || preview?.previewPoints ? 'bg-[#67c38c]' : 'bg-[#758087]'}`} />
          <span>{run.orientation.units === 'unknown' ? 'Scale unverified' : `${run.orientation.units} · ${run.orientation.scale.toFixed(4)}×`}</span>
        </div>
      </div>
    </section>
  );
}
