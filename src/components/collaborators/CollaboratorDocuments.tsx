import { useState } from "react";
import { useCollaboratorDocuments, DOCUMENT_TYPES } from "@/hooks/use-collaborator-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { FolderOpen, FileText, Plus, ExternalLink, Trash2, Loader2, Link as LinkIcon } from "lucide-react";

function isOneDriveUrl(url: string) {
  return /onedrive|sharepoint|1drv\.ms/i.test(url);
}

function getTypeLabel(type: string) {
  return DOCUMENT_TYPES.find((t) => t.value === type)?.label || type;
}

function getTypeColor(type: string) {
  switch (type) {
    case "responsabilidade": return "bg-blue-500/15 text-blue-700 border-blue-300";
    case "devolucao": return "bg-amber-500/15 text-amber-700 border-amber-300";
    case "confidencialidade": return "bg-purple-500/15 text-purple-700 border-purple-300";
    default: return "bg-muted text-muted-foreground";
  }
}

export function CollaboratorDocuments({ collaboratorName }: { collaboratorName: string }) {
  const { termDocuments, folderLink, loading, addDocument, deleteDocument } = useCollaboratorDocuments(collaboratorName);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

  const [docType, setDocType] = useState("responsabilidade");
  const [docUrl, setDocUrl] = useState("");
  const [docName, setDocName] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [notes, setNotes] = useState("");

  const [folderUrl, setFolderUrl] = useState("");

  const resetForm = () => {
    setDocType("responsabilidade");
    setDocUrl("");
    setDocName("");
    setSignedAt("");
    setNotes("");
  };

  const handleAddDoc = async () => {
    if (!docUrl.trim()) return;
    const ok = await addDocument({
      document_type: docType,
      document_url: docUrl.trim(),
      document_name: docName.trim() || getTypeLabel(docType),
      signed_at: signedAt || null,
      notes: notes.trim(),
    });
    if (ok) {
      resetForm();
      setDialogOpen(false);
    }
  };

  const handleSetFolder = async () => {
    if (!folderUrl.trim()) return;
    if (folderLink) {
      await deleteDocument(folderLink.id);
    }
    const ok = await addDocument({
      document_type: "pasta_onedrive",
      document_url: folderUrl.trim(),
      document_name: "Pasta OneDrive",
    });
    if (ok) {
      setFolderUrl("");
      setFolderDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Documentos e Termos
          <Badge variant="secondary" className="ml-1">{termDocuments.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {folderLink ? (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={folderLink.document_url} target="_blank" rel="noopener noreferrer">
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Abrir Pasta</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            setFolderUrl(folderLink?.document_url || "");
            setFolderDialogOpen(true);
          }}>
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{folderLink ? "Editar Pasta" : "Vincular Pasta"}</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Adicionar Termo</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {termDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum termo vinculado. Use "Adicionar Termo" para vincular documentos do OneDrive.
          </p>
        ) : (
          <div className="space-y-2">
            {termDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {isOneDriveUrl(doc.document_url) ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/10">
                        <FolderOpen className="h-4 w-4 text-blue-600" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline truncate"
                      >
                        {doc.document_name || "Documento"}
                      </a>
                      <Badge variant="outline" className={`text-[10px] ${getTypeColor(doc.document_type)}`}>
                        {getTypeLabel(doc.document_type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {doc.signed_at && (
                        <span>Assinado em {new Date(doc.signed_at + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      )}
                      {doc.notes && <span>· {doc.notes}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <ConfirmDeleteDialog
                    title="Excluir documento"
                    description={`Remover "${doc.document_name}" da lista?`}
                    onConfirm={() => deleteDocument(doc.id)}
                  >
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </ConfirmDeleteDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add term dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Termo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.filter((t) => t.value !== "pasta_onedrive").map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do documento</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Ex: Termo NB Dell Latitude" />
            </div>
            <div>
              <Label>Link (OneDrive / SharePoint / URL)</Label>
              <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Data de assinatura (opcional)</Label>
              <Input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddDoc} disabled={!docUrl.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder link dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pasta do OneDrive</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cole o link da pasta do OneDrive/SharePoint onde ficam os termos deste colaborador.
            </p>
            <div>
              <Label>Link da pasta</Label>
              <Input value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSetFolder} disabled={!folderUrl.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
