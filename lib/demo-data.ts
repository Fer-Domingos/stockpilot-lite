export type AppRole = 'ADMIN' | 'PM';

export type Job = {
  id: string;
  number: string;
  name: string;
};

export type InventoryLocation = {
  id: string;
  type: 'SHOP' | 'JOB';
  name: string;
  jobId?: string;
};

export type MaterialInventory = {
  locationId: string;
  quantity: number;
};

export type MaterialRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  inventory: MaterialInventory[];
  unit: string;
  minQuantity: number;
  costPerUnit: number;
  supplier: string;
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

export const jobs: Job[] = [
  { id: 'job-aspen', number: 'J-24031', name: 'Aspen Residence' },
  { id: 'job-bayside', number: 'J-24044', name: 'Bayside Condos' },
  { id: 'job-creek', number: 'J-24051', name: 'Creekside Kitchen' }
];

export const inventoryLocations: InventoryLocation[] = [
  { id: 'shop', type: 'SHOP', name: 'Shop' },
  ...jobs.map((job) => ({
    id: `loc-${job.id}`,
    type: 'JOB' as const,
    name: `${job.number} ${job.name}`,
    jobId: job.id
  }))
];

const shopLocationId = 'shop';

export const materials: MaterialRow[] = [
  {
    id: 'mat-1',
    sku: 'MDF-3/4-ARAUCO',
    name: 'MDF 3/4 in 4x8 Arauco',
    category: 'Sheet Goods',
    inventory: [
      { locationId: shopLocationId, quantity: 42 },
      { locationId: 'loc-job-creek', quantity: 6 }
    ],
    unit: 'Sheets',
    minQuantity: 20,
    costPerUnit: 43.75,
    supplier: 'Northwest Panels'
  },
  {
    id: 'mat-2',
    sku: 'PLY-BB-3/4',
    name: 'Baltic Birch 3/4 in 5x5',
    category: 'Sheet Goods',
    inventory: [
      { locationId: shopLocationId, quantity: 16 },
      { locationId: 'loc-job-aspen', quantity: 8 }
    ],
    unit: 'Sheets',
    minQuantity: 18,
    costPerUnit: 71.2,
    supplier: 'Timber Source'
  },
  {
    id: 'mat-3',
    sku: 'EB-PVC-WHT-23',
    name: 'Edge Banding PVC White 23mm',
    category: 'Edgebanding',
    inventory: [{ locationId: shopLocationId, quantity: 29 }],
    unit: 'Rolls',
    minQuantity: 10,
    costPerUnit: 31.4,
    supplier: 'FastEdge Supply'
  },
  {
    id: 'mat-4',
    sku: 'BLUM-TANDEM-18',
    name: 'Blum Tandem Drawer Slides 18in',
    category: 'Hardware',
    inventory: [
      { locationId: shopLocationId, quantity: 12 },
      { locationId: 'loc-job-bayside', quantity: 56 }
    ],
    unit: 'Pairs',
    minQuantity: 24,
    costPerUnit: 19.8,
    supplier: 'Cabinet Hardware Direct'
  },
  {
    id: 'mat-5',
    sku: 'SCREW-8X1-1/4',
    name: 'Confirmat Screw 8x1-1/4',
    category: 'Fasteners',
    inventory: [
      { locationId: shopLocationId, quantity: 6200 },
      { locationId: 'loc-job-aspen', quantity: 880 },
      { locationId: 'loc-job-creek', quantity: 400 }
    ],
    unit: 'Each',
    minQuantity: 500,
    costPerUnit: 0.09,
    supplier: 'Fixings Pro'
  },
  {
    id: 'mat-6',
    sku: 'HPL-ANTHRACITE',
    name: 'HPL Laminate Anthracite',
    category: 'Laminate',
    inventory: [{ locationId: shopLocationId, quantity: 7 }],
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
  ADMIN: 'Full access to receive, transfer, issue, manage inventory, review all alerts, and manage system data.',
  PM: 'Read-only inventory, reports/history access, PO alert creation, and visibility limited to their own alerts.'
};

export function getLocationName(locationId: string) {
  return inventoryLocations.find((location) => location.id === locationId)?.name ?? locationId;
}

export function getMaterialTotalQuantity(material: MaterialRow) {
  return material.inventory.reduce((sum, entry) => sum + entry.quantity, 0);
}

export function summarizeInventory() {
  const lowStock = materials.filter((item) => getMaterialTotalQuantity(item) <= item.minQuantity).length;
  const totalSku = materials.length;
  const inventoryValue = materials.reduce((sum, item) => sum + getMaterialTotalQuantity(item) * item.costPerUnit, 0);

  return {
    lowStock,
    totalSku,
    inventoryValue,
    openJobs: jobs.length
  };
}
