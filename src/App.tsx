import { useEffect, useMemo, useRef, useState } from 'react'
import { recipes } from './data/recipes'
import { defaultState, loadState, saveState } from './lib/db'
import { buildCookingSteps, buildPlans, getMissingIngredients } from './lib/planner'
import type { AppState, IngredientCategory, MealPlan, PantryItem } from './types'
import YouTubeAutoSuggestView, { clearAdoptedYouTubeRecipe, loadAdoptedYouTubeRecipe, type AdoptedYouTubeRecipe } from './YouTubeAutoSuggestView'
import YouTubeMealFlow from './YouTubeMealFlow'

type View = 'home' | 'plans' | 'pantry' | 'shopping' | 'youtube' | 'auto-youtube' | 'youtube-flow' | 'cooking'
type PlanMode = 'auto' | 'pantry'

const timeOptions = [20, 30, 40, 50]
const categories: IngredientCategory[] = ['肉・魚', '野菜', '豆・卵', '調味料', 'その他']
const YOUTUBE_KEY_STORAGE = 'recipi.youtubeApiKey'

type YouTubeVideo = {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  viewCount: number
  duration: string
}

type SearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    thumbnails?: {
      medium?: { url?: string }
      default?: { url?: string }
    }
  }
}

type VideoDetailItem = {
  id?: string
  statistics?: { viewCount?: string }
  contentDetails?: { duration?: string }
}

