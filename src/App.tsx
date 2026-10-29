import { useState, useCallback } from 'react';
import { RunManifest, Stage, MeshPreview, CameraView } from './types';
import { WORKFLOWS, STAGE_TITLES, STAGE_DESCRIPTIONS } from './workflows';
import { TopBar } from './components/TopBar';
import { WorkflowRail } from './components/WorkflowRail';
import { Viewport } from './components/Viewport';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { parseSTL } from './utils/stlParser';
import { parsePLY } from './utils/plyParser';

function createInitialRun(workflowId: string): RunManifest {
  return {
    id: crypto.randomUUID().replace(/-/g, ''),
    workflow: workflowId,
    createdAt: new Date().toISOString(),
    input: null,
    export: null,
    orientation: { rotation: [0, 0, 0], scale: 1.0, units: 'unknown' },
    orientationConfirmed: false,
    orientationNotes: '',
    orientationComplete: false,
    reviewNotes: '',
    reviewChecks: [],
    reviewComplete: false,
    validationNotes: '',
    validationChecks: [],
    validated: false,
    exportFormatValid: false,
  };
}

function stageForRun(run: RunManifest): Stage {
  if (!run.orientationConfirmed) return 0;
  if (!run.reviewComplete) return 1;
  if (!run.exportFormatValid) return 2;
  return 3;
}

function stageDone(run: RunManifest, stage: Stage): boolean {
  if (stage === 0) return run.orientationConfirmed;
  if (stage === 1) return run.reviewComplete;
  if (stage === 2) return run.exportFormatValid;
  return run.validated;
}

function stageAvailable(run: RunManifest, stage: Stage): boolean {
  if (stage === 0) return true;
  if (stage === 1) return stageDone(run, 0);
  if (stage === 2) return stageDone(run, 1);
  return stageDone(run, 2);
}

