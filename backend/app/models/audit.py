from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    action = Column(String, nullable=False)
    method = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)
    well_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    status_code = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
