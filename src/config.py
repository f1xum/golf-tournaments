from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    anthropic_api_key: str = ""
    nominatim_user_agent: str = "bavaria-golf-app"

    # Scraping defaults
    request_delay_seconds: float = 1.5
    max_retries: int = 3
    request_timeout_seconds: float = 30.0

    # BGV
    bgv_base_url: str = "https://www.bayerischer-golfverband.de"
    bgv_clubs_path: str = "/golfclubs"
    bgv_tournaments_path: str = "/turnierkalender"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
