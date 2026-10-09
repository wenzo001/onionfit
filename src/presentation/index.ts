// presentation：唯一负责把算法结论翻译成人话的文案层。
// 只消费结构化结果与 ReasonCode / 事实数字，不参与任何决策（硬约束：文案与决策分离）。
// 全部措辞对齐设计交付包 §05 文案表：已压缩过一轮，去掉「因为 / 记得 / 别忘」等口头语，数字一律保留。

import type {
  Accessory,
  ApparelLayer,
  BodyProfile,
  ColorPreference,
  CoverageStatus,
  DemandDim,
  DemandVector,
  DayPart,
  ExposureHabit,
  FeedbackEntry,
  FeedbackKind,
  HeatSensitivity,
  HourlyEnvironment,
  LayerRole,
  Occasion,
  OutfitAssembly,
  OutfitRecommendation,
  Presentation,
  ReasonCode,
  RecommendationFacts,
  SafetyReport,
  ScoreBucket,
  Silhouette,
  StyleTag,
  SweatLevel,
  TimelineEvent,
  UmbrellaAssessment,
  UmbrellaLeg,
  UmbrellaVerdict,
  UserSettings,
  WeatherDay,
  WeatherKind,
} from '@/core/types'
import { DEFAULT_SETTINGS } from '@/core/types'
import { localHourOf } from '@/core/engine/weather'
import { CATALOG } from '@/core/catalog'
import { computeAssembly, scoreDetail as engineScoreDetail } from '@/core/engine/scoring'
import { neutralPrefs, resolvePrefs } from '@/core/engine/prefs'
import { SELECTABLE_ACTIVITIES, resolveActivity } from '@/core/engine/activity'
import { EXPOSURE_HABIT, FEEDBACK, UMBRELLA } from '@/core/config'
import { fmtMinutes } from '@/core/engine/exposure'

// ===== 基础格式化 =====

/** 24 小时制时刻，界面所有时间只出现这一种格式 */
export function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 温度：整度显示，非整留一位 */
export function fmtTempC(v: number): string {
  const r = Math.round(v * 10) / 10
  return `${Number.isInteger(r) ? r : r.toFixed(1)}°`
}

const CN_COUNT = ['零', '一', '两', '三', '四', '五', '六']

/** 中文数字（层数、件数用，避免出现「3 件可脱」这种混排） */
function cnCount(n: number): string {
  return CN_COUNT[n] ?? String(n)
}

// ===== 主屏 =====

/** 天气短语只描述现象，温度由大号数字承担（§05 口径：「多云 · 白天」） */
export function weatherDesc(kind: WeatherKind, isDay: boolean): string {
  const time = isDay ? '白天' : '夜间'
  switch (kind) {
    case 'clear':
      return `晴 · ${time}`
    case 'cloudy':
      return `多云 · ${time}`
    case 'rain':
      return `有雨 · ${time}`
    case 'snow':
      return `降雪 · ${time}`
    case 'thunder':
      return `雷雨 · ${time}`
    case 'fog':
      return `有雾 · ${time}`
    default:
      return time
  }
}

/** 城市行：市 · 区（无区级信息时只给市） */
export function cityLine(city: { name: string; admin1?: string }): string {
  return city.admin1 ? `${city.name} · ${city.admin1}` : city.name
}

export function updatedLine(at: Date): string {
  return `${formatClock(at)} 更新`
}

/** 洋葱君气泡：产品人格的唯一具象，不承担信息职责 */
export function mascotBubble(r: OutfitRecommendation): string {
  const d = r.demand.vector
  if (r.safety.level === 'DANGER') return '这天有点极端，出门注意点～'
  if (d.WIND >= 55) return '风大，出门带件外套～'
  if (d.RAIN >= 45) return '要下雨，伞别忘～'
  if (d.WARMTH >= 70) return '冷，最外面那件别脱～'
  if (d.SOLAR >= 60) return '晒，帽子戴上～'
  if (d.WARMTH <= 15 && d.BREATHABILITY >= 55) return '闷热，穿得透气点～'
  return '今天好穿，两层够了～'
}

/** 脚注：层数折成中文量词，点进「洋葱结构」屏 */
export function whyFootnote(layerCount: number): string {
  return `为什么是这${cnCount(layerCount)}件`
}

// ===== 层卡（通道一 = 状态，通道二 = 行底色） =====

export interface LayerLine {
  title: string
  subtitle: string
  role: ApparelLayer['role']
  active: boolean
}

/** 同层多件（贴身上下装）用「+」连，读起来是一套而不是清单 */
export function layerTitle(layer: ApparelLayer): string {
  return layer.items.map((i) => i.name).join(' + ') || '暂无'
}

const SHELL_SUFFIX: Partial<Record<ReasonCode, string>> = {
  NEED_WIND_SHELL: '风大再穿',
  NEED_RAIN_SHELL: '有雨再穿',
  NEED_SUN_SHELL: '晒了再穿',
  NEED_COLD_SHELL: '冷就穿上',
  NEED_INSULATION: '冷了再穿',
  NEED_TWO_LAYERS: '冷了再穿',
  NEED_SECOND_INSULATION: '更冷再穿',
}

/**
 * 层行副标题：正穿说「什么时候脱」，带着说「包里备用 + 什么时候换上来」。
 * 脱/穿时刻来自 timeline（真实事件），没有事件就不编时刻。
 */
export function layerLine(layer: ApparelLayer, timeline: TimelineEvent[]): LayerLine {
  const title = layerTitle(layer)
  const doff = timeline.find((e) => e.role === layer.role && e.action === 'REMOVE')
  const add = timeline.find((e) => e.role === layer.role && e.action === 'ADD')

  if (!layer.active) {
    const when = SHELL_SUFFIX[layer.noteCode ?? ''] ?? (add ? `${hourPhrase(add.hour)}穿回` : '再穿')
    return { title, subtitle: `包里备用 · ${when}`, role: layer.role, active: false }
  }
  if (layer.role === 'BASE') return { title, subtitle: '一直穿', role: layer.role, active: true }
  if (layer.role === 'INSULATION') {
    return {
      title,
      subtitle: doff ? `正穿 · ${hourPhrase(doff.hour)}脱掉` : '正穿',
      role: layer.role,
      active: true,
    }
  }
  const why = SHELL_SUFFIX[layer.noteCode ?? '']?.replace('再穿', '')
  return { title, subtitle: why ? `正穿 · ${why}` : '正穿', role: layer.role, active: true }
}

/** 「14:00」→「14 点」：口语时刻，整点才折 */
function hourPhrase(hourText: string): string {
  const h = Number(hourText.split(':')[0])
  return Number.isFinite(h) ? `${h} 点` : hourText
}

// ===== 带伞（Q4，独立成卡；三种结论只会出现一个） =====

const UMBRELLA_HEADLINE: Record<UmbrellaVerdict, string> = {
  BRING: '今天带伞',
  RAINCOAT: '改成穿雨衣',
  SKIP: '今天不用带',
}

