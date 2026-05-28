import os
import io
import json
import time
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Literal
from groq import Groq

app = FastAPI(title="Smart Wardrobe AI Backend")

load_dotenv(dotenv_path="./.env", override=True)

SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GROQ_KEY]):
    raise ValueError("Missing variables! Double-check your .env configuration file formatting (GROQ_API_KEY).")

supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_KEY)

# ==========================================
# MASTER MENSWEAR FASHION DATASET (Context-Aware Expansion)
# ==========================================
MASTER_FASHION_RULES = [
    {
        "style_archetype": "Evening Date Night / Formal",
        "keywords": ["date", "dinner", "evening", "romantic", "night out", "fancy", "restaurant", "wedding", "formal", "office"],
        "ideal_temp_range": [10, 30],
        "components": {
            "top": {"category": "tops", "subcategory": "Button-Down or Dress Shirt", "colors": ["Black", "White", "Navy", "Burgundy", "Blue", "Maroon"]},
            "bottom": {"category": "bottoms", "subcategory": "Chinos or Dress Pants", "colors": ["Black", "Navy", "Grey", "Khaki"]},
            "layer": {"category": "outerwear", "subcategory": "Blazer or Jacket", "colors": ["Black", "Navy", "Grey"]},
            "footwear": {"category": "shoes", "subcategory": "Dress Shoes or Clean Loafers", "colors": ["Black", "Brown"]}
        }
    },
    {
        "style_archetype": "Summer Vacation / Resort",
        "keywords": ["vacation", "beach", "summer", "resort", "holiday", "trip", "tropical", "pool", "goa"],
        "ideal_temp_range": [25, 45],
        "components": {
            "top": {"category": "tops", "subcategory": "Linen Shirt or Polo", "colors": ["White", "Light Blue", "Beige", "Yellow", "Pink"]},
            "bottom": {"category": "bottoms", "subcategory": "Shorts", "colors": ["Khaki", "Navy", "White", "Olive", "Beige"]},
            "layer": {"category": "outerwear", "subcategory": "None", "colors": []},
            "footwear": {"category": "shoes", "subcategory": "Sandals or Loafers", "colors": ["Brown", "White"]}
        }
    },
    {
        "style_archetype": "Streetwear Essentials (Everyday)",
        "keywords": ["street", "walk", "festival", "gym", "active", "casual", "friends", "shopping", "day"],
        "ideal_temp_range": [15, 45],
        "components": {
            "top": {"category": "tops", "subcategory": "T-Shirt", "colors": ["Black", "White", "Grey", "Burgundy", "Olive"]},
            "bottom": {"category": "bottoms", "subcategory": "Cargo Pants or Jeans", "colors": ["Olive", "Black", "Grey", "Blue", "Beige"]},
            "layer": {"category": "outerwear", "subcategory": "None", "colors": []},
            "footwear": {"category": "shoes", "subcategory": "Sneakers", "colors": ["White", "Black", "Red"]}
        }
    },
    {
        "style_archetype": "Winter / Cold Weather Layering",
        "keywords": ["winter", "cold", "snow", "freezing", "chilly"],
        "ideal_temp_range": [-10, 14],
        "components": {
            "top": {"category": "tops", "subcategory": "Sweater or Hoodie", "colors": ["Black", "Grey", "Navy", "Burgundy", "White"]},
            "bottom": {"category": "bottoms", "subcategory": "Heavy Jeans or Chinos", "colors": ["Black", "Dark Blue", "Grey"]},
            "layer": {"category": "outerwear", "subcategory": "Overcoat or Puffer Jacket", "colors": ["Black", "Navy", "Olive", "Grey"]},
            "footwear": {"category": "shoes", "subcategory": "Boots", "colors": ["Black", "Brown"]}
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

class UpdateStatusRequest(BaseModel):
    status: Literal["clean", "dirty"]

# ==========================================
# ENDPOINT 1: THE INGESTION PIPELINE
# ==========================================
@app.post("/api/ingest")
async def process_clothing_item(request: IngestRequest):
    try:
        from rembg import remove

        response = requests.get(request.imageUrl)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download image.")
        
        output_bytes = remove(response.content)
        processed_image = Image.open(io.BytesIO(output_bytes))
        img_buffer = io.BytesIO()
        processed_image.save(img_buffer, format="PNG")
        img_buffer.seek(0)

        file_name = f"processed_{os.path.basename(request.imageUrl).split('?')[0]}"
        storage_path = f"processed_wardrobe/{file_name}"
        
        supabase_client.storage.from_("wardrobe").upload(
            path=storage_path,
            file=img_buffer.getvalue(),
            file_options={"content-type": "image/png"}
        )
        
        processed_url = supabase_client.storage.from_("wardrobe").get_public_url(storage_path)

        return {
            "success": True,
            "processedImageUrl": processed_url
        }

    except Exception as e:
        print(f"CRITICAL INGEST ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# ENDPOINT 2: INTELLIGENT RECOMMENDATION ENGINE
# ==========================================
@app.post("/api/recommend")
async def recommend_outfit(request: RecommendRequest):
    try:
        greetings = ["hi", "hello", "hey", "sup"]
        if request.prompt.lower().strip() in greetings:
               return {
            "success": True,
            "recommendation": "Hello! I am Aura, your personal style consultant. What is the occasion you are dressing for today?",
            "blueprint": {},
            "meta": {"status": "greeting"}
        }
        # 1. Grab clean inventory
        db_response = supabase_client.table("clothing_items").select("*").eq("wear_status", "clean").execute()
        user_wardrobe = db_response.data if db_response.data else []

        target_temp = request.current_temp
        prompt_lower = request.prompt.lower()
        weather_label = "Rainy/Stormy Context" if request.is_raining else "Standard Weather"
        
        # 2. CONTEXT SCORING
        best_archetype = MASTER_FASHION_RULES[2] 
        highest_score = -1
        for archetype in MASTER_FASHION_RULES:
            score = 0
            low_t, high_t = archetype["ideal_temp_range"]
            if low_t <= target_temp <= high_t: score += 1
            for kw in archetype.get("keywords", []):
                if kw in prompt_lower: score += 5
            if score > highest_score:
                highest_score = score
                best_archetype = archetype

        selected_archetype = best_archetype
        outfit_composition = {}
        owned_items_data = []
        missing_items_needed = []

        # 3. MATCHING LOOP (Same logic preserved)
        components = selected_archetype["components"]
        for placement, structural_rule in components.items():
            if structural_rule["subcategory"] == "None": continue
            matched_user_item = None
            rule_cat = structural_rule["category"].lower().strip()

            for item in user_wardrobe:
                db_cat = item.get("category", "").lower().strip()
                is_top = db_cat in ["tops", "top", "shirt", "shirts"] and rule_cat == "tops"
                is_bottom = db_cat in ["bottoms", "bottom", "pants", "jeans", "shorts"] and rule_cat == "bottoms"
                is_shoes = db_cat in ["shoes", "shoe", "footwear"] and rule_cat == "shoes"
                is_outerwear = db_cat in ["outerwear", "jacket", "layer"] and rule_cat == "outerwear"
                
                item_color = item.get("color_name", item.get("colorName", "")).strip().lower()
                color_match = not structural_rule["colors"] or any(c.lower() in item_color or item_color in c.lower() for c in structural_rule["colors"])
                
                if (is_top or is_bottom or is_shoes or is_outerwear) and color_match:
                    matched_user_item = item
                    break

            if matched_user_item:
                outfit_composition[placement] = f"Your Owned {matched_user_item.get('color_name', 'Item').title()} {matched_user_item.get('subcategory', 'Item').title()}"
                owned_items_data.append(matched_user_item)
            else:
                outfit_composition[placement] = f"[MISSING: {structural_rule['colors'][0] if structural_rule['colors'] else 'Neutral'} {structural_rule['subcategory']}]"
                missing_items_needed.append(f"{structural_rule['colors'][0] if structural_rule['colors'] else 'Neutral'} {structural_rule['subcategory']}")

        # 1. Prepare JSON with escaped braces to fix the f-string syntax error
        outfit_blueprint_str = json.dumps(outfit_composition, indent=2)
        blueprint_json = outfit_blueprint_str.replace("{", "{{").replace("}", "}}")
        
        # 2. Dynamic Tone logic to prevent "Date Night" bias
        request_context = request.prompt.lower()
        tone = "sophisticated and romantic" if any(x in request_context for x in ["date", "dinner", "romantic", "fancy"]) else \
               "sharp, professional, and composed" if any(x in request_context for x in ["office", "meeting", "work", "exam"]) else \
               "preppy, academic, and practical" if any(x in request_context for x in ["college", "school", "campus", "study"]) else \
               "relaxed, modern, and stylish"

        # 3. Clean Prompt
        match_prompt = f"""
        SYSTEM: You are 'Aura', an elite menswear consultant. Speak with high-end, sophisticated terminology. No emojis. No markdown.
        
        CONTEXT:
        The user is dressing for: '{request.prompt}'. 
        The assigned archetype is: '{selected_archetype['style_archetype']}'.
        The required tone is: {tone}.
        
        BLUEPRINT:
        {blueprint_json}

        TASK:
        Acknowledge the specific event '{request.prompt}'. Mention the foundation items found in the BLUEPRINT, then provide 2 concise sentences of actionable styling advice to complete the silhouette.
        """

        # 4. GROQ INFERENCE with Presence Penalty to stop repetitive answers
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": match_prompt}],
            model="llama-3.1-8b-instant", 
            temperature=0.7,
            presence_penalty=0.6 
        )
        final_text_response = chat_completion.choices[0].message.content

        return {
            "success": True,
            "recommendation": final_text_response,
            "blueprint": outfit_composition,
            "meta": {"style_archetype": selected_archetype["style_archetype"]}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    # ==========================================
# NEW ENDPOINTS: CALENDAR INTEGRATION
# ==========================================

# 1. Schedule/Save an outfit
@app.post("/api/schedule-outfit")
async def schedule_outfit(request: RecommendRequest, event_date: str):
    # First, get the recommendation using your existing engine
    recommendation = await recommend_outfit(request)
    
    # Save the planned outfit to the new table
    try:
        supabase_client.table("outfit_calendar").insert({
            "event_date": event_date,
            "event_name": request.prompt,
            "outfit_blueprint": recommendation["blueprint"]
        }).execute()
        
        return {"success": True, "data": recommendation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save to calendar: {str(e)}")

# 2. Retrieve an outfit for a specific date
@app.get("/api/calendar/{date}")
async def get_outfit_for_date(date: str):
    try:
        response = supabase_client.table("outfit_calendar")\
            .select("*")\
            .eq("event_date", date)\
            .execute()
        
        if not response.data:
            return {"success": False, "message": "No outfit planned for this date."}
            
        return {"success": True, "outfit": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calendar lookup failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)