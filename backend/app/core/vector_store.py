"""LangChain-managed pgvector store for RAG retrieval. Owns its own tables
(created lazily on first use) — kept separate from the Alembic-managed
schema in app.db.base_models on purpose, since langchain-postgres requires
psycopg3, not the asyncpg driver the rest of the app uses."""

from functools import lru_cache
from typing import TYPE_CHECKING

from langchain_postgres import PGVector
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

if TYPE_CHECKING:
    from langchain_huggingface import HuggingFaceEmbeddings

COLLECTION_NAME = "health_records"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache
def get_embeddings_model() -> "HuggingFaceEmbeddings":
    # Imported lazily, not at module load: langchain-huggingface pulls in
    # sentence-transformers -> torch/transformers, whose import-time memory
    # footprint alone (300-600MB+) was enough to OOM-kill the whole process
    # on boot under Render's free-tier 512MB limit — before a single request
    # (even an unrelated one like login) could be served. Deferring the
    # import to first actual use means the app boots and serves every route
    # that isn't the health chat without ever paying that cost.
    from langchain_huggingface import HuggingFaceEmbeddings

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