export function umbrellaHeadline(a: UmbrellaAssessment): string {
  return UMBRELLA_HEADLINE[a.verdict]
}

/**
 * 一句话依据只说被淋概率与最险的那一段。
 * SKIP 绝不说「今天不下雨」——那只说概率，避免用户被天气反证时怪结论撒谎。
 */
export function umbrellaReason(a: UmbrellaAssessment): string {
  if (a.verdict === 'SKIP') return `只有 ${a.probability}% 会淋到`
  if (a.verdict === 'RAINCOAT') {
    return a.reasons.includes('wind-rain')
      ? `风 ${a.windMs} m/s 伞会翻，改穿雨衣`
      : `雨强 ${a.rainMmPerHour} mm/h 伞挡不住，改穿雨衣`
  }
  const legs = a.legs.length
  const worst = a.legs.reduce((acc, l) => (l.probability > acc.probability ? l : acc), a.legs[0])
  if (!worst) return `${a.probability}% 会淋到`
  return `通勤${cnCount(legs)}段 ${a.probability}% 会淋到 · ${LEG_PHASE_LABEL[worst.phase]}那段最险`
}

const LEG_PHASE_LABEL: Record<UmbrellaLeg['phase'], string> = {
  OUT: '出门',
  HOME: '回家',
  NOW: '此刻',
}

export function umbrellaLegLabel(leg: UmbrellaLeg): string {
  return `${LEG_PHASE_LABEL[leg.phase]} ${leg.start}`
}

/** 可信度一行：数据能不能当真，必须显式 */
export function umbrellaConfidence(a: UmbrellaAssessment, commute?: { out: string | null; home: string | null }): string {
  if (a.confidence === 'DEGRADED' && a.assumed) return '无逐时 · 按 07:30 / 18:00 估'
  if (a.confidence === 'DEGRADED') return '无逐时 · 按全天概率估'
  if (a.assumed) return '有逐时 · 按 07:30 / 18:00 估'
  const out = commute?.out ?? a.legs.find((l) => l.phase === 'OUT')?.start
  const home = commute?.home ?? a.legs.find((l) => l.phase === 'HOME')?.start
  return out && home ? `有逐时 · 按 ${out} / ${home} 算` : '有逐时 · 按通勤段算'
}

/** 带伞三态图例（时间线屏用，讲清算法一共只有这三种答案） */
export const UMBRELLA_OUTCOMES: { key: UmbrellaVerdict; label: string; note: string }[] = [
  { key: 'BRING', label: '今天带伞', note: '概率过阈值' },
  { key: 'RAINCOAT', label: '改成穿雨衣', note: '风大伞会翻，此时才推' },
  { key: 'SKIP', label: '今天不用带', note: '只报概率，不报「不下雨」' },
]

// ===== 六维需求（中间态数字折在这里，只有 m/s 露到主屏） =====

export const DEMAND_META: Record<DemandDim, { label: string; subtitle: string }> = {
  WARMTH: { label: '保暖', subtitle: '热量保持' },
  WIND: { label: '防风', subtitle: '抗风阻隔' },
  RAIN: { label: '防雨', subtitle: '防水隔湿' },
  BREATHABILITY: { label: '透气', subtitle: '排汗散热' },
  SOLAR: { label: '遮阳', subtitle: '防晒防护' },
  REMOVABLE: { label: '可脱卸', subtitle: '穿脱便利' },
}

export interface DemandBar {
  dim: DemandDim
  label: string
  /** 右侧事实标注：4° / 9.4 m/s / 室内 … */
  fact: string
  value: number
  /** 被安全下限强制抬升 = 粉（与「现在」指针同色，表示这不是日常需求） */
  forced: boolean
}

/** 六维 → 带单位的可读行；单位一律取已算出的事实数字 */
export function demandBars(
  vector: DemandVector,
  facts: RecommendationFacts,
  forced: Partial<DemandVector>,
): DemandBar[] {
  const dims: DemandDim[] = ['WARMTH', 'WIND', 'RAIN', 'BREATHABILITY', 'SOLAR', 'REMOVABLE']
  return dims.map((dim) => ({
    dim,
    label: DEMAND_META[dim].label,
    fact: demandFact(dim, facts),
    value: Math.round(vector[dim]),
    forced: forced[dim] != null && forced[dim]! >= vector[dim],
  }))
}

function demandFact(dim: DemandDim, f: RecommendationFacts): string {
  switch (dim) {
    case 'WARMTH':
      // 保暖按设计时刻（全天最需保暖的整点）的气温说话
      return fmtTempC(f.designHourTempC)
    case 'WIND':
      return `${round1(f.windMaxMs)} m/s`
    case 'RAIN':
      // 活动决定暴露：0 = 全天室内，不把用户根本用不上的降水量甩给他
      return f.rainExposure <= 0 ? '室内' : `雨 ${round1(f.dayRainMm)} mm`
    case 'BREATHABILITY':
      return fmtTempC(f.dayMaxC)
    case 'SOLAR':
      return f.dayUvMax < 0 ? 'UV 未知' : `UV ${round1(f.dayUvMax)}`
    case 'REMOVABLE':
      return `温差 ${Math.round(f.dayRangeC)}°`
  }
}

// ===== 每层为什么存在（理由 = 槽位机器码 + 触发它的事实数字） =====

export interface LayerReason {
  role: ApparelLayer['role']
  title: string
  /** 「← 」左侧是回溯到的事实，右侧是这一层的职责 */
  reason: string
}

/** 每层的存在理由都可回溯到需求数字，用户问「凭什么」时界面答得出来 */
export function layerReasons(r: OutfitRecommendation): LayerReason[] {
  const f = r.facts
  const d = r.demand.vector
  return orderLayers(r.dayOutfit.layers).map((l) => ({
    role: l.role,
    title: layerTitle(l),
    reason: roleReason(l, d, f, r.thermal.requiredMaxClo),
  }))
}

function roleReason(
  l: ApparelLayer,
  d: DemandVector,
  f: RecommendationFacts,
  requiredClo: number,
): string {
  if (l.role === 'BASE') return '任何天气都要，负责吸汗'
  if (l.role === 'INSULATION') {
    return `保暖需求 ${Math.round(d.WARMTH)}，需约 ${requiredClo.toFixed(2)} clo`
  }
  // 防护层按真正触发它的那一维说话：风 / 雨 / 晒 / 严寒
  switch (l.noteCode) {
    case 'NEED_RAIN_SHELL':
      return `雨 ${round1(f.dayRainMm)} mm，加厚没用，得有壳`
    case 'NEED_SUN_SHELL':
      return `UV ${round1(f.dayUvMax)}，防晒得靠外层`
    case 'NEED_COLD_SHELL':
      return `最冷 ${round1(f.designHourTempC)}°，靠厚外壳锁住体温`
    default:
      return `风到 ${round1(f.windMaxMs)} m/s，加厚没用，得有壳`
  }
}

// ===== 体检分 =====

export function scoreGrade(score: number): string {
  if (score >= 80) return '这套挺合适'
  if (score >= 62) return '还行，能更稳'
  return '有点勉强'
}

