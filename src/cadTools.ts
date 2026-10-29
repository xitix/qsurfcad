import { CadTool } from './types';

export const CAD_TOOLS: CadTool[] = [
  {
    id: 'solidcraft',
    name: 'SolidCraft',
    description: 'Browser-based parametric CAD. Future web-app linked to make3d.ro repository.',
    platform: 'Web (future) / Desktop',
    icon: '◆',
    bestFor: ['Parametric editing', 'Dimension-driven design', 'Production-ready parts'],
    available: false,
  },
  {
    id: 'freecad',
    name: 'FreeCAD',
    description: 'Open-source parametric 3D CAD modeler. Native STEP/IGES support.',
    platform: 'Desktop (Linux/Win/Mac)',
    icon: '⬡',
    bestFor: ['Complex assemblies', 'Parametric constraints', 'Free/open-source workflow'],
    available: true,
  },
  {
    id: 'moi3d',
    name: 'MOI3D',
    description: 'NURBS-based modeler. Runs via WineHQ/Bottles/Proton on Linux.',
    platform: 'Windows (Wine/Bottles)',
    icon: '◈',
    bestFor: ['Organic shapes', 'Smooth surfaces', 'Quick concept modeling'],
    available: true,
  },
  {
    id: 'onshape',
    name: 'Onshape',
    description: 'Cloud-native CAD. Full parametric modeling in browser.',
    platform: 'Web (cloud)',
    icon: '◇',
    bestFor: ['Cloud collaboration', 'Version control', 'No-install workflow'],
    available: true,
  },
];

export const STAGE_INFO = [
  {
    title: 'Import & Analyze',
    subtitle: 'Load STL, measure, orient',
    description: 'Import the scanned STL, verify its dimensions against the physical object, detect flat faces for alignment, and set the correct orientation and scale.',
  },
  {
    title: 'Plan Modifications',
    subtitle: 'Annotate changes needed',
    description: 'Document every modification needed: dimension changes, new grips, fixture points, insert locations, cutouts, fillets. This becomes your editing checklist in CAD.',
  },
  {
    title: 'Convert to STEP',
    subtitle: 'STL → editable BREP',
    description: 'Convert the oriented STL mesh into a closed faceted BREP solid exported as STEP. This gives you an editable solid in any CAD tool — vertices, edges, and faces you can modify.',
  },
  {
    title: 'Route to CAD',
    subtitle: 'Open in your tool',
    description: 'Download the STEP file and open it in your preferred CAD tool. Use the modification plan as your editing checklist. Verify dimensions and features match the physical object.',
  },
];

export const MODIFICATION_TYPES = [
  { id: 'dimension', label: 'Dimension change', icon: '↔', color: '#2874e8' },
  { id: 'grip', label: 'Add grip/handle', icon: '⊕', color: '#67c38c' },
  { id: 'fixture', label: 'Add fixture point', icon: '⊞', color: '#e5b45b' },
  { id: 'insert', label: 'Add insert/boss', icon: '⊙', color: '#aa8bf2' },
  { id: 'cutout', label: 'Cutout/pocket', icon: '⊟', color: '#e77f9d' },
  { id: 'fillet', label: 'Fillet/chamfer', icon: '◠', color: '#59c8a9' },
  { id: 'other', label: 'Other', icon: '•', color: '#b8ca59' },
] as const;

export const FLAT_FACE_COLORS = [
  '#38a9ff', '#f2ae54', '#aa8bf2', '#59c8a9',
  '#e77f9d', '#b8ca59', '#e18b4e', '#6db3dc',
];
