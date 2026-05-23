from app.config import MODEL_API_FALLBACKS, MODEL_DEEP, MODEL_FAST


def display_model(model_id: str) -> str:
    """Labels shown in UI and live feed."""
    if model_id in MODEL_API_FALLBACKS.get(MODEL_FAST, [MODEL_FAST]):
        return MODEL_FAST
    if model_id in MODEL_API_FALLBACKS.get(MODEL_DEEP, [MODEL_DEEP]):
        return MODEL_DEEP
    return model_id


def resolve_api_models(model_id: str) -> list[str]:
    """Ordered list of API model IDs to try."""
    return MODEL_API_FALLBACKS.get(model_id, [model_id])


def resolve_structure_model(model_id: str | None) -> str:
    return model_id or MODEL_DEEP
