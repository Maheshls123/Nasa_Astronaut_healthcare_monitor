"""Load supported project settings from a local .env file."""

import os


_LOCAL_ENV_KEYS = {"GROQ_API_KEY", "GROQ_MODEL"}


def load_project_env(project_root: str) -> None:
    env_path = os.path.join(project_root, ".env")
    if not os.path.isfile(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line_number, raw_line in enumerate(env_file, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].lstrip()

            key, separator, value = line.partition("=")
            key = key.strip()
            if key not in _LOCAL_ENV_KEYS:
                continue
            if not separator:
                raise ValueError(f"Missing '=' for {key} in {env_path}:{line_number}.")

            value = value.strip()
            if value.startswith(("'", '"')):
                quote = value[0]
                if len(value) < 2 or value[-1] != quote:
                    raise ValueError(f"Unclosed quote for {key} in {env_path}:{line_number}.")
                value = value[1:-1]

            os.environ.setdefault(key, value)
