import json
import random
from pathlib import Path

# Ensure data directory exists
DATA_DIR = Path("data/amazon")
DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = DATA_DIR / "meta_AMAZON_FASHION_mock.json"

print("Generating local mock Amazon dataset to unblock development...")

categories = [
    ["Clothing, Shoes & Jewelry", "Men", "Clothing", "Shirts", "T-Shirts"],
    ["Clothing, Shoes & Jewelry", "Men", "Clothing", "Pants", "Jeans"],
    ["Clothing, Shoes & Jewelry", "Women", "Clothing", "Tops", "Blouses"],
    ["Clothing, Shoes & Jewelry", "Women", "Clothing", "Dresses"]
]

brands = ["Levi's", "Nike", "Adidas", "H&M", "Zara", "Calvin Klein", "Under Armour"]
colors = ["Black", "White", "Navy", "Grey", "Olive"]

mock_inventory = []

# Generate 100 mock products
for i in range(1, 101):
    cat = random.choice(categories)
    brand = random.choice(brands)
    color = random.choice(colors)
    item_type = cat[-1]
    
    product = {
        "asin": f"B000{i:04d}", # Amazon's unique product ID format
        "title": f"{brand} {color} {item_type} - Premium Quality",
        "price": f"${random.randint(15, 120)}.99",
        "brand": brand,
        "categories": [cat],
        "imageURLHighRes": [f"https://dummyimage.com/600x400/000/fff&text={color}+{item_type}"],
        "also_buy": [] # We will populate this next
    }
    mock_inventory.append(product)

# Simulate the "Also Bought" graph (The secret sauce for ML)
# Let's randomly link some items to act as our Positive Pairs
asins = [p["asin"] for p in mock_inventory]

for product in mock_inventory:
    # Randomly pick 1 to 3 other items that were "bought together"
    bought_together = random.sample(asins, random.randint(1, 3))
    # Make sure an item doesn't link to itself
    if product["asin"] in bought_together:
        bought_together.remove(product["asin"])
        
    product["also_buy"] = bought_together

# Save to file
with open(OUTPUT_FILE, "w") as f:
    for product in mock_inventory:
        f.write(json.dumps(product) + "\n")

print(f"✅ Successfully generated {len(mock_inventory)} Amazon products!")
print(f"📁 Saved to: {OUTPUT_FILE}")
print("You can now build your ML pipeline using this file!")