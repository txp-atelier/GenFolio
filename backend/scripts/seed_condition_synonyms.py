"""Run once (and re-run any time you add more entries):

    python scripts/seed_condition_synonyms.py

Maps colloquial phrasing to the canonical condition name so chat questions
like "why am I bald" can be matched against records logged as "Androgenetic
Alopecia" — see rag_service.normalize_query.
"""

import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.dialects.postgresql import insert as pg_insert  # noqa: E402

from app.core.db import async_session_maker  # noqa: E402
from app.models.condition_synonym import ConditionSynonym  # noqa: E402

SYNONYMS: dict[str, str] = {
    # Hair
    "bald": "Androgenetic Alopecia",
    "balding": "Androgenetic Alopecia",
    "baldness": "Androgenetic Alopecia",
    "hair loss": "Androgenetic Alopecia",
    "losing hair": "Androgenetic Alopecia",
    # Diabetes
    "sugar disease": "Type 2 Diabetes Mellitus",
    "diabetes": "Type 2 Diabetes Mellitus",
    "high sugar": "Type 2 Diabetes Mellitus",
    "high blood sugar": "Type 2 Diabetes Mellitus",
    "sugar problem": "Type 2 Diabetes Mellitus",
    # Blood pressure
    "high blood pressure": "Hypertension",
    "high bp": "Hypertension",
    "bp problem": "Hypertension",
    "hypertension": "Hypertension",
    # Cholesterol
    "high cholesterol": "Hypercholesterolemia",
    "cholesterol problem": "Hypercholesterolemia",
    # Heart
    "heart disease": "Cardiovascular Disease",
    "heart problem": "Cardiovascular Disease",
    "heart attack": "Myocardial Infarction",
    # Cancer
    "cancer": "Cancer",
    # Thyroid
    "thyroid problem": "Thyroid Disorder",
    "thyroid issue": "Thyroid Disorder",
    # Weight
    "overweight": "Obesity",
    "obesity": "Obesity",
    # Respiratory
    "asthma": "Asthma",
    "breathing problem": "Asthma",
    # Joints
    "arthritis": "Arthritis",
    "joint pain": "Arthritis",
    # Neurological
    "migraine": "Migraine",
    "headaches": "Migraine",
    # Mental health
    "depression": "Depression",
    "anxiety": "Anxiety Disorder",
    # Kidney
    "kidney disease": "Chronic Kidney Disease",
    "kidney problem": "Chronic Kidney Disease",
    # Allergies
    "allergy": "Allergic Disorder",
    "allergies": "Allergic Disorder",
}


async def main() -> None:
    async with async_session_maker() as db:
        for alias, canonical in SYNONYMS.items():
            stmt = (
                pg_insert(ConditionSynonym)
                .values(alias=alias, canonical_name=canonical)
                .on_conflict_do_update(index_elements=["alias"], set_={"canonical_name": canonical})
            )
            await db.execute(stmt)
        await db.commit()
    print(f"Seeded {len(SYNONYMS)} condition synonyms")


if __name__ == "__main__":
    asyncio.run(main())
