// GitHub Issueの作成・コメント・クローズ。GitHub Actionsランナーにプリインストールされている
// ghコマンドを使う(GH_TOKEN/GITHUB_TOKENは環境変数から自動的に読まれる)。
import { execFileSync } from 'node:child_process';

export function createIssue({ title, body }, execFile = execFileSync) {
  const output = execFile('gh', ['issue', 'create', '--title', title, '--body', body], { encoding: 'utf8' }).trim();
  const match = output.match(/\/issues\/(\d+)/);
  if (!match) throw new Error(`Issue番号を取得できませんでした(gh issue createの出力: ${output})`);
  return Number(match[1]);
}

export function commentIssue(number, body, execFile = execFileSync) {
  execFile('gh', ['issue', 'comment', String(number), '--body', body], { encoding: 'utf8' });
}

export function closeIssue(number, body, execFile = execFileSync) {
  const args = ['issue', 'close', String(number)];
  if (body) args.push('--comment', body);
  execFile('gh', args, { encoding: 'utf8' });
}
