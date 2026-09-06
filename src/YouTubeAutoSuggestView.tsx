import { useEffect, useRef, useState } from 'react'
import type { PantryItem } from './types'
import './auto-suggest.css'

const API_KEY_STORAGE = 'recipi.youtubeApiKey'
const VIDEO_HISTORY_STORAGE = 'recipi.youtubeAutoHistory'
const QUERY_HISTORY_STORAGE = 'recipi.youtubeAutoQueryHistory'
const ADOPTED_RECIPE_STORAGE = 'recipi.adoptedYouTubeRecipe'

export type AdoptedYouTubeRecipe = {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  viewCount: number
  duration: string
  ingredient: string
  theme: string
  selectedAt: string
}

export function loadAdoptedYouTubeRecipe(): AdoptedYouTubeRecipe | null {
  try {
    const raw = localStorage.getItem(ADOPTED_RECIPE_STORAGE)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<AdoptedYouTubeRecipe>
    if (!value.id || !value.title) return null
    return value as AdoptedYouTubeRecipe
  } catch {
    return null
  }
}

export function clearAdoptedYouTubeRecipe() {
  localStorage.removeItem(ADOPTED_RECIPE_STORAGE)
}

function saveAdoptedYouTubeRecipe(recipe: AdoptedYouTubeRecipe) {
  localStorage.setItem(ADOPTED_RECIPE_STORAGE, JSON.stringify(recipe))
}

const DEFAULT_INGREDIENTS = ['鶏むね肉', '豚こま', '鮭', '豆腐', '卵', 'キャベツ', 'なす', 'じゃがいも']
const BASE_THEMES = ['簡単', '時短', 'ワンパン', '節約', 'ご飯が進む', '作り置き', 'レンジ', '人気']

type SearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    thumbnails?: {
      medium?: { url?: string }
      high?: { url?: string }
      default?: { url?: string }
    }
  }
}

type VideoDetailItem = {
  id?: string
  statistics?: { viewCount?: string }
  contentDetails?: { duration?: string }
}

type SearchSeed = {
  ingredient: string
  theme: string
  query: string
}

type Candidate = {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  viewCount: number
  duration: string
  durationSeconds: number
  ingredient: string
  theme: string
  query: string
  score: number
}

