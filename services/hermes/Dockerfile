FROM python:3.11-slim
ARG HERMES_REPOSITORY=https://github.com/NousResearch/hermes-agent.git
ARG HERMES_COMMIT=36cb5ae5530a75def7df3195e49b7a4aa2add482
RUN apt-get update && apt-get install -y --no-install-recommends curl git ca-certificates nodejs npm ffmpeg ripgrep && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:/opt/hermes-venv/bin:${PATH}"
RUN uv venv /opt/hermes-venv --python 3.11
RUN git clone "${HERMES_REPOSITORY}" /opt/hermes-agent && cd /opt/hermes-agent && git checkout "${HERMES_COMMIT}" && uv pip install -e ".[all]"
COPY services/hermes /opt/tala
RUN chmod +x /opt/tala/entrypoint.sh
WORKDIR /opt/hermes-agent
EXPOSE 8650
ENTRYPOINT ["/opt/tala/entrypoint.sh"]
