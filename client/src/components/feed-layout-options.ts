export const FEED_LAYOUT_OPTIONS = ["list", "masonry"] as const;

export type FeedLayout = (typeof FEED_LAYOUT_OPTIONS)[number];

export function normalizeFeedLayout(value: string): FeedLayout {
  return FEED_LAYOUT_OPTIONS.includes(value as FeedLayout) ? (value as FeedLayout) : "list";
}

export function getFeedListClass(layout: FeedLayout, animated = false) {
  const animationClass = animated ? " ani-show" : "";

  if (layout === "masonry") {
    return `w-full max-w-6xl columns-1 gap-5 md:w-11/12 md:columns-2 lg:w-10/12 xl:w-8/12 2xl:w-7/12 [&>*]:mb-5${animationClass}`;
  }

  return `w-full max-w-5xl flex flex-col gap-4 md:w-11/12 lg:w-10/12 xl:w-8/12 2xl:w-7/12${animationClass}`;
}
