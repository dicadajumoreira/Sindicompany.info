import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { condoFromSlug, slugifyCondo } from "@/lib/sindicompany/condominios";
import {
  getCondoFotoPublicUrl,
  getCondoMeta,
  gestorTitulo,
  listCondoMetas,
} from "@/lib/sindicompany/condominios-db";
import { PrintButton } from "./print-button";

async function resolveCondoNome(slug: string): Promise<string | null> {
  const e = condoFromSlug(slug);
  if (e) return e;
  try {
    const metas = await listCondoMetas();
    return metas.find((x) => slugifyCondo(x.nome) === slug)?.nome ?? null;
  } catch {
    return null;
  }
}

export default async function RevistaBoasVindasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) redirect("/sindicompany/login");

  const { slug } = await params;
  const nome = await resolveCondoNome(slug);
  if (!nome) notFound();
  const meta = await getCondoMeta(nome).catch(() => null);

  const sindicoNome = meta?.sindico_nome ?? "";
  const sindicoTitulo = meta?.sindico_genero === "feminino" ? "Síndica" : "Síndico";
  const logoUrl = meta?.logo_url ?? null;
  const sindicoFoto = meta?.sindico_foto_path ? getCondoFotoPublicUrl(meta.sindico_foto_path) : null;
  const temGestor = !!(meta?.gestor_nome && meta.gestor_nome.trim());
  const gestorNome = temGestor ? meta!.gestor_nome! : "";
  const gestorCargo = temGestor ? gestorTitulo(meta!.gestor_genero) : "";
  const gestorFoto = temGestor && meta?.gestor_foto_path ? getCondoFotoPublicUrl(meta.gestor_foto_path) : null;
  const ocultarSindico = temGestor && !!meta?.ocultar_contato_sindico;
  const equipe = (meta?.equipe_atendimento ?? []).filter((m) => m.nome || m.cargo);
  const comunidadeUrl = meta?.comunidade_url ?? "";
  const qrUrl = meta?.comunidade_qrcode_path ? getCondoFotoPublicUrl(meta.comunidade_qrcode_path) : null;
  const capaUrl = meta?.boasvindas_capa_path ? getCondoFotoPublicUrl(meta.boasvindas_capa_path) : null;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          .bv-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
          .bv-page:last-child { page-break-after: auto; }
          body { background: #fff !important; }
        }
        .bv-page {
          width: 210mm; min-height: 297mm; margin: 16px auto; background: #fff;
          box-shadow: 0 4px 24px rgba(0,0,0,.12); position: relative; overflow: hidden;
          font-family: 'Epilogue', sans-serif; color: #1A1C29;
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between bg-onix-900 text-white px-6 py-3">
        <Link href={`/sindicompany/condominios/${slug}`} className="text-sm text-white/80 hover:text-white">
          ← Voltar para o cadastro
        </Link>
        <div className="text-sm">
          Revista de Boas-Vindas · <strong>{nome}</strong>
        </div>
        <PrintButton />
      </div>

      <div className="bg-onix-50 py-6">
        {/* ---------- PÁGINA 1 — CAPA ---------- */}
        <div className="bv-page">
          {capaUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capaUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(26,28,41,.35) 0%,rgba(26,28,41,.55) 55%,rgba(26,28,41,.92) 100%)" }} />
            </>
          ) : (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#84C7D3 0%,#1A1C29 100%)" }} />
          )}
          {/* Logo do sindico: topo, canto esquerdo, ate ~metade da pagina (105mm de 210mm) */}
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo do síndico"
              style={{ position: "absolute", top: "16mm", left: "16mm", maxWidth: "105mm", maxHeight: "70mm", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,.25))" }}
            />
          ) : (
            <div style={{ position: "absolute", top: "18mm", left: "16mm", fontSize: "11pt", letterSpacing: ".3em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>
              {sindicoTitulo} {sindicoNome}
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "90mm 24mm 40mm", textAlign: "center", color: "#fff" }}>
            <h1 style={{ fontSize: "30pt", fontWeight: 900, lineHeight: 1.15, margin: 0 }}>
              Seja bem-vindo, Condomínio {nome}.
            </h1>
            <p style={{ fontSize: "16pt", fontWeight: 600, marginTop: "10mm", color: "#DABDA9" }}>
              Agora vocês fazem parte da nossa família.
            </p>
          </div>
          <div style={{ position: "absolute", bottom: "14mm", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: "9pt", letterSpacing: ".1em" }}>
            Revista de Boas-Vindas
          </div>
        </div>

        {/* ---------- PÁGINA 2 — CARTA + EQUIPE ---------- */}
        <div className="bv-page">
          <div style={{ padding: "22mm 24mm" }}>
            <div style={{ fontSize: "9pt", letterSpacing: ".26em", textTransform: "uppercase", color: "#84C7D3", fontWeight: 700, marginBottom: "4mm" }}>
              Carta de agradecimento
            </div>
            <h2 style={{ fontSize: "20pt", fontWeight: 800, margin: "0 0 6mm", lineHeight: 1.1 }}>
              Obrigado pelo voto de confiança.
            </h2>
            <div style={{ fontSize: "11.5pt", lineHeight: 1.6, color: "#3a3d4a", textAlign: "justify" }}>
              <p style={{ margin: "0 0 4mm" }}>
                Caro morador do Condomínio {nome},
              </p>
              <p style={{ margin: "0 0 4mm" }}>
                É com gratidão que recebo a confiança de vocês na minha eleição
                como {sindicoTitulo.toLowerCase()}. Assumo esse papel com
                responsabilidade e o compromisso de cuidar do nosso lar com
                transparência, organização e atenção a cada um de vocês.
              </p>
              <p style={{ margin: "0 0 4mm" }}>
                A partir de agora, contamos com a estrutura da Sindicompany pra
                profissionalizar a gestão — e com vocês pra construir uma
                convivência melhor todos os dias.
              </p>
              {comunidadeUrl && (
                <p style={{ margin: "0 0 4mm" }}>
                  <strong>Faça parte da comunidade de WhatsApp do condomínio.</strong>{" "}
                  É lá que circulam avisos, novidades e o dia a dia do prédio.
                  O link e o QR code estão na próxima página.
                </p>
              )}
              <p style={{ margin: "4mm 0 0", fontWeight: 700 }}>
                {sindicoNome ? `${sindicoTitulo} ${sindicoNome}` : sindicoTitulo}
              </p>
            </div>

            {/* Dados do síndico / gestor em destaque */}
            <div style={{ display: "flex", gap: "8mm", marginTop: "10mm", flexWrap: "wrap" }}>
              {!ocultarSindico && (
                <div style={{ flex: 1, minWidth: "70mm", background: "#F4F4F5", borderRadius: "4mm", padding: "6mm" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4mm" }}>
                    {sindicoFoto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sindicoFoto} alt={sindicoNome} style={{ width: "16mm", height: "16mm", borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    <div>
                      <div style={{ fontSize: "8pt", letterSpacing: ".2em", textTransform: "uppercase", color: "#84C7D3", fontWeight: 700 }}>{sindicoTitulo}</div>
                      <div style={{ fontSize: "13pt", fontWeight: 800 }}>{sindicoNome || "—"}</div>
                    </div>
                  </div>
                  {(meta?.sindico_whatsapp || meta?.sindico_email) && (
                    <div style={{ marginTop: "4mm", fontSize: "10pt", color: "#3a3d4a" }}>
                      {meta?.sindico_whatsapp && <div>WhatsApp: {meta.sindico_whatsapp}</div>}
                      {meta?.sindico_email && <div>E-mail: {meta.sindico_email}</div>}
                    </div>
                  )}
                </div>
              )}
              {temGestor && (
                <div style={{ flex: 1, minWidth: "70mm", background: "#F4F4F5", borderRadius: "4mm", padding: "6mm" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4mm" }}>
                    {gestorFoto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={gestorFoto} alt={gestorNome} style={{ width: "16mm", height: "16mm", borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    <div>
                      <div style={{ fontSize: "8pt", letterSpacing: ".2em", textTransform: "uppercase", color: "#84C7D3", fontWeight: 700 }}>{gestorCargo}</div>
                      <div style={{ fontSize: "13pt", fontWeight: 800 }}>{gestorNome}</div>
                    </div>
                  </div>
                  {(meta?.gestor_whatsapp || meta?.gestor_email) && (
                    <div style={{ marginTop: "4mm", fontSize: "10pt", color: "#3a3d4a" }}>
                      {meta?.gestor_whatsapp && <div>WhatsApp: {meta.gestor_whatsapp}</div>}
                      {meta?.gestor_email && <div>E-mail: {meta.gestor_email}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Equipe de atendimento */}
            {equipe.length > 0 && (
              <div style={{ marginTop: "12mm" }}>
                <div style={{ fontSize: "9pt", letterSpacing: ".22em", textTransform: "uppercase", color: "#84C7D3", fontWeight: 700, marginBottom: "5mm" }}>
                  Equipe de atendimento do condomínio
                </div>
                <div style={{ display: "flex", gap: "6mm", flexWrap: "wrap" }}>
                  {equipe.map((m, i) => {
                    const f = m.foto_path ? getCondoFotoPublicUrl(m.foto_path) : null;
                    return (
                      <div key={i} style={{ width: "32mm", textAlign: "center" }}>
                        {f ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f} alt={m.nome} style={{ width: "26mm", height: "26mm", borderRadius: "50%", objectFit: "cover", margin: "0 auto 2mm" }} />
                        ) : (
                          <div style={{ width: "26mm", height: "26mm", borderRadius: "50%", background: "#E5E7EB", margin: "0 auto 2mm" }} />
                        )}
                        <div style={{ fontSize: "9.5pt", fontWeight: 700, lineHeight: 1.2 }}>{m.nome}</div>
                        <div style={{ fontSize: "8pt", color: "#6b7280", lineHeight: 1.2 }}>{m.cargo}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- PÁGINA 3 — COMUNIDADE ---------- */}
        <div className="bv-page">
          <div style={{ position: "absolute", inset: 0, background: "#F4F4F5" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "30mm 24mm", textAlign: "center" }}>
            <div style={{ fontSize: "9pt", letterSpacing: ".28em", textTransform: "uppercase", color: "#84C7D3", fontWeight: 700, marginBottom: "5mm" }}>
              Comunidade do condomínio
            </div>
            <h2 style={{ fontSize: "24pt", fontWeight: 900, margin: "0 0 6mm", lineHeight: 1.15 }}>
              Entre na comunidade de WhatsApp do {nome}.
            </h2>
            <p style={{ fontSize: "12pt", color: "#3a3d4a", maxWidth: "130mm", margin: "0 0 12mm" }}>
              É o canal oficial do condomínio: avisos da gestão, novidades,
              manutenções e o dia a dia do prédio. Aponte a câmera pro QR code
              ou acesse pelo link abaixo.
            </p>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="QR code da comunidade" style={{ width: "70mm", height: "70mm", objectFit: "contain", background: "#fff", padding: "5mm", borderRadius: "4mm", boxShadow: "0 4px 16px rgba(0,0,0,.1)" }} />
            ) : (
              <div style={{ width: "70mm", height: "70mm", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: "4mm", color: "#9ca3af", fontSize: "10pt" }}>
                (QR code não cadastrado)
              </div>
            )}
            {comunidadeUrl && (
              <div style={{ marginTop: "10mm", fontSize: "11pt", wordBreak: "break-all", maxWidth: "150mm" }}>
                <strong>Link:</strong> {comunidadeUrl}
              </div>
            )}
          </div>
          <div style={{ position: "absolute", bottom: "14mm", left: 0, right: 0, textAlign: "center", color: "#9ca3af", fontSize: "9pt" }}>
            Sindicompany · gestão condominial
          </div>
        </div>
      </div>
    </>
  );
}
