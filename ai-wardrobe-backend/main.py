import os
import io
import json
import time
import requests
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Literal
from groq import Groq
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Smart Wardrobe AI Backend")

load_dotenv(dotenv_path="./.env", override=True)

SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GROQ_KEY]):
    raise ValueError("Missing variables! Double-check your .env configuration file.")

supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_KEY)

# ==========================================
# 🧠 LOAD CUSTOM NEURAL NETWORK (The Brain)
# ==========================================
ML_AVAILABLE = False
try:
    print("Loading Custom ML Model into RAM...")
    model_bundle = joblib.load("models/polyvore_weather_model.pkl")
    mlp_model = model_bundle["mlp"]
    scaler = model_bundle["scaler"]
    embedder = SentenceTransformer(model_bundle["embed_model_name"])
    WARMTH_MAP = model_bundle["warmth_keywords"]
    ML_AVAILABLE = True
    print("✅ AI Stylist Model Loaded Successfully!")
except Exception as e:
    print(f"⚠️ ML Model not found or failed to load. Using basic rule fallback. Error: {e}")

def get_warmth_score(text: str) -> float:
    if not ML_AVAILABLE: return 0.5
    text = text.lower()
    scores = [v for k, v in WARMTH_MAP.items() if k in text]
    return float(np.mean(scores)) if scores else 0.40

