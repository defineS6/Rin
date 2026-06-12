import { useLocation } from "wouter"

export function HashTag({ name }: { name: string }) {
    const [_, setLocation] = useLocation()
    return (
        <button type="button" onClick={(e) => { e.preventDefault(); setLocation(`/hashtag/${name}`) }}
            className="blog-chip text-pretty overflow-hidden" >
            <div className="flex min-w-0 gap-0.5">
                <div className="shrink-0 opacity-70">#</div>
                <div className="min-w-0 truncate">
                    {name}
                </div>
            </div>
        </button >
    )
}
