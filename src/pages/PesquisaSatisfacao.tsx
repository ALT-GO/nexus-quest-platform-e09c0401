import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Star, CheckCircle2, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RatingScaleProps {
  value: number;
  onChange: (v: number) => void;
}

function RatingScale({ value, onChange }: RatingScaleProps) {
  const [hover, setHover] = useState(0);
  const current = hover || value;
  return (
    <div className="flex flex-wrap justify-between gap-1 sm:gap-2">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
        >
          <span className={cn(
            "text-xs font-medium",
            n <= current ? "text-primary" : "text-muted-foreground",
          )}>{n}</span>
          <Star
            className={cn(
              "h-7 w-7 sm:h-8 sm:w-8 transition-colors",
              n <= current ? "fill-primary text-primary" : "text-muted-foreground/50",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function PesquisaSatisfacao() {
  const [params] = useSearchParams();
  const ticketFromUrl = params.get("ticket") || "";
  const emailFromUrl = params.get("email") || "";
  const nameFromUrl = params.get("name") || "";

  const [name, setName] = useState(nameFromUrl);
  const [email, setEmail] = useState(emailFromUrl);
  const [r1, setR1] = useState(0);
  const [r2, setR2] = useState(0);
  const [r3, setR3] = useState(0);
  const [r4, setR4] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const allRated = useMemo(() => r1 && r2 && r3 && r4, [r1, r2, r3, r4]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    if (!allRated) {
      toast.error("Por favor, responda todas as perguntas obrigatórias (1 a 10).");
      return;
    }
    setSubmitting(true);

    let ticketId: string | null = null;
    if (ticketFromUrl) {
      const { data } = await supabase
        .from("tickets")
        .select("id")
        .eq("ticket_number", ticketFromUrl)
        .maybeSingle();
      ticketId = (data as any)?.id ?? null;
    }

    const { error } = await supabase.from("satisfaction_surveys" as any).insert({
      ticket_id: ticketId,
      ticket_number: ticketFromUrl || null,
      user_name: name.trim(),
      user_email: email.trim(),
      rating_response_time: r1,
      rating_communication: r2,
      rating_resolution: r3,
      rating_ease_of_use: r4,
      comment: comment.trim() || null,
    });

    setSubmitting(false);
    if (error) {
      toast.error("Erro ao enviar resposta. Tente novamente.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-muted/30 p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="py-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Obrigado!</h2>
            <p className="text-muted-foreground">
              Sua resposta foi registrada. Agradecemos sua contribuição para melhorarmos cada vez mais o atendimento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions = [
    { label: "Como você avalia o tempo de resposta do seu chamado?", value: r1, set: setR1 },
    { label: "Como você avalia a comunicação e a clareza das informações fornecidas pela equipe de TI?", value: r2, set: setR2 },
    { label: "O quanto você considera que seu problema foi totalmente resolvido?", value: r3, set: setR3 },
    { label: "Como você avalia a facilidade para abrir e acompanhar o status do seu chamado?", value: r4, set: setR4 },
  ];

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header banner */}
        <div className="h-32 rounded-xl bg-gradient-to-br from-primary/80 via-primary to-primary/60" />

        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl">PESQUISA DE SATISFAÇÃO - TI SP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold mb-2">Sua opinião é muito importante para nós!</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Queremos oferecer o melhor suporte possível. Por isso, pedimos que você dedique um minuto para avaliar o atendimento que recebeu. Suas respostas nos ajudarão a melhorar continuamente nossos serviços e atender às suas expectativas. Obrigado pela sua colaboração!
            </p>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label>E-mail <span className="text-destructive">*</span></Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu.email@empresa.com" />
              </div>
              {ticketFromUrl && (
                <p className="text-xs text-muted-foreground">Chamado: <strong>{ticketFromUrl}</strong></p>
              )}
            </CardContent>
          </Card>

          {questions.map((q, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm font-medium">
                  {q.label} <span className="text-destructive">*</span>
                </p>
                <RatingScale value={q.value} onChange={q.set} />
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="pt-6 space-y-2">
              <Label>Algum comentário sobre o atendimento ou uma sugestão de melhoria?</Label>
              <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Texto de resposta longa (opcional)" />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {submitting ? "Enviando..." : "Enviar resposta"}
          </Button>
        </form>
      </div>
    </div>
  );
}
