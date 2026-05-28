import json
import random
from pathlib import Path

print("Initializing dataset generation...")

# Ensure the directories exist
data_dir = Path("data/polyvore")
data_dir.mkdir(parents=True, exist_ok=True)

# A curated list of semantic fashion descriptions
tops = [
    "premium minimalist black cotton t-shirt", "heavy cable knit burgundy wool sweater",
    "white breathable linen button-down shirt", "formal slim fit light blue dress shirt",
    "oversized graphic anime hoodie", "casual grey cotton crewneck",
    "dark navy blue silk blouse", "vintage distressed denim jacket"
]

bottoms = [
    "light wash streetwear denim jeans", "formal charcoal grey wool trousers",
    "navy blue tailored cotton shorts", "black cargo streetwear pants",
    "khaki slim fit chinos", "dark wash raw denim jeans",
    "athletic breathable black joggers", "classic tan corduroy pants"
]

outfits = []
# Generate 100 realistic outfits
for i in range(100): 
    outfits.append({
        "set_id": str(i),
        "items": [
            {"index": 1, "item_id": f"t_{i}", "name": random.choice(tops), "categoryid": "tops"},
            {"index": 2, "item_id": f"b_{i}", "name": random.choice(bottoms), "categoryid": "bottoms"}
        ]
    })

# Save the files exactly where generate_pairs.py is looking for them
with open(data_dir / "train.json", "w") as f:
    json.dump(outfits, f, indent=2)

with open(data_dir / "valid.json", "w") as f:
    json.dump(outfits[:20], f, indent=2)

print(f"✅ Successfully generated {len(outfits)} Polyvore-style outfits!")