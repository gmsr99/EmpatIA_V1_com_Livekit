
import logging
import os
import asyncio
from dotenv import load_dotenv
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    AgentSession,
    Agent,
)
from livekit.plugins import google

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test-agent")

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room {ctx.room.name}...")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info("Connected to room.")

    model = google.realtime.RealtimeModel(
        model="gemini-live-2.5-flash-native-audio",
        vertexai=True,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location="europe-west1",
        api_version="v1beta1",
    )

    agent = Agent(instructions="You are a test agent. Say hello.")
    
    session = AgentSession(llm=model)
    
    logger.info("Starting session...")
    await session.start(room=ctx.room, agent=agent)
    logger.info("Session started. Generating reply...")
    
    await session.generate_reply(instructions="Say: The agent is working correctly.")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