# ==========================================
# MASTER MENSWEAR FASHION DATASET (14 Archetypes)
# ==========================================
MASTER_FASHION_RULES = [
    {
        "style_archetype": "Everyday Casual / College",
        "keywords": ["class", "college", "campus", "friends", "shopping", "day", "casual", "lecture"],
        "ideal_temp_range": [15, 35],
        "components": {
            "top": {"category": "tops", "subcategory": "T-Shirt or Henley", "colors": ["Black", "White", "Grey", "Navy"]},
            "bottom": {"category": "bottoms", "subcategory": "Jeans or Casual Chinos", "colors": ["Blue", "Black"]},
            "layer": {"category": "outerwear", "subcategory": "Flannel or Zip Hoodie", "colors": ["Red", "Grey", "Navy"]},
            "footwear": {"category": "shoes", "subcategory": "Everyday Sneakers", "colors": ["White", "Black"]}
        }
    },
    {
        "style_archetype": "Smart Casual / Office",
        "keywords": ["office", "work", "meeting", "business casual", "presentation", "colleagues"],
        "ideal_temp_range": [18, 35],
        "components": {
            "top": {"category": "tops", "subcategory": "Polo or Oxford Shirt", "colors": ["White", "Light Blue", "Navy"]},
            "bottom": {"category": "bottoms", "subcategory": "Chinos or Trousers", "colors": ["Navy", "Khaki", "Grey"]},
            "layer": {"category": "outerwear", "subcategory": "Quarter-Zip or Light Sweater", "colors": ["Navy", "Grey"]},
            "footwear": {"category": "shoes", "subcategory": "Clean Sneakers or Loafers", "colors": ["White", "Brown"]}
        }
    },
    {
        "style_archetype": "Evening Date Night / Formal",
        "keywords": ["date", "dinner", "evening", "romantic", "night out", "fancy", "restaurant", "anniversary"],
        "ideal_temp_range": [10, 30],
        "components": {
            "top": {"category": "tops", "subcategory": "Button-Down or Dress Shirt", "colors": ["Black", "White", "Navy", "Burgundy"]},
            "bottom": {"category": "bottoms", "subcategory": "Chinos or Dress Pants", "colors": ["Black", "Navy", "Grey"]},
            "layer": {"category": "outerwear", "subcategory": "Blazer or Jacket", "colors": ["Black", "Navy"]},
            "footwear": {"category": "shoes", "subcategory": "Dress Shoes or Loafers", "colors": ["Black", "Brown"]}
        }
    },
    {
        "style_archetype": "Business Professional / Boardroom",
        "keywords": ["interview", "boardroom", "corporate", "strict office", "formal meeting"],
        "ideal_temp_range": [15, 30],
        "components": {
            "top": {"category": "tops", "subcategory": "Dress Shirt", "colors": ["White", "Light Blue"]},
            "bottom": {"category": "bottoms", "subcategory": "Suit Trousers", "colors": ["Navy", "Charcoal", "Black"]},
            "layer": {"category": "outerwear", "subcategory": "Suit Jacket", "colors": ["Navy", "Charcoal", "Black"]},
            "footwear": {"category": "shoes", "subcategory": "Oxfords or Dress Shoes", "colors": ["Black", "Dark Brown"]}
        }
    },
    {
        "style_archetype": "Streetwear / Hype",
        "keywords": ["street", "festival", "concert", "hype", "skate", "city", "downtown", "kicks"],
        "ideal_temp_range": [15, 35],
        "components": {
            "top": {"category": "tops", "subcategory": "Graphic T-Shirt or Oversized Tee", "colors": ["Black", "White", "Vintage Wash"]},
            "bottom": {"category": "bottoms", "subcategory": "Cargo Pants or Baggy Jeans", "colors": ["Olive", "Black", "Faded Blue"]},
            "layer": {"category": "outerwear", "subcategory": "Bomber or Denim Jacket", "colors": ["Black", "Olive", "Blue"]},
            "footwear": {"category": "shoes", "subcategory": "Statement Sneakers", "colors": ["Red", "Blue", "Multi", "White"]}
        }
    },
    {
        "style_archetype": "Activewear / Gym",
        "keywords": ["gym", "workout", "run", "sports", "training", "exercise", "sweat", "fitness", "basketball", "soccer"],
        "ideal_temp_range": [5, 45],
        "components": {
            "top": {"category": "tops", "subcategory": "Athletic T-Shirt or Tank", "colors": ["Black", "White", "Grey", "Neon"]},
            "bottom": {"category": "bottoms", "subcategory": "Gym Shorts or Joggers", "colors": ["Black", "Grey", "Navy"]},
            "layer": {"category": "outerwear", "subcategory": "Windbreaker", "colors": ["Black", "Grey"]},
            "footwear": {"category": "shoes", "subcategory": "Running Shoes", "colors": []} 
        }
    },
    {
        "style_archetype": "Loungewear / Cozy",
        "keywords": ["home", "lazy", "couch", "groceries", "relax", "chill", "errands", "study", "dorm", "movie"],
        "ideal_temp_range": [15, 30],
        "components": {
            "top": {"category": "tops", "subcategory": "Comfortable Oversized Tee", "colors": ["Grey", "White", "Earth Tones"]},
            "bottom": {"category": "bottoms", "subcategory": "Sweatpants", "colors": ["Grey", "Black"]},
            "layer": {"category": "outerwear", "subcategory": "Hoodie", "colors": ["Grey", "Black"]},
            "footwear": {"category": "shoes", "subcategory": "Slides or Crocs", "colors": []}
        }
    },
    {
        "style_archetype": "Summer Vacation / Resort",
        "keywords": ["vacation", "beach", "summer", "resort", "holiday", "tropical", "pool", "goa", "cruise"],
        "ideal_temp_range": [25, 45],
        "components": {
            "top": {"category": "tops", "subcategory": "Linen Shirt or Polo", "colors": ["White", "Light Blue", "Beige", "Yellow"]},
            "bottom": {"category": "bottoms", "subcategory": "Shorts", "colors": ["Khaki", "Navy", "White", "Olive"]},
            "layer": {"category": "outerwear", "subcategory": "None", "colors": []},
            "footwear": {"category": "shoes", "subcategory": "Sandals or Loafers", "colors": ["Brown", "White"]}
        }
    },
    {
        "style_archetype": "Winter / Heavy Cold",
        "keywords": ["winter", "cold", "snow", "freezing", "chilly", "ice", "blizzard"],
        "ideal_temp_range": [-20, 10],
        "components": {
            "top": {"category": "tops", "subcategory": "Heavy Sweater or Turtleneck", "colors": ["Black", "Grey", "Navy", "Cream"]},
            "bottom": {"category": "bottoms", "subcategory": "Heavy Jeans or Corduroys", "colors": ["Black", "Dark Blue"]},
            "layer": {"category": "outerwear", "subcategory": "Overcoat or Puffer Jacket", "colors": ["Black", "Navy", "Olive"]},
            "footwear": {"category": "shoes", "subcategory": "Boots", "colors": ["Black", "Brown"]}
        }
    },
    {
        "style_archetype": "Rainy / Monsoon",
        "keywords": ["rain", "storm", "wet", "monsoon", "umbrella", "puddles", "pouring"],
        "ideal_temp_range": [10, 30],
        "components": {
            "top": {"category": "tops", "subcategory": "T-Shirt", "colors": ["Black", "Navy", "Dark Grey"]},
            "bottom": {"category": "bottoms", "subcategory": "Synthetic Pants or Dark Jeans", "colors": ["Black", "Navy"]},
            "layer": {"category": "outerwear", "subcategory": "Raincoat or Water-Resistant Shell", "colors": ["Yellow", "Black", "Olive"]},
            "footwear": {"category": "shoes", "subcategory": "Waterproof Boots or Beaters", "colors": ["Black"]}
        }
    },
    {
        "style_archetype": "Creative / Artistic",
        "keywords": ["art", "gallery", "exhibition", "museum", "cafe", "poetry", "creative", "design"],
        "ideal_temp_range": [15, 30],
        "components": {
            "top": {"category": "tops", "subcategory": "Turtleneck or Flowy Shirt", "colors": ["Black", "Mustard", "Cream", "Rust"]},
            "bottom": {"category": "bottoms", "subcategory": "Wide Leg Trousers", "colors": ["Black", "Brown", "Olive"]},
            "layer": {"category": "outerwear", "subcategory": "Cardigan or Chore Coat", "colors": ["Earth Tones", "Navy"]},
            "footwear": {"category": "shoes", "subcategory": "Chunky Loafers or Boots", "colors": ["Black", "Oxblood"]}
        }
    },
    {
        "style_archetype": "Wedding Guest (Summer/Day)",
        "keywords": ["wedding guest", "reception", "day wedding"],
        "ideal_temp_range": [20, 35],
        "components": {
            "top": {"category": "tops", "subcategory": "Dress Shirt", "colors": ["White", "Light Blue", "Pink"]},
            "bottom": {"category": "bottoms", "subcategory": "Suit Trousers", "colors": ["Navy", "Light Grey", "Tan"]},
            "layer": {"category": "outerwear", "subcategory": "Suit Jacket", "colors": ["Navy", "Light Grey", "Tan"]},
            "footwear": {"category": "shoes", "subcategory": "Dress Shoes", "colors": ["Brown", "Tan"]}
        }
    },
    {
        "style_archetype": "Travel / Airport",
        "keywords": ["flight", "airport", "travel", "plane", "flying", "roadtrip"],
        "ideal_temp_range": [15, 25],
        "components": {
            "top": {"category": "tops", "subcategory": "Comfortable T-Shirt", "colors": ["Black", "White", "Grey"]},
            "bottom": {"category": "bottoms", "subcategory": "Joggers or Stretchy Chinos", "colors": ["Black", "Navy", "Grey"]},
            "layer": {"category": "outerwear", "subcategory": "Zip-up Hoodie or Light Jacket", "colors": ["Black", "Grey"]},
            "footwear": {"category": "shoes", "subcategory": "Slip-on Sneakers", "colors": ["White", "Black"]}
        }
    },
    {
        "style_archetype": "Traditional / Cultural Event",
        "keywords": ["festival", "diwali", "puja", "traditional", "ethnic", "indian wedding", "ceremony"],
        "ideal_temp_range": [15, 40],
        "components": {
            "top": {"category": "tops", "subcategory": "Kurta or Ethnic Top", "colors": ["White", "Yellow", "Maroon", "Black"]},
            "bottom": {"category": "bottoms", "subcategory": "Pajama or Chinos", "colors": ["White", "Black"]},
            "layer": {"category": "outerwear", "subcategory": "Nehru Jacket", "colors": ["Contrasting Color"]},
            "footwear": {"category": "shoes", "subcategory": "Sandals, Mojaris, or Loafers", "colors": ["Brown", "Black"]}
        }
    }
]

