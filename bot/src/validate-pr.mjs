// 用法：node src/validate-pr.mjs --base <ref> --head <ref> [--report <file>]
// 退出码：0 校验通过；1 校验未通过；2 不是作品投稿（不自动合并）；3 运行错误
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { checkSubmission, formatReport } from './rules.mjs';
import { diffChanges, lsTree, readText, hasPath } from './git.mjs';

const { values } = parseArgs({
  options: { base: { type: 'string' }, head: { type: 'string' }, report: { type: 'string' } },
});
if (!values.base || !values.head) {
  console.error('需要 --base 与 --head');
  process.exit(3);
}

try {
  const { base, head } = values;
  const changes = diffChanges(base, head);
  const newDirs = [...new Set(
    changes
      .map((c) => /^artifacts\/\d{4}\/\d{2}\/[^/]+(?=\/)/.exec(c.path)?.[0])
      .filter(Boolean),
  )];
  const headTree = newDirs.flatMap((d) => lsTree(head, d));

  const result = checkSubmission({
    changes,
    headTree,
    readText: (p) => readText(head, p),
    baseHasDir: (d) => hasPath(base, d),
  });

  const report = formatReport(result);
  if (values.report) writeFileSync(values.report, report);
  console.log(report);
  process.exit(result.kind === 'not-submission' ? 2 : result.ok ? 0 : 1);
} catch (e) {
  console.error(e);
  process.exit(3);
}
