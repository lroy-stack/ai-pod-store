"""
PodClaw — Autonomous POD Store Manager
=======================================

PodClaw is the autonomous agent that OPERATES the POD store 24/7.
It is separate from the coding harness that BUILDS the platform.

10 autonomous agents work as a team:
  - researcher: Trends + competitor monitoring (Haiku)
  - marketing: Social media + campaigns (Sonnet)
  - designer: AI design generation via fal.ai (Sonnet)
  - newsletter: Email campaigns + A/B testing (Sonnet)
  - cataloger: Product CRUD via Printify (Sonnet)
  - customer_manager: Reviews + retention + chat (Sonnet)
  - seo_manager: SEO optimization (Haiku)
  - finance: Revenue tracking + anomaly detection (Sonnet)
  - qa_inspector: Quality assurance + design verification (Haiku)
  - brand_manager: Brand consistency + labeling (Sonnet)

Run: python3 -m podclaw.main --workspace ./pod_workspace
"""

__version__ = "0.1.0"
