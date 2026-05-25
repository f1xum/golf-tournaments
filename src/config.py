from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    # Service-role key for backend scripts that need to write to RLS-protected
    # tables (course_data_candidates, etc). Bypasses RLS — never expose to
    # client code. Find it in Supabase: project settings → API → service_role.
    supabase_service_key: str = ""
    anthropic_api_key: str = ""
    google_maps_api_key: str = ""
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
