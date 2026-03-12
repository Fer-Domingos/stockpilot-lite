export type AppRole = 'Admin' | 'Engineer / PM';

export type MaterialRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  costPerUnit: number;
  supplier: string;
};

export type JobLocation = {
  id: string;
  code: string;
  name: string;
  stage: string;
};

export type TransactionRow = {
  id: string;
  date: string;
  type: 'Receive' | 'Transfer' | 'Issue' | 'Adjustment';
  materialSku: string;
  materialName: string;
  quantity: number;
  unit: string;
  from: string;
  to: string;
  user: string;
  notes: string;
};

export const jobLocations: JobLocation[] = [
  { id: 'job-aspen', code: 'J-24031', name: 'Aspen Residence', stage: 'Install' },
  { id: 'job-bayside', code: 'J-24044', name: 'Bayside Condos', stage: 'Production' },
  { id: 'job-creek', code: 'J-24051', name: 'Creekside Kitchen', stage: 'Cut List' }
];

export const materials: MaterialRow[] = [
  {
    id: 'mat-1', sku: 'MDF-3/4-ARAUCO',
    name: 'MDF 3/4 in 4x8 Arauco',
    category: 'Sheet Goods',
    location: 'Shop',
    quantity: 42,
    unit: 'Sheets',
    minQuantity: 20,
    costPerUnit: 43.75,
    supplier: 'Northwest Panels'
  },
  {
    id: 'mat-2', sku: 'PLY-BB-3/4',
    name: 'Baltic Birch 3/4 in 5x5',
    category: 'Sheet Goods',
    location: 'Shop',
    quantity: 16,
    unit: 'Sheets',
    minQuantity: 18,
    costPerUnit: 71.2,
    supplier: 'Timber Source'
  },
  {
    id: 'mat-3', sku: 'EB-PVC-WHT-23',
    name: 'Edge Banding PVC White 23mm',
    category: 'Edgebanding',
    location: 'Shop',
    quantity: 29,
    unit: 'Rolls',
    minQuantity: 10,
    costPerUnit: 31.4,
    supplier: 'FastEdge Supply'
  },
  {
    id: 'mat-4', sku: 'BLUM-TANDEM-18',
    name: 'Blum Tandem Drawer Slides 18in',
    category: 'Hardware',
    location: 'J-24044 Bayside Condos',
    quantity: 56,
    unit: 'Pairs',
    minQuantity: 24,
    costPerUnit: 19.8,
    supplier: 'Cabinet Hardware Direct'
  },
  {
    id: 'mat-5', sku: 'SCREW-8X1-1/4',
    name: 'Confirmat Screw 8x1-1/4',
    category: 'Fasteners',
    location: 'J-24031 Aspen Residence',
    quantity: 880,
    unit: 'Each',
    minQuantity: 500,
    costPerUnit: 0.09,
    supplier: 'Fixings Pro'
  },
  {
    id: 'mat-6', sku: 'HPL-ANTHRACITE',
    name: 'HPL Laminate Anthracite',
    category: 'Laminate',
    location: 'Shop',
    quantity: 7,
    unit: 'Sheets',
    minQuantity: 8,
    costPerUnit: 98.5,
    supplier: 'Surface Masters'
  }
];

export const transactions: TransactionRow[] = [
  {
    id: 'txn-1',
    date: '2026-03-10 07:48',
    type: 'Receive',
    materialSku: 'PLY-BB-3/4',
    materialName: 'Baltic Birch 3/4 in 5x5',
    quantity: 20,
    unit: 'Sheets',
    from: 'Timber Source PO-8431',
    to: 'Shop',
    user: 'Alex Ramirez',
    notes: 'Morning truck unload'
  },
  {
    id: 'txn-2',
    date: '2026-03-10 10:22',
    type: 'Transfer',
    materialSku: 'BLUM-TANDEM-18',
    materialName: 'Blum Tandem Drawer Slides 18in',
    quantity: 24,
    unit: 'Pairs',
    from: 'Shop',
    to: 'J-24044 Bayside Condos',
    user: 'Jordan Lee',
    notes: 'Tower B kitchens'
  },
  {
    id: 'txn-3',
    date: '2026-03-10 13:05',
    type: 'Issue',
    materialSku: 'EB-PVC-WHT-23',
    materialName: 'Edge Banding PVC White 23mm',
    quantity: 3,
    unit: 'Rolls',
    from: 'Shop',
    to: 'Production',
    user: 'Alex Ramirez',
    notes: 'Cabinet run 4'
  },
  {
    id: 'txn-4',
    date: '2026-03-11 08:35',
    type: 'Transfer',
    materialSku: 'SCREW-8X1-1/4',
    materialName: 'Confirmat Screw 8x1-1/4',
    quantity: 400,
    unit: 'Each',
    from: 'J-24031 Aspen Residence',
    to: 'J-24051 Creekside Kitchen',
    user: 'Morgan Shah',
    notes: 'Surplus reallocation'
  },
  {
    id: 'txn-5',
    date: '2026-03-11 14:10',
    type: 'Adjustment',
    materialSku: 'HPL-ANTHRACITE',
    materialName: 'HPL Laminate Anthracite',
    quantity: -1,
    unit: 'Sheets',
    from: 'Shop',
    to: 'Shop',
    user: 'Alex Ramirez',
    notes: 'Damaged sheet on arrival'
  }
];

export const rolePermissions: Record<AppRole, string> = {
  Admin: 'Full access to receiving, transfers, history, and reports.',
  'Engineer / PM': 'Read-only KPI and reports visibility for planning and forecasting.'
};

export function summarizeInventory() {
  const lowStock = materials.filter((item) => item.quantity <= item.minQuantity).length;
  const totalSku = materials.length;
  const inventoryValue = materials.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);

  return {
    lowStock,
    totalSku,
    inventoryValue,
    openJobs: jobLocations.length
  };
}
