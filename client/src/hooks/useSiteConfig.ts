import { useContext } from "react";
import { ClientConfigContext } from "../state/config";
import { normalizeFeedCardVariant } from "../components/feed-card-options";
import { normalizeFeedLayout } from "../components/feed-layout-options";
import {
    APPEARANCE_CONFIG_KEYS,
    CLASSICAL_THEME_DEFAULTS,
    normalizeFontPreset,
    normalizeThemePreset,
} from "../utils/appearance";

// Site configuration keys
export const SITE_CONFIG_KEYS = {
    headerBehavior: "header.behavior",
    name: "site.name",
    description: "site.description",
    avatar: "site.avatar",
    pageSize: "site.page_size",
    feedLayout: "feed.layout",
    feedCardVariant: "feed.card_variant",
    headerLayout: "header.layout",
    themePreset: APPEARANCE_CONFIG_KEYS.themePreset,
    themeColor: "theme.color",
    backgroundImage: APPEARANCE_CONFIG_KEYS.backgroundImage,
    fontPreset: APPEARANCE_CONFIG_KEYS.fontPreset,
} as const;

// Hook to get site configuration
export function useSiteConfig() {
    const config = useContext(ClientConfigContext);
    const pageSizeValue = config.get<string | number>(SITE_CONFIG_KEYS.pageSize);
    const parsedPageSize =
        typeof pageSizeValue === "number"
            ? pageSizeValue
            : typeof pageSizeValue === "string"
                ? parseInt(pageSizeValue, 10)
                : NaN;

    const themePreset = normalizeThemePreset(config.get<string>(SITE_CONFIG_KEYS.themePreset));
    const rawCardVariant = config.config[SITE_CONFIG_KEYS.feedCardVariant];
    const effectiveCardVariant =
        typeof rawCardVariant === "string" && rawCardVariant.trim().length > 0
            ? rawCardVariant
            : themePreset === "classical"
                ? CLASSICAL_THEME_DEFAULTS.feedCardVariant
                : config.get<string>(SITE_CONFIG_KEYS.feedCardVariant) || "default";
    const rawThemeColor = config.config[SITE_CONFIG_KEYS.themeColor];
    const effectiveThemeColor =
        typeof rawThemeColor === "string" && rawThemeColor.trim().length > 0
            ? rawThemeColor
            : themePreset === "classical"
                ? CLASSICAL_THEME_DEFAULTS.themeColor
                : config.get<string>(SITE_CONFIG_KEYS.themeColor) || "#4f46e5";

    return {
        name: config.get<string>(SITE_CONFIG_KEYS.name) || "Rin",
        description: config.get<string>(SITE_CONFIG_KEYS.description) || "",
        avatar: config.get<string>(SITE_CONFIG_KEYS.avatar) || "",
        pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : 5,
        headerBehavior: config.get<string>(SITE_CONFIG_KEYS.headerBehavior) || "fixed",
        feedLayout: normalizeFeedLayout(config.get<string>(SITE_CONFIG_KEYS.feedLayout) || "list"),
        feedCardVariant: normalizeFeedCardVariant(effectiveCardVariant),
        headerLayout: config.get<string>(SITE_CONFIG_KEYS.headerLayout) || "classic",
        themePreset,
        themeColor: effectiveThemeColor,
        backgroundImage: config.get<string>(SITE_CONFIG_KEYS.backgroundImage) || "",
        fontPreset: normalizeFontPreset(
            typeof config.config[SITE_CONFIG_KEYS.fontPreset] === "string"
                ? (config.config[SITE_CONFIG_KEYS.fontPreset] as string)
                : themePreset === "classical"
                    ? CLASSICAL_THEME_DEFAULTS.fontPreset
                    : config.get<string>(SITE_CONFIG_KEYS.fontPreset),
        ),
    };
}

// Hook to get a specific site config value
export function useSiteConfigValue<K extends keyof typeof SITE_CONFIG_KEYS>(
    key: K
): typeof SITE_CONFIG_KEYS[K] extends "site.page_size" ? number : string {
    const config = useContext(ClientConfigContext);
    const configKey = SITE_CONFIG_KEYS[key];

    if (key === "pageSize") {
        const value = config.get<string | number>(configKey);
        const parsed =
            typeof value === "number"
                ? value
                : typeof value === "string"
                    ? parseInt(value, 10)
                    : NaN;
        return (Number.isFinite(parsed) ? parsed : 5) as any;
    }

    return (config.get<string>(configKey) || "") as any;
}
