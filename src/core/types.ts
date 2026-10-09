// ===== OnionFit 领域模型（纯类型，无逻辑，被 data/core 共享） =====

/** 天气现象类别 */
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow' | 'thunder' | 'fog'

/** 逐小时环境（对应 requirements HourlyEnvironment） */
export interface HourlyEnvironment {
  /** 当地时区整点 ISO 时间 */
  time: string
  temperatureC: number
  humidityPercent: number
  windSpeedMs: number
  windDirectionDeg: number
  /** 雨量 mm/h */
  precipitationMmPerHour: number
  /** -1 = 未知 */
  precipitationProbabilityPercent: number
  kind: WeatherKind
  /** -1 = 未知 */
  cloudCoverPercent: number
  /** -1 = 未知 */
  uvIndex: number
  /** -1 = 未知，W/m² */
  solarRadiationWm2: number
  solarElevationDeg: number
  isDay: boolean
  vaporPressureHpa: number
  /** 上游自身体感（apparent_temperature） */
  sourceFeelsLikeC: number
  /** 是否来自预报（非估算） */
  fromForecast: boolean
}

/** 单天概要 */
export interface WeatherDay {
  date: string
  minC: number
  maxC: number
  dayKind: WeatherKind
  sunrise: string
  sunset: string
  rainMm: number
  rainChancePercent: number
  uvMax: number
}

/** 天气报告（Provider 统一产出） */
export interface WeatherReport {
  lat: number
  lon: number
  timezone: string
  /** ISO 生成时刻 */
  generatedAt: string
  cityName?: string
  current: {
    temperatureC: number
    feelsLikeC: number
    humidityPercent: number
    windSpeedMs: number
    precipitationProbabilityPercent: number
    condition: WeatherKind
    isDay: boolean
  }
  /** 24h 逐时 */
  hourly: HourlyEnvironment[]
  /** forecast_days=2 */
  daily: [WeatherDay, WeatherDay]
  source: 'open-meteo' | 'qweather'
  hasHourlyForecast: boolean
}

// ===== 人群与偏好 =====

export type BodyProfile = 'CHILD' | 'ADULT' | 'ELDERLY'
export type HeatSensitivity = 'COLD_SENSITIVE' | 'NORMAL' | 'HEAT_SENSITIVE'

/** 风格（第四步，可多选；空 = 无偏好，不参与排序） */
export type StyleTag =
  | 'DAILY'
  | 'COMMUTE'
  | 'BUSINESS'
  | 'SPORT'
  | 'OUTDOOR'
  | 'STREET'
  | 'JAPANESE_LOOSE'
  | 'KOREAN_CLEAN'

/** 穿搭呈现：只影响款式与配色候选，不改变天气事实与安全判定 */
export type Presentation = 'MASCULINE' | 'FEMININE' | 'NEUTRAL' | 'UNSPECIFIED'

/** 版型偏好 */
export type Silhouette = 'FITTED' | 'REGULAR' | 'LOOSE'

/** 色彩偏好 */
export type ColorPreference = 'NEUTRAL' | 'COOL' | 'WARM' | 'BRIGHT' | 'ANY'

/** 场合：约束正式程度与功能需求 */
export type Occasion = 'DAILY' | 'OFFICE' | 'SCHOOL' | 'SPORT' | 'OUTDOOR_WORK' | 'FORMAL'

/** 暴露习惯：决定暴露时长与风雨防护的权重 */
export type ExposureHabit = 'MAINLY_INDOOR' | 'SHORT_OUTDOOR' | 'LONG_OUTDOOR'

/** 易出汗：提高排湿 / 速干 / 备用贴身层偏好，不抵消防寒 */
export type SweatLevel = 'NO' | 'AVERAGE' | 'EASY'

/** 目录侧的呈现标签（unisex = 人人可穿的中性款） */
export type PresentationStyle = 'MASCULINE' | 'FEMININE' | 'UNISEX'

/** 色彩分组：目录标签与用户偏好共用同一组 */
export type ColorGroup = 'NEUTRAL' | 'COOL' | 'WARM' | 'BRIGHT'

