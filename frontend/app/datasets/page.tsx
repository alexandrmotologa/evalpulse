"use client";

import { useEffect, useState } from "react";
import { Dataset, fetchDatasets } from "@/lib/api";
import DatasetTable from "@/components/DatasetTable";
import { Database, Plus } from "lucide-react";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchDatasets();
        setDatasets(data);
      } catch (err) {
        console.error("Failed to fetch datasets", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
          <Database className="h-3.5 w-3.5" />
          Golden Test Sets
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Evaluation Datasets</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Curated ground-truth test cases and JSON schema definitions used to benchmark model outputs.
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
          Loading datasets...
        </div>
      ) : (
        <DatasetTable datasets={datasets} />
      )}
    </div>
  );
}
