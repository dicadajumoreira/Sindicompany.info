/**
 * Helper compartilhado pra extrair uma mensagem legível de qualquer
 * erro — Error nativo, PostgrestError do Supabase, StorageError, etc.
 *
 * Sem isso, `String(e)` pode virar "[object Object]" e mensagens
 * úteis (`message`, `details`, `hint`) ficam escondidas.
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === "string" && obj.message) parts.push(obj.message);
    if (typeof obj.details === "string" && obj.details && obj.details !== obj.message) {
      parts.push(obj.details);
    }
    if (typeof obj.hint === "string" && obj.hint) parts.push(`(${obj.hint})`);
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      return "erro desconhecido";
    }
  }
  return "erro desconhecido";
}

/**
 * Tenta detectar erros típicos de migration faltando e retorna uma
 * mensagem que aponta pra solução, ou null se não bater no padrão.
 */
export function detectMigrationMissing(rawMessage: string): string | null {
  const m = rawMessage.toLowerCase();
  if (/column\s+(["']?\w+["']?)\s+does not exist/.test(m) || m.includes("could not find the")) {
    return "Faltam colunas no banco. Rode as migrations 20260508 e 20260510 no SQL Editor do Supabase.";
  }
  if (m.includes("relation") && m.includes("does not exist")) {
    if (m.includes("condominios_meta")) {
      return "Tabela condominios_meta não existe. Rode a migration 20260509 no Supabase.";
    }
    if (m.includes("revistas")) {
      return "Tabela revistas não existe. Rode a migration 20260507 no Supabase.";
    }
    return "Uma tabela não existe ainda no banco. Rode as migrations pendentes em supabase/migrations/.";
  }
  if (m.includes("bucket not found") || m.includes("not found bucket")) {
    return "Bucket de storage não existe. Verifique as migrations 20260507 (revistas-pdfs) e 20260509 (condominios-fotos).";
  }
  return null;
}
