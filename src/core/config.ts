// ===== 穿搭算法配置（集中管理全部阈值/系数，避免参数散落引擎内） =====

/**
 * 热舒适（Thermal）
 * requirements：目标皮温、代谢基准、对流/风因子、辐射增益、clo 与温度的关系
 */
export const THERMAL = {
  /** 静坐舒适中性温度 ℃ */
  neutralTempC: 22,
  /**
   * 每 1 clo 对应的可承受温差跨度。
   * 6.5 会把 0℃ 的静坐需求推到 3.4 clo（远超任何合理着装），改为 12 后
   * 0℃ ≈ 1.8 clo、-10℃ ≈ 2.7 clo，与 ISO 9920 的组合热阻量级一致。
   */
  cloPerDegree: 12,
  /** 太阳辐射增益系数：每 W/m² 抬升作用温度 ℃（约 600 W/m² 晴天 → +3.6℃） */
  radiantGainCoeff: 0.006,
  /** 辐射增益上限 ℃（防失真） */
  radiantGainMaxK: 5,
  /** 风寒启动阈值 ℃ */
  windChillOnsetC: 10,
  /** 湿度负载启动阈值 ℃（仅高温侧加载） */
  humidityOnsetC: 26,
  /** 湿度负载系数：每 10%RH 高于基准的升温 */
  humidityPer10: 0.6,
  /** 温湿度基准：湿度 40% 视为中性 */
  humidityBaseline: 40,
  /** 活动基础代谢抬升：每 MET 偏移的保暖需求 clo 降幅 */
  metabolicOffsetPerMet: 4,
}

/**
 * 太阳（Solar）
 */
export const SOLAR = {
  /** 防晒需求启动的 UV 指数 */
  uvOnset: 3,
  /** 遮阳需求满值的 UV 指数 */
  uvFull: 8,
  /** 日出/日落兜底（缺数据时） */
  fallbackSunrise: '06:30',
  fallbackSunset: '18:30',
}

/**
 * 人体与偏好（Person）
 * 冷热偏好偏移（deg），对应 PreferenceConfig 与 AgeProfileConfig
 * 偏移直接作用于"个体中性温度"：值越高 → 同样气温下觉得更冷 → 需更多保暖
 */
export const PREFERENCE_OFFSET: Record<'COLD_SENSITIVE' | 'NORMAL' | 'HEAT_SENSITIVE', number> = {
  COLD_SENSITIVE: 2.0, // 怕冷：中性温度更高 → 同温下需更多保暖
  NORMAL: 0,
  HEAT_SENSITIVE: -1.5, // 怕热：中性温度更低 → 同温下穿更少
}

/** 人群热特征：怕冷敏感档（相对成人偏移） */
export const AGE_PROFILE: Record<
  'CHILD' | 'ADULT' | 'ELDERLY',
  { coldOffsetK: number; heatOffsetK: number; sunSensitivity: number }
> = {
  CHILD: { coldOffsetK: 1.8, heatOffsetK: 0.8, sunSensitivity: 1.3 },
  ADULT: { coldOffsetK: 0, heatOffsetK: 0, sunSensitivity: 1 },
  ELDERLY: { coldOffsetK: 2.5, heatOffsetK: 0.5, sunSensitivity: 1.1 },
}

/**
 * 活动（Activity）：代谢与暴露
 */
export const ACTIVITY: Record<
  string,
  { met: number; selfWindMs: number; sunExposure: number; rainExposure: number }
> = {
  HOME: { met: 1.0, selfWindMs: 0, sunExposure: 0.2, rainExposure: 0 },
  OFFICE: { met: 1.1, selfWindMs: 0, sunExposure: 0.1, rainExposure: 0 },
  CLASS: { met: 1.2, selfWindMs: 0, sunExposure: 0.2, rainExposure: 0 },
  WALKING: { met: 2.2, selfWindMs: 0.6, sunExposure: 0.8, rainExposure: 0.8 },
  CYCLING: { met: 4.2, selfWindMs: 4.0, sunExposure: 1.0, rainExposure: 1.0 },
  RUNNING: { met: 6.5, selfWindMs: 3.0, sunExposure: 1.0, rainExposure: 0.9 },
  OUTDOOR_WORK: { met: 3.5, selfWindMs: 0.4, sunExposure: 1.0, rainExposure: 1.0 },
  OUTDOOR_LEISURE: { met: 2.4, selfWindMs: 0.6, sunExposure: 0.9, rainExposure: 0.9 },
  DRIVING: { met: 1.4, selfWindMs: 0.2, sunExposure: 0.5, rainExposure: 0.6 },
}

