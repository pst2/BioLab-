from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Bioinformatics Backend"
    APP_VERSION: str = "0.2.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite:///./bio_backend.db"
    ALLOWED_ORIGINS: str = "*"

    API_KEYS: str = ""

    NCBI_BASE_URL: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    NCBI_API_KEY: str | None = None
    NCBI_TIMEOUT: float = 15.0
    NCBI_RETRY_COUNT: int = 3
    NCBI_RETMAX: int = 10

    CACHE_TTL_GENE_SECONDS: int = 3600
    CACHE_TTL_PUBMED_SECONDS: int = 3600
    CACHE_TTL_SEQUENCE_SECONDS: int = 86400

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_SEARCH: str = "30/minute"
    RATE_LIMIT_SYSTEM: str = "10/minute"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [item.strip() for item in self.ALLOWED_ORIGINS.split(",") if item.strip()] or ["*"]

    @property
    def api_keys_list(self) -> list[str]:
        return [item.strip() for item in self.API_KEYS.split(",") if item.strip()]

    @property
    def has_api_keys(self) -> bool:
        return bool(self.api_keys_list)


settings = Settings()