/** 一行体检明细：定性词是「有效 clo 对比设计时刻所需 clo」，不是另起一套判断 */
export function scoreDetail(a: OutfitAssembly, requiredClo: number): string {
  const ratio = requiredClo > 0 ? a.effectiveClo / requiredClo : 1
  const warmth = ratio < 0.85 ? '保暖偏薄' : ratio > 1.25 ? '保暖偏厚' : '保暖刚好'
  const wind = a.wind >= 0.7 ? '挡风够' : a.wind >= 0.4 ? '挡风一般' : '挡风不足'
  return `${warmth} · ${wind} · ${a.weightGrams}g · ${a.removableCount} 件可脱`
}

// ===== 时间线（Q3：「之后」的事，放第三屏） =====

export interface TimelineLine {
  hour: string
  title: string
  note: string
}

const ROLE_EVENT_LABEL: Record<ApparelLayer['role'], string> = {
  PROTECTION: '外层',
  INSULATION: '一层',
  BASE: '贴身层',
}

export function timelineLines(events: TimelineEvent[]): TimelineLine[] {
  return events.slice(0, 6).map((e) => ({
    hour: hourClock(e.hour),
    title: `${e.action === 'REMOVE' ? '脱' : '加'}${ROLE_EVENT_LABEL[e.role]}`,
    note:
      e.action === 'REMOVE'
        ? '最暖的一小时，脱掉塞包'
        : '起转凉，穿回' + ROLE_EVENT_LABEL[e.role],
  }))
}

function hourClock(hourText: string): string {
  const h = Number(hourText.split(':')[0])
  return Number.isFinite(h) ? `${String(h).padStart(2, '0')}:00` : hourText
}

/** 曲线标题的读法说明：橙点 = 脱衣时刻，让逻辑自己说话 */
export const CURVE_HINT = '橙点 = 脱衣'

/** 曲线中间态：连续有降水的整点区间，读作「16-18 雨」 */
export function rainBand(hourly: HourlyEnvironment[]): { start: number; end: number } | null {
  let best: { start: number; end: number } | null = null
  let start = -1
  const hourAt = (i: number) => localHourOf(hourly[i].time, i % 24)
  const wetAt = (i: number) =>
    hourly[i].precipitationMmPerHour > 0.05 || hourly[i].precipitationProbabilityPercent >= 60

  for (let i = 0; i <= hourly.length; i++) {
    const wet = i < hourly.length && wetAt(i)
    if (wet && start < 0) start = hourAt(i)
    if (!wet && start >= 0) {
      const end = i === 0 ? hourAt(0) : hourAt(i - 1) + 1
      if (!best || end - start > best.end - best.start) best = { start, end }
      start = -1
    }
  }
  return best
}

/** 一天三段：早 / 午 / 晚，短句 + 一个动作 */
export function daypartLines(parts: DayPart[], r: OutfitRecommendation): TimelineLine[] {
  const events = r.timeline
  return parts.map((p) => {
    const inRange = events.filter((e) => {
      const h = Number(e.hour.split(':')[0])
      return h >= p.startHour && h < p.endHour
    })
    const remove = inRange.find((e) => e.action === 'REMOVE')
    const add = inRange.find((e) => e.action === 'ADD')
    return {
      hour: `${PHASE_SHORT[p.phase] ?? p.label} ${p.startHour}-${p.endHour}`,
      title: `${Math.round(p.avgTemp)}°`,
      note: phaseNote(remove, add, r),
    }
  })
}

const PHASE_SHORT: Record<DayPart['phase'], string> = {
  morning: '早',
  noon: '午',
  evening: '晚',
}

function phaseNote(remove?: TimelineEvent, add?: TimelineEvent, r?: OutfitRecommendation): string {
  const d = r?.demand.vector
  if (remove) return '脱一层'
  if (add) return '加一层'
  if (d && d.WIND >= 50) return '有风'
  if (d && d.RAIN >= 40) return '有雨'
  if (d && d.WARMTH >= 65) return '偏冷'
  if (d && d.BREATHABILITY >= 60) return '闷热'
  return '平稳'
}

// ===== 配饰（reasonCode 由 AccessoriesEngine 给出，界面上只翻译） =====

export interface AccessoryLine {
  icon: string
  title: string
  note: string
}

const ACCESSORY_NOTE: Partial<Record<ReasonCode, string>> = {
  cold: '低温段',
  frozen: '会冻手',
  sun: '午后 UV 仍偏高',
  'sun-high': 'UV 高，涂一层',
  sweat: '出汗多的话',
  removable: '温差大，备着',
}

export function accessoryNote(a: Accessory, facts: RecommendationFacts): string {
  const code = a.reasonCode ?? ''
  if (code === 'cold' || code === 'frozen') return `最低 ${fmtTempC(facts.dayMinC)}`
  return ACCESSORY_NOTE[code] ?? '今天用得上'
}

/** 「墨镜 + 遮阳帽」：同一原因（sun）的配饰并成一行，清单不铺长 */
export function groupAccessories(list: Accessory[], facts: RecommendationFacts): AccessoryLine[] {
  const out: AccessoryLine[] = []
  const used = new Set<string>()
  for (const a of list) {
    if (used.has(a.kind)) continue
    const twins =
      a.reasonCode === 'sun' ? list.filter((x) => x.reasonCode === 'sun') : [a]
    twins.forEach((t) => used.add(t.kind))
    out.push({
      icon: accessoryIconId(a.kind),
      title: twins.map((t) => t.label).join(' + '),
      note: accessoryNote(a, facts),
    })
  }
  return out
}

function accessoryIconId(kind: Accessory['kind']): string {
  const map: Record<string, string> = {
    SCARF: 'of-acc-scarf',
    GLOVES: 'of-acc-glove',
    HAND_WARMER: 'of-acc-warmer',
    SUNGLASSES: 'of-acc-glasses',
    HAT: 'of-acc-sunhat',
    SUNSCREEN: 'of-acc-sunscreen',
    AIRY_VEST: 'of-acc-lightvest',
    SPARE_TEE: 'of-base-tee',
  }
  return map[kind] ?? 'of-acc-lightvest'
}

// ===== 安全预警：唯一允许压过穿搭建议的样式 =====

export interface SafetyAlert {
  title: string
  body: string
  /** 被强制抬升的需求维度（黑底白字胶囊） */
  chips: string[]
}

/** 标题按主导危害给一句人话，等级词只在危害明确时出现 */
export function safetyAlert(s: SafetyReport, facts: RecommendationFacts): SafetyAlert | null {
  if (s.level === 'NORMAL') return null
  const d = s.forcedDemands
  const hot = facts.dayMaxC >= 32
  const cold = facts.dayMinC <= -5
  const title = hot
    ? '高温橙色 · 别中暑'
    : cold
      ? '严寒 · 别冻着'
      : d.RAIN != null || d.WIND != null
        ? '恶劣天气 · 外层要紧'
        : s.level === 'DANGER'
          ? '天气极端 · 注意'
          : '这天有点偏 · 留意'
  const chips = Object.entries(d)
    .filter(([, v]) => typeof v === 'number' && v! > 0)
    .map(([k, v]) => `${DEMAND_META[k as DemandDim].label} ≥${Math.round(v as number)}`)
  return { title, body: s.warnings.join('　'), chips }
}

