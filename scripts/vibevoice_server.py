"""
VibeVoice TTS FastAPI server — Gino's voice (Italian male, it-Spk1_man)
Runs on port 5001. Load once on startup, serve fast.
"""
import os
import copy
import tempfile
import torch
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

from vibevoice.modular.modeling_vibevoice_streaming_inference import VibeVoiceStreamingForConditionalGenerationInference
from vibevoice.processor.vibevoice_streaming_processor import VibeVoiceStreamingProcessor

MODEL_PATH = os.environ.get(
    'VIBEVOICE_MODEL_PATH',
    '/Volumes/SSD-FRH-1/Free-River-House/LOCAL-LLM/microsoft/VibeVoice-Realtime-0.5B'
)
VOICES_DIR = '/Users/mattiapetrucciani/VibeVoice/demo/voices/streaming_model'
VOICE_MAP = {
    'it-Spk1_man':   os.path.join(VOICES_DIR, 'it-Spk1_man.pt'),
    'en-Carter_man': os.path.join(VOICES_DIR, 'en-Carter_man.pt'),
    'en-Davis_man':  os.path.join(VOICES_DIR, 'en-Davis_man.pt'),
}
DEFAULT_VOICE = 'it-Spk1_man'

_model = None
_processor = None
_voice_presets: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _processor, _voice_presets
    print(f"[VibeVoice] Loading model from {MODEL_PATH} …")
    _processor = VibeVoiceStreamingProcessor.from_pretrained(MODEL_PATH)
    # MPS requires float32 + sdpa (no flash attention)
    _model = VibeVoiceStreamingForConditionalGenerationInference.from_pretrained(
        MODEL_PATH,
        torch_dtype=torch.float32,
        attn_implementation='sdpa',
        device_map=None,
    )
    _model.to('mps')
    _model.eval()
    _model.set_ddpm_inference_steps(num_steps=5)
    # Pre-load voices
    for name, path in VOICE_MAP.items():
        if os.path.exists(path):
            _voice_presets[name] = torch.load(path, map_location='mps', weights_only=False)
            print(f"[VibeVoice] Voice loaded: {name}")
    print("[VibeVoice] Ready ✓")
    yield
    print("[VibeVoice] Shutting down.")


app = FastAPI(title="VibeVoice TTS Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str
    speaker: str = DEFAULT_VOICE


@app.post("/tts")
async def tts(body: TTSRequest):
    if not body.text or len(body.text.strip()) < 3:
        raise HTTPException(status_code=400, detail="Text too short")

    voice_preset = _voice_presets.get(body.speaker) or _voice_presets.get(DEFAULT_VOICE)
    if voice_preset is None:
        raise HTTPException(status_code=503, detail="Voice presets not loaded")

    try:
        inputs = _processor.process_input_with_cached_prompt(
            text=body.text,
            cached_prompt=voice_preset,
            padding=True,
            return_tensors='pt',
            return_attention_mask=True,
        )
        for k, v in inputs.items():
            if torch.is_tensor(v):
                inputs[k] = v.to('mps')

        with torch.no_grad():
            outputs = _model.generate(
                **inputs,
                max_new_tokens=None,
                cfg_scale=1.5,
                tokenizer=_processor.tokenizer,
                generation_config={'do_sample': False},
                verbose=False,
                all_prefilled_outputs=copy.deepcopy(voice_preset),
            )

        # Save to temp WAV
        tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp.close()
        _processor.save_audio(outputs.speech_outputs[0], output_path=tmp.name)
        return FileResponse(tmp.name, media_type='audio/wav',
                            headers={'Content-Disposition': 'inline; filename=gino.wav'})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_PATH, "voices": list(_voice_presets.keys())}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)
