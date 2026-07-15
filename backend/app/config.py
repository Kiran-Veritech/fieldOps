from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "fieldops"
    cors_origins: str = "http://localhost:5173"

    # Auth / JWT
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Registration domain allow-list
    approved_email_domains: str = "veritech.ai"

    # Email (Resend) — OTP verification after registration
    resend_api_key: str = ""
    resend_from_email: str = "FieldOps Nexus <onboarding@resend.dev>"
    otp_expire_minutes: int = 10

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def approved_domain_list(self) -> list[str]:
        return [d.strip().lower() for d in self.approved_email_domains.split(",") if d.strip()]


settings = Settings()
