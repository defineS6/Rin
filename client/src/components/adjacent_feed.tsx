import type { AdjacentFeed, AdjacentFeedResponse } from "@rin/api";
import {useEffect, useState} from "react";
import { client } from "../app/runtime";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";

export function AdjacentSection({id, setError}: { id: string, setError: (error: string) => void }) {
    const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeedResponse>();

    useEffect(() => {
        client.feed
            .adjacent(id)
            .then(({data, error}) => {
                if (error) {
                    setError(error.value as string);
                } else if (data && typeof data !== "string") {
                    setAdjacentFeeds(data);
                }
            });
    }, [id, setError]);
    return (
        <div className="blog-surface m-2 grid grid-cols-1 overflow-hidden rounded-2xl sm:grid-cols-2">
            <AdjacentCard data={adjacentFeeds?.previousFeed} type="previous"/>
            <AdjacentCard data={adjacentFeeds?.nextFeed} type="next"/>
        </div>
    )
}

export function AdjacentCard({data, type}: { data: AdjacentFeed | null | undefined, type: "previous" | "next" }) {
    const direction = type === "previous" ? "text-start" : "text-end"
    const radius = type === "previous" ? "rounded-t-2xl sm:rounded-none sm:rounded-l-2xl" : "rounded-b-2xl sm:rounded-none sm:rounded-r-2xl"
    const {t} = useTranslation()
    if (!data) {
        return (<div className="w-full p-6 duration-300">
            <p className={`w-full text-sm font-medium text-neutral-500 dark:text-neutral-400 ${direction}`}>
                {type === "previous" ? "Previous" : "Next"}
            </p>
            <h1 className={`mt-1 truncate text-pretty text-lg text-neutral-700 dark:text-white ${direction}`}>
                {t('no_more')}
            </h1>
        </div>);
    }
    return (
        <Link href={`/feed/${data.id}`} target="_blank"
              className={`w-full p-6 transition-all duration-200 hover:bg-theme/5 hover:text-theme ${radius}`}>
            <p className={`w-full text-sm font-medium text-neutral-500 dark:text-neutral-400 ${direction}`}>
                {type === "previous" ? "Previous" : "Next"}
            </p>
            <h1 className={`mt-1 truncate text-pretty text-xl font-semibold text-neutral-900 dark:text-white ${direction}`}>
                {data.title}
            </h1>
            <p className={`mt-2 space-x-2 ${direction}`}>
                <span className="text-sm text-neutral-500 dark:text-neutral-400" title={new Date(data.createdAt).toLocaleString()}>
                    {data.createdAt === data.updatedAt ? timeago(data.createdAt) : t('feed_card.published$time', {time: timeago(data.createdAt)})}
                </span>
                {data.createdAt !== data.updatedAt &&
                    <span className="text-sm text-neutral-500 dark:text-neutral-400" title={new Date(data.updatedAt).toLocaleString()}>
                        {t('feed_card.updated$time', {time: timeago(data.updatedAt)})}
                    </span>
                }
            </p>
        </Link>
    )
}
