import unittest
from pathlib import Path
import torch
from training.model import ModelConfig, RMSNorm, RotaryEmbedding, VxnciForCausalLM, load_model_config

class ModelComponentTests(unittest.TestCase):
    def test_rms_norm_shape_and_finite(self):
        y = RMSNorm(16)(torch.randn(2, 4, 16))
        self.assertEqual(y.shape, (2, 4, 16))
        self.assertTrue(torch.isfinite(y).all())

    def test_rope_shape(self):
        x = torch.randn(2, 4, 6, 8)
        self.assertEqual(RotaryEmbedding(8, 12)(x).shape, x.shape)

    def test_invalid_head_dimension_rejected(self):
        with self.assertRaises(ValueError):
            ModelConfig(hidden_size=30, num_attention_heads=8).validate()

class VxnciModelTests(unittest.TestCase):
    def setUp(self):
        self.config = ModelConfig(vocab_size=128, hidden_size=32, num_layers=2,
            num_attention_heads=4, num_key_value_heads=4, intermediate_size=64,
            context_length=16, max_output_tokens=8)
        self.model = VxnciForCausalLM(self.config)

    def test_logits_shape(self):
        result = self.model(torch.randint(0, 128, (2, 7)))
        self.assertEqual(result["logits"].shape, (2, 7, 128))
        self.assertNotIn("loss", result)

    def test_next_token_loss_and_gradients(self):
        tokens = torch.randint(0, 128, (2, 7))
        result = self.model(tokens, labels=tokens)
        self.assertTrue(torch.isfinite(result["loss"]))
        result["loss"].backward()
        self.assertIsNotNone(self.model.token_embedding.weight.grad)

    def test_embeddings_are_tied(self):
        self.assertIs(self.model.token_embedding.weight, self.model.lm_head.weight)

    def test_context_limit(self):
        with self.assertRaises(ValueError):
            self.model(torch.zeros((1, 17), dtype=torch.long))

    def test_token_range(self):
        with self.assertRaises(ValueError):
            self.model(torch.tensor([[0, 128]], dtype=torch.long))

    def test_input_dtype(self):
        with self.assertRaises(ValueError):
            self.model(torch.ones((1, 3), dtype=torch.int32))

    def test_repository_config(self):
        path = Path(__file__).parents[1] / "model" / "vxnci-1-tiny" / "config.json"
        config = load_model_config(path)
        self.assertEqual(config.model_id, "vxnci-1-tiny")
        self.assertEqual(config.hidden_size, 256)
        self.assertEqual(config.num_layers, 6)

if __name__ == "__main__":
    unittest.main()
