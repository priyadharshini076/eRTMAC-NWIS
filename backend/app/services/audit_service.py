from sqlalchemy.orm import Session
from fastapi import Request
from app.models.audit import AuditLog

def log_action(
    db: Session,
    user_id: int,
    action: str,
    method: str = None,
    endpoint: str = None,
    well_id: str = None,
    ip_address: str = None,
    status_code: int = 200
):
    """
    Records an action in the audit_logs table for decision traceability.
    """
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            method=method,
            endpoint=endpoint,
            well_id=well_id,
            ip_address=ip_address,
            status_code=status_code
        )
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to write audit log: {e}")
