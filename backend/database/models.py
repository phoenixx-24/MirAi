from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, JSON, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
Base=declarative_base()
def uid(): return str(uuid4())
def now(): return datetime.now(timezone.utc)
class User(Base):
    __tablename__='users'
    id=Column(String,primary_key=True,default=uid)
    email=Column(String,unique=True,nullable=False,index=True)
    password_hash=Column(String,nullable=False)
    name=Column(String,nullable=False)
    created_at=Column(DateTime(timezone=True),default=now)
class FitnessProfile(Base):
    __tablename__='fitness_profiles'
    user_id=Column(String,ForeignKey('users.id'),primary_key=True)
    data=Column(JSON,nullable=False)
class FoodPreference(Base):
    __tablename__='food_preferences'
    user_id=Column(String,ForeignKey('users.id'),primary_key=True)
    data=Column(JSON,nullable=False)
class FaceProfile(Base):
    __tablename__='face_profiles'
    user_id=Column(String,ForeignKey('users.id'),primary_key=True)
    encrypted=Column(String,nullable=False)
class Token(Base):
    __tablename__='auth_tokens'
    digest=Column(String,primary_key=True)
    user_id=Column(String,ForeignKey('users.id'),nullable=False)
    expires_at=Column(DateTime(timezone=True),nullable=False)
class Workout(Base):
    __tablename__='workout_sessions'
    id=Column(String,primary_key=True,default=uid)
    user_id=Column(String,ForeignKey('users.id'),nullable=False,index=True)
    game=Column(String,nullable=False)
    started_at=Column(DateTime(timezone=True),default=now)
    ended_at=Column(DateTime(timezone=True))
    active_seconds=Column(Float,default=0)
    total_seconds=Column(Float,default=0)
    calories=Column(Float)
    score=Column(Float)
    accuracy=Column(Float)
    paused=Column(Boolean,default=False)
class Streak(Base):
    __tablename__='streaks'
    user_id=Column(String,ForeignKey('users.id'),primary_key=True)
    current=Column(Integer,default=0)
    longest=Column(Integer,default=0)
    updated_at=Column(DateTime(timezone=True),default=now)
# Append-only observation tables; each observation has a user, workout, and timestamp.
records={}
for name in ['game_sessions','sensor_readings','movement_analysis','game_scores','ai_feedback','calorie_records','discomfort_events']:
    records[name]=type(''.join(w.title() for w in name.split('_')),(Base,),{
        '__tablename__':name,'id':Column(String,primary_key=True,default=uid),
        'user_id':Column(String,ForeignKey('users.id'),nullable=False,index=True),
        'session_id':Column(String,ForeignKey('workout_sessions.id'),nullable=False,index=True),
        'timestamp':Column(DateTime(timezone=True),default=now),
        'data':Column(JSON,nullable=False)})
def connect():
    url=os.environ.get('DATABASE_URL','')
    if not url:
        url = 'sqlite:///fitness.db'
    if not url.startswith('postgresql') and not url.startswith('sqlite') and os.environ.get('FITNESS_TESTING')!='1':
        raise RuntimeError('Production requires PostgreSQL or SQLite.')
    try:
        engine = create_engine(url, pool_pre_ping=True) if url.startswith('postgresql') else create_engine(url)
        with engine.connect() as conn:
            pass
        Base.metadata.create_all(engine)
        return engine, sessionmaker(engine, expire_on_commit=False)
    except Exception as exc:
        print(f"[Database] Primary database connection failed ({exc}). Falling back to local SQLite database.")
        db_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(db_dir)
        fallback_path = os.path.join(backend_dir, 'fitness.db').replace('\\', '/')
        engine = create_engine(f"sqlite:///{fallback_path}")
        Base.metadata.create_all(engine)
        return engine, sessionmaker(engine, expire_on_commit=False)