# ==========================================
# DATA SCHEMAS
# ==========================================
class IngestRequest(BaseModel):
    imageUrl: str
    status: str = "clean"  

class RecommendRequest(BaseModel):
    prompt: str
    current_temp: float = 28.0
    is_raining: bool = False

# ==========================================
# ENDPOINTS
# ==========================================
@app.post("/api/ingest")
async def process_clothing_item(request: IngestRequest):
    try:
        from rembg import remove
        response = requests.get(request.imageUrl)
        if response.status_code != 200: raise HTTPException(status_code=400, detail="Failed to download image.")
        
        output_bytes = remove(response.content)
        processed_image = Image.open(io.BytesIO(output_bytes))
        img_buffer = io.BytesIO()
        processed_image.save(img_buffer, format="PNG")
        img_buffer.seek(0)

        file_name = f"processed_{os.path.basename(request.imageUrl).split('?')[0]}"
        storage_path = f"processed_wardrobe/{file_name}"
        
        supabase_client.storage.from_("wardrobe").upload(path=storage_path, file=img_buffer.getvalue(), file_options={"content-type": "image/png"})
        return {"success": True, "processedImageUrl": supabase_client.storage.from_("wardrobe").get_public_url(storage_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recommend")
async def recommend_outfit(request: RecommendRequest):
    try:
        greetings = ["hi", "hello", "hey", "sup"]
        if request.prompt.lower().strip() in greetings:
            return {"success": True, "recommendation": "Hello! I am Aura. What is the occasion you are dressing for today?", "blueprint": {}, "meta": {"status": "greeting"}}

        db_response = supabase_client.table("clothing_items").select("*").eq("wear_status", "clean").execute()
        user_wardrobe = db_response.data if db_response.data else []

        # 1. FIXED SCORING LOGIC (Keywords beat Temperature)
        best_archetype = MASTER_FASHION_RULES[0] # Default to Casual
        highest_score = 0 
        
        for archetype in MASTER_FASHION_RULES:
            score = 0
            if archetype["ideal_temp_range"][0] <= request.current_temp <= archetype["ideal_temp_range"][1]: 
                score += 0.5 # Weather is a minor tie-breaker
            for kw in archetype.get("keywords", []):
                if kw in request.prompt.lower(): 
                    score += 5 # Keywords are the primary decider
            if score > highest_score:
                highest_score = score
                best_archetype = archetype

        outfit_composition = {}
        
        # 2. MACHINE LEARNING EVALUATION
        if ML_AVAILABLE and len(user_wardrobe) > 1:
            tops = [item for item in user_wardrobe if item.get("category", "").lower() in ["tops", "top", "shirt"]]
            bottoms = [item for item in user_wardrobe if item.get("category", "").lower() in ["bottoms", "bottom", "pants", "jeans"]]
            
            best_pair_score = -1
            best_top, best_bottom = None, None
            temp_norm = np.clip(request.current_temp, 5, 45) / 45.0

            for top in tops:
                for bottom in bottoms:
                    top_text = f"{top.get('brand','')} {top.get('color_name','')} {top.get('subcategory','')}"
                    bottom_text = f"{bottom.get('brand','')} {bottom.get('color_name','')} {bottom.get('subcategory','')}"
                    
                    top_vec, bottom_vec = embedder.encode([top_text]), embedder.encode([bottom_text])
                    w_top, w_bot = np.array([[get_warmth_score(top_text)]]), np.array([[get_warmth_score(bottom_text)]])
                    t_norm = np.array([[temp_norm]])
                    
                    X_input = np.hstack([top_vec, bottom_vec, w_top, w_bot, t_norm])
                    confidence = mlp_model.predict_proba(scaler.transform(X_input))[0][1] 
                    
                    if confidence > best_pair_score:
                        best_pair_score, best_top, best_bottom = confidence, top, bottom

            if best_top: outfit_composition["top"] = f"Your {best_top.get('color_name', '')} {best_top.get('subcategory', '')}"
            if best_bottom: outfit_composition["bottom"] = f"Your {best_bottom.get('color_name', '')} {best_bottom.get('subcategory', '')}"
            for placement in ["layer", "footwear"]:
                structural_rule = best_archetype["components"].get(placement)
                if structural_rule and structural_rule["subcategory"] != "None":
                    rule_cat = structural_rule["category"].lower()
                    matched_item = next((item for item in user_wardrobe if item.get("category", "").lower() == rule_cat and (not structural_rule["colors"] or any(c.lower() in item.get("color_name", "").lower() for c in structural_rule["colors"]))), None)
                    outfit_composition[placement] = f"Your {matched_item['color_name']} {matched_item['subcategory']}" if matched_item else f"[MISSING: {structural_rule['subcategory']}]"

        else:
            # Basic Fallback if ML isn't running
            for placement, structural_rule in best_archetype["components"].items():
                if structural_rule["subcategory"] == "None": continue
                rule_cat = structural_rule["category"].lower()
                matched_item = next((item for item in user_wardrobe if item.get("category", "").lower() == rule_cat and (not structural_rule["colors"] or any(c.lower() in item.get("color_name", "").lower() for c in structural_rule["colors"]))), None)
                outfit_composition[placement] = f"Your {matched_item['color_name']} {matched_item['subcategory']}" if matched_item else f"[MISSING: {structural_rule['subcategory']}]"

        # 3. GROUNDED GROQ PROMPT (No more poetry)
        outfit_blueprint_str = json.dumps(outfit_composition, indent=2).replace("{", "{{").replace("}", "}}")
        match_prompt = f"""
        SYSTEM: You are 'Aura', a smart wardrobe assistant. Your tone must be modern, direct, practical, and grounded. Do NOT use overly poetic, dramatic, or exaggerated language. Be helpful and concise. No emojis.
        
        CONTEXT: 
        Event: '{request.prompt}'
        Archetype: '{best_archetype['style_archetype']}'
        
        BLUEPRINT (Items chosen by the algorithm): 
        {outfit_blueprint_str}
        
        TASK: 
        Acknowledge the event in one sentence. State the items from the BLUEPRINT clearly. Provide 1 or 2 practical styling tips to complete the look. Keep the entire response under 4 sentences.
        """

        chat_completion = groq_client.chat.completions.create(messages=[{"role": "user", "content": match_prompt}], model="llama-3.1-8b-instant", temperature=0.5)

        return {
            "success": True,
            "recommendation": chat_completion.choices[0].message.content,
            "blueprint": outfit_composition,
            "meta": {"archetype": best_archetype['style_archetype'], "ml_score": str(best_pair_score) if ML_AVAILABLE else "N/A"}
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/schedule-outfit")
async def schedule_outfit(request: RecommendRequest, event_date: str):
    recommendation = await recommend_outfit(request)
    try:
        supabase_client.table("outfit_calendar").insert({"event_date": event_date, "event_name": request.prompt, "outfit_blueprint": recommendation["blueprint"]}).execute()
        return {"success": True, "data": recommendation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save to calendar: {str(e)}")

@app.get("/api/calendar/{date}")
async def get_outfit_for_date(date: str):
    try:
        response = supabase_client.table("outfit_calendar").select("*").eq("event_date", date).execute()
        if not response.data: return {"success": False, "message": "No outfit planned for this date."}
        return {"success": True, "outfit": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calendar lookup failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)