/** 反馈闭环（方案 §6.1）：只小步调整、设上下限、可撤销；单次反馈不改安全阈值与天气事实 */
export type FeedbackKind = 'COLD' | 'HOT' | 'STUFFY' | 'OFF_OCCASION' | 'JUST_RIGHT'

export interface FeedbackEntry {
  kind: FeedbackKind
  /** ISO 记录时刻（追加式历史，撤销即删除对应条目） */
  at: string
}

/** 活动强度（requirements 9 类） */
export type ActivityKind =
  | 'HOME'
  | 'OFFICE'
  | 'CLASS'
  | 'WALKING'
  | 'CYCLING'
  | 'RUNNING'
  | 'OUTDOOR_WORK'
  | 'OUTDOOR_LEISURE'
  | 'DRIVING'

/** 用户设置：既有四维之外全部可选，缺省值中性（不改也能拿到结论） */
export interface UserSettings {
  profile: BodyProfile
  sensitivity: HeatSensitivity
  activity: ActivityKind
  /** HH:mm */
  outTime: string | null
  /** HH:mm */
  homeTime: string | null
  /** 风格（可多选；空数组 = 无偏好） */
  styles?: StyleTag[]
  presentation?: Presentation
  silhouette?: Silhouette
  colorPreference?: ColorPreference
  occasion?: Occasion
  exposureHabit?: ExposureHabit
  sweat?: SweatLevel
  /** 反馈历史（追加式；派生偏好有上下限、可撤销） */
  feedbackHistory?: FeedbackEntry[]
}

export const DEFAULT_SETTINGS: UserSettings = {
  profile: 'ADULT',
  sensitivity: 'NORMAL',
  activity: 'WALKING',
  outTime: null,
  homeTime: null,
  styles: [],
  presentation: 'UNSPECIFIED',
  silhouette: 'REGULAR',
  colorPreference: 'ANY',
  occasion: 'DAILY',
  exposureHabit: 'SHORT_OUTDOOR',
  sweat: 'AVERAGE',
  feedbackHistory: [],
}

// ===== 城市与应用快照 =====

export interface CityInfo {
  id: string
  name: string
  lat: number
  lon: number
  /** 国家/地区 */
  country?: string
  admin1?: string
}

export interface AppSnapshot {
  city: CityInfo
  weather: WeatherReport | null
  settings: UserSettings
  updatedAt: string
}

// ===== 穿搭推荐模型（对应 requirements 7.4） =====

/** 层角色：BASE 贴身 / INSULATION 保温 / PROTECTION 防护 */
export type LayerRole = 'BASE' | 'INSULATION' | 'PROTECTION'
export type Category = 'TOP' | 'BOTTOM' | 'OUTER'

/** 服装目录条目（clo 参照 ISO 9920 量级 0.06–1.20） */
export interface ClothingItem {
  id: string
  name: string
  category: Category
  role: LayerRole
  /** 保暖热阻 clo */
  insulationClo: number
  /** 防风 0–1 */
  wind: number
  /** 防水 0–1 */
  water: number
  /** 透气 0–1 */
  breathability: number
  /** 遮阳 0–1 */
  solar: number
  weightGrams: number
  removable: boolean
  /** 舒适温度窗口 [min, max] */
  comfortRangeC: [number, number]
  /** 硬壳等级 0-3（3 = 可防暴雨大风） */
  shellGrade?: number
  // ---- 第四步软排序标签（全部为 curated 估算；缺失按中性回退，不参与硬过滤） ----
  /** 风格标签 */
  styles?: StyleTag[]
  /** 正式程度 0-1 */
  formality?: number
  /** 呈现标签 */
  presentation?: PresentationStyle[]
  /** 廓形 */
  silhouettes?: Silhouette[]
  /** 色彩分组 */
  colors?: ColorGroup[]
}

/** 需要向量的六维 */
export type DemandDim = 'WARMTH' | 'WIND' | 'RAIN' | 'BREATHABILITY' | 'SOLAR' | 'REMOVABLE'
export type DemandVector = Record<DemandDim, number> // 0-100

export const DEMAND_DIMS: DemandDim[] = [
  'WARMTH',
  'WIND',
  'RAIN',
  'BREATHABILITY',
  'SOLAR',
  'REMOVABLE',
]

