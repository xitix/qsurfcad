import { useState, useRef } from 'react';
import { RunManifest, Stage, MeshPreview, ModificationNote } from '../types';
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
  onAddModification: (mod: ModificationNote) => void;
  onUpdateModification: (id: string, updates: Partial<ModificationNote>) => void;
  onDeleteModification: (id: string) => void;
  onConfirmModifications: (notes: string) => void;
  onConvertToSTEP: () => void;
  onSetCadTool: (toolId: string) => void;
  onValidate: (notes: string) => void;
  onSetStage: (stage: Stage) => void;
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
  stageInfo,
  run,
  preview,
  flatFaceIndex,
  onFlatFaceIndexChange,
  onImportSTL,
  onConfirmOrientation,
  onSetOrientation,
  onSetUnits,
  onSetScale,
  onAddModification,
  onUpdateModification,
  onDeleteModification,
  onConfirmModifications,
  onConvertToSTEP,
  onSetCadTool,
  onValidate,
  onSetStage,
  message,
  onMessageChange,
}: InspectorProps) {
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [sourceUnits, setSourceUnits] = useState('mm');
  const [knownSize, setKnownSize] = useState('');
  const [knownAxis, setKnownAxis] = useState<'x' | 'y' | 'z'>('x');
  const [modType, setModType] = useState<ModificationNote['type']>('dimension');
  const [modDescription, setModDescription] = useState('');
  const [modPriority, setModPriority] = useState<ModificationNote['priority']>('medium');
  const [reviewNotes, setReviewNotes] = useState('');
  const [validationNotes, setValidationNotes] = useState('');
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

    onConfirmOrientation([rotationX, rotationY, rotationZ], scale, unit);
  };

  const handleAddMod = () => {
    if (!modDescription.trim()) return;
    const mod: ModificationNote = {
      id: crypto.randomUUID(),
      type: modType,
      description: modDescription,
      priority: modPriority,
      done: false,
    };
    onAddModification(mod);
    setModDescription('');
  };

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

  const flatRegions = preview?.flatRegions || (preview?.flatRegion ? [preview.flatRegion] : []);
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
      <div className="px-4 pt-4 pb-3.5 border-b border-[#3b4248]">
        <span className="text-[#8e989e] text-[9px] font-bold tracking-[1.2px]">
          STAGE {String(stage + 1).padStart(2, '0')} / 04
        </span>
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl"
              className="max-w-full text-[#aab5bb] text-[10px]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportSTL(file);
              }}
            />
          </div>

          <div className="mt-2 text-[#a2adb3] text-[10px] leading-[1.45]">
            {run.input ? `Loaded: ${run.input.name} (${(run.input.size / 1024).toFixed(1)} KB)` : 'No STL file selected.'}
          </div>

          <div className="h-px my-3 bg-[#3b4248]" />

          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">MESH ANALYSIS</h2>
          <dl className="m-0">
            {[
              ['Format', preview ? preview.format : '—'],
              ['Vertices', preview ? preview.vertices.toLocaleString() : '—'],
              ['Triangles', preview ? preview.triangles.toLocaleString() : '—'],
              ['Bounds X / Y / Z', preview ? `${preview.bounds.map(v => formatNumber(v)).join(' × ')} ${sourceUnits}` : '—'],
              ['Flat regions', preview?.flatRegions ? `${preview.flatRegions.length} detected` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] gap-2.5 py-1 border-b border-[#353c42] text-[10px]">
                <dt className="text-[#99a4aa]">{label}</dt>
                <dd className="m-0 text-[#dae0e3] text-right">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Flat region card */}
          <div className="mt-3 p-2 border border-[#414a51] bg-[#23282d]">
            <strong className="text-[#bcc5ca] text-[9px] tracking-[1px]">FLAT FACE · NORMAL AXIS</strong>
            <p className="my-1.5 text-[#aeb8bd] text-[10px] leading-[1.45]">
              {flatRegions.length > 0
                ? `${flatRegions.length} planar regions detected · largest: ${normalAxisLabel(flatRegions[flatFaceIndex]?.normal || [0, 0, 1])}${isFlatFaceAligned() ? ' · level with XY' : ' · align before continuing'}`
                : 'No connected planar regions detected. Orient manually.'}
            </p>
            <label className="block my-2 text-[#b9c3c8] text-[10px] font-semibold">Detected planar regions</label>
            <div className="grid max-h-[190px] gap-1 overflow-y-auto p-1 border border-[#414a51] bg-[#1d2226]">
              {flatRegions.length === 0 ? (
                <span className="text-[#8e9ba2] text-[9px] p-2">Import an STL to detect planar regions.</span>
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
                    <span className="w-2.5 h-6 border border-[#aebbc2aa] rounded-sm shrink-0"
                      style={{ backgroundColor: FLAT_FACE_COLORS[index % FLAT_FACE_COLORS.length] }} />
                    <span className="grid gap-0.5 min-w-0">
                      <strong className="text-[9px] font-semibold truncate">
                        Face {index + 1} · {region.side} · {normalAxisLabel(region.normal)}
                      </strong>
                      <small className="text-[#8e9ba2] text-[8px]">
                        {region.previewAreaPercent}% area · {region.previewFacets} facets
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
              {isFlatFaceAligned() ? '✓ Flat face aligned with XY' : 'Align selected flat face to XY'}
            </button>
          </div>

          {/* Units & Scale */}
          <label className="block mt-2.5 text-[#b9c3c8] text-[10px] font-semibold">Source units</label>
          <select
            value={sourceUnits}
            onChange={(e) => { setSourceUnits(e.target.value); onSetUnits(e.target.value); }}
            className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none"
          >
            <option value="unknown">Unknown — verify a known measurement</option>
            <option value="mm">Millimetres</option>
            <option value="cm">Centimetres</option>
            <option value="m">Metres</option>
            <option value="in">Inches</option>
          </select>

          <div className="h-px my-3 bg-[#3b4248]" />

          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">ORIENTATION</h2>
          {([
            ['Rotate X', rotationX, 0],
            ['Rotate Y', rotationY, 1],
            ['Rotate Z', rotationZ, 2],
          ] as const).map(([label, value, axis]) => (
            <div key={label} className="grid grid-cols-[1fr_95px_28px] gap-2 items-center my-2 text-[#aeb8bd] text-[10px]">
              <label>{label}</label>
              <input type="number" step="1" value={value}
                onChange={(e) => handleRotationChange(axis, Number(e.target.value))}
                className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] text-right outline-none" />
              <span className="text-[#87939a]">deg</span>
            </div>
          ))}

          <button type="button"
            onClick={() => { setRotationX(0); setRotationY(0); setRotationZ(0); onSetOrientation([0, 0, 0]); }}
            className="w-full mt-2 min-h-[30px] py-1.5 px-2.5 border border-[#4a535b] rounded-sm text-[#cad2d7] bg-[#30363c] text-[10px] font-semibold cursor-pointer hover:bg-[#3a4248]">
            Reset rotation
          </button>

          {/* Verify scale */}
          <h2 className="mt-3 mb-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">VERIFY SCALE</h2>
          <label className="block mt-2 text-[#b9c3c8] text-[10px] font-semibold">Known full-axis span ({sourceUnits})</label>
          <input type="number" min="0.001" step="any" value={knownSize}
            onChange={(e) => setKnownSize(e.target.value)}
            placeholder="e.g. measured width of the object"
            className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none" />
          <div className="grid grid-cols-[1fr_120px] gap-2 items-center mt-2 text-[#aeb8bd] text-[10px]">
            <label>Measured along</label>
            <select value={knownAxis} onChange={(e) => setKnownAxis(e.target.value as 'x' | 'y' | 'z')}
              className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none">
              <option value="x">X span</option>
              <option value="y">Y span</option>
              <option value="z">Z span</option>
            </select>
          </div>
          <p className="min-h-[15px] text-[#9ca8ae] text-[9px] leading-[1.5] mt-1">{getScaleResult()}</p>

          <div className="mt-3">
            <button type="button" disabled={!run.input}
              onClick={handleConfirmOrientation}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]">
              Confirm orientation → Plan modifications
            </button>
          </div>
        </div>
      )}

      {/* Stage 1: Plan Modifications */}
      {stage === 1 && (
        <div className="p-4">
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">MODIFICATION PLAN</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
            Document every change needed before converting to STEP. This becomes your editing checklist in CAD.
          </p>

          {/* Add modification */}
          <div className="p-2.5 border border-[#414a51] bg-[#23282d] mt-2">
            <label className="block text-[#b9c3c8] text-[10px] font-semibold mb-1">Add modification</label>
            <select value={modType} onChange={(e) => setModType(e.target.value as ModificationNote['type'])}
              className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none mb-2">
              {MODIFICATION_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
              ))}
            </select>
            <input type="text" value={modDescription}
              onChange={(e) => setModDescription(e.target.value)}
              placeholder="e.g. Increase overall length from 120mm to 135mm"
              className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none mb-2" />
            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <select value={modPriority} onChange={(e) => setModPriority(e.target.value as ModificationNote['priority'])}
                className="w-full min-h-[29px] px-2 py-1.5 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] outline-none">
                <option value="high">⚑ High priority</option>
                <option value="medium">⚐ Medium priority</option>
                <option value="low">⚏ Low priority</option>
              </select>
              <button type="button" onClick={handleAddMod} disabled={!modDescription.trim()}
                className="min-h-[29px] px-3 py-1.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3986fa]">
                + Add
              </button>
            </div>
          </div>

          {/* Modification list */}
          {run.modifications.length > 0 && (
            <div className="mt-3">
              <label className="block text-[#b9c3c8] text-[10px] font-semibold mb-1">
                Planned modifications ({run.modifications.length})
              </label>
              <div className="grid gap-1.5 max-h-[300px] overflow-y-auto">
                {run.modifications.map(mod => {
                  const typeInfo = MODIFICATION_TYPES.find(t => t.id === mod.type);
                  return (
                    <div key={mod.id} className={`flex items-start gap-2 p-2 border rounded-sm ${
                      mod.done ? 'border-[#356c4a] bg-[#20352a]' : 'border-[#414a51] bg-[#23282d]'
                    }`}>
                      <input type="checkbox" checked={mod.done}
                        onChange={(e) => onUpdateModification(mod.id, { done: e.target.checked })}
                        className="mt-0.5 accent-[#2874e8]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px]" style={{ color: typeInfo?.color }}>{typeInfo?.icon}</span>
                          <span className="text-[9px] font-semibold" style={{ color: typeInfo?.color }}>{typeInfo?.label}</span>
                          <span className={`text-[8px] px-1 rounded ${
                            mod.priority === 'high' ? 'bg-[#5a2a2a] text-[#f0a0a0]' :
                            mod.priority === 'medium' ? 'bg-[#4a3a20] text-[#e5b45b]' :
                            'bg-[#2a3a4a] text-[#8ab4d8]'
                          }`}>{mod.priority}</span>
                        </div>
                        <p className="m-0 mt-1 text-[#c9d1d5] text-[10px] leading-[1.4]">{mod.description}</p>
                      </div>
                      <button type="button" onClick={() => onDeleteModification(mod.id)}
                        className="text-[#87939a] hover:text-[#f0a0a0] text-[12px] cursor-pointer shrink-0">×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label className="block mt-3 text-[#b9c3c8] text-[10px] font-semibold">
            Additional notes <span className="text-[#829098] font-normal">(optional)</span>
          </label>
          <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
            maxLength={4000}
            placeholder="Overall notes about the object, material, intended use, special considerations…"
            className="w-full min-h-[54px] p-2 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] resize-y outline-none" />

          <div className="mt-3">
            <button type="button"
              onClick={() => onConfirmModifications(reviewNotes)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer hover:bg-[#3986fa]">
              Confirm plan → Convert to STEP
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Convert to STEP */}
      {stage === 2 && (
        <div className="p-4">
          <h2 className="my-2 text-[#bcc5ca] text-[9px] font-bold tracking-[1px]">CONVERT TO EDITABLE STEP</h2>
          <p className="my-1.5 text-[#929da3] text-[10px] leading-[1.55]">
            Convert the oriented STL into a closed faceted BREP solid. The resulting STEP file contains editable vertices, edges, and faces that you can modify in any CAD tool.
          </p>

          {/* Conversion summary */}
          <div className="p-2.5 border border-[#414a51] bg-[#23282d] mt-2">
            <strong className="text-[#bcc5ca] text-[9px] tracking-[1px]">CONVERSION SUMMARY</strong>
            <dl className="m-0 mt-2">
              {[
                ['Source', run.input?.name || '—'],
                ['Triangles', preview ? preview.triangles.toLocaleString() : '—'],
                ['Bounds', preview ? `${preview.bounds.map(v => (v * run.orientation.scale).toFixed(1)).join(' × ')} ${run.orientation.units}` : '—'],
                ['Orientation', `X ${formatNumber(run.orientation.rotation[0])}° · Y ${formatNumber(run.orientation.rotation[1])}° · Z ${formatNumber(run.orientation.rotation[2])}°`],
                ['Scale', `${run.orientation.scale.toFixed(4)}×`],
                ['Modifications', `${run.modifications.length} planned`],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[1fr_auto] gap-2.5 py-1 border-b border-[#353c42] text-[10px]">
                  <dt className="text-[#99a4aa]">{label}</dt>
                  <dd className="m-0 text-[#dae0e3] text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <button type="button" onClick={onConvertToSTEP}
            className="w-full mt-3 min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer hover:bg-[#3986fa]">
            {run.export ? '✓ Regenerate STEP file' : 'Convert STL → STEP BREP solid'}
          </button>

          {run.export && (
            <div className="mt-3 p-2 border border-[#356c4a] bg-[#20352a] text-[#9cddb2] text-[10px] leading-[1.5]">
              <strong>STEP generated:</strong> {run.export.name}<br />
              {run.export.triangles?.toLocaleString()} facets → {run.export.solids} solid · {(run.export.boundsMm || []).map(v => v.toFixed(1)).join(' × ')} mm
            </div>
          )}

          <p className="my-2 pl-2 border-l-2 border-[#e5b45b] text-[#c6b184] bg-[#332e24] text-[9px] leading-[1.5] py-2">
            The STEP output preserves the original mesh facets as a closed BREP solid. Analytic features (planes, cylinders) are not inferred — you'll need to refine them in your CAD tool using the modification plan.
          </p>

          <div className="mt-3">
            <button type="button" disabled={!run.export}
              onClick={() => onSetStage(3)}
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
            Select your target CAD tool and use the modification plan as your editing checklist.
          </p>

          {/* CAD tool selection */}
          <div className="grid gap-2 mt-2">
            {CAD_TOOLS.map(tool => (
              <button key={tool.id} type="button"
                onClick={() => onSetCadTool(tool.id)}
                className={`flex items-center gap-2 p-2 border rounded-sm text-left cursor-pointer ${
                  run.targetCadTool === tool.id
                    ? 'border-[#4a87ad] bg-[#263b49]'
                    : 'border-[#414a51] bg-[#23282d] hover:bg-[#2a3036]'
                }`}>
                <span className="grid w-7 h-7 place-items-center border border-[#52616a] rounded-sm text-[#81b0f2] text-[15px] shrink-0">
                  {tool.icon}
                </span>
                <div className="grid gap-0.5 min-w-0">
                  <strong className="text-[10px]">{tool.name}</strong>
                  <small className="text-[#9ba6ac] text-[9px]">{tool.platform}</small>
                </div>
                {run.targetCadTool === tool.id && (
                  <span className="ml-auto text-[#67c38c] text-[10px]">✓</span>
                )}
              </button>
            ))}
          </div>

          {/* Selected tool info */}
          {(() => {
            const tool = CAD_TOOLS.find(t => t.id === run.targetCadTool);
            if (!tool) return null;
            return (
              <div className="mt-3 p-2 border border-[#424b52] bg-[#22272c]">
                <strong className="text-[10px]">{tool.name}</strong>
                <p className="m-0 mt-1 text-[#9ba6ac] text-[9px] leading-[1.5]">{tool.description}</p>
                <div className="mt-2">
                  <small className="text-[#8e989e] text-[9px]">Best for:</small>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tool.bestFor.map(use => (
                      <span key={use} className="px-1.5 py-0.5 border border-[#4a525a] rounded-sm text-[#c9d0d4] bg-[#2d3339] text-[9px]">{use}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Modification checklist reminder */}
          {run.modifications.length > 0 && (
            <div className="mt-3">
              <label className="block text-[#b9c3c8] text-[10px] font-semibold mb-1">
                Modification checklist ({run.modifications.filter(m => m.done).length}/{run.modifications.length} done in CAD)
              </label>
              <div className="grid gap-1 max-h-[200px] overflow-y-auto p-2 border border-[#414a51] bg-[#1d2226]">
                {run.modifications.map(mod => {
                  const typeInfo = MODIFICATION_TYPES.find(t => t.id === mod.type);
                  return (
                    <div key={mod.id} className="flex items-center gap-2 text-[10px]">
                      <span style={{ color: typeInfo?.color }}>{typeInfo?.icon}</span>
                      <span className={`truncate ${mod.done ? 'text-[#67c38c] line-through' : 'text-[#c9d1d5]'}`}>
                        {mod.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <label className="block mt-3 text-[#b9c3c8] text-[10px] font-semibold">
            Validation notes <span className="text-[#829098] font-normal">(optional)</span>
          </label>
          <textarea value={validationNotes} onChange={(e) => setValidationNotes(e.target.value)}
            maxLength={4000}
            placeholder="Record what you verified in CAD: dimensions checked, features modified, issues found…"
            className="w-full min-h-[54px] p-2 border border-[#4b545b] rounded-sm bg-[#20252a] text-[#e1e6e9] text-[10px] resize-y outline-none" />

          <div className="mt-3">
            <button type="button" onClick={() => onValidate(validationNotes)}
              className="w-full min-h-[30px] py-2 px-2.5 border border-[#3982ee] rounded-sm text-white bg-[#286fda] text-[10px] font-semibold cursor-pointer hover:bg-[#3986fa]">
              {run.validated ? '✓ Project complete' : 'Finish & save project'}
            </button>
          </div>

          {run.validated && (
            <div className="mt-3 p-2 border border-[#356c4a] text-[#9cddb2] bg-[#20352a] text-[10px] leading-[1.5]">
              ✓ Project complete. STEP file generated and modification plan documented.
              {run.targetCadTool === 'solidcraft' && (
                <><br /><br />When SolidCraft web-app is ready, this project will sync directly to your make3d.ro repository.</>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
