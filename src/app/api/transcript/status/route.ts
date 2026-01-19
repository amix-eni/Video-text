import { NextResponse } from 'next/server';
import { getJob } from '@/lib/jobStore';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = getJob(id);

    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
}
