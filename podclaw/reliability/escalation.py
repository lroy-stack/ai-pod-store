"""
EscalationManager — Multi-tier alerting and escalation (Python)

Implements L1/L2/L3 escalation tiers for PodClaw agent issues:
- L1: Informational (logs only)
- L2: Warning (Slack notification)
- L3: Critical (Slack + PagerDuty + admin email)

Usage:
    from podclaw.reliability.escalation import escalate, Escalate

    # L2 Warning
    await escalate('L2', 'Printify API rate limit exceeded', {
        'service': 'cataloger',
        'endpoint': '/products',
        'error_code': 'RATE_LIMIT'
    })

    # L3 Critical with helper
    await Escalate.budget_exceeded('cataloger', 50.00, 100.00)
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

import httpx

logger = logging.getLogger(__name__)

EscalationLevel = Literal['L1', 'L2', 'L3']


class EscalationContext:
    """Context for an escalation event"""

    def __init__(
        self,
        service: Optional[str] = None,
        endpoint: Optional[str] = None,
        agent_name: Optional[str] = None,
        session_id: Optional[str] = None,
        error_code: Optional[str] = None,
        timestamp: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.service = service
        self.endpoint = endpoint
        self.agent_name = agent_name
        self.session_id = session_id
        self.error_code = error_code
        self.timestamp = timestamp or datetime.utcnow().isoformat()
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            'service': self.service,
            'endpoint': self.endpoint,
            'agent_name': self.agent_name,
            'session_id': self.session_id,
            'error_code': self.error_code,
            'timestamp': self.timestamp,
            'metadata': self.metadata,
        }


class EscalationResult:
    """Result of an escalation"""

    def __init__(self, success: bool, level: EscalationLevel, notified: List[str], error: Optional[str] = None):
        self.success = success
        self.level = level
        self.notified = notified
        self.error = error

    def __repr__(self) -> str:
        if self.success:
            return f"<EscalationResult level={self.level} notified={self.notified}>"
        else:
            return f"<EscalationResult level={self.level} error={self.error}>"


# Escalation tier definitions
ESCALATION_TIERS = {
    'L1': {
        'name': 'Informational',
        'description': 'Low-priority issue, logs only',
        'actions': ['console'],
    },
    'L2': {
        'name': 'Warning',
        'description': 'Medium-priority issue, notify team',
        'actions': ['console', 'slack'],
    },
    'L3': {
        'name': 'Critical',
        'description': 'High-priority issue, urgent response required',
        'actions': ['console', 'slack', 'pagerduty', 'email'],
    },
}


async def escalate(
    level: EscalationLevel,
    message: str,
    context: Optional[Dict[str, Any]] = None
) -> EscalationResult:
    """
    Escalate an issue to the appropriate tier

    Args:
        level: Escalation level (L1, L2, L3)
        message: Human-readable error message
        context: Additional context about the issue

    Returns:
        EscalationResult with success, level, and notified channels

    Example:
        >>> result = await escalate('L3', 'Agent budget exceeded', {
        ...     'service': 'podclaw',
        ...     'agent_name': 'cataloger',
        ...     'error_code': 'BUDGET_EXCEEDED'
        ... })
        >>> print(result.notified)
        ['console', 'slack', 'pagerduty']
    """
    tier = ESCALATION_TIERS[level]
    notified: List[str] = []
    ctx = context or {}

    try:
        full_context = {
            **ctx,
            'timestamp': ctx.get('timestamp') or datetime.utcnow().isoformat(),
            'level': level,
            'tier': tier['name'],
        }

        logger.log(
            logging.CRITICAL if level == 'L3' else logging.WARNING if level == 'L2' else logging.INFO,
            f"[Escalation] {level} ({tier['name']}): {message}",
            extra=full_context
        )

        # Action 1: Console (always)
        notified.append('console')

        # Action 2: Slack (L2+)
        if 'slack' in tier['actions']:
            slack_result = await _notify_slack(level, message, full_context)
            if slack_result:
                notified.append('slack')

        # Action 3: PagerDuty (L3 only)
        if 'pagerduty' in tier['actions']:
            pagerduty_result = await _notify_pagerduty(level, message, full_context)
            if pagerduty_result:
                notified.append('pagerduty')

        # Action 4: Email (L3 only)
        if 'email' in tier['actions']:
            email_result = await _notify_email(level, message, full_context)
            if email_result:
                notified.append('email')

        # Record escalation in database for audit trail
        try:
            await _record_escalation(level, message, full_context)
        except Exception as record_error:
            logger.error(f"[Escalation] Failed to record in database: {record_error}")

        return EscalationResult(success=True, level=level, notified=notified)

    except Exception as error:
        logger.error(f"[Escalation] Failed to escalate: {error}")
        return EscalationResult(
            success=False,
            level=level,
            notified=notified,
            error=str(error)
        )


async def _notify_slack(level: EscalationLevel, message: str, context: Dict[str, Any]) -> bool:
    """Send Slack notification"""
    try:
        webhook_url = os.getenv('SLACK_WEBHOOK_URL')
        if not webhook_url:
            logger.warning('[Escalation] SLACK_WEBHOOK_URL not configured')
            return False

        color = 'danger' if level == 'L3' else 'warning'
        emoji = '🚨' if level == 'L3' else '⚠️'

        payload = {
            'text': f"{emoji} {level} Escalation",
            'attachments': [
                {
                    'color': color,
                    'title': message,
                    'fields': [
                        {
                            'title': 'Service',
                            'value': context.get('service') or 'Unknown',
                            'short': True,
                        },
                        {
                            'title': 'Agent',
                            'value': context.get('agent_name') or 'N/A',
                            'short': True,
                        },
                        {
                            'title': 'Error Code',
                            'value': context.get('error_code') or 'N/A',
                            'short': True,
                        },
                        {
                            'title': 'Timestamp',
                            'value': context.get('timestamp') or datetime.utcnow().isoformat(),
                            'short': True,
                        },
                    ],
                    'footer': 'PodClaw Escalation',
                    'ts': int(datetime.utcnow().timestamp()),
                },
            ],
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=10.0)
            response.raise_for_status()

        logger.info('[Escalation] Slack notification sent')
        return True

    except Exception as error:
        logger.error(f'[Escalation] Slack notification error: {error}')
        return False


async def _notify_pagerduty(level: EscalationLevel, message: str, context: Dict[str, Any]) -> bool:
    """Send PagerDuty alert"""
    try:
        integration_key = os.getenv('PAGERDUTY_INTEGRATION_KEY')
        if not integration_key:
            logger.warning('[Escalation] PAGERDUTY_INTEGRATION_KEY not configured')
            return False

        payload = {
            'routing_key': integration_key,
            'event_action': 'trigger',
            'payload': {
                'summary': message,
                'severity': 'critical',
                'source': context.get('service') or 'podclaw',
                'component': context.get('agent_name') or 'unknown',
                'custom_details': context,
            },
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://events.pagerduty.com/v2/enqueue',
                json=payload,
                timeout=10.0
            )
            response.raise_for_status()

        logger.info('[Escalation] PagerDuty alert sent')
        return True

    except Exception as error:
        logger.error(f'[Escalation] PagerDuty alert error: {error}')
        return False


async def _notify_email(level: EscalationLevel, message: str, context: Dict[str, Any]) -> bool:
    """Send email notification to admins directly via Resend API"""
    try:
        resend_key = os.getenv('RESEND_API_KEY')
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
        from_email = os.getenv('RESEND_FROM_EMAIL', os.getenv('STORE_SENDER_NAME', 'Store') + ' System <' + os.getenv('STORE_NOREPLY_EMAIL', 'noreply@example.com') + '>')

        if not resend_key:
            logger.warning('[Escalation] RESEND_API_KEY not configured, cannot send email')
            return False

        subject = f"[STORE {level.upper()}] Escalation: {message[:80]}"
        context_str = "\n".join(f"  {k}: {v}" for k, v in context.items()) if context else "  (none)"
        body = f"Escalation Level: {level}\n\nMessage:\n{message}\n\nContext:\n{context_str}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.resend.com/emails',
                headers={
                    'Authorization': f'Bearer {resend_key}',
                    'Content-Type': 'application/json',
                },
                json={
                    'from': from_email,
                    'to': [admin_email],
                    'subject': subject,
                    'text': body,
                },
                timeout=10.0
            )
            response.raise_for_status()

        logger.info('[Escalation] Email notification sent via Resend')
        return True

    except Exception as error:
        logger.error(f'[Escalation] Email notification error: {error}')
        return False


async def _record_escalation(level: EscalationLevel, message: str, context: Dict[str, Any]) -> None:
    """Record escalation in database via direct Supabase insert"""
    try:
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_KEY')

        if not supabase_url or not supabase_key:
            logger.warning('[Escalation] Supabase not configured, cannot record escalation')
            return

        async with httpx.AsyncClient() as client:
            await client.post(
                f"{supabase_url}/rest/v1/audit_log",
                headers={
                    'apikey': supabase_key,
                    'Authorization': f'Bearer {supabase_key}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                json={
                    'action': f'escalation_{level}',
                    'details': {
                        'level': level,
                        'message': message,
                        'context': context,
                        'timestamp': datetime.utcnow().isoformat(),
                    },
                    'performed_by': 'podclaw-system',
                },
                timeout=10.0
            )
    except Exception as error:
        logger.error(f'[Escalation] Failed to record escalation: {error}')
        # Don't raise - recording is non-critical


class Escalate:
    """Helper functions for common escalation scenarios"""

    @staticmethod
    async def budget_exceeded(agent_name: str, spent: float, budget: float) -> EscalationResult:
        """Agent budget exceeded"""
        return await escalate(
            'L3',
            f'Agent Budget Exceeded: {agent_name} spent ${spent:.2f} of ${budget:.2f}',
            {
                'service': 'podclaw',
                'agent_name': agent_name,
                'error_code': 'BUDGET_EXCEEDED',
                'metadata': {'spent': spent, 'budget': budget},
            }
        )

    @staticmethod
    async def api_error(agent_name: str, service: str, error_message: str) -> EscalationResult:
        """External API error after retries"""
        return await escalate(
            'L2',
            f'API Error: {service} - {error_message}',
            {
                'service': 'podclaw',
                'agent_name': agent_name,
                'error_code': 'API_ERROR',
                'metadata': {'api_service': service, 'error': error_message},
            }
        )

    @staticmethod
    async def task_timeout(agent_name: str, task_name: str, timeout_seconds: int) -> EscalationResult:
        """Agent task timeout"""
        return await escalate(
            'L2',
            f'Task Timeout: {agent_name} - {task_name} exceeded {timeout_seconds}s',
            {
                'service': 'podclaw',
                'agent_name': agent_name,
                'error_code': 'TASK_TIMEOUT',
                'metadata': {'task': task_name, 'timeout_seconds': timeout_seconds},
            }
        )

    @staticmethod
    async def skill_failure(agent_name: str, skill_name: str, error: str) -> EscalationResult:
        """Agent skill execution failure"""
        return await escalate(
            'L2',
            f'Skill Failure: {agent_name}.{skill_name} - {error}',
            {
                'service': 'podclaw',
                'agent_name': agent_name,
                'error_code': 'SKILL_FAILURE',
                'metadata': {'skill': skill_name, 'error': error},
            }
        )
