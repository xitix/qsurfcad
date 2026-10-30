import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { MagicTraceEngine, Sketch, SketchPoint, SnapTarget } from '../utils/MagicTraceEngine';
import './Viewport.css';

interface ViewportProps {
  mesh: any;
  sketches: Sketch[];
  activeTool: 'select' | 'magic-trace' | 'draw-line' | 'draw-arc' | 'draw-circle';
  magicTrace: MagicTraceEngine;
  onSnap: (info: { type: string; position: [number, number, number] } | null) => void;
  onSketchComplete: (sketch: Sketch) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  mesh,
  sketches,
  activeTool,
  magicTrace,
  onSnap,
  onSketchComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const [currentSketch, setCurrentSketch] = useState<SketchPoint[]>([]);
  const [wireframeMode, setWireframeMode] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(50, 50, 50);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(100, 10);
    scene.add(gridHelper);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Load STL file
  useEffect(() => {
    if (!mesh || !sceneRef.current) return;

    const loader = new STLLoader();
    const reader = new FileReader();

    reader.onload = (e) => {
      const geometry = loader.parse(e.target?.result as ArrayBuffer);
      const material = new THREE.MeshPhongMaterial({
        color: 0x888888,
        specular: 0x111111,
        shininess: 200,
        wireframe: wireframeMode
      });

      const meshObj = new THREE.Mesh(geometry, material);
      meshObj.scale.set(1, 1, 1);
      meshObj.position.set(0, 0, 0);

      // Center the mesh
      geometry.computeBoundingBox();
      geometry.center();

      sceneRef.current!.add(meshObj);
      meshRef.current = meshObj;

      // Set mesh for MagicTrace
      magicTrace.setMesh(meshObj);

      // Fit camera to mesh
      if (cameraRef.current && controlsRef.current) {
        const box = new THREE.Box3().setFromObject(meshObj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        cameraRef.current.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    };

    reader.readAsArrayBuffer(mesh);
  }, [mesh, wireframeMode, magicTrace]);

  // Handle mouse move for snapping
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !meshRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const snapTarget = magicTrace.getBestSnapTarget(point);

      if (snapTarget) {
        onSnap({
          type: snapTarget.type,
          position: [snapTarget.position.x, snapTarget.position.y, snapTarget.position.z]
        });
      } else {
        onSnap(null);
      }
    }
  };

  // Handle click for drawing
  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !meshRef.current) return;
    if (activeTool === 'select') return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      let point = intersects[0].point;
      let snapped = false;
      let snapTarget: SnapTarget | undefined;

      // Try to snap
      const target = magicTrace.getBestSnapTarget(point);
      if (target) {
        point = target.position;
        snapped = true;
        snapTarget = target;
      }

      const newPoint: SketchPoint = {
        position: point,
        snapped,
        snapTarget
      };

      const newSketch = [...currentSketch, newPoint];
      setCurrentSketch(newSketch);

      // Check if sketch is complete
      const isComplete = 
        (activeTool === 'draw-line' && newSketch.length === 2) ||
        (activeTool === 'draw-circle' && newSketch.length === 3) ||
        (activeTool === 'draw-arc' && newSketch.length === 3);

      if (isComplete) {
        const sketch: Sketch = {
          id: Date.now().toString(),
          points: newSketch,
          type: activeTool === 'draw-line' ? 'line' :
                activeTool === 'draw-circle' ? 'circle' :
                activeTool === 'draw-arc' ? 'arc' : 'polyline'
        };

        // Fit sketch to geometric primitive
        const fittedSketch = magicTrace.fitSketch(sketch);
        onSketchComplete(fittedSketch);
        setCurrentSketch([]);
      }
    }
  };

  // Render sketches
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove old sketch lines
    const oldLines = sceneRef.current.children.filter(
      child => child.userData.type === 'sketch'
    );
    oldLines.forEach(line => sceneRef.current!.remove(line));

    // Render completed sketches
    sketches.forEach(sketch => {
      const points = sketch.points.map(p => p.position);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
      const line = new THREE.Line(geometry, material);
      line.userData.type = 'sketch';
      sceneRef.current!.add(line);
    });

    // Render current sketch
    if (currentSketch.length > 0) {
      const points = currentSketch.map(p => p.position);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
      const line = new THREE.Line(geometry, material);
      line.userData.type = 'sketch';
      sceneRef.current!.add(line);
    }
  }, [sketches, currentSketch]);

  return (
    <div className="viewport">
      <div
        ref={containerRef}
        className="viewport-canvas"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
      <div className="viewport-controls">
        <button
          className={`control-button ${wireframeMode ? 'active' : ''}`}
          onClick={() => setWireframeMode(!wireframeMode)}
        >
          {wireframeMode ? '🔲 Solid' : '🔳 Wireframe'}
        </button>
      </div>
    </div>
  );
};