// ===== 覆盖情况（方案 §5.2：衣物库不够时不伪装成合格推荐） =====

export type CoverageIcon = '!' | '~' | '✓' | '?'

export interface CoverageRow {
  label: string
  value: string
  note?: string
}

export interface CoverageFix {
  title: string
  note: string
}

export interface CoverageCopy {
  status: CoverageStatus
  icon: CoverageIcon
  tone: 'pink' | 'yellow' | 'mint' | 'paper'
  title: string
  line: string
  /** 差多少：需要 / 这套给 / 还差（或余量）；unknown 时为 null */
  rows: CoverageRow[] | null
  /** 库容量是另一回事：就算全穿最厚的也差多少；只在不合格时说 */
  catalogLine: string | null
  /** 可以这样补：措辞对齐方案 §5.2 的三条出路（减少暴露 / 更高等级装备 / 补目录） */
  fixes: CoverageFix[]
  /** 这套话能信几分 */
  trust: { percent: number; factors: string[] }
  /** 气候与通勤的口径说明（只解释怎么算的，不参与结论） */
  scope: string[]
}

/** clo 缺口折算成人能听懂的「差几件」；分档对齐 config.ts COVERAGE 注释（0.4 ≈ 一件轻中层） */
export function closetGapWords(clo: number): string | null {
  if (clo >= 0.7) return '约一件厚羽绒或一条加绒长裤'
  if (clo >= 0.4) return '约一件薄毛衣'
  return null
}

const COVERAGE_META: Record<
  CoverageStatus,
  { icon: CoverageIcon; tone: CoverageCopy['tone']; title: string }
> = {
  insufficient: { icon: '!', tone: 'pink', title: '现有的衣服不够用' },
  marginal: { icon: '~', tone: 'yellow', title: '刚好够，没有余量' },
  adequate: { icon: '✓', tone: 'mint', title: '够用' },
  unknown: { icon: '?', tone: 'paper', title: '拿不到足够数据' },
}

const SEASON_LABEL = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' } as const

/** 被放宽 / 找不到候选的层 → 人话（RELAXED_INSULATION → 保暖层的档位） */
function relaxedWords(codes: ReasonCode[]): string[] {
  const words = new Set<string>()
  for (const c of codes) {
    const m = /^(?:RELAXED|NO_CANDIDATE)_(BASE|INSULATION|PROTECTION)/.exec(c)
    if (m) words.add(`${ROLE_LABEL[m[1] as ApparelLayer['role']]}的档位`)
  }
  return [...words]
}

/** 把 coverage 划成一条不伪装的结论（deck 12 的四种样子） */
export function coverageCopy(r: OutfitRecommendation): CoverageCopy {
  const c = r.coverage
  const meta = COVERAGE_META[c.status]
  const atHour = `最冷 ${r.thermal.maxRequiredCloHour}:00`
  const req = c.requiredClo
  const avail = c.availableClo
  const deficit = c.deficitClo
  const margin = Math.round((avail - req) * 100) / 100

  let line: string
  if (c.status === 'unknown') line = '没有逐时预报，只能按日级估计，没法确认这套够不够。'
  else if (c.status === 'adequate') line = `${atHour} 需要 ${req} clo，这套还有 ${margin} clo 余量。`
  else if (deficit > 0) line = `${atHour} 需要 ${req} clo，这套只给到 ${avail} clo。`
  else line = `${atHour} 需要 ${req} clo，这套只剩 ${margin} clo 余量。`

  const rows: CoverageRow[] | null =
    c.status === 'unknown'
      ? null
      : [
          { label: '需要', value: `${req} clo`, note: `（${atHour}）` },
          { label: '这套给', value: `${avail} clo` },
          deficit > 0
            ? { label: '还差', value: `${deficit} clo`, note: closetGapWords(deficit) ?? undefined }
            : { label: '余量', value: `${margin} clo` },
        ]

  const catalogWords = closetGapWords(c.catalogDeficitClo)
  const catalogLine =
    c.status === 'insufficient' && c.catalogDeficitClo > 0
      ? `就算把库里最厚的都穿上，也只能凑到 ${c.capacityClo} clo${catalogWords ? `，还差${catalogWords}` : `，还差 ${c.catalogDeficitClo} clo`}。`
      : null

  const fixes: CoverageFix[] = []
  const add = (title: string, note: string) => fixes.push({ title, note })
  if (c.status === 'unknown') {
    add('连上网再算一次', '有逐时预报后才能给出确定结论。')
  } else {
    const canSwap = Math.round((c.capacityClo - avail) * 100) / 100 > 0.05
    if (deficit > 0) add('缩短户外时间', '最冷的通勤段尽量压短，先按这套撑。')
    if (canSwap && (deficit > 0 || c.status === 'marginal')) {
      add(
        '换上更厚的档位',
        c.catalogDeficitClo > 0
          ? `换上库里最厚的组合能到 ${c.capacityClo} clo。`
          : `换上库里最厚的组合能到 ${c.capacityClo} clo，够补齐这套的缺口。`,
      )
    }
    if (c.catalogDeficitClo > 0) {
      const roles = relaxedWords(c.unmetNeeds)
      add(
        '添置更高等级的单品',
        roles.length
          ? `按硬条件找不到合适的${roles.join('、')}，加进来就能补齐。`
          : `库里最厚仍差 ${c.catalogDeficitClo} clo，需要添置更高等级的单品。`,
      )
    }
  }

  const scope: string[] = []
  if (r.geo.season !== 'unknown' && r.geo.hemisphere !== 'unknown') {
    scope.push(`${r.geo.hemisphere === 'north' ? '北半球' : '南半球'} · ${SEASON_LABEL[r.geo.season]}`)
  } else {
    scope.push('位置缺失，没有采用气候带')
  }
  if (r.umbrella.reasons.includes('assumed-commute-time')) {
    scope.push(
      `通勤时刻是估算的（默认 ${fmtMinutes(UMBRELLA.fallbackOutMinutes)} / ${fmtMinutes(UMBRELLA.fallbackHomeMinutes)} 兜底）`,
    )
  } else if (r.umbrella.reasons.includes('commute-passed')) {
    scope.push('两段通勤都过了，改按此刻起的一段估')
  }

  return {
    status: c.status,
    ...meta,
    line,
    rows,
    catalogLine,
    fixes,
    trust: {
      percent: Math.round(c.confidence * 100),
      factors: [
        r.facts.hasHourly ? '有逐时预报' : '无逐时预报 · 按日级估计',
        r.geo.dataSource === 'forecast' ? '位置来自天气源' : '位置缺失 · 通用模型',
      ],
    },
    scope,
  }
}

// ===== 明日（Q5：压成一行，只在有变化时出现） =====

