import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { text } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        const API_KEY = process.env.GROQ_API_KEY;

        if (!API_KEY) {
            // Simulate summary if no API key is provided for demonstration
            return NextResponse.json({
                summary: "Note: GROQ_API_KEY is missing. This is a simulated summary.\n\n" +
                    "The video discusses several key points related to the provided transcript. " +
                    "Main topics include the core introduction, technical details, and a concluding summary. " +
                    "Users are encouraged to review the full text for specific nuances."
            });
        }

        // Example using Groq API (Llama 3)
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant", // Switch to faster model to avoid rate limits
                messages: [
                    {
                        role: "system",
                        content: "You are an expert technical content analyst. Your task is to provide a comprehensive, high-level summary of the provided YouTube transcript. \n\n" +
                            "CRITICAL: If the transcript contains spoken code, technical commands, or programming logic, identify these sections and format them into clean, syntax-highlighted markdown code blocks. Translate verbalized syntax (e.g., 'print hello world' should become `print('hello world')`) into valid code. \n\n" +
                            "Focus on key takeaways, core architectures, and actionable insights. Format the output with clear headings and professional bullet points. Avoid filler text."
                    },
                    {
                        role: "user",
                        content: text.substring(0, 15000) // Truncate to ~15k chars (~4k tokens) to stay strictly under 6000 TPM limit
                    }
                ],
                temperature: 0.7,
                max_tokens: 2048, // Increased for a longer summary
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('Groq API Error:', data);
            return NextResponse.json({ error: data.error?.message || 'Groq API error' }, { status: response.status });
        }
        return NextResponse.json({ summary: data.choices[0].message.content });

    } catch (error: unknown) {
        console.error('Summarization error:', error);
        return NextResponse.json({ error: 'Failed to generate summary.' }, { status: 500 });
    }
}
