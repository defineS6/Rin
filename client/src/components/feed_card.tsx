import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { timeago } from "../utils/timeago";
import { HashTag } from "./hashtag";
import { useEffect, useRef } from "react";
import { drawBlurhashToCanvas } from "../utils/blurhash";
import { parseImageUrlMetadata } from "../utils/image-upload";
import { useImageLoadState } from "../utils/use-image-load-state";
import { type FeedCardVariant, normalizeFeedCardVariant } from "./feed-card-options";
import { useSiteConfig } from "../hooks/useSiteConfig";

function FeedCardImage({ src, variant }: { src: string; variant: FeedCardVariant }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(src);
    const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(cleanSrc);
    const aspectRatio = width && height ? `${width} / ${height}` : undefined;
    const imageFrameClass =
        variant === "editorial"
            ? "relative flex max-h-80 w-full flex-row items-center overflow-hidden rounded-[18px]"
            : "relative flex max-h-80 w-full flex-row items-center overflow-hidden rounded-xl";

    useEffect(() => {
        if (!blurhash || !canvasRef.current) {
            return;
        }
        try {
            drawBlurhashToCanvas(canvasRef.current, blurhash);
        } catch (error) {
            console.error("Failed to render blurhash", error);
        }
    }, [blurhash]);

    return (
        <div
            className={imageFrameClass}
            style={{ aspectRatio }}
        >
            {blurhash && !loaded ? (
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
                />
            ) : null}
            <img
                ref={imageRef}
                src={cleanSrc}
                alt=""
                width={width}
                height={height}
                onLoad={onLoad}
                onError={onError}
                className={`absolute inset-0 h-full w-full object-cover object-center transition duration-300 ease-out motion-reduce:transition-none motion-safe:hover:scale-[1.02] ${blurhash && (!loaded || failed) ? "opacity-0" : "opacity-100"
                    }`}
            />
        </div>
    );
}

const FEED_CARD_STYLES: Record<
    FeedCardVariant,
    {
        card: string;
        imageWrap: string;
        meta: string;
        summary: string;
        title: string;
    }
> = {
    default: {
        card: "group blog-surface blog-interactive inline-block w-full break-inside-avoid overflow-hidden rounded-2xl p-5 md:p-6 [content-visibility:auto] [contain-intrinsic-size:1px_260px]",
        imageWrap: "mb-4 overflow-hidden rounded-xl border border-black/5 dark:border-white/10",
        meta: "mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-neutral-500 dark:text-neutral-400",
        summary: "mt-3 line-clamp-4 text-pretty overflow-hidden text-[15px] leading-7 text-neutral-600 dark:text-neutral-300",
        title: "text-xl font-semibold leading-snug text-neutral-900 text-pretty overflow-hidden transition-colors group-hover:text-theme dark:text-white",
    },
    editorial: {
        card: "group blog-surface blog-interactive inline-block w-full break-inside-avoid overflow-hidden rounded-3xl p-3 [content-visibility:auto] [contain-intrinsic-size:1px_340px]",
        imageWrap: "mb-4 overflow-hidden rounded-[22px] border border-black/5 dark:border-white/10",
        meta: "mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400",
        summary: "mt-4 line-clamp-5 max-w-3xl text-pretty text-[15px] leading-7 text-neutral-600 dark:text-neutral-300",
        title: "text-2xl font-semibold leading-tight text-neutral-900 text-pretty overflow-hidden transition-colors group-hover:text-theme dark:text-white",
    },
};

export type FeedCardProps = {
    id: string;
    avatar?: string;
    draft?: number;
    listed?: number;
    top?: number;
    title: string;
    summary: string;
    hashtags: { id: number, name: string }[];
    createdAt: Date;
    updatedAt: Date;
    preview?: boolean;
    variant?: FeedCardVariant;
};

export function FeedCard({ id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt, preview = false, variant }: FeedCardProps) {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const activeVariant = normalizeFeedCardVariant(variant ?? siteConfig.feedCardVariant);
    const styles = FEED_CARD_STYLES[activeVariant];
    const hasState = draft === 1 || listed === 0 || top === 1;
    const body = (
        <div className={styles.card}>
            {avatar ? (
                <div className={styles.imageWrap}>
                    <FeedCardImage src={avatar} variant={activeVariant} />
                </div>
            ) : null}
            <div className={activeVariant === "editorial" ? "px-2 pb-2" : ""}>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.meta}>
                    <span title={new Date(createdAt).toLocaleString()}>
                        {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                    </span>
                    {createdAt !== updatedAt &&
                        <span title={new Date(updatedAt).toLocaleString()}>
                            {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                        </span>
                    }
                </p>
                {hasState && (
                    <p className={styles.meta}>
                        {draft === 1 && <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-white/10">{t("draft")}</span>}
                        {listed === 0 && <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-white/10">{t("unlisted")}</span>}
                        {top === 1 && <span className="rounded-full bg-theme/10 px-2 py-0.5 text-theme">{t('article.top.title')}</span>}
                    </p>
                )}
                <p className={styles.summary}>{summary}</p>
                {hashtags.length > 0 &&
                    <div className={`flex flex-row flex-wrap justify-start gap-2 ${activeVariant === "editorial" ? "mt-4" : "mt-3"}`}>
                        {hashtags.map(({ name }, index) => (
                            <HashTag key={index} name={name} />
                        ))}
                    </div>
                }
            </div>
        </div>
    );

    return preview ? body : <Link href={`/feed/${id}`} target="_blank" className="block w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-theme/30">{body}</Link>;
}
