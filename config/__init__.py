import os
import sys
from pathlib import Path

# When running from root, make sure backend and backend/config are discovered
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / 'backend'
backend_config_dir = backend_dir / 'config'

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

__path__.append(str(backend_config_dir))
