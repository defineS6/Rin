import type { Feed } from "@rin/api";
import { useContext, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactModal from "react-modal";
import Popup from "reactjs-popup";
import { Link, useLocation } from "wouter";
import { useAlert, useConfirm } from "../components/dialog";
import { HashTag } from "../components/hashtag";
import { Waiting } from "../components/loading";
import { Markdown } from "../components/markdown";
import { client } from "../app/runtime";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { timeago } from "../utils/timeago";
import { Button } from "../components/button";
import { Tips } from "../components/tips";
import mermaid from "mermaid";
import { AdjacentSection } from "../components/adjacent_feed.tsx";
import { stripImageUrlMetadata } from "../utils/image-upload";

function extractFirstMarkdownImageUrl(content: string) {
  const match = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/.exec(content);
  if (!match) {
    return undefined;
  }

  return stripImageUrlMetadata(match[1]);
}

export function FeedPage({ id, TOC, clean }: { id: string, TOC: () => JSX.Element, clean: (id: string) => void }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const profile = useContext(ProfileContext);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState<string>();
  const [headImage, setHeadImage] = useState<string>();
  const ref = useRef("");
  const [, setLocation] = useLocation();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [top, setTop] = useState<number>(0);
  const config = useContext(ClientConfigContext);
  const counterEnabled = config.getBoolean('counter.enabled');
  const hasAISummary = Boolean(feed?.ai_summary?.trim());
  const showAISummaryState = feed?.ai_summary_status === "pending" || feed?.ai_summary_status === "processing" || feed?.ai_summary_status === "failed";
  function deleteFeed() {
    // Confirm
    showConfirm(
      t("article.delete.title"),
      t("article.delete.confirm"),
      () => {
        if (!feed) return;
        client.feed
          .delete(feed.id)
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(t("delete.success"));
              setLocation("/");
            }
          });
      })
  }
  function topFeed() {
    const isUnTop = !(top > 0)
    const topNew = isUnTop ? 1 : 0;
    // Confirm
    showConfirm(
      isUnTop ? t("article.top.title") : t("article.untop.title"),
      isUnTop ? t("article.top.confirm") : t("article.untop.confirm"),
      () => {
        if (!feed) return;
        client.feed
          .setTop(feed.id, topNew)
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(isUnTop ? t("article.top.success") : t("article.untop.success"));
              setTop(topNew);
            }
          });
      })
  }
  useEffect(() => {
    if (ref.current == id) return;
    setFeed(undefined);
    setError(undefined);
    setHeadImage(undefined);
    client.feed
      .get(id)
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data && typeof data !== "string") {
          setTimeout(() => {
            setFeed(data as any);
            setTop(data.top || 0);
            const headImageUrl = extractFirstMarkdownImageUrl(data.content);
            if (headImageUrl) {
              setHeadImage(headImageUrl);
            }
            clean(id);
          }, 0);
        }
      });
    ref.current = id;
  }, [id]);
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
    });
    mermaid.run({
      suppressErrors: true,
      nodes: document.querySelectorAll("pre.mermaid_default")
    }).then(() => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
      });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_dark")
      });
    })
  }, [feed]);

  return (
    <Waiting for={feed || error}>
      {feed && (
        <Helmet>
          <title>{`${feed.title ?? "Unnamed"} - ${siteConfig.name}`}</title>
          <meta property="og:site_name" content={siteName} />
          <meta property="og:title" content={feed.title ?? ""} />
          <meta property="og:image" content={headImage ?? siteConfig.avatar} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={document.URL} />
          <meta
            name="og:description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
          <meta name="author" content={feed.user.username} />
          <meta
            name="keywords"
            content={feed.hashtags.map(({ name }) => name).join(", ")}
          />
          <meta
            name="description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
        </Helmet>
      )}
      <div className="w-full flex flex-row justify-center ani-show">
        {error && (
          <>
            <div className="blog-surface flex flex-col wauto rounded-2xl m-2 p-6 items-center justify-center space-y-2">
              <h1 className="text-xl font-bold t-primary">{error}</h1>
              {error === "Not found" && id === "about" && (
                <Tips value={t("about.notfound")} />
              )}
              <Button
                title={t("index.back")}
                onClick={() => (window.location.href = "/")}
              />
            </div>
          </>
        )}
        {feed && !error && (
          <>
            <div className="xl:w-64" />
            <main className="wauto">
              <article
                className="blog-surface m-2 rounded-2xl px-5 py-5 md:px-7 md:py-6"
                aria-label={feed.title ?? "Unnamed"}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                  <div className="min-w-0">
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                      <p
                        className="text-xs font-medium text-neutral-500 dark:text-neutral-400"
                        title={new Date(feed.createdAt).toLocaleString()}
                      >
                        {t("feed_card.published$time", {
                          time: timeago(feed.createdAt),
                        })}
                      </p>

                      {feed.createdAt !== feed.updatedAt && (
                        <p
                          className="text-xs font-medium text-neutral-500 dark:text-neutral-400"
                          title={new Date(feed.updatedAt).toLocaleString()}
                        >
                          {t("feed_card.updated$time", {
                            time: timeago(feed.updatedAt),
                          })}
                        </p>
                      )}
                    </div>
                    {counterEnabled && <p className='mt-1 text-xs font-normal text-neutral-500 dark:text-neutral-400 link-line'>
                      <span> {t("count.pv")} </span>
                      <span>
                        {feed.pv}
                      </span>
                      <span> |</span>
                      <span> {t("count.uv")} </span>
                      <span>
                        {feed.uv}
                      </span>
                    </p>}
                    <div className="mt-3 flex flex-row items-center">
                      <h1 className="break-words text-3xl font-semibold leading-tight text-neutral-900 dark:text-white">
                        {feed.title}
                      </h1>
                      <div className="flex-1 w-0" />
                    </div>
                  </div>
                  <div className="shrink-0 sm:pt-2">
                    {profile?.permission && (
                      <div className="flex gap-2">
                        <button
                          aria-label={top > 0 ? t("untop.title") : t("top.title")}
                          onClick={topFeed}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${top > 0 ? "border-theme bg-theme text-white hover:bg-theme-hover active:bg-theme-active" : "border-black/10 bg-white text-neutral-500 hover:border-theme/30 hover:text-theme dark:border-white/10 dark:bg-white/5 dark:text-neutral-400"}`}
                        >
                          <i className="ri-skip-up-line" />
                        </button>
                        <Link
                          aria-label={t("edit")}
                          href={`/admin/writing/${feed.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-neutral-500 transition-all duration-200 hover:-translate-y-0.5 hover:border-theme/30 hover:text-theme active:translate-y-0 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400"
                        >
                          <i className="ri-edit-2-line dark:text-neutral-400" />
                        </Link>
                        <button
                          aria-label={t("delete.title")}
                          onClick={deleteFeed}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-neutral-500 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:text-rose-500 active:translate-y-0 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:border-rose-500/40"
                        >
                          <i className="ri-delete-bin-7-line text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {(hasAISummary || showAISummaryState) && (
                  <div className="my-5 rounded-2xl border border-theme/15 bg-theme/5 p-4 dark:border-theme/25 dark:bg-theme/10">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <i className="ri-sparkling-2-fill text-theme" />
                        <span className="text-sm font-medium text-theme">
                          {t('ai_summary.title')}
                        </span>
                      </div>
                      {showAISummaryState ? (
                        <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-medium text-theme ring-1 ring-theme/10 dark:bg-white/10">
                          {t(`ai_summary.status.${feed.ai_summary_status}`)}
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-600 dark:text-neutral-300">
                      {hasAISummary ? feed.ai_summary : t(`ai_summary.message.${feed.ai_summary_status}`)}
                    </p>
                    {feed.ai_summary_status === "failed" && feed.ai_summary_error ? (
                      <p className="mt-2 text-xs text-rose-600 dark:text-rose-300 whitespace-pre-wrap">
                        {feed.ai_summary_error}
                      </p>
                    ) : null}
                  </div>
                )}
                <Markdown content={feed.content} />
                <div className="mt-8 flex flex-col gap-3 border-t border-black/5 pt-5 dark:border-white/10">
                  {feed.hashtags.length > 0 && (
                    <div className="flex flex-row flex-wrap gap-2">
                      {feed.hashtags.map(({ name }, index) => (
                        <HashTag key={index} name={name} />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-row items-center">
                    <img
                      src={feed.user.avatar || "/avatar.png"}
                      className="w-8 h-8 rounded-full border border-black/5 dark:border-white/10"
                    />
                    <div className="ml-2">
                      <span className="cursor-default text-sm text-neutral-500 dark:text-neutral-400">
                        {feed.user.username}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
              <AdjacentSection id={id} setError={setError} />
              {feed && <Comments id={`${feed.id}`} />}
              <div className="h-16" />
            </main>
            <div className="w-80 hidden lg:block relative">
              <div
                className={`start-0 end-0 top-[5.5rem] sticky`}
              >
                <TOC />
              </div>
            </div>
          </>
        )}
      </div>
      <AlertUI />
      <ConfirmUI />
    </Waiting>
  );
}

export function TOCHeader({ TOC }: { TOC: () => JSX.Element }) {
  const [isOpened, setIsOpened] = useState(false);

  return (
    <div className="shrink-0 lg:hidden">
      <button
        onClick={() => setIsOpened(true)}
        className="w-10 h-10 rounded-full flex flex-row items-center justify-center"
      >
        <i className="ri-menu-2-line text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 ri-lg md:ri-sm md:t-secondary"></i>
      </button>
      <ReactModal
        isOpen={isOpened}
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
            background: "none",
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1000,
          },
        }}
        onRequestClose={() => setIsOpened(false)}
      >
        <div className="w-[80vw] sm:w-[60vw] lg:w-[40vw] overflow-clip relative t-primary">
          <TOC />
        </div>
      </ReactModal>
    </div>
  );
}

function CommentInput({
  id,
  onRefresh,
}: {
  id: string;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const { showAlert, AlertUI } = useAlert();
  const profile = useContext(ProfileContext);
  const [, setLocation] = useLocation();
  function errorHumanize(error: string) {
    if (error === "Unauthorized") return t("login.required");
    else if (error === "Content is required") return t("comment.empty");
    return error;
  }
  function submit() {
    if (!profile) {
      setLocation('/login')
      return;
    }
    client.comment
      .create(parseInt(id), { content })
      .then(({ error }) => {
        if (error) {
          setError(errorHumanize(error.value as string));
        } else {
          setContent("");
          setError("");
          showAlert(t("comment.success"), () => {
            onRefresh();
          });
        }
      });
  }
  return (
    <div className="blog-surface flex w-full flex-col items-end rounded-2xl p-6 t-primary">
      <div className="flex flex-col w-full items-start mb-4">
        <label htmlFor="comment" className="text-sm font-semibold text-neutral-900 dark:text-white">{t("comment.title")}</label>
      </div>
      {profile ? (<>
        <textarea
          id="comment"
          placeholder={t("comment.placeholder.title")}
          className="h-24 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-theme/40 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-neutral-500"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button
          className="blog-primary-button mt-4"
          onClick={submit}
        >
          {t("comment.submit")}
        </button>
      </>      ) : (
        <div className="flex flex-row w-full items-center justify-center space-x-2 py-12">
          <button
            className="blog-primary-button mt-2"
            onClick={() => setLocation('/login')}
          >
            {t("login.required")}
          </button>
        </div>
      )}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <AlertUI />
    </div>
  );
}

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  };
};

function Comments({ id }: { id: string }) {
  const config = useContext(ClientConfigContext);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string>();
  const ref = useRef("");
  const { t } = useTranslation();

  function loadComments() {
    client.comment
      .list(parseInt(id))
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data && Array.isArray(data)) {
          setComments(data as any);
        }
      });
  }
  useEffect(() => {
    if (ref.current == id) return;
    loadComments();
    ref.current = id;
  }, [id]);
  return (
    <>
      {config.getBoolean('comment.enabled') &&
        <div className="m-2 flex flex-col justify-center items-center">
          <CommentInput id={id} onRefresh={loadComments} />
          {error && (
            <>
              <div className="blog-surface flex flex-col wauto rounded-2xl t-primary m-2 p-6 items-center justify-center">
                <h1 className="text-xl font-bold t-primary">{error}</h1>
                <button
                  className="blog-primary-button mt-2"
                  onClick={loadComments}
                >
                  {t("reload")}
                </button>
              </div>
            </>
          )}
          {comments.length > 0 && (
            <div className="w-full">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onRefresh={loadComments}
                />
              ))}
            </div>
          )}
        </div>
      }
    </>
  );
}

