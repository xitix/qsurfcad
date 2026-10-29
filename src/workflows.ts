import { WorkflowDefinition } from './types';
export type { WorkflowDefinition } from './types';

export const WORKFLOWS: Record<string, WorkflowDefinition> = {
  'stl-step': {
    id: 'stl-step',
    label: 'STL mesh to STEP',
    inputExtension: '.stl',
    exportExtensions: ['.step', '.stp'],
    exportLabel: 'STEP',
    cadTitle: 'REVIEW STL FOR CONVERSION',
    cadDescription:
      'Review the mesh preview, scale, and openings here. Stage 03 converts the STL facets into a closed faceted BREP solid and exports STEP; FreeCAD is only needed to inspect the downloaded result.',
    toleranceLabel: 'Initial fit tolerance',
    toleranceHelp:
      '0.1 mm is a starting point for evaluation, not a validated optimum. Conversion and tolerance application happen in FreeCAD.',
    reviewChecks: [
      ['source_opened', 'Reviewed the STL preview and confirmed source scale and units'],
      ['solid_checked', 'Confirmed the mesh detail is suitable for a faceted STEP solid'],
      ['shape_checked', 'Checked the openings and approximate bounding-box dimensions'],
    ],
    validationChecks: [
      ['opened', 'Reopened the STEP in a destination CAD application'],
      ['solid', 'Confirmed a closed solid (not only a mesh)'],
      ['opening', 'Confirmed the central opening is preserved'],
      ['bounds', 'Bounding-box deviation is within 1% of source'],
      ['edited', 'Made and saved one representative downstream edit'],
    ],
    validationHelp:
      'Open the STEP in FreeCAD, Moi3D, or SolidCraft. Check that it is a closed solid, the central opening remains, and dimensions are within 1% of the source.',
    exportDescription:
      'Convert the uploaded STL to a closed, faceted BREP solid in the app, then download its STEP file. The original mesh facets are preserved; analytic features are not inferred.',
  },
  'ply-iges': {
    id: 'ply-iges',
    label: 'PLY scan to IGES guide curves',
    inputExtension: '.ply',
    exportExtensions: ['.iges', '.igs'],
    exportLabel: 'IGES',
    cadTitle: 'EXTERNAL PLY TRACE TOOL',
    cadDescription:
      'Surfcad overlays connected curvature estimates from adjacent sampled PLY facets in red so you can inspect likely trace paths before Stage 03. These are preview hints, not fitted splines. In your scan/CAD tool, open the PLY with its STEP/IGES reference, apply the confirmed orientation, create or edit guide curves along face/plane junctions, then export the selected editable guide list as IGES.',
    toleranceLabel: 'Curve-fit tolerance',
    toleranceHelp:
      'Compare 0.05, 0.1, and 0.25 mm only when scan resolution supports it. 0.1 mm is an initial setting, not a validated optimum.',
    reviewChecks: [
      ['source_opened', 'Opened the PLY and STEP/IGES reference in a compatible scan/CAD tool and verified scale'],
      ['curves_traced', 'Reviewed guide curves along face/plane junctions against the scan overlay'],
      ['tolerance_compared', 'Checked curve fit, smoothness, and editability in the CAD tool'],
      ['undo_checked', 'Checked curve undo and attraction/sensitivity controls'],
    ],
    validationChecks: [
      ['opened', 'Reopened IGES in a destination CAD application'],
      ['curves', 'Confirmed guide curves are present and editable'],
      ['overlay', 'Checked curves against the source scan'],
      ['deviation', 'Recorded curve-to-scan deviation if available'],
      ['open_surface', 'Confirmed the workflow does not require the scan to be watertight'],
    ],
    validationHelp:
      'Open IGES in Moi3D or SolidCraft. Confirm curves are present, editable, and still align with the scan; note deviation or repair work.',
    exportDescription:
      'Generate an IGES of the reviewed sampled curvature traces, or attach the final guide curves exported from your scan/CAD tool. The app does not send the result to FreeCAD.',
  },
};

export const FLAT_FACE_COLORS = [
  '#38a9ff', '#f2ae54', '#aa8bf2', '#59c8a9',
  '#e77f9d', '#b8ca59', '#e18b4e', '#6db3dc',
];

export const UNIT_TO_MM: Record<string, number> = {
  unknown: 1.0,
  mm: 1.0,
  cm: 10.0,
  m: 1000.0,
  in: 25.4,
};

export const STAGE_TITLES = ['Import / Orient', 'Trace / Review', 'Export', 'Validate'];

export const STAGE_DESCRIPTIONS: Record<string, string[]> = {
  'stl-step': [
    'Start from a broad flat face, align it to the XY plane, then orbit and inspect the part before reconstruction.',
    'Review the STL, confirm its scale and shape, then use Surfcad\'s STEP conversion in Stage 03.',
    'Convert the STL facets into a closed BREP solid and download the STEP result.',
    'Reopen the output in a destination CAD application and record what you verified.',
  ],
  'ply-iges': [
    'Start from a broad flat face, align it to the XY plane, then orbit and inspect the part before reconstruction.',
    'Hand the scan to the appropriate existing tool and review its curves.',
    'Generate an IGES guide estimate from the reviewed curvature traces, or attach a result exported from your CAD tool.',
    'Reopen the output in a destination CAD application and record what you verified.',
  ],
};
