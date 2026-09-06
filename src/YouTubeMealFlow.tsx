import { useEffect, useMemo, useRef, useState } from 'react'
import type { PantryItem } from './types'
import './youtube-meal-flow.css'

const API_KEY_STORAGE = 'recipi.youtubeApiKey'
const VIDEO_HISTORY_STORAGE = 'recipi.youtubeMealHistory'
const QUERY_HISTORY_STORAGE = 'recipi.youtubeMealQueryHistory'
const DRAFT_STORAGE = 'recipi.youtubeMealDraft'

const DEFAULT_INGREDIENTS = ['鶏むね肉', '豚こま', '鮭', '豆腐', '卵', 'キャベツ', 'なす', 'じゃがいも']
const THEMES = ['簡単', '時短', 'ワンパン', '節約', 'ご飯が進む', 'レンジ', '人気', '作り置き']

type MealRole = 'main' | 'side' | 'single'
type Stage = 'suggest' | 'role' | 'counterpart' | 'confirm' | 'cooking'

type SearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    thumbnails?: {
      high?: { url?: string }
      medium?: { url?: string }
      default?: { url?: string }
    }
  }
}

type VideoDetailItem = {
  id?: string
  snippet?: {
    title?: string
    channelTitle?: string
    description?: string
    thumbnails?: {
      high?: { url?: string }
      medium?: { url?: string }
      default?: { url?: string }
    }
  }
  statistics?: { viewCount?: string }
  contentDetails?: { duration?: string }
}

type SearchSeed = {
  ingredient: string
  theme: string
  query: string
}

export type YouTubeMealVideo = {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  viewCount: number
  duration: string
  durationSeconds: number
  description: string
  ingredient: string
  theme: string
  query: string
  score: number
}

type MealDraft = {
  main: YouTubeMealVideo | null
  side: YouTubeMealVideo | null
  single: YouTubeMealVideo | null
  updatedAt: string
}

function readStringArray(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function writeStringArray(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

function saveDraft(draft: MealDraft) {
  localStorage.setItem(DRAFT_STORAGE, JSON.stringify(draft))
}

function loadDraft(): MealDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MealDraft
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function shuffle<T>(values: T[]) {
  return [...values]
    .map((value) => ({ value, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ value }) => value)
}

function pantryIngredientNames(pantry: PantryItem[]) {
  const names = pantry
    .filter((item) => item.category !== '調味料' && item.quantity > 0)
    .map((item) => item.name.trim())
    .filter(Boolean)
  return [...new Set(names.length ? names : DEFAULT_INGREDIENTS)]
}

function initialThemes(targetMinutes: number) {
  if (targetMinutes <= 20) return ['10分', '時短', 'レンジ', 'ワンパン', '簡単', '爆速']
  if (targetMinutes <= 30) return ['時短', '簡単', 'ワンパン', '節約', 'レンジ', 'ご飯が進む']
  return THEMES
}

function buildInitialSeeds(pantry: PantryItem[], targetMinutes: number): SearchSeed[] {
  const ingredients = pantryIngredientNames(pantry)
  const themes = initialThemes(targetMinutes)
  const queryHistory = readStringArray(QUERY_HISTORY_STORAGE)

  const pool = shuffle(
    ingredients.flatMap((ingredient) =>
      themes.map((theme) => ({ ingredient, theme, query: `${ingredient} ${theme}` })),
    ),
  )

  let selected = pool.filter((seed) => !queryHistory.includes(seed.query)).slice(0, 2)
  if (selected.length < 2) {
    const selectedQueries = new Set(selected.map((seed) => seed.query))
    selected = selected.concat(pool.filter((seed) => !selectedQueries.has(seed.query)).slice(0, 2 - selected.length))
  }

  writeStringArray(
    QUERY_HISTORY_STORAGE,
    [
      ...selected.map((seed) => seed.query),
      ...queryHistory.filter((query) => !selected.some((seed) => seed.query === query)),
    ].slice(0, 20),
  )

  return selected
}

function roleIngredients(pantry: PantryItem[], role: 'main' | 'side') {
  if (role === 'main') {
    const preferred = pantry
      .filter((item) => ['肉・魚', '豆・卵'].includes(item.category) && item.quantity > 0)
      .map((item) => item.name)
    return [...new Set(preferred.length ? preferred : ['鶏むね肉', '豚こま', '鮭', '豆腐', '卵'])]
  }

  const preferred = pantry
    .filter((item) => ['野菜', '豆・卵'].includes(item.category) && item.quantity > 0)
    .map((item) => item.name)
  return [...new Set(preferred.length ? preferred : ['キャベツ', '豆腐', 'きのこ', 'ピーマン', 'じゃがいも'])]
}

function buildCounterpartSeeds(
  pantry: PantryItem[],
  role: 'main' | 'side',
  selected: YouTubeMealVideo,
  targetMinutes: number,
): SearchSeed[] {
  const ingredients = shuffle(roleIngredients(pantry, role).filter((name) => name !== selected.ingredient))
  const speedWord = targetMinutes <= 30 ? '時短' : '簡単'
  const roleWord = role === 'main' ? '主菜' : '副菜'

  const fallback = role === 'main' ? ['鶏肉', '豚肉'] : ['野菜', 'サラダ']
  const picked = (ingredients.length ? ingredients : fallback).slice(0, 2)

  return picked.map((ingredient, index) => ({
    ingredient,
    theme: index === 0 ? speedWord : '簡単',
    query: `${ingredient} ${roleWord} ${index === 0 ? speedWord : '簡単'}`,
  }))
}

async function searchBySeed(apiKey: string, seed: SearchSeed) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '12',
    q: `${seed.query} 料理 レシピ`,
    order: 'relevance',
    regionCode: 'JP',
    relevanceLanguage: 'ja',
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    key: apiKey,
  })

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  const json = await response.json() as { items?: SearchItem[]; error?: { message?: string } }
  if (!response.ok) throw new Error(json.error?.message ?? 'YouTube検索に失敗しました。')

  return (json.items ?? []).map((item) => ({ item, seed }))
}

