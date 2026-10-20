import { defineConfig } from 'astro/config';

// 部署到 GitHub Pages 子路径时设置 AISPARK_BASE=/仓库名/
export default defineConfig({
  site: process.env.AISPARK_SITE || 'https://example.github.io',
  base: process.env.AISPARK_BASE || '/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
