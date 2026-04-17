import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import srBotAvatar from "@/assets/sr-bot-avatar.png";

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
};

const EVENT_ORDER = ["ticket_created", "sla_near", "sla_expired", "ticket_completed"];

export function BotSettingsTab() {
  const [settings, setSettings] = useState<BotSetting[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from("bot_settings").select("*"),
      supabase.from("chat_channels").select("id, name, icon").eq("archived", false).order("name"),
    ]);
    setSettings(s || []);
    setChannels(c || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const upsertSetting = async (event_key: string, patch: Partial<BotSetting>) => {
    const existing = settings.find((s) => s.event_key === event_key);
    // Optimistic update
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

  const getSetting = (event_key: string): BotSetting | undefined =>
    settings.find((s) => s.event_key === event_key);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <img
              src={srBotAvatar}
              alt="Sr. Bot"
              className="h-12 w-12 rounded-full ring-2 ring-primary/20 object-cover"
            />
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Sr. Bot — Service Desk
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure quais eventos do Service Desk o Sr. Bot deve anunciar e em qual canal.
              </p>
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
            💡 Dica: você pode direcionar cada evento para canais diferentes (ex: SLA vencido em
            #urgencias, conclusões em #chamados-ti).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
