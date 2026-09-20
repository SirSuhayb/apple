FROM python:3.11-slim

WORKDIR /app

COPY bots/requirements.txt /app/bots/requirements.txt
RUN pip install --no-cache-dir -r bots/requirements.txt

COPY bots/ /app/bots/

RUN mkdir -p /data

ENV PYTHONUNBUFFERED=1
ENV BITE_BOT_STATE_FILE=/data/state.json
ENV BITE_LEADERBOARD_PUBLIC_FILE=/data/act1-leaderboard.json

CMD ["python", "-m", "bots", "--daemon"]
