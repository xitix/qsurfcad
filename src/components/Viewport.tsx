import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { MeshPreview, RunManifest, Stage, CameraView } from '../types';
import { FLAT_FACE_COLORS } from '../cadTools';

interface ViewportProps {
  preview: MeshPreview | null;
  run: RunManifest;
  cameraView: CameraView;
  onCameraViewChange: (view: CameraView) => void;
  stage: Stage;
  flatFaceIndex: number;
}

export function Viewport({
  preview,
  run,
  cameraView,
  onCameraViewChange,
  stage,
  flatFaceIndex,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef(-0.65);
  const pitchRef = useRef(0.45);
  const zoomRef = useRef(1);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const animFrameRef = useRef<number>(0);
  const dimsRef = useRef<THREE.Group | null>(null);

  const buildMesh = useCallback(() => {
    if (!sceneRef.current || !preview) return;

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
    if (dimsRef.current) {
      sceneRef.current.remove(dimsRef.current);
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

      const material = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 20 });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);

      const wireMaterial = new THREE.MeshBasicMaterial({ color: 0x445566, wireframe: true, transparent: true, opacity: 0.06 });
      group.add(new THREE.Mesh(geometry.clone(), wireMaterial));
    }

    sceneRef.current.add(group);
    meshGroupRef.current = group;

    // Dimension lines (bounding box)
    if (stage >= 0 && preview) {
      const dimGroup = new THREE.Group();
      dimGroup.rotation.set(rotRad[0], rotRad[1], rotRad[2]);
      dimGroup.scale.set(scale, scale, scale);

      const [bx, by, bz] = preview.bounds;
      const [cx, cy, cz] = [0, 0, 0];
      const offset = Math.max(bx, by, bz) * 0.15;

      const lineMat = new THREE.LineBasicMaterial({ color: 0x56a4ff, transparent: true, opacity: 0.6 });
      
      // X dimension line
      const xLine = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-bx / 2, -by / 2 - offset, -bz / 2 - offset),
        new THREE.Vector3(bx / 2, -by / 2 - offset, -bz / 2 - offset),
      ]);
      dimGroup.add(new THREE.Line(xLine, lineMat));

      // Y dimension line
      const yLine = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-bx / 2 - offset, -by / 2, -bz / 2 - offset),
        new THREE.Vector3(-bx / 2 - offset, by / 2, -bz / 2 - offset),
      ]);
      dimGroup.add(new THREE.Line(yLine, lineMat.clone()));

      // Z dimension line
      const zLine = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-bx / 2 - offset, -by / 2 - offset, -bz / 2),
        new THREE.Vector3(-bx / 2 - offset, -by / 2 - offset, bz / 2),
      ]);
      dimGroup.add(new THREE.Line(zLine, lineMat.clone()));

      // Bounding box wireframe
      const boxGeo = new THREE.BoxGeometry(bx, by, bz);
      const boxEdges = new THREE.EdgesGeometry(boxGeo);
      const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x3a5570, transparent: true, opacity: 0.3 }));
      dimGroup.add(boxLine);

      sceneRef.current.add(dimGroup);
      dimsRef.current = dimGroup;
    }
  }, [preview, run.orientation, stage, flatFaceIndex]);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171b1f);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10000);
    camera.position.set(60, 45, 60);
    camera.lookAt(0, 0, 0);

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

  useEffect(() => { buildMesh(); }, [buildMesh]);

  useEffect(() => {
    switch (cameraView) {
      case 'iso': yawRef.current = -0.65; pitchRef.current = 0.45; break;
      case 'front': yawRef.current = 0; pitchRef.current = Math.PI / 2 - 0.02; break;
      case 'top': yawRef.current = 0; pitchRef.current = 1.5; break;
      case 'right': yawRef.current = Math.PI / 2; pitchRef.current = 0; break;
    }
  }, [cameraView]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, yaw: yawRef.current, pitch: pitchRef.current };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

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

  return (
    <section className="flex flex-col flex-1 min-w-0 bg-[#121518]">
      <div className="flex h-10 items-center justify-between px-3 border-b border-[#292e33] bg-[#20252a]">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden text-[#d3dade] text-[11px]">
          <span className="w-1.5 h-1.5 bg-[#56a4ff]" />
          <span className="truncate">{run.input?.name || 'No STL loaded'}</span>
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
            <div className="grid w-[54px] h-[54px] place-items-center border border-[#495158] rounded-full text-[#70a6ed] text-[29px]">◇</div>
            <strong className="text-[14px] font-medium">Import an STL to begin</strong>
            <span className="text-[#7e898f] text-[11px]">Binary or ASCII STL files supported</span>
          </div>
        )}

        {/* View cube */}
        <div className="absolute top-4 right-4 grid grid-cols-2 gap-0.5 w-[72px] p-[3px] border border-[#4d5861] rounded bg-[#29323be8]">
          <button type="button" onClick={() => onCameraViewChange('top')}
            className={`col-span-2 min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${
              cameraView === 'top' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#35414a] hover:border-[#83b9e8] hover:text-white'
            }`}>TOP</button>
          <button type="button" onClick={() => onCameraViewChange('front')}
            className={`min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${
              cameraView === 'front' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#38536a] hover:border-[#83b9e8] hover:text-white'
            }`}>FRONT</button>
          <button type="button" onClick={() => onCameraViewChange('right')}
            className={`min-h-5 py-0.5 px-1 border rounded-sm text-[7px] font-bold cursor-pointer ${
              cameraView === 'right' ? 'border-[#80bdf0] text-white bg-[#286da9]' : 'border-[#56636d] text-[#d7dfe3] bg-[#35414a] hover:border-[#83b9e8] hover:text-white'
            }`}>RIGHT</button>
        </div>

        {/* Dimensions overlay */}
        {hasMesh && preview && (
          <div className="absolute bottom-3 left-3 p-2 border border-[#44515a] rounded-sm bg-[#22282dd9] text-[9px]">
            <div className="text-[#aab4ba] font-bold tracking-[.8px] mb-1">DIMENSIONS ({unitLabel})</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[#56a4ff]">X</span>{' '}
                <span className="text-[#dae0e3] font-variant-numeric-tabular">{(preview.bounds[0] * run.orientation.scale).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[#6f9db1]">Y</span>{' '}
                <span className="text-[#dae0e3] font-variant-numeric-tabular">{(preview.bounds[1] * run.orientation.scale).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[#67c38c]">Z</span>{' '}
                <span className="text-[#dae0e3] font-variant-numeric-tabular">{(preview.bounds[2] * run.orientation.scale).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Object browser */}
        {hasMesh && (
          <div className="absolute top-4 right-[88px] w-[min(230px,38%)] p-2 border border-[#4a5259] rounded-sm bg-[#22282dd9] text-[10px]">
            <div className="flex justify-between mb-2 text-[#aab4ba] text-[9px] font-bold tracking-[.8px]">
              OBJECT BROWSER <span>•••</span>
            </div>
            <div className="flex justify-between gap-2 py-1 text-[#c9d1d5]">
              ▾ {run.input?.name || 'Source STL'}
              <small className="text-[#87939a] text-[9px]">{run.input ? 'STL' : 'not loaded'}</small>
            </div>
            <div className="flex justify-between gap-2 py-1 text-[#c9d1d5]">
              Flat regions
              <small className="text-[#87939a] text-[9px]">{preview?.flatRegions?.length || 0} detected</small>
            </div>
            <div className="flex justify-between gap-2 py-1 text-[#c9d1d5]">
              Modifications
              <small className="text-[#87939a] text-[9px]">{run.modifications.length} planned</small>
            </div>
            <div className="flex justify-between gap-2 py-1 text-[#c9d1d5]">
              STEP output
              <small className="text-[#87939a] text-[9px]">{run.export ? 'generated' : 'pending'}</small>
            </div>
          </div>
        )}
      </div>

      <div className="flex h-[29px] items-center justify-between gap-3 px-2.5 border-t border-[#333a40] text-[#8f9ba2] bg-[#20262b] text-[9px]">
        <div>
          {preview
            ? `${preview.vertices.toLocaleString()} vertices · ${preview.triangles.toLocaleString()} triangles · bounds ${(preview.bounds[0] * run.orientation.scale).toFixed(1)} × ${(preview.bounds[1] * run.orientation.scale).toFixed(1)} × ${(preview.bounds[2] * run.orientation.scale).toFixed(1)} ${unitLabel}`
            : 'Waiting for STL import'}
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>{preview?.triangles ? 'Mesh parsed' : 'No STL loaded'}</span>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${preview?.triangles ? 'bg-[#67c38c]' : 'bg-[#758087]'}`} />
          <span>{run.orientation.units === 'unknown' ? 'Scale unverified' : `${run.orientation.units} · ${run.orientation.scale.toFixed(4)}×`}</span>
        </div>
      </div>
    </section>
  );
}
