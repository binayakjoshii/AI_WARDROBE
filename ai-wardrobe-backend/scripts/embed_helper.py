import os
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path="./.env")
GEMINI_KEY = "AIzaSyCpjtgSp9CH_7whe7Oxku_6dAYnijv6cYo"
client = genai.Client(api_key=GEMINI_KEY)

def get_text_embedding(text: str) -> list:
    """Uses Gemini to convert fashion text descriptions into 768-dimensional math vectors."""
    try:
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=text
        )
        # Returns a list of floats representing the text's semantic meaning
        return response.embeddings[0].values
    except Exception as e:
        print(f"Embedding error: {e}")
        # Return dummy array of 768 dimensions if it fails to keep pipeline alive
        return [0.0] * 768