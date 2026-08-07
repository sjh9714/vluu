import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'photos-src/**', 'public/media/**'] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // 파생물을 직접 구워 <img srcset>으로 서빙하므로 next/image 권고는 해당 없음.
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
