import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Download, Loader2 } from "lucide-react";
import type { CollaboratorAsset } from "@/hooks/use-collaborators";
import { HeaderTimbrado } from "./HeaderTimbrado";
import { FooterTimbrado } from "./FooterTimbrado";
import { calcDepreciation, formatBRL } from "@/lib/depreciation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaboratorName: string;
  assets: CollaboratorAsset[];
  type: "responsabilidade" | "devolucao";
}

const categoryLabels: Record<string, string> = {
  notebooks: "Notebooks",
  celulares: "Celulares",
  tablets: "Tablets",
  perifericos: "Periféricos",
  linhas: "Linhas Telefônicas",
  licencas: "Licenças",
  hardware: "Hardware",
  telecom: "Telecom",
  licenses: "Licenças",
};

const categorySingular: Record<string, string> = {
  notebooks: "Notebook",
  celulares: "Celular",
  tablets: "Tablet",
  perifericos: "Periférico",
  linhas: "Linha",
  licencas: "Licença",
};

function getAssetDescription(asset: any): string {
  const parts: string[] = [];
  if (asset.marca) parts.push(asset.marca);
  if (asset.model) parts.push(asset.model);
  if (!parts.length && asset.licenca) parts.push(asset.licenca);
  if (!parts.length && asset.asset_type) parts.push(asset.asset_type);
  const catLabel = categoryLabels[asset.category] || asset.category;
  return parts.length ? `${catLabel} – ${parts.join(" ")}` : catLabel;
}

/** Returns the item type label (singular) */
function getItemType(asset: any): string {
  return categorySingular[asset.category] || asset.category;
}

/** Returns technical detail depending on category */
function getAssetDetail(asset: any): string {
  if (asset.category === "perifericos") {
    // Always include the peripheral type (mouse, headset, teclado…) so the term
    // doesn't show only a model code like "M90" with no context.
    const tipo = asset.asset_type?.trim();
    const modelo = asset.model?.trim();
    const marca = asset.marca?.trim();
    const descricao = [marca, modelo].filter(Boolean).join(" ");
    if (tipo && descricao) return `${tipo} – ${descricao}`;
    if (tipo) return tipo;
    if (descricao) return descricao;
    return asset.service_tag || "—";
  }
  if (asset.category === "notebooks" || asset.category === "celulares" || asset.category === "tablets") {
    const marca = asset.marca?.trim();
    const modelo = asset.model?.trim();
    const descricao = [marca, modelo].filter(Boolean).join(" ");
    return descricao || "—";
  }
  if (asset.category === "linhas") return asset.numero || "—";
  if (asset.category === "licencas" || asset.category === "licenses") return asset.email_address || "—";
  return "—";
}

function getAssetIdentifier(asset: any): string {
  if (asset.service_tag) return `Service Tag: ${asset.service_tag}`;
  if (asset.imei1) return `IMEI: ${asset.imei1}`;
  if (asset.numero) return `Número: ${asset.numero}`;
  if (asset.email_address) return `E-mail: ${asset.email_address}`;
  return "—";
}

