// 分段选项类型（SegmentedPicker 与其调用方共用）
export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
  /** 第二行小字（如暴露习惯的时长刻度）；不传则单行 */
  sub?: string
}
