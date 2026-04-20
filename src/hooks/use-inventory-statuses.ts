import { useState, useEffect, useCallback, useMemo } from "react";
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

export function resolveStatusGroup(category: string, field: "condition" | "status" = "status"): string {
  const cat = (category || "").toLowerCase();
  if (cat === "linhas" || cat === "telecom") return "status_linhas";
  if (cat === "licencas" || cat === "licenses") return "status_licencas";
  return "condition_hardware";
}

/* ─────────────────────────────────────────────────────────────
 * Shared cache + single realtime channel for the whole app.
 * Multiple components consume the same in-memory snapshot and
 * are notified through a simple event emitter, avoiding N
 * fetches / N subscriptions when many cells mount at once.
 * ──────────────────────────────────────────────────────────── */
type Listener = (data: InventoryStatus[]) => void;

const store = {
  data: [] as InventoryStatus[],
  loaded: false,
  inflight: null as Promise<void> | null,
  channel: null as ReturnType<typeof supabase.channel> | null,
  listeners: new Set<Listener>(),
};

function emit() {
  store.listeners.forEach((l) => l(store.data));
}

async function loadStatuses(force = false) {
  if (store.loaded && !force) return;
  if (store.inflight) return store.inflight;

  store.inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_status_config")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Error fetching inventory statuses:", error);
        return;
      }
      store.data = (data || []).map((s: any) => ({
        id: s.id,
        categoryGroup: s.category_group,
        name: s.name,
        color: s.color,
        orderIndex: s.order_index,
        isActive: s.is_active,
      }));
      store.loaded = true;
      emit();
    } finally {
      store.inflight = null;
    }
  })();

  return store.inflight;
}

function ensureRealtime() {
  if (store.channel) return;
  store.channel = supabase
    .channel("inventory-status-config-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inventory_status_config" },
      () => loadStatuses(true)
    )
    .subscribe();
}

export function useInventoryStatuses() {
  const [statuses, setStatuses] = useState<InventoryStatus[]>(store.data);
  const [loading, setLoading] = useState(!store.loaded);

  useEffect(() => {
    const listener: Listener = (data) => setStatuses(data);
    store.listeners.add(listener);
    ensureRealtime();

    loadStatuses().then(() => {
      setStatuses(store.data);
      setLoading(false);
    });

    return () => {
      store.listeners.delete(listener);
    };
  }, []);

  const getStatusesByGroup = useCallback(
    (group: string) =>
      statuses
        .filter((s) => s.categoryGroup === group && s.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => s.name),
    [statuses]
  );

  const getStatusesForCategory = useCallback(
    (category: string) => getStatusesByGroup(resolveStatusGroup(category, "status")),
    [getStatusesByGroup]
  );

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
      const maxOrder = Math.max(
        ...statuses.filter((s) => s.categoryGroup === categoryGroup).map((s) => s.orderIndex),
        0
      );
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
      // Optimistic update for instant UI feedback
      const previous = store.data;
      store.data = store.data.map((s) => (s.id === id ? { ...s, ...updates } : s));
      emit();

      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.orderIndex !== undefined) dbUpdates.order_index = updates.orderIndex;

      const { error } = await supabase.from("inventory_status_config").update(dbUpdates).eq("id", id as any);
      if (error) {
        // Rollback
        store.data = previous;
        emit();
        toast.error("Erro ao atualizar");
        return;
      }
    },
    []
  );

  const deleteStatus = useCallback(
    async (id: string) => {
      // Optimistic delete
      const previous = store.data;
      store.data = store.data.filter((s) => s.id !== id);
      emit();

      const { error } = await supabase.from("inventory_status_config").delete().eq("id", id as any);
      if (error) {
        store.data = previous;
        emit();
        toast.error("Erro ao remover");
        return;
      }
      toast.success("Removido");
    },
    []
  );

  return {
    statuses,
    loading,
    conditionOptions,
    getStatusesByGroup,
    getStatusesForCategory,
    statusColorMap,
    addStatus,
    updateStatus,
    deleteStatus,
  };
}
