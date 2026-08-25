import { useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [status, setStatus] = useState('Pilih video untuk memulai');
  const [audioScale, setAudioScale] = useState('0');
  const [deviceModel, setDeviceModel] = useState('iPhone 15 Pro Max');
  const [location, setLocation] = useState({ lat: -0.7893, lng: 113.9213 }); // Default Indonesia
  
  const ffmpegRef = useRef(new FFmpeg());

  // Komponen Peta Interaktif
  const LocationPicker = () => {
    useMapEvents({
      click(e) {
        setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return location ? <Marker position={[location.lat, location.lng]} /> : null;
  };

  const processVideo = async () => {
    if (!videoFile) return alert('Pilih video dulu!');
    setStatus('Memuat mesin pemroses (FFmpeg)...');
    
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      await ffmpeg.load();
    }

    setStatus('Memproses video... (Ini mungkin memakan waktu)');
    const inputName = 'input.mp4';
    const outputName = 'output.mp4';

    // Masukkan file ke memori
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    // Menentukan efek audio berdasarkan skala 1-4
    let audioFilter = '';
    if (audioScale === '1') audioFilter = '-af "chorus=0.5:0.9:50|60:0.4|0.32:0.25|0.4:2|2.3"'; // Sedikit bergema
    if (audioScale === '2') audioFilter = '-af "vibrato=f=7.0:d=0.5, volume=1.5"'; // Distorsi sedang
    if (audioScale === '3') audioFilter = '-af "acrusher=level_in=8:level_out=18:bits=8:mode=log, volume=2.0"'; // Rusak kasar (glitch)
    if (audioScale === '4') audioFilter = '-af "aecho=0.8:0.88:60:0.4, acrusher=level_in=8:level_out=18:bits=4:mode=log, volume=3.0"'; // Rusak parah (Noise)

    // Perintah merakit Metadata (GPS + Nama HP) dan Audio
    const command = [
      '-i', inputName,
      '-metadata', `creation_time=now`,
      '-metadata', `location=${location.lat}${location.lng > 0 ? '+' : ''}${location.lng}`,
      '-metadata', `location-eng=${location.lat}${location.lng > 0 ? '+' : ''}${location.lng}`,
      '-metadata', `model="${deviceModel}"`,
      '-metadata', `make="${deviceModel.split(' ')[0]}"`,
    ];

    if (audioScale !== '0') {
      command.push('-af', audioFilter.replace('-af ', ''));
    }

    command.push(outputName);

    // Jalankan perintah eksekusi
    await ffmpeg.exec(command);

    setStatus('Selesai! Mengunduh file...');
    
    // Mengambil hasil file
    const data = await ffmpeg.readFile(outputName);
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    
    // Format nama otomatis (Videos_tanggal_hari_tahun_jam.mp4)
    const date = new Date();
    const finalFileName = `Videos_${date.getDate()}_${date.getDay()}_${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.mp4`;

    const a = document.createElement('a');
    a.href = url;
    a.download = finalFileName;
    a.click();

    setStatus('Video berhasil disimpan!');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h2>🛠️ Metadata Video Editor Pro</h2>
      
      <div style={{ marginBottom: '15px' }}>
        <label><b>1. Pilih Video:</b></label><br/>
        <input type="file" accept="video/mp4" onChange={(e) => setVideoFile(e.target.files[0])} />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label><b>2. Pilih Lokasi (GPS):</b> Tap di peta untuk injeksi koordinat</label>
        <MapContainer center={[-0.7893, 113.9213]} zoom={4} style={{ height: '250px', width: '100%', marginTop: '5px', borderRadius: '10px' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationPicker />
        </MapContainer>
        <small>Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}</small>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label><b>3. Perusak Audio:</b></label><br/>
        <select value={audioScale} onChange={(e) => setAudioScale(e.target.value)} style={{ padding: '5px', width: '100%' }}>
          <option value="0">Original (Tidak Rusak)</option>
          <option value="1">Skala 1 (Bergema)</option>
          <option value="2">Skala 2 (Distorsi Sedang)</option>
          <option value="3">Skala 3 (Rusak Kasar / Glitch)</option>
          <option value="4">Skala 4 (Rusak Parah / Noise Telinga Berdarah)</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label><b>4. Ganti Metadata Perangkat:</b></label><br/>
        <select value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} style={{ padding: '5px', width: '100%' }}>
          <option value="iPhone 15 Pro Max">iPhone 15 Pro Max</option>
          <option value="iPhone 14 Pro">iPhone 14 Pro</option>
          <option value="Samsung Galaxy S24 Ultra">Samsung Galaxy S24 Ultra</option>
          <option value="Xiaomi 14 Pro">Xiaomi 14 Pro</option>
        </select>
      </div>

      <button onClick={processVideo} style={{ padding: '15px', width: '100%', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold' }}>
        ⚙️ Proses & Unduh Video
      </button>

      <p style={{ marginTop: '15px', fontWeight: 'bold', color: status.includes('Selesai') ? 'green' : '#333' }}>
        Status: {status}
      </p>
    </div>
  );
}

export default App;