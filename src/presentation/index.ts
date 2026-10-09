// presentation：唯一负责把算法结论翻译成人话的文案层。
// 只消费结构化结果与 ReasonCode / 事实数字，不参与任何决策（硬约束：文案与决策分离）。
// 全部措辞对齐设计交付包 §05 文案表：已压缩过一轮，去掉「因为 / 记得 / 别忘」等口头语，数字一律保留。

import type {
  Accessory,
  ApparelLayer,
  DemandDim,
  DemandVector,
  DayPart,
  HourlyEnvironment,
  OutfitAssembly,
  OutfitRecommendation,
  ReasonCode,
  RecommendationFacts,
  SafetyReport,
  TimelineEvent,
  UmbrellaAssessment,
  UmbrellaLeg,
  UmbrellaVerdict,
  WeatherDay,
  WeatherKind,
} from '@/core/types'
import { localHourOf } from '@/core/engine/weather'

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
