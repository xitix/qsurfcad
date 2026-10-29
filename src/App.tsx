import { useState, useCallback, useEffect } from 'react';
import { RunManifest, Stage, MeshPreview, CameraView, DrawTool, Sketch, SketchElement, SketchPlane, ModificationNote } from './types';
import { STAGE_INFO } from './cadTools';
import { TopBar } from './components/TopBar';
import { WorkflowRail } from './components/WorkflowRail';
import { Viewport } from './components/Viewport';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { parseSTL } from './utils/stlParser';
import { detectBoundaryEdges } from './utils/edgeDetector';
import { createSketchPlane } from './utils/sketchGeometry';
import { downloadDXF } from './utils/dxfExport';
import { downloadSTL } from './utils/stlExport';
import { detectPrimitives } from './utils/primitiveDetection';
import { downloadSTEP } from './utils/stepExport';
import type { BRepTopology } from './utils/stepImporter';
import { SnapEngine } from './utils/snapEngine';
import { ConstraintSolver } from './utils/constraintSolver';

function createInitialRun(): RunManifest {
  return {
    id: crypto.randomUUID().replace(/-/g, ''),
    createdAt: new Date().toISOString(),
    projectName: 'New Project',
    input: null,
    export: null,
    orientation: { rotation: [0, 0, 0], scale: 1.0, units: 'mm' },
    orientationConfirmed: false,
    sketchPlanes: [],
    sketches: [],
    identifiedPrimitives: [],
    modifications: [],
    reviewNotes: '',
    reviewComplete: false,
    targetCadTool: 'freecad',
    validated: false,
    validationNotes: '',
  };
}

function stageForRun(run: RunManifest): Stage {
  if (!run.orientationConfirmed) return 0;
  if (!run.reviewComplete) return 1;
  if (!run.export) return 2;
  return 3;
}

function stageDone(run: RunManifest, stage: Stage): boolean {
  if (stage === 0) return run.orientationConfirmed;
  if (stage === 1) return run.reviewComplete;
  if (stage === 2) return run.export !== null;
  return run.validated;
}

function stageAvailable(run: RunManifest, stage: Stage): boolean {
  if (stage === 0) return true;
  if (stage === 1) return stageDone(run, 0);
  if (stage === 2) return stageDone(run, 1);
  return stageDone(run, 2);
}