/** 原因代码（只保留实际会产生的，避免死 code） */
export type ReasonCode = string

/** 单层建议 */
export interface ApparelLayer {
  role: LayerRole
  /** 该层选择理由（由 presentation 按 code 翻译） */
  noteCode?: ReasonCode
  /** 此刻是否穿着（false = 带着但此刻不穿，淡显） */
  active: boolean
  items: ClothingItem[]
}

/** 一套全天穿搭组合 */
export interface OutfitAssembly {
  layers: ApparelLayer[]
  nominalClo: number
  effectiveClo: number
  wind: number
  water: number
  breathability: number
  solar: number
  weightGrams: number
  removableCount: number
}

export type AccessoryKind =
  | 'SCARF'
  | 'GLOVES'
  | 'SUNGLASSES'
  | 'SPARE_TEE'
  | 'HAT'
  | 'SUNSCREEN'
  | 'HAND_WARMER'
  | 'AIRY_VEST'

export interface Accessory {
  kind: AccessoryKind
  label: string
  reasonCode?: ReasonCode
}

// ===== 带伞判定（UmbrellaEngine 产出，UI 消费） =====

export type UmbrellaVerdict = 'BRING' | 'RAINCOAT' | 'SKIP'

/** 一次户外暴露窗口（出门段 / 回家段 / 两段都已过去时的此刻段） */
export interface UmbrellaLeg {
  phase: 'OUT' | 'HOME' | 'NOW'
  /** 起始时刻 HH:mm */
  start: string
  /** 暴露时长 min */
  minutes: number
  /** 该段被淋到的概率 0-100 */
  probability: number
}

export interface UmbrellaAssessment {
  /** 通勤时段至少一段被淋到的概率 0-100 */
  probability: number
  verdict: UmbrellaVerdict
  /** cost-loss 决策阈值 % */
  threshold: number
  legs: UmbrellaLeg[]
  /** 暴露窗口内风速峰值 m/s */
  windMs: number
  /** 暴露窗口内最大雨强 mm/h */
  rainMmPerHour: number
  /** HOURLY = 有逐时预报；DEGRADED = 只能按全天概率估算 */
  confidence: 'HOURLY' | 'DEGRADED'
  /** 通勤时刻是否来自兜底（用户未设置） */
  assumed: boolean
  reasons: ReasonCode[]
}

export type SafetyLevel = 'NORMAL' | 'WATCH' | 'DANGER'

export interface SafetyReport {
  level: SafetyLevel
  warnings: string[]
  forcedDemands: Partial<DemandVector>
}

/** 时段建议（一天三段，早/午/晚）：ScheduleEngine 产出，界面按段呈现 */
export interface DayPart {
  phase: 'morning' | 'noon' | 'evening'
  label: string
  startHour: number
  endHour: number
  avgTemp: number
  advice: string
}

export interface TimelineEvent {
  hour: string
  action: 'ADD' | 'REMOVE'
  role: LayerRole
  layerLabel: string
}

/** 全天事实快照：界面标注需求维度单位用（只是已算出的数字透传，不参与任何决策） */
export interface RecommendationFacts {
  dayMinC: number
  dayMaxC: number
  /** 昼夜温差 */
  dayRangeC: number
  windMaxMs: number
  /** 全天累计雨量 mm */
  dayRainMm: number
  /** 全天最大 UV，-1 = 未知 */
  dayUvMax: number
  /** 设计时刻（全天最需保暖的那个小时）的气温 */
  designHourTempC: number
  /** 设计时刻那一刻的风速（不是全天最大值，界面说「最冷的 6 点 + 大风」时要用它） */
  designHourWindMs: number
  /** 活动带来的雨暴露系数 0-1，0 = 全程室内 */
  rainExposure: number
  hasHourly: boolean
}

/** 衣物库对当前场景的覆盖判定：不够就说不够，不伪装成合格推荐 */
export type CoverageStatus = 'adequate' | 'marginal' | 'insufficient' | 'unknown'

