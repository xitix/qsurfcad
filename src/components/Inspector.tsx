import { useState, useRef } from 'react';
import { RunManifest, Stage, MeshPreview } from '../types';
import { WorkflowDefinition, FLAT_FACE_COLORS } from '../workflows';

interface InspectorProps {
  stage: Stage;
  stageTitle: string;
  stageDescription: string;
  run: RunManifest;
  preview: MeshPreview | null;
  workflow: WorkflowDefinition;
  workflowId: string;
  flatFaceIndex: number;
  onFlatFaceIndexChange: (index: number) => void;
  onImportMesh: (file: File) => void | Promise<void>;
  onConfirmOrientation: (rotation: [number, number, number], scale: number, units: string) => void;
  onSetOrientation: (rotation: [number, number, number]) => void;
  onSetUnits: (units: string) => void;
  onSetScale: (scale: number) => void;
  onConfirmReview: (checks: string[], notes: string) => void;
  onConvert: () => void;
  onGenerateIGES: () => void;
  onAttachExport: (file: File) => void;
  onValidate: (checks: string[], notes: string) => void;
  onSetStage: (stage: Stage) => void;
  showCurvature: boolean;
  onShowCurvatureChange: (show: boolean) => void;
  curvatureSensitivity: number;
  onCurvatureSensitivityChange: (value: number) => void;
  fitTolerance: string;
  onFitToleranceChange: (value: string) => void;
  message: string;
  onMessageChange: (msg: string) => void;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.abs(value) >= 10000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)
    ? value.toExponential(3)
    : value.toFixed(3).replace(/\.?0+$/, '');
}

function normalAxisLabel(normal: number[]): string {
  const axis = normal.reduce((best, value, index) =>
    Math.abs(value) > Math.abs(normal[best]) ? index : best, 0);
  return `${normal[axis] < 0 ? '-' : '+'}${'XYZ'[axis]}`;
}

