import os
import sys
from sqlalchemy.orm import Session
from app.database.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def seed_users():
    db: Session = SessionLocal()
    
    roles = [
        "drilling_engineer",
        "drilling_supervisor",
        "geologist",
        "well_planner"
    ]
    
    default_password = "password123"
    
    try:
        for role in roles:
            username = role
            email = f"{role}@ertmac-nwis.local"
            
            existing_user = db.query(User).filter(User.username == username).first()
            if existing_user:
                print(f"User {username} already exists. Skipping.")
                continue
                
            new_user = User(
                username=username,
                email=email,
                full_name=f"Test {role.replace('_', ' ').title()}",
                password_hash=get_password_hash(default_password),
                role=role,
                is_active=True
            )
            db.add(new_user)
            db.commit()
            print(f"Created {role} user successfully! (Username: {username}, Password: {default_password})")
            
    except Exception as e:
        print(f"Error seeding users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
