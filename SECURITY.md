# Security policy

The factory runs code-writing agents unattended. Its threat model and controls are documented in [docs/security-model.md](docs/security-model.md). Please read the section on what the local sandbox backend does **not** isolate before running the factory on untrusted repositories or untrusted issue text.

## Reporting a vulnerability

If you find a way for a stage agent to obtain a secret, push or merge, escape its stage's tool allowlist, modify another stage's sandbox, or make the runner skip a gate, please report it privately through GitHub's "Report a vulnerability" (Security tab of this repository) rather than opening a public issue. Include the factory version, your config (without secrets), and the relevant trace files from `.factory/runs/<run-id>/traces/`.