function safeReadArray(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveArray(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

function shuffled<T>(items: T[]): T[] {
  return [...items]
    .map((value) => ({ value, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ value }) => value)
}

function themesFor(targetMinutes: number) {
  if (targetMinutes <= 20) return ['10分', '時短', 'レンジ', 'ワンパン', '簡単', '爆速']
  if (targetMinutes <= 30) return ['時短', '簡単', 'ワンパン', '節約', 'ご飯が進む', 'レンジ']
  return BASE_THEMES
}

function pantryIngredients(pantry: PantryItem[]) {
  const names = pantry
    .filter((item) => item.category !== '調味料' && item.quantity > 0)
    .map((item) => item.name.trim())
    .filter(Boolean)

  return [...new Set(names.length ? names : DEFAULT_INGREDIENTS)]
}

function chooseSeeds(pantry: PantryItem[], targetMinutes: number): SearchSeed[] {
  const ingredients = pantryIngredients(pantry)
  const themes = themesFor(targetMinutes)
  const recentQueries = safeReadArray(QUERY_HISTORY_STORAGE)

  const allSeeds = shuffled(
    ingredients.flatMap((ingredient) =>
      themes.map((theme) => ({
        ingredient,
        theme,
        query: `${ingredient} ${theme}`,
      })),
    ),
  )

  let selected = allSeeds.filter((seed) => !recentQueries.includes(seed.query)).slice(0, 2)

  if (selected.length < 2) {
    const already = new Set(selected.map((seed) => seed.query))
    selected = selected.concat(allSeeds.filter((seed) => !already.has(seed.query)).slice(0, 2 - selected.length))
  }

  const nextHistory = [
    ...selected.map((seed) => seed.query),
    ...recentQueries.filter((query) => !selected.some((seed) => seed.query === query)),
  ].slice(0, 18)

  saveArray(QUERY_HISTORY_STORAGE, nextHistory)
  return selected
}

async function searchSeed(apiKey: string, seed: SearchSeed): Promise<Array<SearchItem & { seed: SearchSeed }>> {
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

  if (!response.ok) {
    throw new Error(json.error?.message ?? 'YouTube検索に失敗しました。')
  }

  return (json.items ?? []).map((item) => ({ ...item, seed }))
}

async function loadVideoDetails(apiKey: string, ids: string[]) {
  const params = new URLSearchParams({
    part: 'statistics,contentDetails',
    id: ids.join(','),
    key: apiKey,
  })

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  const json = await response.json() as { items?: VideoDetailItem[]; error?: { message?: string } }

  if (!response.ok) {
    throw new Error(json.error?.message ?? '動画情報の取得に失敗しました。')
  }

  return new Map(
    (json.items ?? [])
      .filter((item): item is VideoDetailItem & { id: string } => Boolean(item.id))
      .map((item) => [item.id, item]),
  )
}

function candidateScore(viewCount: number, durationSeconds: number, wasShown: boolean) {
  const popularity = Math.log10(Math.max(1, viewCount) + 1) * 13
  const usefulLength =
    durationSeconds >= 180 && durationSeconds <= 1500
      ? 16
      : durationSeconds >= 90 && durationSeconds <= 2400
        ? 7
        : 0
  const shortsPenalty = durationSeconds > 0 && durationSeconds < 60 ? -30 : 0
  const repeatPenalty = wasShown ? -70 : 0
  const variety = Math.random() * 24

  return popularity + usefulLength + shortsPenalty + repeatPenalty + variety
}

function normalizeCandidates(
  searchItems: Array<SearchItem & { seed: SearchSeed }>,
  details: Map<string, VideoDetailItem & { id: string }>,
  history: string[],
) {
  const seen = new Set<string>()
  const historySet = new Set(history)
  const candidates: Candidate[] = []

  for (const item of searchItems) {
    const id = item.id?.videoId
    if (!id || seen.has(id)) continue

    const detail = details.get(id)
    if (!detail) continue

    seen.add(id)

    const durationRaw = detail.contentDetails?.duration ?? ''
    const durationSeconds = parseDurationSeconds(durationRaw)
    const viewCount = Number(detail.statistics?.viewCount ?? 0)

    candidates.push({
      id,
      title: decodeHtml(item.snippet?.title ?? ''),
      channelTitle: decodeHtml(item.snippet?.channelTitle ?? ''),
      thumbnail:
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        '',
      viewCount,
      duration: formatDuration(durationRaw),
      durationSeconds,
      ingredient: item.seed.ingredient,
      theme: item.seed.theme,
      query: item.seed.query,
      score: candidateScore(viewCount, durationSeconds, historySet.has(id)),
    })
  }

  const fresh = candidates.filter((candidate) => !historySet.has(candidate.id)).sort((a, b) => b.score - a.score)
  const repeated = candidates.filter((candidate) => historySet.has(candidate.id)).sort((a, b) => b.score - a.score)

  return fresh.length >= 5 ? fresh.slice(0, 5) : fresh.concat(repeated).slice(0, 5)
}

export default function YouTubeAutoSuggestView({
  pantry,
  targetMinutes,
  onBack,
  onOpenYouTubeSettings,
  onAdopt,
}: {
  pantry: PantryItem[]
  targetMinutes: number
  onBack: () => void
  onOpenYouTubeSettings: () => void
  onAdopt: (recipe: AdoptedYouTubeRecipe) => void
}) {
  const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? ''
  const [videos, setVideos] = useState<Candidate[]>([])
  const [seeds, setSeeds] = useState<SearchSeed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const firstLoad = useRef(false)

  const loadSuggestions = async () => {
    if (!apiKey) return

    setLoading(true)
    setError('')

    try {
      const nextSeeds = chooseSeeds(pantry, targetMinutes)
      setSeeds(nextSeeds)

      const searchGroups = await Promise.all(nextSeeds.map((seed) => searchSeed(apiKey, seed)))
      const searchItems = searchGroups.flat()
      const ids = [
        ...new Set(
          searchItems
            .map((item) => item.id?.videoId)
            .filter((id): id is string => Boolean(id)),
        ),
      ]

      if (!ids.length) {
        setVideos([])
        setError('候補が見つかりませんでした。もう一度「別の候補」を試してください。')
        return
      }

      const details = await loadVideoDetails(apiKey, ids)
      const history = safeReadArray(VIDEO_HISTORY_STORAGE)
      const selected = normalizeCandidates(searchItems, details, history)

      if (!selected.length) {
        setVideos([])
        setError('候補が見つかりませんでした。検索条件を変えて再試行してください。')
        return
      }

      setVideos(selected)

      const nextHistory = [
        ...selected.map((video) => video.id),
        ...history.filter((id) => !selected.some((video) => video.id === id)),
      ].slice(0, 50)

      saveArray(VIDEO_HISTORY_STORAGE, nextHistory)
    } catch (err) {
      setVideos([])
      setError(err instanceof Error ? err.message : 'YouTubeからの自動提案に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!apiKey || firstLoad.current) return
    firstLoad.current = true
    void loadSuggestions()
  }, [apiKey])

  const adoptVideo = (video: Candidate) => {
    const recipe: AdoptedYouTubeRecipe = {
      id: video.id,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnail: video.thumbnail,
      viewCount: video.viewCount,
      duration: video.duration,
      ingredient: video.ingredient,
      theme: video.theme,
      selectedAt: new Date().toISOString(),
    }

    saveAdoptedYouTubeRecipe(recipe)
    onAdopt(recipe)
  }

  const resetHistory = () => {
    localStorage.removeItem(VIDEO_HISTORY_STORAGE)
    localStorage.removeItem(QUERY_HISTORY_STORAGE)
    void loadSuggestions()
  }

  if (!apiKey) {
    return (
      <>
        <header className="page-header auto-header">
          <button className="auto-back" onClick={onBack}>←</button>
          <div>
            <p className="eyebrow">YouTubeから自動で探す</p>
            <h1>今日のおすすめ</h1>
          </div>
        </header>

        <section className="auto-empty-card">
          <div className="auto-empty-icon">▶</div>
          <h2>YouTube APIキーが未設定です</h2>
          <p>先にYouTube検索画面でAPIキーを保存すると、おまかせ提案が使えるようになります。</p>
          <button className="primary-cta" onClick={onOpenYouTubeSettings}>YouTube設定を開く</button>
        </section>
      </>
    )
  }

  return (
    <>
      <header className="page-header auto-header">
        <button className="auto-back" onClick={onBack}>←</button>
        <div>
          <p className="eyebrow">毎回ちがう候補を探します</p>
          <h1>今日のおすすめ</h1>
        </div>
      </header>

      <section className="auto-summary-card">
        <div>
          <span className="section-kicker">条件</span>
          <strong>{targetMinutes}分くらい</strong>
        </div>
        <div>
          <span className="section-kicker">在庫</span>
          <strong>{pantryIngredients(pantry).slice(0, 3).join('・')}</strong>
        </div>
      </section>

      {seeds.length > 0 && (
        <div className="auto-theme-row">
          {seeds.map((seed) => (
            <span className="auto-theme-chip" key={seed.query}>{seed.ingredient} × {seed.theme}</span>
          ))}
        </div>
      )}

      {loading && (
        <div className="auto-loading">
          <div className="auto-spinner" />
          <strong>YouTubeから候補を探しています</strong>
          <small>最近出した動画はなるべく避けます</small>
        </div>
      )}

      {error && <div className="youtube-error">{error}</div>}

      {!loading && videos.length > 0 && (
        <>
          <section className="auto-video-list">
            {videos.map((video, index) => (
              <article className="auto-video-card" key={video.id}>
                <button className="auto-thumbnail-button" onClick={() => openYouTube(video.id)}>
                  <img src={video.thumbnail} alt="" />
                  <span className="auto-rank">{index + 1}</span>
                  {video.duration && <span className="auto-duration">{video.duration}</span>}
                </button>

                <div className="auto-video-body">
                  <div className="auto-match-label">{video.ingredient} × {video.theme}</div>
                  <h2>{video.title}</h2>
                  <p>{video.channelTitle}</p>
                  <div className="auto-meta">
                    <strong>{formatViews(video.viewCount)}回再生</strong>
                    {video.duration && <span>動画 {video.duration}</span>}
                  </div>
                  <div className="auto-action-row">
                    <button className="youtube-open-button" onClick={() => openYouTube(video.id)}>▶ 動画を見る</button>
                    <button className="auto-adopt-button" onClick={() => adoptVideo(video)}>✓ このレシピにする</button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <button className="auto-refresh-button" onClick={() => void loadSuggestions()}>
            ↻ 別の候補を出す
          </button>

          <button className="auto-reset-button" onClick={resetHistory}>
            最近の提案履歴をリセット
          </button>

          <p className="auto-note">
            YouTubeのタイトル・再生回数・動画時間などから候補を選んでいます。
            材料や調理工程は次の改修で取り込み対象にします。
          </p>
        </>
      )}
    </>
  )
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
  return new Intl.NumberFormat('ja-JP', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function openYouTube(videoId: string) {
  window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer')
}

function decodeHtml(value: string) {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}
