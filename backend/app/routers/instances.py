from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.crypto import decrypt_secret, encrypt_secret
from app.database import get_db
from app.models import CachedData, Instance, User
from app.schemas import InstanceCreate, InstanceResponse, InstanceUpdate, TestConnectionResponse
from app.services.aggregator import _fetch_instance_data
from app.services.lacework_client import LaceworkClient

router = APIRouter()


def _build_base_url(account: str) -> str:
    account = account.strip()
    if account.endswith(".lacework.net"):
        return account
    return f"{account}.lacework.net"


@router.get("", response_model=list[InstanceResponse])
async def list_instances(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Instance).order_by(Instance.name))
    return result.scalars().all()


@router.post("", response_model=InstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_instance(
    data: InstanceCreate,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_url = _build_base_url(data.account)
    instance = Instance(
        name=data.name,
        account=data.account.replace(".lacework.net", ""),
        base_url=base_url,
        api_key_id=data.api_key_id,
        api_secret_enc=encrypt_secret(data.api_secret),
        sub_account=data.sub_account,
        email=data.email,
        last_sync_status="pending",
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return instance


@router.get("/{instance_id}", response_model=InstanceResponse)
async def get_instance(
    instance_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Instance).where(Instance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    return instance


@router.put("/{instance_id}", response_model=InstanceResponse)
async def update_instance(
    instance_id: int,
    data: InstanceUpdate,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Instance).where(Instance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    if data.name is not None:
        instance.name = data.name
    if data.account is not None:
        instance.account = data.account.replace(".lacework.net", "")
        instance.base_url = _build_base_url(data.account)
    if data.api_key_id is not None:
        instance.api_key_id = data.api_key_id
    if data.api_secret is not None:
        instance.api_secret_enc = encrypt_secret(data.api_secret)
    if data.sub_account is not None:
        instance.sub_account = data.sub_account or None
    if data.email is not None:
        instance.email = data.email or None
    if data.is_enabled is not None:
        instance.is_enabled = data.is_enabled

    await db.commit()
    await db.refresh(instance)
    return instance


@router.delete("/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instance(
    instance_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Instance).where(Instance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    await db.delete(instance)
    await db.commit()


@router.post("/{instance_id}/test", response_model=TestConnectionResponse)
async def test_instance_connection(
    instance_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Instance).where(Instance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    secret = decrypt_secret(instance.api_secret_enc)
    client = LaceworkClient(instance.base_url, instance.api_key_id, secret, instance.sub_account)
    try:
        success, message = await client.test_connection()
        return TestConnectionResponse(success=success, message=message)
    finally:
        await client.close()


@router.post("/{instance_id}/sync")
async def sync_instance(
    instance_id: int,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a data refresh for a single instance."""
    import json
    from datetime import datetime, timezone

    result = await db.execute(select(Instance).where(Instance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    data = await _fetch_instance_data(instance)
    now = datetime.now(timezone.utc)

    instance.last_sync_at = now
    instance.last_sync_status = data["status"]
    instance.last_error = data.get("error")

    # Clear old cached data for this instance
    await db.execute(delete(CachedData).where(CachedData.instance_id == instance_id))

    # Store each data type
    for data_type in ("alerts", "host_vulns", "container_vulns", "compliance", "identities"):
        db.add(CachedData(
            instance_id=instance_id,
            data_type=data_type,
            json_data=json.dumps(data.get(data_type, [])),
            fetched_at=now,
        ))

    await db.commit()
    await db.refresh(instance)

    return {
        "success": data["status"] == "healthy",
        "status": data["status"],
        "alerts": len(data.get("alerts", [])),
        "host_vulns": len(data.get("host_vulns", [])),
        "compliance": len(data.get("compliance", [])),
        "identities": len(data.get("identities", [])),
        "error": data.get("error"),
    }


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_new_connection(
    data: InstanceCreate,
    _user: User = Depends(get_current_user),
):
    base_url = _build_base_url(data.account)
    client = LaceworkClient(base_url, data.api_key_id, data.api_secret, data.sub_account)
    try:
        success, message = await client.test_connection()
        return TestConnectionResponse(success=success, message=message)
    finally:
        await client.close()
