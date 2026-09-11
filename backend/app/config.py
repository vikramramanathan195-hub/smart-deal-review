from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 8 * 60

    # Next.js dev default. The frontend was TanStack Start (port 8080) until
    # the Next.js rewrite.
    frontend_origin: str = "http://localhost:3000"


settings = Settings()
