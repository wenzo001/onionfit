// 共享时钟：界面所有「现在几点」与「此刻穿几层」都读这一份，每分钟自己走
// 设计交付包 §08 把「结论随时刻自动刷新」列为当前缺口：算法已能按 now 剔除过去的通勤段，
// 但只在重拉数据或改设置时重算。plan() 的 now 本来就是入参，这里把它接成活的。
import { ref } from 'vue'

const TICK_MS = 30_000

const now = ref(new Date())

setInterval(() => {
  now.value = new Date()
}, TICK_MS)

export function useNow() {
  return now
}

/** 本机时区的当前整点（0–23） */
export function hourOf(d: Date): number {
  return d.getHours()
}
