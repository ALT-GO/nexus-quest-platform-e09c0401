import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, CheckCircle2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicAttachmentLinks } from "@/components/shared/PublicAttachmentLinks";

const requestTypes = [
  "Assinatura de e-mail",
  "Capa de proposta/relatório",
  "Criação de arte",
  "Materiais impressos",
  "Materiais digitais",
  "Outros",
];

export default function SolicitacaoPublica() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    requester_name: "",
    request_type: "",
    description: "",
    // Assinatura de e-mail fields
    nome_sobrenome: "",
    cargo: "",
    email_corp: "",
    telefone_corp: "",
    // Capa de proposta fields
    nome_cliente: "",
    endereco: "",
  });
  const [attachmentLinks, setAttachmentLinks] = useState<string[]>([]);

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.requester_name || !formData.request_type || !formData.description) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (formData.request_type === "Assinatura de e-mail") {
      if (!formData.nome_sobrenome || !formData.cargo || !formData.email_corp || !formData.telefone_corp) {
        toast.error("Por favor, preencha todos os campos de assinatura de e-mail.");
        return;
      }
    }

    if (formData.request_type === "Capa de proposta/relatório") {
      if (!formData.nome_cliente || !formData.endereco) {
        toast.error("Por favor, preencha todos os campos da capa de proposta.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const extra_fields: Record<string, string> = {};
      if (formData.request_type === "Assinatura de e-mail") {
        extra_fields.nome_sobrenome = formData.nome_sobrenome;
        extra_fields.cargo = formData.cargo;
        extra_fields.email_corp = formData.email_corp;
        extra_fields.telefone_corp = formData.telefone_corp;
      } else if (formData.request_type === "Capa de proposta/relatório") {
        extra_fields.nome_cliente = formData.nome_cliente;
        extra_fields.endereco = formData.endereco;
      }

      const { data, error } = await supabase.functions.invoke("create-marketing-request", {
        body: {
          requester_name: formData.requester_name,
          request_type: formData.request_type,
          description: formData.description,
          extra_fields,
          attachment_links: attachmentLinks,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsSubmitted(true);
      toast.success("Solicitação enviada com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewRequest = () => {
    setIsSubmitted(false);
    setFormData({
      requester_name: "",
      request_type: "",
      description: "",
      nome_sobrenome: "",
      cargo: "",
      email_corp: "",
      telefone_corp: "",
      nome_cliente: "",
      endereco: "",
    });
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-lg">
          <Card className="text-center">
            <CardContent className="py-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">Solicitação Enviada!</h2>
              <p className="mb-4 text-muted-foreground">
                Sua solicitação foi registrada com sucesso e a equipe de Marketing já foi notificada.
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Você poderá acompanhar o andamento da sua solicitação com a equipe de Marketing.
              </p>
              <Button onClick={handleNewRequest}>Nova Solicitação</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary">
            <Palette className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Solicitações ao Marketing</h1>
          <p className="mt-2 text-muted-foreground">
            Preencha o formulário abaixo para solicitar um serviço da equipe de Marketing
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nova Solicitação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="requester">
                  Solicitante <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="requester"
                  value={formData.requester_name}
                  onChange={(e) => update("requester_name", e.target.value)}
                  placeholder="Digite seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">
                  Tipo de Solicitação <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.request_type}
                  onValueChange={(v) => update("request_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional: Assinatura de e-mail */}
              {formData.request_type === "Assinatura de e-mail" && (
                <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground">Dados para a assinatura</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nome e Sobrenome <span className="text-destructive">*</span></Label>
                      <Input
                        value={formData.nome_sobrenome}
                        onChange={(e) => update("nome_sobrenome", e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo <span className="text-destructive">*</span></Label>
                      <Input
                        value={formData.cargo}
                        onChange={(e) => update("cargo", e.target.value)}
                        placeholder="Ex: Analista de Marketing"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail Corporativo <span className="text-destructive">*</span></Label>
                      <Input
                        type="email"
                        value={formData.email_corp}
                        onChange={(e) => update("email_corp", e.target.value)}
                        placeholder="email@empresa.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone Corporativo <span className="text-destructive">*</span></Label>
                      <Input
                        value={formData.telefone_corp}
                        onChange={(e) => update("telefone_corp", e.target.value)}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional: Capa de proposta/relatório */}
              {formData.request_type === "Capa de proposta/relatório" && (
                <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground">Dados da proposta/relatório</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nome do Cliente <span className="text-destructive">*</span></Label>
                      <Input
                        value={formData.nome_cliente}
                        onChange={(e) => update("nome_cliente", e.target.value)}
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Endereço <span className="text-destructive">*</span></Label>
                      <Input
                        value={formData.endereco}
                        onChange={(e) => update("endereco", e.target.value)}
                        placeholder="Endereço completo"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">
                  Descrição <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Descreva detalhadamente o que você precisa..."
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          A equipe de Marketing será notificada automaticamente sobre sua solicitação.
        </p>
      </div>
    </div>
  );
}
