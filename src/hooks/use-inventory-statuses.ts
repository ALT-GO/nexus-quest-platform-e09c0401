import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InventoryStatus {
  id: string;
  categoryGroup: string;
  name: string;
  color: string;
  orderIndex: number;
  isActive: boolean;
}

/**
 * Resolve which config group powers a given inventory category + field.
 * - Hardware (notebooks/celulares/tablets/perifericos) → "Condição" → group "condition_hardware"
 * - Linhas → "Status" → group "status_linhas"
 * - Licenças → "Status" → group "status_licencas"
 */
export function resolveStatusGroup(category: string, field: "condition" | "status" = "status"): string {
  const cat = (category || "").toLowerCase();
  if (cat === "linhas" || cat === "telecom") return "status_linhas";
  if (cat === "licencas" || cat === "licenses") return "status_licencas";
  // hardware → only "condition" is editable
  return "condition_hardware";
}

/* ─────────────────────────────────────────────────────────────
 * Singleton store: ONE fetch + ONE realtime channel for the
 * whole app. Components subscribe via useSyncExternalStore so
 * we avoid N fetches / N channels when dozens of cells mount.
 * ──────────────────────────────────────────────────────────── */
let cache: InventoryStatus[] = [];
let loaded = false;
let loadingPromise: Promise<void> | null = null;
let channelRef: ReturnType<typeof supabase.channel> | null = null;
let refCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function fetchOnce(force = false): Promise<void> {
  if (loaded && !force) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const { data, error } = await supabase
      .from("inventory_status_config")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) {
      console.error("Error fetching inventory statuses:", error);
      loadingPromise = null;
      return;
    }
    if (data) {
      cache = data.map((s: any) => ({
        id: s.id,
        categoryGroup: s.category_group,
        name: s.name,
        color: s.color,
        orderIndex: s.order_index,
        isActive: s.is_active,
      }));
      loaded = true;
      emit();
    }
    loadingPromise = null;
  })();

  return loadingPromise;
}

function subscribeToRealtime() {
  if (channelRef) return;
  channelRef = supabase
    .channel("inventory-status-config-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inventory_status_config" },
      () => {
        fetchOnce(true);
      }
    )
    .subscribe();
}

function unsubscribeFromRealtime() {
  if (channelRef) {
    supabase.removeChannel(channelRef);
    channelRef = null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  refCount += 1;
  // Lazy init on first subscriber
  if (refCount === 1) {
    subscribeToRealtime();
  }
  // Trigger initial fetch (no-op if already loaded)
  fetchOnce();
  return () => {
    listeners.delete(listener);
    refCount -= 1;
    if (refCount === 0) {
      unsubscribeFromRealtime();
    }
  };
}

const getSnapshot = () => cache;
const getServerSnapshot = () => cache;

export function useInventoryStatuses() {
  const statuses = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [loadingState, setLoadingState] = useState(!loaded);

  useEffect(() => {
    if (loaded) {
      setLoadingState(false);
      return;
    }
    let cancelled = false;
    fetchOnce().then(() => {
      if (!cancelled) setLoadingState(false);
    });
    return () => { cancelled = true; };
  }, []);

  const getStatusesByGroup = useCallback(
    (group: string) =>
      statuses
        .filter((s) => s.categoryGroup === group && s.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => s.name),
    [statuses]
  );

  /**
   * Returns options for the Status field based on category.
   * - Hardware → returns Condição options (since hardware doesn't have a separate Status field anymore).
   * - Linhas → returns status_linhas
   * - Licenças → returns status_licencas
   */
  const getStatusesForCategory = useCallback(
    (category: string) => getStatusesByGroup(resolveStatusGroup(category, "status")),
    [getStatusesByGroup]
  );

  /** Returns Condição options (hardware only) */
  const conditionOptions = useMemo(
    () =>
      statuses
        .filter((s) => s.categoryGroup === "condition_hardware" && s.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [statuses]
  );

  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    statuses.forEach((s) => {
      map[s.name] = s.color;
    });
    return map;
  }, [statuses]);

  const addStatus = useCallback(
    async (categoryGroup: string, name: string, color: string) => {
      const maxOrder = Math.max(...statuses.filter((s) => s.categoryGroup === categoryGroup).map((s) => s.orderIndex), 0);
      const { error } = await supabase.from("inventory_status_config").insert({
        category_group: categoryGroup,
        name,
        color,
        order_index: maxOrder + 1,
        is_active: true,
      } as any);
      if (error) {
        toast.error("Erro ao criar status");
        return;
      }
      toast.success(`"${name}" criado`);
    },
    [statuses]
  );

  const updateStatus = useCallback(
    async (id: string, updates: Partial<Pick<InventoryStatus, "name" | "color" | "isActive" | "orderIndex">>) => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.orderIndex !== undefined) dbUpdates.order_index = updates.orderIndex;

      const { error } = await supabase.from("inventory_status_config").update(dbUpdates).eq("id", id as any);
      if (error) {
        toast.error("Erro ao atualizar");
        return;
      }
    },
    []
  );

  const deleteStatus = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("inventory_status_config").delete().eq("id", id as any);
      if (error) {
        toast.error("Erro ao remover");
        return;
      }
      toast.success("Removido");
    },
    []
  );

  return {
    statuses,
    loading: loadingState,
    conditionOptions,
    getStatusesByGroup,
    getStatusesForCategory,
    statusColorMap,
    addStatus,
    updateStatus,
    deleteStatus,
  };
}
