import os
from sqlalchemy import create_engine, Column, String, Float, Integer, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pgvector.sqlalchemy import Vector
import datetime
import uuid

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for edge-fastapi")

engine = create_engine(DATABASE_URL)
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
    original_text = Column(String)
    token_type = Column(String) # PERSON, EMAIL, etc.
    session_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