async function loadDetails(apiKey: string, ids: string[]) {
  if (!ids.length) return new Map<string, VideoDetailItem & { id: string }>()

  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: ids.slice(0, 50).join(','),
    key: apiKey,
  })

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  const json = await response.json() as { items?: VideoDetailItem[]; error?: { message?: string } }
  if (!response.ok) throw new Error(json.error?.message ?? '動画情報の取得に失敗しました。')

  return new Map(
    (json.items ?? [])
      .filter((item): item is VideoDetailItem & { id: string } => Boolean(item.id))
      .map((item) => [item.id, item]),
  )
}

function scoreCandidate(viewCount: number, durationSeconds: number, repeated: boolean, rank: number) {
  const popularity = Math.log10(Math.max(viewCount, 1) + 1) * 12
  const lengthBonus = durationSeconds >= 180 && durationSeconds <= 1500 ? 15 : durationSeconds >= 90 && durationSeconds <= 2400 ? 7 : 0
  const shortPenalty = durationSeconds > 0 && durationSeconds < 60 ? -35 : 0
  const repeatPenalty = repeated ? -80 : 0
  const relevanceBonus = Math.max(0, 14 - rank * 1.2)
  const variety = Math.random() * 22
  return popularity + lengthBonus + shortPenalty + repeatPenalty + relevanceBonus + variety
}

