export const APPEARANCE_CONFIG_KEYS = {
  themePreset: "theme.preset",
  backgroundImage: "theme.background_image",
  fontPreset: "theme.font_preset",
} as const;

export const THEME_PRESETS = ["default", "classical"] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];

export const FONT_PRESETS = ["default", "sans", "serif", "mono", "lxgw-wenkai", "rounded"] as const;

export type FontPreset = (typeof FONT_PRESETS)[number];

export const CLASSICAL_THEME_DEFAULTS = {
  themeColor: "#b83b2b",
  fontPreset: "lxgw-wenkai" as FontPreset,
  feedCardVariant: "classical" as const,
};

const DEFAULT_THEME_PRESET: ThemePreset = "default";
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

// 规范化全局主题风格预设值，非法或空值回退为默认现代主题
export function normalizeThemePreset(value: string | undefined | null): ThemePreset {
  return THEME_PRESETS.includes(value as ThemePreset) ? (value as ThemePreset) : DEFAULT_THEME_PRESET;
}

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

// 根据客户端配置解析当前生效的主题强调色，古风预设未自定义颜色时回退为朱砂红
export function resolveThemeColorFromConfig(config: Record<string, unknown>): string | undefined {
  const explicitColor = config["theme.color"];
  if (typeof explicitColor === "string" && explicitColor.trim().length > 0) {
    return explicitColor;
  }
  const preset = normalizeThemePreset(
    typeof config[APPEARANCE_CONFIG_KEYS.themePreset] === "string"
      ? (config[APPEARANCE_CONFIG_KEYS.themePreset] as string)
      : undefined,
  );
  return preset === "classical" ? CLASSICAL_THEME_DEFAULTS.themeColor : undefined;
}

export function applyAppearanceConfig(config: Record<string, unknown>) {
  const root = document.documentElement;
  const themePresetValue = config[APPEARANCE_CONFIG_KEYS.themePreset];
  const themePreset = normalizeThemePreset(typeof themePresetValue === "string" ? themePresetValue : undefined);
  const backgroundImage = normalizeBackgroundImage(config[APPEARANCE_CONFIG_KEYS.backgroundImage]);
  const fontPresetValue = config[APPEARANCE_CONFIG_KEYS.fontPreset];
  const hasExplicitFontPreset = typeof fontPresetValue === "string" && fontPresetValue.trim().length > 0;
  const fontPreset = hasExplicitFontPreset
    ? normalizeFontPreset(fontPresetValue)
    : themePreset === "classical"
      ? CLASSICAL_THEME_DEFAULTS.fontPreset
      : DEFAULT_FONT_PRESET;

  ensureFontPresetAssets(fontPreset);
  root.setAttribute("data-theme-preset", themePreset);
  root.style.setProperty("--site-font-family", FONT_FAMILY_BY_PRESET[fontPreset]);
  root.style.setProperty("--site-background-image", backgroundImage ? toCssUrl(backgroundImage) : "none");
}
