// 站点级配置。仓库地址在正式建仓后通过环境变量 AISPARK_REPO 指定。
export const SITE = {
  name: 'AiSpark',
  tagline: 'AI 创作的岁月史书',
  repo: globalThis.process?.env?.AISPARK_REPO || 'https://github.com/aispark/aispark-archive',
  license: 'CC-BY-4.0',
};
