/**
 * Sugestões editoriais por mês.
 *
 * Quando o(a) editor(a) abre "Nova edição", a engine sugere uma matéria
 * de capa e uma receita baseadas no mês. São apenas sugestões — pode
 * sobrescrever na hora.
 *
 * Mantenha as matérias temáticas e leves. Aproveitar datas marcantes
 * (Páscoa, junho, outubro rosa, dezembro) sem ficar engessado.
 */

export interface SugestaoMaterial {
  titulo: string;
  subtitulo: string;
}

export interface SugestaoReceita {
  titulo: string;
  descricao: string;
}

const MATERIA_POR_MES: Record<number, SugestaoMaterial> = {
  1: {
    titulo: "Começo de ano: o condomínio também recomeça",
    subtitulo: "O que vale revisar em janeiro: orçamento, regimento e a convivência depois das férias.",
  },
  2: {
    titulo: "Verão sob controle: água, energia e ar-condicionado",
    subtitulo: "Como passar fevereiro com a conta no azul e a casa fresca.",
  },
  3: {
    titulo: "Outono chegando: revisar estrutura antes da chuva",
    subtitulo: "Calhas, telhados, fachadas — o que ainda dá tempo de checar.",
  },
  4: {
    titulo: "O condomínio que ama pets vive melhor",
    subtitulo: "Convivência, regulação e bons exemplos para áreas comuns.",
  },
  5: {
    titulo: "Outono no prédio: aconchego e contas em ordem",
    subtitulo: "Calefação, água quente e como o condomínio economiza junto.",
  },
  6: {
    titulo: "Festa junina no salão: como fazer dar certo",
    subtitulo: "Organização, segurança e boa vizinhança numa noite só.",
  },
  7: {
    titulo: "Inverno: isolamento térmico e o silêncio do prédio",
    subtitulo: "Pequenos ajustes que mudam o conforto e a conta de luz.",
  },
  8: {
    titulo: "Saúde mental e convivência condominial",
    subtitulo: "O que a vizinhança pode (e não pode) fazer por quem mora ao lado.",
  },
  9: {
    titulo: "Primavera, jardins e áreas comuns que florescem",
    subtitulo: "Paisagismo, manutenção e o impacto visual do prédio.",
  },
  10: {
    titulo: "Outubro Rosa: cuidar da saúde começa em casa",
    subtitulo: "Iniciativas simples que o condomínio pode apoiar.",
  },
  11: {
    titulo: "Novembro Azul + reta final do ano",
    subtitulo: "Saúde do homem e o que ainda dá pra fechar antes de dezembro.",
  },
  12: {
    titulo: "Festas de fim de ano sem dor de cabeça",
    subtitulo: "Segurança, fogos, pets e a regra de ouro: combinar antes.",
  },
};

const RECEITA_POR_MES: Record<number, SugestaoReceita> = {
  1: { titulo: "Salada tropical de manga e camarão",   descricao: "Refrescante para o calor de janeiro." },
  2: { titulo: "Bowl de açaí com granola caseira",      descricao: "Energia gelada para o verão." },
  3: { titulo: "Bolo de fubá cremoso",                   descricao: "Conforto de início de outono." },
  4: { titulo: "Colomba pascal recheada",                descricao: "Sobra de páscoa virou ouro." },
  5: { titulo: "Sopa de abóbora com gengibre",           descricao: "Cremosa e leve para esquentar a noite." },
  6: { titulo: "Quentão de inverno",                     descricao: "Festa junina dentro de casa." },
  7: { titulo: "Caldo verde tradicional",                descricao: "Couve, batata e linguiça — clássico." },
  8: { titulo: "Strogonoff de frango cremoso",           descricao: "Família reunida no domingo." },
  9: { titulo: "Bolo de cenoura com cobertura",          descricao: "A primavera no café da tarde." },
  10: { titulo: "Brigadeiro rosa no copinho",            descricao: "Outubro Rosa que cabe na bandeja." },
  11: { titulo: "Risoto de cogumelos com parmesão",      descricao: "Sofisticado e fácil." },
  12: { titulo: "Panettone caseiro de chocolate",        descricao: "O cheiro de Natal pelo apartamento." },
};

export function sugerirMateria(mes: number): SugestaoMaterial | null {
  return MATERIA_POR_MES[mes] ?? null;
}

export function sugerirReceita(mes: number): SugestaoReceita | null {
  return RECEITA_POR_MES[mes] ?? null;
}
