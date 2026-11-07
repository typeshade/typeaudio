"""Pinned local audio LLM: actual PCM inputs, text feedback, no remote inference."""
import argparse
import base64
import hashlib
import io
import json
import math
import os
import resource
from pathlib import Path
import sys
import time

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
import torch
import transformers
from transformers import Qwen2_5OmniConfig, Qwen2_5OmniProcessor, Qwen2_5OmniThinkerForConditionalGeneration, StoppingCriteria, StoppingCriteriaList

MODEL = "Qwen/Qwen2.5-Omni-3B"
REVISION = "f75b40e3da2003cdd6e1829b1f420ca70797c34e"
SYSTEM = "You are Qwen, a virtual human developed by the Qwen Team, Alibaba Group, capable of perceiving auditory and visual inputs, as well as generating text and speech."


class JsonProgress(StoppingCriteria):
    """Stop after a complete JSON reply. Retain incomplete text for timeout diagnosis."""
    def __init__(self, processor, start, path):
        self.processor, self.start, self.path = processor, start, path
        self.complete = False
        self.tokens = 0

    def __call__(self, input_ids, scores, **kwargs):
        tokens = input_ids[0, self.start:]
        self.tokens = len(tokens)
        text = self.processor.decode(tokens, skip_special_tokens=True, clean_up_tokenization_spaces=False)
        if self.tokens == 1 or self.tokens % 32 == 0:
            print(json.dumps({"progressTokens": self.tokens}), file=sys.stderr, flush=True)
            if self.path:
                self.path.write_text(text)
        body = text.strip()
        if body.startswith("```json\n") and body.endswith("\n```"):
            body = body[8:-4]
        try:
            self.complete = isinstance(json.loads(body), dict)
        except (ValueError, TypeError):
            pass
        return self.complete


def decode_audio(encoded):
    data = base64.b64decode(encoded, validate=True)
    if not 44 <= len(data) <= 8_000_000:
        raise ValueError("Audio exceeds its size limit.")
    audio, rate = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    if audio.shape[1] not in (1, 2) or not 0.1 <= len(audio) / rate <= 10 or not np.isfinite(audio).all():
        raise ValueError("Use finite 0.1–10 second mono/stereo PCM.")
    divisor = math.gcd(rate, 16000)
    mono = resample_poly(audio.mean(axis=1), 16000 // divisor, rate // divisor).astype(np.float32)
    return mono, hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true", help="Allow first download of the pinned model.")
    parser.add_argument("--trace-dir", type=Path)
    parser.add_argument("--layout", choices=["paired", "sequence"], default="paired")
    args = parser.parse_args()
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    torch.set_num_interop_threads(1)
    torch.manual_seed(2026)
    np.random.seed(2026)
    config = dict(revision=REVISION, local_files_only=not args.download, cache_dir=os.environ.get("TYPEAUDIO_MODEL_CACHE"))
    processor = Qwen2_5OmniProcessor.from_pretrained(MODEL, use_fast=False, **config)
    thinker_config = Qwen2_5OmniConfig.from_pretrained(MODEL, **config).thinker_config
    model = Qwen2_5OmniThinkerForConditionalGeneration.from_pretrained(
        MODEL, config=thinker_config, dtype=torch.bfloat16, device_map="cpu",
        low_cpu_mem_usage=True, attn_implementation="sdpa", **config,
    ).eval()
    identity = {
        "model": MODEL, "revision": REVISION, "component": "Thinker", "device": "cpu",
        "dtype": "bfloat16", "torch": torch.__version__, "transformers": transformers.__version__,
        "audioLayout": args.layout,
        "preprocessing": "PCM stereo arithmetic mean; scipy polyphase resample to 16 kHz",
        "limitations": "Mono audio input cannot establish stereo localization or spatial listening quality.",
    }
    print(json.dumps({"ready": True, "identity": identity}), flush=True)
    for line in sys.stdin:
        try:
            if len(line) > 22_000_000:
                raise ValueError("Request exceeds its limit.")
            request = json.loads(line)
            if not isinstance(request.get("id"), int) or not 1 <= request["id"] <= 25:
                raise ValueError("Invalid request ID.")
            max_tokens = request.get("maxTokens", 1600)
            if not isinstance(max_tokens, int) or not 64 <= max_tokens <= 1600:
                raise ValueError("Use a 64–1600 output token limit.")
            if not isinstance(request["prompt"], str) or len(request["prompt"]) > 20000:
                raise ValueError("Invalid prompt.")
            a, hash_a = decode_audio(request["a"])
            b, hash_b = decode_audio(request["b"])
            if args.layout == "sequence":
                duration_a, duration_b = len(a) / 16000, len(b) / 16000
                onset_b = duration_a + 0.5
                layout = f'You receive one waveform containing two clips. Audio A is 0 to {duration_a} seconds. A 0.5-second silent gap follows. Audio B is {onset_b} to {onset_b + duration_b} seconds. Labels A and B refer to these time ranges. '
                content = [{"type": "text", "text": layout + request["prompt"]}, {"type": "audio", "audio": "AB"}]
                audios = [np.concatenate([a, np.zeros(8000, dtype=np.float32), b])]
            else:
                content = [
                    {"type": "text", "text": request["prompt"]},
                    {"type": "text", "text": "Audio A:"}, {"type": "audio", "audio": "A"},
                    {"type": "text", "text": "Audio B:"}, {"type": "audio", "audio": "B"},
                ]
                audios = [a, b]
            conversation = [
                {"role": "system", "content": [{"type": "text", "text": SYSTEM}]},
                {"role": "user", "content": content},
            ]
            text = processor.apply_chat_template(conversation, add_generation_prompt=True, tokenize=False)
            inputs = processor(text=text, audio=audios, sampling_rate=16000, return_tensors="pt", padding=True)
            inputs = inputs.to(model.device).to(model.dtype)
            print(json.dumps({"phase": "generate", "inputTokens": inputs["input_ids"].shape[1]}), file=sys.stderr, flush=True)
            trace = args.trace_dir / f'{request["id"]:02d}.partial.txt' if args.trace_dir else None
            progress = JsonProgress(processor, inputs["input_ids"].shape[1], trace)
            start = time.monotonic()
            with torch.inference_mode():
                output = model.generate(**inputs, max_new_tokens=max_tokens, do_sample=False,
                                        eos_token_id=model.config.eos_token_id, pad_token_id=model.config.pad_token_id,
                                        stopping_criteria=StoppingCriteriaList([progress]))
            tokens = output[0, inputs["input_ids"].shape[1]:]
            response = processor.decode(tokens, skip_special_tokens=True, clean_up_tokenization_spaces=False)
            finished = progress.complete or int(tokens[-1]) == model.config.eos_token_id
            print(json.dumps({
                "id": request["id"], "identity": identity, "text": response, "finished": finished,
                "modelAudioSha256": [hashlib.sha256(audio.astype('<f4').tobytes()).hexdigest() for audio in audios],
                "inputSha256": {"A": hash_a, "B": hash_b}, "usage": {
                    "inputTokens": inputs["input_ids"].shape[1], "outputTokens": len(tokens),
                    "seconds": time.monotonic() - start, "maxRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                },
            }), flush=True)
        except Exception as error:
            print(json.dumps({"error": type(error).__name__, "message": "Local audio inference failed. No candidate was promoted."}), flush=True)


if __name__ == "__main__":
    main()
