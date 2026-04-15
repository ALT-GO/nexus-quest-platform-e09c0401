import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CollaboratorDocument {
  id: string;
  collaborator_name: string;
  document_type: string;
  document_url: string;
  document_name: string;
  signed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_TYPES = [
  { value: "pasta_onedrive", label: "Pasta OneDrive" },
  { value: "responsabilidade", label: "Termo de Responsabilidade" },
  { value: "devolucao", label: "Termo de Devolução" },
  { value: "confidencialidade", label: "Termo de Confidencialidade" },
  { value: "outro", label: "Outro" },
] as const;

export function useCollaboratorDocuments(collaboratorName: string) {
  const [documents, setDocuments] = useState<CollaboratorDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("collaborator_documents")
      .select("*")
      .eq("collaborator_name", collaboratorName)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar documentos");
    } else {
      setDocuments((data as any[]) || []);
    }
    setLoading(false);
  }, [collaboratorName]);

  useEffect(() => { fetch(); }, [fetch]);

  const addDocument = async (doc: {
    document_type: string;
    document_url: string;
    document_name: string;
    signed_at?: string | null;
    notes?: string;
  }) => {
    const { error } = await supabase.from("collaborator_documents").insert({
      collaborator_name: collaboratorName,
      ...doc,
    } as any);

    if (error) {
      toast.error("Erro ao adicionar documento");
      return false;
    }
    toast.success("Documento adicionado");
    fetch();
    return true;
  };

  const deleteDocument = async (id: string) => {
    const { error } = await supabase
      .from("collaborator_documents")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir documento");
      return;
    }
    toast.success("Documento excluído");
    fetch();
  };

  const folderLink = documents.find((d) => d.document_type === "pasta_onedrive");
  const termDocuments = documents.filter((d) => d.document_type !== "pasta_onedrive");

  return { documents, termDocuments, folderLink, loading, addDocument, deleteDocument, refetch: fetch };
}
