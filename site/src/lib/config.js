// 站点级配置。仓库地址可通过环境变量 AISPARK_REPO 覆盖。
export const SITE = {
  name: 'AiSpark',
  tagline: 'AI 创作的岁月史书',
  repo: globalThis.process?.env?.AISPARK_REPO || 'https://github.com/tianyin231/AiSpark',
  license: 'CC-BY-4.0',
};
