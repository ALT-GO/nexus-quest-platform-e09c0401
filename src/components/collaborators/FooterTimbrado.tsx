import footerWave from "@/assets/orion_rodape.png";

export function FooterTimbrado() {
  return (
    <div className="print-footer-container relative" style={{ zIndex: 0 }}>
      <img
        src={footerWave}
        alt=""
        aria-hidden="true"
        className="print-footer-img w-full h-auto object-contain pointer-events-none select-none"
        style={{ position: "relative", zIndex: 0 }}
      />
    </div>
  );
}