function App() {
  const [view, setView] = useState<View>('home')
  const [planMode, setPlanMode] = useState<PlanMode>('auto')
  const [targetMinutes, setTargetMinutes] = useState(30)
  const [state, setState] = useState<AppState>(defaultState)
  const [loaded, setLoaded] = useState(false)
  const [adoptedYouTube, setAdoptedYouTube] = useState<AdoptedYouTubeRecipe | null>(() => loadAdoptedYouTubeRecipe())

  useEffect(() => {
    loadState().then((saved) => {
      setState(saved)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (loaded) saveState(state)
  }, [state, loaded])

  const autoPlans = useMemo(
    () => buildPlans(state.pantry, targetMinutes, planMode === 'pantry'),
    [state.pantry, targetMinutes, planMode],
  )

  const selectedPlan = useMemo(() => {
    if (!state.selectedPlanId) return autoPlans[0]
    return buildPlans(state.pantry, 999, false).find((p) => p.id === state.selectedPlanId) ?? autoPlans[0]
  }, [state.selectedPlanId, state.pantry, autoPlans])

  const choosePlan = (plan: MealPlan, next: View = 'home') => {
    setState((prev) => ({ ...prev, selectedPlanId: plan.id, shoppingChecked: [] }))
    setView(next)
  }

  if (!loaded) return <div className="loading">段取り中...</div>

  if (view === 'cooking' && selectedPlan) {
    return <CookingView plan={selectedPlan} onExit={() => setView('home')} />
  }

  return (
    <div className="app-shell">
      <main className="main-content">
        {view === 'home' && (
          <HomeView
            state={state}
            targetMinutes={targetMinutes}
            setTargetMinutes={setTargetMinutes}
            selectedPlan={selectedPlan}
            adoptedYouTube={adoptedYouTube}
            onAutoYouTube={() => setView('youtube-flow')}
            onClearAdoptedYouTube={() => {
              clearAdoptedYouTubeRecipe()
              setAdoptedYouTube(null)
            }}
            onOpenPlans={(mode) => {
              setPlanMode(mode)
              setView('plans')
            }}
            onShopping={() => setView('shopping')}
            onPantry={() => setView('pantry')}
            onYouTube={() => setView('youtube')}
            onStartCooking={() => selectedPlan && setView('cooking')}
          />
        )}

        {view === 'plans' && (
          <PlansView
            plans={autoPlans.slice(0, 5)}
            mode={planMode}
            targetMinutes={targetMinutes}
            setTargetMinutes={setTargetMinutes}
            onModeChange={setPlanMode}
            onChoose={(plan) => choosePlan(plan, 'home')}
            onCook={(plan) => choosePlan(plan, 'cooking')}
          />
        )}

        {view === 'pantry' && (
          <PantryView
            pantry={state.pantry}
            onChange={(pantry) => setState((prev) => ({ ...prev, pantry }))}
          />
        )}

        {view === 'shopping' && (
          <ShoppingView
            plan={selectedPlan}
            pantry={state.pantry}
            checked={state.shoppingChecked}
            onChecked={(shoppingChecked) => setState((prev) => ({ ...prev, shoppingChecked }))}
            onChoosePlan={() => {
              setPlanMode('auto')
              setView('plans')
            }}
          />
        )}

        {view === 'youtube-flow' && (
          <YouTubeMealFlow
            pantry={state.pantry}
            targetMinutes={targetMinutes}
            onBack={() => setView('home')}
            onOpenYouTubeSettings={() => setView('youtube')}
          />
        )}

        {view === 'auto-youtube' && (
          <YouTubeAutoSuggestView
            pantry={state.pantry}
            targetMinutes={targetMinutes}
            onBack={() => setView('home')}
            onOpenYouTubeSettings={() => setView('youtube')}
            onAdopt={(recipe) => {
              setAdoptedYouTube(recipe)
              setView('home')
            }}
          />
        )}

        {view === 'youtube' && <YouTubeSearchView onBack={() => setView('home')} />}
      </main>

      {view !== 'youtube' && view !== 'auto-youtube' && view !== 'youtube-flow' && <BottomNav view={view} setView={setView} />}
    </div>
  )
}

function HomeView({
  state,
  targetMinutes,
  setTargetMinutes,
  selectedPlan,
  adoptedYouTube,
  onAutoYouTube,
  onClearAdoptedYouTube,
  onOpenPlans,
  onShopping,
  onPantry,
  onYouTube,
  onStartCooking,
}: {
  state: AppState
  targetMinutes: number
  setTargetMinutes: (n: number) => void
  selectedPlan?: MealPlan
  adoptedYouTube: AdoptedYouTubeRecipe | null
  onAutoYouTube: () => void
  onClearAdoptedYouTube: () => void
  onOpenPlans: (mode: PlanMode) => void
  onShopping: () => void
  onPantry: () => void
  onYouTube: () => void
  onStartCooking: () => void
}) {
  return (
    <>
      <header className="page-header home-header">
        <div>
          <p className="eyebrow">週末のごはんを、段取りで速く。</p>
          <h1>今日なに作る？</h1>
        </div>
        <div className="mini-badge">β</div>
      </header>

      <section className="time-panel">
        <div className="section-title-row">
          <div>
            <span className="section-kicker">いま使える時間</span>
            <h2>{targetMinutes}分</h2>
          </div>
          <span className="muted">主菜＋副菜</span>
        </div>
        <div className="time-options">
          {timeOptions.map((time) => (
            <button key={time} className={targetMinutes === time ? 'time-chip active' : 'time-chip'} onClick={() => setTargetMinutes(time)}>
              {time}
            </button>
          ))}
        </div>
      </section>

      <section className="mode-grid">
        <button className="mode-card mode-card-primary" onClick={onAutoYouTube}>
          <span className="mode-icon">✦</span>
          <span><strong>おまかせ提案</strong><small>YouTubeから毎回ちがう候補</small></span>
          <span className="arrow">›</span>
        </button>

        <button className="mode-card" onClick={() => onOpenPlans('pantry')}>
          <span className="mode-icon">🥬</span>
          <span><strong>家にあるもので</strong><small>{state.pantry.length}品を登録中</small></span>
          <span className="arrow">›</span>
        </button>

        <button className="mode-card youtube-mode-card" onClick={onYouTube}>
          <span className="mode-icon">▶</span>
          <span><strong>YouTubeから探す</strong><small>人気レシピを再生回数順で検索</small></span>
          <span className="arrow">›</span>
        </button>

        <button className="mode-card" onClick={onShopping}>
          <span className="mode-icon">🛒</span>
          <span><strong>買い物リスト</strong><small>献立から自動で差し引き</small></span>
          <span className="arrow">›</span>
        </button>

        <button className="mode-card" onClick={onPantry}>
          <span className="mode-icon">▦</span>
          <span><strong>冷蔵庫・在庫</strong><small>使い切り候補を増やす</small></span>
          <span className="arrow">›</span>
        </button>
      </section>

      {adoptedYouTube && (
        <section className="adopted-youtube-card">
          <div className="adopted-youtube-heading">
            <strong>今日の採用レシピ</strong>
            <span className="adopted-youtube-badge">✓ 採用中</span>
          </div>
          {adoptedYouTube.thumbnail && <img className="adopted-youtube-image" src={adoptedYouTube.thumbnail} alt="" />}
          <div className="adopted-youtube-body">
            <h2>{adoptedYouTube.title}</h2>
            <p>{adoptedYouTube.channelTitle}</p>
            <div className="adopted-youtube-tags">
              <span>{adoptedYouTube.ingredient}</span>
              <span>{adoptedYouTube.theme}</span>
              {adoptedYouTube.duration && <span>動画 {adoptedYouTube.duration}</span>}
            </div>
            <div className="adopted-youtube-actions">
              <button className="adopted-youtube-watch" onClick={() => openYouTube(adoptedYouTube.id)}>▶ 動画を見る</button>
              <button className="adopted-youtube-change" onClick={onAutoYouTube}>別の候補を探す</button>
            </div>
            <button className="adopted-youtube-clear" onClick={onClearAdoptedYouTube}>採用を解除</button>
          </div>
        </section>
      )}

      {!adoptedYouTube && selectedPlan && (
        <section className="today-card">
          <div className="today-card-top">
            <div><span className="section-kicker">現在の献立</span><h2>{selectedPlan.estimatedMinutes}分コース</h2></div>
            <span className="good-badge">段取り済み</span>
          </div>
          <div className="dish-row"><div className="dish-symbol main">主</div><div><strong>{selectedPlan.main.title}</strong><small>{selectedPlan.main.tags.slice(0, 2).join('・')}</small></div></div>
          <div className="dish-row"><div className="dish-symbol side">副</div><div><strong>{selectedPlan.side.title}</strong><small>{selectedPlan.side.tags.slice(0, 2).join('・')}</small></div></div>
          <div className="plan-stats">
            <span><b>{selectedPlan.missing.filter((m) => !m.staple).length}</b> 購入候補</span>
            <span><b>{selectedPlan.main.activeMinutes + selectedPlan.side.activeMinutes}</b> 分の実作業</span>
          </div>
          <button className="primary-cta" onClick={onStartCooking}>調理をはじめる <span>→</span></button>
        </section>
      )}
    </>
  )
}

function PlansView({ plans, mode, targetMinutes, setTargetMinutes, onModeChange, onChoose, onCook }: {
  plans: MealPlan[]
  mode: PlanMode
  targetMinutes: number
  setTargetMinutes: (n: number) => void
  onModeChange: (mode: PlanMode) => void
  onChoose: (plan: MealPlan) => void
  onCook: (plan: MealPlan) => void
}) {
  return (
    <>
      <header className="page-header"><p className="eyebrow">候補を比較</p><h1>{mode === 'pantry' ? '家にあるもので作る' : 'おまかせ提案'}</h1></header>
      <div className="segmented">
        <button className={mode === 'auto' ? 'active' : ''} onClick={() => onModeChange('auto')}>時間優先</button>
        <button className={mode === 'pantry' ? 'active' : ''} onClick={() => onModeChange('pantry')}>在庫優先</button>
      </div>
      <div className="compact-time-row">
        {timeOptions.map((time) => <button key={time} className={targetMinutes === time ? 'time-chip active' : 'time-chip'} onClick={() => setTargetMinutes(time)}>{time}分</button>)}
      </div>
      <section className="plan-list">
        {plans.map((plan, index) => (
          <article className="plan-card" key={plan.id}>
            <div className="rank-line"><span className="rank">{index === 0 ? 'おすすめ' : `候補 ${index + 1}`}</span><span className={plan.estimatedMinutes <= targetMinutes ? 'time-fit' : 'time-over'}>約{plan.estimatedMinutes}分</span></div>
            <h2>{plan.main.title}</h2><p className="plus-side">＋ {plan.side.title}</p>
            <div className="tag-line">{plan.main.tags.slice(0, 2).concat(plan.side.tags.slice(0, 1)).map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="plan-summary-grid">
              <div><b>{plan.missing.filter((m) => !m.staple).length}</b><small>買い足し</small></div>
              <div><b>{plan.main.activeMinutes + plan.side.activeMinutes}</b><small>実作業</small></div>
              <div><b>{Math.round((plan.main.popularity + plan.side.popularity) / 2)}</b><small>人気指数</small></div>
            </div>
            <div className="button-row"><button className="secondary-cta" onClick={() => onChoose(plan)}>これにする</button><button className="primary-small" onClick={() => onCook(plan)}>すぐ作る</button></div>
          </article>
        ))}
      </section>
    </>
  )
}

function PantryView({ pantry, onChange }: { pantry: PantryItem[]; onChange: (items: PantryItem[]) => void }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('個')
  const [category, setCategory] = useState<IngredientCategory>('野菜')

  const suggestions = useMemo(() => {
    const have = new Set(pantry.map((p) => p.name))
    return Array.from(new Map(recipes.flatMap((r) => r.ingredients).filter((i) => !i.staple && !have.has(i.name)).map((i) => [i.name, i])).values()).slice(0, 8)
  }, [pantry])

  const addItem = () => {
    if (!name.trim() || !Number(quantity)) return
    onChange([...pantry, { id: crypto.randomUUID(), name: name.trim(), quantity: Number(quantity), unit, category }])
    setName('')
    setQuantity('1')
  }

  return (
    <>
      <header className="page-header"><p className="eyebrow">スマホ内だけに保存</p><h1>冷蔵庫・在庫</h1><p className="lead">主材料だけ登録すれば十分です。調味料は「ある前提」で提案します。</p></header>
      <section className="inventory-list">
        {pantry.map((item) => <div className="inventory-item" key={item.id}><span className="inventory-dot" /><div><strong>{item.name}</strong><small>{item.quantity}{item.unit} · {item.category}</small></div><button onClick={() => onChange(pantry.filter((p) => p.id !== item.id))}>×</button></div>)}
      </section>
      <section className="form-card">
        <h2>追加する</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：鶏むね肉" />
        <div className="form-row"><input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g / 個 / 本" /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value as IngredientCategory)}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="primary-cta" onClick={addItem}>在庫に追加</button>
      </section>
      <section className="quick-add"><span className="section-kicker">よく使う材料</span><div className="chip-wrap">{suggestions.map((s) => <button key={s.name} onClick={() => onChange([...pantry, { ...s, id: crypto.randomUUID() }])}>＋ {s.name}</button>)}</div></section>
    </>
  )
}

function ShoppingView({ plan, pantry, checked, onChecked, onChoosePlan }: {
  plan?: MealPlan
  pantry: PantryItem[]
  checked: string[]
  onChecked: (ids: string[]) => void
  onChoosePlan: () => void
}) {
  if (!plan) return <div className="empty-page"><h1>献立がまだありません</h1><p>まず献立を1つ選ぶと買い物リストを作れます。</p><button className="primary-cta" onClick={onChoosePlan}>献立を選ぶ</button></div>

  const missing = getMissingIngredients([plan.main, plan.side], pantry).filter((i) => !i.staple)
  const grouped = categories.map((category) => ({ category, items: missing.filter((i) => i.category === category) })).filter((g) => g.items.length)
  const toggle = (key: string) => onChecked(checked.includes(key) ? checked.filter((id) => id !== key) : [...checked, key])

  return (
    <>
      <header className="page-header"><p className="eyebrow">今の献立から自動計算</p><h1>買い物リスト</h1><p className="lead">{plan.main.title} ＋ {plan.side.title}</p></header>
      {missing.length === 0 ? <div className="success-state"><div>✓</div><h2>買い足しなし</h2><p>登録済みの在庫で作れます。</p></div> : (
        <div className="shopping-groups">{grouped.map((group) => <section key={group.category}><h2>{group.category}</h2>{group.items.map((item) => { const key = `${item.name}|${item.unit}`; const done = checked.includes(key); return <button key={key} className={done ? 'shopping-item done' : 'shopping-item'} onClick={() => toggle(key)}><span className="checkmark">{done ? '✓' : ''}</span><span>{item.name}</span><strong>{item.quantity}{item.unit}</strong></button> })}</section>)}</div>
      )}
    </>
  )
}

function YouTubeSearchView({ onBack }: { onBack: () => void }) {
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem(YOUTUBE_KEY_STORAGE) ?? '')
  const [keyInput, setKeyInput] = useState(savedKey)
  const [query, setQuery] = useState('鶏むね肉 簡単')
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const saveApiKey = () => {
    const key = keyInput.trim()
    if (!key) { setError('APIキーを入力してください。'); return }
    localStorage.setItem(YOUTUBE_KEY_STORAGE, key)
    setSavedKey(key)
    setError('')
  }

  const deleteApiKey = () => {
    localStorage.removeItem(YOUTUBE_KEY_STORAGE)
    setSavedKey('')
    setKeyInput('')
    setVideos([])
    setError('')
  }

  const search = async () => {
    if (!savedKey) { setError('先にYouTube APIキーを保存してください。'); return }
    if (!query.trim()) { setError('検索する料理や食材を入力してください。'); return }

    setLoading(true)
    setError('')
    try {
      const searchParams = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: '10',
        q: `${query.trim()} レシピ`,
        order: 'viewCount',
        regionCode: 'JP',
        relevanceLanguage: 'ja',
        safeSearch: 'moderate',
        key: savedKey,
      })

      const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
      const searchJson = await searchResponse.json() as { items?: SearchItem[]; error?: { message?: string } }
      if (!searchResponse.ok) throw new Error(searchJson.error?.message ?? 'YouTube検索に失敗しました。')

      const items = searchJson.items ?? []
      const ids = items.map((item) => item.id?.videoId).filter((id): id is string => Boolean(id))
      if (!ids.length) { setVideos([]); return }

      const detailParams = new URLSearchParams({ part: 'statistics,contentDetails', id: ids.join(','), key: savedKey })
      const detailResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams}`)
      const detailJson = await detailResponse.json() as { items?: VideoDetailItem[]; error?: { message?: string } }
      if (!detailResponse.ok) throw new Error(detailJson.error?.message ?? '動画情報の取得に失敗しました。')

      const details = new Map((detailJson.items ?? []).filter((item): item is VideoDetailItem & { id: string } => Boolean(item.id)).map((item) => [item.id, item]))

      const result = items.flatMap((item): YouTubeVideo[] => {
        const id = item.id?.videoId
        if (!id) return []
        const detail = details.get(id)
        if (!detail) return []
        return [{
          id,
          title: decodeHtml(item.snippet?.title ?? ''),
          channelTitle: decodeHtml(item.snippet?.channelTitle ?? ''),
          thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
          viewCount: Number(detail.statistics?.viewCount ?? 0),
          duration: formatDuration(detail.contentDetails?.duration ?? ''),
        }]
      }).sort((a, b) => b.viewCount - a.viewCount)

      setVideos(result)
    } catch (e) {
      setVideos([])
      setError(e instanceof Error ? e.message : 'YouTube検索に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="page-header youtube-header"><button className="youtube-back" onClick={onBack}>←</button><div><p className="eyebrow">人気レシピを検索</p><h1>YouTubeから探す</h1></div></header>

      {!savedKey ? (
        <section className="youtube-key-card">
          <span className="section-kicker">初回だけ</span><h2>YouTube APIキー</h2>
          <p>APIキーはGitHubには保存せず、この端末のブラウザ内だけに保存します。</p>
          <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="AIza..." autoComplete="off" />
          <button className="primary-cta" onClick={saveApiKey}>APIキーを保存</button>
        </section>
      ) : (
        <>
          <section className="youtube-search-card">
            <label>料理・食材</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：鶏むね肉" onKeyDown={(e) => { if (e.key === 'Enter') void search() }} />
            <div className="youtube-query-chips"><button onClick={() => setQuery('鶏むね肉 簡単')}>鶏むね</button><button onClick={() => setQuery('豚こま 時短')}>豚こま</button><button onClick={() => setQuery('キャベツ 副菜')}>キャベツ</button><button onClick={() => setQuery('豆腐 簡単')}>豆腐</button></div>
            <button className="primary-cta" onClick={() => void search()} disabled={loading}>{loading ? '検索中...' : 'YouTubeで検索'}</button>
          </section>
          <div className="youtube-key-status"><span>APIキー設定済み</span><button onClick={deleteApiKey}>削除・再設定</button></div>
        </>
      )}

      {error && <div className="youtube-error">{error}</div>}

      {videos.length > 0 && (
        <section className="youtube-results">
          <div className="youtube-result-title"><strong>人気順</strong><small>{videos.length}件</small></div>
          {videos.map((video, index) => (
            <article className="youtube-video-card" key={video.id}>
              <button className="youtube-thumbnail-button" onClick={() => openYouTube(video.id)}>
                <img src={video.thumbnail} alt="" className="youtube-thumbnail" />
                {video.duration && <span className="youtube-duration">{video.duration}</span>}
                {index < 3 && <span className="youtube-rank">{index + 1}</span>}
              </button>
              <div className="youtube-video-body">
                <h2>{video.title}</h2><p>{video.channelTitle}</p>
                <div className="youtube-video-info"><strong>{formatViews(video.viewCount)}回再生</strong>{video.duration && <span>{video.duration}</span>}</div>
                <button className="youtube-open-button" onClick={() => openYouTube(video.id)}>▶ YouTubeで見る</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {!loading && savedKey && videos.length === 0 && !error && <div className="youtube-empty">食材や料理名を入れて検索してください。</div>}
    </>
  )
}

function CookingView({ plan, onExit }: { plan: MealPlan; onExit: () => void }) {
  const steps = useMemo(() => buildCookingSteps(plan), [plan])
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const step = steps[index]

  const move = (delta: number) => {
    setIndex((current) => Math.max(0, Math.min(steps.length - 1, current + delta)))
    if ('vibrate' in navigator) navigator.vibrate?.(12)
  }

  useEffect(() => {
    if (!step.timerMin) { setSecondsLeft(null); return }
    setSecondsLeft(step.timerMin * 60)
    const timer = window.setInterval(() => setSecondsLeft((left) => left === null || left <= 1 ? 0 : left - 1), 1000)
    return () => window.clearInterval(timer)
  }, [step.id, step.timerMin])

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart.current) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.3) return
    move(dx < 0 ? 1 : -1)
  }

  return (
    <div className="cooking-screen" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="cook-topbar"><button onClick={onExit}>×</button><div className="cook-progress"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div><span>{index + 1}/{steps.length}</span></div>
      <div className="cook-recipe-label">{step.recipeTitle}</div>
      <div className="cook-card">
        <p className="cook-step-label">いまやること</p><h1>{step.title}</h1>{step.detail && <p className="cook-detail">{step.detail}</p>}
        {step.ingredients && step.ingredients.length > 0 && <div className="cook-ingredients">{step.ingredients.map((ingredient) => <div key={`${ingredient.name}-${ingredient.quantity}`}><span>{ingredient.name}</span><strong>{ingredient.quantity}{ingredient.unit}</strong></div>)}</div>}
        {secondsLeft !== null && <div className={secondsLeft === 0 ? 'timer-card finished' : 'timer-card'}><span>{secondsLeft === 0 ? 'タイマー終了' : '自動タイマー'}</span><strong>{formatTimer(secondsLeft)}</strong></div>}
        {step.passive && <div className="parallel-hint">この待ち時間に、次の料理へ進みます</div>}
      </div>
      <div className="swipe-zone"><button disabled={index === 0} onClick={() => move(-1)}>←</button><div><strong>小指で横にスワイプ</strong><small>左へ：次　右へ：前</small></div>{index === steps.length - 1 ? <button className="finish-button" onClick={onExit}>✓</button> : <button onClick={() => move(1)}>→</button>}</div>
    </div>
  )
}

function BottomNav({ view, setView }: { view: View; setView: (view: View) => void }) {
  const items: Array<{ view: View; icon: string; label: string }> = [
    { view: 'home', icon: '⌂', label: 'ホーム' },
    { view: 'plans', icon: '✦', label: '献立' },
    { view: 'pantry', icon: '▦', label: '在庫' },
    { view: 'shopping', icon: '✓', label: '買い物' },
  ]
  return <nav className="bottom-nav">{items.map((item) => <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => setView(item.view)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
}

function formatDuration(value: string) {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatViews(value: number) {
  return new Intl.NumberFormat('ja-JP', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatTimer(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function openYouTube(videoId: string) {
  window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer')
}

function decodeHtml(value: string) {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

export default App
