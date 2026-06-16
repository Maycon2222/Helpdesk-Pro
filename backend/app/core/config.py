from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://helpdesk:helpdesk123@db:5432/helpdesk"
    jwt_secret: str = "troque-esta-chave-por-uma-chave-forte-com-mais-de-32-caracteres"
    jwt_expires_hours: int = 8
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
