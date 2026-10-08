// 分段选项类型（SegmentedPicker 与其调用方共用）
export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
}