export interface CoverageReport {
  status: CoverageStatus
  /** 未封顶的保暖缺口（clo，设计时刻所需） */
  requiredClo: number
  /** 这套组合实际能给的有效保暖（clo） */
  availableClo: number
  /** 同样槽位结构下，衣物库最多能凑到的有效保暖（clo） */
  capacityClo: number
  /** 这套差多少 clo，>=0（用户能听懂的说法：今天这套偏薄） */
  deficitClo: number
  /** 库里根本差多少 clo，>=0（另一回事：需要补衣服） */
  catalogDeficitClo: number
  /** 数据置信度 0-1（缺逐时时不能声称精确） */
  confidence: number
  /** 未满足的硬条件 code（含被放宽的槽位约束） */
  unmetNeeds: ReasonCode[]
}

/** 雨具两件事：穿与带分开给结论，但引用同一组暴露事实 */
export interface RainPlan {
  facts: {
    /** 通勤暴露窗口内最大的整点降水概率 % */
    commuteMaxLegChance: number
    /** 窗口内最大雨强 mm/h */
    commuteMaxLegMmPerHour: number
    dayRainMm: number
    windMaxInCommuteMs: number
  }
  /** 携带结论，与 umbrella.verdict 同一条判定线 */
  carry: UmbrellaVerdict
  /** 是否需要真的穿上防水外壳 / 雨衣 */
  wearShell: boolean
  reasons: ReasonCode[]
}

/**
 * 地理与气候上下文（方案 §4，第三步）：
 * 字段按当前天气源能力裁剪——只消费 lat/lon/timezone；气候带 / 海拔 / 沿海修正
 * 留待数据源能提供对应气象字段缺失场景时再启用，不在此处凭空推断。
 */
export interface GeoClimateContext {
  latitude: number | null
  longitude: number | null
  timezone: string | null
  /** 南北半球（由纬度符号判断；赤道或位置缺失为 unknown） */
  hemisphere: 'north' | 'south' | 'unknown'
  /** 气象季节（月份 + 半球；无法判断时 unknown） */
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'unknown'
  /** 地理层数据来源：forecast = 天气源自带位置；fallback = 位置缺失的通用模型 */
  dataSource: 'forecast' | 'fallback'
  /** 地理层置信度 0-1，与数据质量置信度相乘后进入 coverage.confidence */
  confidence: number
  /** 缺失的输入清单（如 ['location']），供降级展示与解释 */
  missingInputs: string[]
}

/** 推荐分分项（方案 §7.3；多样性 3 分留待第五步的稳定性一起落地） */
export interface ScoreBucket {
  key: 'warmth' | 'protection' | 'activity' | 'style' | 'coordination' | 'removable' | 'preference'
  score: number
  max: number
}

/** 推荐结论（planner 唯一输出，UI 消费） */
export interface OutfitRecommendation {
  current: {
    temperatureC: number
    feelsLikeC: number
    condition: WeatherKind
    isDay: boolean
    humidityPercent: number
    windSpeedMs: number
    precipitationProbability: number
  }
  demand: {
    vector: DemandVector
    /** 六维各自触发的说明 code */
    reasons: Partial<Record<DemandDim, ReasonCode[]>>
  }
  thermal: {
    /** 作用温度 */
    operativeC: number
    feelsLikeC: number
    windChillK: number
    humidityLoadK: number
    /** 当前所需内在 clo */
    requiredIntrinsicClo: number
    /** 全天最大所需 clo 的整点（设计时刻） */
    maxRequiredCloHour: number
    requiredMaxClo: number
  }
  dayOutfit: OutfitAssembly
  nowOutfit: OutfitAssembly
  wornNowCount: number
  wornNowRoles: LayerRole[]
  /** 全天事实（界面标注单位用） */
  facts: RecommendationFacts
  periods: DayPart[]
  timeline: TimelineEvent[]
  accessories: Accessory[]
  /** 今天出门带不带伞 */
  umbrella: UmbrellaAssessment
  /** 穿雨衣 / 带伞两条结论共用的事实 */
  rainPlan: RainPlan
  /** 衣物库够不够用（方案 §5.2） */
  coverage: CoverageReport
  safety: SafetyReport
  /** 地理与气候上下文（方案 §4，第三步） */
  geo: GeoClimateContext
  dayScore: number
  /** dayScore 的分项构成（第四步，方案 §7.3） */
  scoreBreakdown: ScoreBucket[]
  reasons: ReasonCode[]
}