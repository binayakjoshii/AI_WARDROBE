import httpx

GUWAHATI_LAT = 26.1445
GUWAHATI_LON = 91.7362

async def get_current_temperature(lat: float = GUWAHATI_LAT, lon: float = GUWAHATI_LON) -> float:
    """Fetch current temperature from Open-Meteo. Returns temperature in Celsius. Falls back to 28.0 on error."""
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(url)
            data = res.json()
            temp = data["current_weather"]["temperature"]
            print(f"Current temperature: {temp}°C")
            return float(temp)
    except Exception as e:
        print(f"Weather API error: {e}, using fallback 28°C")
        return 28.0