export const APPEARANCE_CONFIG_KEYS = {
  backgroundImage: "theme.background_image",
  fontPreset: "theme.font_preset",
} as const;

export const FONT_PRESETS = ["default", "sans", "serif", "mono", "lxgw-wenkai", "rounded"] as const;

export type FontPreset = (typeof FONT_PRESETS)[number];

const DEFAULT_FONT_PRESET: FontPreset = "default";
const LXGW_WENKAI_STYLESHEET_ID = "lxgw-wenkai-webfont";
const LXGW_WENKAI_STYLESHEET_HREF = "/fonts/lxgw-wenkai/lxgwwenkai-regular.css";

const FONT_FAMILY_BY_PRESET: Record<FontPreset, string> = {
  default: 'Cantarell, "Source Han Serif CN VF", system-ui, sans-serif',
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: '"Source Han Serif CN VF", "Noto Serif CJK SC", Georgia, "Times New Roman", serif',
  mono: '"Sarasa Mono SC", "Cascadia Code", "SFMono-Regular", Consolas, monospace',
  "lxgw-wenkai": '"LXGW WenKai", "LXGW WenKai Screen", "Klee One", "Source Han Serif CN VF", serif',
  rounded: '"Rin OpenHuninn", ui-rounded, "SF Pro Rounded", "MiSans", "HarmonyOS Sans SC", "OPPO Sans", "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif',
};

export function normalizeFontPreset(value: string | undefined | null): FontPreset {
  return FONT_PRESETS.includes(value as FontPreset) ? (value as FontPreset) : DEFAULT_FONT_PRESET;
}

function normalizeBackgroundImage(value: unknown) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("/") ||
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\//i.test(trimmed) ||
    /^blob:/i.test(trimmed)
  ) {
    return trimmed;
  }

  return "";
}

function toCssUrl(value: string) {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, "");

  return `url("${escaped}")`;
}

function loadStylesheetOnce(id: string, href: string) {
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function ensureFontPresetAssets(fontPreset: FontPreset) {
  if (fontPreset === "lxgw-wenkai") {
    loadStylesheetOnce(LXGW_WENKAI_STYLESHEET_ID, LXGW_WENKAI_STYLESHEET_HREF);
  }
}

export function applyAppearanceConfig(config: Record<string, unknown>) {
  const root = document.documentElement;
  const backgroundImage = normalizeBackgroundImage(config[APPEARANCE_CONFIG_KEYS.backgroundImage]);
  const fontPresetValue = config[APPEARANCE_CONFIG_KEYS.fontPreset];
  const fontPreset = normalizeFontPreset(typeof fontPresetValue === "string" ? fontPresetValue : undefined);

  ensureFontPresetAssets(fontPreset);
  root.style.setProperty("--site-font-family", FONT_FAMILY_BY_PRESET[fontPreset]);
  root.style.setProperty("--site-background-image", backgroundImage ? toCssUrl(backgroundImage) : "none");
}
