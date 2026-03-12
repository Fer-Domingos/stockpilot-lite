'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { jobs as seedJobs, materials as seedMaterials } from '@/lib/demo-data';

export type ManagedMaterial = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  minStock: number;
  notes: string;
};

export type JobStatus = 'Open' | 'In Progress' | 'On Hold' | 'Completed';

export type ManagedJob = {
  id: string;
  number: string;
  name: string;
  status: JobStatus;
};

type DemoStoreContextValue = {
  materials: ManagedMaterial[];
  jobs: ManagedJob[];
  addMaterial: (payload: Omit<ManagedMaterial, 'id'>) => void;
  updateMaterial: (id: string, payload: Omit<ManagedMaterial, 'id'>) => void;
  deleteMaterial: (id: string) => void;
  addJob: (payload: Omit<ManagedJob, 'id'>) => void;
  updateJob: (id: string, payload: Omit<ManagedJob, 'id'>) => void;
  deleteJob: (id: string) => void;
};

const DemoStoreContext = createContext<DemoStoreContextValue | null>(null);

const MATERIALS_STORAGE_KEY = 'stockpilot.materials.v1';
const JOBS_STORAGE_KEY = 'stockpilot.jobs.v1';

function getSeedMaterials(): ManagedMaterial[] {
  return seedMaterials.map((material) => ({
    id: material.id,
    name: material.name,
    sku: material.sku,
    unit: material.unit,
    minStock: material.minQuantity,
    notes: material.supplier
  }));
}

function getSeedJobs(): ManagedJob[] {
  return seedJobs.map((job) => ({
    id: job.id,
    number: job.number,
    name: job.name,
    status: 'Open'
  }));
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [materials, setMaterials] = useState<ManagedMaterial[]>(() => getSeedMaterials());
  const [jobs, setJobs] = useState<ManagedJob[]>(() => getSeedJobs());

  useEffect(() => {
    const storedMaterials = window.localStorage.getItem(MATERIALS_STORAGE_KEY);
    const storedJobs = window.localStorage.getItem(JOBS_STORAGE_KEY);

    if (storedMaterials) {
      try {
        setMaterials(JSON.parse(storedMaterials) as ManagedMaterial[]);
      } catch {
        setMaterials(getSeedMaterials());
      }
    }

    if (storedJobs) {
      try {
        setJobs(JSON.parse(storedJobs) as ManagedJob[]);
      } catch {
        setJobs(getSeedJobs());
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(materials));
  }, [materials]);

  useEffect(() => {
    window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const value = useMemo<DemoStoreContextValue>(
    () => ({
      materials,
      jobs,
      addMaterial: (payload) => {
        setMaterials((current) => [...current, { ...payload, id: randomId('mat') }]);
      },
      updateMaterial: (id, payload) => {
        setMaterials((current) => current.map((material) => (material.id === id ? { ...payload, id } : material)));
      },
      deleteMaterial: (id) => {
        setMaterials((current) => current.filter((material) => material.id !== id));
      },
      addJob: (payload) => {
        setJobs((current) => [...current, { ...payload, id: randomId('job') }]);
      },
      updateJob: (id, payload) => {
        setJobs((current) => current.map((job) => (job.id === id ? { ...payload, id } : job)));
      },
      deleteJob: (id) => {
        setJobs((current) => current.filter((job) => job.id !== id));
      }
    }),
    [jobs, materials]
  );

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore() {
  const context = useContext(DemoStoreContext);

  if (!context) {
    throw new Error('useDemoStore must be used inside DemoStoreProvider');
  }

  return context;
}
