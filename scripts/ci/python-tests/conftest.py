import sys
from pathlib import Path

# Add scripts/ci to the path so we can import the generator module.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
