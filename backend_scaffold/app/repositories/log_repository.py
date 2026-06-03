from sqlalchemy.orm import Session

from app.db.models import SystemLog


class LogRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, level: str, message: str) -> SystemLog:
        item = SystemLog(level=level, message=message)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
