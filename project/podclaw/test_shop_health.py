"""
python3 -m podclaw.test_shop_health
"""
import asyncio, os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv

workspace = Path(__file__).parent.parent.parent
load_dotenv(workspace.parent / "config" / ".env.required")
load_dotenv(workspace / "project" / "frontend" / ".env.local", override=True)

import structlog, httpx
structlog.configure(
    processors=[structlog.processors.TimeStamper(fmt="iso"), structlog.processors.add_log_level, structlog.dev.ConsoleRenderer()],
    wrapper_class=structlog.make_filtering_bound_logger(20),
)

from podclaw.main import _build_connectors, _build_hooks
from podclaw.event_store import EventStore
from podclaw.memory_manager import MemoryManager
from podclaw.client_factory import ClientFactory
from podclaw.core import Orchestrator
from podclaw.event_queue import SystemEventQueue
from podclaw import config

TASK = """
Necesito que revises la tienda entera porque hay bastante trabajo pendiente.
Tenemos como 80 diseños de los cuales a unos 34 no se les ha quitado el fondo
y a 60 les faltan las dimensiones, eso hay que arreglarlo. También hay 79 diseños
aprobados que no se han convertido en producto todavía, están ahí muertos de risa.
En productos tenemos unos 25 sin traducir al español y alemán, otros 5 con la
descripción guardada como JSON en vez de texto normal, y a casi todos les falta
el campo de detalles del producto como material, instrucciones de cuidado, etc.
La tabla de variants está completamente vacía así que ningún producto tiene tallas
ni colores en la base de datos. Y lo más importante, hay que verificar que lo que
tengamos en Printify coincida con lo que hay en Supabase porque creo que hay
productos descuadrados. Básicamente ponlo todo en orden.
"""

async def run():
    memory = MemoryManager(workspace)
    from supabase import create_client
    sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    events = EventStore(supabase_client=sb)

    from podclaw.hooks.cost_guard_hook import init_cost_guard, reset_costs
    from podclaw.hooks.rate_limit_hook import init_rate_limit
    from podclaw.hooks.security_hook import init_security
    init_cost_guard(sb); init_rate_limit(sb); init_security(sb); reset_costs()

    eq = SystemEventQueue()
    connectors = _build_connectors()
    hooks = _build_hooks(events, memory, event_queue=eq)
    factory = ClientFactory(memory_manager=memory, mcp_connectors=connectors, hooks=hooks,
                            skills_dir=Path(__file__).parent / "skills", event_store=events)
    orch = Orchestrator(client_factory=factory, event_store=events, memory_manager=memory)
    orch.start()

    t0 = time.time()
    for agent in ["designer", "cataloger", "qa_inspector"]:
        print(f"\n>>> {agent}")
        r = await orch.run_agent(agent, task=TASK, force_fresh=True)
        print(f"  {r.get('status')}  tools={r.get('tool_calls',0)}  cost=${r.get('total_cost_usd') or 0:.3f}  time={r.get('duration_seconds',0):.0f}s")

    print(f"\nTotal: {(time.time()-t0)/60:.1f} min")
    orch.stop()

if __name__ == "__main__":
    asyncio.run(run())
