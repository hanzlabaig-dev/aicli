# Provider Guide

AICLI supports five AI providers through a unified interface. You can switch
between them at runtime without restarting the application.

---

## OpenRouter (default)

[OpenRouter](https://openrouter.ai) aggregates 200+ models from dozens of
providers under a single API.

**Setup:**
```bash
# CLI
/config set provider.openrouter.apiKey sk-or-your-key

# Environment variable
export OPENROUTER_API_KEY=sk-or-your-key
```

**Browsing models:**
```bash
/models             # All available models
/models coding      # Code-focused models
/models free        # Zero-cost models
/models gpt-4       # Search by name
/models reasoning   # Chain-of-thought models
/models vision      # Vision / multimodal models
/models large-context  # 100k+ context window
```

**Model tags** are inferred automatically from the model name and metadata:
| Tag | Meaning |
|-----|---------|
| `coding` | Model name contains "code" or "coder" |
| `vision` | Supports image inputs |
| `reasoning` | Deep reasoning (o1, Thinking, etc.) |
| `free` | Zero prompt cost |
| `large-context` | Context ≥ 100 000 tokens |

---

## Anthropic Claude

**Setup:**
```bash
/config set provider.anthropic.apiKey sk-ant-your-key
# or: export ANTHROPIC_API_KEY=sk-ant-your-key
```

**Switch:**
```bash
/provider anthropic
/models          # Lists available Claude models
```

Available models (built-in list, always up-to-date via API):
- `claude-opus-4-5` — Most capable, 200k context
- `claude-sonnet-4-5` — Balanced performance
- `claude-3-5-sonnet-20241022` — Strong coding model
- `claude-3-5-haiku-20241022` — Fast and affordable
- `claude-3-opus-20240229` — Deep reasoning
- `claude-3-haiku-20240307` — Fastest Claude

---

## OpenAI

**Setup:**
```bash
/config set provider.openai.apiKey sk-your-key
# or: export OPENAI_API_KEY=sk-your-key
```

**Switch:**
```bash
/provider openai
/models          # Fetches live model list from OpenAI API
```

Supported model families: GPT-4o, GPT-4, GPT-3.5-Turbo, o1, o3-mini.

---

## Google Gemini

**Setup:**
```bash
/config set provider.gemini.apiKey your-key
# or: export GEMINI_API_KEY=your-key
```

Get a key at [Google AI Studio](https://aistudio.google.com/app/apikey).

**Switch:**
```bash
/provider gemini
/models
```

Available models:
| Model | Context | Notes |
|-------|---------|-------|
| `gemini-1.5-pro` | 2M tokens | Best for complex tasks |
| `gemini-1.5-flash` | 1M tokens | Fast, vision capable |
| `gemini-1.5-flash-8b` | 1M tokens | Smallest/fastest |
| `gemini-2.0-flash-exp` | 1M tokens | Experimental 2.0 |

---

## Ollama (Local / Offline)

Ollama runs models completely on your machine — no API key required, no data
leaves your computer.

**Prerequisites:**
1. Install Ollama: https://ollama.ai
2. Start the server: `ollama serve`
3. Pull a model: `ollama pull llama3.1` (or `codellama`, `mistral`, etc.)

**Switch:**
```bash
/provider ollama
/models          # Lists locally installed models
```

**Custom base URL** (e.g. Ollama on a remote machine):
```bash
/config set provider.ollama.baseUrl http://my-server:11434
```

Recommended coding models:
```bash
ollama pull codellama:13b
ollama pull deepseek-coder-v2
ollama pull qwen2.5-coder:7b
```

---

## Switching Providers Mid-Session

You can switch providers and models at any time. The conversation history is
preserved across switches.

```bash
/provider anthropic   # Switch to Claude
/models               # Pick a Claude model
# ... continue chatting ...
/provider openrouter  # Switch back
/models gpt-4o        # Filter to GPT-4o models
```

The selected model is saved as the new default for that provider in your config.
