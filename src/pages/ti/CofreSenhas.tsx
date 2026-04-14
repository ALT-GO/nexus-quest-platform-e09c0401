import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { usePasswordVault, VaultEntry } from "@/hooks/use-password-vault";
import { Plus, Search, Eye, EyeOff, Copy, Pencil, Trash2, Loader2, KeyRound, Upload } from "lucide-react";
import { toast } from "sonner";

function PasswordCell({ value }: { value: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm min-w-[80px]">
        {visible ? value : "••••••••"}
      </span>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost" size="sm" className="h-6 w-6 p-0"
        onClick={() => { navigator.clipboard.writeText(value); toast.success("Senha copiada!"); }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function EntryDialog({
  entry,
  onSave,
  trigger,
}: {
  entry?: VaultEntry;
  onSave: (data: Omit<VaultEntry, "id" | "created_at" | "updated_at">) => Promise<boolean>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_name: entry?.account_name || "",
    username: entry?.username || "",
    password_value: entry?.password_value || "",
    notes: entry?.notes || "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.account_name.trim()) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) {
      setOpen(false);
      if (!entry) setForm({ account_name: "", username: "", password_value: "", notes: "" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v && entry) setForm({
        account_name: entry.account_name,
        username: entry.username,
        password_value: entry.password_value,
        notes: entry.notes,
      });
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar senha" : "Nova senha"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome da conta *</Label>
            <Input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} placeholder="Ex: VPN Corporativa" />
          </div>
          <div className="grid gap-2">
            <Label>Usuário</Label>
            <Input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="Ex: admin@empresa.com" />
          </div>
          <div className="grid gap-2">
            <Label>Senha</Label>
            <Input value={form.password_value} onChange={(e) => set("password_value", e.target.value)} placeholder="••••••••" />
          </div>
          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Observações..." />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.account_name.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CofreSenhas() {
  const { entries, loading, addEntry, deleteEntry, updateEntry, refetch } = usePasswordVault();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      // Try UTF-8 first, fallback to Latin-1 for Windows CSVs with accents
      let text = await file.text();
      if (text.includes("�") || text.includes("\ufffd")) {
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder("windows-1252");
        text = decoder.decode(buffer);
      }
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast.error("Arquivo vazio ou sem dados"); return; }

      const header = lines[0].split(/[;,\t]/).map((h) => h.trim().toUpperCase().replace(/"/g, ""));
      const colMap: Record<string, string> = {
        CONTA: "account_name", LOGIN: "username", SENHA: "password_value", NOTAS: "notes",
        ACCOUNT_NAME: "account_name", USERNAME: "username", PASSWORD_VALUE: "password_value", NOTES: "notes",
      };
      const mapping = header.map((h) => colMap[h] || null);

      if (!mapping.includes("account_name")) {
        toast.error("Coluna 'CONTA' não encontrada no CSV");
        return;
      }

      const rows: Omit<VaultEntry, "id" | "created_at" | "updated_at">[] = [];
      const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
        const row: any = { account_name: "", username: "", password_value: "", notes: "" };
        mapping.forEach((field, idx) => { if (field && cols[idx]) row[field] = cols[idx]; });
        if (row.account_name) rows.push(row);
      }

      if (rows.length === 0) { toast.error("Nenhum registro válido encontrado"); return; }

      let success = 0;
      for (const row of rows) {
        const ok = await addEntry(row);
        if (ok) success++;
      }
      toast.success(`${success} senha(s) importada(s) com sucesso!`);
      await refetch();
    } catch {
      toast.error("Erro ao processar o arquivo CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.account_name.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      e.notes.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <PageHeader
        title="Cofre de Senhas"
        description="Gerenciamento seguro de credenciais da equipe de TI"
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conta, usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar CSV
            </Button>
            <EntryDialog
              onSave={addEntry}
              trigger={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova senha
                </Button>
              }
            />
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Senha</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.account_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{entry.username || "—"}</span>
                            {entry.username && (
                              <Button
                                variant="ghost" size="sm" className="h-6 w-6 p-0"
                                onClick={() => { navigator.clipboard.writeText(entry.username); toast.success("Usuário copiado!"); }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.password_value ? (
                            <PasswordCell value={entry.password_value} />
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {entry.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <EntryDialog
                              entry={entry}
                              onSave={async (data) => updateEntry(entry.id, data)}
                              trigger={
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                            <ConfirmDeleteDialog
                              title="Excluir senha"
                              description={`Deseja excluir a senha de "${entry.account_name}"?`}
                              onConfirm={() => deleteEntry(entry.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          <KeyRound className="mx-auto mb-2 h-8 w-8" />
                          {search ? "Nenhuma senha encontrada para esta busca" : "Nenhuma senha cadastrada"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
