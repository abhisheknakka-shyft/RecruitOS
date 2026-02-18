"""
LLM provider abstraction. Set LLM_PROVIDER=openai|openrouter|gemini and the
corresponding API key + optional model name in .env.
"""
import os
from typing import Literal, Optional, TypeVar

Provider = Literal["openai", "openrouter", "gemini"]

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "openrouter": "meta-llama/llama-3.1-8b-instruct:free",
    "gemini": "gemini-1.5-flash",
}

T = TypeVar("T")


def get_provider() -> Provider:
    p = (os.environ.get("LLM_PROVIDER") or "openai").strip().lower()
    if p not in ("openai", "openrouter", "gemini"):
        return "openai"
    return p  # type: ignore


def get_model(provider: Provider) -> str:
    key = f"{provider.upper()}_MODEL" if provider != "openrouter" else "MODEL_NAME"
    if provider == "openrouter":
        return os.environ.get("MODEL_NAME") or os.environ.get("OPENROUTER_MODEL") or DEFAULT_MODELS["openrouter"]
    return os.environ.get(key) or DEFAULT_MODELS[provider]


def chat_completion_structured(system: str, user: str, response_model: type[T]) -> Optional[T]:
    """Return structured Pydantic model when using OpenAI (instructor). Else returns None for fallback."""
    provider = get_provider()
    model = get_model(provider)
    if provider == "openai":
        try:
            import instructor
            from openai import OpenAI
            key = os.environ.get("OPENAI_API_KEY", "").strip()
            if not key:
                raise ValueError("OPENAI_API_KEY is not set")
            client = instructor.from_openai(OpenAI(api_key=key))
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.2,
                response_model=response_model,
            )
            return resp  # instructor returns the parsed model
        except Exception:
            return None
    return None


def chat_completion(system: str, user: str) -> str:
    """Returns the assistant message content. Raises ValueError if provider misconfigured or call fails."""
    provider = get_provider()
    model = get_model(provider)

    if provider == "openai":
        from openai import OpenAI
        key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not key:
            raise ValueError("OPENAI_API_KEY is not set")
        client = OpenAI(api_key=key)
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
        )
        return (resp.choices[0].message.content or "").strip()

    if provider == "openrouter":
        from openai import OpenAI
        key = os.environ.get("OPENROUTER_API_KEY", "").strip()
        if not key:
            raise ValueError("OPENROUTER_API_KEY is not set")
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=key,
        )
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
        )
        return (resp.choices[0].message.content or "").strip()

    if provider == "gemini":
        try:
            import google.generativeai as genai
        except ImportError:
            raise ValueError("Gemini provider requires: pip install google-generativeai")
        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "").strip()
        if not key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not set")
        genai.configure(api_key=key)
        gemini = genai.GenerativeModel(model)
        full_prompt = f"{system}\n\n{user}"
        resp = gemini.generate_content(
            full_prompt,
            generation_config={"temperature": 0.2},
        )
        if not resp or not getattr(resp, "text", None):
            raise ValueError("Gemini returned empty response")
        return resp.text.strip()

    raise ValueError(f"Unknown provider: {provider}")