async function searchVideos(
  apiKey: string,
  seeds: SearchSeed[],
  limit: number,
  excludeIds: string[] = [],
) {
  const groups = await Promise.all(seeds.map((seed) => searchBySeed(apiKey, seed)))
  const rows = groups.flat()
  const ids = [...new Set(rows.map(({ item }) => item.id?.videoId).filter((id): id is string => Boolean(id)))]
  const details = await loadDetails(apiKey, ids)
  const history = readStringArray(VIDEO_HISTORY_STORAGE)
  const historySet = new Set(history)
  const excluded = new Set(excludeIds)
  const seen = new Set<string>()

  const candidates: YouTubeMealVideo[] = []

  rows.forEach(({ item, seed }, rank) => {
    const id = item.id?.videoId
    if (!id || excluded.has(id) || seen.has(id)) return
    const detail = details.get(id)
    if (!detail) return

    seen.add(id)
    const durationRaw = detail.contentDetails?.duration ?? ''
    const durationSeconds = parseDurationSeconds(durationRaw)
    const viewCount = Number(detail.statistics?.viewCount ?? 0)
    const snippet = detail.snippet ?? item.snippet

    candidates.push({
      id,
      title: decodeHtml(snippet?.title ?? ''),
      channelTitle: decodeHtml(snippet?.channelTitle ?? ''),
      thumbnail: snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url ?? '',
      viewCount,
      duration: formatDuration(durationRaw),
      durationSeconds,
      description: snippet?.description ?? '',
      ingredient: seed.ingredient,
      theme: seed.theme,
      query: seed.query,
      score: scoreCandidate(viewCount, durationSeconds, historySet.has(id), rank),
    })
  })

  const fresh = candidates.filter((video) => !historySet.has(video.id)).sort((a, b) => b.score - a.score)
  const repeated = candidates.filter((video) => historySet.has(video.id)).sort((a, b) => b.score - a.score)
  const selected = (fresh.length >= limit ? fresh : fresh.concat(repeated)).slice(0, limit)

  writeStringArray(
    VIDEO_HISTORY_STORAGE,
    [
      ...selected.map((video) => video.id),
      ...history.filter((id) => !selected.some((video) => video.id === id)),
    ].slice(0, 60),
  )

  return selected
}

function roleLabel(role: MealRole) {
  if (role === 'main') return '主菜'
  if (role === 'side') return '副菜'
  return '単品'
}

function roleHint(title: string): MealRole | null {
  const lower = title.toLowerCase()
  const sideWords = ['副菜', 'サラダ', '和え', 'ナムル', 'スープ', '味噌汁', '冷奴', '漬け', 'きんぴら']
  const mainWords = ['唐揚げ', '照り焼き', 'ハンバーグ', '生姜焼き', 'ステーキ', '丼', 'カレー', '炒め', '焼き', '煮込み']
  if (sideWords.some((word) => lower.includes(word))) return 'side'
  if (mainWords.some((word) => lower.includes(word))) return 'main'
  return null
}

function RecipeMiniCard({ video, label }: { video: YouTubeMealVideo; label: string }) {
  return (
    <article className="ymf-mini-card">
      <div className="ymf-mini-label">{label}</div>
      {video.thumbnail && <img src={video.thumbnail} alt="" />}
      <div>
        <h3>{video.title}</h3>
        <p>{video.channelTitle}</p>
      </div>
    </article>
  )
}

