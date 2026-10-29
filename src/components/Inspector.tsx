import { useState, useRef } from 'react';
import { RunManifest, Stage, MeshPreview, DrawTool, ModificationNote } from '../types';
import { STAGE_INFO, CAD_TOOLS, MODIFICATION_TYPES, FLAT_FACE_COLORS } from '../cadTools';

interface InspectorProps {
  stage: Stage;
  stageInfo: typeof STAGE_INFO[0];
  run: RunManifest;
  preview: MeshPreview | null;
  flatFaceIndex: number;
  onFlatFaceIndexChange: (index: number) => void;
  onImportSTL: (file: File) => void | Promise<void>;
  onConfirmOrientation: (rotation: [number, number, number], scale: number, units: string) => void;
  onSetOrientation: (rotation: [number, number, number]) => void;
  onSetUnits: (units: string) => void;
  onSetScale: (scale: number) => void;
  drawTool: DrawTool;
  onDrawToolChange: (tool: DrawTool) => void;
  activeSketchId: string | null;
  onSetActiveSketchId: (id: string | null) => void;
  onDeleteSketchElement: (elementId: string) => void;
  onConfirmSketches: (notes: string) => void;
  onSkipSketch: () => void;
  onExportProject: (format: 'step' | 'iges' | 'dxf' | 'stl' | 'json') => void;
  onSetCadTool: (toolId: string) => void;
  onValidate: (notes: string) => void;
  onSetStage: (stage: Stage) => void;
  onAddModification: (mod: ModificationNote) => void;
  onUpdateModification: (id: string, updates: Partial<ModificationNote>) => void;
  onDeleteModification: (id: string) => void;
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
  const axis = normal.reduce((best, value, index) => Math.abs(value) > Math.abs(normal[best]) ? index : best, 0);
  return `${normal[axis] < 0 ? '-' : '+'}${'XYZ'[axis]}`;
}

const DRAW_TOOLS: { id: DrawTool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'Select', icon: '⊹', hint: 'Orbit / zoom' },
  { id: 'line', label: 'Line', icon: '╱', hint: 'Click 2 points' },
  { id: 'polyline', label: 'Polyline', icon: '⌇', hint: 'Click points, dbl-click to end' },
  { id: 'circle3p', label: '3-pt Circle', icon: '◯', hint: 'Click 3 points' },
  { id: 'arc3p', label: '3-pt Arc', icon: '◠', hint: 'Click 3 points' },
  { id: 'spline', label: 'Spline', icon: '∿', hint: 'Click points, Enter to end' },
];

