import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { useTranslation } from "react-i18next"
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { getFeedListClass } from "../components/feed-layout-options"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

export function SearchPage({ keyword }: { keyword: string }) {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsData>()
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClass = getFeedListClass(siteConfig.feedLayout);
    const ref = useRef("")
    function fetchFeeds() {
        if (!keyword) return
        client.search.search(keyword, {
            page,
            limit,
        }).then(({ data }) => {
            if (data) {
                setFeeds(data)
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${page} ${limit} ${keyword}`
        if (ref.current == key) return
        setStatus('loading')
        fetchFeeds()
        ref.current = key
    }, [page, limit, keyword])
    const title = t('article.search.title$keyword', { keyword })
    return (
        <>
            <Helmet>
                <title>{`${title} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={title} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="blog-page-header">
                        <p className="text-3xl font-semibold tracking-tight md:text-4xl">
                            {t('article.search.title')}
                        </p>
                        <div className="mt-3 flex flex-row justify-between">
                            <p className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
                                {t('article.total$count', { count: feeds?.size })}
                            </p>
                        </div>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className={feedListClass}>
                            {feeds?.data.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <div className="mt-5 flex w-full max-w-5xl flex-row items-center ani-show md:w-11/12 lg:w-10/12 xl:w-8/12 2xl:w-7/12">
                            {page > 1 &&
                                <Link href={`?page=${(page - 1)}&limit=${limit}`}
                                    className="blog-primary-button">
                                    {t('previous')}
                                </Link>
                            }
                            <div className="flex-1" />
                            {feeds?.hasNext &&
                                <Link href={`?page=${(page + 1)}&limit=${limit}`}
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
