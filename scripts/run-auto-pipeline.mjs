#!/usr/bin/env node
// 幕1〜4(researcher/director/producer/inspector相当)をGemini APIだけで再現する
// 自動実行のエントリーポイント。.github/workflows/auto-company-post.yml から呼ばれる。
//
// 使い方:
//   node scripts/run-auto-pipeline.mjs          … 本番実行(GEMINI_API_KEY・gh認証が必要)
//   node scripts/run-auto-pipeline.mjs --mock   … 何も呼ばず固定データで流れを確認する(テスト用)
//
// 出力: work/<slug>/slides.json, work/<slug>/inspection.md(合格時のみ)
//       $GITHUB_OUTPUT に published/slug/dir/issue_number を書く(GitHub Actions上のみ)
import fs from 'node:fs';
import path from 'node:path';

import { pickTopic } from './auto/topic.mjs';
import { todayJst, sanitizeSlug, fallbackSlugFromTheme } from './auto/slug.mjs';
import { callGeminiJson, callGeminiGrounded } from './auto/gemini-client.mjs';
import { gatherSources } from './auto/research.mjs';
import { buildStructure } from './auto/structure.mjs';
import { writeSlides } from './auto/copywrite.mjs';
import { mechanicalCheck } from './auto/mechanical-check.mjs';
import { judgeContent } from './auto/gemini-judge.mjs';
import { runCopywriteInspectLoop } from './auto/inspect-loop.mjs';
import { createIssue, commentIssue, closeIssue } from './auto/github-issue.mjs';
import { notifyChatwork } from './auto/notify.mjs';
import { buildInspectionMd } from './auto/inspection-md.mjs';
import { mockDeps } from './auto/mock-deps.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function appendGithubOutput(line) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  fs.appendFileSync(outPath, line + '\n', 'utf8');
}

async function main() {
  const mock = process.argv.includes('--mock');

  const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/carousel/tokens.json'), 'utf8'));
  const rubricMarkdown = fs.readFileSync(path.join(ROOT, 'rubric/carousel.md'), 'utf8');
  const topic = pickTopic(path.join(ROOT, 'topics.yml'));

  const deps = mock
    ? {
        gatherSourcesFn: (t) => gatherSources(t, { callGeminiGrounded: mockDeps.callGeminiGrounded }),
        buildStructureFn: (t, s) => buildStructure(t, s, { callGeminiJson: mockDeps.callGeminiJsonForStructure }),
        writeSlidesFn: (t, st, s, tk, r) => writeSlides(t, st, s, tk, { callGeminiJson: mockDeps.callGeminiJsonForCopy }, r),
        judgeContentFn: (s, src, r) => judgeContent(s, src, r, { callGeminiJson: mockDeps.callGeminiJsonForJudge }),
        createIssue: mockDeps.createIssue,
        commentIssue: mockDeps.commentIssue,
        closeIssue: mockDeps.closeIssue,
        notify: async () => {},
      }
    : {
        gatherSourcesFn: (t) => gatherSources(t, { callGeminiGrounded }),
        buildStructureFn: (t, s) => buildStructure(t, s, { callGeminiJson }),
        writeSlidesFn: (t, st, s, tk, r) => writeSlides(t, st, s, tk, { callGeminiJson }, r),
        judgeContentFn: (s, src, r) => judgeContent(s, src, r, { callGeminiJson }),
        createIssue,
        commentIssue,
        closeIssue,
        notify: notifyChatwork,
      };

  console.log(`カテゴリ: ${topic.category} / テーマ: ${topic.theme}${mock ? ' (mockモード)' : ''}`);

  const issueNumber = deps.createIssue({
    title: `自動投稿 ${todayJst()} ${topic.category}`,
    body: `テーマ: ${topic.theme}\n\nこのIssueは自動投稿パイプラインの経過記録用です。`,
  });
  appendGithubOutput(`issue_number=${issueNumber}`);

  const research = await deps.gatherSourcesFn(topic);
  if (!research.sufficient) {
    const msg = `一次ソースが${research.sources.length}件しか見つかりませんでした(3件必要)。本日は見送ります。`;
    console.log(msg);
    deps.commentIssue(issueNumber, msg);
    await deps.notify(`[info][title]自動投稿 見送り[/title]一次ソース不足: ${topic.theme}[/info]`);
    appendGithubOutput('published=false');
    return;
  }

  const structure = await deps.buildStructureFn(topic, research.sources);

  const result = await runCopywriteInspectLoop(topic, structure, research.sources, tokens, rubricMarkdown, {
    writeSlides: deps.writeSlidesFn,
    mechanicalCheck,
    judgeContent: deps.judgeContentFn,
  });

  if (!result.passed) {
    const msg = `自己検収が${result.attempts}回とも不合格でした。本日は見送ります。\n${result.rejectionReasons.join('\n')}`;
    console.log(msg);
    deps.commentIssue(issueNumber, msg);
    await deps.notify(`[info][title]自動投稿 見送り[/title]${result.attempts}回不合格: ${topic.theme}[/info]`);
    appendGithubOutput('published=false');
    return;
  }

  const slug = sanitizeSlug(result.slidesJson.slug, fallbackSlugFromTheme(topic.theme));
  const dir = `${todayJst()}-${slug}`;

  const workDir = path.join(ROOT, 'work', slug);
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(path.join(workDir, 'slides.json'), JSON.stringify(result.slidesJson, null, 2));
  fs.writeFileSync(path.join(workDir, 'inspection.md'), buildInspectionMd(result.attempts));
  console.log(`合格(第${result.attempts}回): work/${slug}/slides.json を書き出しました`);

  deps.closeIssue(issueNumber, `検収合格(第${result.attempts}回)。posts/${dir}/ へpushします。実際のInstagram投稿結果はChatworkでお知らせします。`);

  appendGithubOutput('published=true');
  appendGithubOutput(`slug=${slug}`);
  appendGithubOutput(`dir=${dir}`);
}

main().catch((e) => {
  console.error(e);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, `## 自動投稿パイプライン 失敗\n\n\`\`\`\n${e.stack || e.message}\n\`\`\`\n`);
  }
  process.exit(1);
});
