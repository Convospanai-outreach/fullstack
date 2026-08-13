import os
from sqlalchemy import create_engine, Column, String, Float, Integer, JSON, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector
import datetime
import uuid

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for edge-fastapi")

engine = create_engine(
    DATABASE_URL,
    pool_size=int(os.getenv("DB_POOL_SIZE", "2")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "2")),
    pool_pre_ping=True,
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE_SECONDS", "300")),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class GoldenRecord(Base):
    __tablename__ = "golden_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    original_prompt = Column(String)
    response_text = Column(String)
    embedding = Column(Vector(384)) # Assuming generic small model embedding size, adjust as needed (e.g. 1536 for openai)
    quality_score = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    record_metadata = Column("metadata", JSON, nullable=True)

class PIITokenMap(Base):
    __tablename__ = "pii_token_map"

    token_id = Column(String, primary_key=True)
    original_text = Column(Text)
    token_type = Column(String) # PERSON, EMAIL, etc.
    session_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class WorkflowRecord(Base):
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    steps = Column(JSON, nullable=False)
    team_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class EdgeSetting(Base):
    __tablename__ = "edge_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

def init_db():
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
