from fastapi import APIRouter
from ..schemas import SummaryRequest, SummaryResponse
from ..summarizer import summarize

router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True, "service": "SummarizeME", "status": "healthy"}

@router.post("/summarize", response_model=SummaryResponse)
def summarize_route(req: SummaryRequest) -> SummaryResponse:
    text = (req.text or "").strip()
    if not text:
        return SummaryResponse(ok=False, summary=None, error="No text available for summarization")

    try:
        result = summarize(text, level=req.level) 
        return SummaryResponse(ok=True, summary=result, error=None)
    except Exception as e:
        return SummaryResponse(ok=False, summary=None, error=str(e))