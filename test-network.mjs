
async function testNetwork() {
    console.log('Testing raw fetch to https://www.youtube.com...');
    try {
        const res = await fetch('https://www.youtube.com', { method: 'HEAD' });
        console.log('Status:', res.status);
        console.log('OK:', res.ok);
    } catch (err) {
        console.error('Fetch failed:', err.cause || err);
    }
}

testNetwork();
