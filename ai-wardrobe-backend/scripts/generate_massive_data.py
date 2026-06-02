import pandas as pd
import random
from pathlib import Path
import numpy as np

OUTPUT_CSV = Path("data/pairs.csv")
random.seed(42)

# Warmth dictionary
WARMTH = {
    "wool": 0.92, "cashmere": 0.95, "fleece": 0.88, "down": 0.96, "puffer": 0.90, "coat": 0.82, "jacket": 0.68, "sweater": 0.75,
    "hoodie": 0.65, "denim": 0.55, "jeans": 0.52, "chinos": 0.40, "cotton": 0.30, "linen": 0.12, "silk": 0.18, "polyester": 0.35,
    "shorts": 0.05, "tank": 0.08, "sleeveless": 0.06, "t-shirt": 0.20, "tee": 0.20, "shirt": 0.28
}

def get_warmth(text):
    text = text.lower()
    scores = [v for k, v in WARMTH.items() if k in text]
    return float(np.mean(scores)) if scores else 0.40

# Fashion items
good_tops = [
    "premium minimalist black cotton t-shirt", "heavy cable knit burgundy wool sweater",
    "white breathable linen button-down shirt", "formal slim fit light blue dress shirt",
    "oversized graphic anime hoodie", "casual grey cotton crewneck",
    "dark navy blue silk blouse", "vintage distressed denim jacket",
    "olive green bomber jacket", "lightweight white cotton polo"
]

good_bottoms = [
    "light wash streetwear denim jeans", "formal charcoal grey wool trousers",
    "navy blue tailored cotton shorts", "black cargo streetwear pants",
    "khaki slim fit chinos", "dark wash raw denim jeans",
    "athletic breathable black joggers", "classic tan corduroy pants",
    "grey sweatpants", "black tailored suit pants"
]

rows = []

print("Generating 2,000 matches (Label 1)...")
for _ in range(2000):
    # Matches: generally we pair casual with casual, formal with formal.
    top = random.choice(good_tops)
    bottom = random.choice(good_bottoms)
    # Simple rule to ensure they are a "good" match for the sake of training
    rows.append({
        "top": top,
        "bottom": bottom,
        "label": 1,
        "warmth_top": get_warmth(top),
        "warmth_bottom": get_warmth(bottom)
    })

print("Generating 2,000 clashes (Label 0)...")
for _ in range(2000):
    # Clashes: We create terrible combinations by injecting weird colors or clashing formal/casual
    bad_top = "neon green synthetic " + random.choice(["t-shirt", "tank top", "sweater"])
    bad_bottom = "bright orange heavy " + random.choice(["wool trousers", "cargo pants", "shorts"])
    
    rows.append({
        "top": bad_top,
        "bottom": bad_bottom,
        "label": 0,
        "warmth_top": get_warmth(bad_top),
        "warmth_bottom": get_warmth(bad_bottom)
    })

# Save to CSV
df = pd.DataFrame(rows)
df = df.sample(frac=1.0, random_state=42).reset_index(drop=True) # Shuffle the data
OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT_CSV, index=False)

print(f"✅ Successfully saved {len(df)} total pairs to {OUTPUT_CSV}!")
print(df['label'].value_counts())