function CommentItem({
  comment,
  onRefresh,
}: {
  comment: Comment;
  onRefresh: () => void;
}) {
  const { showConfirm, ConfirmUI } = useConfirm();
  const { showAlert, AlertUI } = useAlert();
  const { t } = useTranslation();
  const profile = useContext(ProfileContext);
  function deleteComment() {
    showConfirm(
      t("delete.comment.title"),
      t("delete.comment.confirm"),
      async () => {
        client.comment
          .delete(comment.id)
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(t("delete.success"), () => {
                onRefresh();
              });
            }
          });
      })
  }
  return (
    <div className="flex flex-row items-start rounded-xl mt-2">
      <img
        src={comment.user.avatar || ""}
        className="mt-4 h-8 w-8 rounded-full border border-black/5 dark:border-white/10"
      />
      <div className="blog-surface ml-2 flex flex-1 w-0 flex-col rounded-xl p-4">
        <div className="flex flex-row">
          <span className="text-base font-semibold text-neutral-900 dark:text-white">
            {comment.user.username}
          </span>
          <div className="flex-1 w-0" />
          <span
            title={new Date(comment.createdAt).toLocaleString()}
            className="text-sm text-neutral-500 dark:text-neutral-400"
          >
            {timeago(comment.createdAt)}
          </span>
        </div>
        <p className="mt-2 break-words text-sm leading-7 text-neutral-700 dark:text-neutral-300">{comment.content}</p>
        <div className="flex flex-row justify-end">
          {(profile?.permission || profile?.id == comment.user.id) && (
            <Popup
              arrow={false}
              trigger={
                <button className="rounded-full border border-black/10 bg-white px-2 py-1 transition-colors hover:text-theme dark:border-white/10 dark:bg-white/5">
                  <i className="ri-more-fill t-secondary"></i>
                </button>
              }
              position="left center"
            >
              <div className="flex flex-row self-end mr-2">
                <button
                  onClick={deleteComment}
                  aria-label={t("delete.comment.title")}
                  className="rounded-full border border-black/10 bg-white px-2 py-1 transition-colors hover:text-rose-500 dark:border-white/10 dark:bg-white/5"
                >
                  <i className="ri-delete-bin-2-line t-secondary"></i>
                </button>
              </div>
            </Popup>
          )}
        </div>
      </div>
      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