export default function YouTubeMealFlow({
  pantry,
  targetMinutes,
  onBack,
  onOpenYouTubeSettings,
}: {
  pantry: PantryItem[]
  targetMinutes: number
  onBack: () => void
  onOpenYouTubeSettings: () => void
}) {
  const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? ''
  const [stage, setStage] = useState<Stage>('suggest')
  const [suggestions, setSuggestions] = useState<YouTubeMealVideo[]>([])
  const [selected, setSelected] = useState<YouTubeMealVideo | null>(null)
  const [main, setMain] = useState<YouTubeMealVideo | null>(null)
  const [side, setSide] = useState<YouTubeMealVideo | null>(null)
  const [single, setSingle] = useState<YouTubeMealVideo | null>(null)
  const [counterpartRole, setCounterpartRole] = useState<'main' | 'side' | null>(null)
  const [counterparts, setCounterparts] = useState<YouTubeMealVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeCookIndex, setActiveCookIndex] = useState(0)
  const touchStart = useRef<number | null>(null)
  const loadedOnce = useRef(false)

  const cookVideos = useMemo(() => {
    if (single) return [{ label: '単品', video: single }]
    return [
      ...(main ? [{ label: '主菜', video: main }] : []),
      ...(side ? [{ label: '副菜', video: side }] : []),
    ]
  }, [main, side, single])

  const loadInitial = async () => {
    if (!apiKey) return
    setLoading(true)
    setError('')
    try {
      const videos = await searchVideos(apiKey, buildInitialSeeds(pantry, targetMinutes), 5)
      setSuggestions(videos)
      if (!videos.length) setError('候補が見つかりませんでした。「別の候補」を試してください。')
    } catch (err) {
      setSuggestions([])
      setError(err instanceof Error ? err.message : 'YouTubeからの提案に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!apiKey || loadedOnce.current) return
    loadedOnce.current = true
    void loadInitial()
  }, [apiKey])

  const chooseFirst = (video: YouTubeMealVideo) => {
    setSelected(video)
    setMain(null)
    setSide(null)
    setSingle(null)
    setCounterparts([])
    setCounterpartRole(null)
    setStage('role')
    setError('')
  }

  const chooseRole = async (role: MealRole) => {
    if (!selected) return

    if (role === 'single') {
      setSingle(selected)
      setMain(null)
      setSide(null)
      const draft = { main: null, side: null, single: selected, updatedAt: new Date().toISOString() }
      saveDraft(draft)
      setStage('confirm')
      return
    }

    if (role === 'main') {
      setMain(selected)
      setSide(null)
      setSingle(null)
      setCounterpartRole('side')
    } else {
      setSide(selected)
      setMain(null)
      setSingle(null)
      setCounterpartRole('main')
    }

    const wantedRole = role === 'main' ? 'side' : 'main'
    setStage('counterpart')
    setLoading(true)
    setError('')
    setCounterparts([])

    try {
      const seeds = buildCounterpartSeeds(pantry, wantedRole, selected, targetMinutes)
      const videos = await searchVideos(apiKey, seeds, 4, [selected.id])
      setCounterparts(videos)
      if (!videos.length) setError(`${roleLabel(wantedRole)}候補が見つかりませんでした。もう一度探してください。`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '組み合わせ候補の検索に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  const reloadCounterparts = async () => {
    if (!selected || !counterpartRole || !apiKey) return
    setLoading(true)
    setError('')
    try {
      const videos = await searchVideos(
        apiKey,
        buildCounterpartSeeds(pantry, counterpartRole, selected, targetMinutes),
        4,
        [selected.id, ...counterparts.map((video) => video.id)],
      )
      setCounterparts(videos)
      if (!videos.length) setError('別候補が見つかりませんでした。もう一度お試しください。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '別候補の検索に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  const chooseCounterpart = (video: YouTubeMealVideo) => {
    let nextMain = main
    let nextSide = side
    if (counterpartRole === 'main') nextMain = video
    if (counterpartRole === 'side') nextSide = video
    setMain(nextMain)
    setSide(nextSide)
    setSingle(null)
    saveDraft({ main: nextMain, side: nextSide, single: null, updatedAt: new Date().toISOString() })
    setStage('confirm')
  }

  const resumeDraft = () => {
    const draft = loadDraft()
    if (!draft) return
    setMain(draft.main)
    setSide(draft.side)
    setSingle(draft.single)
    setStage('confirm')
  }

  const clearAndRestart = () => {
    localStorage.removeItem(DRAFT_STORAGE)
    setSelected(null)
    setMain(null)
    setSide(null)
    setSingle(null)
    setCounterpartRole(null)
    setCounterparts([])
    setStage('suggest')
    void loadInitial()
  }

  const startCooking = () => {
    setActiveCookIndex(0)
    setStage('cooking')
  }

  const moveCook = (delta: number) => {
    if (cookVideos.length <= 1) return
    setActiveCookIndex((index) => Math.max(0, Math.min(cookVideos.length - 1, index + delta)))
    if ('vibrate' in navigator) navigator.vibrate?.(12)
  }

  if (!apiKey) {
    return (
      <div className="ymf-page">
        <header className="ymf-header">
          <button onClick={onBack}>←</button>
          <div><small>おまかせ提案</small><h1>YouTube献立</h1></div>
        </header>
        <section className="ymf-empty">
          <div className="ymf-youtube-icon">▶</div>
          <h2>YouTube APIキーが未設定です</h2>
          <p>先にYouTube検索画面でAPIキーを保存してください。</p>
          <button className="ymf-primary" onClick={onOpenYouTubeSettings}>YouTube設定を開く</button>
        </section>
      </div>
    )
  }

  if (stage === 'cooking') {
    const active = cookVideos[activeCookIndex]
    if (!active) return null

    return (
      <div
        className="ymf-cooking"
        onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return
          const endX = event.changedTouches[0]?.clientX ?? touchStart.current
          const dx = endX - touchStart.current
          touchStart.current = null
          if (Math.abs(dx) < 70) return
          moveCook(dx < 0 ? 1 : -1)
        }}
      >
        <div className="ymf-cook-topbar">
          <button onClick={() => setStage('confirm')}>←</button>
          <div>
            <small>調理モード</small>
            <strong>{cookVideos.length > 1 ? `${activeCookIndex + 1}/${cookVideos.length}` : '1品'}</strong>
          </div>
          <button onClick={onBack}>×</button>
        </div>

        <div className="ymf-cook-role">{active.label}</div>
        <h1>{active.video.title}</h1>
        <p className="ymf-cook-channel">{active.video.channelTitle}</p>

        <div className="ymf-embed-wrap">
          <iframe
            src={`https://www.youtube.com/embed/${active.video.id}?playsinline=1`}
            title={active.video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {cookVideos.length > 1 && (
          <div className="ymf-cook-switch">
            {cookVideos.map((item, index) => (
              <button key={item.video.id} className={index === activeCookIndex ? 'active' : ''} onClick={() => setActiveCookIndex(index)}>
                <span>{item.label}</span>
                <small>{item.video.title}</small>
              </button>
            ))}
          </div>
        )}

        <section className="ymf-cook-guide">
          <h2>まずここだけ確認</h2>
          <div><b>1</b><span>動画の材料と加熱時間を先に確認</span></div>
          {cookVideos.length > 1 && <div><b>2</b><span>横スワイプで主菜・副菜を切り替え</span></div>}
          <div><b>{cookVideos.length > 1 ? '3' : '2'}</b><span>加熱待ちの間にもう一品を進める</span></div>
        </section>

        <p className="ymf-cook-note">現段階は動画をアプリ内で見ながら調理するモードです。説明欄から材料・工程を取り込み、完全な段取り表にする機能は次段階で追加できます。</p>
        <button className="ymf-finish" onClick={onBack}>✓ 調理を終了</button>
      </div>
    )
  }

  return (
    <div className="ymf-page">
      <header className="ymf-header">
        <button onClick={stage === 'suggest' ? onBack : () => setStage('suggest')}>←</button>
        <div>
          <small>おまかせ提案</small>
          <h1>{stage === 'suggest' ? '今日なに作る？' : stage === 'role' ? 'この料理は？' : stage === 'counterpart' ? 'もう1品を選ぶ' : '今日の献立'}</h1>
        </div>
      </header>

      {stage === 'suggest' && (
        <>
          <section className="ymf-condition">
            <div><small>目安時間</small><strong>{targetMinutes}分</strong></div>
            <div><small>在庫から</small><strong>{pantryIngredientNames(pantry).slice(0, 3).join('・')}</strong></div>
          </section>

          {loadDraft() && (
            <button className="ymf-resume" onClick={resumeDraft}>
              <span>前回選んだ献立があります</span>
              <strong>続きから →</strong>
            </button>
          )}

          {loading && <LoadingBlock text="YouTubeから候補を探しています" />}
          {error && <div className="ymf-error">{error}</div>}

          {!loading && suggestions.length > 0 && (
            <section className="ymf-video-list">
              {suggestions.map((video, index) => (
                <article className="ymf-video-card" key={video.id}>
                  <button className="ymf-thumb" onClick={() => openYouTube(video.id)}>
                    <img src={video.thumbnail} alt="" />
                    <span className="ymf-rank">{index + 1}</span>
                    {video.duration && <span className="ymf-duration">{video.duration}</span>}
                  </button>
                  <div className="ymf-video-body">
                    <div className="ymf-tags"><span>{video.ingredient}</span><span>{video.theme}</span></div>
                    <h2>{video.title}</h2>
                    <p>{video.channelTitle}</p>
                    <div className="ymf-meta"><strong>{formatViews(video.viewCount)}回再生</strong>{video.duration && <span>動画 {video.duration}</span>}</div>
                    <div className="ymf-actions">
                      <button className="ymf-secondary" onClick={() => openYouTube(video.id)}>▶ 見る</button>
                      <button className="ymf-primary" onClick={() => chooseFirst(video)}>これを選ぶ →</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          <button className="ymf-refresh" disabled={loading} onClick={() => void loadInitial()}>↻ 別の候補を出す</button>
        </>
      )}

      {stage === 'role' && selected && (
        <>
          <RecipeMiniCard video={selected} label="選んだ料理" />
          <section className="ymf-role-card">
            <small>次に決めること</small>
            <h2>この料理をどう使いますか？</h2>
            {roleHint(selected.title) && <p className="ymf-role-hint">タイトルから見ると「{roleLabel(roleHint(selected.title) as MealRole)}」っぽい料理です。</p>}
            <button className="ymf-role-button" onClick={() => void chooseRole('main')}><b>主</b><span><strong>主菜にする</strong><small>次に副菜を自動提案</small></span><em>›</em></button>
            <button className="ymf-role-button" onClick={() => void chooseRole('side')}><b>副</b><span><strong>副菜にする</strong><small>次に主菜を自動提案</small></span><em>›</em></button>
            <button className="ymf-role-button" onClick={() => void chooseRole('single')}><b>1</b><span><strong>単品で作る</strong><small>もう1品は選ばず調理へ</small></span><em>›</em></button>
          </section>
        </>
      )}

      {stage === 'counterpart' && selected && counterpartRole && (
        <>
          <RecipeMiniCard video={selected} label={`${counterpartRole === 'side' ? '主菜' : '副菜'} 決定`} />
          <div className="ymf-step-message">
            <span>あと1品</span>
            <h2>{roleLabel(counterpartRole)}を選んでください</h2>
            <p>{counterpartRole === 'side' ? '野菜・豆腐などの軽い料理を優先しています。' : '肉・魚・豆腐などの主役になる料理を優先しています。'}</p>
          </div>

          {loading && <LoadingBlock text={`${roleLabel(counterpartRole)}候補を探しています`} />}
          {error && <div className="ymf-error">{error}</div>}

          {!loading && counterparts.length > 0 && (
            <section className="ymf-counter-list">
              {counterparts.map((video) => (
                <article key={video.id} className="ymf-counter-card">
                  {video.thumbnail && <img src={video.thumbnail} alt="" />}
                  <div>
                    <div className="ymf-tags"><span>{video.ingredient}</span><span>{video.theme}</span></div>
                    <h3>{video.title}</h3>
                    <p>{video.channelTitle}</p>
                    <div className="ymf-actions">
                      <button className="ymf-secondary" onClick={() => openYouTube(video.id)}>▶ 見る</button>
                      <button className="ymf-primary" onClick={() => chooseCounterpart(video)}>これにする</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          <button className="ymf-refresh" disabled={loading} onClick={() => void reloadCounterparts()}>↻ 別の{roleLabel(counterpartRole)}を探す</button>
        </>
      )}

      {stage === 'confirm' && (
        <>
          <section className="ymf-confirm-head">
            <span>✓ 献立が決まりました</span>
            <h2>{single ? '今日は1品で作ります' : '主菜＋副菜で作ります'}</h2>
            <p>この内容で調理モードへ進めます。</p>
          </section>

          <div className="ymf-confirm-list">
            {main && <RecipeMiniCard video={main} label="主菜" />}
            {side && <RecipeMiniCard video={side} label="副菜" />}
            {single && <RecipeMiniCard video={single} label="単品" />}
          </div>

          <section className="ymf-before-cook">
            <div><span>1</span><p><strong>動画をアプリ内で再生</strong><small>別ページに移動せず確認できます</small></p></div>
            {main && side && <div><span>2</span><p><strong>主菜・副菜を横スワイプで切替</strong><small>調理中の画面切替を減らします</small></p></div>}
            <div><span>{main && side ? '3' : '2'}</span><p><strong>動画を見ながら調理開始</strong><small>材料・工程の自動抽出は次段階です</small></p></div>
          </section>

          <button className="ymf-start" onClick={startCooking}>調理をはじめる <span>→</span></button>
          <button className="ymf-restart" onClick={clearAndRestart}>献立を選び直す</button>
        </>
      )}
    </div>
  )
}

function LoadingBlock({ text }: { text: string }) {
  return <div className="ymf-loading"><div className="ymf-spinner" /><strong>{text}</strong><small>最近出した動画はなるべく避けます</small></div>
}

function parseDurationSeconds(value: string) {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
}

function formatDuration(value: string) {
  const total = parseDurationSeconds(value)
  if (!total) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatViews(value: number) {
  return new Intl.NumberFormat('ja-JP', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function openYouTube(videoId: string) {
  window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer')
}

function decodeHtml(value: string) {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}
