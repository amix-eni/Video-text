import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript-plus';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import FormData from 'form-data';
import { createJob, updateJob } from '@/lib/jobStore';

export async function POST(request: Request) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
    }

    // Create a new job
    const job = createJob();
    console.log(`Job created: ${job.id} for URL: ${videoUrl}`);

    // Return the Job ID immediately
    // The processing happens in the background (fire and forget)
    // Note: In Next.js App Router, we should be careful about "fire and forget".
    // For local dev it's fine. For Vercel, we might need `waitUntil` (Next.js 15+) or similar.
    processSubscription(job.id, videoUrl);

    return NextResponse.json({ jobId: job.id });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to initiate transcript job: ${errorMsg}` }, { status: 500 });
  }
}

/**
 * Background processing function
 */
async function processSubscription(jobId: string, videoUrl: string) {
  try {
    // 1. Extract Video ID
    updateJob(jobId, { status: 'processing', progress: 5, message: 'Extracting video info...' });

    const videoIdMatch = videoUrl.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      updateJob(jobId, { status: 'error', error: 'Invalid YouTube URL' });
      return;
    }

    console.log(`[Job ${jobId}] Processing video ID: ${videoId}`);

    // Fetch video metadata
    let metadata;
    try {
      console.log(`[Job ${jobId}] Fetching metadata for ${videoUrl}...`);
      // Add agent to getBasicInfo as well
      const info = await ytdl.getBasicInfo(videoUrl, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        }
      });
      metadata = {
        title: info.videoDetails.title,
        channel: info.videoDetails.author.name,
        duration: info.videoDetails.lengthSeconds,
        thumbnail: info.videoDetails.thumbnails[0]?.url || ''
      };
      console.log(`[Job ${jobId}] Metadata fetched: ${metadata.title}`);
    } catch (metaError) {
      console.error(`[Job ${jobId}] Failed to fetch metadata:`, metaError);
      // Continue without metadata if it fails, or set defaults
      metadata = { title: 'Unknown Video', channel: 'Unknown Channel', duration: '0', thumbnail: '' };
    }

    // METHOD 1: Try Captions (Fast)
    try {
      updateJob(jobId, { status: 'captions', progress: 10, message: 'Checking for captions...' });
      const transcriptFetcher = new YoutubeTranscript();
      const transcript = await transcriptFetcher.fetchTranscript(videoId);

      if (transcript && transcript.length > 0) {
        const decodeHtml = (text: string) => {
          return text
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ');
        };

        const fullText = transcript.map(item => decodeHtml(item.text)).join(' ');
        console.log(`[Job ${jobId}] Captions found!`);

        updateJob(jobId, {
          status: 'completed',
          progress: 100,
          message: 'Completed using captions',
          result: { transcript: fullText, method: 'captions', metadata }
        });
        return;
      }
    } catch (captionError) {
      console.log(`[Job ${jobId}] Captions failed, trying Whisper fallback...`);
    }

    // METHOD 2: Whisper API (Fallback)
    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not found');
      }

      updateJob(jobId, { status: 'downloading', progress: 20, message: 'Captions unavailable. Downloading audio (this takes a moment)...' });

      // Download
      const audioPath = await downloadAudio(videoId, jobId);
      updateJob(jobId, { status: 'processing', progress: 50, message: 'Audio downloaded. Transcribing with AI...' });

      // Transcribe
      const transcription = await transcribeWithWhisper(audioPath, jobId);

      // Cleanup
      try {
        fs.unlinkSync(audioPath);
      } catch (e) {
        // ignore cleanup error
      }

      updateJob(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Transcription completed successfully',
        result: { transcript: transcription, method: 'whisper', metadata }
      });

    } catch (audioError) {
      const errorMsg = audioError instanceof Error ? audioError.message : 'Unknown error';
      console.error(`[Job ${jobId}] Audio error:`, errorMsg);
      updateJob(jobId, {
        status: 'error',
        error: `Failed to transcribe: ${errorMsg}. Video might be private or restricted.`
      });
    }

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Job ${jobId}] Critical error:`, errorMsg, error);
    updateJob(jobId, { status: 'error', error: `Critical error: ${errorMsg}` });
  }
}

/**
 * Downloads audio from a YouTube video
 */
async function downloadAudio(videoId: string, jobId: string): Promise<string> {
  const audioPath = path.join(tmpdir(), `${videoId}-${Date.now()}.mp3`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return new Promise((resolve, reject) => {
    try {
      // Create a more robust agent or options can help with some network issues
      // But ytdl-core usually handles this well if updated.
      // We will add specific error handling for the stream.
      const stream = ytdl(videoUrl, {
        quality: 'lowestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        }
      });

      let downloaded = 0;
      let total = 0;

      stream.on('progress', (_, downloadedBytes, totalBytes) => {
        downloaded = downloadedBytes;
        total = totalBytes;
        // Map download progress to 20-50% range of total job
        // Avoid division by zero if total is unknown
        const totalSize = total > 0 ? total : downloaded + 1024 * 1024 * 10; // estimate 10MB if unknown
        const percent = 20 + Math.min(30, Math.floor((downloaded / totalSize) * 30));
        updateJob(jobId, { progress: percent, message: `Downloading audio... ${(downloaded / 1024 / 1024).toFixed(1)}MB` });
      });

      const writeStream = fs.createWriteStream(audioPath);
      stream.pipe(writeStream);

      stream.on('error', (error) => {
        console.error(`[Job ${jobId}] Stream error:`, error);
        reject(new Error(`Download stream failed: ${error.message}`));
      });

      writeStream.on('finish', () => resolve(audioPath));
      writeStream.on('error', (error) => reject(new Error(`Write failed: ${error.message}`)));

    } catch (error: any) {
      reject(error);
    }
  });
}

/**
 * Transcribes audio using Groq's Whisper API
 */
async function transcribeWithWhisper(audioPath: string, jobId: string): Promise<string> {
  const stats = fs.statSync(audioPath);
  const fileSizeInMB = stats.size / (1024 * 1024);
  console.log(`[Job ${jobId}] Uploading ${fileSizeInMB.toFixed(2)}MB to Groq...`);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioPath));
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.text;
}
