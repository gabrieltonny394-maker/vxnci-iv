"""PyTorch reference implementation of the VXNCI-1 Tiny decoder-only Transformer."""
from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import torch
from torch import nn
from torch.nn import functional as F

@dataclass(frozen=True)
class ModelConfig:
    model_id: str = "vxnci-1-tiny"
    vocab_size: int = 8192
    hidden_size: int = 256
    num_layers: int = 6
    num_attention_heads: int = 8
    num_key_value_heads: int = 8
    intermediate_size: int = 1024
    context_length: int = 512
    max_output_tokens: int = 256
    tie_word_embeddings: bool = True
    use_bias: bool = False
    rms_norm_eps: float = 1e-5
    rope_theta: float = 10000.0

    def validate(self) -> None:
        if not self.model_id:
            raise ValueError("model_id must not be empty")
        values = (self.vocab_size, self.hidden_size, self.num_layers,
                  self.num_attention_heads, self.num_key_value_heads,
                  self.intermediate_size, self.context_length, self.max_output_tokens)
        if any(v <= 0 for v in values):
            raise ValueError("All model dimensions and token limits must be positive")
        if self.hidden_size % self.num_attention_heads:
            raise ValueError("hidden_size must be divisible by num_attention_heads")
        if self.num_attention_heads != self.num_key_value_heads:
            raise ValueError("This first implementation requires equal attention and key/value head counts")
        if (self.hidden_size // self.num_attention_heads) % 2:
            raise ValueError("Attention head dimension must be even for RoPE")
        if self.max_output_tokens > self.context_length:
            raise ValueError("max_output_tokens cannot exceed context_length")

def load_model_config(path: str | Path) -> ModelConfig:
    raw: dict[str, Any] = json.loads(Path(path).read_text(encoding="utf-8"))
    p = raw["parameters"]
    config = ModelConfig(
        model_id=raw["modelId"], vocab_size=p["vocabSize"], hidden_size=p["hiddenSize"],
        num_layers=p["numLayers"], num_attention_heads=p["numAttentionHeads"],
        num_key_value_heads=p["numKeyValueHeads"], intermediate_size=p["intermediateSize"],
        context_length=p["contextLength"], max_output_tokens=p["maxOutputTokens"],
        tie_word_embeddings=p["tieWordEmbeddings"], use_bias=p["useBias"])
    config.validate()
    return config

class RMSNorm(nn.Module):
    def __init__(self, hidden_size: int, eps: float = 1e-5) -> None:
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_size))
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * torch.rsqrt(x.pow(2).mean(dim=-1, keepdim=True) + self.eps) * self.weight

