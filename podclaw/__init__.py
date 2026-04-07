"""
PodClaw — Autonomous POD Store Manager
=======================================

PodClaw is the autonomous agent that OPERATES the POD store 24/7.
It is separate from the coding harness that BUILDS the platform.

7 autonomous agents work as a team:
  - researcher: Trends + competitor monitoring (Haiku)
  - designer: AI design generation via fal.ai + Gemini (Sonnet)
  - cataloger: Product CRUD via Printful (Sonnet)
  - qa_inspector: Quality assurance + design verification (Sonnet)
  - marketing: Content + email campaigns (Sonnet)
  - customer_support: Reviews + retention + support (Sonnet)
  - finance: Revenue tracking + anomaly detection (Haiku)

Run: python3 -m podclaw.main
"""

__version__ = "0.1.0"
