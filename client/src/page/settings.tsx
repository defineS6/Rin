import { SearchableSelect, SettingsBadge, SettingsCard, SettingsCardBody, SettingsCardHeader, SettingsCardRow } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import Modal from "react-modal";
import { client, oauth_url } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog.tsx";
import { ImageUploadInput } from "../components/image-upload-input";
import { HeaderLayoutPreview } from "../components/site-header/layout-preview";
import {
  HEADER_BEHAVIOR_OPTIONS,
  HEADER_LAYOUT_OPTIONS,
  normalizeHeaderBehavior,
  normalizeHeaderLayout,
} from "../components/site-header/layout-options";
import { FEED_CARD_VARIANTS, normalizeFeedCardVariant } from "../components/feed-card-options";
import { FeedCardPreview } from "../components/feed-card-preview";
import { FEED_LAYOUT_OPTIONS, normalizeFeedLayout } from "../components/feed-layout-options";
import { SettingsPreviewCard } from "../components/settings-preview-card";
import { useSiteConfig } from "../hooks/useSiteConfig";
import {
  APPEARANCE_CONFIG_KEYS,
  CLASSICAL_THEME_DEFAULTS,
  FONT_PRESETS,
  THEME_PRESETS,
  applyAppearanceConfig,
  normalizeFontPreset,
  normalizeThemePreset,
  resolveThemeColorFromConfig,
} from "../utils/appearance";
import { applyThemeColor, normalizeThemeColor } from "../utils/theme-color";
import { AISummarySettings } from "./settings-ai";
import { ItemButton, ItemImageInput, ItemInput, ItemSwitch, ItemTitle, ItemWithUpload } from "./settings-items";
import {
  areSettingsDraftsEqual,
  buildAIConfigDraftValue,
  createSettingsConfigWrappers,
  importWordPressFile,
  loadSettingsConfigState,
  mergeSessionConfig,
  saveSettingsConfigState,
  type SettingsDraft,
  updateDraftConfig,
  uploadFavicon,
} from "./settings-helpers";

import "../utils/thumb.css";

const WEBHOOK_METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((value) => ({
  label: value,
  value,
}));

