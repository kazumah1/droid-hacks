#!/bin/bash
# Complete training pipeline - just run this!

set -e  # Exit on error

echo "🚀 TEXT-CONDITIONED RL TRAINING PIPELINE"
echo "=========================================="
echo ""

# Check for API key (Anthropic Claude)
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$NEXT_PUBLIC_ANTHROPIC_API_KEY" ]; then
    echo "❌ ERROR: Anthropic API key not found!"
    echo ""
    echo "Set your API key:"
    echo "  export ANTHROPIC_API_KEY='sk-ant-...'"
    echo "  or"
    echo "  export NEXT_PUBLIC_ANTHROPIC_API_KEY='sk-ant-...'"
    echo ""
    exit 1
fi

echo "✅ Found API key"
echo ""

# Check dependencies
echo "📦 Checking dependencies..."
if ! python -c "import torch" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -q torch sentence-transformers scipy numpy matplotlib anthropic
fi
echo "✅ Dependencies ready"
echo ""

# Step 1: Generate training data
echo "📝 Step 1: Generating training data"
echo "   Using YOUR Claude setup (claude-sonnet-4-5-20250929)"
echo "   This will take ~5 minutes (30+ API calls)"
echo ""

if [ ! -f "data/training_pairs.json" ]; then
    python generate_training_data_anthropic.py
    if [ $? -ne 0 ]; then
        echo "❌ Failed to generate training data"
        exit 1
    fi
else
    echo "⚠️  Found existing data/training_pairs.json"
    read -p "   Regenerate? (y/n): " regenerate
    if [ "$regenerate" = "y" ]; then
        python generate_training_data_anthropic.py
    fi
fi

echo ""
echo "✅ Training data ready"
echo ""

# Step 2: Train
echo "🤖 Step 2: Training text-conditioned agents"
echo "   Expected time: 45-60 minutes on GPU"
echo "   Progress will be shown every 10 episodes"
echo ""

read -p "Start training? (y/n): " start_training
if [ "$start_training" != "y" ]; then
    echo "Training cancelled. Data is saved in data/training_pairs.json"
    echo "Train later with: python train_text_conditioned.py --curriculum"
    exit 0
fi

python train_text_conditioned.py \
    --episodes 600 \
    --agents 5 \
    --device cuda \
    --curriculum

if [ $? -ne 0 ]; then
    echo "❌ Training failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ TRAINING COMPLETE!"
echo "=========================================="
echo ""
echo "📦 Model saved to: trained_models/policy_text_conditioned.onnx"
echo ""
echo "📋 Next steps:"
echo "   1. Copy model: cp trained_models/policy_text_conditioned.onnx ../next-app/public/"
echo "   2. Add to page.tsx: <Script src='https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js' />"
echo "   3. Load in code: await rlSwarm.loadModel('/policy_text_conditioned.onnx')"
echo ""
echo "🎉 Your agents now understand text!"

