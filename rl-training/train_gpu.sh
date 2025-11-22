#!/bin/bash
# Quick training script with GPU support

echo "🚀 Starting RL Training on GPU"
echo "================================"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if ! python -c "import torch" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Check GPU availability
python -c "import torch; print(f'GPU Available: {torch.cuda.is_available()}')"
python -c "import torch; print(f'GPU Name: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"

echo ""
echo "Training with 5 agents for 500 episodes..."
echo "Expected time: 15-25 minutes on GPU"
echo ""

# Train with progress output
python train.py --episodes 500 --agents 5 --device cuda

echo ""
echo "✅ Training complete!"
echo "📦 Trained model saved to: ./trained_models/"
echo ""
echo "Files generated:"
ls -lh trained_models/

echo ""
echo "Next steps:"
echo "1. Copy trained_models/policy.onnx to next-app/public/"
echo "2. Load model in Three.js with ONNX Runtime Web"

