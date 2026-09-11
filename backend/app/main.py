from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import auth, deals

app = FastAPI(title="Deal Discount Review API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Field-specific messages (e.g. "dealValue must be greater than 0") instead of
# Pydantic's generic "Input should be greater than 0" wording. Keyed by the
# camelCase alias since that's what error["loc"] reports for aliased models.
_MESSAGE_OVERRIDES = {
    ("greater_than", "dealValue"): "dealValue must be greater than 0",
    ("greater_than_equal", "appliedDiscountPct"): "appliedDiscountPct must be between 0 and 100",
    ("less_than_equal", "appliedDiscountPct"): "appliedDiscountPct must be between 0 and 100",
}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field = str(error["loc"][-1]) if error["loc"] else "body"
        message = _MESSAGE_OVERRIDES.get((error["type"], field), error["msg"])
        errors.append({"field": field, "message": message})
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": errors})


app.include_router(auth.router)
app.include_router(deals.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
