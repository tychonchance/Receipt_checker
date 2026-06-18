import anthropic
import base64
import json
import os


client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

_PROMPT = """Extract information from this receipt image and return ONLY a JSON object with these exact fields:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "amount": 0.00,
  "currency": "USD",
  "company": "Store/Company Name",
  "raw_text": "brief description"
}

Rules:
- date: ISO format YYYY-MM-DD, or null if not visible
- time: 24-hour HH:MM, or null if not visible
- amount: total as a number without currency symbols, or null if not visible
- currency: 3-letter ISO code inferred from symbols/country, default "USD"
- company: business/vendor name as shown on the receipt, or null if not visible
- raw_text: brief summary of items purchased (max 80 chars)

Return ONLY valid JSON, no markdown, no extra text."""


async def process_receipt_image(image_data: bytes, filename: str) -> dict:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    media_type = _MEDIA_TYPES.get(ext, "image/jpeg")
    image_b64 = base64.standard_b64encode(image_data).decode("utf-8")

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": _PROMPT},
                    ],
                }
            ],
        )

        text = message.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        return json.loads(text)
    except Exception as exc:
        print(f"Receipt processing error for {filename}: {exc}")
        return {
            "date": None,
            "time": None,
            "amount": None,
            "currency": "USD",
            "company": None,
            "raw_text": f"Processing error: {str(exc)[:60]}",
        }
