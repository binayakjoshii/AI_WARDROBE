import json
import random
import pandas as pd
import numpy as np
from pathlib import Path

# Config
INPUT_FILE = Path("data/amazon/meta_AMAZON_FASHION_mock.json")
OUTPUT_CSV = Path("data/pairs.csv")
random.seed(42)

# Warmth keyword map (0.0 = cool, 1.0 = warm)
WARMTH = {
    "wool": 0.92, "cashmere": 0.95, "fleece": 0.88, "down": 0.96,
    "puffer": 0.90, "coat": 0.82, "jacket": 0.68, "sweater": 0.75,
    "hoodie": 0.65, "denim": 0.55, "jeans": 0.52, "chinos": 0.40,
    "cotton": 0.30, "linen": 0.12, "silk": 0.18, "polyester": 0.35,
    "shorts": 0.05, "tank": 0.08, "sleeveless": 0.06, "t-shirt": 0.20,
    "tee": 0.20, "shirt": 0.28
}

def warmth_score(text: str) -> float:
    """Calculate warmth score (0.0-1.0) from item name text."""
    text = text.lower()
    scores = [v for k, v in WARMTH.items() if k in text]
    return float(np.mean(scores)) if scores else 0.40

def load_amazon_data() -> dict:
    """Load the Amazon JSONL file into a dictionary keyed by ASIN."""
    print(f"Loading Amazon data from {INPUT_FILE}...")
    inventory = {}
    if not INPUT_FILE.exists():
        print(f"Error: {INPUT_FILE} not found!")
        return inventory
        
    with open(INPUT_FILE, "r") as f:
        for line in f:
            product = json.loads(line)
            inventory[product["asin"]] = product
    return inventory

def build_dataset() -> pd.DataFrame:
    inventory = load_amazon_data()
    print(f"Total products loaded: {len(inventory)}")
    
    if len(inventory) == 0:
        return pd.DataFrame()

    positive_pairs = []
    all_asins = list(inventory.keys())

    # 1. Extract Positive Pairs from the "Also Bought" graph
    for asin, product in inventory.items():
        for bought_asin in product.get("also_buy", []):
            if bought_asin in inventory:
                positive_pairs.append((asin, bought_asin))

    print(f"Positive pairs found (Also Bought): {len(positive_pairs)}")

    # 2. Build rows for the Neural Network
    rows = []
    
    # Helper to clean text for the SentenceTransformer
    def get_text(p):
        cat_str = " ".join(p.get("categories", [[""]])[0])
        return f"{p.get('brand', '')} {p.get('title', '')} {cat_str}"

    # Add Positive Rows (Label 1)
    for asin_a, asin_b in positive_pairs:
        item_a = inventory[asin_a]
        item_b = inventory[asin_b]
        
        text_a = get_text(item_a)
        text_b = get_text(item_b)
        
        rows.append({
            "top": text_a,           # Naming kept as 'top'/'bottom' so train.py doesn't break
            "bottom": text_b,
            "label": 1,
            "warmth_top": warmth_score(text_a),
            "warmth_bottom": warmth_score(text_b)
        })

    # 3. Generate Negative Pairs (Clashes)
    neg_count = len(positive_pairs)
    
    for _ in range(neg_count):
        # Pick two random items that were NOT bought together
        asin_a = random.choice(all_asins)
        asin_b = random.choice(all_asins)
        
        while asin_b in inventory[asin_a].get("also_buy", []) or asin_a == asin_b:
            asin_b = random.choice(all_asins)
            
        item_a = inventory[asin_a]
        item_b = inventory[asin_b]
        
        text_a = get_text(item_a)
        text_b = get_text(item_b)
        
        rows.append({
            "top": text_a,
            "bottom": text_b,
            "label": 0,
            "warmth_top": warmth_score(text_a),
            "warmth_bottom": warmth_score(text_b)
        })

    df = pd.DataFrame(rows)
    # Shuffle the dataset so the neural network doesn't memorize the order
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    return df

if __name__ == "__main__":
    df = build_dataset()
    if not df.empty:
        OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(OUTPUT_CSV, index=False)
        print(f"Saved {len(df)} pairs to {OUTPUT_CSV}")
        print(f"Class balance: {df['label'].value_counts().to_dict()}")