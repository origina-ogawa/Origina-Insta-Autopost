// posts/ 配下から「まだInstagramに投稿していない、検収合格済みのフォルダ」を検出する。
// 対象は posts/YYYY-MM-DD-<slug>/ 形式のみ(日付のみの旧フォルダは常に除外)。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const DIR_PATTERN = /^\d{4}-\d{2}-\d{2}-[A-Za-z0-9-]+$/;
// inspector.md のテンプレート行「# 検収結果: 合格 / 不合格（第N回）」を誤って合格判定
// しないよう、行頭(見出し可)から始まり直後に「 / 」等が続かない場合のみ合格とみなす。
export const PASS_PATTERN = /^#{0,6}\s*検収結果:\s*合格(?!\s*\/)/m;

export function isPending(postsDir, name) {
  const dir = path.join(postsDir, name);
  const publishedPath = path.join(dir, 'published.json');
  if (fs.existsSync(publishedPath)) return false;

  const inspectionPath = path.join(dir, 'inspection.md');
  if (!fs.existsSync(inspectionPath)) return false;
  const inspection = fs.readFileSync(inspectionPath, 'utf8');
  if (!PASS_PATTERN.test(inspection)) return false;

  return true;
}

export function scanPendingPosts(postsDir) {
  if (!fs.existsSync(postsDir)) return { pending: [] };
  const names = fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && DIR_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort();

  return { pending: names.filter((name) => isPending(postsDir, name)) };
}

function appendGithubOutput(line) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return; // ローカル実行時はGITHUB_OUTPUTが無いのでスキップ
  fs.appendFileSync(outPath, line + '\n', 'utf8');
}

function main() {
  const argv = process.argv.slice(2);
  const overrideIdx = argv.indexOf('--dir');
  const override = overrideIdx !== -1 ? argv[overrideIdx + 1] : null;
  const postsDir = path.join(ROOT, 'posts');

  if (override) {
    if (!DIR_PATTERN.test(override) || !isPending(postsDir, override)) {
      console.error(
        `--dir で指定された "${override}" は未投稿の条件を満たしていません` +
          `(published.json が存在する、または inspection.md が合格になっていない可能性があります)`
      );
      process.exit(1);
    }
    console.log(`指定フォルダを対象にします: ${override}`);
    appendGithubOutput('has_pending=true');
    appendGithubOutput(`dir=${override}`);
    return;
  }

  const { pending } = scanPendingPosts(postsDir);

  if (pending.length === 0) {
    console.log('未投稿のフォルダはありません');
    console.log(
      '::warning::pushイベントで未投稿フォルダが見つかりませんでした。posts/配下のフォルダ名(YYYY-MM-DD-<slug>形式)やinspection.mdの記載(検収結果: 合格)を確認してください'
    );
    appendGithubOutput('has_pending=false');
    return;
  }

  if (pending.length > 1) {
    console.error(
      `未投稿のフォルダが複数見つかりました。--dir で対象を1つ指定して再実行してください:\n` +
        pending.map((p) => `  - ${p}`).join('\n')
    );
    process.exit(1);
  }

  console.log(`未投稿のフォルダ: ${pending[0]}`);
  appendGithubOutput('has_pending=true');
  appendGithubOutput(`dir=${pending[0]}`);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
