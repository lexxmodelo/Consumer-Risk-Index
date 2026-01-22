from sqlalchemy import Column, Integer, String, Float, Date, DateTime, UniqueConstraint, Index
from sqlalchemy.sql import func
from app.database import Base

class EconomicIndicator(Base):
    __tablename__ = "economic_indicators"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(String, index=True)
    date = Column(Date, index=True)
    value = Column(Float)
    indicator_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('series_id', 'date', name='uix_series_date'),
        Index('ix_series_date_desc', 'series_id', 'date', postgresql_using='btree'),
        Index('ix_date_brin', 'date', postgresql_using='brin'),
    )

    def to_dict(self):
        return {
            "date": self.date.strftime("%Y-%m-%d"),
            "indicator_name": self.indicator_name,
            "value": self.value,
            "series_id": self.series_id
        }