/**
 * 明日一行结论：只有真的变了才占主屏一行。
 * 变化判据取明日与今日的最低温差、降水与现象差异，都是已算出的数字。
 */
export function tomorrowLine(
  r: OutfitRecommendation,
  next: WeatherDay,
): { headline: string; detail: string } | null {
  const drop = Math.round(next.minC - r.facts.dayMinC)
  const parts: string[] = []
  if (drop <= -3) parts.push(`明早冷 ${Math.abs(drop)}°`)
  else if (drop >= 3) parts.push(`明早回暖 ${drop}°`)
  if (next.dayKind === 'rain' || next.dayKind === 'thunder') parts.push('有雨')
  if (next.dayKind === 'snow') parts.push('有雪')
  if (next.uvMax >= 6) parts.push('晒')
  // 没有任何一项变化就不出现（「变化不大」不值得占一行）
  if (!parts.length) return null
  const advice =
    drop <= -3 ? '加件外套' : next.dayKind === 'rain' || next.dayKind === 'thunder' ? '带伞' : next.dayKind === 'snow' ? '防寒防滑' : '照今天穿'
  return {
    headline: parts.join('、'),
    detail: `最低 ${fmtTempC(next.minC)} · ${advice}`,
  }
}

// ===== 设置：改完立刻重算的「证据」 =====

/** 一句话讲清当前这套是按哪个时刻配的（决策 6：不辩解，只给口径） */
export function designHourLine(r: OutfitRecommendation): string {
  const h = r.thermal.maxRequiredCloHour
  const t = r.facts.designHourTempC
  // 「大风」只能说那个小时的风，用全天最大值会把不风的午后说成风大
  const windy = r.facts.designHourWindMs >= 8 ? '+大风' : ''
  return `按全天最冷的 ${h}:00（${fmtTempC(t)}${windy}）配的。午后回暖只脱一层，不换一套。`
}

/** 「现在不冷，为什么带毛衣？」——只在真有带着的保暖层/外层时出现 */
export function carryExplainer(r: OutfitRecommendation): string | null {
  const carried = r.nowOutfit.layers.find((l) => !l.active)
  if (!carried) return null
  const warmNow = r.thermal.feelsLikeC >= 16
  const name = carried.role === 'INSULATION' ? '毛衣' : carried.role === 'PROTECTION' ? '外套' : '打底'
  return warmNow ? `现在不冷，为什么带${name}？` : `为什么还带${name}？`
}

/** 活动切换预览的差异说明：两次本地计算对比，不联网、秒出 */
export function activityDiff(
  from: OutfitRecommendation,
  to: OutfitRecommendation,
  toLabel: string,
): string {
  const added = diffRoles(from.dayOutfit.layers, to.dayOutfit.layers)
  const swapped = diffNames(from.dayOutfit.layers, to.dayOutfit.layers)
  const bits: string[] = []
  if (added.length) bits.push(`多${added.join('、')}`)
  if (swapped.length) bits.push(swapped.slice(0, 2).join('，'))
  if (!bits.length) bits.push(`层数不变，${toLabel}主要改透气与重量`)
  return `${bits.join(' · ')}。不联网，秒出。`
}

function diffRoles(a: ApparelLayer[], b: ApparelLayer[]): string[] {
  const count = (layers: ApparelLayer[], role: string) =>
    layers.filter((l) => l.role === role).reduce((n, l) => n + l.items.length, 0)
  const out: string[] = []
  for (const role of ['PROTECTION', 'INSULATION'] as const) {
    const delta = count(b, role) - count(a, role)
    if (delta > 0) out.push(`${delta} 件${role === 'PROTECTION' ? '防风外层' : '保暖层'}`)
    else if (delta < 0) out.push(`少 ${-delta} 件${role === 'PROTECTION' ? '外层' : '保暖层'}`)
  }
  return out
}

function diffNames(a: ApparelLayer[], b: ApparelLayer[]): string[] {
  const nameOf = (layers: ApparelLayer[], role: string) =>
    layers.find((l) => l.role === role)?.items.map((i) => i.name).join('/') ?? ''
  const out: string[] = []
  for (const role of ['PROTECTION', 'INSULATION', 'BASE'] as const) {
    const before = nameOf(a, role)
    const after = nameOf(b, role)
    if (before && after && before !== after) out.push(`${before}换${after}`)
  }
  return out
}

// ===== 层序：从上到下 = 从外到内（洋葱剥开的顺序） =====

const ROLE_ORDER: Record<ApparelLayer['role'], number> = { PROTECTION: 3, INSULATION: 2, BASE: 1 }

/** 外层在上（它本来就是外层，带着的也不抢当下） */
export function orderLayers(layers: ApparelLayer[]): ApparelLayer[] {
  return [...layers].sort((x, y) => ROLE_ORDER[y.role] - ROLE_ORDER[x.role])
}

export const ROLE_LABEL: Record<ApparelLayer['role'], string> = {
  PROTECTION: '防护层',
  INSULATION: '保暖层',
  BASE: '贴身层',
}

// ===== 为什么是这套（deck 13）：每条理由都标出处 =====
// 出处枚举与方案 §9 reasons[].source 同源；句子本身全部来自引擎，presentation 只做归类与拼接

export type WhySource = 'stability' | 'weather' | 'profile' | 'safety' | 'style' | 'fallback'

export const WHY_SOURCE_LABEL: Record<WhySource, string> = {
  stability: '沿用',
  weather: '天气',
  profile: '个人',
  safety: '安全',
  style: '风格',
  fallback: '兜底',
}

export interface WhyReason {
  source: WhySource
  text: string
}

const DIM_WORD: Record<DemandDim, string> = {
  WARMTH: '保暖',
  WIND: '防风',
  RAIN: '防雨',
  BREATHABILITY: '透气',
  SOLAR: '防晒',
  REMOVABLE: '可脱卸',
}

const ACTIVITY_LABEL = new Map(SELECTABLE_ACTIVITIES.map((a) => [a.value, a.label]))

export const STYLE_LABEL: Record<StyleTag, string> = {
  DAILY: '日常简约',
  COMMUTE: '通勤',
  BUSINESS: '商务正式',
  SPORT: '运动',
  OUTDOOR: '户外机能',
  STREET: '街头',
  JAPANESE_LOOSE: '日系宽松',
  KOREAN_CLEAN: '韩系简洁',
}

export const OCCASION_LABEL: Record<Occasion, string> = {
  DAILY: '日常',
  OFFICE: '办公',
  SCHOOL: '学校',
  SPORT: '运动',
  OUTDOOR_WORK: '户外作业',
  FORMAL: '正式活动',
}

export const HABIT_LABEL: Record<ExposureHabit, string> = {
  MAINLY_INDOOR: '主要室内',
  SHORT_OUTDOOR: '短时户外',
  LONG_OUTDOOR: '长时户外',
}

/**
 * 为什么是这套：天气->个人->安全->风格的顺序，天气句按需求强度取前几维，
 * 「当前运动自带风感」这类个人句子从天气句里摘出来单列。
 */
