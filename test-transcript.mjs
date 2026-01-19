
import { YoutubeTranscript } from 'youtube-transcript-plus';
import ytdl from '@distube/ytdl-core';

const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo" - short, classic test video

async function testTranscript() {
    console.log('Testing Transcript Fetching for:', videoUrl);

    try {
        console.log('1. Testing Metadata Separation...');
        const info = await ytdl.getBasicInfo(videoUrl);
        console.log('   - Title:', info.videoDetails.title);
        console.log('   - Channel:', info.videoDetails.author.name);
        console.log('   - Duration:', info.videoDetails.lengthSeconds);
    } catch (err) {
        console.error('   ❌ Metadata extraction failed:', err.message);
    }

    try {
        console.log('\n2. Testing YoutubeTranscript...');
        const transcript = await YoutubeTranscript.fetchTranscript('jNQXAC9IVRw');
        if (transcript && transcript.length > 0) {
            console.log('   ✅ Transcript fetched successfully!');
            console.log('   - Sample:', transcript[0].text);
        } else {
            console.log('   ❌ Transcript fetched but empty.');
        }
    } catch (err) {
        console.error('   ❌ YoutubeTranscript failed:', err.message);
    }
}

testTranscript();
