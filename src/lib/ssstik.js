async function ssstik(url) {
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
    const responseData = await res.json();
    
    if (!responseData || responseData.code !== 0 || !responseData.data) {
        console.error("TikWM Error Log:", responseData?.msg || "No data");
        return null;
    }

    const data = responseData.data;

    if (data.images && data.images.length > 0) {
        return {
            type: 'slide',
            author: data.author?.nickname || 'Unknown',
            caption: data.title || 'No Caption',
            slides: data.images.map((imgUrl, index) => ({ index, downloadUrl: imgUrl }))
        };
    }

    let videoUrl = data.hdplay || data.play;
    
    // PERBAIKAN: Jika link dari TikWM sudah berawalan http/https, jangan ditambah domain lagi
    if (videoUrl && !videoUrl.startsWith('http')) {
        videoUrl = `https://www.tikwm.com${videoUrl}`;
    }

    return {
        type: 'video',
        author: data.author?.nickname || 'Unknown',
        caption: data.title || 'No Caption',
        download: {
            noWatermark: videoUrl
        }
    };
  } catch (e) {
    console.error("Scraper Fatal Error:", e);
    return null;
  }
}

module.exports = { ssstik };

