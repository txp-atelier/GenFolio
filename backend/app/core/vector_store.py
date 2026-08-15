"""LangChain-managed pgvector store for RAG retrieval. Owns its own tables
(created lazily on first use) — kept separate from the Alembic-managed
schema in app.db.base_models on purpose, since langchain-postgres requires
psycopg3, not the asyncpg driver the rest of the app uses."""

from functools import lru_cache

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_postgres import PGVector
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

COLLECTION_NAME = "health_records"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache
def get_embeddings_model() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)


@lru_cache
def get_vector_store() -> PGVector:
    psycopg_url = settings.database_url.replace(
        "postgresql+asyncpg://", "postgresql+psycopg://"
    )
    engine = create_async_engine(psycopg_url)
    return PGVector(
        embeddings=get_embeddings_model(),
        collection_name=COLLECTION_NAME,
        connection=engine,
        use_jsonb=True,
    )
