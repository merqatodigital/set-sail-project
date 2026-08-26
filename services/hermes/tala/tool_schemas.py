"""
Compatibility shim: tala/server.py imports `from tool_schemas import TALA_TOOLS`.
This re-exports the canonical schemas from the shared tools module.
"""
from .tools import TOOL_SCHEMAS as TALA_TOOLS

__all__ = ["TALA_TOOLS"]