/**
 * 六维需求（Demand）
 */
export const DEMAND = {
  /** 保暖：需要的 clo 与中性 clo 的差值 → 0-100 */
  warmthFullCloDiff: 1.6,
  /** 防风：风速阈值 m/s */
  windOnsetMs: 4,
  windFullMs: 12,
  /** 防雨：降水概率阈值 % */
  rainChanceOnset: 30,
  rainChanceFull: 85,
  /** 雨量阈值 mm/h */
  rainMmOnset: 0.5,
  rainMmFull: 4,
  /** 透气：高温启动 ℃ */
  breathabilityOnsetC: 25,
  breathabilityFullC: 33,
  /** 可脱卸：昼夜温差启动 ℃ */
  removableOnsetDiff: 8,
  removableFullDiff: 16,
  /**
   * 通勤暴露窗口内的降水可以把防雨需求抬到的下限（0-100）。
   * 「室内」只降低雨暴露权重，不等于完全不经过户外：窗口内有雨时不能让防雨需求归零，
   * 否则会出现「带伞判定让人带伞、穿衣判定说不用防水」的自相矛盾。
   */
  commuteRainFloor: 40,
  /** 抬到下限所需的窗口内最大整点降水概率 % */
  commuteRainFloorChance: 40,
  /** 贴身层目标 clo 的保暖刻度：缺口达此 clo 时贴身层份额取满 */
  baseTargetScaleClo: 3.0,
}

/**
 * 分层（Layering）
 */
export const LAYERING = {
  /** 最大槽位数：贴身上装 + 贴身下装 + 双保暖 + 防护 */
  maxLayers: 5,
  /** 保暖缺口（未封顶 clo）达此值开第一个保暖槽 */
  firstInsulationClo: 0.55,
  /** 保暖缺口达此值开第二个保暖槽；layering 真正读取此值（改它就改行为） */
  secondInsulationClo: 1.1,
  /** 第二保暖槽的衣物 clo 下限 */
  secondInsulationMinClo: 0.3,
  /** 第一保暖槽的衣物 clo 下限档位，按缺口落在 insulationTierBandsC 的哪一段取 */
  insulationMinCloTiers: [0.25, 0.42, 0.6, 0.8],
  insulationTierBandClo: [1.0, 1.8, 2.6],
  /** 缺口达此 clo 时，厚外套（防护层里 clo ≥ warmOuterwearMinClo 的件）可作为保暖使用 */
  warmOuterwearClo: 2.0,
  warmOuterwearMinClo: 1.0,
  /** 缺口达此 clo 时即使无风无雨也必须有一个外层（锁暖 + 挡风），不再只靠叠中间层 */
  forcedOuterwearClo: 1.8,
  /** 层间 clo 递减系数：同一角色的第二件起打折（含贴身下装） */
  layerDiminish: 0.85,
}

/**
 * 候选池与联合搜索（Matching）
 */
export const MATCHING = {
  /** 每槽按拟合分初筛保留的候选数 */
  poolPerSlot: 6,
  /** 联合搜索的 beam 宽度：每槽扩展后保留的路径数 */
  beamWidth: 32,
  /** 每槽额外保留的最厚合格候选数：贴合排序天然偏好"差值最小"，需要把"用厚度补缺口"摆上桌 */
  thickRescuePerSlot: 2,
}

/**
 * 反季准入（ComfortFit）：设计时刻超出衣物舒适窗这个容忍度 → 季节不对，不进候选。
 * 外壳槽豁免：防雨防风是安全属性，优先于季节舒适。
 */
export const COMFORT_FIT = {
  coldTolC: 6,
  warmTolC: 6,
}

/**
 * 上下装协调（Coordination）：天冷却下装过薄 → 上面像冬天、下面像夏天，扣分
 */
export const COORDINATION = {
  /** 设计时刻低于此温度开始要求下装保暖分额 */
  legOnsetC: 12,
  /** 每低 1℃ 要求增加的下装 clo */
  legCloPerDegree: 0.03,
  /** 下装分额上限（一件加绒长裤量级） */
  legMaxClo: 0.32,
  /** 每缺 1 clo 下装保暖扣的分数 */
  legPenaltyPerClo: 60,
}