export default function App() {
  const [run, setRun] = useState<RunManifest>(() => createInitialRun());
  const [stage, setStage] = useState<Stage>(0);
  const [preview, setPreview] = useState<MeshPreview | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>('iso');
  const [message, setMessage] = useState<string>('');
  const [flatFaceIndex, setFlatFaceIndex] = useState(0);
  const [drawTool, setDrawTool] = useState<DrawTool>('select');
  const [activeSketchId, setActiveSketchId] = useState<string | null>(null);
  
  // Magic Trace state
  const [stepTopology, setStepTopology] = useState<BRepTopology | null>(null);
  const [snapEngine, setSnapEngine] = useState<SnapEngine | null>(null);
  const [constraintSolver] = useState<ConstraintSolver>(new ConstraintSolver());

  useEffect(() => {
    if (stepTopology) {
      const engine = new SnapEngine(stepTopology, 1.0);
      setSnapEngine(engine);
      setMessage(`Loaded STEP: ${stepTopology.faces.length} faces, ${stepTopology.edges.length} edges, ${stepTopology.vertices.length} vertices`);
    }
  }, [stepTopology]);

  const handleNewProject = useCallback(() => {
    setRun(createInitialRun());
    setStage(0);
    setPreview(null);
    setFlatFaceIndex(0);
    setMessage('');
    setDrawTool('select');
    setActiveSketchId(null);
    setStepTopology(null);
    setSnapEngine(null);
  }, []);

  const handleImportSTEP = useCallback(async (file: File) => {
    try {
      setMessage('Loading STEP file...');
      const content = await file.text();
      
      // TODO: STEP import requires OpenCASCADE.js configuration
      // For now, show a message that this feature is coming soon
      setMessage('STEP import coming soon - use brep.io/stl2step for now');
      
      // When OpenCASCADE is properly configured:
      // const { loadSTEP } = await import('./utils/stepImporter');
      // const topology = await loadSTEP(content);
      // setStepTopology(topology);
      // setStage(1);
    } catch (error) {
      console.error('Error loading STEP:', error);
      setMessage(`Error loading STEP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const handleImportSTL = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const meshPreview = parseSTL(buffer, file.name);

      // Detect boundary edges on flat regions
      if (meshPreview.flatRegions && meshPreview.flatRegions.length > 0) {
        const boundaryEdges = detectBoundaryEdges(meshPreview.preview, meshPreview.flatRegions);
        meshPreview.boundaryEdges = boundaryEdges;
      }

      setPreview(meshPreview);
      setRun(prev => ({
        ...prev,
        projectName: file.name.replace(/\.stl$/i, ''),
        input: { name: file.name, path: file.name, size: file.size },
        orientation: { rotation: [0, 0, 0], scale: 1.0, units: 'mm' },
        orientationConfirmed: false,
        sketchPlanes: [],
        sketches: [],
        identifiedPrimitives: [],
        reviewComplete: false,
        modifications: [],
        reviewNotes: '',
        export: null,
        validated: false,
        validationNotes: '',
      }));
      setStage(0);
      setFlatFaceIndex(0);
      setMessage('');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to parse STL file';
      setMessage(errorMsg);
      console.error('STL import error:', error);
    }
  }, []);

  const handleConfirmOrientation = useCallback((rotation: [number, number, number], scale: number, units: string) => {
    // Create sketch planes for each flat region
    const newPlanes: SketchPlane[] = [];
    if (preview?.flatRegions) {
      preview.flatRegions.forEach((region, idx) => {
        const plane = createSketchPlane(
          idx,
          region.normal,
          region.center,
          `Face ${idx + 1} (${region.side})`
        );
        newPlanes.push(plane);
      });
    }

    // Create a sketch for each plane
    const newSketches: Sketch[] = newPlanes.map((plane, idx) => ({
      id: crypto.randomUUID(),
      planeId: plane.id,
      elements: [],
      color: ['#38a9ff', '#f2ae54', '#aa8bf2', '#59c8a9', '#e77f9d', '#b8ca59'][idx % 6],
      name: `Sketch ${idx + 1}`,
    }));

    setRun(prev => ({
      ...prev,
      orientation: { rotation, scale, units },
      orientationConfirmed: true,
      sketchPlanes: newPlanes,
      sketches: newSketches,
      reviewComplete: false,
      identifiedPrimitives: [],
      modifications: [],
      reviewNotes: '',
    }));
    setStage(1);
    if (newSketches.length > 0) setActiveSketchId(newSketches[0].id);
    setMessage('');
  }, [preview]);

  const handleSetOrientation = useCallback((rotation: [number, number, number]) => {
    setRun(prev => ({
      ...prev,
      orientation: { ...prev.orientation, rotation },
      orientationConfirmed: false,
    }));
  }, []);

  const handleSetUnits = useCallback((units: string) => {
    setRun(prev => ({
      ...prev,
      orientation: { ...prev.orientation, units },
    }));
  }, []);

  const handleSetScale = useCallback((scale: number) => {
    setRun(prev => ({
      ...prev,
      orientation: { ...prev.orientation, scale },
    }));
  }, []);

  const handleAddSketchElement = useCallback((element: SketchElement) => {
    if (!activeSketchId) return;
    setRun(prev => ({
      ...prev,
      sketches: prev.sketches.map(s =>
        s.id === activeSketchId
          ? { ...s, elements: [...s.elements, element] }
          : s
      ),
    }));
  }, [activeSketchId]);

  const handleDeleteSketchElement = useCallback((elementId: string) => {
    if (!activeSketchId) return;
    setRun(prev => ({
      ...prev,
      sketches: prev.sketches.map(s =>
        s.id === activeSketchId
          ? { ...s, elements: s.elements.filter(e => e.id !== elementId) }
          : s
      ),
    }));
  }, [activeSketchId]);

  const handleConfirmSketches = useCallback((notes: string) => {
    setRun(prev => ({
      ...prev,
      reviewNotes: notes,
      reviewComplete: true,
    }));
    setStage(2);
    setMessage('');
  }, []);

  const handleExportProject = useCallback((format: 'step' | 'iges' | 'dxf' | 'stl' | 'json') => {
    const sourceName = run.input?.name || 'mesh.stl';
    const stem = sourceName.replace(/\.stl$/i, '');

    if (format === 'step' || format === 'iges') {
      // Export with automatic primitive detection
      if (preview) {
        const primitives = detectPrimitives(preview, {
          distanceTolerance: 0.1,
          normalTolerance: 5 * Math.PI / 180,
          minSupport: 10,
          maxIterations: 1000,
        });

        const ext = format === 'step' ? 'step' : 'igs';
        downloadSTEP(primitives, preview, `${stem}_analytic.${ext}`, run.projectName);
        setMessage(`Exported ${ext.toUpperCase()} with ${primitives.length} detected primitives (planes, cylinders, circles).`);

        setRun(prev => ({
          ...prev,
          identifiedPrimitives: primitives.map(p => ({
            id: p.id,
            loopId: '',
            sketchId: '',
            kind: p.type as any,
            parameters: p.parameters,
            done: false,
          })),
          export: {
            name: `${stem}_analytic.${ext}`,
            path: `${stem}_analytic.${ext}`,
            generated: true,
            format,
          },
        }));
      }
    } else if (format === 'dxf') {
      // Export sketches as DXF
      downloadDXF(run.sketches, run.sketchPlanes, `${stem}_sketches.dxf`, run.orientation.units);
      setMessage('Sketches exported as DXF. Import into your CAD tool.');
    } else if (format === 'stl') {
      // Export oriented mesh as STL
      if (preview) {
        downloadSTL(preview, run.orientation, `${stem}_oriented.stl`);
        setMessage('Oriented mesh exported as STL.');
      }
    } else {
      // Export project data as JSON (for backup/transfer)
      const exportData = {
        projectName: run.projectName,
        orientation: run.orientation,
        sketchPlanes: run.sketchPlanes,
        sketches: run.sketches,
        identifiedPrimitives: run.identifiedPrimitives,
        modifications: run.modifications,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stem}_project.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`Project data exported as JSON.`);
    }

    if (format !== 'step' && format !== 'iges') {
      setRun(prev => ({
        ...prev,
        export: {
          name: `${stem}_export.${format === 'dxf' ? 'dxf' : format === 'stl' ? 'stl' : 'json'}`,
          path: `${stem}_export.${format === 'dxf' ? 'dxf' : format === 'stl' ? 'stl' : 'json'}`,
          generated: true,
          format: format as any,
        },
      }));
    }
  }, [run, preview]);

  const handleSetCadTool = useCallback((toolId: string) => {
    setRun(prev => ({
      ...prev,
      targetCadTool: toolId,
    }));
  }, []);

  const handleValidate = useCallback((notes: string) => {
    setRun(prev => ({
      ...prev,
      validationNotes: notes,
      validated: true,
    }));
    setMessage('');
  }, []);

  const handleSetStage = useCallback((newStage: Stage) => {
    if (stageAvailable(run, newStage)) {
      setStage(newStage);
    }
  }, [run]);

  const handleAddModification = useCallback((mod: ModificationNote) => {
    setRun(prev => ({
      ...prev,
      modifications: [...prev.modifications, mod],
    }));
  }, []);

  const handleUpdateModification = useCallback((id: string, updates: Partial<ModificationNote>) => {
    setRun(prev => ({
      ...prev,
      modifications: prev.modifications.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  }, []);

  const handleDeleteModification = useCallback((id: string) => {
    setRun(prev => ({
      ...prev,
      modifications: prev.modifications.filter(m => m.id !== id),
    }));
  }, []);

  const handleSelectFace = useCallback((faceIndex: number) => {
    setFlatFaceIndex(faceIndex);
    // Auto-select the corresponding sketch plane
    if (run.sketches[faceIndex]) {
      setActiveSketchId(run.sketches[faceIndex].id);
    }
  }, [run.sketches]);

  const handleSkipSketch = useCallback(() => {
    setRun(prev => ({
      ...prev,
      reviewNotes: 'Skipped sketching stage',
      reviewComplete: true,
    }));
    setStage(2);
    setMessage('Skipped sketching. You can add modifications in the next stage.');
  }, []);

  const currentStageInfo = STAGE_INFO[stage];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#171a1e] text-[#e4e9ec] font-sans text-[13px]">
      <TopBar
        projectName={run.projectName}
        onNewProject={handleNewProject}
      />

      <div className="flex flex-1 min-h-0">
        <WorkflowRail
          stage={stage}
          run={run}
          onSetStage={handleSetStage}
        />

        <Viewport
          preview={preview}
          run={run}
          cameraView={cameraView}
          onCameraViewChange={setCameraView}
          stage={stage}
          flatFaceIndex={flatFaceIndex}
          drawTool={drawTool}
          activeSketchId={activeSketchId}
          onAddSketchElement={handleAddSketchElement}
          onSelectFace={handleSelectFace}
          stepTopology={stepTopology}
          snapEngine={snapEngine}
          onImportSTEP={handleImportSTEP}
        />

        <Inspector
          stage={stage}
          stageInfo={currentStageInfo}
          run={run}
          preview={preview}
          flatFaceIndex={flatFaceIndex}
          onFlatFaceIndexChange={setFlatFaceIndex}
          onImportSTL={handleImportSTL}
          onConfirmOrientation={handleConfirmOrientation}
          onSetOrientation={handleSetOrientation}
          onSetUnits={handleSetUnits}
          onSetScale={handleSetScale}
          drawTool={drawTool}
          onDrawToolChange={setDrawTool}
          activeSketchId={activeSketchId}
          onSetActiveSketchId={setActiveSketchId}
          onDeleteSketchElement={handleDeleteSketchElement}
          onConfirmSketches={handleConfirmSketches}
          onSkipSketch={handleSkipSketch}
          onExportProject={handleExportProject}
          onSetCadTool={handleSetCadTool}
          onValidate={handleValidate}
          onSetStage={handleSetStage}
          onAddModification={handleAddModification}
          onUpdateModification={handleUpdateModification}
          onDeleteModification={handleDeleteModification}
          message={message}
          onMessageChange={setMessage}
          constraintSolver={constraintSolver}
          snapEngine={snapEngine}
          onImportSTEP={handleImportSTEP}
        />
      </div>

      <StatusBar
        message={message || `${currentStageInfo.title} · ${run.projectName}`}
        meshName={run.input?.name || 'No STL loaded'}
        triangles={preview?.triangles || 0}
        vertices={preview?.vertices || 0}
      />

      {message && (
        <div className="fixed right-[346px] bottom-[38px] z-10 max-w-[480px] px-3 py-2 border border-[#704f43] rounded bg-[#3a2a25] text-[#f0c4aa] text-[10px]">
          {message}
        </div>
      )}
    </div>
  );
}
