import sys
import os
import torch
import numpy as np
from fastapi import FastAPI, Response, HTTPException
from io import BytesIO
from scipy.io.wavfile import write as wav_write
from typing import Optional

# Add VibeVoice to sys.path
sys.path.insert(0, "/Users/mattiapetrucciani/VibeVoice")

from demo.web.app import StreamingTTSService

# Get model path from env var or use default
MODEL_PATH = os.getenv("VIBEVOICE_MODEL_PATH", "/Volumes/SSD-FRH-1/Free-River-House/LOCAL-LLM/microsoft/VibeVoice-Realtime-0.5B")

from pydantic import BaseModel

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None

app = FastAPI()
service = None

@app.on_event("startup")
async def startup_event():
    global service
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    service = StreamingTTSService(model_path=MODEL_PATH, device=device)
    service.load()
    print(f"[VibeVoice] TTS server ready at http://localhost:5001")

@app.post("/tts")
async def tts(req: TTSRequest):
    text, voice = req.text, req.voice
    try:
        chunks = []
        for chunk in service.stream(text, voice_key=voice):
            chunks.append(chunk)
        
        if not chunks:
            raise HTTPException(status_code=500, detail="No audio generated")
        
        # Concatenate all chunks
        audio = np.concatenate(chunks, axis=0)
        
        # Convert float32 to int16
        pcm_int16 = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        
        # Create WAV buffer
        buf = BytesIO()
        wav_write(buf, 24000, pcm_int16)
        
        return Response(content=buf.getvalue(), media_type='audio/wav')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_PATH}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)

