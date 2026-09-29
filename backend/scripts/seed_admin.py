import sys
import os

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def seed_admin():
    username = os.getenv("ADMIN_USERNAME")
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")

    if not username or not email or not password:
        raise ValueError("ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment")

    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == username).first()
        if admin_user:
            print("Admin user already exists.")
            return

        print("Creating admin user...")
        new_admin = User(
            username=username,
            email=email,
            full_name="System Administrator",
            password_hash=get_password_hash(password),
            role="admin",
            is_active=True
        )
        db.add(new_admin)
        db.commit()
        print(f"Admin user created successfully! (Username: {username})")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
