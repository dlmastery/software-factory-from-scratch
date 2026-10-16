// Task prompts: WHAT a stage works on this time. HOW the stage behaves (its role, rules and output
// contract) lives in the stage's SKILL.md, which the runner appends to the agent's system prompt.
// Layout: "Issue #N: title", "Labels: ...", blank line, body, "---", stage instructions.

/** The shell command prefixes a stage may run, read from its tool rules: "npm, node, git diff". */
export function shellPrefixes(tools) {
  const prefixes = tools.map((t) => t.match(/^(?:Bash|PowerShell)\((.+?)(?: \*)?\)$/)?.[1]).filter(Boolean);
  return [...new Set(prefixes)].join(", ") || "none";
}

function issueBlock(issue) {
  return `Issue #${issue.id}: ${issue.title}\nLabels: ${issue.labels.join(", ") || "none"}\n\n${issue.body.trim()}\n---\n`;
}

export function triagePrompt(issue) {
  return `${issueBlock(issue)}Triage this issue for an unattended coding agent. Read the code if that helps you judge scope. Do not change any files.`;
}

export function workerPrompt(issue, triage, cfg) {
  const criteria = triage?.acceptanceCriteria?.length ? `Acceptance criteria from triage:\n${triage.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}\n\n` : "";
  return `${issueBlock(issue)}${criteria}Resolve exactly this issue in the repository in your current directory, and nothing else.
The test command is: ${cfg.test}
Shell commands you may run (one plain command per call): ${shellPrefixes(cfg.tools.worker)}. Edit files with the Edit and Write tools.
Make the tests pass before you report. Do not commit; the factory commits for you.`;
}

export function reviewerPrompt(issue, cfg, verifier) {
  return `${issueBlock(issue)}The branch checked out in your current directory holds another agent's change for this issue.
See it with: git diff origin/${cfg.baseBranch}...HEAD
The factory's verifier already ran \`${cfg.test}\` on a clean copy of this branch: ${verifier.ok ? "PASS" : "FAIL"}${verifier.flaky ? " (passed only on retry)" : ""}.
Shell commands you may run (one plain command per call): ${shellPrefixes(cfg.tools.reviewer)}.
Review the change. Do not modify any files.`;
}

export function integratorPrompt(pr, files, cfg) {
  return `Integration: \`git merge origin/${pr.branch}\` (issue #${pr.issue}: ${pr.title}) stopped with conflicts in:
${files.map((f) => `- ${f}`).join("\n")}
---
Resolve every conflict in the repository in your current directory so that BOTH sides are kept.
The test command is: ${cfg.test}
Shell commands you may run (one plain command per call): ${shellPrefixes(cfg.tools.integrator)}. Edit files with the Edit and Write tools.
Make it pass. Stage the resolved files with \`git add\`. Do not commit; the factory concludes the merge.`;
}

export const groundingContract = (docsCommand) => `## Live documentation

Before you use a library, framework or runtime API whose exact current signature you are not sure of, look it up:

    ${docsCommand} "<your question>" [library-name ...]

It returns current official documentation with source links. Write code from what it returns, not from memory. Every lookup is logged in the run's trace.`;