const THEME_COLOR_OPTIONS = [
  { label: "Rose", value: "#fc466b" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Blue", value: "#4f46e5" },
  { label: "Teal", value: "#0f766e" },
  { label: "Orange", value: "#ea580c" },
  { label: "Cinnabar", value: "#b83b2b" },
  { label: "Indigo", value: "#2e4e7e" },
  { label: "Bamboo", value: "#4f6f52" },
  { label: "Amber", value: "#b58938" },
];

export function Settings() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgList, setMsgList] = useState<{ title: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestMessage, setWebhookTestMessage] = useState("");
  const [backgroundImageOpen, setBackgroundImageOpen] = useState(false);
  const [draft, setDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [initialDraft, setInitialDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [hasStoredAiApiKey, setHasStoredAiApiKey] = useState(false);
  const ref = useRef(false);
  const initialDraftRef = useRef<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const { showAlert, AlertUI } = useAlert();

  function getDraftThemeColor(nextDraft: SettingsDraft) {
    return resolveThemeColorFromConfig(nextDraft.clientConfig);
  }

  useEffect(() => {
    if (ref.current) return;
    loadSettingsConfigState()
      .then((state) => {
        setDraft(state.draft);
        setInitialDraft(state.draft);
        initialDraftRef.current = state.draft;
        setHasStoredAiApiKey(state.hasStoredAiApiKey);
        mergeSessionConfig(state.draft.clientConfig);
        applyAppearanceConfig(state.draft.clientConfig);
        applyThemeColor(getDraftThemeColor(state.draft));
      })
      .catch((err: any) => {
        showAlert(t("settings.get_config_failed$message", { message: err.message }));
      })
      .finally(() => {
        setLoading(false);
      });
    ref.current = true;

    return () => {
      applyAppearanceConfig(initialDraftRef.current.clientConfig);
      applyThemeColor(getDraftThemeColor(initialDraftRef.current));
    };
  }, [showAlert, t]);

  const { clientConfig, serverConfig } = useMemo(() => createSettingsConfigWrappers(draft), [draft]);
  const aiValue = useMemo(() => buildAIConfigDraftValue(draft, hasStoredAiApiKey), [draft, hasStoredAiApiKey]);
  const hasUnsavedChanges = !areSettingsDraftsEqual(draft, initialDraft);
  const themePresetValue = normalizeThemePreset(clientConfig.get<string>(APPEARANCE_CONFIG_KEYS.themePreset));
  const themeColorValue = normalizeThemeColor(
    resolveThemeColorFromConfig(draft.clientConfig) ?? String(clientConfig.get("theme.color") ?? "#4f46e5"),
  );
  const backgroundImageValue = String(clientConfig.get(APPEARANCE_CONFIG_KEYS.backgroundImage) ?? "");
  const fontPresetValue = normalizeFontPreset(
    typeof draft.clientConfig[APPEARANCE_CONFIG_KEYS.fontPreset] === "string"
      ? (draft.clientConfig[APPEARANCE_CONFIG_KEYS.fontPreset] as string)
      : themePresetValue === "classical"
        ? CLASSICAL_THEME_DEFAULTS.fontPreset
        : clientConfig.get<string>(APPEARANCE_CONFIG_KEYS.fontPreset),
  );
  const feedLayoutValue = normalizeFeedLayout(String(clientConfig.get("feed.layout") ?? "list"));
  const feedCardVariantValue = normalizeFeedCardVariant(
    typeof draft.clientConfig["feed.card_variant"] === "string"
      ? (draft.clientConfig["feed.card_variant"] as string)
      : themePresetValue === "classical"
        ? CLASSICAL_THEME_DEFAULTS.feedCardVariant
        : String(clientConfig.get("feed.card_variant") ?? "default"),
  );
  const previewSiteName = String(clientConfig.get("site.name") ?? clientConfig.default("site.name") ?? "Rin");
  const previewSiteAvatar = String(clientConfig.get("site.avatar") ?? clientConfig.default("site.avatar") ?? "");

  function setConfigValue(type: "client" | "server", key: string, value: unknown) {
    setDraft((current) => updateDraftConfig(current, type, key, value));
  }

  function setAppearanceConfigValue(key: string, value: string) {
    setConfigValue("client", key, value);
    applyAppearanceConfig({ ...draft.clientConfig, [key]: value });
  }

  // 切换全局主题风格预设，并智能联动主题色、字体与卡片样式
  function handleThemePresetChange(rawPreset: string) {
    const nextPreset = normalizeThemePreset(rawPreset);
    const nextClientConfig: Record<string, unknown> = {
      ...draft.clientConfig,
      [APPEARANCE_CONFIG_KEYS.themePreset]: nextPreset,
    };

    const currentColor = typeof draft.clientConfig["theme.color"] === "string" ? draft.clientConfig["theme.color"] : "";
    const currentFont =
      typeof draft.clientConfig[APPEARANCE_CONFIG_KEYS.fontPreset] === "string"
        ? draft.clientConfig[APPEARANCE_CONFIG_KEYS.fontPreset]
        : "";
    const currentCard =
      typeof draft.clientConfig["feed.card_variant"] === "string" ? draft.clientConfig["feed.card_variant"] : "";

    if (nextPreset === "classical") {
      if (!currentColor || currentColor.toLowerCase() === "#4f46e5") {
        nextClientConfig["theme.color"] = CLASSICAL_THEME_DEFAULTS.themeColor;
      }
      if (!currentFont || currentFont === "default") {
        nextClientConfig[APPEARANCE_CONFIG_KEYS.fontPreset] = CLASSICAL_THEME_DEFAULTS.fontPreset;
      }
      if (!currentCard || currentCard === "default") {
        nextClientConfig["feed.card_variant"] = CLASSICAL_THEME_DEFAULTS.feedCardVariant;
      }
    } else {
      if (currentColor.toLowerCase() === CLASSICAL_THEME_DEFAULTS.themeColor) {
        nextClientConfig["theme.color"] = "#4f46e5";
      }
      if (currentFont === CLASSICAL_THEME_DEFAULTS.fontPreset) {
        nextClientConfig[APPEARANCE_CONFIG_KEYS.fontPreset] = "default";
      }
      if (currentCard === CLASSICAL_THEME_DEFAULTS.feedCardVariant) {
        nextClientConfig["feed.card_variant"] = "default";
      }
    }

    setDraft((current) => ({
      ...current,
      clientConfig: nextClientConfig,
    }));
    applyAppearanceConfig(nextClientConfig);
    applyThemeColor(resolveThemeColorFromConfig(nextClientConfig));
  }

  function handleReset() {
    setDraft(initialDraft);
    applyAppearanceConfig(initialDraft.clientConfig);
    applyThemeColor(getDraftThemeColor(initialDraft));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const state = await saveSettingsConfigState(draft);
      setDraft(state.draft);
      setInitialDraft(state.draft);
      initialDraftRef.current = state.draft;
      setHasStoredAiApiKey(state.hasStoredAiApiKey || aiValue.apiKey.trim().length > 0);
      mergeSessionConfig(state.draft.clientConfig);
      applyAppearanceConfig(state.draft.clientConfig);
      applyThemeColor(getDraftThemeColor(state.draft));
      window.dispatchEvent(new Event("storage"));
      showAlert(t("settings.ai_summary.save_success"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showAlert(t("settings.update_failed$message", { message }));
    } finally {
      setSaving(false);
    }
  }

  async function handleFaviconChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFavicon(file, t, showAlert);
    }
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const { data, error } = await importWordPressFile(file);
      if (data) {
        setMsg(t("settings.import_success$success$skipped", { success: data.imported, skipped: 0 }));
        setMsgList([]);
        setIsOpen(true);
      } else if (error) {
        showAlert(t("settings.import_failed$message", { message: error.value }));
      }
    }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true);
    try {
      const { data, error } = await client.config.testWebhook({
        webhook_url: String(serverConfig.get("webhook_url") ?? ""),
        "webhook.method": String(serverConfig.get("webhook.method") ?? ""),
        "webhook.content_type": String(serverConfig.get("webhook.content_type") ?? ""),
        "webhook.headers": String(serverConfig.get("webhook.headers") ?? ""),
        "webhook.body_template": String(serverConfig.get("webhook.body_template") ?? ""),
        test_message: webhookTestMessage,
      });

      if (error || !data?.success) {
        const message = error?.value || data?.error || t("settings.webhook.test.failed");
        const details = data?.details ? `\n${data.details}` : "";
        showAlert(`${message}${details}`);
        return;
      }

      showAlert(t("settings.webhook.test.success"));
    } finally {
      setTestingWebhook(false);
    }
  }

  return (
    <div className="flex w-full flex-col">
      <Helmet>
        <title>{`${t("settings.title")} - ${siteConfig.name}`}</title>
      </Helmet>
      <main className="w-full rounded-2xl bg-w" aria-label={t("main_content")}>
        <div className="flex flex-col items-start space-y-2">
          {(loading || saving) && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
          <ItemTitle title={t("settings.site.title")} />
          <ItemInput
            title={t("settings.site.name.title")}
            description={t("settings.site.name.desc")}
            configKeyTitle={t("settings.site.name.label")}
            value={String(clientConfig.get("site.name") ?? "")}
            placeholder={String(clientConfig.default("site.name") ?? t("settings.site.name.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.name", value);
            }}
          />
          <ItemInput
            title={t("settings.site.description.title")}
            description={t("settings.site.description.desc")}
            configKeyTitle={t("settings.site.description.label")}
            value={String(clientConfig.get("site.description") ?? "")}
            placeholder={String(clientConfig.default("site.description") ?? t("settings.site.description.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.description", value);
            }}
          />
          <ItemImageInput
            title={t("settings.site.avatar.title")}
            description={t("settings.site.avatar.desc")}
            configKeyTitle={t("settings.site.avatar.label")}
            value={String(clientConfig.get("site.avatar") ?? "")}
            placeholder={String(clientConfig.default("site.avatar") ?? t("settings.site.avatar.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.avatar", value);
            }}
            onError={showAlert}
          />
          <ItemInput
            title={t("settings.site.page_size.title")}
            description={t("settings.site.page_size.desc")}
            configKeyTitle={t("settings.site.page_size.label")}
            value={String(clientConfig.get("site.page_size") ?? "")}
            placeholder={String(clientConfig.default("site.page_size") ?? t("settings.site.page_size.label"))}
            onChange={(value) => {
              setConfigValue("client", "site.page_size", value);
            }}
          />

          <ItemTitle title={t("settings.personalization.title")} />
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.theme_preset.title")}
                    description={t("settings.theme_preset.desc")}
                  />
                }
                action={
                  <SearchableSelect
                    value={themePresetValue}
                    onChange={(value) => {
                      handleThemePresetChange(value);
                    }}
                    options={THEME_PRESETS.map((value) => ({
                      value,
                      label: t(`settings.theme_preset.options.${value}`),
                    }))}
                    placeholder={t("settings.theme_preset.title")}
                    emptyLabel={t("no_more")}
                    searchable={false}
                  />
                }
              />
              <SettingsCardBody>
                <div className="grid gap-3 md:grid-cols-2">
                  {THEME_PRESETS.map((preset) => (
                    <SettingsPreviewCard
                      key={preset}
                      selected={themePresetValue === preset}
                      title={t(`settings.theme_preset.options.${preset}`)}
                      description={t(`settings.theme_preset.preview.${preset}`)}
                      onClick={() => {
                        handleThemePresetChange(preset);
                      }}
                      preview={
                        preset === "classical" ? (
                          <div className="classical-scroll-card flex w-full flex-col justify-between rounded-lg border border-[#8c7355]/30 bg-[#fbf8f1] p-4 text-[#2b2520] dark:border-[#d4b88c]/20 dark:bg-[#211e1b] dark:text-[#ebe4d8]">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center rounded-[3px] border border-[#b83b2b]/65 bg-[#b83b2b]/10 px-2 py-0.5 text-[11px] font-semibold tracking-[0.14em] text-[#b83b2b]">
                                  {t("article.top.title")}
                                </span>
                                <span className="text-[11px] tracking-widest text-[#6d6053] dark:text-[#b0a494]">
                                  宣纸 · 水墨 · 朱砂
                                </span>
                              </div>
                              <p className="mt-2.5 text-base font-semibold tracking-[0.04em]">
                                竹露松风 · 书卷雅韵
                              </p>
                              <p className="mt-1.5 text-xs leading-6 text-[#6d6053] dark:text-[#b0a494]">
                                温润宣纸底色配浓墨文楷字形，辅以朱文方印与古籍双线锦框。
                              </p>
                            </div>
                            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[#8c7355]/15 dark:border-[#d4b88c]/15">
                              <span className="rounded-[4px] border border-[#b83b2b]/30 bg-[#b83b2b]/5 px-2 py-0.5 text-[11px] text-[#b83b2b]">
                                #诗词
                              </span>
                              <span className="rounded-[4px] border border-[#b83b2b]/30 bg-[#b83b2b]/5 px-2 py-0.5 text-[11px] text-[#b83b2b]">
                                #随笔
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex w-full flex-col justify-between rounded-2xl border border-black/5 bg-white p-4 text-neutral-900 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:text-white">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                  {t("article.top.title")}
                                </span>
                                <span className="text-[11px] text-neutral-400">
                                  Modern · Clean
                                </span>
                              </div>
                              <p className="mt-2.5 text-base font-semibold">
                                Modern Minimalist Surface
                              </p>
                              <p className="mt-1.5 text-xs leading-6 text-neutral-500 dark:text-neutral-400">
                                干净利落的现代圆角卡片与高对比无衬线排版，专注纯粹阅读体验。
                              </p>
                            </div>
                            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/10">
                              <span className="rounded-full border border-indigo-500/15 bg-indigo-500/5 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                #design
                              </span>
                              <span className="rounded-full border border-indigo-500/15 bg-indigo-500/5 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                                #reading
                              </span>
                            </div>
                          </div>
                        )
                      }
                    />
                  ))}
                </div>
              </SettingsCardBody>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.header_layout.title")}
                      description={t("settings.header_layout.desc")}
                    />
                  }
                action={
                  <SearchableSelect
                    value={normalizeHeaderLayout(String(clientConfig.get("header.layout") ?? "classic"))}
                    onChange={(value) => {
                      setConfigValue("client", "header.layout", value);
                    }}
                    options={HEADER_LAYOUT_OPTIONS.map((value) => ({
                      value,
                      label: t(`settings.header_layout.options.${value}`),
                    }))}
                    placeholder={t("settings.header_layout.title")}
                    emptyLabel={t("no_more")}
                    searchable={false}
                  />
                }
              />
              <SettingsCardBody>
                <div className="grid gap-3 md:grid-cols-2">
                  {HEADER_LAYOUT_OPTIONS.map((value) => (
                    <HeaderLayoutPreview
                      key={value}
                      data={{
                        avatar: previewSiteAvatar,
                        name: previewSiteName,
                        themeColor: themeColorValue,
                      }}
                      layout={value}
                      selected={normalizeHeaderLayout(String(clientConfig.get("header.layout") ?? "classic")) === value}
                      title={t(`settings.header_layout.options.${value}`)}
                      description={t(`settings.header_layout.preview.${value}`)}
                      onClick={() => {
                        setConfigValue("client", "header.layout", value);
                      }}
                    />
                  ))}
                </div>
              </SettingsCardBody>
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.feed_layout.title")}
                      description={t("settings.feed_layout.desc")}
                    />
                  }
                  action={
                    <SearchableSelect
                      value={feedLayoutValue}
                      onChange={(value) => {
                        setConfigValue("client", "feed.layout", value);
                      }}
                      options={FEED_LAYOUT_OPTIONS.map((value) => ({
                        value,
                        label: t(`settings.feed_layout.options.${value}`),
                      }))}
                      placeholder={t("settings.feed_layout.title")}
                      emptyLabel={t("no_more")}
                      searchable={false}
                    />
                  }
                />
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.feed_card.title")}
                      description={t("settings.feed_card.desc")}
                    />
                  }
                  action={
                    <SearchableSelect
                      value={feedCardVariantValue}
                      onChange={(value) => {
                        setConfigValue("client", "feed.card_variant", value);
                      }}
                      options={FEED_CARD_VARIANTS.map((value) => ({
                        value,
                        label: t(`settings.feed_card.options.${value}`),
                      }))}
                      placeholder={t("settings.feed_card.title")}
                      emptyLabel={t("no_more")}
                      searchable={false}
                    />
                  }
                />
                <SettingsCardBody>
                  <div className="grid gap-3 md:grid-cols-3">
                    {FEED_CARD_VARIANTS.map((value) => (
                      <FeedCardPreview
                        key={value}
                        variant={value}
                        selected={feedCardVariantValue === value}
                        title={t(`settings.feed_card.options.${value}`)}
                        description={t(`settings.feed_card.preview.${value}`)}
                        onClick={() => {
                          setConfigValue("client", "feed.card_variant", value);
                        }}
                      />
                    ))}
                  </div>
                </SettingsCardBody>
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.theme_color.title")}
                      description={t("settings.theme_color.desc")}
                    />
                  }
                  action={
                    <div className="text-sm font-medium t-primary">{themeColorValue}</div>
                  }
                />
                <SettingsCardBody>
                  <div className="flex flex-wrap gap-3">
                    {THEME_COLOR_OPTIONS.map((option) => {
                      const selected = themeColorValue === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setConfigValue("client", "theme.color", option.value);
                            applyThemeColor(option.value);
                          }}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all ${
                            selected
                              ? "border-theme bg-theme/5 shadow-sm shadow-theme/10"
                              : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
                          }`}
                        >
                          <span
                            className="h-6 w-6 rounded-full border border-black/10 dark:border-white/10"
                            style={{ backgroundColor: option.value }}
                          />
                          <span className="text-sm t-primary">{t(`settings.theme_color.options.${option.label.toLowerCase()}`)}</span>
                          {selected ? <i className="ri-check-line text-theme" /> : null}
                        </button>
                      );
                    })}
                    <label className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20">
                      <input
                        type="color"
                        value={themeColorValue}
                        onChange={(event) => {
                          const normalized = normalizeThemeColor(event.target.value);
                          setConfigValue("client", "theme.color", normalized);
                          applyThemeColor(normalized);
                        }}
                        className="color-input-reset h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                      />
                      <span className="text-sm t-primary">{t("settings.theme_color.custom")}</span>
                    </label>
                  </div>
                </SettingsCardBody>
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    setBackgroundImageOpen((current) => !current);
                  }}
                >
                  <SettingsCardRow
                    header={
                      <SettingsCardHeader
                        title={t("settings.background_image.title")}
                        description={t("settings.background_image.desc")}
                      />
                    }
                    action={
                      <div className="flex items-center gap-3">
                        {backgroundImageValue ? (
                          <img
                            src={backgroundImageValue}
                            alt={t("settings.background_image.label")}
                            className="h-10 w-14 rounded-xl border border-black/10 object-cover dark:border-white/10"
                          />
                        ) : null}
                        <span className="max-w-56 truncate text-sm text-neutral-500 dark:text-neutral-400">
                          {backgroundImageValue || t("settings.background_image.empty")}
                        </span>
                        <i
                          className={`ri-arrow-down-s-line text-lg text-neutral-400 transition-transform ${backgroundImageOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </div>
                    }
                  />
                </button>
                {backgroundImageOpen ? (
                  <SettingsCardBody>
                    <ImageUploadInput
                      value={backgroundImageValue}
                      onChange={(value) => {
                        setAppearanceConfigValue(APPEARANCE_CONFIG_KEYS.backgroundImage, value);
                      }}
                      onError={showAlert}
                      placeholder={t("settings.background_image.label")}
                    />
                  </SettingsCardBody>
                ) : null}
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.font_preset.title")}
                      description={t("settings.font_preset.desc")}
                    />
                  }
                  action={
                    <SearchableSelect
                      value={fontPresetValue}
                      onChange={(value) => {
                        setAppearanceConfigValue(APPEARANCE_CONFIG_KEYS.fontPreset, value);
                      }}
                      options={FONT_PRESETS.map((value) => ({
                        value,
                        label: t(`settings.font_preset.options.${value}`),
                      }))}
                      placeholder={t("settings.font_preset.title")}
                      emptyLabel={t("no_more")}
                      searchable={false}
                    />
                  }
                />
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.header_behavior.title")}
                      description={t("settings.header_behavior.desc")}
                    />
                  }
                  action={
                    <SearchableSelect
                      value={normalizeHeaderBehavior(String(clientConfig.get("header.behavior") ?? "fixed"))}
                      onChange={(value) => {
                        setConfigValue("client", "header.behavior", value);
                      }}
                      options={HEADER_BEHAVIOR_OPTIONS.map((value) => ({
                        value,
                        label: t(`settings.header_behavior.options.${value}`),
                      }))}
                      placeholder={t("settings.header_behavior.title")}
                      emptyLabel={t("no_more")}
                      searchable={false}
                    />
                  }
                />
              </div>
            </SettingsCard>
          </div>

          <ItemTitle title={t("settings.other.title")} />
          <ItemSwitch
            title={t("settings.login.enable.title")}
            description={t("settings.login.enable.desc", { url: oauth_url })}
            checked={clientConfig.getBoolean("login.enabled")}
            onChange={(checked) => {
              setConfigValue("client", "login.enabled", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.comment.enable.title")}
            description={t("settings.comment.enable.desc")}
            checked={clientConfig.getBoolean("comment.enabled")}
            onChange={(checked) => {
              setConfigValue("client", "comment.enabled", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.counter.enable.title")}
            description={t("settings.counter.enable.desc")}
            checked={clientConfig.getBoolean("counter.enabled")}
            onChange={(checked) => {
              setConfigValue("client", "counter.enabled", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.rss.title")}
            description={t("settings.rss.desc")}
            checked={clientConfig.getBoolean("rss")}
            onChange={(checked) => {
              setConfigValue("client", "rss", checked);
            }}
          />
          <ItemWithUpload
            title={t("settings.favicon.title")}
            description={t("settings.favicon.desc")}
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            onFileChange={handleFaviconChange}
          />
          <ItemInput
            title={t("settings.footer.title")}
            description={t("settings.footer.desc")}
            configKeyTitle="Footer HTML"
            value={String(clientConfig.get("footer") ?? "")}
            onChange={(value) => {
              setConfigValue("client", "footer", value);
            }}
          />

          <ItemTitle title={t("settings.webhook.title")} />
          <ItemInput
            title={t("settings.webhook.url.title")}
            description={t("settings.webhook.url.desc")}
            configKeyTitle="WEBHOOK_URL"
            value={String(serverConfig.get("webhook_url") ?? "")}
            placeholder="https://example.com/webhook"
            onChange={(value) => {
              setConfigValue("server", "webhook_url", value);
            }}
          />
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.webhook.method.title")}
                    description={t("settings.webhook.method.desc")}
                  />
                }
                action={
                  <SearchableSelect
                    value={String(serverConfig.get("webhook.method") ?? "")}
                    onChange={(value) => {
                      setConfigValue("server", "webhook.method", value);
                    }}
                    options={WEBHOOK_METHOD_OPTIONS}
                    placeholder={String(serverConfig.default("webhook.method") ?? "POST")}
                    searchPlaceholder={t("settings.webhook.method.title")}
                    emptyLabel={t("no_more")}
                    allowCustomValue
                    customValueLabel={(value) => `${t("update.title")}: ${value}`}
                  />
                }
              />
            </SettingsCard>
          </div>
          <ItemInput
            title={t("settings.webhook.content_type.title")}
            description={t("settings.webhook.content_type.desc")}
            configKeyTitle="Content-Type"
            value={String(serverConfig.get("webhook.content_type") ?? "")}
            placeholder={String(serverConfig.default("webhook.content_type") ?? "application/json")}
            onChange={(value) => {
              setConfigValue("server", "webhook.content_type", value);
            }}
          />
          <ItemInput
            title={t("settings.webhook.headers.title")}
            description={t("settings.webhook.headers.desc")}
            configKeyTitle={t("settings.webhook.headers.label")}
            value={String(serverConfig.get("webhook.headers") ?? "")}
            placeholder={String(serverConfig.default("webhook.headers") ?? "{}")}
            onChange={(value) => {
              setConfigValue("server", "webhook.headers", value);
            }}
          />
          <ItemInput
            title={t("settings.webhook.body_template.title")}
            description={t("settings.webhook.body_template.desc")}
            configKeyTitle={t("settings.webhook.body_template.label")}
            value={String(serverConfig.get("webhook.body_template") ?? "")}
            placeholder={String(serverConfig.default("webhook.body_template") ?? "")}
            onChange={(value) => {
              setConfigValue("server", "webhook.body_template", value);
            }}
          />
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.webhook.test.title")}
                    description={t("settings.webhook.test.desc")}
                  />
                }
                action={
                  <Button
                    title={testingWebhook ? t("settings.webhook.test.sending") : t("settings.webhook.test.button")}
                    onClick={handleTestWebhook}
                    disabled={testingWebhook}
                  />
                }
              />
              <SettingsCardBody>
                <textarea
                  value={webhookTestMessage}
                  placeholder={t("settings.webhook.test.placeholder")}
                  onChange={(event) => {
                    setWebhookTestMessage(event.target.value);
                  }}
                  className="min-h-28 w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                />
              </SettingsCardBody>
            </SettingsCard>
          </div>

          <ItemTitle title={t("settings.friend.title")} />
          <ItemSwitch
            title={t("settings.friend.apply.title")}
            description={t("settings.friend.apply.desc")}
            checked={Boolean(clientConfig.get("friend_apply_enable"))}
            onChange={(checked) => {
              setConfigValue("client", "friend_apply_enable", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.friend.health.title")}
            description={t("settings.friend.health.desc")}
            checked={Boolean(serverConfig.get("friend_crontab"))}
            onChange={(checked) => {
              setConfigValue("server", "friend_crontab", checked);
            }}
          />
          <ItemInput
            title={t("settings.friend.health.ua.title")}
            description={t("settings.friend.health.ua.desc")}
            configKeyTitle="User-Agent"
            value={String(serverConfig.get("friend_ua") ?? "")}
            placeholder={String(serverConfig.default("friend_ua") ?? "User-Agent")}
            onChange={(value) => {
              setConfigValue("server", "friend_ua", value);
            }}
          />

          <ItemTitle title={t("settings.maintenance.title")} />
          <ItemSwitch
            title={t("settings.cache.enabled.title")}
            description={t("settings.cache.enabled.desc")}
            checked={Boolean(clientConfig.getBoolean("cache.enabled"))}
            onChange={(checked) => {
              setConfigValue("client", "cache.enabled", checked);
            }}
          />
          <ItemButton
            title={t("settings.cache.clear.title")}
            description={t("settings.cache.clear.desc")}
            buttonTitle={t("clear")}
            onConfirm={async () => {
              await client.config.clearCache().then(({ error }) => {
                if (error) {
                  showAlert(t("settings.cache.clear_failed$message", { message: error.value }));
                }
              });
            }}
            alertTitle={t("settings.cache.clear.confirm.title")}
            alertDescription={t("settings.cache.clear.confirm.desc")}
          />
          <ItemWithUpload
            title={t("settings.wordpress.title")}
            description={t("settings.wordpress.desc")}
            accept="application/xml"
            onFileChange={onFileChange}
          />

          <AISummarySettings
            value={aiValue}
            onChange={(updates) => {
              if (updates.enabled !== undefined) {
                setConfigValue("server", "ai_summary.enabled", updates.enabled);
              }
              if (updates.provider !== undefined) {
                setConfigValue("server", "ai_summary.provider", updates.provider);
              }
              if (updates.model !== undefined) {
                setConfigValue("server", "ai_summary.model", updates.model);
              }
              if (updates.apiUrl !== undefined) {
                setConfigValue("server", "ai_summary.api_url", updates.apiUrl);
              }
              if (updates.apiKey !== undefined) {
                setConfigValue("server", "ai_summary.api_key", updates.apiKey);
              }
            }}
          />

          {hasUnsavedChanges && (
            <div className="sticky bottom-4 z-20 mt-6 w-full pb-2">
              <SettingsCard tone="warning">
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.ai_summary.save.title")}
                    description={t("settings.ai_summary.unsaved_changes")}
                    badge={<SettingsBadge tone="warning">{t("settings.ai_summary.unsaved_changes")}</SettingsBadge>}
                  />
                }
                action={
                  <>
                    <Button secondary title={t("reset")} onClick={handleReset} disabled={saving} />
                    <Button title={t("save")} onClick={handleSave} disabled={saving || loading} />
                  </>
                }
              />
              </SettingsCard>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={isOpen}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            padding: "0",
            border: "none",
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "transparent",
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
      >
        <div className="flex flex-col items-start bg-w p-4">
          <h1 className="text-2xl font-bold t-primary">{t("settings.import_result")}</h1>
          <p className="text-base dark:text-white">{msg}</p>
          <div className="flex w-full flex-col items-start">
            <p className="mt-2 text-base font-bold dark:text-white">{t("settings.import_skipped")}</p>
            <ul className="flex max-h-64 w-full flex-col items-start overflow-auto">
              {msgList.map((item, idx) => (
                <p key={idx} className="text-sm dark:text-white">
                  {t("settings.import_skipped_item$title$reason", { title: item.title, reason: item.reason })}
                </p>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex w-full flex-col items-center">
            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="h-min rounded-xl bg-theme px-8 py-2 text-white"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </Modal>
      <AlertUI />
    </div>
  );
}
