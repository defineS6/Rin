import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"
import { ProfileContext } from "../state/profile"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { getFeedListClass } from "../components/feed-layout-options";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

export function FeedsPage() {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClass = getFeedListClass(siteConfig.feedLayout, true);
    const ref = useRef("")
    function fetchFeeds(type: FeedType) {
        client.feed.list({
            page: page,
            limit: limit,
            type: type
        }).then(({ data }) => {
            if (data) {
                setFeeds({
                    ...feeds,
                    [type]: data
                })
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")} ${limit}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [limit, query.get("page"), query.get("type")])
    return (
        <>
            <Helmet>
                <title>{`${t('article.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="blog-page-header">
                        <p className="text-3xl font-semibold tracking-tight md:text-4xl">
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                        </p>
                        <div className="mt-3 flex flex-row justify-between gap-4">
                            <p className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                                {t('article.total$count', { count: feeds[listState]?.size })}
                            </p>
                            {profile?.permission &&
                                <div className="flex flex-row flex-wrap justify-end gap-2">
                                    <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} className={`rounded-full px-3 py-1 text-sm font-medium transition-colors hover:bg-theme/10 hover:text-theme ${listState === 'draft' ? "bg-theme/10 text-theme" : "text-neutral-500 dark:text-neutral-400"}`}>
                                        {t('draft_bin')}
                                    </Link>
                                    <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} className={`rounded-full px-3 py-1 text-sm font-medium transition-colors hover:bg-theme/10 hover:text-theme ${listState === 'unlisted' ? "bg-theme/10 text-theme" : "text-neutral-500 dark:text-neutral-400"}`}>
                                        {t('unlisted')}
                                    </Link>
                                </div>
                            }
                        </div>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className={feedListClass}>
                            {feeds[listState].data.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <div className="mt-5 flex w-full max-w-5xl flex-row items-center ani-show md:w-11/12 lg:w-10/12 xl:w-8/12 2xl:w-7/12">
                            {page > 1 &&
                                <Link href={`/?type=${listState}&page=${(page - 1)}`}
                                    className="blog-primary-button">
                                    {t('previous')}
                                </Link>
                            }
                            <div className="flex-1" />
                            {feeds[listState]?.hasNext &&
                                <Link href={`/?type=${listState}&page=${(page + 1)}`}
                                    className="blog-primary-button">
                                    {t('next')}
                                </Link>
                            }
                        </div>
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
