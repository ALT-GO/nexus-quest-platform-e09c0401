import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bot, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import srBotAvatarFallback from "@/assets/sr-bot-avatar.png";

interface BotSetting {
  id: string;
  event_key: string;
  enabled: boolean;
  channel_id: string | null;
}

interface Channel {
  id: string;
  name: string;
  icon: string;
}

interface BotProfile {
  avatar_url: string;
  display_name: string;
}

const EVENT_LABELS: Record<string, { title: string; description: string; emoji: string }> = {
  ticket_created: {
    title: "Novo chamado criado",
    description: "Posta no chat sempre que um novo chamado for aberto.",
    emoji: "🆕",
  },
  sla_near: {
    title: "SLA próximo do vencimento",
    description: "Alerta quando faltam poucos minutos para o SLA expirar.",
    emoji: "⚠️",
  },
  sla_expired: {
    title: "SLA vencido",
    description: "Notifica quando o SLA de um chamado é ultrapassado.",
    emoji: "🚨",
  },
  ticket_completed: {
    title: "Chamado concluído",
    description: "Confirma no chat quando um chamado é finalizado.",
    emoji: "✅",
  },
  marketing_request_created: {
    title: "Nova solicitação de marketing",
    description: "Anuncia quando uma solicitação chega pelo formulário público de marketing.",
    emoji: "📨",
  },
};

const EVENT_ORDER = [
  "ticket_created",
  "sla_near",
  "sla_expired",
  "ticket_completed",
  "marketing_request_created",
];

export function BotSettingsTab() {
  const [settings, setSettings] = useState<BotSetting[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [profile, setProfile] = useState<BotProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("bot_settings").select("*"),
      supabase.from("chat_channels").select("id, name, icon").eq("archived", false).order("name"),
      supabase.from("bot_profile").select("avatar_url, display_name").maybeSingle(),
    ]);
    setSettings(s || []);
    setChannels(c || []);
    setProfile(p as BotProfile | null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const upsertSetting = async (event_key: string, patch: Partial<BotSetting>) => {
    const existing = settings.find((s) => s.event_key === event_key);
    setSettings((prev) => {
      if (existing) return prev.map((s) => (s.event_key === event_key ? { ...s, ...patch } : s));
      return [
        ...prev,
        { id: crypto.randomUUID(), event_key, enabled: true, channel_id: null, ...patch } as BotSetting,
      ];
    });

    if (existing) {
      const { error } = await supabase.from("bot_settings").update(patch).eq("id", existing.id);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        load();
        return;
      }
    } else {
      const { error } = await supabase
        .from("bot_settings")
        .insert({ event_key, enabled: true, channel_id: null, ...patch });
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        load();
        return;
      }
    }
    toast.success("Configuração salva");
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `sr-bot-avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-assets")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("chat-assets").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updErr } = await supabase
        .from("bot_profile")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (updErr) throw updErr;

      setProfile((prev) => ({
        avatar_url: publicUrl,
        display_name: prev?.display_name || "Sr. Bot",
      }));
      toast.success("Avatar do Sr. Bot atualizado");
    } catch (e: any) {
      toast.error("Erro no upload: " + (e.message || "tente novamente"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getSetting = (event_key: string): BotSetting | undefined =>
    settings.find((s) => s.event_key === event_key);

  const currentAvatar = profile?.avatar_url || srBotAvatarFallback;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <img
                src={currentAvatar}
                alt="Sr. Bot"
                className="h-16 w-16 rounded-full ring-2 ring-primary/20 object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Sr. Bot — Service Desk
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure o avatar, eventos e canais de notificação do Sr. Bot.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {uploading ? "Enviando..." : "Trocar avatar"}
                </Button>
                <span className="text-xs text-muted-foreground">PNG, JPG ou WebP — máx. 5MB</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : (
            EVENT_ORDER.map((key) => {
              const meta = EVENT_LABELS[key];
              const setting = getSetting(key);
              const enabled = setting?.enabled ?? false;
              const channelId = setting?.channel_id ?? "";
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xl shrink-0">{meta.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{meta.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <Select
                      value={channelId}
                      onValueChange={(v) => upsertSetting(key, { channel_id: v || null })}
                      disabled={!enabled}
                    >
                      <SelectTrigger className="w-[200px] h-9">
                        <SelectValue placeholder="Selecione um canal" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Nenhum canal disponível
                          </div>
                        ) : (
                          channels.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              # {c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => upsertSetting(key, { enabled: v })}
                    />
                  </div>
                </div>
              );
            })
          )}
          <p className="text-xs text-muted-foreground pt-2">
            💡 Dica: o avatar atualizado aparece em todas as mensagens novas do Sr. Bot. Mensagens
            antigas mantêm o avatar que tinha no momento do envio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
