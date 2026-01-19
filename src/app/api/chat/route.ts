import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { question, transcript, metadata } = await request.json();

        if (!question || !transcript) {
            return NextResponse.json({ error: 'Question and transcript are required' }, { status: 400 });
        }

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
        }

        console.log(`Processing chat question. Transcript length: ${transcript.length}`);

        const truncatedTranscript = transcript.substring(0, 8000);
        console.log(`Truncated transcript length: ${truncatedTranscript.length}`);

        const contextInfo = metadata
            ? `Video Title: ${metadata.title}\nChannel: ${metadata.channel}\n`
            : '';

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful AI assistant analyzing a YouTube video. Your job is to answer questions based ONLY on the information provided in the transcript and metadata below. 

Video Details:
${contextInfo}

Rules:
- Answer questions accurately based on the transcript content
- If the answer isn't in the transcript, politely say "I don't have that information in the video transcript"
- Be concise but informative
- Use a friendly, conversational tone
- If asked about timestamps or specific moments, reference the relevant parts of the transcript

Transcript:
${truncatedTranscript}` // Limit to 8000 chars to be safe
                    },
                    {
                        role: 'user',
                        content: question
                    }
                ],
                temperature: 0.7,
                max_tokens: 800,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Groq API error:', errorText);
            return NextResponse.json({ error: `Groq Error: ${response.status} - ${errorText}` }, { status: response.status });
        }

        const data = await response.json();
        const answer = data.choices[0].message.content;

        console.log('✓ Chat response generated');
        return NextResponse.json({ answer });

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Chat error:', errorMsg);
        return NextResponse.json({ error: `Failed to process question: ${errorMsg}` }, { status: 500 });
    }
}
