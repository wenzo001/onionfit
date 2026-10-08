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

/** 用户设置 */
export interface UserSettings {
  profile: BodyProfile
  sensitivity: HeatSensitivity
  activity: ActivityKind
  /** HH:mm */
  outTime: string | null
  /** HH:mm */
  homeTime: string | null
}

export const DEFAULT_SETTINGS: UserSettings = {
  profile: 'ADULT',
  sensitivity: 'NORMAL',
  activity: 'WALKING',
  outTime: null,
  homeTime: null,
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
  safety: SafetyReport
  dayScore: number
  reasons: ReasonCode[]
}