import { defineConfig, presetUno, presetAttributify, presetIcons, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({ scale: 1.2, warn: true }),
  ],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      paper: '#FFF5E1',
      ink: '#000000',
      orange: '#FF6B35',
    },
  },
  // 墨线卡：白底 + 3px 黑边 + 8px 圆角 + 硬阴影（绝不用模糊投影）
  shortcuts: {
    'ink-card':
      'rounded-[8px] border-[3px] border-black bg-white shadow-[4px_4px_0_#000] p-4 text-[#1A1A1A]',
  },
})