export function Inspector(props: InspectorProps) {
  const {
    stage, stageInfo, run, preview, flatFaceIndex,
    onFlatFaceIndexChange, onImportSTL, onConfirmOrientation,
    onSetOrientation, onSetUnits, onSetScale,
    drawTool, onDrawToolChange, activeSketchId, onSetActiveSketchId,
    onDeleteSketchElement, onConfirmSketches, onSkipSketch, onExportProject,
    onSetCadTool, onValidate, onSetStage,
    onAddModification, onUpdateModification, onDeleteModification,
    message, onMessageChange,
  } = props;

  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [sourceUnits, setSourceUnits] = useState('mm');
  const [knownSize, setKnownSize] = useState('');
  const [knownAxis, setKnownAxis] = useState<'x' | 'y' | 'z'>('x');
  const [reviewNotes, setReviewNotes] = useState('');
  const [validationNotes, setValidationNotes] = useState('');
  const [modType, setModType] = useState<ModificationNote['type']>('dimension');
  const [modDescription, setModDescription] = useState('');
  const [modPriority, setModPriority] = useState<ModificationNote['priority']>('medium');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onMessageChange('Flat-face alignment applied. Orbit and inspect the part.');
  };

  const handleConfirmOrientation = () => {
    const unit = sourceUnits;
    let scale = run.orientation.scale;
    const known = Number(knownSize);
    const axisIdx = ['x', 'y', 'z'].indexOf(knownAxis);
    if (known > 0 && preview) {
      const unitMm: Record<string, number> = { unknown: 1, mm: 1, cm: 10, m: 1000, in: 25.4 };
      const actualUnit = unit === 'unknown' ? 'mm' : unit;
      scale = known / preview.bounds[axisIdx] / (unitMm[actualUnit] || 1);
    }
    onConfirmOrientation([rotationX, rotationY, rotationZ], scale, unit);
  };

  const handleAddMod = () => {
    if (!modDescription.trim()) return;
    onAddModification({
      id: crypto.randomUUID(),
      type: modType,
      description: modDescription,
      priority: modPriority,
      done: false,
    });
    setModDescription('');
  };

  const flatRegions = preview?.flatRegions || (preview?.flatRegion ? [preview.flatRegion] : []);
  const isFlatFaceAligned = () => {
    const flatRegion = preview?.flatRegions?.[flatFaceIndex] || preview?.flatRegion;
    if (!flatRegion) return false;
    const rx = rotationX * Math.PI / 180;
    const ry = rotationY * Math.PI / 180;
    const rz = rotationZ * Math.PI / 180;
    let [x, y, z] = flatRegion.normal;
    [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    return Math.abs(z) >= 0.98;
  };

  const getScaleResult = () => {
    const known = Number(knownSize);
    if (!known || !preview) return 'Enter the known full span of the selected X, Y, or Z axis.';
    const unitMm: Record<string, number> = { unknown: 1, mm: 1, cm: 10, m: 1000, in: 25.4 };
    const axisIdx = ['x', 'y', 'z'].indexOf(knownAxis);
    const unit = sourceUnits === 'unknown' ? 'mm' : sourceUnits;
    const scale = known / preview.bounds[axisIdx] / (unitMm[unit] || 1);
    return `Suggested scale: ${formatNumber(scale)}×`;
  };

  const activeSketch = run.sketches.find(s => s.id === activeSketchId);
  const totalElements = run.sketches.reduce((sum, s) => sum + s.elements.length, 0);

  return (
    <aside className="flex flex-col min-w-0 w-[330px] overflow-y-auto border-l border-[#111315] bg-[#282d32]">
      <div className="px-4 pt-4 pb-3.5 border-b border-[#3b4248]">
        <span className="text-[#8e989e] text-[9px] font-bold tracking-[1.2px]">STAGE {String(stage + 1).padStart(2, '0')} / 04</span>
        <h1 className="my-1 text-[17px] font-semibold">{stageInfo.title}</h1>
        <p className="m-0 text-[#a4afb5] text-[11px] leading-[1.5]">{stageInfo.description}</p>
      </div>

      {/* Stage 0: Import & Analyze */}
      {stage === 0 && (
        <div className="p-4">
          <div className="grid gap-2 p-3 border border-dashed border-[#59646c] rounded-sm bg-[#23282d]">
            <label className="grid justify-items-center gap-1 cursor-pointer">
              <span className="grid w-[26px] h-[26px] place-items-center border border-[#57636a] rounded-full text-[#78aefa] text-[17px]">↑</span>
              <strong className="text-[#dbe1e4] text-[11px] font-semibold">Choose STL file</strong>
              <small className="text-[#95a0a6] text-[9px]">Binary or ASCII STL</small>
            </label>
            <input ref={fileInputRef} type="file" accept=".stl"
              className="max-w-full text-[#aab5bb] text-[10px]"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onImportSTL(file); }} />
          </div>
          <div className="mt-2 text-[#a2adb3] text-[10px]">{run.input ? `Loaded: ${run.input.name} (${(run.input.size / 1024).toFixed(1)} KB)` : 'No STL file selected.'}</div>

          <div className="h-px my-3 bg-[#3b4248]" />
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">MESH ANALYSIS</h2>
          <dl className="m-0">
            {[
              ['Format', preview ? preview.format : '—'],
              ['Vertices', preview ? preview.vertices.toLocaleString() : '—'],
              ['Triangles', preview ? preview.triangles.toLocaleString() : '—'],
              ['Flat regions', preview?.flatRegions ? `${preview.flatRegions.length} detected` : '—'],
              ['Boundary edges', preview?.boundaryEdges ? `${preview.boundaryEdges.length} found` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] gap-2.5 py-1 border-b border-[#353c42] text-[10px]">
                <dt className="text-[#99a4aa]">{label}</dt>
                <dd className="m-0 text-[#dae0e3] text-right">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Flat region card */}
          <div className="mt-3 p-2 border border-[#414a51] bg-[#23282d]">
            <strong className="text-[#bcc5ca] text-[9px] tracking-[1px]">FLAT FACE · ORIENTATION</strong>
            <p className="my-1.5 text-[#aeb8bd] text-[10px] leading-[1.45]">
              {flatRegions.length > 0
                ? `${flatRegions.length} planar regions · largest: ${normalAxisLabel(flatRegions[flatFaceIndex]?.normal || [0, 0, 1])}${isFlatFaceAligned() ? ' · ✓ level with XY' : ' · align before continuing'}`
                : 'No planar regions detected. Orient manually.'}
            </p>
            <div className="grid max-h-[190px] gap-1 overflow-y-auto p-1 border border-[#414a51] bg-[#1d2226]">
              {flatRegions.length === 0 ? (
                <span className="text-[#8e9ba2] text-[9px] p-2">Import an STL to detect planar regions.</span>
              ) : flatRegions.map((region, index) => (
                <button key={index} type="button" onClick={() => onFlatFaceIndexChange(index)}
                  className={`flex min-h-[34px] items-center gap-2 p-1.5 text-left border rounded-sm cursor-pointer ${
                    index === flatFaceIndex ? 'border-[#4a87ad] bg-[#263b49]' : 'border-transparent bg-[#272d32] hover:bg-[#313940]'
                  }`}>
                  <span className="w-2.5 h-6 border border-[#aebbc2aa] rounded-sm shrink-0"
                    style={{ backgroundColor: FLAT_FACE_COLORS[index % FLAT_FACE_COLORS.length] }} />
                  <span className="grid gap-0.5 min-w-0">
                    <strong className="text-[9px] font-semibold truncate text-[#cbd4d9]">
                      Face {index + 1} · {region.side} · {normalAxisLabel(region.normal)}
                    </strong>
                    <small className="text-[#8e9ba2] text-[8px]">{region.previewAreaPercent}% · {region.previewFacets} facets</small>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" disabled={flatRegions.length === 0 || isFlatFaceAligned()}
              onClick={handleAlignFlatFace}
              className="w-full mt-2 min-h-[30px] py-1.5 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3a4248]">
              {isFlatFaceAligned() ? '✓ Flat face aligned with XY' : 'Align selected flat face to XY'}
            </button>
          </div>

          <label className="block mt-2.5 text-[#b9c3c8] text-[10px] font-semibold">Source units</label>
          <select value={sourceUnits} onChange={(e) => { setSourceUnits(e.target.value); onSetUnits(e.target.value); }}
            className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none">
            <option value="unknown">Unknown — verify a known measurement</option>
            <option value="mm">Millimetres</option>
            <option value="cm">Centimetres</option>
            <option value="m">Metres</option>
            <option value="in">Inches</option>
          </select>

          <div className="h-px my-3 bg-[#3b4248]" />
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">ORIENTATION</h2>
          {([['Rotate X', rotationX, 0], ['Rotate Y', rotationY, 1], ['Rotate Z', rotationZ, 2]] as const).map(([label, value, axis]) => (
            <div key={label} className="grid grid-cols-[1fr_95px_28px] gap-2 items-center my-2 text-[#aeb8bd] text-[10px]">
              <label>{label}</label>
              <input type="number" step="1" value={value}
                onChange={(e) => handleRotationChange(axis, Number(e.target.value))}
                className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] text-right outline-none" />
              <span className="text-[#87939a]">deg</span>
            </div>
          ))}

          <h2 className="mt-3 mb-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">VERIFY SCALE</h2>
          <label className="block mt-2 text-[#b9c3c8] text-[10px] font-semibold">Known full-axis span ({sourceUnits})</label>
          <input type="number" min="0.001" step="any" value={knownSize}
            onChange={(e) => setKnownSize(e.target.value)} placeholder="e.g. measured width"
            className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none" />
          <div className="grid grid-cols-[1fr_120px] gap-2 items-center mt-2 text-[#aeb8bd] text-[10px]">
            <label>Measured along</label>
            <select value={knownAxis} onChange={(e) => setKnownAxis(e.target.value as 'x' | 'y' | 'z')}
              className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none">
              <option value="x">X span</option><option value="y">Y span</option><option value="z">Z span</option>
            </select>
          </div>
          <p className="min-h-[15px] text-[#9ca8ae] text-[9px] mt-1">{getScaleResult()}</p>

          <div className="mt-3">
            <button type="button" disabled={!run.input} onClick={handleConfirmOrientation}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]">
              Confirm orientation → Sketch on faces
            </button>
          </div>
        </div>
      )}

      {/* Stage 1: Sketch on Faces */}
      {stage === 1 && (
        <div className="p-4">
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">SKETCH PLANES</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
            One sketch plane per detected flat face. Draw lines, circles, arcs and polylines on each face to define the edges of primitives.
          </p>

          {/* Sketch list */}
          <div className="grid gap-1 mt-2">
            {run.sketchPlanes.map((plane, idx) => {
              const sketch = run.sketches[idx];
              const isActive = sketch?.id === activeSketchId;
              return (
                <button key={plane.id} type="button" onClick={() => sketch && onSetActiveSketchId(sketch.id)}
                  className={`flex items-center gap-2 p-2 border rounded-sm text-left cursor-pointer ${
                    isActive ? 'border-[#4a87ad] bg-[#263b49]' : 'border-[#414a51] bg-[#23282d] hover:bg-[#2a3036]'
                  }`}>
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: sketch?.color || '#888' }} />
                  <span className="flex-1 min-w-0">
                    <strong className="text-[10px] text-[#dae0e3]">{plane.label}</strong>
                    <small className="block text-[#8e989e] text-[9px]">
                      {sketch ? `${sketch.elements.length} elements · normal ${normalAxisLabel(plane.normal)}` : 'No sketch'}
                    </small>
                  </span>
                  {isActive && <span className="text-[#67c38c] text-[10px]">●</span>}
                </button>
              );
            })}
          </div>

          {/* Drawing tools */}
          {activeSketch && (
            <>
              <div className="h-px my-3 bg-[#3b4248]" />
              <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">DRAWING TOOLS</h2>
              <div className="grid grid-cols-3 gap-1">
                {DRAW_TOOLS.map(tool => (
                  <button key={tool.id} type="button" onClick={() => onDrawToolChange(tool.id)}
                    title={tool.hint}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 border rounded-sm text-[10px] cursor-pointer ${
                      drawTool === tool.id
                        ? 'border-[#4a89e6] bg-[#263b49] text-[#d3dade]'
                        : 'border-[#414a51] bg-[#23282d] text-[#aeb8bd] hover:bg-[#2a3036]'
                    }`}>
                    <span className="text-[14px]">{tool.icon}</span>
                    <span className="text-[8px]">{tool.label}</span>
                  </button>
                ))}
              </div>
              <p className="my-1.5 text-[#929da3] text-[9px] leading-[1.45]">
                {DRAW_TOOLS.find(t => t.id === drawTool)?.hint}
                {(drawTool === 'polyline' || drawTool === 'spline') && ' · Press Enter to close, Esc to cancel'}
              </p>

              {/* Sketch elements list */}
              {activeSketch.elements.length > 0 && (
                <div className="mt-2">
                  <label className="block text-[#b9c3c8] text-[10px] font-semibold mb-1">
                    Elements ({activeSketch.elements.length})
                  </label>
                  <div className="grid gap-1 max-h-[200px] overflow-y-auto p-1 border border-[#414a51] bg-[#1d2226]">
                    {activeSketch.elements.map((el, idx) => (
                      <div key={el.id} className="flex items-center justify-between gap-2 p-1.5 border border-[#353c42] rounded-sm bg-[#23282d] text-[10px]">
                        <span className="text-[#c9d1d5]">
                          <span className="text-[#8e989e]">{idx + 1}.</span> {el.type}
                          <span className="text-[#8e989e] ml-1">
                            ({el.type === 'line' ? '2 pts' : el.type === 'circle3p' || el.type === 'arc3p' ? '3 pts' : `${el.points.length} pts`})
                          </span>
                        </span>
                        <button type="button" onClick={() => onDeleteSketchElement(el.id)}
                          className="text-[#87939a] hover:text-[#f0a0a0] text-[12px] cursor-pointer">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <label className="block mt-3 text-[#b9c3c8] text-[10px] font-semibold">
            Notes <span className="text-[#829098] font-normal">(optional)</span>
          </label>
          <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
            maxLength={4000} placeholder="Notes about the sketch, identified features, intended primitives…"
            className="w-full min-h-[54px] p-2 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] resize-y outline-none" />

          <div className="mt-3 space-y-2">
            <button type="button" disabled={totalElements === 0}
              onClick={() => onConfirmSketches(reviewNotes)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]">
              Validate sketches → Export
            </button>
            <button type="button"
              onClick={onSkipSketch}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer hover:bg-[#3a4248]">
              Skip sketching → Export
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Export */}
      {stage === 2 && (
        <div className="p-4">
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">EXPORT PROJECT</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
            Export the project data (orientation, sketches, primitives) for import into your CAD tool. The CAD tool will use the sketches to reconstruct parametric solids.
          </p>

          <div className="p-2.5 border border-[#414a51] bg-[#23282d] mt-2">
            <strong className="text-[#bcc5ca] text-[9px] tracking-[1px]">PROJECT SUMMARY</strong>
            <dl className="m-0 mt-2">
              {[
                ['Source', run.input?.name || '—'],
                ['Sketch planes', `${run.sketchPlanes.length}`],
                ['Total sketch elements', `${totalElements}`],
                ['Orientation', `X ${formatNumber(run.orientation.rotation[0])}° · Y ${formatNumber(run.orientation.rotation[1])}° · Z ${formatNumber(run.orientation.rotation[2])}°`],
                ['Scale', `${run.orientation.scale.toFixed(4)}×`],
                ['Units', run.orientation.units],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[1fr_auto] gap-2.5 py-1 border-b border-[#353c42] text-[10px]">
                  <dt className="text-[#99a4aa]">{label}</dt>
                  <dd className="m-0 text-[#dae0e3] text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-2 mt-3">
            <button type="button" onClick={() => onExportProject('dxf')}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer hover:bg-[#3986fa]">
              Export sketches as DXF (FreeCAD / SolidCraft / MOI3D)
            </button>
            <button type="button" onClick={() => onExportProject('stl')}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer hover:bg-[#3a4248]">
              Export oriented mesh as STL
            </button>
            <button type="button" onClick={() => onExportProject('json')}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer hover:bg-[#3a4248]">
              Export project data as JSON (backup)
            </button>
          </div>
          <p className="my-2 pl-2 border-l-2 border-[#e5b45b] text-[#c6b184] bg-[#332e24] text-[9px] leading-[1.5] py-2">
            <strong>Workflow:</strong> Export DXF → Import into CAD → Reconstruct parametric solids from sketches.
            The DXF contains your traced sketches as 2D/3D curves ready for extrusion, revolution, or other CAD operations.
          </p>

          {run.export && (
            <div className="mt-3 p-2 border border-[#356c4a] bg-[#20352a] text-[#9cddb2] text-[10px] leading-[1.5]">
              ✓ Exported: {run.export.name}
            </div>
          )}

          <div className="mt-3">
            <button type="button" disabled={!run.export} onClick={() => onSetStage(3)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]">
              Continue → Route to CAD tool
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Route to CAD */}
      {stage === 3 && (
        <div className="p-4">
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">ROUTE TO CAD TOOL</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
            Import the exported file into your target CAD tool. Use the modification plan as your editing checklist.
          </p>

          <div className="grid gap-2 mt-2">
            {CAD_TOOLS.map(tool => (
              <button key={tool.id} type="button" onClick={() => onSetCadTool(tool.id)}
                className={`flex items-center gap-2 p-2 border rounded-sm text-left cursor-pointer ${
                  run.targetCadTool === tool.id ? 'border-[#4a87ad] bg-[#263b49]' : 'border-[#414a51] bg-[#23282d] hover:bg-[#2a3036]'
                }`}>
                <span className="grid w-7 h-7 place-items-center border border-[#52616a] rounded-sm text-[#81b0f2] text-[15px] shrink-0">{tool.icon}</span>
                <div className="grid gap-0.5 min-w-0">
                  <strong className="text-[10px]">{tool.name}</strong>
                  <small className="text-[#9ba6ac] text-[9px]">{tool.platform}</small>
                </div>
                {run.targetCadTool === tool.id && <span className="ml-auto text-[#67c38c] text-[10px]">✓</span>}
              </button>
            ))}
          </div>

          {/* Modifications */}
          <div className="h-px my-3 bg-[#3b4248]" />
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">MODIFICATION PLAN</h2>
          <div className="p-2.5 border border-[#414a51] bg-[#23282d]">
            <select value={modType} onChange={(e) => setModType(e.target.value as ModificationNote['type'])}
              className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none mb-2">
              {MODIFICATION_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <input type="text" value={modDescription} onChange={(e) => setModDescription(e.target.value)}
              placeholder="e.g. Increase length from 120mm to 135mm"
              className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none mb-2" />
            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <select value={modPriority} onChange={(e) => setModPriority(e.target.value as ModificationNote['priority'])}
                className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none">
                <option value="high">⚑ High</option><option value="medium">⚐ Medium</option><option value="low">⚏ Low</option>
              </select>
              <button type="button" onClick={handleAddMod} disabled={!modDescription.trim()}
                className="min-h-[29px] px-3 py-1.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]">
                + Add
              </button>
            </div>
          </div>

          {run.modifications.length > 0 && (
            <div className="mt-2 grid gap-1 max-h-[200px] overflow-y-auto">
              {run.modifications.map(mod => {
                const typeInfo = MODIFICATION_TYPES.find(t => t.id === mod.type);
                return (
                  <div key={mod.id} className={`flex items-start gap-2 p-2 border rounded-sm ${mod.done ? 'border-[#356c4a] bg-[#20352a]' : 'border-[#414a51] bg-[#23282d]'}`}>
                    <input type="checkbox" checked={mod.done} onChange={(e) => onUpdateModification(mod.id, { done: e.target.checked })} className="mt-0.5 accent-[#2874e8]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px]" style={{ color: typeInfo?.color }}>{typeInfo?.icon}</span>
                        <span className="text-[9px] font-semibold" style={{ color: typeInfo?.color }}>{typeInfo?.label}</span>
                      </div>
                      <p className="m-0 mt-1 text-[#c9d1d5] text-[10px]">{mod.description}</p>
                    </div>
                    <button type="button" onClick={() => onDeleteModification(mod.id)} className="text-[#87939a] hover:text-[#f0a0a0] text-[12px] cursor-pointer shrink-0">×</button>
                  </div>
                );
              })}
            </div>
          )}

          <label className="block mt-3 text-[#b9c3c8] text-[10px] font-semibold">Validation notes</label>
          <textarea value={validationNotes} onChange={(e) => setValidationNotes(e.target.value)}
            maxLength={4000} placeholder="Record what you verified in CAD…"
            className="w-full min-h-[54px] p-2 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] resize-y outline-none" />

          <div className="mt-3">
            <button type="button" onClick={() => onValidate(validationNotes)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer hover:bg-[#3986fa]">
              {run.validated ? '✓ Project complete' : 'Finish & save project'}
            </button>
          </div>

          {run.validated && (
            <div className="mt-3 p-2 border border-[#356c4a] text-[#9cddb2] bg-[#20352a] text-[10px] leading-[1.5]">
              ✓ Project complete. Sketches and modification plan documented.
              {run.targetCadTool === 'solidcraft' && <><br /><br />When SolidCraft web-app is ready, this project will sync to your make3d.ro repository.</>}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