export function PrintableTermDialog({ open, onOpenChange, collaboratorName, assets, type }: Props) {
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const todayShort = format(new Date(), "'São Paulo, 'dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const cargo = assets.find((a: any) => a.cargo)?.cargo || "______________________";
  const isDevolucao = type === "devolucao";

  const headerTitle = isDevolucao ? "DEVOLUÇÃO DE MATERIAIS TECNOLÓGICOS" : "TERMO DE RESPONSABILIDADE";
  const dialogTitle = isDevolucao ? "Termo de Devolução" : "Termo de Responsabilidade";
  const docCode = isDevolucao ? "FF.117" : "FF.164";
  const headerPrefix = isDevolucao ? "TERMO DE RESPONSABILIDADE DE" : "";

  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const pages = contentRef.current.querySelectorAll<HTMLElement>(".print-page");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = 210;
      const pdfH = 297;

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgW = pdfW;
        const imgH = (canvas.height * pdfW) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, imgW, Math.min(imgH, pdfH));
      }

      const fileName = isDevolucao
        ? `Termo_Devolucao_${collaboratorName.replace(/\s+/g, "_")}.pdf`
        : `Termo_Responsabilidade_${collaboratorName.replace(/\s+/g, "_")}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    }
    setDownloading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-background print-term-dialog">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b shadow-sm print:hidden">
          <DialogTitle className="text-lg font-bold">{dialogTitle}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handleDownloadPdf} disabled={downloading} variant="outline" className="gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Gerando..." : "Baixar PDF"}
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div ref={contentRef}>
        {/* ===== PAGE 1 ===== */}
        <div className="print-page p-6 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col relative" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif", color: "#333", fontSize: "11pt", lineHeight: "1.4" }}>
          <div className="print-header-table mb-1">
            <HeaderTimbrado title={headerTitle} docCode={docCode} revision={isDevolucao ? "rev 01" : "Rev. 02"} prefix={headerPrefix} />
          </div>

          <p className="mb-1 text-right" style={{ fontSize: "10pt" }}>{todayShort}</p>

          <div className="print-content-area flex-1">
            {isDevolucao ? (
              <DevolucaoContent name={collaboratorName} cargo={cargo} />
            ) : (
              <ResponsabilidadeContent name={collaboratorName} cargo={cargo} />
            )}
          </div>

          <FooterTimbrado />
        </div>

        {/* ===== PAGE 2 ===== */}
        <div className="print-page p-6 mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col relative break-before-page" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif", color: "#333", fontSize: "11pt", lineHeight: "1.4" }}>
          <div className="print-header-table mb-1">
            <HeaderTimbrado title={headerTitle} docCode={docCode} revision={isDevolucao ? "rev 01" : "Rev. 02"} pageInfo="Página 2 de 2" prefix={headerPrefix} />
          </div>

          {isDevolucao && (
            <p className="font-bold mb-2 uppercase" style={{ fontSize: "9pt", color: "#444" }}>DADOS DOS ITENS</p>
          )}

          <table className="w-full border-collapse mb-4" style={{ fontSize: "9pt" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th className="p-1.5 border border-[#999] text-left font-bold" style={{ fontSize: "8pt" }}>ITEM</th>
                <th className="p-1.5 border border-[#999] text-left font-bold" style={{ fontSize: "8pt" }}>DETALHE</th>
                <th className="p-1.5 border border-[#999] text-left font-bold" style={{ fontSize: "8pt" }}>VALOR PAGO</th>
                <th className="p-1.5 border border-[#999] text-left font-bold" style={{ fontSize: "8pt" }}>VALOR CONTÁBIL ATUAL</th>
                {!isDevolucao && (
                  <th className="p-1.5 border border-[#999] text-left font-bold" style={{ fontSize: "8pt" }}>ESTADO</th>
                )}
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={isDevolucao ? 4 : 5} className="p-2 border border-[#999] text-center" style={{ color: "#999" }}>
                    Nenhum ativo vinculado
                  </td>
                </tr>
              ) : (
                assets.map((asset: any) => {
                  const canDepreciate = ["notebooks", "celulares", "tablets", "perifericos"].includes(asset.category);
                  const dep = canDepreciate ? calcDepreciation(asset.valor_pago, asset.data_aquisicao) : null;
                  const valorPagoDisplay = canDepreciate
                    ? (dep ? formatBRL(dep.valorAquisicao) : asset.valor_pago ? formatBRL(asset.valor_pago) : "—")
                    : "N/A";
                  const valorContabilDisplay = canDepreciate
                    ? (dep ? formatBRL(dep.valorContabil) : "—")
                    : "N/A";
                  return (
                    <tr key={asset.id}>
                      <td className="p-1.5 border border-[#999]" style={{ fontSize: "9pt" }}>{getItemType(asset)}</td>
                      <td className="p-1.5 border border-[#999]" style={{ fontSize: "9pt" }}>{getAssetDetail(asset)}</td>
                      <td className="p-1.5 border border-[#999]" style={{ fontSize: "9pt" }}>{valorPagoDisplay}</td>
                      <td className="p-1.5 border border-[#999]" style={{ fontSize: "9pt" }}>{valorContabilDisplay}</td>
                      {!isDevolucao && (
                        <td className="p-1.5 border border-[#999]" style={{ fontSize: "9pt" }}>{asset.status || "—"}</td>
                      )}
                    </tr>
                  );
                })
              )}
              <tr>
                <td colSpan={isDevolucao ? 4 : 5} className="p-1.5 border border-[#999] font-bold" style={{ color: "#666", fontSize: "9pt" }}>
                  OBS:
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mb-4" style={{ fontSize: "10pt" }}>{todayShort}.</p>

          <div className="print-signatures space-y-8 mb-2">
            <div>
              <p className="mb-1 font-bold" style={{ fontSize: "10pt" }}>Assinatura do Empregado:</p>
              <div className="border-b border-[#666] w-64 mt-8"></div>
            </div>
            <div>
              <p className="mb-1 font-bold" style={{ fontSize: "10pt" }}>Assinatura da Testemunha:</p>
              <div className="border-b border-[#666] w-80 mt-8"></div>
            </div>
          </div>

          <FooterTimbrado />
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Responsibility term body text (page 1) ── */
function ResponsabilidadeContent({ name, cargo }: { name: string; cargo: string }) {
  return (
    <div className="text-justify space-y-2 flex-1" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif", fontSize: "11pt", lineHeight: "1.45" }}>
      <p>
        Eu, <strong>{name}</strong>, portador(a) do CPF nº ______________________ e RG nº ______________________,
        declaro que recebi da empresa <strong>ORION Engenharia e Tecnologia S/A</strong>, sob o CNPJ nº 01.011.976/0004-75,
        o(s) equipamento(s) descrito(s) na página seguinte.
      </p>
      <p>
        Assumo total responsabilidade pela sua manutenção, conservação e devolução, comprometendo-me a cuidar para que
        o(s) equipamento(s) seja(m) devolvido(s) em perfeito estado de funcionamento, exceto por desgaste decorrente do
        uso normal ou desuso devido à obsolescência tecnológica.
      </p>
      <p>
        Caso o equipamento não seja devolvido em perfeito estado por culpa ou dolo, comprometo-me a ressarcir a empresa
        pelos danos causados, limitados ao valor de mercado do equipamento. Em caso de perda, serei responsável pelo
        ressarcimento à empresa do valor de compra de um novo equipamento equivalente.
      </p>
      <p>
        Declaro ter ciência de que o equipamento é de uso exclusivo para atividades profissionais e que seu uso é
        obrigatório durante o horário de trabalho. É estritamente proibido o uso de máquinas pessoais para realização de
        atividades profissionais, assim como o uso do equipamento para fins pessoais, salvo autorização expressa da empresa.
      </p>
      <p>
        Estou ciente de que é proibido o empréstimo, aluguel ou cessão do equipamento a terceiros sem autorização expressa
        do empregador.
      </p>
      <p>
        No contexto de home office ou modelo híbrido, o uso do equipamento é obrigatório para a realização das atividades
        profissionais. É minha responsabilidade garantir que o equipamento seja utilizado adequadamente, em um ambiente
        seguro e propício ao trabalho.
      </p>
      <p>
        Estou ciente de que a violação das cláusulas deste termo, incluindo o uso indevido do equipamento, poderá resultar
        em medidas disciplinares, que podem incluir advertência, suspensão ou até rescisão por justa causa, conforme as
        diretrizes da empresa e a legislação vigente.
      </p>
      <p>
        No caso de desligamento, comprometo-me a devolver o equipamento no momento da assinatura do aviso prévio. Caso não
        o faça, autorizo o desconto do valor do equipamento na minha rescisão contratual. O valor do equipamento será
        depreciado anualmente, visando estabelecer o Valor Contábil Atual para fins de devolução, indenização ou
        ressarcimento. A depreciação será calculada conforme as seguintes regras:
      </p>
      <ol className="list-decimal pl-6 space-y-0.5" style={{ fontSize: "9pt" }}>
        <li><strong>Vida Útil e Método de Depreciação:</strong> A depreciação será calculada pelo método linear ao longo de cinco (5) anos (Vida Útil Padrão para TI).</li>
        <li><strong>Valor Mínimo (Piso):</strong> A depreciação cessará assim que o Valor Contábil Atual atingir o valor residual mínimo estabelecido pela Empresa, sendo este 50% do valor pago tanto para Notebooks, celulares ou tablets.</li>
        <li><strong>Cálculo da Depreciação Anual:</strong> O valor a ser depreciado a cada ano completo de uso será calculado com base no Valor de Aquisição (coluna "valor pago" da tabela) subtraído do Valor Mínimo (piso descrito no tópico 2 acima), dividido pela vida útil de 5 anos.</li>
        <li><strong>Depreciação Anual fixa</strong> = (valor de aquisição - valor mínimo) / 5 anos</li>
        <li>O valor de depreciação anual fixa será multiplicado pela quantia de cada ano completo desde a data de assinatura do termo de responsabilidade.</li>
      </ol>
    </div>
  );
}

/* ── Return term body text (page 1) ── */
function DevolucaoContent({ name, cargo }: { name: string; cargo: string }) {
  return (
    <div className="text-justify space-y-2 flex-1" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif", fontSize: "11pt", lineHeight: "1.45" }}>
      <p>
        Eu, <strong>{name}</strong>, CPF ______________________ RG ______________________,
        declaro, para todos os fins de direito, que o(s) seguinte(s) equipamento(s) tecnológico(s) está(ão) sendo
        devolvido(s) em perfeitas condições de uso.
      </p>

      <p className="font-bold mt-4">A depreciação foi calculada conforme as seguintes regras:</p>

      <ol className="list-decimal pl-6 space-y-0.5" style={{ fontSize: "9pt" }}>
        <li><strong>Vida Útil e Método de Depreciação:</strong> A depreciação será calculada pelo método linear ao longo de cinco (5) anos (Vida Útil Padrão para TI).</li>
        <li><strong>Valor Mínimo (Piso):</strong> A depreciação cessará assim que o Valor Contábil Atual atingir o valor residual mínimo estabelecido pela Empresa, sendo este 50% do valor pago tanto em Notebook, celulares ou tablets.</li>
        <li><strong>Cálculo da Depreciação Anual:</strong> O valor a ser depreciado a cada ano completo de uso será calculado com base no Valor de Aquisição (coluna "valor pago" da tabela) subtraído do Valor Mínimo (piso descrito no tópico 2 acima), dividido pela vida útil de 5 anos.</li>
        <li><strong>Depreciação Anual fixa:</strong> (valor de aquisição - valor mínimo) / 5 anos</li>
        <li>O valor de depreciação anual fixa será multiplicado pela quantia de cada ano completo desde a data de assinatura do termo de responsabilidade.</li>
      </ol>
    </div>
  );
}