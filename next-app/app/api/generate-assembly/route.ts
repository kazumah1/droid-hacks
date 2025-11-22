// API route for generating assembly plans
import { NextRequest, NextResponse } from 'next/server';
import { generateAssemblyPlan } from '@/app/lib/ai-assembly';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Command is required and must be a string' },
        { status: 400 }
      );
    }

    console.log(`API: Generating assembly plan for command: "${command}"`);
    
    const plan = await generateAssemblyPlan(command);
    
    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error generating assembly plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate assembly plan', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Assembly Plan Generator API',
    usage: 'POST with { "command": "your structure description" }',
    example: { command: 'build a 5-level pyramid' },
  });
}

