import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  template_key: string;
  enabled: boolean;
  subject: string;
  header_title: string;
  heading_title: string;
  greeting: string;
  body_html: string;
  cta_label: string;
  footer_text: string;
  font_family: string;
  primary_color: string;
  from_address: string;
  reply_to: string;
  cc: string;
}

const FONT_OPTIONS = [
  "Arial, sans-serif",
  "Helvetica, Arial, sans-serif",
  "'Segoe UI', Roboto, sans-serif",
  "Georgia, serif",
  "'Times New Roman', serif",
  "Verdana, sans-serif",
  "'Courier New', monospace",
];

const TEMPLATE_META: Record<string, { label: string; desc: string; vars: string[] }> = {
  ticket_created: {
    label: "Abertura de chamado",
    desc: "Enviado automaticamente ao solicitante quando um novo chamado é registrado.",
    vars: ["{{ticket_number}}", "{{title}}", "{{category}}", "{{requester}}", "{{first_name}}", "{{email}}"],
  },
  ticket_completed: {
    label: "Pesquisa de satisfação",
    desc: "Enviado quando o chamado é concluído. Inclui o botão para a pesquisa.",
    vars: ["{{ticket_number}}", "{{title}}", "{{category}}", "{{requester}}", "{{first_name}}", "{{email}}", "{{survey_url}}"],
  },
};

export function EmailTemplatesSection() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [active, setActive] = useState<string>("ticket_created");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("email_templates" as any)
        .select("*")
        .order("template_key");
      if (error) {
        toast.error("Erro ao carregar templates de e-mail");
      } else {
        setTemplates((data as any[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  const updateField = (key: string, field: keyof EmailTemplate, value: any) => {
    setTemplates((prev) => prev.map((t) => (t.template_key === key ? { ...t, [field]: value } : t)));
  };

  const handleSave = async (tpl: EmailTemplate) => {
    setSaving(tpl.template_key);
    const { error } = await supabase
      .from("email_templates" as any)
      .update({
        enabled: tpl.enabled,
        subject: tpl.subject,
        header_title: tpl.header_title,
        heading_title: tpl.heading_title,
        greeting: tpl.greeting,
        body_html: tpl.body_html,
        cta_label: tpl.cta_label,
        footer_text: tpl.footer_text,
        font_family: tpl.font_family,
        primary_color: tpl.primary_color,
        from_address: tpl.from_address,
        reply_to: tpl.reply_to,
        cc: tpl.cc,
      } as any)
      .eq("id", tpl.id as any);
    setSaving(null);
    if (error) {
      toast.error("Erro ao salvar template (verifique se você é admin)");
    } else {
      toast.success("Template salvo. Próximos envios usarão essas configurações.");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-5 w-5 text-primary" />
          Templates de E-mail Automático
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Edite o conteúdo, assunto e estilo dos e-mails enviados automaticamente. As alterações são aplicadas no próximo envio.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList>
            {templates.map((t) => (
              <TabsTrigger key={t.template_key} value={t.template_key}>
                {TEMPLATE_META[t.template_key]?.label ?? t.template_key}
              </TabsTrigger>
            ))}
          </TabsList>

          {templates.map((tpl) => {
            const meta = TEMPLATE_META[tpl.template_key];
            return (
              <TabsContent key={tpl.template_key} value={tpl.template_key} className="space-y-4 pt-4">
                {meta && <p className="text-sm text-muted-foreground">{meta.desc}</p>}

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Envio automático</p>
                    <p className="text-xs text-muted-foreground">
                      {tpl.enabled ? "Ativo — e-mails serão enviados." : "Pausado — nenhum e-mail será enviado."}
                    </p>
                  </div>
                  <Switch
                    checked={tpl.enabled}
                    onCheckedChange={(c) => updateField(tpl.template_key, "enabled", c)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input
                      value={tpl.subject}
                      onChange={(e) => updateField(tpl.template_key, "subject", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Título do cabeçalho (faixa colorida)</Label>
                    <Input
                      value={tpl.header_title}
                      onChange={(e) => updateField(tpl.template_key, "header_title", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Título da mensagem</Label>
                  <Input
                    value={tpl.heading_title}
                    onChange={(e) => updateField(tpl.template_key, "heading_title", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Saudação (opcional)</Label>
                  <Input
                    value={tpl.greeting}
                    onChange={(e) => updateField(tpl.template_key, "greeting", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Corpo do e-mail (HTML)</Label>
                  <Textarea
                    rows={10}
                    className="font-mono text-xs"
                    value={tpl.body_html}
                    onChange={(e) => updateField(tpl.template_key, "body_html", e.target.value)}
                  />
                  {meta && (
                    <p className="text-xs text-muted-foreground">
                      Variáveis disponíveis: {meta.vars.map((v) => <code key={v} className="mx-0.5 rounded bg-muted px-1">{v}</code>)}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Texto do botão (CTA)</Label>
                    <Input
                      value={tpl.cta_label}
                      onChange={(e) => updateField(tpl.template_key, "cta_label", e.target.value)}
                      placeholder="Deixe vazio para não exibir botão"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rodapé</Label>
                    <Input
                      value={tpl.footer_text}
                      onChange={(e) => updateField(tpl.template_key, "footer_text", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fonte</Label>
                    <Select
                      value={tpl.font_family}
                      onValueChange={(v) => updateField(tpl.template_key, "font_family", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor principal</Label>
                    <div className="flex gap-2">
                      <Input
                        value={tpl.primary_color}
                        onChange={(e) => updateField(tpl.template_key, "primary_color", e.target.value)}
                        placeholder="hsl(...) ou #..."
                      />
                      <div
                        className="h-9 w-9 rounded border"
                        style={{ background: tpl.primary_color }}
                        title="Pré-visualização da cor"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Remetente (From)</Label>
                    <Input
                      value={tpl.from_address}
                      onChange={(e) => updateField(tpl.template_key, "from_address", e.target.value)}
                      placeholder='"Nome" <email@dominio>'
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Responder para</Label>
                    <Input
                      value={tpl.reply_to}
                      onChange={(e) => updateField(tpl.template_key, "reply_to", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cópia (CC)</Label>
                    <Input
                      value={tpl.cc}
                      onChange={(e) => updateField(tpl.template_key, "cc", e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={() => handleSave(tpl)} disabled={saving === tpl.template_key}>
                    {saving === tpl.template_key ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar template
                  </Button>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
