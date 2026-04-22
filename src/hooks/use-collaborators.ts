import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Collaborator {
  name: string;
  assetCount: number;
  categories: string[];
  cargo: string;
  sector: string;
  cost_center: string;
  email_address: string;
}

export interface CollaboratorAsset {
  id: string;
  asset_code: string;
  category: string;
  status: string;
  condition: string;
  model: string;
  asset_type: string;
  service_tag: string;
  service_tag_2: string;
  sector: string;
  cost_center: string;
  cost_center_eng: string;
  cost_center_man: string;
  notes: string;
  delivered_at: string | null;
  created_at: string;
  collaborator: string;
  cargo: string;
  marca: string;
  contrato: string;
  gestor: string;
  email_address: string;
  operadora: string;
  numero: string;
  imei1: string;
  imei2: string;
  licenca: string;
  data_bloqueio: string | null;
  comments: string;
}

export function useCollaborators() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select("collaborator, category, cargo, sector, cost_center, email_address")
      .neq("collaborator", "")
      .not("collaborator", "is", null);

    if (!error && data) {
      const map = new Map<string, { cats: Set<string>; count: number; cargo: string; sector: string; cost_center: string; email_address: string }>();
      for (const row of data) {
        const name = (row.collaborator as string).trim();
        if (!name) continue;
        if (!map.has(name)) {
          map.set(name, { cats: new Set(), count: 0, cargo: "", sector: "", cost_center: "", email_address: "" });
        }
        const entry = map.get(name)!;
        // Skip neutral placeholder category from category/asset counts
        if (row.category !== "colaborador") {
          entry.cats.add(row.category);
          entry.count += 1;
        }
        // Keep first non-empty value found
        if (!entry.cargo && row.cargo) entry.cargo = row.cargo;
        if (!entry.sector && row.sector) entry.sector = row.sector;
        if (!entry.cost_center && row.cost_center) entry.cost_center = row.cost_center;
        if (!entry.email_address && row.email_address) entry.email_address = row.email_address;
      }
      const list: Collaborator[] = Array.from(map.entries())
        .map(([name, info]) => ({
          name,
          assetCount: info.count,
          categories: Array.from(info.cats),
          cargo: info.cargo,
          sector: info.sector,
          cost_center: info.cost_center,
          email_address: info.email_address,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setCollaborators(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCollaborators();
    const channel = supabase
      .channel("collaborators-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => fetchCollaborators())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCollaborators]);

  return { collaborators, loading, refetch: fetchCollaborators };
}

export function useCollaboratorDetail(name: string) {
  const [assets, setAssets] = useState<CollaboratorAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!name) return;
    setLoading(true);

    const { data: items } = await supabase
      .from("inventory")
      .select("*")
      .eq("collaborator", name)
      .neq("category", "colaborador")
      .order("category")
      .order("created_at", { ascending: false });

    if (items) {
      setAssets(items as unknown as CollaboratorAsset[]);
    }
    setLoading(false);
  }, [name]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const updateAsset = useCallback(async (id: string, updates: Partial<CollaboratorAsset>) => {
    const finalUpdates: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Auto-fill data_bloqueio when marking license as Inativo
    if ((updates as any).status === "Inativo") {
      finalUpdates.data_bloqueio = new Date().toISOString().split("T")[0];
    }
    if ((updates as any).status === "Ativo") {
      finalUpdates.data_bloqueio = null;
    }

    const { error } = await supabase.from("inventory").update(finalUpdates as any).eq("id", id);
    if (!error) {
      setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, ...finalUpdates } : a)));
    }
  }, []);

  const deleteAsset = useCallback(async (id: string) => {
    await supabase.from("inventory").delete().eq("id", id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { assets, loading, refetch: fetchDetail, updateAsset, deleteAsset };
}

export function useAvailableStock() {
  const [items, setItems] = useState<CollaboratorAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .or("collaborator.eq.,collaborator.is.null")
      .order("category")
      .order("created_at", { ascending: false });

    if (data) {
      // Also include items with status "Disponível" regardless of collaborator
      const { data: available } = await supabase
        .from("inventory")
        .select("*")
        .eq("status", "Disponível")
        .order("category")
        .order("created_at", { ascending: false });

      // Merge and deduplicate
      const allItems = [...(data || []), ...(available || [])];
      const unique = Array.from(new Map(allItems.map((i: any) => [i.id, i])).values());
      setItems(unique as unknown as CollaboratorAsset[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStock();
    const channel = supabase
      .channel("stock-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => fetchStock())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStock]);

  const assignToCollaborator = useCallback(async (assetId: string, collaboratorName: string) => {
    await supabase.from("inventory").update({
      collaborator: collaboratorName,
      status: "Em uso",
      updated_at: new Date().toISOString(),
    }).eq("id", assetId);
    await fetchStock();
  }, [fetchStock]);

  return { items, loading, refetch: fetchStock, assignToCollaborator };
}