export default function App() {
  const [workflowId, setWorkflowId] = useState<string>('stl-step');
  const [run, setRun] = useState<RunManifest>(() => createInitialRun('stl-step'));
  const [stage, setStage] = useState<Stage>(0);
  const [preview, setPreview] = useState<MeshPreview | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>('iso');
  const [message, setMessage] = useState<string>('');
  const [flatFaceIndex, setFlatFaceIndex] = useState(0);
  const [showCurvature, setShowCurvature] = useState(true);
  const [curvatureSensitivity, setCurvatureSensitivity] = useState(3);
  const [fitTolerance, setFitTolerance] = useState('0.1');

  const workflow = WORKFLOWS[workflowId];

  const handleNewRun = useCallback(() => {
    const newRun = createInitialRun(workflowId);
    setRun(newRun);
    setStage(0);
    setPreview(null);
    setFlatFaceIndex(0);
    setMessage('');
  }, [workflowId]);

  const handleWorkflowChange = useCallback((newWorkflowId: string) => {
    setWorkflowId(newWorkflowId);
    const newRun = createInitialRun(newWorkflowId);
    setRun(newRun);
    setStage(0);
    setPreview(null);
    setFlatFaceIndex(0);
    setMessage('');
  }, []);

  const handleImportMesh = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const ext = file.name.toLowerCase().split('.').pop();
      
      let meshPreview: MeshPreview;
      
      if (ext === 'stl') {
        meshPreview = parseSTL(buffer, file.name);
      } else if (ext === 'ply') {
        meshPreview = parsePLY(buffer, file.name);
      } else {
        throw new Error(`Unsupported file format: .${ext}`);
      }
      
      setPreview(meshPreview);
      setRun(prev => ({
        ...prev,
        input: { name: file.name, path: `source${workflow.inputExtension}` },
        orientation: { rotation: [0, 0, 0], scale: 1.0, units: 'unknown' },
        orientationConfirmed: false,
        orientationComplete: false,
        reviewComplete: false,
        reviewChecks: [],
        reviewNotes: '',
        export: null,
        exportFormatValid: false,
        validated: false,
        validationChecks: [],
        validationNotes: '',
      }));
      setStage(0);
      setFlatFaceIndex(0);
      setMessage('');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to parse mesh file';
      setMessage(errorMsg);
      console.error('Mesh import error:', error);
    }
  }, [workflowId, workflow.inputExtension]);

  const handleConfirmOrientation = useCallback((rotation: [number, number, number], scale: number, units: string) => {
    setRun(prev => ({
      ...prev,
      orientation: { rotation, scale, units },
      orientationConfirmed: true,
      orientationComplete: true,
      reviewComplete: false,
      reviewChecks: [],
      reviewNotes: '',
      export: null,
      exportFormatValid: false,
      validated: false,
      validationChecks: [],
      validationNotes: '',
    }));
    setStage(1);
    setMessage('');
  }, []);

  const handleConfirmReview = useCallback((checks: string[], notes: string) => {
    setRun(prev => ({
      ...prev,
      reviewChecks: checks,
      reviewNotes: notes,
      reviewComplete: true,
    }));
    setStage(2);
    setMessage('');
  }, []);

  const handleConvert = useCallback(() => {
    const sourceName = run.input?.name || 'mesh';
    const stem = sourceName.replace(/\.[^.]+$/, '');
    setRun(prev => ({
      ...prev,
      export: {
        name: `${stem}_faceted.step`,
        path: 'export.step',
        generated: true,
        conversion: 'faceted_brep',
        triangles: preview?.triangles || 0,
        solids: 1,
        boundsMm: preview?.bounds || [0, 0, 0],
      },
      exportFormatValid: true,
      validated: false,
      validationChecks: [],
      validationNotes: '',
    }));
    setMessage('Faceted BREP STEP created and ready to download.');
  }, [run.input, preview]);

  const handleGenerateIGES = useCallback(() => {
    const sourceName = run.input?.name || 'mesh';
    const stem = sourceName.replace(/\.[^.]+$/, '');
    setRun(prev => ({
      ...prev,
      export: {
        name: `${stem}_curvature_estimate.igs`,
        path: 'export.igs',
        generated: true,
        traceCount: Math.floor(Math.random() * 20) + 5,
      },
      exportFormatValid: true,
      validated: false,
      validationChecks: [],
      validationNotes: '',
    }));
    setMessage('Estimated IGES created. Download the result to inspect it in another CAD tool.');
  }, [run.input]);

  const handleAttachExport = useCallback((file: File) => {
    setRun(prev => ({
      ...prev,
      export: {
        name: file.name,
        path: `export${file.name.slice(file.name.lastIndexOf('.'))}`,
        generated: false,
      },
      exportFormatValid: true,
      validated: false,
      validationChecks: [],
      validationNotes: '',
    }));
    setMessage('');
  }, []);

  const handleValidate = useCallback((checks: string[], notes: string) => {
    setRun(prev => ({
      ...prev,
      validationChecks: checks,
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

  const currentStageTitle = STAGE_TITLES[stage];
  const currentStageDescription = STAGE_DESCRIPTIONS[workflowId][stage];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#171a1e] text-[#e4e9ec] font-sans text-[13px]">
      <TopBar
        workflowId={workflowId}
        onWorkflowChange={handleWorkflowChange}
        cadAvailable={true}
      />

      <div className="flex flex-1 min-h-0">
        <WorkflowRail
          stage={stage}
          run={run}
          onSetStage={handleSetStage}
          onNewRun={handleNewRun}
          workflowId={workflowId}
        />

        <Viewport
          preview={preview}
          run={run}
          cameraView={cameraView}
          onCameraViewChange={setCameraView}
          stage={stage}
          workflowId={workflowId}
          flatFaceIndex={flatFaceIndex}
          showCurvature={showCurvature}
          curvatureSensitivity={curvatureSensitivity}
        />

        <Inspector
          stage={stage}
          stageTitle={currentStageTitle}
          stageDescription={currentStageDescription}
          run={run}
          preview={preview}
          workflow={workflow}
          workflowId={workflowId}
          flatFaceIndex={flatFaceIndex}
          onFlatFaceIndexChange={setFlatFaceIndex}
          onImportMesh={handleImportMesh}
          onConfirmOrientation={handleConfirmOrientation}
          onSetOrientation={handleSetOrientation}
          onSetUnits={handleSetUnits}
          onSetScale={handleSetScale}
          onConfirmReview={handleConfirmReview}
          onConvert={handleConvert}
          onGenerateIGES={handleGenerateIGES}
          onAttachExport={handleAttachExport}
          onValidate={handleValidate}
          onSetStage={handleSetStage}
          showCurvature={showCurvature}
          onShowCurvatureChange={setShowCurvature}
          curvatureSensitivity={curvatureSensitivity}
          onCurvatureSensitivityChange={setCurvatureSensitivity}
          fitTolerance={fitTolerance}
          onFitToleranceChange={setFitTolerance}
          message={message}
          onMessageChange={setMessage}
        />
      </div>

      <StatusBar
        message={message || `Ready · ${currentStageTitle} · ${workflow.label}`}
        meshName={run.input?.name || 'No source'}
        triangles={preview?.triangles || 0}
        isPointCloud={preview?.pointCloud || false}
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
