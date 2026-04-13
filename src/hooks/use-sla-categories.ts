import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SlaCategoryConfig {
  id: string;
  category: string;
  sla_hours: number;
}

const DEFAULT_SLA_MAP: Record<string, number> = {
  "Acesso e permissões": 4,
  "Problemas com Computador/Notebook": 8,
  "Problemas com Celular/Tablet": 8,
  "Rede e Internet": 4,
  "E-mail e Comunicação": 4,
  "Serviços de Impressão": 8,
  "Sistemas Corporativos": 8,
  "Solicitação de novo Computador/Notebook": 72,
  "Solicitação de novo Celular": 72,
  "Solicitação de Tablet": 72,
  "Gerais/Outros": 24,
};

export function useSlaCategoryConfig() {
  const [configs, setConfigs] = useState<SlaCategoryConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    const { data } = await supabase
      .from("sla_category_config")
      .select("*")
      .order("category");

    if (data) {
      setConfigs(data as SlaCategoryConfig[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const updateSlaHours = useCallback(async (id: string, sla_hours: number) => {
    const { error } = await supabase
      .from("sla_category_config")
      .update({ sla_hours, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setConfigs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, sla_hours } : c))
      );
    }
    return !error;
  }, []);

  const addCategory = useCallback(async (category: string, sla_hours: number) => {
    const { data, error } = await supabase
      .from("sla_category_config")
      .insert({ category, sla_hours })
      .select()
      .single();
    if (!error && data) {
      setConfigs((prev) => [...prev, data as SlaCategoryConfig].sort((a, b) => a.category.localeCompare(b.category)));
    }
    return !error;
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("sla_category_config")
      .delete()
      .eq("id", id);
    if (!error) {
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    }
    return !error;
  }, []);

  // Build a map for quick lookup
  const slaMap: Record<string, number> = {};
  for (const c of configs) {
    slaMap[c.category] = c.sla_hours;
  }

  return {
    configs,
    loading,
    slaMap,
    updateSlaHours,
    addCategory,
    deleteCategory,
    refetch: fetchConfigs,
  };
}

/** Fetch SLA map once (for non-hook contexts like createTicket) */
export async function fetchSlaCategoryMap(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("sla_category_config")
    .select("category, sla_hours");

  if (data && data.length > 0) {
    const map: Record<string, number> = {};
    for (const row of data as { category: string; sla_hours: number }[]) {
      map[row.category] = row.sla_hours;
    }
    return map;
  }
  return { ...DEFAULT_SLA_MAP };
}
