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

export function useInventoryStatuses() {
  const [statuses, setStatuses] = useState<InventoryStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    const { data, error } = await supabase
      .from("inventory_status_config")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) {
      console.error("Error fetching inventory statuses:", error);
      return;
    }
    if (data) {
      setStatuses(
        data.map((s: any) => ({
          id: s.id,
          categoryGroup: s.category_group,
          name: s.name,
          color: s.color,
          orderIndex: s.order_index,
          isActive: s.is_active,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    const channel = supabase
      .channel("inventory-status-config-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_status_config" }, () => {
        fetchStatuses();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStatuses]);

  const hardwareStatuses = useMemo(
    () => statuses.filter((s) => s.categoryGroup === "hardware" && s.isActive).map((s) => s.name),
    [statuses]
  );

  const softwareStatuses = useMemo(
    () => statuses.filter((s) => s.categoryGroup === "software" && s.isActive).map((s) => s.name),
    [statuses]
  );

  const getStatusesForCategory = useCallback(
    (category: string) => {
      if (category === "licencas" || category === "licenses") return softwareStatuses;
      return hardwareStatuses;
    },
    [hardwareStatuses, softwareStatuses]
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
      toast.success(`Status "${name}" criado`);
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
        toast.error("Erro ao atualizar status");
        return;
      }
    },
    []
  );

  const deleteStatus = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("inventory_status_config").delete().eq("id", id as any);
      if (error) {
        toast.error("Erro ao remover status");
        return;
      }
      toast.success("Status removido");
    },
    []
  );

  return {
    statuses,
    loading,
    hardwareStatuses,
    softwareStatuses,
    getStatusesForCategory,
    statusColorMap,
    addStatus,
    updateStatus,
    deleteStatus,
  };
}
