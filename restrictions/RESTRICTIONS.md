# GLM-5.1 Usage Restrictions

> **Review document** — sourced from Z.AI / Zhipu official terms, API policies, and usage documentation.
> Last reviewed: 2026-08-28
>
> **Official references:**
> - [Z.AI Terms of Use](https://docs.z.ai/legal-agreement/terms-of-use.md)
> - [Z.AI API Additional Terms](https://chat.z.ai/legal-agreement/terms-of-service)
> - [GLM Coding Plan Usage Policy](https://docs.z.ai/devpack/usage-policy.md)
> - [OpenAI Python SDK (Z.AI)](https://docs.z.ai/guides/develop/openai/python.md)
> - [API Error Codes](https://docs.z.ai/api-reference/api-code.md)

---

## API Configuration (OpenAI-compatible)

| Setting | Value |
|---------|-------|
| SDK | Official `openai` Python SDK (≥ 1.0) |
| Base URL | `https://api.z.ai/api/paas/v4/` |
| Model | `glm-5.1` |
| Coding Plan Base URL | `https://api.z.ai/api/coding/paas/v4` (supported tools only) |

---

## Allowed Uses

See `allowed.json` for the structured list used by the restriction guard.

### General API (metered developer API)

- Software development assistance: code generation, debugging, refactoring, explanation
- Technical documentation and API design
- Educational explanations of programming concepts
- Multi-turn conversational assistance within legal/compliant topics
- Streaming chat completions via OpenAI-compatible endpoint
- Function calling / tool use (OpenAI-compatible format)
- Thinking mode (when supported by model tier)
- Structured output and context caching (per model capabilities)
- Self-hosted deployment under MIT license (open weights on HuggingFace)

### GLM Coding Plan (subscription — additional constraints)

- Use **only** within [officially supported coding tools](https://docs.z.ai/devpack/tool/others.md)
- Coding scenarios: agent-assisted development workflows in approved IDEs/agents
- Concurrent projects per plan tier (Lite / Pro / Max)

---

## Not Allowed Uses

See `not-allowed.json` for the structured list used by the restriction guard.

### Content & Safety (Terms §3)

- Compromising critical infrastructure or national security
- Hate crimes, violent extremism, terrorism, hateful conduct
- False information that may mislead or harm the public
- Obscene, pornographic, violent, terroristic, or criminal incitement content
- Sexually explicit, suggestive, or visually shocking content
- Fraud, scams, spam, abusive or defamatory conduct toward third parties
- Unauthorized collection or dissemination of personal data (PII)
- Child endangerment, exploitation, or inappropriate minor-facing apps
- Instructions for self-harm, suicide, or dangerous activities
- Traffic manipulation or engagement hijacking

### Network & Platform Security (Terms §4)

- Unauthorized network access, malware distribution, data theft
- Scraping, spiders, or automated unauthorized data extraction
- Reverse engineering, decompiling, or extracting model parameters/code
- Bypassing security measures or disseminating bypass techniques
- Developing or training competing algorithms/models using Z.AI services

### Service Misuse (Terms §5–6)

- Dishonest use: disguising AI output as human-created, fake public opinion
- Removing or obscuring AI-generated content identifiers
- High-risk automated decision-making (health, education, credit, infrastructure)
- Substituting for qualified professional services (medical, legal, financial, news)
- Political campaign content generation
- Virtual characters that infringe third-party rights or enable unfair competition
- Unauthorized scraping or deep linking of Z.AI content

### API Services Additional Terms

- Services requiring specific qualifications without proper authorization
- Employment of models for **decision-making activities**
- Training, fine-tuning, or optimizing **external/competing** models using API outputs
- Generating malicious code
- Reverse engineering API algorithms or source code
- Unauthorized third-party plugins or tampering with platform functionality

### GLM Coding Plan Restrictions

- General-purpose API access outside supported tools (SDK bots, websites, SaaS)
- Account sharing, credential rental, or sublicensing subscription quota
- Non-coding use (detected automatically — throttling, suspension, or ban)
- Resale or repackaging of Coding Plan access to third parties

### Geographic / Export (Terms §API)

- Use for benefit of restricted jurisdictions (Iran, North Korea, Cuba, Crimea, etc.)
- Prohibited military or human-rights-violation end uses

---

## Platform Enforcement Signals

| Code | Meaning |
|------|---------|
| 1301 | Unsafe or sensitive content detected in input or generation |
| 1313 | Usage pattern violates Fair Usage Policy — rate limited |
| 1315 | API key limited to enterprise coding package scenarios |
| 1309 | Coding Plan subscription expired |
| 1310 | Weekly/monthly quota exhausted |

---

## Local Restriction Guard

This repository implements a **client-side pre-check** (`backend/restriction_guard.py`) that mirrors the categories above for development and testing. It does **not** replace Z.AI's server-side moderation. Configure test scenarios in `config/restrictions-test.json`.
