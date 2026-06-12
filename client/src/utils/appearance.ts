export const APPEARANCE_CONFIG_KEYS = {
  backgroundImage: "theme.background_image",
  fontPreset: "theme.font_preset",
} as const;

export const FONT_PRESETS = ["default", "sans", "serif", "mono"] as const;

export type FontPreset = (typeof FONT_PRESETS)[number];

const DEFAULT_FONT_PRESET: FontPreset = "default";

const FONT_FAMILY_BY_PRESET: Record<FontPreset, string> = {
  default: 'Cantarell, "Source Han Serif CN VF", system-ui, sans-serif',
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: '"Source Han Serif CN VF", "Noto Serif CJK SC", Georgia, "Times New Roman", serif',
  mono: '"Sarasa Mono SC", "Cascadia Code", "SFMono-Regular", Consolas, monospace',
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

export function applyAppearanceConfig(config: Record<string, unknown>) {
  const root = document.documentElement;
  const backgroundImage = normalizeBackgroundImage(config[APPEARANCE_CONFIG_KEYS.backgroundImage]);
  const fontPresetValue = config[APPEARANCE_CONFIG_KEYS.fontPreset];
  const fontPreset = normalizeFontPreset(typeof fontPresetValue === "string" ? fontPresetValue : undefined);

  root.style.setProperty("--site-font-family", FONT_FAMILY_BY_PRESET[fontPreset]);
  root.style.setProperty("--site-background-image", backgroundImage ? toCssUrl(backgroundImage) : "none");
}