class RotaryEmbedding(nn.Module):
    def __init__(self, head_dim: int, max_seq_len: int, theta: float = 10000.0) -> None:
        super().__init__()
        inv_freq = 1.0 / (theta ** (torch.arange(0, head_dim, 2, dtype=torch.float32) / head_dim))
        freqs = torch.outer(torch.arange(max_seq_len, dtype=torch.float32), inv_freq)
        self.register_buffer("cos", freqs.cos(), persistent=False)
        self.register_buffer("sin", freqs.sin(), persistent=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        seq_len = x.shape[-2]
        cos = self.cos[:seq_len].to(dtype=x.dtype)[None, None, :, :]
        sin = self.sin[:seq_len].to(dtype=x.dtype)[None, None, :, :]
        even, odd = x[..., 0::2], x[..., 1::2]
        rotated = torch.stack((-odd, even), dim=-1).flatten(-2)
        cos, sin = torch.stack((cos, cos), dim=-1).flatten(-2), torch.stack((sin, sin), dim=-1).flatten(-2)
        return x * cos + rotated * sin

class CausalSelfAttention(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.num_heads = config.num_attention_heads
        self.num_kv_heads = config.num_key_value_heads
        self.head_dim = config.hidden_size // config.num_attention_heads
        self.q_proj = nn.Linear(config.hidden_size, self.num_heads * self.head_dim, bias=config.use_bias)
        self.k_proj = nn.Linear(config.hidden_size, self.num_kv_heads * self.head_dim, bias=config.use_bias)
        self.v_proj = nn.Linear(config.hidden_size, self.num_kv_heads * self.head_dim, bias=config.use_bias)
        self.o_proj = nn.Linear(config.hidden_size, config.hidden_size, bias=config.use_bias)
        self.rope = RotaryEmbedding(self.head_dim, config.context_length, config.rope_theta)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch, seq_len, hidden = x.shape
        q = self.q_proj(x).view(batch, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(batch, seq_len, self.num_kv_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(batch, seq_len, self.num_kv_heads, self.head_dim).transpose(1, 2)
        q, k = self.rope(q), self.rope(k)
        if self.num_kv_heads != self.num_heads:
            factor = self.num_heads // self.num_kv_heads
            k, v = k.repeat_interleave(factor, dim=1), v.repeat_interleave(factor, dim=1)
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        y = y.transpose(1, 2).contiguous().view(batch, seq_len, hidden)
        return self.o_proj(y)

class SwiGLU(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.gate_proj = nn.Linear(config.hidden_size, config.intermediate_size, bias=config.use_bias)
        self.up_proj = nn.Linear(config.hidden_size, config.intermediate_size, bias=config.use_bias)
        self.down_proj = nn.Linear(config.intermediate_size, config.hidden_size, bias=config.use_bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.down_proj(F.silu(self.gate_proj(x)) * self.up_proj(x))

class TransformerBlock(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        self.attention_norm = RMSNorm(config.hidden_size, config.rms_norm_eps)
        self.attention = CausalSelfAttention(config)
        self.mlp_norm = RMSNorm(config.hidden_size, config.rms_norm_eps)
        self.mlp = SwiGLU(config)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attention(self.attention_norm(x))
        return x + self.mlp(self.mlp_norm(x))

class VxnciForCausalLM(nn.Module):
    def __init__(self, config: ModelConfig) -> None:
        super().__init__()
        config.validate()
        self.config = config
        self.token_embedding = nn.Embedding(config.vocab_size, config.hidden_size)
        self.layers = nn.ModuleList([TransformerBlock(config) for _ in range(config.num_layers)])
        self.final_norm = RMSNorm(config.hidden_size, config.rms_norm_eps)
        self.lm_head = nn.Linear(config.hidden_size, config.vocab_size, bias=False)
        if config.tie_word_embeddings:
            self.lm_head.weight = self.token_embedding.weight
        self.apply(self._initialize_weights)

    @staticmethod
    def _initialize_weights(module: nn.Module) -> None:
        if isinstance(module, (nn.Linear, nn.Embedding)):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if isinstance(module, nn.Linear) and module.bias is not None:
                nn.init.zeros_(module.bias)

    def forward(self, input_ids: torch.Tensor, labels: torch.Tensor | None = None) -> dict[str, torch.Tensor]:
        if input_ids.ndim != 2:
            raise ValueError("input_ids must have shape [batch, sequence]")
        if input_ids.dtype != torch.long:
            raise ValueError("input_ids must use torch.long token IDs")
        if input_ids.shape[1] == 0 or input_ids.shape[1] > self.config.context_length:
            raise ValueError("Input sequence length is outside the configured context window")
        if torch.any(input_ids < 0) or torch.any(input_ids >= self.config.vocab_size):
            raise ValueError("input_ids contains a token outside the vocabulary")
        x = self.token_embedding(input_ids)
        for layer in self.layers:
            x = layer(x)
        logits = self.lm_head(self.final_norm(x))
        result = {"logits": logits}
        if labels is not None:
            if labels.shape != input_ids.shape:
                raise ValueError("labels must have the same shape as input_ids")
            if input_ids.shape[1] < 2:
                raise ValueError("At least two tokens are required to compute next-token loss")
            result["loss"] = F.cross_entropy(
                logits[:, :-1, :].contiguous().view(-1, self.config.vocab_size),
                labels[:, 1:].contiguous().view(-1), ignore_index=-100)
        return result

    @torch.inference_mode()
    def generate(
        self,
        input_ids: torch.Tensor,
        *,
        max_new_tokens: int,
        eos_token_id: int | None = None,
    ) -> torch.Tensor:
        """Greedy autoregressive decoding; returns prompt plus generated token IDs.

        This reference path recomputes the full prefix on every step and is
        intentionally simple. It is not a KV-cache or production serving path.
        """
        if input_ids.ndim != 2 or input_ids.dtype != torch.long:
            raise ValueError("input_ids must be a 2D torch.long tensor")
        if input_ids.shape[0] < 1 or input_ids.shape[1] < 1:
            raise ValueError("input_ids must contain at least one prompt token")
        if max_new_tokens < 0 or max_new_tokens > self.config.max_output_tokens:
            raise ValueError("max_new_tokens is outside the configured output limit")
        if input_ids.shape[1] + max_new_tokens > self.config.context_length:
            raise ValueError("Prompt plus requested output exceeds the configured context window")
        if torch.any(input_ids < 0) or torch.any(input_ids >= self.config.vocab_size):
            raise ValueError("input_ids contains a token outside the vocabulary")
        if eos_token_id is not None and not 0 <= eos_token_id < self.config.vocab_size:
            raise ValueError("eos_token_id is outside the vocabulary")

        generated = input_ids
        finished = torch.zeros(input_ids.shape[0], dtype=torch.bool, device=input_ids.device)
        for _ in range(max_new_tokens):
            next_token = self(generated)["logits"][:, -1, :].argmax(dim=-1, keepdim=True)
            if eos_token_id is not None:
                next_token = torch.where(
                    finished[:, None],
                    torch.full_like(next_token, eos_token_id),
                    next_token,
                )
            generated = torch.cat((generated, next_token), dim=1)
            if eos_token_id is not None:
                finished |= next_token.squeeze(1).eq(eos_token_id)
                if bool(finished.all()):
                    break
        return generated

    def parameter_count(self, trainable_only: bool = True) -> int:
        return sum(p.numel() for p in self.parameters() if not trainable_only or p.requires_grad)
