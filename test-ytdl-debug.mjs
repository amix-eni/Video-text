
import ytdl from '@distube/ytdl-core';
import http from 'http';
import https from 'https';

const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

async function debugYtdl() {
    console.log('--- Debugging YTDL Network Issues ---');

    // 1. Native Fetch of exact URL
    try {
        console.log('1. Fetching video page directly...');
        const res = await fetch(videoUrl, { method: 'HEAD' });
        console.log('   ✅ Fetch Status:', res.status);
    } catch (err) {
        console.log('   ❌ Fetch Failed:', err.message);
    }

    // 2. HTTP/HTTPS GET request (Node legacy)
    console.log('\n2. Node https.get request...');
    await new Promise((resolve) => {
        https.get(videoUrl, (res) => {
            console.log('   ✅ HTTPS Get Status:', res.statusCode);
            res.resume();
            resolve();
        }).on('error', (e) => {
            console.log('   ❌ HTTPS Get Failed:', e.message);
            resolve();
        });
    });

    // 3. YTDL Info
    console.log('\n3. YTDL getBasicInfo...');
    try {
        const info = await ytdl.getBasicInfo(videoUrl);
        console.log('   ✅ YTDL Success:', info.videoDetails.title);
    } catch (err) {
        console.log('   ❌ YTDL Failed:', err.message);
        if (err.code) console.log('      Code:', err.code);
    }
}

debugYtdl();
