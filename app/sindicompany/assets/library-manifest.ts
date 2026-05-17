// Sindicompany Brand Hub library manifest.
// Espelha o padrão do Consvicta (consvicta-assets/library-manifest.ts).
// Arquivos físicos em `public/sindicompany-library/{logos,patterns,icons}/`.
//
// Brand Hub novo (paleta Navy/Cyan/Beige/Lavender/Purple/White, 2026-05-17):
// - Logos: 3 PNG masks paramétricas (símbolo recolorível via mask-image)
//   + variações horizontais pintadas. Mais variações podem ser adicionadas
//   conforme upload manual via /sindicompany/assets/brand-assets/logos.
// - Patterns: 5 cantos coloridos (1 por cor principal) — sobem em curadoria
//   no upload action quando os PNGs estiverem disponíveis em public/.
// - Icons: stroke 1.5 paramétrico via símbolo recolorível.

export const SINDICOMPANY_LIBRARY_LOGOS: ReadonlyArray<string> = [
  "mask-houses.png",
  "mask-dot.png",
  "mask-outer-filled.png",
  "sindicompany-horizontal-dark.png",
];

export const SINDICOMPANY_LIBRARY_ICONS: ReadonlyArray<string> = [
  // Vazio por enquanto. Ícones do Brand Hub são paramétricos (stroke 1.5
  // recolorível). Adicionar PNGs/SVGs aqui quando assets/icons/ do ZIP
  // forem extraídos.
];

export const SINDICOMPANY_LIBRARY_PATTERNS: ReadonlyArray<string> = [
  // Vazio por enquanto. Cantos coloridos (canto-{navy,cyan,beige,lavender,purple}.png)
  // serão adicionados conforme upload manual ou extração futura do Brand Hub ZIP.
];
