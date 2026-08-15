from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FamilyTree API"
    environment: str = "development"

    database_url: str = "postgresql+asyncpg://familytree:familytree@localhost:5432/familytree"

    jwt_secret: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    cors_origins: list[str] = ["http://localhost:3000"]

    # Used to build password-reset links. Real email delivery isn't wired up
    # yet (see invitations: link-only for MVP), so outside production the
    # reset endpoint hands the link straight back in the response instead.
    frontend_url: str = "http://localhost:3000"

    # Profile picture uploads. Kept server-side only — the frontend never
    # sees these, it uploads the file to our backend, which forwards it.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # RAG chatbot generation (embeddings are local — see embedding_service.py).
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Cosine distance cutoff for pgvector retrieval — results weaker than
    # this are treated as "nothing relevant found" rather than being fed to
    # the LLM as if they were a match. 0 = identical, 2 = opposite.
    rag_max_distance: float = 0.8
    rag_top_k: int = 8

    # Chat rate limit — caps runaway Groq spend from one account.
    chat_rate_limit_max_requests: int = 15
    chat_rate_limit_window_seconds: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
