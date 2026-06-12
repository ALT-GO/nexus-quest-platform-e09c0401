import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2, Loader2, Save, GripVertical } from "lucide-react";

type Item = { text: string; checked?: boolean };
type Template = { id: string; category: string; items: Item[] };

const CATEGORIES = ["Desligamento", "Contratação"] as const;
type Cat = (typeof CATEGORIES)[number];

export function CategoryChecklistSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<Cat>("Desligamento");
  const [templates, setTemplates] = useState<Record<Cat, Item[]>>({
    Desligamento: [],
    "Contratação": [],
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("category_checklist_templates" as any)
      .select("category, items")
      .in("category", CATEGORIES as unknown as string[]);
    if (error) {
      toast.error("Erro ao carregar listas de verificação");
    } else {
      const map: Record<Cat, Item[]> = { Desligamento: [], "Contratação": [] };
      (data || []).forEach((row: any) => {
        if (CATEGORIES.includes(row.category)) {
          map[row.category as Cat] = Array.isArray(row.items) ? row.items : [];
        }
      });
      setTemplates(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const items = templates[active];

  const updateItem = (i: number, text: string) => {
    const next = [...items];
    next[i] = { ...next[i], text };
    setTemplates({ ...templates, [active]: next });
  };

  const removeItem = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    setTemplates({ ...templates, [active]: next });
  };

  const addItem = () => {
    setTemplates({
      ...templates,
      [active]: [...items, { text: "", checked: false }],
    });
  };

  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setTemplates({ ...templates, [active]: next });
  };

  const save = async () => {
    const cleaned = items
      .map((it) => ({ text: (it.text || "").trim(), checked: false }))
      .filter((it) => it.text.length > 0);
    setSaving(true);
    const { error } = await supabase
      .from("category_checklist_templates" as any)
      .upsert(
        { category: active, items: cleaned, updated_at: new Date().toISOString() } as any,
        { onConflict: "category" }
      );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(`Lista de verificação de "${active}" salva. Novos chamados já usarão esta lista.`);
    setTemplates({ ...templates, [active]: cleaned });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-primary" />
          Listas de Verificação por Categoria
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Edite os itens que serão criados automaticamente em cada novo chamado dessas categorias.
          Ao salvar, os próximos chamados criados (manualmente ou via formulário) já virão com a lista atualizada.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={active} onValueChange={(v) => setActive(v as Cat)}>
            <TabsList>
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
              ))}
            </TabsList>
            {CATEGORIES.map((c) => (
              <TabsContent key={c} value={c} className="space-y-2 mt-4">
                {templates[c].length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Nenhum item. Adicione abaixo.</p>
                )}
                {templates[c].map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs leading-none"
                        onClick={() => moveItem(i, -1)}
                        disabled={i === 0}
                        title="Mover para cima"
                      >▲</button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs leading-none"
                        onClick={() => moveItem(i, 1)}
                        disabled={i === templates[c].length - 1}
                        title="Mover para baixo"
                      >▼</button>
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      value={it.text}
                      onChange={(e) => updateItem(i, e.target.value)}
                      placeholder="Texto do item"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(i)}
                      className="text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
                    <Plus className="h-4 w-4" /> Adicionar item
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar lista
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