export function Inspector({
  stage,
  stageTitle,
  stageDescription,
  run,
  preview,
  workflow,
  workflowId,
  flatFaceIndex,
  onFlatFaceIndexChange,
  onImportMesh,
  onConfirmOrientation,
  onSetOrientation,
  onSetUnits,
  onSetScale,
  onConfirmReview,
  onConvert,
  onGenerateIGES,
  onAttachExport,
  onValidate,
  onSetStage,
  showCurvature,
  onShowCurvatureChange,
  curvatureSensitivity,
  onCurvatureSensitivityChange,
  fitTolerance,
  onFitToleranceChange,
  message,
  onMessageChange,
}: InspectorProps) {
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [sourceUnits, setSourceUnits] = useState('unknown');
  const [knownSize, setKnownSize] = useState('');
  const [knownAxis, setKnownAxis] = useState<'x' | 'y' | 'z'>('x');
  const [reviewChecks, setReviewChecks] = useState<string[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [validationChecks, setValidationChecks] = useState<string[]>([]);
  const [validationNotes, setValidationNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportFileRef = useRef<HTMLInputElement>(null);

  const handleRotationChange = (axis: number, value: number) => {
    const rotation: [number, number, number] = [rotationX, rotationY, rotationZ];
    rotation[axis] = value;
    if (axis === 0) setRotationX(value);
    if (axis === 1) setRotationY(value);
    if (axis === 2) setRotationZ(value);
    onSetOrientation(rotation);
  };

  const handleAlignFlatFace = () => {
    const flatRegion = preview?.flatRegions?.[flatFaceIndex] || preview?.flatRegion;
    if (!flatRegion) return;
    const [nx, ny, nz] = flatRegion.normal;
    const rotateXAngle = Math.atan2(ny, nz) * 180 / Math.PI;
    const zAfterX = ny * Math.sin(rotateXAngle * Math.PI / 180) + nz * Math.cos(rotateXAngle * Math.PI / 180);
    const rotateYAngle = Math.atan2(-nx, zAfterX) * 180 / Math.PI;
    setRotationX(Math.round(rotateXAngle * 10) / 10);
    setRotationY(Math.round(rotateYAngle * 10) / 10);
    setRotationZ(0);
    onSetOrientation([rotateXAngle, rotateYAngle, 0]);
    onMessageChange('Flat-face alignment applied. Orbit and inspect the part, then confirm orientation.');
  };

  const handleConfirmOrientation = () => {
    const unit = sourceUnits;
    let scale = run.orientation.scale;
    const known = Number(knownSize);
    const axisIdx = ['x', 'y', 'z'].indexOf(knownAxis);
    
    if (known > 0 && preview) {
      const unitMm: Record<string, number> = { unknown: 1, mm: 1, cm: 10, m: 1000, in: 25.4 };
      const actualUnit = unit === 'unknown' ? 'mm' : unit;
      const sourceSpan = preview.bounds[axisIdx];
      scale = known / sourceSpan / (unitMm[actualUnit] || 1);
    }
    
    onConfirmOrientation([rotationX, rotationY, rotationZ], scale, unit === 'unknown' ? 'unknown' : unit);
  };

  const handleToggleReviewCheck = (checkId: string) => {
    setReviewChecks(prev =>
      prev.includes(checkId) ? prev.filter(c => c !== checkId) : [...prev, checkId]
    );
  };

  const handleToggleValidationCheck = (checkId: string) => {
    setValidationChecks(prev =>
      prev.includes(checkId) ? prev.filter(c => c !== checkId) : [...prev, checkId]
    );
  };

  const isFlatFaceAligned = () => {
    const flatRegion = preview?.flatRegions?.[flatFaceIndex] || preview?.flatRegion;
    if (!flatRegion) return false;
    const rx = rotationX * Math.PI / 180;
    const ry = rotationY * Math.PI / 180;
    const rz = rotationZ * Math.PI / 180;
    let [x, y, z] = flatRegion.normal;
    // Apply rotation
    [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    return Math.abs(z) >= 0.98;
  };

  const flatRegions = preview?.flatRegions || (preview?.flatRegion ? [preview.flatRegion] : []);
  const allReviewChecksDone = workflow.reviewChecks.every((check: [string, string]) => reviewChecks.includes(check[0]));
  const allValidationChecksDone = workflow.validationChecks.every((check: [string, string]) => validationChecks.includes(check[0]));

  const getScaleResult = () => {
    const known = Number(knownSize);
    if (!known || !preview) return 'Enter the known full span of the selected X, Y, or Z axis.';
    const unitMm: Record<string, number> = { unknown: 1, mm: 1, cm: 10, m: 1000, in: 25.4 };
    const axisIdx = ['x', 'y', 'z'].indexOf(knownAxis);
    const unit = sourceUnits === 'unknown' ? 'mm' : sourceUnits;
    const scale = known / preview.bounds[axisIdx] / (unitMm[unit] || 1);
    return `Suggested scale: ${formatNumber(scale)}×`;
  };

  return (
    <aside className="flex flex-col min-w-0 w-[330px] overflow-y-auto border-l border-[#111315] bg-[#282d32]">
      {/* Inspector header */}
      <div className="px-4 pt-4 pb-3.5 border-b border-[#3b4248]">
        <span className="text-[#8e989e] text-[9px] font-bold tracking-[1.2px]">
          STAGE {String(stage + 1).padStart(2, '0')} / 04
        </span>
        <h1 className="my-1 text-[17px] font-semibold">{stageTitle}</h1>
        <p className="m-0 text-[#a4afb5] text-[11px] leading-[1.5]">{stageDescription}</p>
      </div>

      {/* Stage 0: Import / Orient */}
      {stage === 0 && (
        <div className="p-4">
          {/* Upload form */}
          <div className="grid gap-2 p-3 border border-dashed border-[#59646c] rounded-sm bg-[#23282d]">
            <label className="grid justify-items-center gap-1 cursor-pointer">
              <span className="grid w-[26px] h-[26px] place-items-center border border-[#57636a] rounded-full text-[#78aefa] text-[17px]">↑</span>
              <strong className="text-[#dbe1e4] text-[11px] font-semibold">Choose source mesh</strong>
              <small className="text-[#95a0a6] text-[9px]">
                {workflow.inputExtension.toUpperCase()} source mesh
              </small>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={workflow.inputExtension}
              className="max-w-full text-[#aab5bb] text-[10px]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportMesh(file);
              }}
            />
          </div>

          {/* Source status */}
          <div className="mt-2 text-[#a2adb3] text-[10px] leading-[1.45]">
            {run.input ? `Loaded: ${run.input.name}` : 'No source file selected.'}
          </div>

          <div className="h-px my-3 bg-[#3b4248]" />

          {/* Import report */}
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">IMPORT REPORT</h2>
          <dl className="m-0">
            {[
              ['Format', preview ? `${preview.format}${preview.encoding ? ` · ${preview.encoding}` : ''}` : '—'],
              ['Vertices', preview ? preview.vertices.toLocaleString() : '—'],
              ['Triangles', preview ? preview.triangles.toLocaleString() : '—'],
              ['Bounds X / Y / Z', preview ? preview.bounds.map(formatNumber).join(' × ') : '—'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] gap-2.5 py-1 border-b border-[#353c42] text-[10px]">
                <dt className="text-[#99a4aa]">{label}</dt>
                <dd className="m-0 text-[#dae0e3] text-right font-variant-numeric-tabular">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Flat region card */}
          <div className="mt-3 p-2 border border-[#414a51] bg-[#23282d]">
            <strong className="text-[#bcc5ca] text-[9px] tracking-[1px]">FLAT FACE · NORMAL AXIS</strong>
            <p className="my-1.5 text-[#aeb8bd] text-[10px] leading-[1.45]">
              {flatRegions.length > 0
                ? `${flatRegions.length} planar regions detected · largest: ${normalAxisLabel(flatRegions[flatFaceIndex]?.normal || [0, 0, 1])}${isFlatFaceAligned() ? ' · level with XY' : ' · align before continuing'}`
                : 'No connected planar regions detected. You can still orient the mesh manually.'}
            </p>
            <label className="block my-2 text-[#b9c3c8] text-[10px] font-semibold">Detected planar regions · largest first</label>
            <div className="grid max-h-[190px] gap-1 overflow-y-auto p-1 border border-[#414a51] bg-[#1d2226]">
              {flatRegions.length === 0 ? (
                <span className="text-[#8e9ba2] text-[9px] p-2">Import a mesh to detect planar regions.</span>
              ) : (
                flatRegions.map((region, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onFlatFaceIndexChange(index)}
                    className={`flex min-h-[34px] items-center gap-2 p-1.5 text-left border rounded-sm cursor-pointer ${
                      index === flatFaceIndex
                        ? 'border-[#4a87ad] bg-[#263b49] text-[#cbd4d9]'
                        : 'border-transparent bg-[#272d32] text-[#cbd4d9] hover:bg-[#313940]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-6 border border-[#aebbc2aa] rounded-sm shrink-0"
                      style={{ backgroundColor: FLAT_FACE_COLORS[index % FLAT_FACE_COLORS.length] }}
                    />
                    <span className="grid gap-0.5 min-w-0">
                      <strong className="text-[9px] font-semibold truncate">
                        Face {index + 1} · {region.side === 'lower' ? 'lower side' : region.side === 'upper' ? 'upper side' : 'interior'} · {normalAxisLabel(region.normal)}
                      </strong>
                      <small className="text-[#8e9ba2] text-[8px]">
                        {region.previewAreaPercent}% mesh area · {region.connectedPatches} connected patch{region.connectedPatches === 1 ? '' : 'es'}
                      </small>
                    </span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={flatRegions.length === 0 || isFlatFaceAligned()}
              onClick={handleAlignFlatFace}
              className="w-full mt-2 min-h-[30px] py-1.5 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3a4248]"
            >
              {isFlatFaceAligned() ? 'Selected flat face is aligned with XY' : 'Align selected flat face to XY'}
            </button>
            <small className="block mt-2 text-[#89959b] text-[9px] leading-[1.45]">
              The selected blue region is the alignment anchor. Drag the part to inspect it from different angles.
              Aligning changes the part orientation, while orbiting only changes the camera.
            </small>
          </div>

          {/* Source units */}
          <label className="block mt-2.5 text-[#b9c3c8] text-[10px] font-semibold">Source units</label>
          <select
            value={sourceUnits}
            onChange={(e) => { setSourceUnits(e.target.value); onSetUnits(e.target.value); }}
            className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none focus:border-[#4a89e6]"
          >
            <option value="unknown">Unknown — verify a known measurement</option>
            <option value="mm">Millimetres</option>
            <option value="cm">Centimetres</option>
            <option value="m">Metres</option>
            <option value="in">Inches</option>
          </select>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
            STL carries no unit information. PLY dimensions also need a known-scale check.
          </p>

          <div className="h-px my-3 bg-[#3b4248]" />

          {/* Orientation */}
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">ORIENTATION</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
            Align the selected flat face to the XY build plane, then orbit and inspect the part from multiple angles.
          </p>
          
          {([
            ['Rotate X', rotationX, 0],
            ['Rotate Y', rotationY, 1],
            ['Rotate Z', rotationZ, 2],
          ] as const).map(([label, value, axis]) => (
            <div key={label} className="grid grid-cols-[1fr_95px_28px] gap-2 items-center my-2 text-[#aeb8bd] text-[10px]">
              <label>{label}</label>
              <input
                type="number"
                step="1"
                value={value}
                onChange={(e) => handleRotationChange(axis, Number(e.target.value))}
                className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] text-right outline-none focus:border-[#4a89e6]"
              />
              <span className="text-[#87939a]">deg</span>
            </div>
          ))}

          <button
            type="button"
            onClick={() => { setRotationX(0); setRotationY(0); setRotationZ(0); onSetOrientation([0, 0, 0]); }}
            className="w-full mt-2 min-h-[30px] py-1.5 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer hover:bg-[#3a4248]"
          >
            Reset rotation
          </button>

          {/* Verify scale */}
          <h2 className="mt-3 mb-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">VERIFY SCALE</h2>
          <label className="block mt-2.5 text-[#b9c3c8] text-[10px] font-semibold">Known full-axis span (mm)</label>
          <input
            type="number"
            min="0.001"
            step="any"
            value={knownSize}
            onChange={(e) => setKnownSize(e.target.value)}
            placeholder="e.g. known overall width"
            className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none focus:border-[#4a89e6]"
          />
          <div className="grid grid-cols-[1fr_120px] gap-2 items-center mt-2 text-[#aeb8bd] text-[10px]">
            <label>Measured along</label>
            <select
              value={knownAxis}
              onChange={(e) => setKnownAxis(e.target.value as 'x' | 'y' | 'z')}
              className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none focus:border-[#4a89e6]"
            >
              <option value="x">X span</option>
              <option value="y">Y span</option>
              <option value="z">Z span</option>
            </select>
          </div>
          <p className="min-h-[15px] text-[#9ca8ae] text-[9px] leading-[1.5] mt-1">{getScaleResult()}</p>

          {/* Confirm button */}
          <div className="mt-3">
            <button
              type="button"
              disabled={!run.input}
              onClick={handleConfirmOrientation}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]"
            >
              Confirm orientation before reconstruction →
            </button>
          </div>
        </div>
      )}

      {/* Stage 1: Trace / Review */}
      {stage === 1 && (
        <div className="p-4">
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">{workflow.cadTitle}</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">{workflow.cadDescription}</p>

          {/* Curvature preview (PLY only) */}
          {workflowId === 'ply-iges' && (
            <div className="my-2.5 p-2 border border-[#70404a] bg-[#2b2327]">
              <label className="flex items-center gap-2 text-[#f0c4ca] text-[10px] font-semibold">
                <input
                  type="checkbox"
                  checked={showCurvature}
                  onChange={(e) => onShowCurvatureChange(e.target.checked)}
                  className="accent-[#ef5264]"
                />
                <span>Show estimated curvature traces</span>
              </label>
              <label className="block mt-2 text-[#b9c3c8] text-[10px] font-semibold">Minimum facet-normal change</label>
              <select
                value={curvatureSensitivity}
                onChange={(e) => onCurvatureSensitivityChange(Number(e.target.value))}
                className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none"
              >
                <option value={1}>1° · high sensitivity</option>
                <option value={3}>3° · balanced</option>
                <option value={8}>8° · pronounced features</option>
                <option value={15}>15° · sharp features</option>
              </select>
              <p className="my-1.5 text-[#e8a7b0] text-[9px] leading-[1.45]">
                {preview?.curvatureTraces
                  ? `${preview.curvatureTraces.filter(t => t.angle >= curvatureSensitivity).length} connected trace paths shown · ${preview.curvatureTraces.length} candidates in sampled mesh patches.`
                  : 'No connected curvature traces were found in the sampled surface.'}
              </p>
              <small className="block text-[#b69da1] text-[9px] leading-[1.5]">
                Red lines estimate curvature from adjacent sampled mesh facets. They are review guides only, not fitted or editable CAD splines.
              </small>
            </div>
          )}

          {/* Tool card */}
          <div className="flex items-center gap-2 my-2.5 p-2 border border-[#424b52] bg-[#22272c]">
            <span className="grid w-6 h-6 place-items-center border border-[#52616a] rounded-sm text-[#81b0f2] text-[15px]">↗</span>
            <div className="grid gap-0.5">
              <strong className="text-[10px]">{workflowId === 'stl-step' ? 'Surfcad BREP converter' : 'FreeCAD'}</strong>
              <small className="text-[#9ba6ac] text-[9px]">
                {workflowId === 'stl-step' ? 'Runs in-app at Stage 03' : 'Available for output verification'}
              </small>
            </div>
          </div>

          {/* Orientation confirmation */}
          {run.orientationConfirmed && (
            <p className="my-2 p-2 border border-[#45647a] text-[#b7d9ee] bg-[#202a31] text-[10px] leading-[1.5]">
              Confirmed orientation: X {formatNumber(run.orientation.rotation[0])}° · Y {formatNumber(run.orientation.rotation[1])}° · Z {formatNumber(run.orientation.rotation[2])}°.
              {workflowId === 'stl-step'
                ? ' The app applies this rotation and unit scale to the STEP output.'
                : ' Apply this rotation to the source mesh before tracing curves.'}
            </p>
          )}

          <div className="h-px my-3 bg-[#3b4248]" />

          {/* Review checks */}
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">
            {workflowId === 'stl-step' ? 'PRE-CONVERSION REVIEW' : 'CURVE REVIEW SETTINGS'}
          </h2>

          {workflowId === 'ply-iges' && (
            <>
              <label className="block mt-2.5 text-[#b9c3c8] text-[10px] font-semibold">{workflow.toleranceLabel}</label>
              <select
                value={fitTolerance}
                onChange={(e) => onFitToleranceChange(e.target.value)}
                className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none"
              >
                <option value="0.05">0.05 mm</option>
                <option value="0.1">0.1 mm · initial setting</option>
                <option value="0.25">0.25 mm</option>
              </select>
              <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">{workflow.toleranceHelp}</p>
            </>
          )}

          <div className="grid gap-2 mt-2 p-2.5 border border-[#414a51] bg-[#23282d]">
            {workflow.reviewChecks.map((check: [string, string]) => (
              <label key={check[0]} className="flex gap-2 items-start text-[#c2cbd0] text-[10px] leading-[1.4]">
                <input
                  type="checkbox"
                  checked={reviewChecks.includes(check[0])}
                  onChange={() => handleToggleReviewCheck(check[0])}
                  className="mt-0.5 accent-[#2874e8]"
                />
                <span>{check[1]}</span>
              </label>
            ))}
          </div>

          <label className="block mt-2.5 text-[#b9c3c8] text-[10px] font-semibold">
            Review notes <span className="text-[#829098] font-normal">(optional)</span>
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            maxLength={4000}
            placeholder="Warnings, observed issues, selected tolerance…"
            className="w-full min-h-[54px] p-2 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] resize-y outline-none focus:border-[#4a89e6]"
          />

          <div className="mt-3">
            <button
              type="button"
              disabled={!allReviewChecksDone}
              onClick={() => onConfirmReview(reviewChecks, reviewNotes)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]"
            >
              Confirm review →
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Export */}
      {stage === 2 && (
        <div className="p-4">
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">EXPORT {workflow.exportLabel}</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">{workflow.exportDescription}</p>

          {/* Convert STL button */}
          {workflowId === 'stl-step' && (
            <>
              <button
                type="button"
                onClick={onConvert}
                className="w-full mt-2 min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer hover:bg-[#3986fa]"
              >
                {run.export?.conversion === 'faceted_brep' ? 'Reconvert STL to STEP' : 'Convert STL to STEP BREP solid'}
              </button>
              <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
                {run.export?.conversion === 'faceted_brep'
                  ? `Generated ${run.export.triangles?.toLocaleString()} facets as ${run.export.solids} solid · ${run.export.boundsMm?.map(formatNumber).join(' × ')} mm.`
                  : 'Creates a faceted solid from the mesh; it does not fit analytic planes, cylinders, or design features.'}
              </p>
              <div className="h-px my-3 bg-[#3b4248]" />
              <p className="text-[#929da3] text-[10px]">Or attach an existing STEP result:</p>
            </>
          )}

          {/* Generate IGES button */}
          {workflowId === 'ply-iges' && (
            <>
              <button
                type="button"
                onClick={onGenerateIGES}
                className="w-full mt-2 min-h-[30px] py-2 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer hover:bg-[#3a4248]"
              >
                Generate IGES from estimated traces
              </button>
              <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
                This creates editable 3D polyline guide curves from the sampled preview traces; it is an estimate, not fitted CAD splines.
              </p>
            </>
          )}

          {/* Attach export form */}
          <div className="grid gap-2 mt-3">
            <label className="block text-[#b9c3c8] text-[10px] font-semibold">
              {workflowId === 'stl-step'
                ? 'Select reconstructed STEP (not the source STL)'
                : 'Select final guide-curve IGES (not the source PLY)'}
            </label>
            <input
              ref={exportFileRef}
              type="file"
              accept={workflow.exportExtensions.join(',')}
              className="max-w-full text-[#aab5bb] text-[10px]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAttachExport(file);
              }}
            />
          </div>

          {/* Export status */}
          <div className="mt-2 text-[#a2adb3] text-[10px] leading-[1.45]">
            {run.export
              ? `${run.export.name}${run.export.conversion === 'faceted_brep'
                  ? ` · ${run.export.solids} faceted solid${run.export.solids === 1 ? '' : 's'} · kernel checked`
                  : run.export.generated
                  ? ` · generated from ${run.export.traceCount} curvature traces · basic signature OK`
                  : ' · basic signature OK'}`
              : 'No export attached.'}
          </div>

          <div className="mt-3">
            <button
              type="button"
              disabled={!run.exportFormatValid}
              onClick={() => onSetStage(3)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]"
            >
              Continue to validation →
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Validate */}
      {stage === 3 && (
        <div className="p-4">
          <div className="h-px my-3 bg-[#3b4248]" />
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">VALIDATE IN CAD</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">{workflow.validationHelp}</p>

          <div className="grid gap-2 mt-2 p-2.5 border border-[#414a51] bg-[#23282d]">
            {workflow.validationChecks.map((check: [string, string]) => (
              <label key={check[0]} className="flex gap-2 items-start text-[#c2cbd0] text-[10px] leading-[1.4]">
                <input
                  type="checkbox"
                  checked={validationChecks.includes(check[0])}
                  onChange={() => handleToggleValidationCheck(check[0])}
                  className="mt-0.5 accent-[#2874e8]"
                />
                <span>{check[1]}</span>
              </label>
            ))}
          </div>

          <label className="block mt-2.5 text-[#b9c3c8] text-[10px] font-semibold">
            Repair / finishing notes <span className="text-[#829098] font-normal">(optional)</span>
          </label>
          <textarea
            value={validationNotes}
            onChange={(e) => setValidationNotes(e.target.value)}
            maxLength={4000}
            placeholder="Record the application/version, warnings, and repair work needed."
            className="w-full min-h-[54px] p-2 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] resize-y outline-none focus:border-[#4a89e6]"
          />

          <p className="my-2 pl-2 border-l-2 border-[#e5b45b] text-[#c6b184] bg-[#332e24] text-[9px] leading-[1.5] py-2">
            The file marker check is not proof of valid CAD geometry. Confirm the export opens and inspect it in your destination CAD app.
          </p>

          <div className="mt-3">
            <button
              type="button"
              disabled={!run.exportFormatValid || !allValidationChecksDone}
              onClick={() => onValidate(validationChecks, validationNotes)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]"
            >
              Finish validation
            </button>
          </div>

          {run.validated && (
            <div className="mt-3 p-2 border border-[#356c4a] text-[#9cddb2] bg-[#20352a] text-[10px] leading-[1.5]">
              Handoff validated. Export is attached and available for download.
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
