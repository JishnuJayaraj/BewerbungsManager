from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.hr4u import Hr4uJob
from app.services.hr4u import Hr4uClient, Hr4uClientError
from app.routers.search import get_hr4u_client

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{uuid}", response_model=Hr4uJob)
async def get_job_detail(
    uuid: str,
    client: Hr4uClient = Depends(get_hr4u_client),
) -> Hr4uJob:
    try:
        result = await client.job_detail(uuid)
    except Hr4uClientError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "upstream_hr4u_error",
                "message": "HR4U request failed",
                "details": {"status_code": exc.status_code},
            },
        ) from exc

    if result.status == "expired" or result.job is None:
        raise HTTPException(
            status_code=410,
            detail={
                "code": "job_expired",
                "message": "Job posting is expired or no longer available",
                "details": {"uuid": uuid},
            },
        )
    return result.job
