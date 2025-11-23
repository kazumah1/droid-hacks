'use client';

import { useEffect, useState } from 'react';

export default function TestRLPage() {
  const [status, setStatus] = useState('Loading...');
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    testRLModel();
  }, []);

  async function testRLModel() {
    try {
      // Check if ONNX Runtime is loaded
      const ort = (window as any).ort;
      if (!ort) {
        setStatus('❌ ONNX Runtime not loaded');
        return;
      }
      setStatus('✅ ONNX Runtime loaded');

      // Load model
      setStatus('Loading RL model...');
      const session = await ort.InferenceSession.create('/policy_text_conditioned.onnx');
      setStatus('✅ Model loaded!');
      setModelLoaded(true);

      // Test inference
      setStatus('Testing inference...');
      const dummyObs = new Float32Array(58).fill(0.5);
      const dummyText = new Float32Array(384).fill(0.1);

      const obsTensor = new ort.Tensor('float32', dummyObs, [1, 58]);
      const textTensor = new ort.Tensor('float32', dummyText, [1, 384]);

      const results = await session.run({
        observation: obsTensor,
        text_embedding: textTensor
      });

      const actionProbs = results.action_probs.data;
      
      setStatus(`✅ Inference works! Action probs: [${Array.from(actionProbs).slice(0, 8).map((p: number) => p.toFixed(3)).join(', ')}]`);

      console.log('Model outputs:', {
        shape: results.action_probs.dims,
        probs: Array.from(actionProbs)
      });

    } catch (error) {
      setStatus(`❌ Error: ${error}`);
      console.error('RL test error:', error);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-8">RL Model Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-900 rounded">
          <h2 className="text-xl mb-2">Status:</h2>
          <p className="font-mono text-sm">{status}</p>
        </div>

        {modelLoaded && (
          <div className="p-4 bg-green-900 rounded">
            <h2 className="text-xl mb-2">✅ Model Ready!</h2>
            <p>The RL model loaded successfully and can make predictions.</p>
            <p className="mt-2 text-sm text-gray-300">
              Next: Integrate into main app with Three.js visualization
            </p>
          </div>
        )}

        <div className="p-4 bg-gray-900 rounded">
          <h2 className="text-xl mb-2">Model Info:</h2>
          <ul className="text-sm space-y-1">
            <li>• Input: 58 (spatial obs) + 384 (text embedding)</li>
            <li>• Output: 8 action probabilities</li>
            <li>• Actions: 0-5=move, 6=place, 7=pickup</li>
            <li>• Grid: 8×8×8 voxels</li>
          </ul>
        </div>
      </div>

      <a 
        href="/"
        className="mt-8 inline-block px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded"
      >
        Back to Main App
      </a>
    </main>
  );
}

