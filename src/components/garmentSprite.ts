// 服装图标雪碧图：24 件 + 洋葱君，手绘墨线（纯黑描边、圆头圆角、贝塞尔圆润折角）
// 全部内联到应用文档里，组件用 <use href="#of-..."/> 引用，
// 通过 CSS 变量 --gf / --gs / --ga 三通道着色；未声明时用图形自带默认色。
// 与图标语义规则绑定：换「穿着状态」只换填充、不换造型（见 GarmentIcon.vue）。
// 来源：设计交付包 onionfit-design-kit.html §02，改动需与设计同步。

export const SPRITE_VIEWBOX = 72

const S = 'stroke="#000000" style="stroke-width:var(--sw,3.5)" stroke-linejoin="round"'
const N = 'fill="none" stroke="#000000"'

export const GARMENT_SPRITE = `
<symbol id="of-base-long" viewBox="0 0 72 72">
  <path d="M26 13L18.9 16.3Q13 19 11 25.1L9.6 29.2Q8 34 12.5 36.3L14 37Q18 39 19.8 35L20.2 34.1Q22 30 22 34.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 34.4Q50 30 51.8 34.1L52.2 35Q54 39 58 37L59.5 36.3Q64 34 62.4 29.2L61 25.1Q59 19 53.2 16.3L46 13C43 19 29 19 26 13Z" fill="var(--gf,#FFFFFF)" ${S}/>
  <path d="M28 13C31 18 41 18 44 13" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <path d="M27 34H45" fill="none" stroke="var(--ga,#00C2A8)" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-base-tee" viewBox="0 0 72 72">
  <path d="M26 14L19.4 17.3Q14 20 12.2 25.8L11.3 28.8Q10 33 14.1 34.8L15.9 35.6Q19 37 20.4 33.9L20.7 33.2Q22 30 22 33.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 33.4Q50 30 51.4 33.2L51.7 33.9Q53 37 56.1 35.6L58 34.8Q62 33 60.7 28.8L59.8 25.8Q58 20 52.6 17.3L46 14C43 20 29 20 26 14Z" fill="var(--gf,#FFFFFF)" ${S}/>
  <path d="M28 14C31 19 41 19 44 14" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-base-vest" viewBox="0 0 72 72">
  <path d="M27 12L23.2 14.8Q20 17 20 20.9L20 50.7Q20 58 27.3 58L44.7 58Q52 58 52 50.7L52 20.9Q52 17 48.9 14.8L45 12C42 19 30 19 27 12Z" fill="var(--gf,#FFFFFF)" ${S}/>
  <path d="M30 12C32 18 40 18 42 12" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-base-brief" viewBox="0 0 72 72">
  <path d="M15 22L57 22L55 41C55 47 51 51 46 51C41 51 38 47.5 37 43.5L36 40L35 43.5C34 47.5 31 51 26 51C21 51 17 47 17 41Z" fill="var(--gf,#FFFFFF)" ${S}/>
  <path d="M16 30H56" ${N} opacity="0.3" stroke-width="2.5" stroke-linecap="round"/>
</symbol>
<symbol id="of-base-pants" viewBox="0 0 72 72">
  <path d="M29.4 12L42.6 12Q50 12 50.2 19.4L51.4 55.3Q51.5 60 46.8 60L45.7 60Q41 60 40.1 55.4L36.8 37.6Q36 33 35.2 37.6L31.9 55.4Q31 60 26.3 60L25.2 60Q20.5 60 20.6 55.3L21.8 19.4Q22 12 29.4 12Z" fill="var(--gf,#FFFFFF)" ${S}/>
  <path d="M22 19H50" ${N} opacity="0.35" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-base-shorts" viewBox="0 0 72 72">
  <path d="M27.5 14L44.5 14Q52 14 52.2 21.4L52.8 38.2Q53 44 47.2 44L45.9 44Q40 44 38.4 38.4L37.4 34.8Q36 30 34.6 34.8L33.6 38.4Q32 44 26.2 44L24.9 44Q19 44 19.2 38.2L19.8 21.4Q20 14 27.5 14Z" fill="var(--gf,#FFFFFF)" ${S}/>
</symbol>

<symbol id="of-ins-sweater" viewBox="0 0 72 72">
  <path d="M26 13L18.9 16.3Q13 19 11 25.1L9.6 29.2Q8 34 12.5 36.3L14 37Q18 39 19.8 35L20.2 34.1Q22 30 22 34.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 34.4Q50 30 51.8 34.1L52.2 35Q54 39 58 37L59.5 36.3Q64 34 62.4 29.2L61 25.1Q59 19 53.2 16.3L46 13C43 19 29 19 26 13Z" fill="var(--gf,#FFCB6B)" ${S}/>
  <path d="M22 50H50" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <path d="M29 22L36 31L43 22" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M28 53V58M36 53V58M44 53V58" ${N} opacity="0.5" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-ins-fleece" viewBox="0 0 72 72">
  <path d="M22 20C22 8 50 8 50 20" fill="var(--gs,#FFB877)" ${S}/>
  <path d="M26 16L18.9 19.3Q13 22 10.8 28.1L9.7 31.3Q8 36 12.5 38.3L14 39Q18 41 19.8 37L20.2 36.1Q22 32 22 36.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 36.4Q50 32 51.8 36.1L52.2 37Q54 41 58 39L59.5 38.3Q64 36 62.3 31.3L61.2 28.1Q59 22 53.2 19.3L46 16C43 22 29 22 26 16Z" fill="var(--gf,#FFB877)" ${S}/>
  <path d="M26 16C31 21 41 21 46 16" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <circle cx="30" cy="39" r="1.8" fill="#000000" opacity="0.45"/><circle cx="42" cy="39" r="1.8" fill="#000000" opacity="0.45"/><circle cx="36" cy="48" r="1.8" fill="#000000" opacity="0.45"/><circle cx="30" cy="53" r="1.8" fill="#000000" opacity="0.45"/><circle cx="42" cy="53" r="1.8" fill="#000000" opacity="0.45"/>
</symbol>
<symbol id="of-ins-downvest" viewBox="0 0 72 72">
  <path d="M27 12L23.2 14.8Q20 17 20 20.9L20 50.7Q20 58 27.3 58L44.7 58Q52 58 52 50.7L52 20.9Q52 17 48.9 14.8L45 12C42 19 30 19 27 12Z" fill="var(--gf,#FFCB6B)" ${S}/>
  <path d="M20 27H52M20 39H52M20 49H52" ${N} opacity="0.55" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-ins-puffer" viewBox="0 0 72 72">
  <path d="M26 13L18.9 16.3Q13 19 11 25.1L9.6 29.2Q8 34 12.5 36.3L14 37Q18 39 19.8 35L20.2 34.1Q22 30 22 34.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 34.4Q50 30 51.8 34.1L52.2 35Q54 39 58 37L59.5 36.3Q64 34 62.4 29.2L61 25.1Q59 19 53.2 16.3L46 13C43 19 29 19 26 13Z" fill="var(--gf,#FFCB6B)" ${S}/>
  <path d="M22 24H50M22 34H50M22 44H50M22 54H50" ${N} opacity="0.5" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <path d="M36 13V58" ${N} opacity="0.5" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-ins-knitvest" viewBox="0 0 72 72">
  <path d="M27 12L23.2 14.8Q20 17 20 20.9L20 50.7Q20 58 27.3 58L44.7 58Q52 58 52 50.7L52 20.9Q52 17 48.9 14.8L45 12C42 19 30 19 27 12Z" fill="var(--gf,#FFB877)" ${S}/>
  <path d="M30 18L36 28L42 18" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M28 33V52M36 33V52M44 33V52" ${N} opacity="0.4" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>

<symbol id="of-pro-windbreaker" viewBox="0 0 72 72">
  <path d="M24 16C24 5 48 5 48 16" fill="var(--gs,#A8C7FF)" ${S}/>
  <path d="M26 15L18.9 18.3Q13 21 11 27.1L9.6 31.2Q8 36 12.5 38.3L14 39Q18 41 19.8 37L20.2 36.1Q22 32 22 36.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 36.4Q50 32 51.8 36.1L52.2 37Q54 41 58 39L59.5 38.3Q64 36 62.4 31.2L61 27.1Q59 21 53.2 18.3L46 15C43 21 29 21 26 15Z" fill="var(--gf,#A8C7FF)" ${S}/>
  <path d="M36 15V58" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <circle cx="36" cy="24" r="2.4" fill="#000000"/>
</symbol>
<symbol id="of-pro-hardshell" viewBox="0 0 72 72">
  <path d="M23 17C23 4 49 4 49 17" fill="var(--gs,#5B7FFF)" ${S}/>
  <path d="M26 15L18.9 18.3Q13 21 11 27.1L9.6 31.2Q8 36 12.5 38.3L14 39Q18 41 19.8 37L20.2 36.1Q22 32 22 36.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 36.4Q50 32 51.8 36.1L52.2 37Q54 41 58 39L59.5 38.3Q64 36 62.4 31.2L61 27.1Q59 21 53.2 18.3L46 15C43 21 29 21 26 15Z" fill="var(--gf,#5B7FFF)" ${S}/>
  <path d="M36 15V58" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <path d="M23 23L30 30M49 23L42 30" fill="none" stroke="var(--ga,#FFD600)" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <rect x="27" y="36" width="8" height="7" rx="2" fill="var(--gs,#FFFFFF)" stroke="#000000" stroke-width="2"/>
</symbol>
<symbol id="of-pro-raincoat" viewBox="0 0 72 72">
  <path d="M24 16C24 4 48 4 48 16" fill="var(--gs,#5B7FFF)" ${S}/>
  <path d="M26 15L18.9 18.9Q13 22 11.9 28.5L7.2 55.3Q6 62 12.8 62L59.2 62Q66 62 64.8 55.3L60.1 28.5Q59 22 53.2 18.9L46 15C43 21 29 21 26 15Z" fill="var(--gf,#5B7FFF)" ${S}/>
  <path d="M36 15V62" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <path d="M19 31C19 31 16 35 16 37.5C16 39.3 17.3 40.5 19 40.5C20.7 40.5 22 39.3 22 37.5C22 35 19 31 19 31Z" fill="var(--gs,#FFFFFF)" stroke="#000000" stroke-width="2.2"/>
  <path d="M55 43C55 43 52 47 52 49.5C52 51.3 53.3 52.5 55 52.5C56.7 52.5 58 51.3 58 49.5C58 47 55 43 55 43Z" fill="var(--gs,#FFFFFF)" stroke="#000000" stroke-width="2.2"/>
</symbol>
<symbol id="of-pro-sunshirt" viewBox="0 0 72 72">
  <path d="M26 14L19.4 17.3Q14 20 12.2 25.8L11.3 28.8Q10 33 14.1 34.8L15.9 35.6Q19 37 20.4 33.9L20.7 33.2Q22 30 22 33.4L22 50.7Q22 58 29.3 58L42.7 58Q50 58 50 50.7L50 33.4Q50 30 51.4 33.2L51.7 33.9Q53 37 56.1 35.6L58 34.8Q62 33 60.7 28.8L59.8 25.8Q58 20 52.6 17.3L46 14C43 20 29 20 26 14Z" fill="var(--gf,#FFF9EC)" ${S}/>
  <circle cx="36" cy="38" r="7" fill="var(--gs,#FFD600)" stroke="#000000" stroke-width="2.5"/>
  <path d="M36 26V30M36 46V50M25 38H29M43 38H47M29 31L32 34M40 42L43 45M43 31L40 34M32 42L29 45" ${N} stroke-width="2.2" stroke-linecap="round"/>
</symbol>
<symbol id="of-pro-coat" viewBox="0 0 72 72">
  <path d="M26 12L18.3 15.3Q12 18 10.5 24.7L8.2 34.7Q7 40 12 42.3L13.2 42.8Q18 45 19.8 40.1L20.4 38.4Q22 34 22 38.6L22 54.7Q22 62 29.3 62L42.7 62Q50 62 50 54.7L50 38.6Q50 34 51.6 38.4L52.2 40.1Q54 45 58.8 42.8L60.1 42.3Q65 40 63.8 34.7L61.5 24.7Q60 18 53.7 15.3L46 12C43 19 29 19 26 12Z" fill="var(--gf,#A8C7FF)" ${S}/>
  <path d="M26 12L36 32L46 12" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M36 32V62" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <circle cx="36" cy="44" r="2.2" fill="#000000"/>
</symbol>

<symbol id="of-acc-scarf" viewBox="0 0 72 72">
  <path d="M31 30L43 30L41 58L33 58Z" fill="var(--gf,#FF4D8D)" ${S}/>
  <path d="M34 58V64M40 58V64" ${N} stroke-width="3" stroke-linecap="round"/>
  <path d="M34 44H41" ${N} opacity="0.4" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M20 15C20 29 27 36 36 36C45 36 52 29 52 15" ${N} stroke-width="15" stroke-linecap="round"/>
  <path d="M20 15C20 29 27 36 36 36C45 36 52 29 52 15" fill="none" stroke="var(--gs,#FF4D8D)" stroke-width="10" stroke-linecap="round"/>
</symbol>
<symbol id="of-acc-glove" viewBox="0 0 72 72">
  <path d="M28 46L28 34C28 24 33 16 40 16C47 16 52 24 52 34L52 46Q52 53 45 53L35 53Q28 53 28 46Z" fill="var(--gf,#FFD600)" ${S}/>
  <path d="M28 38C21 37 17 31 19 26C21 22 27 22 29 26" fill="var(--gf,#FFD600)" ${S}/>
  <rect x="25" y="51" width="30" height="9" rx="3" fill="var(--gs,#FFFFFF)" stroke="#000000" style="stroke-width:var(--sw,3.5)"/>
</symbol>
<symbol id="of-acc-warmer" viewBox="0 0 72 72">
  <rect x="15" y="22" width="42" height="34" rx="11" fill="var(--gf,#FF4D8D)" stroke="#000000" style="stroke-width:var(--sw,3.5)"/>
  <path d="M30 48V39C30 34 33 31 36 31C39 31 42 34 42 39V48" fill="none" stroke="var(--gs,#FFFFFF)" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M33 48V40M39 48V40" fill="none" stroke="var(--gs,#FFFFFF)" stroke-width="3.4" stroke-linecap="round"/>
</symbol>
<symbol id="of-acc-glasses" viewBox="0 0 72 72">
  <rect x="7" y="25" width="26" height="21" rx="10" fill="var(--gf,#000000)" stroke="#000000" style="stroke-width:var(--sw,3.5)"/>
  <rect x="39" y="25" width="26" height="21" rx="10" fill="var(--gf,#000000)" stroke="#000000" style="stroke-width:var(--sw,3.5)"/>
  <path d="M33 31H39" ${N} stroke-width="4" stroke-linecap="round"/>
  <path d="M7 29L1 22M65 29L71 22" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
  <path d="M14 30L21 27" fill="none" stroke="var(--gs,#FFFFFF)" opacity="0.7" style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>
<symbol id="of-acc-sunhat" viewBox="0 0 72 72">
  <path d="M21 42C21 25 27 14 36 14C45 14 51 25 51 42L21 42Z" fill="var(--gf,#FFD600)" ${S}/>
  <path d="M5 44C5 39 18 35 36 35C54 35 67 39 67 44C67 49 54 53 36 53C18 53 5 49 5 44Z" fill="var(--gs,#FFCB6B)" ${S}/>
</symbol>
<symbol id="of-acc-sunscreen" viewBox="0 0 72 72">
  <rect x="25" y="8" width="22" height="10" rx="3" fill="var(--gs,#FFD600)" stroke="#000000" style="stroke-width:var(--sw,3.5)"/>
  <path d="M29.5 18L42.5 18Q50 18 50.4 25.5L52 55C52 58.5 49.5 62 46 62L26 62C22.5 62 20 58.5 20 55L21.6 25.5Q22 18 29.5 18Z" fill="var(--gf,#FFFFFF)" ${S}/>
  <circle cx="36" cy="40" r="7.5" fill="var(--gs,#FFD600)" stroke="#000000" stroke-width="2.5"/>
</symbol>
<symbol id="of-acc-lightvest" viewBox="0 0 72 72">
  <path d="M27 12L23.2 14.8Q20 17 20 20.9L20 50.7Q20 58 27.3 58L44.7 58Q52 58 52 50.7L52 20.9Q52 17 48.9 14.8L45 12C42 19 30 19 27 12Z" fill="var(--gf,#00C2A8)" ${S}/>
  <path d="M36 17V58" ${N} opacity="0.5" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="5 4"/>
</symbol>
<symbol id="of-acc-umbrella" viewBox="0 0 72 72">
  <path d="M36 11C22 11 11 23 8 38L64 38C61 23 50 11 36 11Z" fill="var(--gf,#FFD600)" ${S}/>
  <path d="M8 38C11 42 15 42 18 39C21 43 25 43 28 39C31 43 35 43 36 39C37 43 41 43 44 39C47 43 51 43 54 39C57 43 61 42 64 38" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M36 38V56C36 61 30 62 27 58" ${N} style="stroke-width:var(--sw,3.5)" stroke-linecap="round"/>
</symbol>

<symbol id="of-mascot-onion" viewBox="0 0 140 160">
  <path d="M70 34C70 19 61 9 46 5c4 17 10 25 15 29z" fill="#00C2A8" stroke="#000000" stroke-width="5" stroke-linejoin="round"/>
  <path d="M70 34c0-17 11-27 26-29-6 17-14 25-19 30z" fill="#00C2A8" stroke="#000000" stroke-width="5" stroke-linejoin="round"/>
  <path d="M70 30c31 0 50 33 50 63 0 31-23 50-50 50s-50-19-50-50c0-30 19-63 50-63z" fill="#FFD98A" stroke="#000000" stroke-width="6" stroke-linejoin="round"/>
  <path d="M70 33C58 51 52 72 52 93c0 22 6 39 12 47" ${N} style="stroke-width:var(--sw,3.5)" opacity="0.22"/>
  <path d="M70 33c12 18 18 39 18 60 0 22-6 39-12 47" ${N} style="stroke-width:var(--sw,3.5)" opacity="0.22"/>
  <ellipse cx="51" cy="88" rx="6.5" ry="8.5" fill="#000000"/><ellipse cx="89" cy="88" rx="6.5" ry="8.5" fill="#000000"/>
  <circle cx="53.5" cy="85" r="2.2" fill="#FFFFFF"/><circle cx="91.5" cy="85" r="2.2" fill="#FFFFFF"/>
  <ellipse cx="37" cy="102" rx="9" ry="5.5" fill="#FF4D8D" opacity="0.8"/><ellipse cx="103" cy="102" rx="9" ry="5.5" fill="#FF4D8D" opacity="0.8"/>
  <path d="M59 105q11 11 22 0" ${N} stroke-width="5" stroke-linecap="round"/>
</symbol>
`
