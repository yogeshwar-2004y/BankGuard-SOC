from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    app_env: str = "development"
    database_url: str = "sqlite:///./bankguard.db"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    log_level: str = "INFO"
    seed_demo: bool = True
    session_hours: int = Field(default=8, ge=1, le=24)
    simulation_interval: float = Field(default=1.5, ge=0.1, le=60)
    demo_customer_email: str = "customer@bankguard.test"
    demo_analyst_email: str = "analyst@bankguard.test"
    demo_admin_email: str = "admin@bankguard.test"
    demo_customer_password: str = ""
    demo_analyst_password: str = ""
    demo_admin_password: str = ""

    @model_validator(mode="after")
    def production_configuration(self):
        if self.app_env == "production":
            if any(not origin.startswith("https://") for origin in self.cors_origins.split(",")):
                raise ValueError("Production requires HTTPS CORS origins.")
            if self.seed_demo:
                for role in ["customer", "analyst", "admin"]:
                    value = getattr(self, f"demo_{role}_password")
                    if len(value) < 16 or value == f"{role.title()}-demo-123!":
                        raise ValueError(
                            "Replace public demo passwords with unique 16+ character values in production."
                        )
        return self

    @property
    def secure_cookies(self) -> bool:
        return self.app_env == "production"
