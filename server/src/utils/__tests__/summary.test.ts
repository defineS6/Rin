import { describe, expect, it } from "bun:test";
import { buildFeedSummary, normalizeFeedSummaryText } from "../summary";

describe("normalizeFeedSummaryText", () => {
    it("should remove markdown images from summary text", () => {
        const content = "![cover](https://example.com/cover.png#blurhash=test&width=100&height=50)\n\n正文内容";

        expect(normalizeFeedSummaryText(content)).toBe("正文内容");
    });

    it("should remove html images from summary text", () => {
        const content = '<img src="https://example.com/cover.png" alt="cover"> 图片后的正文';

        expect(normalizeFeedSummaryText(content)).toBe("图片后的正文");
    });

    it("should keep link text and remove common markdown markers", () => {
        const content = "# 标题\n\n这是 **重要** 的 [链接](https://example.com)。";

        expect(normalizeFeedSummaryText(content)).toBe("标题 这是 重要 的 链接。");
    });
});

describe("buildFeedSummary", () => {
    it("should prefer manual summary after normalization", () => {
        expect(buildFeedSummary("**手动摘要**", "正文内容")).toBe("手动摘要");
    });

    it("should fallback to cleaned content when summary is empty", () => {
        const content = "![cover](https://example.com/cover.png)\n\n这是一段正文";

        expect(buildFeedSummary("", content)).toBe("这是一段正文");
    });

    it("should fallback to content when manual summary has no readable text", () => {
        const summary = "![cover](https://example.com/cover.png)";

        expect(buildFeedSummary(summary, "正文内容")).toBe("正文内容");
    });

    it("should respect custom limit", () => {
        expect(buildFeedSummary("", "1234567890", 4)).toBe("1234");
    });
});