/** 数据质量 → 置信度：覆盖判定不能把合成曲线声称成实测精度 */
export const DATA_QUALITY = {
  withHourly: 1,
  synthetic: 0.4,
}

/** 地理与气候上下文（方案 §4）：只用天气源已有位置字段；缺位置就降置信度、不猜气候带 */
export const GEO = {
  /** 天气源带有效位置（lat/lon）时的地理层置信度 */
  confidenceWithLocation: 1,
  /** 位置缺失时的地理层置信度：半球 / 季节无法判断，退通用模型 */
  confidenceWithoutLocation: 0.5,
}

/** 覆盖判定分档：衣物库撑不住时要如实说不够 */
export const COVERAGE = {
  /**
   * 库容量缺口达到 min(绝对 clo, 需求×比例) 即判"库不够用"。
   * 0.4 ≈ 一件轻中层的暖量：差不到一件薄毛衣，报"勉强够"比报"不够"更诚实；
   * 差得出一件像样的衣服（交付包："缺 0.8 clo ≈ 少一件厚羽绒/加绒长裤"）就必须说不够。
   */
  insufficientDeficitClo: 0.4,
  insufficientDeficitRatio: 0.4,
  /** 这套比需求薄超过此数 → 不能算 adequate */
  shortfallClo: 0.05,
  /** 勉强撑住、余量不足此数 → marginal（"刚好够，没有余量"）；需求低于 warmDayClo 视为热天，不按余量降级 */
  marginalMarginClo: 0.2,
  warmDayClo: 0.3,
}

/**
 * 安全（Safety）
 */
export const SAFETY = {
  /** 温度预警阈值 */
  dangerHeatC: 35,
  dangerColdC: -10,
  watchHeatC: 33,
  watchColdC: -5,
  /** 风速预警 m/s */
  dangerWindMs: 15,
  watchWindMs: 10,
  /** 强降雨 mm/h */
  dangerRainMm: 8,
  watchRainMm: 4,
}

/**
 * 带伞判定（Umbrella）
 * cost-loss 模型：只有当被淋概率超过 100/(1+lossRatio) 时，带伞的预期损失才低于白背一天
 */
export const UMBRELLA = {
  /** 淋湿损失 : 白背一把伞的代价。3 → 决策阈值 25% */
  lossRatio: 3,
  /** 单次户外暴露时长 min（到车站/停车场的量级），按活动取值；缺失回落 WALKING */
  legMinutes: {
    HOME: 3,
    OFFICE: 12,
    CLASS: 12,
    WALKING: 18,
    CYCLING: 15,
    RUNNING: 8,
    OUTDOOR_WORK: 10,
    OUTDOOR_LEISURE: 12,
    DRIVING: 4,
  } as Record<string, number>,
  /** 兜底出门时刻 07:30（自午夜起分钟数） */
  fallbackOutMinutes: 450,
  /** 兜底回家时刻 18:00（自午夜起分钟数） */
  fallbackHomeMinutes: 1080,
  /** 伞在大风下失效的风速阈值 m/s */
  windVetoMs: 12,
  /**
   * 降水持续因子 0-1：整点降水概率指「这一小时下过雨」，雨不会只精确下在你步行那几分钟。
   * 1 = 有雨的小时全程在下（窗口概率=整点概率）；0 = 雨只占该小时 w 的宽度。
   * 0.6 对应雷达回波动辄持续 30-60min、而通勤窗口只有十几分钟。
   */
  rainPersistence: 0.6,
}

/**
 * 评分权重（合计 1.0）
 */
export const SCORING = {
  weights: {
    warmth: 0.3,
    wind: 0.15,
    water: 0.15,
    breathability: 0.15,
    weight: 0.1,
    removable: 0.1,
    solar: 0.05,
  },
  /** 欠暖惩罚（每差 1 clo 扣的分数）：穿少会冷，罚得比过暖重得多 */
  underWarmPenalty: 90,
  /** 过暖惩罚（每多 1 clo 扣的分数） */
  overWarmPenalty: 25,
  /** 过暖惩罚上限（防失真） */
  overWarmMaxPenalty: 30,
}