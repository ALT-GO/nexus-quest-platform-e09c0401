import { useState } from "react";
import { useAttachments } from "@/hooks/use-attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Link2, Trash2, ExternalLink, FileText, Image, FileSpreadsheet, Film, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AttachmentManagerProps {
  entityType: "ticket" | "marketing_task" | "public_request";
  entityId: string | null;
  addedBy: string;
  readOnly?: boolean;
  className?: string;
}

function getFileIcon(mimeType: string | null, fileName: string) {
  if (mimeType?.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mimeType?.startsWith("video/")) return <Film className="h-4 w-4 text-purple-500" />;
  if (mimeType?.includes("spreadsheet") || fileName.match(/\.(xlsx?|csv)$/i)) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (mimeType?.includes("pdf") || fileName.match(/\.pdf$/i)) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isOneDriveUrl(url: string) {
  return /onedrive|sharepoint|1drv\.ms/i.test(url);
}

export function AttachmentManager({ entityType, entityId, addedBy, readOnly, className }: AttachmentManagerProps) {
  const { attachments, addAttachment, removeAttachment } = useAttachments(entityType, entityId);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (!linkUrl.trim()) return;
    const name = linkName.trim() || extractFileName(linkUrl);
    addAttachment.mutate({
      file_name: name,
      file_url: linkUrl.trim(),
      added_by: addedBy,
    });
    setLinkUrl("");
    setLinkName("");
    setShowForm(false);
  };

  const extractFileName = (url: string) => {
    try {
      const pathname = new URL(url).pathname;
      const last = pathname.split("/").filter(Boolean).pop();
      return last ? decodeURIComponent(last) : "Arquivo";
    } catch {
      return "Arquivo";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3 w-3" />
          Anexos
          {attachments.length > 0 && (
            <span className="text-[10px] bg-muted rounded-full px-1.5">{attachments.length}</span>
          )}
        </label>
        {!readOnly && !showForm && (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Link2 className="h-3 w-3" />
            Adicionar link
          </Button>
        )}
      </div>

      {/* Add link form */}
      {showForm && !readOnly && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <Input
            placeholder="Cole o link do OneDrive ou qualquer URL..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="text-sm h-8"
            autoFocus
          />
          <Input
            placeholder="Nome do arquivo (opcional)"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="text-sm h-8"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setLinkUrl(""); setLinkName(""); }}>
              Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAdd} disabled={!linkUrl.trim() || addAttachment.isPending}>
              <Link2 className="h-3 w-3" />
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-md border bg-card p-2 group hover:bg-muted/50 transition-colors"
            >
              {isOneDriveUrl(att.file_url) ? (
                <div className="h-5 w-5 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                    <path d="M14.5 15.5L10.2 12.8C10.7 11.3 12.1 10.2 13.8 10.2C14.3 10.2 14.8 10.3 15.2 10.5L19.5 8C18.1 6.2 15.9 5 13.5 5C10.3 5 7.6 7.1 6.8 10C6.5 10 6.3 10 6 10C3.2 10 1 12.2 1 15C1 17.8 3.2 20 6 20H18.5C20.4 20 22 18.4 22 16.5C22 14.7 20.5 13.2 18.7 13L14.5 15.5Z" fill="#0078D4"/>
                  </svg>
                </div>
              ) : (
                getFileIcon(att.mime_type, att.file_name)
              )}

              <div className="flex-1 min-w-0">
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-foreground hover:text-primary hover:underline truncate block"
                >
                  {att.file_name}
                </a>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {att.added_by && <span>{att.added_by}</span>}
                  {att.file_size && <span>· {formatFileSize(att.file_size)}</span>}
                  <span>· {formatDistanceToNow(new Date(att.created_at), { addSuffix: true, locale: ptBR })}</span>
                </div>
              </div>

              <a
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-primary p-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              {!readOnly && (
                <button
                  onClick={() => removeAttachment.mutate(att.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && !showForm && (
        <p className="text-[11px] text-muted-foreground">Nenhum anexo vinculado</p>
      )}
    </div>
  );
}