export function whyReasons(r: OutfitRecommendation, settings?: UserSettings): WhyReason[] {
  const v = r.demand.vector
  const byDim = r.demand.reasons

  const dims = (Object.keys(v) as DemandDim[])
    .filter((d) => (byDim[d]?.length ?? 0) > 0)
    .sort((a, b) => v[b] - v[a])

  const weather: string[] = []
  const profile: string[] = []
  for (const d of dims) {
    for (const s of byDim[d] ?? []) {
      if (s.startsWith('当前运动')) profile.push(s)
      else weather.push(s)
    }
  }

  const out: WhyReason[] = []
  // 沿用是这一天最直接的理由（deck 15 滞回口径）；引擎只报事实，句子由这里拼
  if (r.reusedPrevious) {
    out.push({ source: 'stability', text: '轻微天气变化不换装：沿用上一套（逐槽仍合格，差异在容差内）' })
  }
  out.push(...weather.slice(0, 4).map((text) => ({ source: 'weather' as const, text })))

  if (settings) {
    const act = resolveActivity(settings.activity)
    const label = ACTIVITY_LABEL.get(settings.activity)
    if (label) {
      const tail = act.rainExposure >= 0.8 ? '户外暴露久，风雨按全程算' : '按它的代谢与暴露修正'
      profile.push(`选的是「${label}」，${tail}`)
    }
    if (settings.exposureHabit && settings.exposureHabit !== 'SHORT_OUTDOOR') {
      profile.push(
        `暴露习惯「${HABIT_LABEL[settings.exposureHabit]}」把防雨权重 ×${EXPOSURE_HABIT[settings.exposureHabit]}`,
      )
    }
    const bias = resolvePrefs(settings).warmthBiasClo
    if (bias !== 0) {
      profile.push(`「偏冷 / 偏热」反馈折算成保暖目标 ${bias > 0 ? '+' : ''}${bias} clo`)
    }
  }
  out.push(...profile.slice(0, 2).map((text) => ({ source: 'profile' as const, text })))

  const safetyWords = r.safety.warnings.slice(0, 2)
  const forced = (Object.entries(r.safety.forcedDemands) as [DemandDim, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0]
  for (const text of safetyWords) out.push({ source: 'safety', text })
  if (forced) {
    out.push({ source: 'safety', text: `${DIM_WORD[forced[0]]}需求被强制抬到 ${forced[1]}（安全规则先行）` })
  }

  if (settings?.styles?.length) {
    const s = r.scoreBreakdown.find((b) => b.key === 'style')
    const names = settings.styles.map((x) => STYLE_LABEL[x]).join('、')
    out.push({
      source: 'style',
      text: `「${names}」参与排序（风格/场合 ${fmtScore(s?.score ?? 0)}/${s?.max ?? 18}）`,
    })
  }
  if (settings?.occasion && settings.occasion !== 'DAILY') {
    out.push({ source: 'style', text: `按「${OCCASION_LABEL[settings.occasion]}」场合对齐正式度` })
  }

  if (!out.length) out.push({ source: 'fallback', text: '今天没有突出的需求项，按中性组合配的' })
  return out
}

// ===== 这套准吗：反馈闭环 + 滞回（deck 15） =====
// 4 个胶囊来自设计稿；「偏热 / 闷」是一次点击记两条（HOT + STUFFY 同刻 = 一批）。
// 说明句的数字全部取 FEEDBACK 配置（步长/上限一个源），句子不写死数字。

export const FEEDBACK_CHIPS: { label: string; kinds: FeedbackKind[] }[] = [
  { label: '偏冷', kinds: ['COLD'] },
  { label: '偏热 / 闷', kinds: ['HOT', 'STUFFY'] },
  { label: '不符合场合', kinds: ['OFF_OCCASION'] },
  { label: '很合适', kinds: ['JUST_RIGHT'] },
]

export const FEEDBACK_FOOTNOTE =
  '只小步调整、设上下限、随时可撤销。单次反馈不改安全阈值，也不改天气事实。'

export const HYSTERESIS = {
  title: '轻微天气变化不换装',
  example: '昨天 12° 薄毛衣 + 外套 → 今天 11° 沿用那套',
  upgrade: '只有明显改善舒适度、新增安全要求、或原方案违反硬约束时，才允许大幅换装',
  urgent: '暴雨 / 强风 / 极端温度 / UV 升高 → 立即调整，不等滞回',
}

export interface LastFeedback {
  label: string
  kinds: FeedbackKind[]
}

/** 最后一批点击（同刻多条 = 一批）换成人话；空历史 → null */
export function lastFeedback(history: FeedbackEntry[] | undefined): LastFeedback | null {
  if (!history?.length) return null
  const at = history[history.length - 1].at
  const kinds = history.filter((x) => x.at === at).map((x) => x.kind)
  const set = new Set(kinds)
  const chip = FEEDBACK_CHIPS.find((c) => c.kinds.every((k) => set.has(k)))
  return chip ? { label: chip.label, kinds } : null
}

/** 该批反馈「接下来会发生什么」（步长与上限来自 FEEDBACK 配置） */
export function feedbackNote(kinds: FeedbackKind[]): string {
  const s = new Set(kinds)
  if (s.has('COLD')) {
    return `下次同样天气会多加 ${FEEDBACK.warmthStepClo} clo —— 上限 ${FEEDBACK.warmthMaxClo} clo，不会一路加上去。`
  }
  if (s.has('HOT') || s.has('STUFFY')) {
    return `下次同样天气会少要 ${FEEDBACK.warmthStepClo} clo、更看重透气 —— 上限各 ${FEEDBACK.warmthMaxClo}，不会一路加上去。`
  }
  if (s.has('OFF_OCCASION')) {
    return `下次同样场合会更看重正式度 —— 每步 ${FEEDBACK.occasionStep}，上限 ${FEEDBACK.occasionMax}，不会一路加上去。`
  }
  return `相似天气下更容易沿用这套 —— 每步 ${FEEDBACK.reuseStep} 分，上限 ${FEEDBACK.reuseMax} 分。`
}

/** 沿用当天的活状态句（滞回块里显示「今天为什么没换」） */
export function hysteresisStateLine(r: OutfitRecommendation): string | null {
  return r.reusedPrevious ? '今天：沿用上一套（每层仍合格，差异在容差内）' : null
}

// ===== 这套好在哪：8 个分项 =====

export const BUCKET_LABEL: Record<ScoreBucket['key'], string> = {
  warmth: '热舒适 / 保暖匹配',
  protection: '天气防护',
  activity: '活动舒适',
  style: '风格 / 场合一致',
  coordination: '整套协调',
  removable: '可脱卸 / 温差适配',
  preference: '用户偏好',
  diversity: '多样性',
}

export interface ScoreRow {
  label: string
  value: string
}

const fmtScore = (v: number): string => (Number.isInteger(v) ? `${v}` : v.toFixed(1))

/** 分项行：数字原样来自引擎 scoreBreakdown，不在这里重算 */
export function scoreRows(r: OutfitRecommendation): ScoreRow[] {
  return r.scoreBreakdown.map((b) => ({ label: BUCKET_LABEL[b.key], value: `${fmtScore(b.score)}/${b.max}` }))
}

/** 推荐分不是安全等级：分数只谈匹配度，安全是另一条独立判定线（deck 13） */
export function scoreSafetyNote(r: OutfitRecommendation): { line: string; levelLine: string; rule: string } {
  const n = r.safety.warnings.length
  return {
    line: `${Math.round(r.dayScore)} 分只表示「这套和当前需求有多匹配」。安全是另一条独立的判定线 —— 今天 ${r.safety.level}${n ? `，有 ${n} 条预警` : '，没有预警'}。`,
    levelLine: `安全等级 ${r.safety.level} · 独立于推荐分`,
    rule: '安全规则先执行，分数后计算；风格再合适也不能让防护硬条件失效。',
  }
}

// ===== 为什么不是那件厚的：换上更厚的单件后重算一遍，用引擎分数说话 =====

export interface ThickAlternative {
  rejected: { name: string; clo: number; note: string }
  chosen: { names: string; clo: number; note: string }
}

/**
 * 反事实对比：在「同类更厚且没穿」的件里取最厚的一件，把它换上后重算整套分。
 * 分数反而更低才给结论；结论里的每个数字都来自这次重算，不另造口径。
 */
export function thickAlternative(r: OutfitRecommendation, settings?: UserSettings): ThickAlternative | null {
  const chosen = r.dayOutfit.layers.flatMap((l) => l.items)
  const roles = r.dayOutfit.layers.flatMap((l) => l.items.map((): LayerRole => l.role))
  if (!chosen.length) return null

  const worn = new Set(chosen.map((it) => it.id))
  // 「那件厚的」必须真的比同部位在穿的更厚：肩上没穿这一类（盛夏只有背心短裤）或已经穿着最厚的，都不谈
  const maxWorn = new Map<string, number>()
  chosen.forEach((c, i) => {
    if (roles[i] === 'BASE') return
    maxWorn.set(c.category, Math.max(maxWorn.get(c.category) ?? 0, c.insulationClo))
  })
  const thicker = CATALOG.filter(
    (it) => !worn.has(it.id) && it.insulationClo > (maxWorn.get(it.category) ?? Infinity),
  )
  if (!thicker.length) return null
  const alt = thicker.reduce((a, b) => (b.insulationClo > a.insulationClo ? b : a))

  const need = { requiredClo: r.coverage.requiredClo, designHourTempC: r.facts.designHourTempC }
  const prefs = settings ? resolvePrefs(settings) : neutralPrefs()
  const base = computeAssembly(chosen, roles)
  const baseDetail = engineScoreDetail(base, r.demand.vector, need, prefs)

  const keptIdx = chosen.map((c, i) => (c.category === alt.category ? -1 : i)).filter((i) => i >= 0)
  const altAssembly = computeAssembly(
    [...keptIdx.map((i) => chosen[i]), alt],
    [...keptIdx.map((i) => roles[i]), alt.role],
  )
  const altDetail = engineScoreDetail(altAssembly, r.demand.vector, need, prefs)
  if (altDetail.total >= baseDetail.total) return null

  const bucket = (d: { buckets: ScoreBucket[] }, k: ScoreBucket['key']) =>
    d.buckets.find((b) => b.key === k)?.score ?? 0
  const clauses: string[] = []
  const removableDelta = bucket(altDetail, 'removable') - bucket(baseDetail, 'removable')
  if (removableDelta < 0) {
    clauses.push(
      `它脱不掉，可脱卸分从 ${fmtScore(bucket(baseDetail, 'removable'))} 掉到 ${fmtScore(bucket(altDetail, 'removable'))}`,
    )
  }
  if (altAssembly.effectiveClo > need.requiredClo + 0.05) {
    clauses.push(`有效 ${round1(altAssembly.effectiveClo)} clo 超过所需的 ${need.requiredClo}，回暖会闷`)
  }
  if (bucket(altDetail, 'activity') < bucket(baseDetail, 'activity')) {
    clauses.push(`整件 ${alt.weightGrams} g，活动舒适被压`)
  }
  if (bucket(altDetail, 'protection') < bucket(baseDetail, 'protection')) {
    clauses.push('防护属性不如这套，风和雨的分掉了')
  }
  const note = clauses.slice(0, 2).join('；') || `综合匹配分 ${altDetail.total}，低于这套的 ${baseDetail.total}`

  const stack = chosen.filter((_, i) => roles[i] !== 'BASE')
  const names = (stack.length ? stack : chosen).map((it) => it.name)
  const margin = Math.round((base.effectiveClo - need.requiredClo) * 100) / 100
  return {
    rejected: { name: alt.name, clo: round1(alt.insulationClo), note },
    chosen: {
      names: names.length > 3 ? `${names.slice(0, 3).join(' + ')}…` : names.join(' + '),
      clo: round1(base.effectiveClo),
      note:
        margin >= -0.05
          ? `正好够用${base.removableCount > 0 ? '，还能随时脱' : ''}`
          : `还差 ${Math.abs(margin)} clo，但换上厚的更不划算`,
    },
  }
}

// ===== 设置面板（deck 14）：12 个维度、已改计数、折叠摘要 =====

export const PROFILE_LABEL: Record<BodyProfile, string> = {
  CHILD: '儿童',
  ADULT: '成人',
  ELDERLY: '老年人',
}

export const SENSITIVITY_LABEL: Record<HeatSensitivity, string> = {
  COLD_SENSITIVE: '怕冷',
  NORMAL: '中性',
  HEAT_SENSITIVE: '怕热',
}

export const SWEAT_LABEL: Record<SweatLevel, string> = {
  NO: '否',
  AVERAGE: '一般',
  EASY: '容易',
}

export const PRESENTATION_LABEL: Record<Presentation, string> = {
  MASCULINE: '男性化',
  FEMININE: '女性化',
  NEUTRAL: '中性',
  UNSPECIFIED: '不指定',
}

export const SILHOUETTE_LABEL: Record<Silhouette, string> = {
  FITTED: '合身',
  REGULAR: '常规',
  LOOSE: '宽松',
}

export const COLOR_LABEL: Record<ColorPreference, string> = {
  NEUTRAL: '中性色',
  COOL: '冷色',
  WARM: '暖色',
  BRIGHT: '明亮',
  ANY: '无偏好',
}

/** 界面展示顺序 = 设计稿顺序；成员必须与对应枚举一一对应（§10.1 引擎枚举与界面一致） */
export const PROFILE_ORDER: BodyProfile[] = ['CHILD', 'ADULT', 'ELDERLY']
export const SENSITIVITY_ORDER: HeatSensitivity[] = ['COLD_SENSITIVE', 'NORMAL', 'HEAT_SENSITIVE']
export const SWEAT_ORDER: SweatLevel[] = ['NO', 'AVERAGE', 'EASY']
export const HABIT_ORDER: ExposureHabit[] = ['MAINLY_INDOOR', 'SHORT_OUTDOOR', 'LONG_OUTDOOR']
export const OCCASION_ORDER: Occasion[] = ['DAILY', 'OFFICE', 'SCHOOL', 'SPORT', 'OUTDOOR_WORK', 'FORMAL']
export const STYLE_ORDER: StyleTag[] = [
  'DAILY',
  'COMMUTE',
  'BUSINESS',
  'SPORT',
  'OUTDOOR',
  'STREET',
  'JAPANESE_LOOSE',
  'KOREAN_CLEAN',
]
export const PRESENTATION_ORDER: Presentation[] = ['MASCULINE', 'FEMININE', 'NEUTRAL', 'UNSPECIFIED']
export const SILHOUETTE_ORDER: Silhouette[] = ['FITTED', 'REGULAR', 'LOOSE']
export const COLOR_ORDER: ColorPreference[] = ['NEUTRAL', 'COOL', 'WARM', 'BRIGHT', 'ANY']

/** 暴露习惯的时长刻度（设计稿口径：主要室内 = 户外时长 < 30 分） */
export const HABIT_SUB: Record<ExposureHabit, string> = {
  MAINLY_INDOOR: '< 30 分',
  SHORT_OUTDOOR: '0.5–2 时',
  LONG_OUTDOOR: '> 2 时',
}

/** 12 个维度各自「与默认不同」的判据（顺序 = deck 14 编号 ①—⑫） */
const DIM_CHANGED: ((s: UserSettings) => boolean)[] = [
  (s) => s.profile !== DEFAULT_SETTINGS.profile,
  (s) => s.sensitivity !== DEFAULT_SETTINGS.sensitivity,
  (s) => (s.sweat ?? DEFAULT_SETTINGS.sweat) !== DEFAULT_SETTINGS.sweat,
  (s) => s.activity !== DEFAULT_SETTINGS.activity,
  (s) => (s.exposureHabit ?? DEFAULT_SETTINGS.exposureHabit) !== DEFAULT_SETTINGS.exposureHabit,
  (s) => (s.occasion ?? DEFAULT_SETTINGS.occasion) !== DEFAULT_SETTINGS.occasion,
  (s) => s.outTime !== null,
  (s) => s.homeTime !== null,
  (s) => (s.styles?.length ?? 0) > 0,
  (s) => (s.presentation ?? DEFAULT_SETTINGS.presentation) !== DEFAULT_SETTINGS.presentation,
  (s) => (s.silhouette ?? DEFAULT_SETTINGS.silhouette) !== DEFAULT_SETTINGS.silhouette,
  (s) => (s.colorPreference ?? DEFAULT_SETTINGS.colorPreference) !== DEFAULT_SETTINGS.colorPreference,
]

export interface SettingsCount {
  changed: number
  total: number
}

/** 「已改 N 项 · M 项用默认」；显式填的 07:30 算改（没填才用默认，不能看起来像设过） */
export function settingsChangedCount(s: UserSettings): SettingsCount {
  return { changed: DIM_CHANGED.filter((f) => f(s)).length, total: DIM_CHANGED.length }
}

export function settingsCountLine(s: UserSettings): string {
  const { changed, total } = settingsChangedCount(s)
  return `已改 ${changed} 项 · ${total - changed} 项用默认`
}

/** 折叠行摘要（⑨⑩⑪⑫ 四项；空风格 = 不挑风格，引擎不产生排序信号） */
export function styleSummary(s: UserSettings): string {
  const presentation = s.presentation ?? 'UNSPECIFIED'
  const silhouette = s.silhouette ?? 'REGULAR'
  const color = s.colorPreference ?? 'ANY'
  const styles = s.styles ?? []
  const changed =
    styles.length > 0 || presentation !== 'UNSPECIFIED' || silhouette !== 'REGULAR' || color !== 'ANY'
  const parts = [
    styles.length ? styles.map((x) => STYLE_LABEL[x]).join('、') : '不挑风格',
    PRESENTATION_LABEL[presentation],
    SILHOUETTE_LABEL[silhouette],
    COLOR_LABEL[color],
  ]
  return `${changed ? '当前' : '用默认'}：${parts.join(' · ')}`
}

// ===== 8 个边界状态（设计上必须覆盖，不允许假装确定） =====

export interface AppState {
  id: number
  key: string
  title: string
  body: string
  tone: 'paper' | 'card' | 'blue' | 'pink' | 'ink'
  cta?: string
}

export const STATE_WALL: AppState[] = [
  {
    id: 1,
    key: 'OFFLINE_SNAPSHOT',
    title: '离线 · {n} 小时前的',
    body: '下面是 {clock} 的结果：{layers} + {umbrella}',
    tone: 'paper',
  },
  { id: 2, key: 'SNAPSHOT_STALE', title: '数据太旧了', body: '{n} 分钟没更新，别照它出门', tone: 'pink', cta: '重新获取' },
  {
    id: 3,
    key: 'GEO_DENIED',
    title: '定位被拒 → IP 兜底',
    body: '没拿到精确定位，按{city}估算（城市级）',
    tone: 'card',
    cta: '去设置里允许定位 →',
  },
  { id: 4, key: 'NO_HOURLY', title: '没有逐时预报', body: '「几点脱衣」按 ±6℃ 估的，别太当真', tone: 'blue' },
  { id: 5, key: 'CITY_SWITCHING', title: '正在切到{city}…', body: '上面还是{old}的天气，别急着出门', tone: 'card' },
  { id: 6, key: 'NO_TIMELINE', title: '没有「几点脱衣」的日子', body: '温差小、无保暖层，一天不用加减', tone: 'card' },
  { id: 7, key: 'DANGER', title: '高温橙色 · 别中暑', body: '不用管保暖，重点透气遮阳', tone: 'ink' },
  { id: 8, key: 'COLD_START_FAIL', title: '连不上，也定位不到', body: '没数据就不给结论，不编一个给你', tone: 'card', cta: '手动选城市' },
]

// ===== 首次引导：零索取，先给结论再追问两项 =====

export const ONBOARD = {
  greeting: '我是洋葱君',
  lede: '先不问问题，按默认值算一份。',
  tip: '五项都有默认值，不填也能出结论。带伞按 07:30 / 18:00 估算。',
  askTitle: '这两件改了，结论差很多',
  askActivity: '今天做什么？',
  askSchedule: '几点出门回家？',
  cta: '先看今天的结论 →',
}

// ===== 其它 =====

/** 体感表述（主屏一行） */
export function feelsLikeText(feelsC: number, tempC: number): string {
  const diff = feelsC - tempC
  if (Math.abs(diff) < 1) return `体感 ${fmtTempC(feelsC)} 与气温相当`
  return `体感 ${fmtTempC(feelsC)} ${diff > 0 ? '比气温闷热' : '比气温凉'}`
}

export function humidityLine(percent: number): string {
  return percent < 0 ? '湿度未知' : `湿度 ${Math.round(percent)}%`
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}
