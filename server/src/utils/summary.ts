const DEFAULT_FEED_SUMMARY_LIMIT = 100;

export function normalizeFeedSummaryText(content: string) {
    return content
        .replace(/!\[[^\]]*]\((?:\\.|[^)])*\)/g, " ")
        .replace(/<img\b[^>]*>/gi, " ")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)]\((?:\\.|[^)])*\)/g, "$1")
        .replace(/<\/?[^>]+>/g, " ")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^[\s*+-]+\s+/gm, "")
        .replace(/[*_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function buildFeedSummary(summary: string | null | undefined, content: string, limit = DEFAULT_FEED_SUMMARY_LIMIT) {
    const normalizedSummary = summary && summary.trim().length > 0
        ? normalizeFeedSummaryText(summary)
        : "";
    const normalizedContent = normalizedSummary.length > 0
        ? normalizedSummary
        : normalizeFeedSummaryText(content);

    return normalizedContent.slice(0, limit);
}
