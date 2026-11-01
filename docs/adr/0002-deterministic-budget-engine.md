# ADR 0002: Deterministic Budget Engine

## Status
Accepted

## Context
Event planning relies fundamentally on numerical budget accuracy. Large Language Models (LLMs) are probabilistic token generators susceptible to mathematical rounding errors and calculation hallucinations. Allowing an AI to directly compute variances, remaining balances, or category summations introduces critical risk.

## Decision
All financial calculations, variance tracking, category percentage distributions, and over-budget thresholds are implemented strictly in Python backend services using fixed-point `decimal.Decimal` arithmetic (`NUMERIC(12, 2)` in the database). The AI is restricted to providing advisory target percentage distributions and cost-saving tips.

## Consequences
- **Positive**:
  - 100% mathematical accuracy guaranteed.
  - No risk of budget hallucination.
  - Predictable financial audit trail.
- **Negative**:
  - Requires explicit domain service calculation methods rather than relying on unstructured LLM outputs.

