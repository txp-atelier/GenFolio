"""LangChain-managed pgvector store for RAG retrieval. Owns its own tables
(created lazily on first use) — kept separate from the Alembic-managed
schema in app.db.base_models on purpose, since langchain-postgres requires
psycopg3, not the asyncpg driver the rest of the app uses."""

from functools import lru_cache

from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_postgres import PGVector
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

COLLECTION_NAME = "health_records"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache
def get_embeddings_model() -> HuggingFaceEndpointEmbeddings:
    # Computed via Hugging Face's hosted Inference API, NOT locally: loading
    # this same model through sentence-transformers/torch in-process costs
    # 300MB+ just to import, before embedding a single record — enough on
    # its own to OOM-kill the backend on Render's 512MB free tier. This
    # calls the same model remotely instead, so no ML runtime ever loads
    # into this process. Answer generation already sends this same record
    # content to Groq's hosted API (see rag_service.py), so this doesn't
    # introduce a new category of data leaving the server — just moves the
    # embedding step to use the same pattern the generation step already does.
    return HuggingFaceEndpointEmbeddings(
        model=EMBEDDING_MODEL_NAME,
        huggingfacehub_api_token=settings.huggingface_api_token,
    )


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
