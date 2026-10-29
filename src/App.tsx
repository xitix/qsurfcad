import { useState, useCallback } from 'react';
import { RunManifest, Stage, MeshPreview, CameraView, ModificationNote } from './types';
import { STAGE_INFO } from './cadTools';
import { TopBar } from './components/TopBar';
import { WorkflowRail } from './components/WorkflowRail';
import { Viewport } from './components/Viewport';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { parseSTL } from './utils/stlParser';

function createInitialRun(): RunManifest {
  return {
    id: crypto.randomUUID().replace(/-/g, ''),
    createdAt: new Date().toISOString(),
    projectName: 'New Project',
    input: null,
    export: null,
    orientation: { rotation: [0, 0, 0], scale: 1.0, units: 'mm' },
    orientationConfirmed: false,
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

  const handleNewProject = useCallback(() => {
    setRun(createInitialRun());
    setStage(0);
    setPreview(null);
    setFlatFaceIndex(0);
    setMessage('');
  }, []);

  const handleImportSTL = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const meshPreview = parseSTL(buffer, file.name);
      
      setPreview(meshPreview);
      setRun(prev => ({
        ...prev,
        projectName: file.name.replace(/\.stl$/i, ''),
        input: { name: file.name, path: file.name, size: file.size },
        orientation: { rotation: [0, 0, 0], scale: 1.0, units: 'mm' },
        orientationConfirmed: false,
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
    setRun(prev => ({
      ...prev,
      orientation: { rotation, scale, units },
      orientationConfirmed: true,
      reviewComplete: false,
      modifications: [],
      reviewNotes: '',
    }));
    setStage(1);
    setMessage('');
  }, []);

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

  const handleConfirmModifications = useCallback((notes: string) => {
    setRun(prev => ({
      ...prev,
      reviewNotes: notes,
      reviewComplete: true,
    }));
    setStage(2);
    setMessage('');
  }, []);

  const handleConvertToSTEP = useCallback(() => {
    const sourceName = run.input?.name || 'mesh.stl';
    const stem = sourceName.replace(/\.stl$/i, '');
    setRun(prev => ({
      ...prev,
      export: {
        name: `${stem}_editable.step`,
        path: `${stem}_editable.step`,
        generated: true,
        triangles: preview?.triangles || 0,
        solids: 1,
        boundsMm: preview?.bounds || [0, 0, 0],
      },
    }));
    setMessage('STEP file generated. Download and open in your CAD tool.');
  }, [run.input, preview]);

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
          onAddModification={handleAddModification}
          onUpdateModification={handleUpdateModification}
          onDeleteModification={handleDeleteModification}
          onConfirmModifications={handleConfirmModifications}
          onConvertToSTEP={handleConvertToSTEP}
          onSetCadTool={handleSetCadTool}
          onValidate={handleValidate}
          onSetStage={handleSetStage}
          message={message}
          onMessageChange={setMessage}
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
